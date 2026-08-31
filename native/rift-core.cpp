// RiftCity Native Core v3
// Persistent RiftSection residency, native full-block meshing, batched world
// queries and voxel DDA raycasting shared by browsers and Cloudflare Workers.
// Freestanding by design: no libc, exceptions or RTTI.

static const int RIFT_SECTION_SIZE = 16;
static const int RIFT_SECTION_VOLUME = 4096;
static const int RIFT_SECTION_SLOT_CAPACITY = 128;
static const int RIFT_FACE_COUNT = 6;
static const int RIFT_BORDER_CELLS = 256;
static const int RIFT_MAX_FACES = RIFT_SECTION_VOLUME * RIFT_FACE_COUNT;
static const int RIFT_MAX_VERTICES = RIFT_MAX_FACES * 4;
static const int RIFT_MAX_INDICES = RIFT_MAX_FACES * 6;
static const int RIFT_BATCH_CAPACITY = 1024;

// Slot 0 doubles as the legacy v2 scratch workspace so old callers remain safe.
static unsigned short g_section_slots[RIFT_SECTION_SLOT_CAPACITY][RIFT_SECTION_VOLUME];
static unsigned char g_section_face_masks[RIFT_SECTION_VOLUME];
static unsigned short g_section_borders[RIFT_FACE_COUNT][RIFT_BORDER_CELLS];
static float g_material_colors[256 * 3];

static int g_slot_valid[RIFT_SECTION_SLOT_CAPACITY];
static int g_slot_world_id[RIFT_SECTION_SLOT_CAPACITY];
static int g_slot_sx[RIFT_SECTION_SLOT_CAPACITY];
static int g_slot_sy[RIFT_SECTION_SLOT_CAPACITY];
static int g_slot_sz[RIFT_SECTION_SLOT_CAPACITY];

static float g_mesh_vertices[RIFT_MAX_VERTICES * 9];
static unsigned int g_mesh_indices[RIFT_MAX_INDICES];
static int g_mesh_faces = 0;
static int g_mesh_blocks = 0;
static int g_mesh_vertices_count = 0;
static int g_mesh_indices_count = 0;

static int g_batch_query_xyz[RIFT_BATCH_CAPACITY * 3];
static unsigned short g_batch_query_states[RIFT_BATCH_CAPACITY];

// x, y, z, face, state. Face order matches RiftBlock face definitions.
static int g_raycast_hit[5];
static float g_raycast_distance = 0.0f;

static unsigned int g_metric_mesh_builds = 0u;
static unsigned int g_metric_faces_emitted = 0u;
static unsigned int g_metric_batch_calls = 0u;
static unsigned int g_metric_batch_cells = 0u;
static unsigned int g_metric_raycasts = 0u;
static unsigned int g_metric_raycast_steps = 0u;

static float rift_abs(float value) { return value < 0.0f ? -value : value; }
static float rift_clamp01(float value) {
  if (value < 0.0f) return 0.0f;
  if (value > 1.0f) return 1.0f;
  return value;
}
static int rift_floor_float(float value) {
  int base = (int)value;
  if (value < (float)base) base -= 1;
  return base;
}
static float rift_fraction(float value) { return value - (float)rift_floor_float(value); }
static int rift_floor_div_impl(int value, int divisor) {
  if (divisor <= 0) return 0;
  int quotient = value / divisor;
  int remainder = value % divisor;
  if (remainder != 0 && value < 0) quotient -= 1;
  return quotient;
}
static int rift_positive_mod_impl(int value, int divisor) {
  if (divisor <= 0) return 0;
  int result = value % divisor;
  return result < 0 ? result + divisor : result;
}
static int rift_index(int x, int y, int z) { return (y << 8) | (z << 4) | x; }
static int rift_valid_slot(int slot) { return slot >= 0 && slot < RIFT_SECTION_SLOT_CAPACITY; }

