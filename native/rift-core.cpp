// Rift Native Core v4
// Persistent RiftSection residency, shape-aware native meshing, whole-step player
// physics, mutations, pathfinding, spatial/agent kernels and combat math shared by
// browsers and Cloudflare Workers.
// Freestanding by design: no libc, exceptions or RTTI.

static const int RIFT_SECTION_SIZE = 16;
static const int RIFT_SECTION_VOLUME = 4096;
static const int RIFT_SECTION_SLOT_CAPACITY = 128;
static const int RIFT_FACE_COUNT = 6;
static const int RIFT_BORDER_CELLS = 256;
// A stair can emit up to ten merged half-meter quads. Reserve enough workspace
// for a worst-case section without allocating from a libc heap.
static const int RIFT_MAX_FACES = RIFT_SECTION_VOLUME * 10;
static const int RIFT_MAX_VERTICES = RIFT_MAX_FACES * 4;
static const int RIFT_MAX_INDICES = RIFT_MAX_FACES * 6;
static const int RIFT_BATCH_CAPACITY = 1024;
static const int RIFT_SPATIAL_CAPACITY = 512;
static const int RIFT_AGENT_CAPACITY = 256;
static const int RIFT_PATH_GRID = 64;
static const int RIFT_PATH_NODE_CAPACITY = RIFT_PATH_GRID * RIFT_PATH_GRID;
static const int RIFT_PATH_POINT_CAPACITY = 512;

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
static int g_mesh_partial_blocks = 0;
static int g_mesh_occupied_microvoxels = 0;
static int g_mesh_visible_microfaces = 0;
static int g_mesh_culled_microfaces = 0;

static int g_batch_query_xyz[RIFT_BATCH_CAPACITY * 3];
static unsigned short g_batch_query_states[RIFT_BATCH_CAPACITY];

// x, y, z, face, state. Face order matches RiftBlock face definitions.
static int g_raycast_hit[5];
static float g_raycast_distance = 0.0f;

// Native player-step output: x, y, z, vertical velocity, step-assist height.
static float g_player_result[5];
// grounded, collided, stepped, recovery-required.
static int g_player_flags[4];

// Generic entity spatial workspace: xyz + radius, then id + category mask.
static float g_spatial_entities[RIFT_SPATIAL_CAPACITY * 4];
static int g_spatial_meta[RIFT_SPATIAL_CAPACITY * 2];
static int g_spatial_results[RIFT_SPATIAL_CAPACITY];

// Agent workspace: x,y,z,targetX,targetY,targetZ,speed,radius.
static float g_agents[RIFT_AGENT_CAPACITY * 8];

// Bounded A* workspace and output path triples.
static int g_path_state[RIFT_PATH_NODE_CAPACITY];
static int g_path_parent[RIFT_PATH_NODE_CAPACITY];
static int g_path_g[RIFT_PATH_NODE_CAPACITY];
static int g_path_f[RIFT_PATH_NODE_CAPACITY];
static float g_path_y[RIFT_PATH_NODE_CAPACITY];
static int g_path_points[RIFT_PATH_POINT_CAPACITY * 3];

// hit, damage, critical, hit-roll, damage-roll, resulting seed.
static int g_combat_result[6];

static unsigned int g_metric_mesh_builds = 0u;
static unsigned int g_metric_faces_emitted = 0u;
static unsigned int g_metric_batch_calls = 0u;
static unsigned int g_metric_batch_cells = 0u;
static unsigned int g_metric_raycasts = 0u;
static unsigned int g_metric_raycast_steps = 0u;
static unsigned int g_metric_player_steps = 0u;
static unsigned int g_metric_collision_probes = 0u;
static unsigned int g_metric_mutations = 0u;
static unsigned int g_metric_pathfinds = 0u;
static unsigned int g_metric_path_nodes = 0u;
static unsigned int g_metric_spatial_queries = 0u;
static unsigned int g_metric_agent_steps = 0u;
static unsigned int g_metric_combat_resolves = 0u;

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
static float rift_minf(float a,float b) { return a < b ? a : b; }
static float rift_maxf(float a,float b) { return a > b ? a : b; }
static float rift_clampf(float value,float low,float high) { return value < low ? low : (value > high ? high : value); }
static float rift_sqrt(float value) {
  if (value <= 0.0f) return 0.0f;
  float x = value > 1.0f ? value : 1.0f;
  for (int i=0;i<8;i+=1) x = 0.5f * (x + value / x);
  return x;
}
static int rift_shape_id(unsigned short state) { return (int)((state >> 8) & 7u); }
static int rift_rotation_id(unsigned short state) { return (int)((state >> 11) & 3u); }
static unsigned char rift_shape_mask_impl(unsigned short state) {
  if (!state) return 0u;
  const int shape=rift_shape_id(state), rotation=rift_rotation_id(state);
  if (shape==1) return 0x0fu;
  if (shape==2) return 0xf0u;
  if (shape==3) {
    static const unsigned char stairs[4]={0x3fu,0xafu,0xcfu,0x5fu};
    return stairs[rotation & 3];
  }
  return shape==0 ? 0xffu : 0u;
}
static int rift_micro_index(int mx,int my,int mz) { return (my<<2)|(mz<<1)|mx; }
static int rift_micro_occupied(unsigned char mask,int mx,int my,int mz) {
  if (mx<0||mx>1||my<0||my>1||mz<0||mz>1) return 0;
  return (mask & (1u << rift_micro_index(mx,my,mz))) != 0u;
}

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


