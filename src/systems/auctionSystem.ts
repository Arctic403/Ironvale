import type { AuctionListing } from "../types/riftCity";

export const SEEDED_LISTINGS: AuctionListing[] = [
  { id:"seed-neon-1", itemId:"neon-dust", seller:"MaraV", price:1850, quantity:2, createdAt:1 },
  { id:"seed-chip-1", itemId:"encrypted-chip", seller:"ByteRunner", price:3400, quantity:1, createdAt:2 },
  { id:"seed-envelope-1", itemId:"black-envelope", seller:"NoSignal", price:575, quantity:3, createdAt:3 },
  { id:"seed-token-1", itemId:"old-city-token", seller:"Archivist", price:7800, quantity:1, createdAt:4 },
];

export function listingFee(price:number, quantity:number){
  return Math.max(25, Math.floor(Math.max(1, price) * Math.max(1, quantity) * 0.03));
}