static float rift_stair_top_impl(int rotation, float localX, float localZ) {
  float t = 0.0f;
  switch (rotation & 3) {
    case 0: t = 1.0f - localZ; break;
    case 1: t = localX; break;
    case 2: t = localZ; break;
    case 3: t = 1.0f - localX; break;
  }
  return rift_clamp01(t);
}
static float rift_shape_top_impl(int shape, int rotation, float localX, float localZ) {
  switch (shape) {
    case 1: return 0.5f;
    case 2: return 1.0f;
    case 3: return rift_stair_top_impl(rotation, localX, localZ);
    case 0:
    default: return 1.0f;
  }
}

static int rift_find_slot(int worldId, int sx, int sy, int sz) {
  for (int slot = 0; slot < RIFT_SECTION_SLOT_CAPACITY; slot += 1) {
    if (!g_slot_valid[slot]) continue;
    if (g_slot_world_id[slot] != worldId) continue;
    if (g_slot_sx[slot] == sx && g_slot_sy[slot] == sy && g_slot_sz[slot] == sz) return slot;
  }
  return -1;
}

static unsigned short rift_get_block_world_impl(int worldId, int worldX, int worldY, int worldZ) {
  const int sx = rift_floor_div_impl(worldX, RIFT_SECTION_SIZE);
  const int sy = rift_floor_div_impl(worldY, RIFT_SECTION_SIZE);
  const int sz = rift_floor_div_impl(worldZ, RIFT_SECTION_SIZE);
  const int slot = rift_find_slot(worldId, sx, sy, sz);
  if (slot < 0) return 0u;
  const int x = rift_positive_mod_impl(worldX, RIFT_SECTION_SIZE);
  const int y = rift_positive_mod_impl(worldY, RIFT_SECTION_SIZE);
  const int z = rift_positive_mod_impl(worldZ, RIFT_SECTION_SIZE);
  return g_section_slots[slot][rift_index(x, y, z)];
}

// Border layout by face:
// east/west = y*16+z, top/bottom = z*16+x, south/north = y*16+x.
static unsigned short rift_neighbor_state(int slot, int face, int x, int y, int z) {
  unsigned short* states = g_section_slots[slot];
  switch (face) {
    case 0: return x < 15 ? states[rift_index(x + 1, y, z)] : g_section_borders[0][y * 16 + z];
    case 1: return x > 0  ? states[rift_index(x - 1, y, z)] : g_section_borders[1][y * 16 + z];
    case 2: return y < 15 ? states[rift_index(x, y + 1, z)] : g_section_borders[2][z * 16 + x];
    case 3: return y > 0  ? states[rift_index(x, y - 1, z)] : g_section_borders[3][z * 16 + x];
    case 4: return z < 15 ? states[rift_index(x, y, z + 1)] : g_section_borders[4][y * 16 + x];
    case 5: return z > 0  ? states[rift_index(x, y, z - 1)] : g_section_borders[5][y * 16 + x];
    default: return 0u;
  }
}

static void rift_face_normal(int face, float& nx, float& ny, float& nz) {
  nx = ny = nz = 0.0f;
  if (face == 0) nx = 1.0f;
  else if (face == 1) nx = -1.0f;
  else if (face == 2) ny = 1.0f;
  else if (face == 3) ny = -1.0f;
  else if (face == 4) nz = 1.0f;
  else if (face == 5) nz = -1.0f;
}

static void rift_face_corner(int face, int corner, float& x, float& y, float& z) {
  // Exact winding from RIFT_BLOCK_FACE_DEFS.
  static const unsigned char corners[6][4][3] = {
    {{1,0,0},{1,1,0},{1,1,1},{1,0,1}},
    {{0,0,1},{0,1,1},{0,1,0},{0,0,0}},
    {{0,1,0},{0,1,1},{1,1,1},{1,1,0}},
    {{0,0,1},{0,0,0},{1,0,0},{1,0,1}},
    {{1,0,1},{1,1,1},{0,1,1},{0,0,1}},
    {{0,0,0},{0,1,0},{1,1,0},{1,0,0}}
  };
  x = (float)corners[face][corner][0];
  y = (float)corners[face][corner][1];
  z = (float)corners[face][corner][2];
}

