// RiftCity Native Core v2
// Shared deterministic CPU kernels for browser + Cloudflare WASM targets.
// Keep this translation unit freestanding: no libc, no exceptions, no RTTI.

static unsigned short g_section_states[4096];
static unsigned char g_section_face_masks[4096];

static float rift_clamp01(float value) {
  if (value < 0.0f) return 0.0f;
  if (value > 1.0f) return 1.0f;
  return value;
}

static float rift_fraction(float value) {
  int base = (int)value;
  if (value < (float)base) base -= 1;
  return value - (float)base;
}

static float rift_stair_top_impl(int rotation, float localX, float localZ) {
  float t = 0.0f;
  switch (rotation & 3) {
    case 0: t = 1.0f - localZ; break; // north
    case 1: t = localX; break;        // east
    case 2: t = localZ; break;        // south
    case 3: t = 1.0f - localX; break; // west
  }
  return rift_clamp01(t);
}

static float rift_shape_top_impl(int shape, int rotation, float localX, float localZ) {
  switch (shape) {
    case 1: return 0.5f; // bottom slab
    case 2: return 1.0f; // top slab
    case 3: return rift_stair_top_impl(rotation, localX, localZ);
    case 0:
    default: return 1.0f;
  }
}

extern "C" {

__attribute__((visibility("default"))) int rift_core_version() {
  return 2;
}

__attribute__((visibility("default"))) int rift_section_index(int x, int y, int z) {
  if (x < 0 || x >= 16 || y < 0 || y >= 16 || z < 0 || z >= 16) return -1;
  return (y << 8) | (z << 4) | x;
}

__attribute__((visibility("default"))) int rift_floor_div(int value, int divisor) {
  if (divisor <= 0) return 0;
  int quotient = value / divisor;
  int remainder = value % divisor;
  if (remainder != 0 && value < 0) quotient -= 1;
  return quotient;
}

__attribute__((visibility("default"))) int rift_positive_mod(int value, int divisor) {
  if (divisor <= 0) return 0;
  int result = value % divisor;
  return result < 0 ? result + divisor : result;
}

__attribute__((visibility("default"))) int rift_aabb_intersects(
  float aMinX, float aMinY, float aMinZ,
  float aMaxX, float aMaxY, float aMaxZ,
  float bMinX, float bMinY, float bMinZ,
  float bMaxX, float bMaxY, float bMaxZ
) {
  return aMinX < bMaxX && aMaxX > bMinX &&
         aMinY < bMaxY && aMaxY > bMinY &&
         aMinZ < bMaxZ && aMaxZ > bMinZ ? 1 : 0;
}

__attribute__((visibility("default"))) float rift_distance_sq3(
  float ax, float ay, float az,
  float bx, float by, float bz
) {
  const float dx = ax - bx;
  const float dy = ay - by;
  const float dz = az - bz;
  return dx * dx + dy * dy + dz * dz;
}

__attribute__((visibility("default"))) unsigned int rift_hash3(
  int x, int y, int z, unsigned int seed
) {
  unsigned int h = seed ^ 0x9E3779B9u;
  h ^= (unsigned int)x * 0x85EBCA6Bu;
  h = (h << 13) | (h >> 19);
  h ^= (unsigned int)y * 0xC2B2AE35u;
  h = (h << 11) | (h >> 21);
  h ^= (unsigned int)z * 0x27D4EB2Fu;
  h ^= h >> 16;
  h *= 0x7FEB352Du;
  h ^= h >> 15;
  h *= 0x846CA68Bu;
  h ^= h >> 16;
  return h;
}

// Player/support kernels ----------------------------------------------------

__attribute__((visibility("default"))) int rift_crossed_support(
  float previousY,
  float candidateY,
  float supportY,
  float tolerance,
  float previousTolerance
) {
  if (tolerance < 0.0f) tolerance = 0.0f;
  if (previousTolerance < 0.0f) previousTolerance = 0.0f;
  return candidateY <= supportY + tolerance &&
         previousY >= supportY - previousTolerance ? 1 : 0;
}

// 0 = drop, 1 = grounded, 2 = blocked.
__attribute__((visibility("default"))) int rift_ground_step_classify(
  float currentY,
  float targetSupportY,
  float stepUp,
  float snapDown
) {
  if (stepUp < 0.0f) stepUp = 0.0f;
  if (snapDown < 0.0f) snapDown = 0.0f;
  const float delta = targetSupportY - currentY;
  if (delta > stepUp + 0.0001f) return 2;
  if (delta < -snapDown - 0.0001f) return 0;
  return 1;
}

__attribute__((visibility("default"))) float rift_stair_top(
  int rotation,
  float localX,
  float localZ
) {
  return rift_stair_top_impl(rotation, localX, localZ);
}

__attribute__((visibility("default"))) float rift_shape_top(
  int shape,
  int rotation,
  float localX,
  float localZ
) {
  return rift_shape_top_impl(shape, rotation, localX, localZ);
}

__attribute__((visibility("default"))) float rift_state_shape_top(
  unsigned int state,
  float worldX,
  float worldZ
) {
  if (state == 0u) return 0.0f;
  const int shape = (int)((state >> 8) & 7u);
  const int rotation = (int)((state >> 11) & 3u);
  return rift_shape_top_impl(shape, rotation, rift_fraction(worldX), rift_fraction(worldZ));
}

// Full-block section meshing kernel ---------------------------------------
// Face bit order intentionally matches RIFT_BLOCK_FACE_DEFS:
// 0 east, 1 west, 2 top, 3 bottom, 4 south, 5 north.
// Boundary faces remain candidates because the JS section grid owns cross-
// section lookups. Internal neighbor tests are handled entirely here.

__attribute__((visibility("default"))) unsigned int rift_section_states_ptr() {
  return (unsigned int)(unsigned long)&g_section_states[0];
}

__attribute__((visibility("default"))) unsigned int rift_section_face_masks_ptr() {
  return (unsigned int)(unsigned long)&g_section_face_masks[0];
}

// Packed result:
// bit 31      = section contains at least one partial block shape
// bits 16..30 = solid block count
// bits 0..15  = candidate visible-face count (full-block sections only)
__attribute__((visibility("default"))) unsigned int rift_build_section_face_masks() {
  unsigned int blocks = 0u;
  int containsPartial = 0;

  for (int index = 0; index < 4096; index += 1) {
    g_section_face_masks[index] = 0u;
    const unsigned short state = g_section_states[index];
    if (state == 0u) continue;
    blocks += 1u;
    if ((state & 0x0700u) != 0u) containsPartial = 1;
  }

  if (containsPartial) {
    return 0x80000000u | (blocks << 16);
  }

  unsigned int faces = 0u;
  for (int y = 0; y < 16; y += 1) {
    for (int z = 0; z < 16; z += 1) {
      for (int x = 0; x < 16; x += 1) {
        const int index = (y << 8) | (z << 4) | x;
        if (g_section_states[index] == 0u) continue;

        unsigned char mask = 0u;
        if (x == 15 || g_section_states[index + 1] == 0u)  { mask |= 1u << 0; faces += 1u; }
        if (x == 0  || g_section_states[index - 1] == 0u)  { mask |= 1u << 1; faces += 1u; }
        if (y == 15 || g_section_states[index + 256] == 0u){ mask |= 1u << 2; faces += 1u; }
        if (y == 0  || g_section_states[index - 256] == 0u){ mask |= 1u << 3; faces += 1u; }
        if (z == 15 || g_section_states[index + 16] == 0u) { mask |= 1u << 4; faces += 1u; }
        if (z == 0  || g_section_states[index - 16] == 0u) { mask |= 1u << 5; faces += 1u; }
        g_section_face_masks[index] = mask;
      }
    }
  }

  return (blocks << 16) | (faces & 0xffffu);
}

}
