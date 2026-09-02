export const GITHUB_OIDC_ISSUER = 'https://token.actions.githubusercontent.com';
export const GITHUB_OIDC_AUDIENCE = 'ironvale-anticheat';
export const GITHUB_OIDC_REPOSITORY = 'Arctic403/Ironvale';
export const GITHUB_OIDC_REPOSITORY_ID = '1337864874';
export const GITHUB_OIDC_REF = 'refs/heads/main';
export const GITHUB_OIDC_WORKFLOW_REF = 'Arctic403/Ironvale/.github/workflows/ai-anticheat-review.yml@refs/heads/main';

const JWKS_URL = `${GITHUB_OIDC_ISSUER}/.well-known/jwks`;
const JWKS_TTL_MS = 6 * 60 * 60 * 1000;
let jwksCache = null;
let jwksExpiresAt = 0;

function decodeBase64UrlBytes(value) {
  const normalized = String(value || '').replace(/-/g, '+').replace(/_/g, '/');
  const padded = normalized + '='.repeat((4 - normalized.length % 4) % 4);
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return bytes;
}

function decodeBase64UrlJson(value) {
  return JSON.parse(new TextDecoder().decode(decodeBase64UrlBytes(value)));
}

function audienceMatches(value) {
  if (Array.isArray(value)) return value.includes(GITHUB_OIDC_AUDIENCE);
  return String(value || '') === GITHUB_OIDC_AUDIENCE;
}

async function loadJwks(force = false) {
  const now = Date.now();
  if (!force && jwksCache && jwksExpiresAt > now) return jwksCache;
  const response = await fetch(JWKS_URL, { headers: { Accept: 'application/json' } });
  if (!response.ok) throw new Error(`GitHub OIDC JWKS HTTP ${response.status}`);
  const payload = await response.json();
  if (!Array.isArray(payload?.keys) || payload.keys.length === 0) throw new Error('GitHub OIDC JWKS empty');
  jwksCache = payload;
  jwksExpiresAt = now + JWKS_TTL_MS;
  return payload;
}

async function importVerificationKey(jwk) {
  return crypto.subtle.importKey(
    'jwk',
    jwk,
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['verify']
  );
}

async function verifySignature(token, header, headerPart, payloadPart, signaturePart) {
  let jwks = await loadJwks(false);
  let jwk = jwks.keys.find(key => key.kid === header.kid && (!key.alg || key.alg === 'RS256'));
  if (!jwk) {
    jwks = await loadJwks(true);
    jwk = jwks.keys.find(key => key.kid === header.kid && (!key.alg || key.alg === 'RS256'));
  }
  if (!jwk) return false;
  const key = await importVerificationKey(jwk);
  const signed = new TextEncoder().encode(`${headerPart}.${payloadPart}`);
  const signature = decodeBase64UrlBytes(signaturePart);
  return crypto.subtle.verify({ name: 'RSASSA-PKCS1-v1_5' }, key, signature, signed);
}

export async function verifyGitHubAntiCheatOidc(token, now = Date.now()) {
  const raw = String(token || '').trim();
  const parts = raw.split('.');
  if (parts.length !== 3) return { ok: false, reason: 'github-oidc-malformed' };

  let header;
  let claims;
  try {
    header = decodeBase64UrlJson(parts[0]);
    claims = decodeBase64UrlJson(parts[1]);
  } catch {
    return { ok: false, reason: 'github-oidc-decode-failed' };
  }

  if (header?.alg !== 'RS256' || !header?.kid) return { ok: false, reason: 'github-oidc-algorithm-denied' };

  const nowSeconds = Math.floor(Number(now) / 1000);
  if (String(claims?.iss || '') !== GITHUB_OIDC_ISSUER) return { ok: false, reason: 'github-oidc-issuer-denied' };
  if (!audienceMatches(claims?.aud)) return { ok: false, reason: 'github-oidc-audience-denied' };
  if (!Number.isFinite(Number(claims?.exp)) || Number(claims.exp) <= nowSeconds) return { ok: false, reason: 'github-oidc-expired' };
  if (Number.isFinite(Number(claims?.nbf)) && Number(claims.nbf) > nowSeconds + 30) return { ok: false, reason: 'github-oidc-not-yet-valid' };
  if (Number.isFinite(Number(claims?.iat)) && Number(claims.iat) > nowSeconds + 30) return { ok: false, reason: 'github-oidc-issued-in-future' };
  if (String(claims?.repository || '') !== GITHUB_OIDC_REPOSITORY) return { ok: false, reason: 'github-oidc-repository-denied' };
  if (String(claims?.repository_id || '') !== GITHUB_OIDC_REPOSITORY_ID) return { ok: false, reason: 'github-oidc-repository-id-denied' };
  if (String(claims?.ref || '') !== GITHUB_OIDC_REF) return { ok: false, reason: 'github-oidc-ref-denied' };
  if (String(claims?.workflow_ref || '') !== GITHUB_OIDC_WORKFLOW_REF) return { ok: false, reason: 'github-oidc-workflow-denied' };
  if (String(claims?.repository_visibility || '') !== 'private') return { ok: false, reason: 'github-oidc-visibility-denied' };

  let signatureOk = false;
  try {
    signatureOk = await verifySignature(raw, header, parts[0], parts[1], parts[2]);
  } catch (error) {
    return { ok: false, reason: 'github-oidc-verification-error', error: String(error?.message || error).slice(0, 160) };
  }
  if (!signatureOk) return { ok: false, reason: 'github-oidc-signature-invalid' };

  return {
    ok: true,
    kind: 'github-actions-oidc',
    repository: GITHUB_OIDC_REPOSITORY,
    repositoryId: GITHUB_OIDC_REPOSITORY_ID,
    workflowRef: GITHUB_OIDC_WORKFLOW_REF,
    runId: String(claims?.run_id || ''),
    runAttempt: String(claims?.run_attempt || ''),
    actor: String(claims?.actor || ''),
    expiresAt: Number(claims.exp) * 1000
  };
}