static void rift_emit_face(int face, int worldX, int worldY, int worldZ, unsigned int material) {
  const int baseVertex = g_mesh_vertices_count;
  float nx, ny, nz;
  rift_face_normal(face, nx, ny, nz);
  const float cr = g_material_colors[(material & 255u) * 3 + 0];
  const float cg = g_material_colors[(material & 255u) * 3 + 1];
  const float cb = g_material_colors[(material & 255u) * 3 + 2];

  for (int corner = 0; corner < 4; corner += 1) {
    float cx, cy, cz;
    rift_face_corner(face, corner, cx, cy, cz);
    const int offset = (baseVertex + corner) * 9;
    g_mesh_vertices[offset + 0] = (float)worldX + cx;
    g_mesh_vertices[offset + 1] = (float)worldY + cy;
    g_mesh_vertices[offset + 2] = (float)worldZ + cz;
    g_mesh_vertices[offset + 3] = nx;
    g_mesh_vertices[offset + 4] = ny;
    g_mesh_vertices[offset + 5] = nz;
    g_mesh_vertices[offset + 6] = cr;
    g_mesh_vertices[offset + 7] = cg;
    g_mesh_vertices[offset + 8] = cb;
  }

  const int baseIndex = g_mesh_indices_count;
  g_mesh_indices[baseIndex + 0] = (unsigned int)baseVertex;
  g_mesh_indices[baseIndex + 1] = (unsigned int)(baseVertex + 1);
  g_mesh_indices[baseIndex + 2] = (unsigned int)(baseVertex + 2);
  g_mesh_indices[baseIndex + 3] = (unsigned int)baseVertex;
  g_mesh_indices[baseIndex + 4] = (unsigned int)(baseVertex + 2);
  g_mesh_indices[baseIndex + 5] = (unsigned int)(baseVertex + 3);
  g_mesh_vertices_count += 4;
  g_mesh_indices_count += 6;
  g_mesh_faces += 1;
}

