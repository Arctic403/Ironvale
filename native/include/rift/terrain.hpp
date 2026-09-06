#pragma once

extern "C" {
int rift_core_version();
int rift_terrain_init(int columns, int rows, float sampleSpacing, float originX, float originZ, float baseHeight, float maxWalkSlope);
int rift_terrain_columns();
int rift_terrain_rows();
int rift_terrain_sample_count();
int rift_terrain_cell_count();
unsigned int rift_terrain_heights_ptr();
unsigned int rift_terrain_delta_ptr();
unsigned int rift_terrain_holes_ptr();
void rift_terrain_reset_flat();
int rift_terrain_generate_island(int seed, float waterLevel, float coastWidth, float landHeight, float hillHeight, float mountainHeight, float roughness);
void rift_terrain_rebuild_from_delta();
float rift_terrain_sample_height(float x, float z);
int rift_terrain_sample_normal(float x, float z);
unsigned int rift_terrain_normal_ptr();
float rift_terrain_slope_at(float x, float z);
int rift_terrain_walkable_at(float x, float z);
int rift_terrain_is_manual_hole_at(float x, float z);
int rift_terrain_apply_brush(int mode, float x, float z, float radius, float strength, float targetHeight);
int rift_terrain_build_chunk(int chunkX, int chunkZ, float chunkSize, int lod);
int rift_terrain_build_section(int sectionX, int sectionZ, float sectionSize, int lod,
                               int northLod, int eastLod, int southLod, int westLod);
unsigned int rift_mesh_vertices_ptr();
int rift_mesh_vertex_float_count();
unsigned int rift_mesh_indices_ptr();
int rift_mesh_index_count();
int rift_terrain_raycast(float ox, float oy, float oz, float dx, float dy, float dz, float maxDistance, float step);
unsigned int rift_raycast_ptr();
}
