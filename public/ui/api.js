export async function api(path, options={}) {
  try {
    const response = await fetch(path, { credentials:'same-origin', ...options });
    const data = await response.json().catch(()=>({}));
    return { ...data, ok: response.ok && data.ok !== false, status: response.status };
  } catch {
    return { ok:false, error:'Could not reach the RiftCity server', status:0 };
  }
}

export const getService = (service, params='') => api(`/api/services/${encodeURIComponent(service)}${params}`);
export const postService = (service, body) => api(`/api/services/${encodeURIComponent(service)}`, {
  method:'POST',
  headers:{'Content-Type':'application/json'},
  body:JSON.stringify(body)
});