extern "C" {

__attribute__((visibility("default"))) int rift_core_version() { return 3; }
__attribute__((visibility("default"))) int rift_section_index(int x, int y, int z) {
  if (x < 0 || x >= 16 || y < 0 || y >= 16 || z < 0 || z >= 16) return -1;
  return rift_index(x, y, z);
}
__attribute__((visibility("default"))) int rift_floor_div(int value, int divisor) { return rift_floor_div_impl(value, divisor); }
__attribute__((visibility("default"))) int rift_positive_mod(int value, int divisor) { return rift_positive_mod_impl(value, divisor); }

__attribute__((visibility("default"))) int rift_aabb_intersects(
  float aMinX, float aMinY, float aMinZ, float aMaxX, float aMaxY, float aMaxZ,
  float bMinX, float bMinY, float bMinZ, float bMaxX, float bMaxY, float bMaxZ
) {
  return aMinX < bMaxX && aMaxX > bMinX && aMinY < bMaxY && aMaxY > bMinY && aMinZ < bMaxZ && aMaxZ > bMinZ ? 1 : 0;
}
__attribute__((visibility("default"))) float rift_distance_sq3(float ax,float ay,float az,float bx,float by,float bz) {
  const float dx=ax-bx, dy=ay-by, dz=az-bz;
  return dx*dx + dy*dy + dz*dz;
}
__attribute__((visibility("default"))) unsigned int rift_hash3(int x,int y,int z,unsigned int seed) {
  unsigned int h = seed ^ 0x9E3779B9u;
  h ^= (unsigned int)x * 0x85EBCA6Bu; h = (h << 13) | (h >> 19);
  h ^= (unsigned int)y * 0xC2B2AE35u; h = (h << 11) | (h >> 21);
  h ^= (unsigned int)z * 0x27D4EB2Fu;
  h ^= h >> 16; h *= 0x7FEB352Du; h ^= h >> 15; h *= 0x846CA68Bu; h ^= h >> 16;
  return h;
}

__attribute__((visibility("default"))) int rift_crossed_support(float previousY,float candidateY,float supportY,float tolerance,float previousTolerance) {
  if (tolerance < 0.0f) tolerance = 0.0f;
  if (previousTolerance < 0.0f) previousTolerance = 0.0f;
  return candidateY <= supportY + tolerance && previousY >= supportY - previousTolerance ? 1 : 0;
}
__attribute__((visibility("default"))) int rift_ground_step_classify(float currentY,float targetSupportY,float stepUp,float snapDown) {
  if (stepUp < 0.0f) stepUp = 0.0f;
  if (snapDown < 0.0f) snapDown = 0.0f;
  const float delta = targetSupportY - currentY;
  if (delta > stepUp + 0.0001f) return 2;
  if (delta < -snapDown - 0.0001f) return 0;
  return 1;
}
__attribute__((visibility("default"))) float rift_stair_top(int rotation,float localX,float localZ) { return rift_stair_top_impl(rotation, localX, localZ); }
__attribute__((visibility("default"))) float rift_shape_top(int shape,int rotation,float localX,float localZ) { return rift_shape_top_impl(shape, rotation, localX, localZ); }
__attribute__((visibility("default"))) float rift_state_shape_top(unsigned int state,float worldX,float worldZ) {
  if (state == 0u) return 0.0f;
  return rift_shape_top_impl((int)((state >> 8) & 7u), (int)((state >> 11) & 3u), rift_fraction(worldX), rift_fraction(worldZ));
}

// Persistent section residency ------------------------------------------------
__attribute__((visibility("default"))) int rift_section_slot_capacity() { return RIFT_SECTION_SLOT_CAPACITY; }
__attribute__((visibility("default"))) unsigned int rift_section_slot_states_ptr(int slot) {
  if (!rift_valid_slot(slot)) return 0u;
  return (unsigned int)(unsigned long)&g_section_slots[slot][0];
}
__attribute__((visibility("default"))) int rift_section_slot_bind(int slot,int worldId,int sx,int sy,int sz) {
  if (!rift_valid_slot(slot)) return 0;
  g_slot_valid[slot] = 1; g_slot_world_id[slot] = worldId; g_slot_sx[slot] = sx; g_slot_sy[slot] = sy; g_slot_sz[slot] = sz;
  return 1;
}
__attribute__((visibility("default"))) void rift_section_slot_invalidate(int slot) { if (rift_valid_slot(slot)) g_slot_valid[slot] = 0; }
__attribute__((visibility("default"))) unsigned int rift_section_slot_get_state(int slot,int index) {
  if (!rift_valid_slot(slot) || !g_slot_valid[slot] || index < 0 || index >= RIFT_SECTION_VOLUME) return 0u;
  return (unsigned int)g_section_slots[slot][index];
}
__attribute__((visibility("default"))) unsigned int rift_get_block_world(int worldId,int worldX,int worldY,int worldZ) {
  return (unsigned int)rift_get_block_world_impl(worldId, worldX, worldY, worldZ);
}

// Legacy v2 scratch API -------------------------------------------------------
__attribute__((visibility("default"))) unsigned int rift_section_states_ptr() { return rift_section_slot_states_ptr(0); }
__attribute__((visibility("default"))) unsigned int rift_section_face_masks_ptr() { return (unsigned int)(unsigned long)&g_section_face_masks[0]; }
__attribute__((visibility("default"))) unsigned int rift_build_section_face_masks() {
  unsigned int blocks = 0u; int containsPartial = 0;
  for (int index=0; index<RIFT_SECTION_VOLUME; index+=1) {
    g_section_face_masks[index] = 0u;
    const unsigned short state = g_section_slots[0][index];
    if (!state) continue;
    blocks += 1u; if ((state & 0x0700u) != 0u) containsPartial = 1;
  }
  if (containsPartial) return 0x80000000u | (blocks << 16);
  unsigned int faces = 0u;
  for (int y=0;y<16;y+=1) for (int z=0;z<16;z+=1) for (int x=0;x<16;x+=1) {
    const int index=rift_index(x,y,z); if (!g_section_slots[0][index]) continue;
    unsigned char mask=0u;
    if (x==15 || !g_section_slots[0][index+1]) { mask|=1u<<0; faces+=1u; }
    if (x==0  || !g_section_slots[0][index-1]) { mask|=1u<<1; faces+=1u; }
    if (y==15 || !g_section_slots[0][index+256]) { mask|=1u<<2; faces+=1u; }
    if (y==0  || !g_section_slots[0][index-256]) { mask|=1u<<3; faces+=1u; }
    if (z==15 || !g_section_slots[0][index+16]) { mask|=1u<<4; faces+=1u; }
    if (z==0  || !g_section_slots[0][index-16]) { mask|=1u<<5; faces+=1u; }
    g_section_face_masks[index]=mask;
  }
  return (blocks << 16) | (faces & 0xffffu);
}

// Native full-block mesh builder ---------------------------------------------
__attribute__((visibility("default"))) unsigned int rift_section_borders_ptr() { return (unsigned int)(unsigned long)&g_section_borders[0][0]; }
__attribute__((visibility("default"))) unsigned int rift_material_colors_ptr() { return (unsigned int)(unsigned long)&g_material_colors[0]; }
__attribute__((visibility("default"))) unsigned int rift_mesh_vertices_ptr() { return (unsigned int)(unsigned long)&g_mesh_vertices[0]; }
__attribute__((visibility("default"))) unsigned int rift_mesh_indices_ptr() { return (unsigned int)(unsigned long)&g_mesh_indices[0]; }
__attribute__((visibility("default"))) int rift_mesh_face_count() { return g_mesh_faces; }
__attribute__((visibility("default"))) int rift_mesh_block_count() { return g_mesh_blocks; }
__attribute__((visibility("default"))) int rift_mesh_vertex_count() { return g_mesh_vertices_count; }
__attribute__((visibility("default"))) int rift_mesh_index_count() { return g_mesh_indices_count; }

// Returns visible face count, -1 for partial-shape section, -2 invalid slot.
__attribute__((visibility("default"))) int rift_build_section_mesh(int slot) {
  g_mesh_faces = g_mesh_blocks = g_mesh_vertices_count = g_mesh_indices_count = 0;
  if (!rift_valid_slot(slot) || !g_slot_valid[slot]) return -2;
  unsigned short* states = g_section_slots[slot];
  for (int index=0; index<RIFT_SECTION_VOLUME; index+=1) {
    g_section_face_masks[index]=0u;
    const unsigned short state=states[index];
    if (!state) continue;
    g_mesh_blocks += 1;
    if ((state & 0x0700u) != 0u) return -1;
  }
  const int originX=g_slot_sx[slot]*16, originY=g_slot_sy[slot]*16, originZ=g_slot_sz[slot]*16;
  for (int y=0;y<16;y+=1) for (int z=0;z<16;z+=1) for (int x=0;x<16;x+=1) {
    const int index=rift_index(x,y,z); const unsigned short state=states[index]; if (!state) continue;
    unsigned char mask=0u;
    for (int face=0;face<6;face+=1) {
      if (rift_neighbor_state(slot,face,x,y,z) != 0u) continue;
      mask |= (unsigned char)(1u << face);
      rift_emit_face(face, originX+x, originY+y, originZ+z, (unsigned int)(state & 0x00ffu));
    }
    g_section_face_masks[index]=mask;
  }
  g_metric_mesh_builds += 1u;
  g_metric_faces_emitted += (unsigned int)g_mesh_faces;
  return g_mesh_faces;
}

// Batched resident-world queries ---------------------------------------------
__attribute__((visibility("default"))) int rift_batch_capacity() { return RIFT_BATCH_CAPACITY; }
__attribute__((visibility("default"))) unsigned int rift_batch_query_xyz_ptr() { return (unsigned int)(unsigned long)&g_batch_query_xyz[0]; }
__attribute__((visibility("default"))) unsigned int rift_batch_query_states_ptr() { return (unsigned int)(unsigned long)&g_batch_query_states[0]; }
__attribute__((visibility("default"))) int rift_batch_query_world(int worldId,int count) {
  if (count < 0) count = 0; if (count > RIFT_BATCH_CAPACITY) count = RIFT_BATCH_CAPACITY;
  for (int i=0;i<count;i+=1) {
    g_batch_query_states[i]=rift_get_block_world_impl(worldId,g_batch_query_xyz[i*3],g_batch_query_xyz[i*3+1],g_batch_query_xyz[i*3+2]);
  }
  g_metric_batch_calls += 1u; g_metric_batch_cells += (unsigned int)count;
  return count;
}

// Resident-world voxel DDA raycast -------------------------------------------
__attribute__((visibility("default"))) unsigned int rift_raycast_hit_ptr() { return (unsigned int)(unsigned long)&g_raycast_hit[0]; }
__attribute__((visibility("default"))) float rift_raycast_distance() { return g_raycast_distance; }
__attribute__((visibility("default"))) int rift_raycast_world(int worldId,float ox,float oy,float oz,float dx,float dy,float dz,float maxDistance) {
  g_metric_raycasts += 1u; g_raycast_distance=0.0f;
  for (int i=0;i<5;i+=1) g_raycast_hit[i]=0;
  if (maxDistance < 0.0f) return 0;
  int x=rift_floor_float(ox), y=rift_floor_float(oy), z=rift_floor_float(oz);
  unsigned short initial=rift_get_block_world_impl(worldId,x,y,z);
  if (initial) { g_raycast_hit[0]=x;g_raycast_hit[1]=y;g_raycast_hit[2]=z;g_raycast_hit[3]=-1;g_raycast_hit[4]=(int)initial; return 1; }

  const int stepX=dx>0.0f?1:(dx<0.0f?-1:0), stepY=dy>0.0f?1:(dy<0.0f?-1:0), stepZ=dz>0.0f?1:(dz<0.0f?-1:0);
  const float huge=1.0e30f;
  float tDeltaX=stepX?rift_abs(1.0f/dx):huge, tDeltaY=stepY?rift_abs(1.0f/dy):huge, tDeltaZ=stepZ?rift_abs(1.0f/dz):huge;
  float tMaxX=stepX>0?((float)(x+1)-ox)/dx:(stepX<0?(ox-(float)x)/(-dx):huge);
  float tMaxY=stepY>0?((float)(y+1)-oy)/dy:(stepY<0?(oy-(float)y)/(-dy):huge);
  float tMaxZ=stepZ>0?((float)(z+1)-oz)/dz:(stepZ<0?(oz-(float)z)/(-dz):huge);
  int face=-1;
  for (int step=0; step<4096; step+=1) {
    float distance;
    if (tMaxX <= tMaxY && tMaxX <= tMaxZ) { distance=tMaxX; tMaxX+=tDeltaX; x+=stepX; face=stepX>0?1:0; }
    else if (tMaxY <= tMaxZ) { distance=tMaxY; tMaxY+=tDeltaY; y+=stepY; face=stepY>0?3:2; }
    else { distance=tMaxZ; tMaxZ+=tDeltaZ; z+=stepZ; face=stepZ>0?5:4; }
    g_metric_raycast_steps += 1u;
    if (distance > maxDistance) return 0;
    const unsigned short state=rift_get_block_world_impl(worldId,x,y,z);
    if (!state) continue;
    g_raycast_hit[0]=x;g_raycast_hit[1]=y;g_raycast_hit[2]=z;g_raycast_hit[3]=face;g_raycast_hit[4]=(int)state;g_raycast_distance=distance;
    return 1;
  }
  return 0;
}

// Native counters -------------------------------------------------------------
__attribute__((visibility("default"))) unsigned int rift_metric_mesh_builds() { return g_metric_mesh_builds; }
__attribute__((visibility("default"))) unsigned int rift_metric_faces_emitted() { return g_metric_faces_emitted; }
__attribute__((visibility("default"))) unsigned int rift_metric_batch_calls() { return g_metric_batch_calls; }
__attribute__((visibility("default"))) unsigned int rift_metric_batch_cells() { return g_metric_batch_cells; }
__attribute__((visibility("default"))) unsigned int rift_metric_raycasts() { return g_metric_raycasts; }
__attribute__((visibility("default"))) unsigned int rift_metric_raycast_steps() { return g_metric_raycast_steps; }
__attribute__((visibility("default"))) void rift_metric_reset() {
  g_metric_mesh_builds=g_metric_faces_emitted=g_metric_batch_calls=g_metric_batch_cells=g_metric_raycasts=g_metric_raycast_steps=0u;
}

}
