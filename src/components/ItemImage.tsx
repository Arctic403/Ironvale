import React, { useState } from "react";
import { GameIcon, type GameIconName } from "./GameIcon";
import { getItem } from "../data/items";

export function itemArtPath(itemId: string) {
  return `/assets/items/${itemId}.webp`;
}

export function ItemImage({
  itemId,
  size = 64,
  className = "",
  fallback = "package",
  title,
  bare = false,
}: {
  itemId: string;
  size?: number;
  className?: string;
  fallback?: GameIconName;
  title?: string;
  bare?: boolean;
}) {
  const item = getItem(itemId);
  const [failed, setFailed] = useState(false);
  const rarity = (item?.rarity ?? "Common").toLowerCase();
  const label = title ?? item?.name ?? itemId;

  return (
    <span
      className={`rift-item-art rarity-${rarity} ${bare ? "bare" : "framed"} ${className}`.trim()}
      style={{ "--item-art-size": `${size}px` } as React.CSSProperties}
      title={label}
      aria-label={label}
    >
      {!failed && item ? (
        <img
          src={itemArtPath(itemId)}
          alt=""
          draggable={false}
          loading="lazy"
          onError={() => setFailed(true)}
        />
      ) : (
        <GameIcon name={fallback} size={Math.max(14, Math.round(size * 0.45))} />
      )}
    </span>
  );
}
