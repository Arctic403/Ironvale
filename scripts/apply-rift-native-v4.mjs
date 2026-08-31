import fs from 'node:fs';

const read = path => fs.readFileSync(path, 'utf8');
const write = (path, text) => fs.writeFileSync(path, text);
const fail = message => { throw new Error(`[native-v4-converter] ${message}`); };
const replaceOnce = (text, from, to, label) => {
  const index = text.indexOf(from);
  if (index < 0) fail(`missing ${label}`);
  if (text.indexOf(from, index + from.length) >= 0) fail(`ambiguous ${label}`);
  return text.slice(0, index) + to + text.slice(index + from.length);
};
const replaceBetween = (text, start, end, body, label) => {
  const a = text.indexOf(start), b = text.indexOf(end, a + start.length);
  if (a < 0 || b < 0 || b <= a) fail(`missing range ${label}`);
  return text.slice(0, a) + body + '\n\n' + text.slice(b);
};

// ---------------------------------------------------------------------------
// Native C++ core v4
// ---------------------------------------------------------------------------
let cpp = read('native/rift-core.cpp');
cpp = cpp.replace('// RiftCity Native Core v3\n// Persistent RiftSection residency, native full-block meshing, batched world\n// queries and voxel DDA raycasting shared by browsers and Cloudflare Workers.',
`// Rift Native Core v4
// Persistent RiftSection residency, shape-aware native meshing, whole-step player
// physics, mutations, pathfinding, spatial/agent kernels and combat math shared by
// browsers and Cloudflare Workers.`);
cpp = replaceOnce(cpp,
`static const int RIFT_MAX_FACES = RIFT_SECTION_VOLUME * RIFT_FACE_COUNT;
static const int RIFT_MAX_VERTICES = RIFT_MAX_FACES * 4;
static const int RIFT_MAX_INDICES = RIFT_MAX_FACES * 6;
static const int RIFT_BATCH_CAPACITY = 1024;`,
`// A stair can emit up to ten merged half-meter quads. Reserve enough workspace
// for a worst-case section without allocating from a libc heap.
static const int RIFT_MAX_FACES = RIFT_SECTION_VOLUME * 10;
static const int RIFT_MAX_VERTICES = RIFT_MAX_FACES * 4;
static const int RIFT_MAX_INDICES = RIFT_MAX_FACES * 6;
static const int RIFT_BATCH_CAPACITY = 1024;
static const int RIFT_SPATIAL_CAPACITY = 512;
static const int RIFT_AGENT_CAPACITY = 256;
static const int RIFT_PATH_GRID = 64;
static const int RIFT_PATH_NODE_CAPACITY = RIFT_PATH_GRID * RIFT_PATH_GRID;
static const int RIFT_PATH_POINT_CAPACITY = 512;`, 'native capacities');

cpp = replaceOnce(cpp,
`static int g_mesh_faces = 0;
static int g_mesh_blocks = 0;
static int g_mesh_vertices_count = 0;
static int g_mesh_indices_count = 0;`,
`static int g_mesh_faces = 0;
static int g_mesh_blocks = 0;
static int g_mesh_vertices_count = 0;
static int g_mesh_indices_count = 0;
static int g_mesh_partial_blocks = 0;
static int g_mesh_occupied_microvoxels = 0;
static int g_mesh_visible_microfaces = 0;
static int g_mesh_culled_microfaces = 0;`, 'mesh counters');

cpp = replaceOnce(cpp,
`static int g_raycast_hit[5];
static float g_raycast_distance = 0.0f;`,
`static int g_raycast_hit[5];
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
static int g_combat_result[6];`, 'v4 workspaces');

cpp = replaceOnce(cpp,
`static unsigned int g_metric_raycasts = 0u;
static unsigned int g_metric_raycast_steps = 0u;`,
`static unsigned int g_metric_raycasts = 0u;
static unsigned int g_metric_raycast_steps = 0u;
static unsigned int g_metric_player_steps = 0u;
static unsigned int g_metric_collision_probes = 0u;
static unsigned int g_metric_mutations = 0u;
static unsigned int g_metric_pathfinds = 0u;
static unsigned int g_metric_path_nodes = 0u;
static unsigned int g_metric_spatial_queries = 0u;
static unsigned int g_metric_agent_steps = 0u;
static unsigned int g_metric_combat_resolves = 0u;`, 'v4 native metrics');

cpp = replaceOnce(cpp,
`static int rift_index(int x, int y, int z) { return (y << 8) | (z << 4) | x; }
static int rift_valid_slot(int slot) { return slot >= 0 && slot < RIFT_SECTION_SLOT_CAPACITY; }`,
`static int rift_index(int x, int y, int z) { return (y << 8) | (z << 4) | x; }
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
}`, 'core helper insertion');

