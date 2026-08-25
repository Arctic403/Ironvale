const aliases = {
  overview:'character',
  progression:'achievements',
  awards:'achievements',
  property:'properties',
  nightclub:'nightclub',
  police:'police',
  park:'park',
  downtown:'downtown',
  'black-market':'auction',
  bank:'bank',
  market:'market',
  combat:'combat',
  gym:'gym',
  jobs:'jobs',
  missions:'missions',
  education:'education',
  faction:'factions',
  travel:'travel',
  airport:'travel',
  production:'production',
  casino:'casino',
  hospital:'status',
  jail:'status',
  pharmacy:'shop',
  shops:'shop'
};

export function parseRoute() {
  const raw=(location.hash||'#character').slice(1);
  const [path, query=''] = raw.split('?');
  const parts=path.split('/').filter(Boolean);
  if (!parts.length) return {name:'character',params:{},query:new URLSearchParams(query)};
  if (parts[0]==='city' && parts[1]==='place' && parts[2]) return {name:'location',params:{id:decodeURIComponent(parts.slice(2).join('/'))},query:new URLSearchParams(query)};
  if (parts[0]==='service' && parts[1]) return {name:'service',params:{service:decodeURIComponent(parts[1])},query:new URLSearchParams(query)};
  const name=aliases[parts[0]]||parts[0];
  return {name,params:{},query:new URLSearchParams(query)};
}

export function go(route) {
  location.hash = route.startsWith('#') ? route : `#${route}`;
}

export function serviceRoute(service, query={}) {
  const params=new URLSearchParams();
  Object.entries(query).forEach(([k,v])=>v!=null&&params.set(k,v));
  return `#service/${encodeURIComponent(service)}${params.size?`?${params}`:''}`;
}
