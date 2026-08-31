// RiftCity Native Core v1
// Shared deterministic CPU math for browser + Cloudflare WASM targets.
// Keep this translation unit freestanding: no libc, no exceptions, no RTTI.

extern "C" {

__attribute__((visibility("default"))) int rift_core_version() {
  return 1;
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

}