const preExtern = String.raw`
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
`;
cpp = replaceOnce(cpp, `extern "C" {`, preExtern + `\nextern "C" {`, 'pre-extern v4 kernels');
cpp = cpp.replace('int rift_core_version() { return 3; }', 'int rift_core_version() { return 4; }');

const meshSection = String.raw`// Native shape-aware section mesh builder ------------------------------------
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
}`;
cpp = replaceBetween(cpp, '// Native full-block mesh builder', '// Batched resident-world queries', meshSection, 'native mesh builder');

const v4Exports = String.raw`// Native resident-world mutations --------------------------------------------
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
`;
cpp = replaceOnce(cpp, '// Native counters -------------------------------------------------------------', v4Exports + '\n\n// Native counters -------------------------------------------------------------', 'v4 exported systems');

cpp = replaceOnce(cpp,
`__attribute__((visibility("default"))) unsigned int rift_metric_raycast_steps() { return g_metric_raycast_steps; }
__attribute__((visibility("default"))) void rift_metric_reset() {
  g_metric_mesh_builds=g_metric_faces_emitted=g_metric_batch_calls=g_metric_batch_cells=g_metric_raycasts=g_metric_raycast_steps=0u;
}`,
`__attribute__((visibility("default"))) unsigned int rift_metric_raycast_steps() { return g_metric_raycast_steps; }
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
}`, 'v4 metric exports');
write('native/rift-core.cpp', cpp);

// ---------------------------------------------------------------------------
// Browser bridge v4
// ---------------------------------------------------------------------------
let bridge = read('public/rift-wasm-core.js');
bridge = bridge.replace('// RiftCity Native Core browser/Node bridge v3.\n// v3 keeps RiftSections resident in WASM memory, emits full-block section meshes\n// natively, batches resident-world collision queries and exposes voxel DDA\n// raycasting. JavaScript fallbacks remain authoritative whenever a native path\n// cannot preserve the existing world semantics.',
`// Rift Native Core browser/Node bridge v4.
// v4 adds shape-aware meshing, whole-step resident-world player physics,
// mutations, pathfinding, spatial/agent kernels and deterministic combat while
// keeping JavaScript fallbacks for unsupported or non-resident worlds.`);
bridge = bridge.replace(`  raycasts: 0,\n  raycastFallbacks: 0`, `  raycasts: 0,\n  raycastFallbacks: 0,\n  playerSteps: 0,\n  playerStepFallbacks: 0,\n  pathfinds: 0,\n  pathfindFallbacks: 0,\n  mutations: 0,\n  spatialQueries: 0,\n  agentSteps: 0,\n  combatResolves: 0`);
bridge = bridge.replace("if (exports.rift_core_version?.() !== 3) throw new Error('Rift native core version mismatch.');", "if (exports.rift_core_version?.() !== 4) throw new Error('Rift native core version mismatch.');");
bridge = bridge.replace("if (!exports.rift_build_section_mesh || !exports.rift_batch_query_world || !exports.rift_raycast_world) {\n      throw new Error('Rift native v3 mesh/query/raycast exports missing.');\n    }", "if (!exports.rift_build_section_mesh || !exports.rift_batch_query_world || !exports.rift_raycast_world || !exports.rift_player_step_world || !exports.rift_pathfind_world || !exports.rift_spatial_query_sphere || !exports.rift_combat_resolve) {\n      throw new Error('Rift native v4 gameplay exports missing.');\n    }");
bridge = bridge.replace("console.warn('RiftCity native core unavailable; deterministic JavaScript fallback remains active.', error);", "console.warn('Rift native core unavailable; deterministic JavaScript fallback remains active.', error);");
bridge = bridge.replace(`    raycasts: api?.rift_metric_raycasts?.() >>> 0 || 0,\n    raycastSteps: api?.rift_metric_raycast_steps?.() >>> 0 || 0`, `    raycasts: api?.rift_metric_raycasts?.() >>> 0 || 0,\n    raycastSteps: api?.rift_metric_raycast_steps?.() >>> 0 || 0,\n    playerSteps: api?.rift_metric_player_steps?.() >>> 0 || 0,\n    collisionProbes: api?.rift_metric_collision_probes?.() >>> 0 || 0,\n    mutations: api?.rift_metric_mutations?.() >>> 0 || 0,\n    pathfinds: api?.rift_metric_pathfinds?.() >>> 0 || 0,\n    pathNodes: api?.rift_metric_path_nodes?.() >>> 0 || 0,\n    spatialQueries: api?.rift_metric_spatial_queries?.() >>> 0 || 0,\n    agentSteps: api?.rift_metric_agent_steps?.() >>> 0 || 0,\n    combatResolves: api?.rift_metric_combat_resolves?.() >>> 0 || 0`);
bridge = bridge.replace(`    if ((packed & PARTIAL_SHAPE_MASK) !== 0) return false;\n    const material = packed & 255;`, `    const shape = (packed >> 8) & 7;\n    if (shape > 3) return false;\n    const material = packed & 255;`);
bridge = bridge.replace(`  const blocks = nativeExports.rift_mesh_block_count();\n  const vertexCount`, `  const blocks = nativeExports.rift_mesh_block_count();\n  const partialBlocks = nativeExports.rift_mesh_partial_block_count?.() || 0;\n  const occupiedMicrovoxels = nativeExports.rift_mesh_occupied_microvoxels?.() || 0;\n  const visibleMicroFaces = nativeExports.rift_mesh_visible_microfaces?.() || 0;\n  const culledMicroFaces = nativeExports.rift_mesh_culled_microfaces?.() || 0;\n  const vertexCount`);
bridge = bridge.replace(`    culledFaces: blocks * 6 - faceCount,\n    vertexCount,`, `    culledFaces: partialBlocks ? culledMicroFaces : blocks * 6 - faceCount,\n    occupiedMicrovoxels,\n    visibleMicroFaces,\n    culledMicroFaces,\n    shapeAware: partialBlocks > 0,\n    visibleSurfaceTiles: partialBlocks ? visibleMicroFaces : undefined,\n    culledSurfaceTiles: partialBlocks ? culledMicroFaces : undefined,\n    vertexCount,`);

