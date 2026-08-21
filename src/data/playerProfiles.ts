import type { PlayerProfile } from "../systems/combat/combatTypes";
import { getWeaponById } from "../systems/combat/combatWeapons";

function loadout(id:string){ const w=getWeaponById(id); return w ? [w] : []; }

export const PLAYER_PROFILES: PlayerProfile[] = [
  { id:"piper", name:"Piper", level:2, title:"Street Runner", status:"Online", location:"City Center", health:105, maxHealth:105,
    stats:{strength:7,defense:6,speed:9,dexterity:8}, weapons:loadout("bat"), equippedWeaponId:"bat", weaponSkills:{blunt:4}, weapon:"Composite Bat", armor:"Street Jacket", armorProtection:4, bounty:75, cashReward:120, xpReward:18, faction:"Unaffiliated" },
  { id:"mako", name:"Mako", level:4, title:"Dock Hustler", status:"Idle", location:"The Docks", health:125, maxHealth:125,
    stats:{strength:11,defense:10,speed:12,dexterity:11}, weapons:loadout("crowbar"), equippedWeaponId:"crowbar", weaponSkills:{blunt:9}, weapon:"Heavy Crowbar", armor:"Reinforced Jacket", armorProtection:6, bounty:150, cashReward:220, xpReward:28, faction:"Dock Union" },
  { id:"rhea", name:"Rhea", level:6, title:"Street Fighter", status:"Online", location:"Industrial District", health:145, maxHealth:145,
    stats:{strength:16,defense:14,speed:15,dexterity:16}, weapons:loadout("machete"), equippedWeaponId:"machete", weaponSkills:{blade:14}, weapon:"Machete", armor:"Tactical Vest", armorProtection:15, bounty:250, cashReward:360, xpReward:40, faction:"Iron Syndicate" },
  { id:"vex", name:"Vex", level:9, title:"Veteran", status:"Idle", location:"Suburbs", health:175, maxHealth:175,
    stats:{strength:23,defense:22,speed:20,dexterity:24}, weapons:loadout("heavy-pistol"), equippedWeaponId:"heavy-pistol", weaponSkills:{handgun:22}, weapon:"Heavy Pistol", armor:"Tactical Vest", armorProtection:15, bounty:500, cashReward:700, xpReward:65, faction:"Rift Guard" },
  { id:"onyx", name:"Onyx", level:13, title:"Enforcer", status:"Offline", location:"The Docks", health:215, maxHealth:215,
    stats:{strength:32,defense:29,speed:27,dexterity:31}, weapons:loadout("carbine"), equippedWeaponId:"carbine", weaponSkills:{rifle:34}, weapon:"Street Carbine", armor:"Heavy Vest", armorProtection:20, bounty:900, cashReward:1200, xpReward:95, faction:"Iron Syndicate" },
  { id:"nova", name:"Nova", level:18, title:"Elite Fighter", status:"Online", location:"City Center", health:270, maxHealth:270,
    stats:{strength:44,defense:41,speed:39,dexterity:45}, weapons:loadout("rifle"), equippedWeaponId:"rifle", weaponSkills:{rifle:48}, weapon:"Rift Rifle", armor:"Elite Armor", armorProtection:28, bounty:1500, cashReward:2200, xpReward:140, faction:"Rift Guard" },
];
