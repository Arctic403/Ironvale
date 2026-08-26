const VERIFIED_ASSET_CACHE = 'riftcity-verified-assets-v1';
const SHA256_RE = /^[a-f0-9]{64}$/;

export function normalizeSha256(value) {
  const hash = String(value || '').trim().toLowerCase();
  return SHA256_RE.test(hash) ? hash : '';
}

export async function sha256Blob(blob) {
  if (!blob || typeof blob.arrayBuffer !== 'function') throw new Error('A Blob/File is required');
  const digest = await crypto.subtle.digest('SHA-256', await blob.arrayBuffer());
  return Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('');
}

export async function sha256File(file) {
  return sha256Blob(file);
}

export async function dataUrlToBlob(dataUrl) {
  const value = String(dataUrl || '');
  if (!value.startsWith('data:image/')) throw new Error('Expected an embedded image data URL');
  const response = await fetch(value);
  if (!response.ok) throw new Error('Could not decode embedded image');
  return response.blob();
}

function cacheRequest(hash) {
  const normalized = normalizeSha256(hash);
  if (!normalized) throw new Error('Invalid SHA-256 hash');
  const origin = globalThis.location?.origin || 'https://riftcity.invalid';
  return new Request(`${origin}/__riftcity_verified_asset_cache__/${normalized}`);
}

export async function getCachedVerifiedBlob(hash) {
  const normalized = normalizeSha256(hash);
  if (!normalized || !globalThis.caches) return null;
  const cache = await caches.open(VERIFIED_ASSET_CACHE);
  const response = await cache.match(cacheRequest(normalized));
  if (!response) return null;
  const blob = await response.blob();
  return await sha256Blob(blob) === normalized ? blob : null;
}

export async function cacheVerifiedBlob(blob, hash) {
  const normalized = normalizeSha256(hash);
  if (!normalized) throw new Error('Invalid SHA-256 hash');
  const actual = await sha256Blob(blob);
  if (actual !== normalized) throw new Error('Asset bytes do not match the approved SHA-256');
  if (!globalThis.caches) return;
  const cache = await caches.open(VERIFIED_ASSET_CACHE);
  await cache.put(cacheRequest(normalized), new Response(blob, {
    headers: {
      'Content-Type': blob.type || 'application/octet-stream',
      'Cache-Control': 'public, max-age=31536000, immutable',
      'X-RiftCity-SHA256': normalized
    }
  }));
}

export async function fetchApprovedAssetMetadata(assetId, hash) {
  const normalized = normalizeSha256(hash);
  if (!normalized) throw new Error('Invalid approved asset hash');
  const response = await fetch(`/api/assets/${encodeURIComponent(assetId)}?sha256=${normalized}&meta=1`, {
    credentials: 'same-origin',
    cache: 'no-store'
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok || !payload.ok || !payload.asset) {
    throw new Error(payload.error || 'Approved asset metadata unavailable');
  }
  if (normalizeSha256(payload.asset.sha256) !== normalized) {
    throw new Error('Server asset metadata hash mismatch');
  }
  return payload.asset;
}

export async function fetchVerifiedAssetBlob(assetId, hash) {
  const normalized = normalizeSha256(hash);
  if (!normalized) throw new Error('Invalid approved asset hash');

  const cached = await getCachedVerifiedBlob(normalized);
  if (cached) return cached;

  const response = await fetch(`/api/assets/${encodeURIComponent(assetId)}?sha256=${normalized}`, {
    credentials: 'same-origin',
    cache: 'no-store'
  });
  if (!response.ok) {
    const payload = await response.json().catch(() => ({}));
    throw new Error(payload.error || 'Approved asset unavailable');
  }
  const blob = await response.blob();
  const actual = await sha256Blob(blob);
  if (actual !== normalized) throw new Error('Downloaded asset failed SHA-256 verification');
  await cacheVerifiedBlob(blob, normalized);
  return blob;
}

export async function verifiedAssetObjectUrl(assetId, hash) {
  return URL.createObjectURL(await fetchVerifiedAssetBlob(assetId, hash));
}