const acceleratorMethods = String.raw`
  function setBlockWorld(x,y,z,state=0) {
    const g=grid();const wx=Math.floor(Number(x)||0),wy=Math.floor(Number(y)||0),wz=Math.floor(Number(z)||0),packed=Math.max(0,Math.min(65535,Math.trunc(Number(state)||0)));
    if (!g?.setBlockWorld) return { changed:false, native:false };
    const result=g.setBlockWorld(wx,wy,wz,packed);
    if (!result?.changed) return { ...result, native:Boolean(nativeExports) };
    const section=result.section;const sync=section?syncSection(section):null;
    if (sync?.native && nativeExports?.rift_set_block_world) {
      nativeExports.rift_set_block_world(worldId,wx,wy,wz,packed);bridgeMetrics.mutations+=1;
    }
    return { ...result, native:Boolean(sync?.native) };
  }
  function playerStep(options={}) {
    const g=grid(),bounds=options.bounds;
    if (!nativeExports?.rift_player_step_world || !g?.getSection || !bounds?.min || !bounds?.max || !syncAll()) { bridgeMetrics.playerStepFallbacks+=1; return { native:false }; }
    const p=options.position||[0,0,0];
    const ok=nativeExports.rift_player_step_world(
      worldId, Number(p[0])||0, Number(p[1])||0, Number(p[2])||0,
      Number(options.verticalVelocity)||0, Number(options.dx)||0, Number(options.dz)||0,
      Math.max(0,Number(options.dt)||0), Math.max(0.05,Number(options.radius)||0.28), Math.max(0.5,Number(options.height)||1.8),
      Math.max(0,Number(options.stepUp)||0.58), Math.max(0,Number(options.snapDown)||0.72), Math.max(0,Number(options.gravity)||12.5),
      Number.isFinite(options.stepAssistY)?Number(options.stepAssistY):-1e20, options.grounded?1:0,
      Number(bounds.min[0])||0,Number(bounds.min[1])||0,Number(bounds.min[2])||0,
      Number(bounds.max[0])||0,Number(bounds.max[1])||0,Number(bounds.max[2])||0
    );
    const result=new Float32Array(nativeExports.memory.buffer,nativeExports.rift_player_result_ptr()>>>0,5);
    const flags=new Int32Array(nativeExports.memory.buffer,nativeExports.rift_player_flags_ptr()>>>0,4);
    bridgeMetrics.playerSteps+=1;
    return { native:true, ok:Boolean(ok), position:[result[0],result[1],result[2]], verticalVelocity:result[3], stepAssistY:result[4] <= -1e19 ? null : result[4], grounded:Boolean(flags[0]), collided:Boolean(flags[1]), stepped:Boolean(flags[2]), recovery:Boolean(flags[3]) };
  }
  function findPath(start,goal,options={}) {
    if (!nativeExports?.rift_pathfind_world || !syncAll()) { bridgeMetrics.pathfindFallbacks+=1; return { native:false, points:[] }; }
    const count=nativeExports.rift_pathfind_world(worldId,
      Math.floor(start?.[0]||0),Math.floor(start?.[1]||0),Math.floor(start?.[2]||0),
      Math.floor(goal?.[0]||0),Math.floor(goal?.[1]||0),Math.floor(goal?.[2]||0),
      Math.max(1,Math.min(4096,Math.trunc(options.maxNodes||2048))),Math.max(.05,Number(options.radius)||.28),Math.max(.5,Number(options.height)||1.8),Math.max(0,Number(options.stepUp)||.58),Math.max(.1,Number(options.maxDrop)||1.5));
    bridgeMetrics.pathfinds+=1;if(count<=0)return { native:true, points:[] };
    const raw=new Int32Array(nativeExports.memory.buffer,nativeExports.rift_path_points_ptr()>>>0,count*3),points=[];
    for(let i=0;i<count;i+=1)points.push([raw[i*3]+.5,raw[i*3+1]/1000,raw[i*3+2]+.5]);
    return { native:true, points };
  }
`;
bridge = replaceOnce(bridge, `  function dispose() {`, acceleratorMethods + `\n  function dispose() {`, 'accelerator v4 methods');
bridge = bridge.replace(`return Object.freeze({ worldId, getBlockWorld, batchGetBlockWorld, raycast, syncAll, dispose });`, `return Object.freeze({ worldId, getBlockWorld, batchGetBlockWorld, setBlockWorld, playerStep, findPath, raycast, syncAll, dispose });`);

