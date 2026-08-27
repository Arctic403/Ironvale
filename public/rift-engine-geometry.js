function geometry(vertices, indices) {
  return {
    vertices: new Float32Array(vertices),
    indices: new Uint16Array(indices)
  };
}

export function createBoxGeometry() {
  const v = [];
  const i = [];
  const faces = [
    [[-0.5,-0.5, 0.5],[ 0.5,-0.5, 0.5],[ 0.5, 0.5, 0.5],[-0.5, 0.5, 0.5],[0,0,1]],
    [[ 0.5,-0.5,-0.5],[-0.5,-0.5,-0.5],[-0.5, 0.5,-0.5],[ 0.5, 0.5,-0.5],[0,0,-1]],
    [[-0.5, 0.5, 0.5],[ 0.5, 0.5, 0.5],[ 0.5, 0.5,-0.5],[-0.5, 0.5,-0.5],[0,1,0]],
    [[-0.5,-0.5,-0.5],[ 0.5,-0.5,-0.5],[ 0.5,-0.5, 0.5],[-0.5,-0.5, 0.5],[0,-1,0]],
    [[ 0.5,-0.5, 0.5],[ 0.5,-0.5,-0.5],[ 0.5, 0.5,-0.5],[ 0.5, 0.5, 0.5],[1,0,0]],
    [[-0.5,-0.5,-0.5],[-0.5,-0.5, 0.5],[-0.5, 0.5, 0.5],[-0.5, 0.5,-0.5],[-1,0,0]]
  ];
  for (const [a,b,c,d,n] of faces) {
    const base = v.length / 6;
    for (const p of [a,b,c,d]) v.push(...p, ...n);
    i.push(base,base+1,base+2, base,base+2,base+3);
  }
  return geometry(v, i);
}

export function createCylinderGeometry(segments = 8) {
  const v = [];
  const i = [];
  const half = 0.5;
  for (let s = 0; s < segments; s++) {
    const a0 = s / segments * Math.PI * 2;
    const a1 = (s + 1) / segments * Math.PI * 2;
    const x0 = Math.cos(a0) * 0.5, z0 = Math.sin(a0) * 0.5;
    const x1 = Math.cos(a1) * 0.5, z1 = Math.sin(a1) * 0.5;
    const base = v.length / 6;
    v.push(x0,-half,z0, Math.cos(a0),0,Math.sin(a0));
    v.push(x1,-half,z1, Math.cos(a1),0,Math.sin(a1));
    v.push(x1, half,z1, Math.cos(a1),0,Math.sin(a1));
    v.push(x0, half,z0, Math.cos(a0),0,Math.sin(a0));
    i.push(base,base+1,base+2, base,base+2,base+3);
  }
  const topCenter = v.length / 6;
  v.push(0,half,0, 0,1,0);
  const bottomCenter = v.length / 6;
  v.push(0,-half,0, 0,-1,0);
  for (let s = 0; s < segments; s++) {
    const a0 = s / segments * Math.PI * 2;
    const a1 = (s + 1) / segments * Math.PI * 2;
    const x0 = Math.cos(a0) * 0.5, z0 = Math.sin(a0) * 0.5;
    const x1 = Math.cos(a1) * 0.5, z1 = Math.sin(a1) * 0.5;
    let base = v.length / 6;
    v.push(x0,half,z0,0,1,0, x1,half,z1,0,1,0);
    i.push(topCenter,base,base+1);
    base = v.length / 6;
    v.push(x1,-half,z1,0,-1,0, x0,-half,z0,0,-1,0);
    i.push(bottomCenter,base,base+1);
  }
  return geometry(v, i);
}

export function createSphereGeometry(segments = 10, rings = 6) {
  const v = [];
  const i = [];
  for (let y = 0; y <= rings; y++) {
    const vv = y / rings;
    const phi = vv * Math.PI;
    const sy = Math.cos(phi) * 0.5;
    const ringR = Math.sin(phi) * 0.5;
    for (let x = 0; x <= segments; x++) {
      const uu = x / segments;
      const theta = uu * Math.PI * 2;
      const sx = Math.cos(theta) * ringR;
      const sz = Math.sin(theta) * ringR;
      const length = Math.hypot(sx, sy, sz) || 1;
      v.push(sx,sy,sz, sx/length,sy/length,sz/length);
    }
  }
  const stride = segments + 1;
  for (let y = 0; y < rings; y++) {
    for (let x = 0; x < segments; x++) {
      const a = y * stride + x;
      const b = a + stride;
      i.push(a,b,a+1, b,b+1,a+1);
    }
  }
  return geometry(v, i);
}
