import React from "react";

export type GameIconName =
  | "menu" | "log" | "health" | "energy" | "nerve" | "happy" | "bank" | "heat" | "points" | "merit"
  | "character" | "city" | "crimes" | "combat" | "gym" | "jobs" | "inventory" | "shops" | "missions"
  | "education" | "property" | "market" | "faction" | "awards" | "progression" | "lock" | "hospital"
  | "weapon" | "blade" | "blunt" | "handgun" | "smg" | "shotgun" | "rifle" | "cash" | "walk" | "target"
  | "warning" | "gift" | "bot" | "phone" | "disguise" | "tools" | "shield" | "info" | "lab" | "garage" | "warehouse"
  | "police" | "pharmacy" | "park" | "airport" | "pin" | "casino" | "dice" | "music" | "headphones" | "spark" | "crown" | "car" | "mine" | "horse"
  | "armor" | "medkit" | "drink" | "focus" | "candy" | "contraband" | "chip" | "key" | "envelope" | "gloves" | "badge" | "route" | "chemical" | "package" | "plant" | "book" | "building";

const paths: Partial<Record<GameIconName, React.ReactNode>> = {
  menu: <><path d="M4 6h16M4 12h16M4 18h16"/></>,
  log: <><path d="M6 3h9l3 3v15H6z"/><path d="M9 9h6M9 13h6M9 17h4"/></>,
  health: <><path d="M12 21s-7-4.4-9.2-8.4C.9 9.3 2.6 5 6.7 5c2.1 0 3.6 1.1 5.3 3 1.7-1.9 3.2-3 5.3-3 4.1 0 5.8 4.3 3.9 7.6C19 16.6 12 21 12 21z"/></>,
  energy: <><path d="M13 2 5 14h6l-1 8 9-13h-6z"/></>,
  nerve: <><path d="M13 2c2 4-1 5 2 8 1.4-1 2.2-2.1 2.4-3.4C20 9 21 11.3 21 14a9 9 0 1 1-18 0c0-3.1 1.8-6.1 5-8-.2 2.3.6 4 2.2 5.2C13.2 9.5 11.2 6 13 2z"/></>,
  happy: <><circle cx="12" cy="12" r="9"/><path d="M8.5 10h.01M15.5 10h.01M8.5 14c1.8 2 5.2 2 7 0"/></>,
  bank: <><path d="M3 9h18L12 3zM5 9v9M9 9v9M15 9v9M19 9v9M3 21h18"/></>,
  heat: <><path d="M10 14.5V5a2 2 0 1 1 4 0v9.5a4 4 0 1 1-4 0z"/><path d="M12 8v8"/></>,
  points: <><path d="m12 2 3 6 6.5.9-4.7 4.6 1.1 6.5-5.9-3.1L6.1 20l1.1-6.5-4.7-4.6L9 8z"/></>,
  merit: <><circle cx="12" cy="9" r="5"/><path d="m9 14-2 8 5-3 5 3-2-8"/></>,
  character: <><circle cx="12" cy="8" r="4"/><path d="M4 21c.8-5 3.5-7 8-7s7.2 2 8 7"/></>,
  city: <><path d="M3 21V8h6v13M9 21V3h7v18M16 21v-9h5v9M6 11h.01M6 15h.01M12 7h.01M12 11h.01M12 15h.01M19 15h.01"/></>,
  crimes: <><path d="M4 9h16l-2 11H6zM8 9V6a4 4 0 0 1 8 0v3"/><path d="M9 14h6"/></>,
  combat: <><path d="m4 20 6-6M14 10l6-6M13 11l-8-8M11 13l8 8M15 5l4 4M5 15l4 4"/></>,
  gym: <><path d="M3 10v4M6 8v8M9 11h6M18 8v8M21 10v4"/></>,
  jobs: <><rect x="3" y="7" width="18" height="13" rx="2"/><path d="M9 7V4h6v3M3 12h18M10 12v2h4v-2"/></>,
  inventory: <><path d="M5 8h14l1 13H4zM8 8V6a4 4 0 0 1 8 0v2"/></>,
  shops: <><path d="M4 10h16l-1 11H5zM3 10l2-6h14l2 6M8 14v7M16 14v7"/></>,
  missions: <><path d="M6 3h12v18H6zM9 7h6M9 11h6M9 15h4"/><path d="m14 17 1.5 1.5L19 15"/></>,
  education: <><path d="m2 9 10-5 10 5-10 5zM6 11v5c3 2 9 2 12 0v-5M21 10v6"/></>,
  property: <><path d="m3 11 9-8 9 8v10h-6v-6H9v6H3z"/></>,
  market: <><path d="M4 20V5M4 20h17M7 16l4-5 3 2 5-7"/><path d="M16 6h3v3"/></>,
  faction: <><path d="M12 3 4 6v6c0 5 3 8 8 10 5-2 8-5 8-10V6z"/><path d="m8 12 3 3 5-6"/></>,
  awards: <><path d="M8 3h8v5a4 4 0 0 1-8 0zM8 5H4v2c0 3 2 4 5 4M16 5h4v2c0 3-2 4-5 4M12 12v5M8 21h8M9 17h6"/></>,
  progression: <><circle cx="6" cy="18" r="2"/><circle cx="12" cy="12" r="2"/><circle cx="18" cy="6" r="2"/><path d="m7.5 16.5 3-3M13.5 10.5l3-3"/></>,
  lock: <><rect x="5" y="10" width="14" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3M12 14v3"/></>,
  hospital: <><path d="M4 4h16v16H4zM12 7v10M7 12h10"/></>,
  weapon: <><path d="M4 20 17 7M14 5l5-2 2 2-2 5M8 16l-2 5M10 14l4 4"/></>,
  blade: <><path d="M4 20 17 7M14 5l5-2 2 2-2 5M4 20l4-1-3-3z"/></>,
  blunt: <><path d="M5 20 15 10M13 4l7 7-4 4-7-7z"/></>,
  handgun: <><path d="M4 8h12l4 3-2 3h-7l-1 6H6l1-6H4z"/></>,
  smg: <><path d="M3 8h14l4 3-2 3h-6l1 6h-4l-2-6H3zM8 8V5h5v3"/></>,
  shotgun: <><path d="M3 10h15l3 2-3 2H3zM8 14l-2 6M12 14l2 5"/></>,
  rifle: <><path d="M2 10h16l4 2-4 2H2zM8 10V7h6v3M9 14l-2 6M14 14l2 5"/></>,
  cash: <><rect x="3" y="6" width="18" height="12" rx="2"/><circle cx="12" cy="12" r="3"/><path d="M6 9h.01M18 15h.01"/></>,
  walk: <><circle cx="13" cy="4" r="2"/><path d="m11 8 3 2 2 4M10 9l-2 4 3 2-2 6M14 10l4-1M11 15l5 6"/></>,
  target: <><circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="4"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3"/></>,
  warning: <><path d="M12 3 2 21h20zM12 9v5M12 18h.01"/></>,
  gift: <><rect x="3" y="9" width="18" height="12"/><path d="M12 9v12M3 13h18M12 9H7a2 2 0 1 1 2-3c1 1 3 3 3 3zM12 9h5a2 2 0 1 0-2-3c-1 1-3 3-3 3z"/></>,
  bot: <><rect x="4" y="7" width="16" height="12" rx="3"/><path d="M12 3v4M9 12h.01M15 12h.01M8 16h8"/></>,
  phone: <><rect x="7" y="2" width="10" height="20" rx="2"/><path d="M10 5h4M11 19h2"/></>,
  disguise: <><path d="M4 10c4-3 12-3 16 0M7 11c0 4 2 7 5 7s5-3 5-7M8 9l-2-5M16 9l2-5M9 14h.01M15 14h.01"/></>,
  tools: <><path d="m14 6 4-4 4 4-4 4M3 21l9-9M4 4l16 16M2 7l5-5 3 3-5 5z"/></>,
  shield: <><path d="M12 3 4 6v6c0 5 3 8 8 10 5-2 8-5 8-10V6z"/></>,
  info: <><circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7h.01"/></>,
  lab: <><path d="M9 3v6l-5 9a2 2 0 0 0 2 3h12a2 2 0 0 0 2-3l-5-9V3M8 3h8M7 15h10"/></>,
  garage: <><path d="M3 21V8l9-5 9 5v13M7 21v-8h10v8M8 16h8"/></>,
  warehouse: <><path d="M3 21V8l9-5 9 5v13M7 21v-9h10v9M10 15h4M10 18h4"/></>,

  police: <><path d="M12 3 5 6v6c0 4.5 2.5 7.4 7 9 4.5-1.6 7-4.5 7-9V6z"/><path d="M9 10h6M12 7v6"/></>,
  pharmacy: <><rect x="4" y="5" width="16" height="14" rx="2"/><path d="M12 8v8M8 12h8"/></>,
  park: <><path d="M12 3c-4 3-6 6-6 9a6 6 0 0 0 12 0c0-3-2-6-6-9z"/><path d="M12 12v9M8 21h8"/></>,
  airport: <><path d="M2 13 22 5l-7 14-3-5-5-2z"/><path d="m12 14 5-5"/></>,
  pin: <><path d="M12 21s6-6.2 6-11a6 6 0 1 0-12 0c0 4.8 6 11 6 11z"/><circle cx="12" cy="10" r="2"/></>,
  casino: <><rect x="4" y="4" width="16" height="16" rx="3"/><circle cx="9" cy="9" r="1"/><circle cx="15" cy="15" r="1"/><circle cx="15" cy="9" r="1"/><circle cx="9" cy="15" r="1"/></>,
  dice: <><rect x="4" y="4" width="16" height="16" rx="3"/><circle cx="8" cy="8" r="1" fill="currentColor" stroke="none"/><circle cx="12" cy="12" r="1" fill="currentColor" stroke="none"/><circle cx="16" cy="16" r="1" fill="currentColor" stroke="none"/></>,
  music: <><path d="M9 18V6l10-2v12"/><circle cx="6" cy="18" r="3"/><circle cx="16" cy="16" r="3"/></>,
  headphones: <><path d="M4 14v-2a8 8 0 0 1 16 0v2"/><path d="M4 14h4v6H6a2 2 0 0 1-2-2zM20 14h-4v6h2a2 2 0 0 0 2-2z"/></>,
  spark: <><path d="m12 2 1.6 5.2L19 9l-5.4 1.8L12 16l-1.6-5.2L5 9l5.4-1.8zM19 15l.8 2.2L22 18l-2.2.8L19 21l-.8-2.2L16 18l2.2-.8z"/></>,
  crown: <><path d="m4 7 4 4 4-7 4 7 4-4-2 11H6zM7 21h10"/></>,
  car: <><path d="M5 16h14l-1-5-3-3H9l-3 3z"/><circle cx="8" cy="17" r="2"/><circle cx="16" cy="17" r="2"/><path d="M7 12h10"/></>,
  mine: <><path d="m5 20 6-6M9 4l11 11M6 7l4-4 3 3-4 4zM14 13l4-4 3 3-4 4z"/></>,
  horse: <><path d="M5 20v-6l3-4 1-5 5 2 3 4v4l-3 2H9l-2 3M15 7l3-2M10 17v4M16 15l2 5"/><circle cx="13" cy="9" r=".6" fill="currentColor" stroke="none"/></>,
  armor: <><path d="M7 4 12 2l5 2 2 5-3 12H8L5 9z"/><path d="M9 5v5M15 5v5M8 13h8"/></>,
  medkit: <><rect x="3" y="7" width="18" height="13" rx="2"/><path d="M9 7V4h6v3M12 10v7M8.5 13.5h7"/></>,
  drink: <><path d="M7 3h10l-1 18H8zM9 7h6M10 11h4"/></>,
  focus: <><path d="M12 3c4 0 7 3 7 7 0 5-4 8-7 11-3-3-7-6-7-11 0-4 3-7 7-7z"/><path d="M9 10h6M12 7v6"/></>,
  candy: <><path d="m8 8 8 8M8 16l8-8"/><path d="M8 8 4 6l2 4-2 4 4-2M16 8l4-2-2 4 2 4-4-2"/></>,
  contraband: <><rect x="5" y="7" width="14" height="13" rx="2"/><path d="M9 7V4h6v3M9 11h6M9 15h6"/></>,
  chip: <><rect x="6" y="6" width="12" height="12" rx="2"/><path d="M9 2v4M15 2v4M9 18v4M15 18v4M2 9h4M2 15h4M18 9h4M18 15h4M10 10h4v4h-4z"/></>,
  key: <><circle cx="8" cy="12" r="4"/><path d="M12 12h9M17 12v3M20 12v2"/></>,
  envelope: <><rect x="3" y="5" width="18" height="14" rx="2"/><path d="m4 7 8 6 8-6"/></>,
  gloves: <><path d="M7 21 4 12l1-7 2 6V3h2l1 8V2h2l1 9V4h2l1 8 2-4 2 1-2 8-4 4z"/></>,
  badge: <><path d="M12 3 6 6v6c0 4 2.5 7 6 9 3.5-2 6-5 6-9V6z"/><circle cx="12" cy="11" r="2"/></>,
  route: <><circle cx="5" cy="18" r="2"/><circle cx="19" cy="6" r="2"/><path d="M7 18c7 0 3-12 10-12"/><path d="m14 4 3 2-3 2"/></>,
  chemical: <><path d="M9 3v6l-5 9a2 2 0 0 0 2 3h12a2 2 0 0 0 2-3l-5-9V3M8 3h8M7 16h10"/><circle cx="10" cy="17" r=".8" fill="currentColor" stroke="none"/><circle cx="14" cy="14" r=".8" fill="currentColor" stroke="none"/></>,
  package: <><path d="M4 7 12 3l8 4v10l-8 4-8-4zM4 7l8 4 8-4M12 11v10"/></>,
  plant: <><path d="M12 21V9M12 12c-5 0-7-3-7-7 4 0 7 2 7 7zM12 15c5 0 7-3 7-7-4 0-7 2-7 7z"/></>,
  book: <><path d="M4 4h7a3 3 0 0 1 3 3v13a3 3 0 0 0-3-3H4zM20 4h-7a3 3 0 0 0-3 3v13a3 3 0 0 1 3-3h7z"/></>,
  building: <><path d="M5 21V5h14v16M3 21h18M8 9h2M14 9h2M8 13h2M14 13h2M10 21v-4h4v4"/></>,
};