const bridgeApis = String.raw`
export function riftNativeSpatialQuery(entities=[], center=[0,0,0], radius=0, categoryMask=0xffffffff) {
  const api=nativeExports, count=Math.min(entities.length,api?.rift_spatial_capacity?.()||0);
  if (!api || !count) return entities.filter(entity=>{const dx=(entity.x||0)-(center[0]||0),dy=(entity.y||0)-(center[1]||0),dz=(entity.z||0)-(center[2]||0),rr=Math.max(0,Number(radius)||0)+Math.max(0,Number(entity.radius)||0);return (!categoryMask||((entity.mask??0xffffffff)&categoryMask))&&dx*dx+dy*dy+dz*dz<=rr*rr;}).map(entity=>entity.id);
  const data=new Float32Array(api.memory.buffer,api.rift_spatial_entities_ptr()>>>0,count*4),meta=new Int32Array(api.memory.buffer,api.rift_spatial_meta_ptr()>>>0,count*2);
  for(let i=0;i<count;i+=1){const e=entities[i]||{};data[i*4]=Number(e.x)||0;data[i*4+1]=Number(e.y)||0;data[i*4+2]=Number(e.z)||0;data[i*4+3]=Math.max(0,Number(e.radius)||0);meta[i*2]=Math.trunc(Number(e.id)||i);meta[i*2+1]=Math.trunc(Number(e.mask??0xffffffff));}
  const found=api.rift_spatial_query_sphere(count,Number(center[0])||0,Number(center[1])||0,Number(center[2])||0,Math.max(0,Number(radius)||0,Math.trunc(categoryMask)>>>0));
  bridgeMetrics.spatialQueries+=1;return [...new Int32Array(api.memory.buffer,api.rift_spatial_results_ptr()>>>0,found)];
}

export function riftNativeSimulateAgents(agents=[], dt=0) {
  const api=nativeExports,count=Math.min(agents.length,api?.rift_agent_capacity?.()||0);if(!api||!count)return agents.map(agent=>({...agent}));
  const data=new Float32Array(api.memory.buffer,api.rift_agent_data_ptr()>>>0,count*8);
  for(let i=0;i<count;i+=1){const a=agents[i]||{},t=a.target||[a.x||0,a.y||0,a.z||0];data.set([Number(a.x)||0,Number(a.y)||0,Number(a.z)||0,Number(t[0])||0,Number(t[1])||0,Number(t[2])||0,Math.max(0,Number(a.speed)||0),Math.max(0,Number(a.radius)||0)],i*8);}
  api.rift_simulate_agents(count,Math.max(0,Number(dt)||0));bridgeMetrics.agentSteps+=count;
  return agents.slice(0,count).map((agent,i)=>({...agent,x:data[i*8],y:data[i*8+1],z:data[i*8+2]}));
}

export function riftNativeResolveCombat(options={}) {
  const api=nativeExports;if(!api?.rift_combat_resolve){return { native:false, hit:true, damage:Math.max(1,(Number(options.weaponMin)||1)+(Number(options.attackerPower)||0)-(Number(options.defenderArmor)||0)/2), critical:false };}
  api.rift_combat_resolve(Math.trunc(options.attackerPower||0),Math.trunc(options.attackerAccuracy||0),Math.trunc(options.defenderArmor||0),Math.trunc(options.defenderEvasion||0),Math.trunc(options.weaponMin||0),Math.trunc(options.weaponMax??options.weaponMin??0),Math.max(0,Math.min(1000,Math.trunc(options.critPermille||0))),Math.trunc(options.seed||0)>>>0);
  const r=new Int32Array(api.memory.buffer,api.rift_combat_result_ptr()>>>0,6);bridgeMetrics.combatResolves+=1;
  return { native:true, hit:Boolean(r[0]), damage:r[1], critical:Boolean(r[2]), hitRoll:r[3], damageRoll:r[4], seed:r[5]>>>0 };
}
`;
bridge = replaceOnce(bridge, `await initializeRiftWasmCore();`, bridgeApis + `\nawait initializeRiftWasmCore();`, 'browser v4 APIs');
bridge = bridge.replace("version: 'native-core-browser-v3'", "version: 'native-core-browser-v4'");
bridge = bridge.replace(`  createGridAccelerator: createRiftNativeGridAccelerator,\n  resetMetrics`, `  createGridAccelerator: createRiftNativeGridAccelerator,\n  spatialQuery: riftNativeSpatialQuery,\n  simulateAgents: riftNativeSimulateAgents,\n  resolveCombat: riftNativeResolveCombat,\n  resetMetrics`);
bridge = bridge.replace('window.RiftCityNativeCore = publicBridge;', 'window.RiftNativeCore = publicBridge;');
write('public/rift-wasm-core.js', bridge);