// Shape-aware quad emission ---------------------------------------------------
static void rift_emit_axis_rect(int face,int cellX,int cellY,int cellZ,int plane,int u0,int v0,int u1,int v1,unsigned int material) {
  if (g_mesh_faces >= RIFT_MAX_FACES) return;
  const float p=(float)plane*0.5f, a=(float)u0*0.5f, b=(float)v0*0.5f, c=(float)u1*0.5f, d=(float)v1*0.5f;
  float corners[4][3];
  if (face==0) {
    const float x=(float)cellX+p;
    float q[4][3]={{x,(float)cellY+b,(float)cellZ+a},{x,(float)cellY+d,(float)cellZ+a},{x,(float)cellY+d,(float)cellZ+c},{x,(float)cellY+b,(float)cellZ+c}};
    for(int i=0;i<4;i+=1)for(int j=0;j<3;j+=1)corners[i][j]=q[i][j];
  } else if (face==1) {
    const float x=(float)cellX+p;
    float q[4][3]={{x,(float)cellY+b,(float)cellZ+c},{x,(float)cellY+d,(float)cellZ+c},{x,(float)cellY+d,(float)cellZ+a},{x,(float)cellY+b,(float)cellZ+a}};
    for(int i=0;i<4;i+=1)for(int j=0;j<3;j+=1)corners[i][j]=q[i][j];
  } else if (face==2) {
    const float y=(float)cellY+p;
    float q[4][3]={{(float)cellX+a,y,(float)cellZ+b},{(float)cellX+a,y,(float)cellZ+d},{(float)cellX+c,y,(float)cellZ+d},{(float)cellX+c,y,(float)cellZ+b}};
    for(int i=0;i<4;i+=1)for(int j=0;j<3;j+=1)corners[i][j]=q[i][j];
  } else if (face==3) {
    const float y=(float)cellY+p;
    float q[4][3]={{(float)cellX+a,y,(float)cellZ+d},{(float)cellX+a,y,(float)cellZ+b},{(float)cellX+c,y,(float)cellZ+b},{(float)cellX+c,y,(float)cellZ+d}};
    for(int i=0;i<4;i+=1)for(int j=0;j<3;j+=1)corners[i][j]=q[i][j];
  } else if (face==4) {
    const float z=(float)cellZ+p;
    float q[4][3]={{(float)cellX+c,(float)cellY+b,z},{(float)cellX+c,(float)cellY+d,z},{(float)cellX+a,(float)cellY+d,z},{(float)cellX+a,(float)cellY+b,z}};
    for(int i=0;i<4;i+=1)for(int j=0;j<3;j+=1)corners[i][j]=q[i][j];
  } else {
    const float z=(float)cellZ+p;
    float q[4][3]={{(float)cellX+a,(float)cellY+b,z},{(float)cellX+a,(float)cellY+d,z},{(float)cellX+c,(float)cellY+d,z},{(float)cellX+c,(float)cellY+b,z}};
    for(int i=0;i<4;i+=1)for(int j=0;j<3;j+=1)corners[i][j]=q[i][j];
  }
  float nx,ny,nz; rift_face_normal(face,nx,ny,nz);
  const float cr=g_material_colors[(material&255u)*3], cg=g_material_colors[(material&255u)*3+1], cb=g_material_colors[(material&255u)*3+2];
  const int baseVertex=g_mesh_vertices_count;
  for(int corner=0;corner<4;corner+=1){
    const int offset=(baseVertex+corner)*9;
    g_mesh_vertices[offset]=corners[corner][0];g_mesh_vertices[offset+1]=corners[corner][1];g_mesh_vertices[offset+2]=corners[corner][2];
    g_mesh_vertices[offset+3]=nx;g_mesh_vertices[offset+4]=ny;g_mesh_vertices[offset+5]=nz;
    g_mesh_vertices[offset+6]=cr;g_mesh_vertices[offset+7]=cg;g_mesh_vertices[offset+8]=cb;
  }
  const int baseIndex=g_mesh_indices_count;
  g_mesh_indices[baseIndex]=(unsigned int)baseVertex;g_mesh_indices[baseIndex+1]=(unsigned int)(baseVertex+1);g_mesh_indices[baseIndex+2]=(unsigned int)(baseVertex+2);
  g_mesh_indices[baseIndex+3]=(unsigned int)baseVertex;g_mesh_indices[baseIndex+4]=(unsigned int)(baseVertex+2);g_mesh_indices[baseIndex+5]=(unsigned int)(baseVertex+3);
  g_mesh_vertices_count+=4;g_mesh_indices_count+=6;g_mesh_faces+=1;
}

static int rift_point_solid_world_impl(int worldId,float px,float py,float pz) {
  g_metric_collision_probes+=1u;
  const int cx=rift_floor_float(px),cy=rift_floor_float(py),cz=rift_floor_float(pz);
  const unsigned short state=rift_get_block_world_impl(worldId,cx,cy,cz); if(!state)return 0;
  const float localY=py-(float)cy; if(localY<0.0f||localY>=1.0f)return 0;
  const int shape=rift_shape_id(state);
  if(shape==1)return localY<0.5f;
  if(shape==2)return localY>=0.5f&&localY<1.0f;
  if(shape==3)return localY<rift_stair_top_impl(rift_rotation_id(state),rift_fraction(px),rift_fraction(pz))-0.001f;
  return 1;
}

static float rift_support_at_point_impl(int worldId,float x,float z,float aroundY,float maxRise,float maxDrop) {
  const float upper=aroundY+rift_maxf(0.0f,maxRise),lower=aroundY-rift_maxf(0.0f,maxDrop);
  const int top=rift_floor_float(upper),bottom=rift_floor_float(lower)-1;
  for(int cy=top;cy>=bottom;cy-=1){
    const unsigned short state=rift_get_block_world_impl(worldId,rift_floor_float(x),cy,rift_floor_float(z)); if(!state)continue;
    const float topY=(float)cy+rift_shape_top_impl(rift_shape_id(state),rift_rotation_id(state),rift_fraction(x),rift_fraction(z));
    if(topY<=upper+0.001f&&topY>=lower-0.001f)return topY;
  }
  return -1.0e20f;
}

static void rift_body_offset(int index,float radius,float& dx,float& dz){
  static const int sx[9]={-1,1,-1,1,0,-1,1,0,0};
  static const int sz[9]={-1,-1,1,1,0,0,0,-1,1};
  dx=(float)sx[index]*radius;dz=(float)sz[index]*radius;
}
static void rift_ring_probe(int index,float radius,float& dx,float& dz){
  if(index<=0){dx=0.0f;dz=0.0f;return;}
  static const float dirs[8][2]={{1,0},{0.70710678f,0.70710678f},{0,1},{-0.70710678f,0.70710678f},{-1,0},{-0.70710678f,-0.70710678f},{0,-1},{0.70710678f,-0.70710678f}};
  const int ring=(index-1)/8,dir=(index-1)&7;static const float scales[3]={0.44f,0.74f,0.96f};
  dx=dirs[dir][0]*radius*scales[ring];dz=dirs[dir][1]*radius*scales[ring];
}