export function GameIcon({ name, size = 18, className = "", title }: { name: GameIconName; size?: number; className?: string; title?: string }) {
  return <svg className={`game-icon ${className}`} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden={title ? undefined : true} role={title ? "img" : undefined}>{title ? <title>{title}</title> : null}{paths[name] ?? paths.info}</svg>;
}

const emojiMap: Record<string, GameIconName> = {
  "❤️":"health","❤":"health","⚡":"energy","🔥":"nerve","😊":"happy","🏦":"bank","🌡":"heat","💎":"points","🏅":"merit","🏆":"awards",
  "👤":"character","🏙️":"city","🏙":"city","🕵️":"crimes","🕵":"crimes","⚔️":"combat","⚔":"combat","🏋️":"gym","🏋":"gym","💼":"jobs","🎒":"inventory","🛒":"shops","📜":"missions","🎓":"education","🏠":"property","📈":"market","🛡️":"faction","🛡":"faction","🧬":"progression",
  "🔒":"lock","🏥":"hospital","👊":"weapon","🔪":"blade","🗡️":"blade","🗡":"blade","🏏":"blunt","🔧":"blunt","🔫":"handgun","💥":"shotgun","🎯":"target","💵":"cash","🚶":"walk","⚠":"warning","⚠️":"warning","🎁":"gift","🤖":"bot","📱":"phone","🕶️":"disguise","🕶":"disguise","🧰":"tools","🏚️":"garage","🏚":"garage","🏭":"warehouse","🚔":"police","💊":"pharmacy","🌳":"park","✈️":"airport","✈":"airport","📍":"pin","🎰":"casino","🎲":"dice","🎵":"music","🎧":"headphones","✨":"spark","👑":"crown","🚗":"car","⛏️":"mine","⛏":"mine","🐎":"horse","🏇":"horse","🐴":"horse"
};

export function iconFromLegacy(value?: string | null, fallback: GameIconName = "info") { return (value && emojiMap[value]) || fallback; }