// ---------------------------------------------------------------------------
// Player controller uses whole native step when a complete RiftSectionGrid fits
// resident memory. The mature JS state machine remains the deterministic fallback.
// ---------------------------------------------------------------------------
let player = read('public/rift-player.js');
player = player.replace('// Native Core v3 keeps hot RiftSections resident in WASM. Player collision\n  // still owns its mature JS state machine, but repeated block-state probes no\n  // longer have to decode section coordinates and typed arrays on every sample.', '// Native Core v4 owns the whole hot physics step whenever the loaded RiftSectionGrid\n  // fits resident WASM memory. The mature JS state machine below remains the exact\n  // fallback for synthetic/oversized/non-resident worlds.');
const nativePlayerBranch = String.raw`
    // v4 performs horizontal sweep/step-up, support ownership, gravity, landing,
    // depenetration and the final no-solid-overlap invariant in one WASM call.
    // Synthetic test grids and oversized streamed worlds deliberately fall back
    // to the mature JavaScript solver below.
    if (!(creative && flying)) {
      const bounds = getWorldBounds?.();
      const nativeStep = nativeGrid.playerStep({
        position: pos,
        verticalVelocity: jumpVelocity,
        dx: vx * dt,
        dz: vz * dt,
        dt,
        radius: player.radius,
        height: player.height,
        stepUp: RIFT_PLAYER_STEP_UP,
        snapDown: RIFT_PLAYER_GROUND_SNAP_DOWN,
        gravity: 12.5,
        stepAssistY: stepAssist?.y,
        grounded,
        bounds
      });
      if (nativeStep.native) {
        if (Math.hypot(vx, vz) > .01) targetFacing = Math.atan2(vx, vz);
        if (nativeStep.recovery) {
          recoverToSafeGround('native-solid-penetration-invariant');
          return;
        }
        grounded = nativeStep.grounded;
        jumpVelocity = nativeStep.verticalVelocity;
        stepAssist = nativeStep.stepAssistY == null ? null : { y: nativeStep.stepAssistY };
        const turnSin = Math.sin(targetFacing - player.facing);
        const turnCos = Math.cos(targetFacing - player.facing);
        if (Math.hypot(vx, vz) > .01) player.setFacingRadians(player.facing + Math.atan2(turnSin, turnCos) * Math.min(1, dt * 10));
        player.setPosition(...nativeStep.position);
        if (grounded) rememberSafeGrounded(...nativeStep.position);
        return;
      }
    }
`;
player = replaceOnce(player, `    let nextX = pos[0], nextY = pos[1], nextZ = pos[2];\n\n    if (creative && flying) {`, `    let nextX = pos[0], nextY = pos[1], nextZ = pos[2];\n${nativePlayerBranch}\n    if (creative && flying) {`, 'native player step branch');
write('public/rift-player.js', player);

// ---------------------------------------------------------------------------
// Block section comments now describe v4 partial-shape native path.
// ---------------------------------------------------------------------------
let sections = read('public/rift-block-section.js');
sections = sections.replace('// Native Core v3 owns the full-block fast path end-to-end: persistent\n    // section residency, cross-section border culling, vertex/normal/material\n    // emission and index generation. Dynamic face classifiers and partial\n    // shapes deliberately fall through to the proven JavaScript pipeline.', '// Native Core v4 owns static-color full/slab/stair section meshing end-to-end:\n    // persistent residency, micro-occlusion, cross-section culling and indexed\n    // geometry emission. Dynamic face classifiers deliberately keep the JS path.');
sections = sections.replace('// If v3 intentionally declines the mesh (partial shape, dynamic face color,\n    // or unavailable WASM), its compact compatibility culler still preserves the', '// If v4 intentionally declines the mesh (dynamic face classification/color or\n    // unavailable/unknown future WASM shape), its compatibility culler preserves the');
write('public/rift-block-section.js', sections);

