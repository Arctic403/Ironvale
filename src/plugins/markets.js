export const MARKET_ASSETS = Object.freeze([
 {id:'rc-logistics',symbol:'RCL',name:'RiftCity Logistics',basePrice:42,volatility:.08},
 {id:'forge-industries',symbol:'FGI',name:'Forge Industries',basePrice:78,volatility:.11},
 {id:'neon-systems',symbol:'NEON',name:'Neon Systems',basePrice:115,volatility:.16},
 {id:'harbor-energy',symbol:'HBE',name:'Harbor Energy',basePrice:64,volatility:.09}
]);
export const getMarketAsset=id=>MARKET_ASSETS.find(asset=>asset.id===id)||null;
export function getMarketPrice(asset, now=Date.now()){
 const bucket=Math.floor(now/(5*60*1000));
 let hash=2166136261;
 for(const ch of `${asset.id}:${bucket}`){hash^=ch.charCodeAt(0);hash=Math.imul(hash,16777619);}
 const normalized=((hash>>>0)%10000)/9999;
 const wave=(normalized-.5)*2*asset.volatility;
 return Math.max(1,Math.round(asset.basePrice*(1+wave)));
}