static int rift_body_blocked_impl(int worldId,float x,float floorY,float z,float radius,float height){
  int stairRotation=-1; const int supportCell=rift_floor_float(floorY-0.012f);
  const unsigned short centerState=rift_get_block_world_impl(worldId,rift_floor_float(x),supportCell,rift_floor_float(z));
  if(centerState&&rift_shape_id(centerState)==3){
    const float sy=(float)supportCell+rift_stair_top_impl(rift_rotation_id(centerState),rift_fraction(x),rift_fraction(z));
    if(rift_abs(sy-floorY)<=0.07f)stairRotation=rift_rotation_id(centerState);
  }
  const float stairClear=rift_maxf(0.32f,radius+0.04f);
  const float heights[6]={0.012f,0.18f,0.46f,0.82f,1.24f,height-0.012f};
  for(int p=0;p<9;p+=1){float dx,dz;rift_body_offset(p,radius,dx,dz);const float px=x+dx,pz=z+dz;
    for(int hi=0;hi<6;hi+=1){const float h=heights[hi],py=floorY+h;if(!rift_point_solid_world_impl(worldId,px,py,pz))continue;
      const int cy=rift_floor_float(py);const unsigned short state=rift_get_block_world_impl(worldId,rift_floor_float(px),cy,rift_floor_float(pz));if(!state)continue;
      const int shape=rift_shape_id(state);const float obstacleTop=(float)cy+rift_shape_top_impl(shape,rift_rotation_id(state),rift_fraction(px),rift_fraction(pz));
      if(stairRotation>=0){float uphill=0.0f;if(stairRotation==0)uphill=rift_maxf(0.0f,z-pz);else if(stairRotation==1)uphill=rift_maxf(0.0f,px-x);else if(stairRotation==2)uphill=rift_maxf(0.0f,pz-z);else uphill=rift_maxf(0.0f,x-px);
        const float allowed=rift_minf(stairClear,uphill+0.045f);if(allowed>0.0f&&h<=allowed+0.012f&&obstacleTop<=floorY+allowed+0.01f)continue;}
      if(shape==3&&h<=0.24f&&obstacleTop<=floorY+stairClear)continue;
      return 1;
    }
  }
  return 0;
}

static int rift_support_at_height_impl(int worldId,float x,float z,float supportY,float radius,float tolerance){
  for(int p=0;p<9;p+=1){float dx,dz;rift_body_offset(p,radius,dx,dz);const float sampled=rift_support_at_point_impl(worldId,x+dx,z+dz,supportY+0.04f,0.08f,0.14f);if(sampled>-1.0e19f&&rift_abs(sampled-supportY)<=tolerance)return 1;}
  return 0;
}
static int rift_flat_support_contacts_impl(int worldId,float x,float z,float supportY,float radius,float tolerance){
  int count=0;for(int p=0;p<25;p+=1){float dx,dz;rift_ring_probe(p,radius,dx,dz);const float sampled=rift_support_at_point_impl(worldId,x+dx,z+dz,supportY+0.025f,0.055f,0.08f);if(sampled<=-1.0e19f||rift_abs(sampled-supportY)>tolerance)continue;const int cy=rift_floor_float(sampled-0.012f);const unsigned short s=rift_get_block_world_impl(worldId,rift_floor_float(x+dx),cy,rift_floor_float(z+dz));if(s&&rift_shape_id(s)!=3)count+=1;}return count;
}
static int rift_stair_support_near_impl(int worldId,float x,float z,float supportY,float radius,float tolerance){
  const int cy=rift_floor_float(supportY-0.012f);for(int p=0;p<25;p+=1){float dx,dz;rift_ring_probe(p,radius,dx,dz);const float px=x+dx,pz=z+dz;const unsigned short s=rift_get_block_world_impl(worldId,rift_floor_float(px),cy,rift_floor_float(pz));if(!s||rift_shape_id(s)!=3)continue;const float top=(float)cy+rift_stair_top_impl(rift_rotation_id(s),rift_fraction(px),rift_fraction(pz));if(rift_abs(top-supportY)<=tolerance)return 1;}return 0;
}

static float rift_find_step_up_impl(int worldId,float currentX,float currentY,float currentZ,float targetX,float targetZ,float radius,float height,float stepUp){
  const float mx=targetX-currentX,mz=targetZ-currentZ,len=rift_sqrt(mx*mx+mz*mz);const float dirX=len>1e-7f?mx/len:0.0f,dirZ=len>1e-7f?mz/len:0.0f;
  float best=-1.0e20f;for(int p=0;p<9;p+=1){float dx,dz;rift_body_offset(p,radius,dx,dz);if(len>1e-7f&&dx*dirX+dz*dirZ<-0.001f)continue;const float sampled=rift_support_at_point_impl(worldId,targetX+dx,targetZ+dz,currentY,stepUp+0.02f,0.04f);if(sampled<=currentY+0.012f||sampled>currentY+stepUp+0.02f)continue;if(sampled>best)best=sampled;}
  if(best<=-1.0e19f)return best;if(!rift_support_at_height_impl(worldId,targetX,targetZ,best,radius,0.065f))return -1.0e20f;if(rift_body_blocked_impl(worldId,targetX,best,targetZ,radius,height))return -1.0e20f;return best;
}