// ---------------------------------------------------------------------------
// Cloudflare bridge v4 exposes the same deterministic gameplay kernels.
// ---------------------------------------------------------------------------
const serverBridge = `// Rift Native Core Cloudflare bridge v4.\n// Wrangler bundles the same C++ WASM binary used by Safari/Chromium. Request and\n// storage I/O stay JavaScript; deterministic hot gameplay kernels are shared.\nimport riftCoreModule from './wasm/rift-core.wasm';\n\nconst instance = new WebAssembly.Instance(riftCoreModule, {});\nconst api = instance.exports;\n\nif (api.rift_core_version?.() !== 4) throw new Error('Ironvale Worker native core version mismatch.');\nif (api.rift_section_index?.(15,15,15) !== 4095 || api.rift_floor_div?.(-17,16) !== -2 || (api.rift_section_slot_capacity?.()||0) < 16 || !api.rift_player_step_world || !api.rift_pathfind_world || !api.rift_spatial_query_sphere || !api.rift_combat_resolve) throw new Error('Ironvale Worker native core v4 self-test failed.');\n\nexport const RIFT_SERVER_NATIVE_CORE = Object.freeze({\n  version: api.rift_core_version(), wasm: true, memoryBytes: api.memory?.buffer?.byteLength || 0,\n  sectionSlotCapacity: api.rift_section_slot_capacity(), batchCapacity: api.rift_batch_capacity(),\n  sectionIndex: (x,y,z) => api.rift_section_index(x,y,z), floorDiv: (v,d) => api.rift_floor_div(v,d), positiveMod: (v,d) => api.rift_positive_mod(v,d),\n  aabbIntersects: (...args) => api.rift_aabb_intersects(...args) === 1, distanceSq3: (...args) => api.rift_distance_sq3(...args), hash3: (x,y,z,seed=0) => api.rift_hash3(x,y,z,seed) >>> 0,\n  crossedSupport: (...args) => api.rift_crossed_support(...args) === 1, groundStepCode: (...args) => api.rift_ground_step_classify(...args), stairTop: (...args) => api.rift_stair_top(...args), shapeTop: (...args) => api.rift_shape_top(...args), stateShapeTop: (...args) => api.rift_state_shape_top(...args),\n  resolveCombat(options={}) { api.rift_combat_resolve(Math.trunc(options.attackerPower||0),Math.trunc(options.attackerAccuracy||0),Math.trunc(options.defenderArmor||0),Math.trunc(options.defenderEvasion||0),Math.trunc(options.weaponMin||0),Math.trunc(options.weaponMax??options.weaponMin??0),Math.max(0,Math.min(1000,Math.trunc(options.critPermille||0))),Math.trunc(options.seed||0)>>>0); const r=new Int32Array(api.memory.buffer,api.rift_combat_result_ptr()>>>0,6); return { hit:Boolean(r[0]),damage:r[1],critical:Boolean(r[2]),hitRoll:r[3],damageRoll:r[4],seed:r[5]>>>0 }; },\n  get metrics() { return Object.freeze({ meshBuilds:api.rift_metric_mesh_builds()>>>0,facesEmitted:api.rift_metric_faces_emitted()>>>0,batchCalls:api.rift_metric_batch_calls()>>>0,batchCells:api.rift_metric_batch_cells()>>>0,raycasts:api.rift_metric_raycasts()>>>0,raycastSteps:api.rift_metric_raycast_steps()>>>0,playerSteps:api.rift_metric_player_steps()>>>0,collisionProbes:api.rift_metric_collision_probes()>>>0,mutations:api.rift_metric_mutations()>>>0,pathfinds:api.rift_metric_pathfinds()>>>0,pathNodes:api.rift_metric_path_nodes()>>>0,spatialQueries:api.rift_metric_spatial_queries()>>>0,agentSteps:api.rift_metric_agent_steps()>>>0,combatResolves:api.rift_metric_combat_resolves()>>>0 }); }\n});\n\nglobalThis.__RIFT_SERVER_NATIVE_CORE__ = RIFT_SERVER_NATIVE_CORE;\n`;
write('src/rift-wasm-core.js', serverBridge);

