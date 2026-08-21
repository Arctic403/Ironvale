import type { AuctionListing } from "../types/riftCity";
import { ITEMS } from "../data/items";

export const SEEDED_LISTINGS: AuctionListing[] = [
  { id:"seed-neon-1", itemId:"neon-dust", seller:"MaraV", price:1850, quantity:2, createdAt:1 },
  { id:"seed-chip-1", itemId:"encrypted-chip", seller:"ByteRunner", price:3400, quantity:1, createdAt:2 },
  { id:"seed-envelope-1", itemId:"black-envelope", seller:"NoSignal", price:575, quantity:3, createdAt:3 },
  { id:"seed-token-1", itemId:"old-city-token", seller:"Archivist", price:7800, quantity:1, createdAt:4 },
];

const NPC_NAMES=["Ghostline","MaraV","NoSignal","ByteRunner","DockRat","Northside","NightShift","ColdWire","Rook","Redline","ZeroDay","Static","HarborKing","Minty","SouthBlock","Drift","Kite","Cipher","Brick","Nova","WestEnd","Ash","Dealer42","GlassFox"];
const TRADEABLE_IDS=["weed","speed","ecstasy","xanax","cocaine","meth","heroin","lsd","ketamine","neon-dust","rift-tabs","black-envelope","encrypted-chip","thin-gloves","burner-phone","disguise-kit","lock-bypass","signal-jammer","forged-badge","escape-route","inside-tip","plant-material","chemical-pack-a","chemical-pack-b","tablet-base","lab-catalyst","packaging-kit"];

function seeded01(n:number){
  const x=Math.sin(n*999.91+78.233)*43758.5453;
  return x-Math.floor(x);
}

export const SIMULATED_LISTINGS:AuctionListing[]=Array.from({length:180},(_,i)=>{
  const itemId=TRADEABLE_IDS[Math.floor(seeded01(i+2)*TRADEABLE_IDS.length)];
  const item=ITEMS.find(x=>x.id===itemId)!;
  const base=Math.max(40,item.sellValue??item.price??500);
  const price=Math.max(25,Math.round(base*(.72+seeded01(i+11)*.9)));
  const quantity=1+Math.floor(seeded01(i+27)*Math.max(2,item.contraband?7:12));
  return {id:`sim-${i.toString().padStart(3,"0")}`,itemId,seller:NPC_NAMES[Math.floor(seeded01(i+43)*NPC_NAMES.length)],price,quantity,createdAt:100+i};
});

export const ALL_NPC_LISTINGS=[...SEEDED_LISTINGS,...SIMULATED_LISTINGS];

export const BLACK_MARKET_STATS={
  traders:1248,
  trades24h:4821,
  volume24h:18400000,
  activeListings:ALL_NPC_LISTINGS.length+763,
};


export const BETA_NPC_QUICK_SELL_MULTIPLIER=1.5;
export const BETA_NPC_AUTO_BUY_MAX_MULTIPLIER=4;

export function blackMarketReferenceValue(itemId:string){
  const item=ITEMS.find(x=>x.id===itemId);
  if(!item) return 0;
  return Math.max(25, Math.floor(item.sellValue ?? (item.price>0 ? item.price*.6 : 100)));
}

export function betaNpcQuickSellPrice(itemId:string){
  return Math.max(1, Math.floor(blackMarketReferenceValue(itemId)*BETA_NPC_QUICK_SELL_MULTIPLIER));
}

export function betaNpcAutoBuyCeiling(itemId:string){
  return Math.max(1, Math.floor(blackMarketReferenceValue(itemId)*BETA_NPC_AUTO_BUY_MAX_MULTIPLIER));
}

export function betaNpcSuggestedListingPrice(itemId:string){
  return Math.max(1, Math.floor(blackMarketReferenceValue(itemId)*1.75));
}

export function listingFee(price:number, quantity:number){
  return Math.max(25, Math.floor(Math.max(1, price) * Math.max(1, quantity) * 0.03));
}