static int rift_depenetrate_horizontal_impl(int worldId,float& x,float floorY,float& z,float preferX,float preferZ,float radius,float height,float maxResolve){
  if(!rift_body_blocked_impl(worldId,x,floorY,z,radius,height))return 1;const float len=rift_sqrt(preferX*preferX+preferZ*preferZ),dirX=len>1e-7f?preferX/len:0.0f,dirZ=len>1e-7f?preferZ/len:0.0f;
  static const float dirs[8][2]={{1,0},{0.70710678f,0.70710678f},{0,1},{-0.70710678f,0.70710678f},{-1,0},{-0.70710678f,-0.70710678f},{0,-1},{0.70710678f,-0.70710678f}};
  for(float r=0.005f;r<=maxResolve+0.0001f;r+=0.005f){if(len>1e-7f){float tx=x+dirX*r,tz=z+dirZ*r;if(!rift_body_blocked_impl(worldId,tx,floorY,tz,radius,height)){x=tx;z=tz;return 1;}}
    for(int i=0;i<8;i+=1){float tx=x+dirs[i][0]*r,tz=z+dirs[i][1]*r;if(!rift_body_blocked_impl(worldId,tx,floorY,tz,radius,height)){x=tx;z=tz;return 1;}}}
  return 0;
}

static float rift_sweep_vertical_impl(int worldId,float x,float previousY,float candidateY,float z,float radius,float height){
  if(!rift_body_blocked_impl(worldId,x,candidateY,z,radius,height))return candidateY;if(rift_body_blocked_impl(worldId,x,previousY,z,radius,height))return previousY;float safe=previousY,blocked=candidateY;for(int i=0;i<14;i+=1){const float mid=(safe+blocked)*0.5f;if(rift_body_blocked_impl(worldId,x,mid,z,radius,height))blocked=mid;else safe=mid;}return safe;
}

static float rift_landing_height_impl(int worldId,float x,float z,float previousY,float candidateY,float radius){
  float groupY[16];int groupCount[16];int groupCenter[16];int groups=0;
  for(int p=0;p<25;p+=1){float dx,dz;rift_ring_probe(p,radius,dx,dz);const float px=x+dx,pz=z+dz;const float maxDrop=rift_maxf(0.3f,previousY-candidateY+0.2f);const float support=rift_support_at_point_impl(worldId,px,pz,previousY,0.02f,maxDrop);if(support<=-1.0e19f)continue;if(!(candidateY<=support+0.035f&&previousY>=support-0.015f))continue;const int cy=rift_floor_float(support-0.012f);const unsigned short state=rift_get_block_world_impl(worldId,rift_floor_float(px),cy,rift_floor_float(pz));if(p!=0&&state&&rift_shape_id(state)==3)continue;int gi=-1;for(int g=0;g<groups;g+=1)if(rift_abs(groupY[g]-support)<=0.028f){gi=g;break;}if(gi<0&&groups<16){gi=groups++;groupY[gi]=support;groupCount[gi]=0;groupCenter[gi]=0;}if(gi>=0){groupCount[gi]+=1;if(p==0)groupCenter[gi]=1;}}
  float best=-1.0e20f;for(int g=0;g<groups;g+=1)if((groupCenter[g]||groupCount[g]>=4)&&groupY[g]>best)best=groupY[g];return best;
}

static int rift_try_ground_move_impl(int worldId,float& x,float& y,float& z,float targetX,float targetZ,float radius,float height,float stepUp,float snapDown,float& stepAssist,int& grounded,int& stepped){
  const float currentX=x,currentY=y,currentZ=z;const float support=rift_support_at_point_impl(worldId,targetX,targetZ,currentY,stepUp+0.02f,4.0f);
  if(stepAssist>-1.0e19f&&rift_abs(currentY-stepAssist)<=0.08f){if(support>-1.0e19f&&rift_abs(support-stepAssist)<=0.08f)stepAssist=-1.0e20f;else if(rift_support_at_height_impl(worldId,targetX,targetZ,stepAssist,radius,0.065f)&&!rift_body_blocked_impl(worldId,targetX,stepAssist,targetZ,radius,height)){x=targetX;y=stepAssist;z=targetZ;grounded=1;return 1;}else stepAssist=-1.0e20f;}
  const float delta=support<=-1.0e19f?-1.0e20f:support-currentY;
  if(delta<=-0.08f&&rift_flat_support_contacts_impl(worldId,targetX,targetZ,currentY,radius,0.045f)>=4&&!rift_body_blocked_impl(worldId,targetX,currentY,targetZ,radius,height)){x=targetX;z=targetZ;grounded=1;stepAssist=-1.0e20f;return 1;}
  if(delta<=-0.08f&&rift_stair_support_near_impl(worldId,targetX,targetZ,currentY,radius,0.085f)&&!rift_body_blocked_impl(worldId,targetX,currentY,targetZ,radius,height)){x=targetX;z=targetZ;grounded=1;stepAssist=-1.0e20f;return 1;}
  const int classification=support<=-1.0e19f?0:(delta>stepUp+0.0001f?2:(delta<-snapDown-0.0001f?0:1));
  if(classification==1){if(rift_body_blocked_impl(worldId,targetX,support,targetZ,radius,height)){const float stepY=rift_find_step_up_impl(worldId,currentX,currentY,currentZ,targetX,targetZ,radius,height,stepUp);if(stepY>-1.0e19f){x=targetX;y=stepY;z=targetZ;grounded=1;stepAssist=stepY;stepped=1;return 1;}if(support<currentY-0.001f&&!rift_body_blocked_impl(worldId,targetX,currentY,targetZ,radius,height)){x=targetX;z=targetZ;grounded=0;stepAssist=-1.0e20f;return 1;}return 0;}x=targetX;y=support;z=targetZ;grounded=1;if(stepAssist>-1.0e19f&&rift_abs(support-stepAssist)<=0.08f)stepAssist=-1.0e20f;return 1;}
  if(classification==0){if(rift_body_blocked_impl(worldId,targetX,currentY,targetZ,radius,height)){const float stepY=rift_find_step_up_impl(worldId,currentX,currentY,currentZ,targetX,targetZ,radius,height,stepUp);if(stepY>-1.0e19f){x=targetX;y=stepY;z=targetZ;grounded=1;stepAssist=stepY;stepped=1;return 1;}return 0;}x=targetX;z=targetZ;grounded=0;stepAssist=-1.0e20f;return 1;}
  return 0;
}