// ---------------------------------------------------------------------------
// Permanent compiler workflow exports v4 ABI.
// ---------------------------------------------------------------------------
let wasmWorkflow = read('.github/workflows/rift-wasm-core.yml');
const exportAnchor = `            -Wl,--export=rift_raycast_world \\\n`;
const extraExports = `            -Wl,--export=rift_raycast_world \\\n            -Wl,--export=rift_mesh_partial_block_count \\\n            -Wl,--export=rift_mesh_occupied_microvoxels \\\n            -Wl,--export=rift_mesh_visible_microfaces \\\n            -Wl,--export=rift_mesh_culled_microfaces \\\n            -Wl,--export=rift_set_block_world \\\n            -Wl,--export=rift_batch_mutate_world \\\n            -Wl,--export=rift_player_result_ptr \\\n            -Wl,--export=rift_player_flags_ptr \\\n            -Wl,--export=rift_player_step_world \\\n            -Wl,--export=rift_spatial_capacity \\\n            -Wl,--export=rift_spatial_entities_ptr \\\n            -Wl,--export=rift_spatial_meta_ptr \\\n            -Wl,--export=rift_spatial_results_ptr \\\n            -Wl,--export=rift_spatial_query_sphere \\\n            -Wl,--export=rift_agent_capacity \\\n            -Wl,--export=rift_agent_data_ptr \\\n            -Wl,--export=rift_simulate_agents \\\n            -Wl,--export=rift_path_point_capacity \\\n            -Wl,--export=rift_path_points_ptr \\\n            -Wl,--export=rift_pathfind_world \\\n            -Wl,--export=rift_combat_result_ptr \\\n            -Wl,--export=rift_combat_resolve \\\n`;
wasmWorkflow = replaceOnce(wasmWorkflow, exportAnchor, extraExports, 'v4 compiler exports anchor');
const metricAnchor = `            -Wl,--export=rift_metric_raycast_steps \\\n`;
wasmWorkflow = replaceOnce(wasmWorkflow, metricAnchor, `            -Wl,--export=rift_metric_raycast_steps \\\n            -Wl,--export=rift_metric_player_steps \\\n            -Wl,--export=rift_metric_collision_probes \\\n            -Wl,--export=rift_metric_mutations \\\n            -Wl,--export=rift_metric_pathfinds \\\n            -Wl,--export=rift_metric_path_nodes \\\n            -Wl,--export=rift_metric_spatial_queries \\\n            -Wl,--export=rift_metric_agent_steps \\\n            -Wl,--export=rift_metric_combat_resolves \\\n`, 'v4 metric compiler exports');
wasmWorkflow = wasmWorkflow.replace('Checkout RiftCity', 'Checkout Ironvale');
write('.github/workflows/rift-wasm-core.yml', wasmWorkflow);

let preview = read('.github/workflows/rift-world-preview.yml');
preview = preview.replace('data-rift-native-core-version="3"', 'data-rift-native-core-version="4"').replaceAll('Checkout RiftCity','Checkout Ironvale').replaceAll('static RiftCity server','static Ironvale server');
write('.github/workflows/rift-world-preview.yml', preview);

// ---------------------------------------------------------------------------
// v4 verification
// ---------------------------------------------------------------------------
let wasmCheck = read('scripts/check-rift-wasm-core.js');
wasmCheck = wasmCheck.replace("api.rift_core_version?.() === 3", "api.rift_core_version?.() === 4").replaceAll('native v3','native v4').replace('C++ core v${api.rift_core_version()} · persistent sections + native meshes + batch queries + DDA raycast verified.', 'C++ core v${api.rift_core_version()} · shape meshes + physics + path/spatial/agent/combat kernels verified.');
wasmCheck = wasmCheck.replace(`  // Partial shapes reject the native full-block mesh and preserve JS fallback semantics.\n  slotStates.fill(0);\n  slotStates[index(4,4,4)] = 1 | (1 << 8);\n  borders.fill(0);\n  ok(api.rift_build_section_mesh(slot) === -1, 'partial-shape native mesh guard mismatch');`, `  // v4 emits partial shapes natively with the same merged half-meter geometry contract.\n  slotStates.fill(0);\n  slotStates[index(4,4,4)] = 1 | (1 << 8);\n  borders.fill(0);\n  ok(api.rift_build_section_mesh(slot) === 6, 'bottom-slab native mesh quad count mismatch');\n  ok(api.rift_mesh_partial_block_count() === 1 && api.rift_mesh_occupied_microvoxels() === 4, 'partial mesh diagnostics mismatch');\n  slotStates.fill(0);\n  slotStates[index(4,4,4)] = 1 | (3 << 8) | (1 << 11);\n  ok(api.rift_build_section_mesh(slot) === 10, 'east-stair native mesh quad count mismatch');`);
write('scripts/check-rift-wasm-core.js', wasmCheck);

let integration = read('scripts/check-rift-native-integration.js');
integration = integration.replace('status.wasm && status.version === 3', 'status.wasm && status.version === 4').replace('native v3:', 'native v4:');
integration = integration.replace(`// Partial shape sections preserve the established shape-aware JavaScript geometry path.\nconst slab = new RiftBlockSection();\nslab.setBlock(2, 2, 2, encodeRiftBlockState({ material: 1, shape: RIFT_BLOCK_SHAPES.bottomSlab }));\nconst slabGeometry = slab.buildGeometry();\nok(slabGeometry.shapeAware === true && slabGeometry.nativeMesh !== true,\n  'partial-shape section failed to preserve shape-aware JS geometry path');`, `// v4 routes static-color slabs/stairs through native shape-aware micro-occlusion.\nconst slab = new RiftBlockSection();\nslab.setBlock(2, 2, 2, encodeRiftBlockState({ material: 1, shape: RIFT_BLOCK_SHAPES.bottomSlab }));\nconst slabGeometry = slab.buildGeometry();\nok(slabGeometry.shapeAware === true && slabGeometry.nativeMesh === true && slabGeometry.visibleFaces === 6,\n  'partial-shape section did not use native shape-aware mesh path');`);
integration = integration.replace('C++ v3 owns resident RiftSections, full-block mesh emission, cross-section borders, batched world queries and creative-mode DDA raycasts; partial/dynamic paths remain safe in JS.', 'C++ v4 owns resident RiftSections, full/slab/stair mesh emission, world queries, player-step/path/spatial gameplay kernels and creative DDA; dynamic face-classified rendering remains safely in JS.');
write('scripts/check-rift-native-integration.js', integration);

