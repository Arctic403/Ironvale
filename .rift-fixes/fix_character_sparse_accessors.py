from pathlib import Path
import re

character_path = Path('public/rift-character.js')
text = character_path.read_text(encoding='utf-8')
pattern = re.compile(r"function readAccessor\(parsed, index\) \{.*?\n\}\n\nfunction bufferViewBytes", re.S)
replacement = r'''function readAccessor(parsed, index) {
  const { document, binary } = parsed;
  const accessor = document.accessors?.[index];
  if (!accessor) throw new Error(`Missing glTF accessor ${index}.`);
  const components = TYPE_COMPONENTS[accessor.type];
  const componentBytes = COMPONENT_BYTES[accessor.componentType];
  if (!components || !componentBytes) throw new Error(`Unsupported accessor ${accessor.type}/${accessor.componentType}.`);

  const source = new DataView(binary.buffer, binary.byteOffset, binary.byteLength);
  const result = new Float64Array(accessor.count * components);

  // glTF 2.0 permits accessors without a bufferView. Their base value is all zeros,
  // with an optional sparse payload overriding only the changed elements.
  if (accessor.bufferView != null) {
    const bufferView = document.bufferViews?.[accessor.bufferView];
    if (!bufferView) throw new Error(`Accessor ${index} references missing bufferView ${accessor.bufferView}.`);
    const stride = bufferView.byteStride || components * componentBytes;
    const start = (bufferView.byteOffset || 0) + (accessor.byteOffset || 0);
    const end = start + Math.max(0, accessor.count - 1) * stride + components * componentBytes;
    if (start < 0 || end > binary.byteLength) throw new Error(`Accessor ${index} exceeds GLB binary data.`);
    for (let item = 0; item < accessor.count; item += 1) {
      const base = start + item * stride;
      for (let component = 0; component < components; component += 1) {
        let value = readComponent(source, base + component * componentBytes, accessor.componentType);
        if (accessor.normalized) value = normalizedComponent(value, accessor.componentType);
        result[item * components + component] = value;
      }
    }
  } else if ((accessor.byteOffset || 0) !== 0) {
    throw new Error(`Accessor ${index} cannot use byteOffset without bufferView.`);
  }

  if (accessor.sparse) {
    const sparse = accessor.sparse;
    const sparseCount = Math.trunc(Number(sparse.count) || 0);
    if (sparseCount < 0 || sparseCount > accessor.count) throw new Error(`Accessor ${index} has invalid sparse count ${sparseCount}.`);
    const indicesView = document.bufferViews?.[sparse.indices?.bufferView];
    const valuesView = document.bufferViews?.[sparse.values?.bufferView];
    const indexType = sparse.indices?.componentType;
    const indexBytes = COMPONENT_BYTES[indexType];
    if (!indicesView || !valuesView || ![5121, 5123, 5125].includes(indexType) || !indexBytes) {
      throw new Error(`Accessor ${index} has invalid sparse indices/values.`);
    }
    const indexStart = (indicesView.byteOffset || 0) + (sparse.indices.byteOffset || 0);
    const valueStart = (valuesView.byteOffset || 0) + (sparse.values.byteOffset || 0);
    const indexEnd = indexStart + sparseCount * indexBytes;
    const valueEnd = valueStart + sparseCount * components * componentBytes;
    if (indexStart < 0 || valueStart < 0 || indexEnd > binary.byteLength || valueEnd > binary.byteLength) {
      throw new Error(`Accessor ${index} sparse payload exceeds GLB binary data.`);
    }
    for (let sparseItem = 0; sparseItem < sparseCount; sparseItem += 1) {
      const targetItem = readComponent(source, indexStart + sparseItem * indexBytes, indexType);
      if (targetItem < 0 || targetItem >= accessor.count) throw new Error(`Accessor ${index} sparse index ${targetItem} is out of range.`);
      const base = valueStart + sparseItem * components * componentBytes;
      for (let component = 0; component < components; component += 1) {
        let value = readComponent(source, base + component * componentBytes, accessor.componentType);
        if (accessor.normalized) value = normalizedComponent(value, accessor.componentType);
        result[targetItem * components + component] = value;
      }
    }
  }

  return { values: result, count: accessor.count, components, accessor };
}

function bufferViewBytes'''
new_text, count = pattern.subn(replacement, text, count=1)
if count != 1:
    raise SystemExit('Could not locate readAccessor implementation')
character_path.write_text(new_text, encoding='utf-8')

app_path = Path('public/app.js')
app = app_path.read_text(encoding='utf-8')
app = app.replace("./rift-character.js?v=20260831-character-freecam-r2", "./rift-character.js?v=20260831-character-sparse-r1")
app_path.write_text(app, encoding='utf-8')

index_path = Path('public/index.html')
index = index_path.read_text(encoding='utf-8')
index = index.replace('/app.js?v=20260831-character-freecam-r2', '/app.js?v=20260831-character-sparse-r1')
index_path.write_text(index, encoding='utf-8')

check_path = Path('scripts/check-core.js')
check = check_path.read_text(encoding='utf-8')
anchor = "if (!characterRuntime.includes('DEFAULT_CHARACTER_MODEL_URL') || !characterRuntime.includes(\"cache: 'no-cache'\")) failures.push('character cache-safe loading');\n"
addition = "if (!characterRuntime.includes('accessor.bufferView != null') || !characterRuntime.includes('if (accessor.sparse)') || !characterRuntime.includes('sparse.indices') || !characterRuntime.includes('sparse.values')) failures.push('glTF zero-base/sparse accessor support');\n"
if addition not in check:
    if anchor not in check:
        raise SystemExit('Could not locate character runtime check anchor')
    check = check.replace(anchor, anchor + addition, 1)
check_path.write_text(check, encoding='utf-8')

print('Patched glTF sparse/zero accessor support and character cache version.')
