import React from "react";
import { GameIcon } from "../../components/GameIcon";
import { ItemImage } from "../../components/ItemImage";
import { getItem } from "../../data/items";

export function CrimeRequiredItems({ ids, inventory }:{ ids:string[]|undefined; inventory:Record<string,number> }) {
  if(!ids?.length) return null;
  return <div className="crime-required-items">{ids.map((id)=>{
    const item=getItem(id); const owned=inventory[id]||0;
    return <span key={id} className={owned>0?"owned":"missing"}><ItemImage itemId={id} size={28}/><span>{item?.name??id} · {owned}</span>{owned<=0?<GameIcon name="lock" size={11}/>:null}</span>;
  })}</div>;
}