const v4Check = `import assert from 'node:assert/strict';\nimport { createRiftNativeGridAccelerator, getRiftNativeCoreStatus, riftNativeResolveCombat, riftNativeSimulateAgents, riftNativeSpatialQuery } from '../public/rift-wasm-core.js';\nimport { RiftBlockSection, RiftSectionGrid, RIFT_SECTION_SOLID } from '../public/rift-block-section.js';\nimport { encodeRiftBlockState, RIFT_BLOCK_SHAPES, RIFT_BLOCK_ROTATIONS } from '../public/rift-block-shapes.js';\n\nconst status=getRiftNativeCoreStatus();\nassert.equal(status.wasm,true);assert.equal(status.version,4);\nconst grid=new RiftSectionGrid();const section=grid.addSection(new RiftBlockSection({sx:0,sy:0,sz:0}));section.fillBox(0,0,0,15,0,15,RIFT_SECTION_SOLID);\nconst accelerator=createRiftNativeGridAccelerator(()=>grid);\nassert.equal(accelerator.syncAll(),true);\nconst step=accelerator.playerStep({position:[2,1,2],verticalVelocity:0,dx:.1,dz:0,dt:1/120,radius:.28,height:1.8,stepUp:.58,snapDown:.72,gravity:12.5,grounded:true,bounds:{min:[0,0,0],max:[15,15,15]}});\nassert.equal(step.native,true);assert.equal(step.grounded,true);assert.ok(step.position[0]>2);assert.ok(Math.abs(step.position[1]-1)<1e-4);\nconst path=accelerator.findPath([1,1,1],[8,1,8],{maxNodes:2048});assert.equal(path.native,true);assert.ok(path.points.length>1);\nconst mutate=accelerator.setBlockWorld(5,1,5,RIFT_SECTION_SOLID);assert.equal(mutate.changed,true);assert.equal(accelerator.getBlockWorld(5,1,5),RIFT_SECTION_SOLID);\nconst ids=riftNativeSpatialQuery([{id:10,x:0,y:0,z:0,radius:.2,mask:1},{id:20,x:20,y:0,z:0,radius:.2,mask:1}],[0,0,0],2,1);assert.deepEqual(ids,[10]);\nconst agents=riftNativeSimulateAgents([{id:1,x:0,y:0,z:0,target:[10,0,0],speed:2,radius:.3}],.5);assert.ok(agents[0].x>.9&&agents[0].x<1.1);\nconst combat=riftNativeResolveCombat({attackerPower:10,attackerAccuracy:20,defenderArmor:4,defenderEvasion:5,weaponMin:3,weaponMax:7,critPermille:100,seed:12345});assert.equal(combat.native,true);assert.ok(combat.damage>=0);\nconst slab=new RiftBlockSection();slab.setBlock(1,1,1,encodeRiftBlockState({material:1,shape:RIFT_BLOCK_SHAPES.bottomSlab}));const slabMesh=slab.buildGeometry();assert.equal(slabMesh.nativeMesh,true);assert.equal(slabMesh.shapeAware,true);assert.equal(slabMesh.visibleFaces,6);\nconst stair=new RiftBlockSection();stair.setBlock(1,1,1,encodeRiftBlockState({material:1,shape:RIFT_BLOCK_SHAPES.stair,rotation:RIFT_BLOCK_ROTATIONS.east}));const stairMesh=stair.buildGeometry();assert.equal(stairMesh.nativeMesh,true);assert.equal(stairMesh.visibleFaces,10);\naccelerator.dispose();\nconsole.log('[rift-native-v4] PASS · whole-step physics, partial meshing, resident mutation, A*, spatial/agent and combat kernels execute in C++/WASM.');\n`;
write('scripts/check-rift-native-v4.js', v4Check);

let pkg = JSON.parse(read('package.json'));
pkg.scripts['verify:native-v4'] = 'node scripts/check-rift-native-v4.js';
pkg.scripts.build = pkg.scripts.build.replace('npm run verify:native-integration', 'npm run verify:native-integration && npm run verify:native-v4');
write('package.json', JSON.stringify(pkg, null, 2) + '\n');

console.log('[native-v4-converter] staged Native Core v4 source conversion.');