static int rift_try_air_move_impl(int worldId,float& x,float& y,float& z,float targetX,float targetZ,float radius,float height,int& grounded,float& stepAssist){
  stepAssist=-1.0e20f;if(rift_body_blocked_impl(worldId,targetX,y,targetZ,radius,height))return 0;x=targetX;z=targetZ;grounded=0;return 1;
}

extern "C" {

__attribute__((visibility("default"))) int rift_core_version() { return 4; }
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

// Native shape-aware section mesh builder ------------------------------------
__attribute__((visibility("default"))) unsigned int rift_section_borders_ptr() { return (unsigned int)(unsigned long)&g_section_borders[0][0]; }
__attribute__((visibility("default"))) unsigned int rift_material_colors_ptr() { return (unsigned int)(unsigned long)&g_material_colors[0]; }
__attribute__((visibility("default"))) unsigned int rift_mesh_vertices_ptr() { return (unsigned int)(unsigned long)&g_mesh_vertices[0]; }
__attribute__((visibility("default"))) unsigned int rift_mesh_indices_ptr() { return (unsigned int)(unsigned long)&g_mesh_indices[0]; }
__attribute__((visibility("default"))) int rift_mesh_face_count() { return g_mesh_faces; }
__attribute__((visibility("default"))) int rift_mesh_block_count() { return g_mesh_blocks; }
__attribute__((visibility("default"))) int rift_mesh_vertex_count() { return g_mesh_vertices_count; }
__attribute__((visibility("default"))) int rift_mesh_index_count() { return g_mesh_indices_count; }
__attribute__((visibility("default"))) int rift_mesh_partial_block_count() { return g_mesh_partial_blocks; }
__attribute__((visibility("default"))) int rift_mesh_occupied_microvoxels() { return g_mesh_occupied_microvoxels; }
__attribute__((visibility("default"))) int rift_mesh_visible_microfaces() { return g_mesh_visible_microfaces; }
__attribute__((visibility("default"))) int rift_mesh_culled_microfaces() { return g_mesh_culled_microfaces; }

// Returns merged visible quad count, -1 for an unknown future shape, -2 invalid slot.
__attribute__((visibility("default"))) int rift_build_section_mesh(int slot) {
  g_mesh_faces=g_mesh_blocks=g_mesh_vertices_count=g_mesh_indices_count=0;
  g_mesh_partial_blocks=g_mesh_occupied_microvoxels=g_mesh_visible_microfaces=g_mesh_culled_microfaces=0;
  if(!rift_valid_slot(slot)||!g_slot_valid[slot])return -2;
  unsigned short* states=g_section_slots[slot];int containsPartial=0;
  for(int index=0;index<RIFT_SECTION_VOLUME;index+=1){const unsigned short state=states[index];if(!state)continue;const int shape=rift_shape_id(state);if(shape>3)return -1;g_mesh_blocks+=1;if(shape!=0){containsPartial=1;g_mesh_partial_blocks+=1;}}
  const int originX=g_slot_sx[slot]*16,originY=g_slot_sy[slot]*16,originZ=g_slot_sz[slot]*16;
  if(!containsPartial){
    for(int y=0;y<16;y+=1)for(int z=0;z<16;z+=1)for(int x=0;x<16;x+=1){const int index=rift_index(x,y,z);const unsigned short state=states[index];if(!state)continue;unsigned char mask=0u;for(int face=0;face<6;face+=1){if(rift_neighbor_state(slot,face,x,y,z)!=0u)continue;mask|=(unsigned char)(1u<<face);rift_emit_face(face,originX+x,originY+y,originZ+z,(unsigned int)(state&255u));}g_section_face_masks[index]=mask;}
  } else {
    static const int fdx[6]={1,-1,0,0,0,0},fdy[6]={0,0,1,-1,0,0},fdz[6]={0,0,0,0,1,-1};
    for(int y=0;y<16;y+=1)for(int z=0;z<16;z+=1)for(int x=0;x<16;x+=1){const unsigned short state=states[rift_index(x,y,z)];if(!state)continue;const unsigned char mask=rift_shape_mask_impl(state);for(int bit=0;bit<8;bit+=1)if(mask&(1u<<bit))g_mesh_occupied_microvoxels+=1;
      unsigned char groups[6][3]={{0}};
      for(int my=0;my<2;my+=1)for(int mz=0;mz<2;mz+=1)for(int mx=0;mx<2;mx+=1){if(!rift_micro_occupied(mask,mx,my,mz))continue;for(int face=0;face<6;face+=1){int nx=mx+fdx[face],ny=my+fdy[face],nz=mz+fdz[face];unsigned char neighborMask=mask;if(nx<0||nx>1||ny<0||ny>1||nz<0||nz>1){const unsigned short neighbor=rift_neighbor_state(slot,face,x,y,z);neighborMask=rift_shape_mask_impl(neighbor);if(nx<0)nx=1;else if(nx>1)nx=0;if(ny<0)ny=1;else if(ny>1)ny=0;if(nz<0)nz=1;else if(nz>1)nz=0;}if(rift_micro_occupied(neighborMask,nx,ny,nz)){g_mesh_culled_microfaces+=1;continue;}g_mesh_visible_microfaces+=1;int plane,u,v;if(face<=1){plane=mx+(face==0?1:0);u=mz;v=my;}else if(face<=3){plane=my+(face==2?1:0);u=mx;v=mz;}else{plane=mz+(face==4?1:0);u=mx;v=my;}groups[face][plane]|=(unsigned char)(1u<<(v*2+u));}}
      for(int face=0;face<6;face+=1)for(int plane=0;plane<3;plane+=1){const unsigned char tiles=groups[face][plane];if(!tiles)continue;unsigned char used=0u;for(int v=0;v<2;v+=1)for(int u=0;u<2;u+=1){const unsigned char bit=(unsigned char)(1u<<(v*2+u));if(!(tiles&bit)||(used&bit))continue;int width=1,height=1;if(u+1<2){const unsigned char b2=(unsigned char)(1u<<(v*2+u+1));if((tiles&b2)&&!(used&b2))width=2;}if(v+1<2){int ok=1;for(int xx=u;xx<u+width;xx+=1){const unsigned char bb=(unsigned char)(1u<<((v+1)*2+xx));if(!(tiles&bb)||(used&bb))ok=0;}if(ok)height=2;}for(int yy=v;yy<v+height;yy+=1)for(int xx=u;xx<u+width;xx+=1)used|=(unsigned char)(1u<<(yy*2+xx));rift_emit_axis_rect(face,originX+x,originY+y,originZ+z,plane,u,v,u+width,v+height,(unsigned int)(state&255u));}}
    }
  }
  g_metric_mesh_builds+=1u;g_metric_faces_emitted+=(unsigned int)g_mesh_faces;return g_mesh_faces;
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

// Native resident-world mutations --------------------------------------------
__attribute__((visibility("default"))) int rift_set_block_world(int worldId,int worldX,int worldY,int worldZ,unsigned int state){
  const int sx=rift_floor_div_impl(worldX,16),sy=rift_floor_div_impl(worldY,16),sz=rift_floor_div_impl(worldZ,16),slot=rift_find_slot(worldId,sx,sy,sz);if(slot<0)return 0;const int x=rift_positive_mod_impl(worldX,16),y=rift_positive_mod_impl(worldY,16),z=rift_positive_mod_impl(worldZ,16),index=rift_index(x,y,z);const unsigned short next=(unsigned short)(state&65535u);if(g_section_slots[slot][index]==next)return 1;g_section_slots[slot][index]=next;g_metric_mutations+=1u;return 1;
}
__attribute__((visibility("default"))) int rift_batch_mutate_world(int worldId,int count){if(count<0)count=0;if(count>RIFT_BATCH_CAPACITY)count=RIFT_BATCH_CAPACITY;int applied=0;for(int i=0;i<count;i+=1)applied+=rift_set_block_world(worldId,g_batch_query_xyz[i*3],g_batch_query_xyz[i*3+1],g_batch_query_xyz[i*3+2],g_batch_query_states[i]);return applied;}

// Whole-step player physics --------------------------------------------------
__attribute__((visibility("default"))) unsigned int rift_player_result_ptr(){return (unsigned int)(unsigned long)&g_player_result[0];}
__attribute__((visibility("default"))) unsigned int rift_player_flags_ptr(){return (unsigned int)(unsigned long)&g_player_flags[0];}
__attribute__((visibility("default"))) int rift_player_step_world(int worldId,float x,float y,float z,float verticalVelocity,float totalDx,float totalDz,float dt,float radius,float height,float stepUp,float snapDown,float gravity,float stepAssist,int grounded,float minX,float minY,float minZ,float maxX,float maxY,float maxZ){
  g_metric_player_steps+=1u;for(int i=0;i<4;i+=1)g_player_flags[i]=0;int collided=0,stepped=0,recovery=0;const float skin=0.002f;const float lowX=minX+radius+skin,highX=maxX+1.0f-radius-skin,lowZ=minZ+radius+skin,highZ=maxZ+1.0f-radius-skin;
  x=rift_clampf(x,lowX,highX);z=rift_clampf(z,lowZ,highZ);
  const float distance=rift_sqrt(totalDx*totalDx+totalDz*totalDz);int steps=(int)(distance/0.095f)+1;if(steps<1)steps=1;const float dx=totalDx/(float)steps,dz=totalDz/(float)steps;
  for(int i=0;i<steps;i+=1){float tx=rift_clampf(x+dx,lowX,highX),tz=rift_clampf(z+dz,lowZ,highZ);int moved=grounded?rift_try_ground_move_impl(worldId,x,y,z,tx,tz,radius,height,stepUp,snapDown,stepAssist,grounded,stepped):rift_try_air_move_impl(worldId,x,y,z,tx,tz,radius,height,grounded,stepAssist);if(!moved&&rift_abs(dx)>0.00001f&&rift_abs(dz)>0.00001f){collided=1;tx=rift_clampf(x+dx,lowX,highX);tz=z;grounded?rift_try_ground_move_impl(worldId,x,y,z,tx,tz,radius,height,stepUp,snapDown,stepAssist,grounded,stepped):rift_try_air_move_impl(worldId,x,y,z,tx,tz,radius,height,grounded,stepAssist);tx=x;tz=rift_clampf(z+dz,lowZ,highZ);grounded?rift_try_ground_move_impl(worldId,x,y,z,tx,tz,radius,height,stepUp,snapDown,stepAssist,grounded,stepped):rift_try_air_move_impl(worldId,x,y,z,tx,tz,radius,height,grounded,stepAssist);}else if(!moved)collided=1;}
  if(!grounded||verticalVelocity>0.0f){const float previousY=y;verticalVelocity-=gravity*dt;const float candidateY=y+verticalVelocity*dt;if(verticalVelocity<=0.0f){const float landing=rift_landing_height_impl(worldId,x,z,previousY,candidateY,radius);if(landing>-1.0e19f){float lx=x,lz=z;if(!rift_body_blocked_impl(worldId,lx,landing,lz,radius,height)||rift_depenetrate_horizontal_impl(worldId,lx,landing,lz,totalDx,totalDz,radius,height,radius+0.08f)){x=lx;z=lz;y=landing;verticalVelocity=0.0f;grounded=1;}else y=rift_sweep_vertical_impl(worldId,x,previousY,candidateY,z,radius,height);}else{float cx=x,cz=z;if(rift_depenetrate_horizontal_impl(worldId,cx,candidateY,cz,totalDx,totalDz,radius,height,radius+0.06f)){x=cx;z=cz;y=candidateY;}else y=rift_sweep_vertical_impl(worldId,x,previousY,candidateY,z,radius,height);}}else{float cx=x,cz=z;if(rift_depenetrate_horizontal_impl(worldId,cx,candidateY,cz,totalDx,totalDz,radius,height,0.08f)){x=cx;z=cz;y=candidateY;}else{y=rift_sweep_vertical_impl(worldId,x,previousY,candidateY,z,radius,height);verticalVelocity=0.0f;}}}
  else{const float support=rift_support_at_point_impl(worldId,x,z,y,stepUp+0.02f,snapDown+0.04f);if(stepAssist>-1.0e19f&&rift_abs(y-stepAssist)<=0.08f&&rift_support_at_height_impl(worldId,x,z,stepAssist,radius,0.065f)&&!rift_body_blocked_impl(worldId,x,stepAssist,z,radius,height)){y=stepAssist;grounded=1;}else{if(stepAssist>-1.0e19f)stepAssist=-1.0e20f;const float delta=support<=-1.0e19f?-1.0e20f:support-y;if(delta<=-0.08f&&((rift_flat_support_contacts_impl(worldId,x,z,y,radius,0.045f)>=4)||rift_stair_support_near_impl(worldId,x,z,y,radius,0.085f))&&!rift_body_blocked_impl(worldId,x,y,z,radius,height))grounded=1;else if(support>-1.0e19f&&delta<=stepUp+0.0001f&&delta>=-snapDown-0.0001f)y=support;else if(support<=-1.0e19f||delta<-snapDown-0.0001f){grounded=0;verticalVelocity=0.0f;}}}
  if(rift_body_blocked_impl(worldId,x,y,z,radius,height)){float cx=x,cz=z;if(rift_depenetrate_horizontal_impl(worldId,cx,y,cz,totalDx,totalDz,radius,height,radius+0.06f)){x=cx;z=cz;collided=1;}else recovery=1;}
  if(y<minY-8.0f)recovery=1;
  g_player_result[0]=x;g_player_result[1]=y;g_player_result[2]=z;g_player_result[3]=verticalVelocity;g_player_result[4]=stepAssist;
  g_player_flags[0]=grounded?1:0;g_player_flags[1]=collided;g_player_flags[2]=stepped;g_player_flags[3]=recovery;return recovery?0:1;
}

// Spatial/agent kernels ------------------------------------------------------
__attribute__((visibility("default"))) int rift_spatial_capacity(){return RIFT_SPATIAL_CAPACITY;}
__attribute__((visibility("default"))) unsigned int rift_spatial_entities_ptr(){return (unsigned int)(unsigned long)&g_spatial_entities[0];}
__attribute__((visibility("default"))) unsigned int rift_spatial_meta_ptr(){return (unsigned int)(unsigned long)&g_spatial_meta[0];}
__attribute__((visibility("default"))) unsigned int rift_spatial_results_ptr(){return (unsigned int)(unsigned long)&g_spatial_results[0];}
__attribute__((visibility("default"))) int rift_spatial_query_sphere(int count,float cx,float cy,float cz,float radius,unsigned int categoryMask){if(count<0)count=0;if(count>RIFT_SPATIAL_CAPACITY)count=RIFT_SPATIAL_CAPACITY;int out=0;const float queryR=rift_maxf(0.0f,radius);for(int i=0;i<count;i+=1){const unsigned int mask=(unsigned int)g_spatial_meta[i*2+1];if(categoryMask&&!(mask&categoryMask))continue;const float dx=g_spatial_entities[i*4]-cx,dy=g_spatial_entities[i*4+1]-cy,dz=g_spatial_entities[i*4+2]-cz,rr=queryR+rift_maxf(0.0f,g_spatial_entities[i*4+3]);if(dx*dx+dy*dy+dz*dz<=rr*rr)g_spatial_results[out++]=g_spatial_meta[i*2];}g_metric_spatial_queries+=1u;return out;}
__attribute__((visibility("default"))) int rift_agent_capacity(){return RIFT_AGENT_CAPACITY;}
__attribute__((visibility("default"))) unsigned int rift_agent_data_ptr(){return (unsigned int)(unsigned long)&g_agents[0];}
__attribute__((visibility("default"))) int rift_simulate_agents(int count,float dt){if(count<0)count=0;if(count>RIFT_AGENT_CAPACITY)count=RIFT_AGENT_CAPACITY;dt=rift_clampf(dt,0.0f,0.25f);for(int i=0;i<count;i+=1){float* a=&g_agents[i*8];const float dx=a[3]-a[0],dy=a[4]-a[1],dz=a[5]-a[2],len=rift_sqrt(dx*dx+dy*dy+dz*dz),step=rift_maxf(0.0f,a[6])*dt;if(len>0.0001f){const float scale=rift_minf(1.0f,step/len);a[0]+=dx*scale;a[1]+=dy*scale;a[2]+=dz*scale;}}g_metric_agent_steps+=(unsigned int)count;return count;}

// Bounded resident-world A* --------------------------------------------------
__attribute__((visibility("default"))) int rift_path_point_capacity(){return RIFT_PATH_POINT_CAPACITY;}
__attribute__((visibility("default"))) unsigned int rift_path_points_ptr(){return (unsigned int)(unsigned long)&g_path_points[0];}
__attribute__((visibility("default"))) int rift_pathfind_world(int worldId,int startX,int startY,int startZ,int goalX,int goalY,int goalZ,int maxNodes,float radius,float height,float stepUp,float maxDrop){g_metric_pathfinds+=1u;if(maxNodes<=0||maxNodes>RIFT_PATH_NODE_CAPACITY)maxNodes=RIFT_PATH_NODE_CAPACITY;if(rift_abs((float)(goalX-startX))>=63.0f||rift_abs((float)(goalZ-startZ))>=63.0f)return 0;const int centerX=(startX+goalX)/2,centerZ=(startZ+goalZ)/2,originX=centerX-32,originZ=centerZ-32;const int sx=startX-originX,sz=startZ-originZ,gx=goalX-originX,gz=goalZ-originZ;if(sx<0||sx>=64||sz<0||sz>=64||gx<0||gx>=64||gz<0||gz>=64)return 0;for(int i=0;i<RIFT_PATH_NODE_CAPACITY;i+=1){g_path_state[i]=0;g_path_parent[i]=-1;g_path_g[i]=0x3fffffff;g_path_f[i]=0x3fffffff;g_path_y[i]=-1.0e20f;}const int start=sz*64+sx;g_path_state[start]=1;g_path_g[start]=0;g_path_f[start]=(rift_abs((float)(gx-sx))+rift_abs((float)(gz-sz)))*10.0f;g_path_y[start]=(float)startY;int expanded=0,goal=-1;static const int ndx[4]={1,-1,0,0},ndz[4]={0,0,1,-1};while(expanded<maxNodes){int best=-1,bestF=0x3fffffff;for(int i=0;i<RIFT_PATH_NODE_CAPACITY;i+=1)if(g_path_state[i]==1&&g_path_f[i]<bestF){best=i;bestF=g_path_f[i];}if(best<0)break;g_path_state[best]=2;expanded+=1;const int bx=best%64,bz=best/64;if(bx==gx&&bz==gz){goal=best;break;}const float baseY=g_path_y[best];for(int n=0;n<4;n+=1){const int nx=bx+ndx[n],nz=bz+ndz[n];if(nx<0||nx>=64||nz<0||nz>=64)continue;const int ni=nz*64+nx;if(g_path_state[ni]==2)continue;const float wx=(float)(originX+nx)+0.5f,wz=(float)(originZ+nz)+0.5f;const float support=rift_support_at_point_impl(worldId,wx,wz,baseY,stepUp+0.02f,maxDrop);if(support<=-1.0e19f||support>baseY+stepUp+0.02f||support<baseY-maxDrop)continue;if(rift_body_blocked_impl(worldId,wx,support,wz,radius,height))continue;const int cost=g_path_g[best]+10+(int)(rift_abs(support-baseY)*8.0f);if(cost>=g_path_g[ni])continue;g_path_parent[ni]=best;g_path_g[ni]=cost;g_path_y[ni]=support;g_path_f[ni]=cost+(int)((rift_abs((float)(gx-nx))+rift_abs((float)(gz-nz)))*10.0f);g_path_state[ni]=1;}}
  g_metric_path_nodes+=(unsigned int)expanded;if(goal<0)return 0;int reversed[RIFT_PATH_POINT_CAPACITY];int count=0;for(int node=goal;node>=0&&count<RIFT_PATH_POINT_CAPACITY;node=g_path_parent[node])reversed[count++]=node;for(int i=0;i<count;i+=1){const int node=reversed[count-1-i],nx=node%64,nz=node/64;g_path_points[i*3]=originX+nx;g_path_points[i*3+1]=(int)(g_path_y[node]*1000.0f);g_path_points[i*3+2]=originZ+nz;}return count;}

// Deterministic combat math --------------------------------------------------
__attribute__((visibility("default"))) unsigned int rift_combat_result_ptr(){return (unsigned int)(unsigned long)&g_combat_result[0];}
__attribute__((visibility("default"))) int rift_combat_resolve(int attackerPower,int attackerAccuracy,int defenderArmor,int defenderEvasion,int weaponMin,int weaponMax,int critPermille,unsigned int seed){if(weaponMax<weaponMin){const int t=weaponMin;weaponMin=weaponMax;weaponMax=t;}if(weaponMin<0)weaponMin=0;if(weaponMax<weaponMin)weaponMax=weaponMin;int hitChance=500+(attackerAccuracy-defenderEvasion)*10;if(hitChance<50)hitChance=50;if(hitChance>950)hitChance=950;const unsigned int h1=rift_hash3(attackerPower,defenderArmor,(int)seed,seed^0x9e3779b9u),h2=rift_hash3(attackerAccuracy,defenderEvasion,(int)(seed>>1),h1);const int hitRoll=(int)(h1%1000u),damageRoll=weaponMin+(int)(h2%(unsigned int)(weaponMax-weaponMin+1));const int hit=hitRoll<hitChance?1:0,critical=hit&&((int)((h2>>10)%1000u)<critPermille)?1:0;int damage=hit?(damageRoll+attackerPower-defenderArmor/2):0;if(damage<1&&hit)damage=1;if(critical)damage=(damage*3+1)/2;g_combat_result[0]=hit;g_combat_result[1]=damage;g_combat_result[2]=critical;g_combat_result[3]=hitRoll;g_combat_result[4]=damageRoll;g_combat_result[5]=(int)h2;g_metric_combat_resolves+=1u;return hit;}


// Native counters -------------------------------------------------------------
__attribute__((visibility("default"))) unsigned int rift_metric_mesh_builds() { return g_metric_mesh_builds; }
__attribute__((visibility("default"))) unsigned int rift_metric_faces_emitted() { return g_metric_faces_emitted; }
__attribute__((visibility("default"))) unsigned int rift_metric_batch_calls() { return g_metric_batch_calls; }
__attribute__((visibility("default"))) unsigned int rift_metric_batch_cells() { return g_metric_batch_cells; }
__attribute__((visibility("default"))) unsigned int rift_metric_raycasts() { return g_metric_raycasts; }
__attribute__((visibility("default"))) unsigned int rift_metric_raycast_steps() { return g_metric_raycast_steps; }
__attribute__((visibility("default"))) unsigned int rift_metric_player_steps() { return g_metric_player_steps; }
__attribute__((visibility("default"))) unsigned int rift_metric_collision_probes() { return g_metric_collision_probes; }
__attribute__((visibility("default"))) unsigned int rift_metric_mutations() { return g_metric_mutations; }
__attribute__((visibility("default"))) unsigned int rift_metric_pathfinds() { return g_metric_pathfinds; }
__attribute__((visibility("default"))) unsigned int rift_metric_path_nodes() { return g_metric_path_nodes; }
__attribute__((visibility("default"))) unsigned int rift_metric_spatial_queries() { return g_metric_spatial_queries; }
__attribute__((visibility("default"))) unsigned int rift_metric_agent_steps() { return g_metric_agent_steps; }
__attribute__((visibility("default"))) unsigned int rift_metric_combat_resolves() { return g_metric_combat_resolves; }
__attribute__((visibility("default"))) void rift_metric_reset() {
  g_metric_mesh_builds=g_metric_faces_emitted=g_metric_batch_calls=g_metric_batch_cells=g_metric_raycasts=g_metric_raycast_steps=0u;
  g_metric_player_steps=g_metric_collision_probes=g_metric_mutations=g_metric_pathfinds=g_metric_path_nodes=g_metric_spatial_queries=g_metric_agent_steps=g_metric_combat_resolves=0u;
}

}
