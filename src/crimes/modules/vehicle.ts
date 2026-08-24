import type { CrimeCareerAction, CrimeCareerDefinition } from "../core/types";
import { defineCrimePlugins } from "../core/plugin";

const action = (value: CrimeCareerAction) => value;

export const VEHICLE_CRIMES: CrimeCareerDefinition[] = [
  { id:"vehicle-theft", name:"Vehicle Theft", description:"Choose from rotating vehicles with different security, value and demand.", family:"vehicle", mode:"target", targetKind:"vehicle", icon:"car", unlockCrimeExperience:100, baseNerve:6, risk:"MEDIUM" },
  { id:"parts-theft", name:"Parts Theft", description:"Take fictional vehicle components that feed crafting and Black Market supply.", family:"vehicle", mode:"actions", icon:"tools", unlockCrimeExperience:125, baseNerve:5, risk:"MEDIUM", actions:[
    action({id:"parking-row",name:"Parking Row",description:"Low-tier component targets with modest Heat.",nerve:5,difficulty:40,minReward:420,maxReward:1150,heat:5,requiredItems:["tool-bag"]}),
    action({id:"performance-lot",name:"Performance Lot",description:"Premium component targets with higher surveillance.",nerve:7,difficulty:54,minReward:900,maxReward:2500,heat:8,masteryRequired:35,requiredItems:["tool-bag","vehicle-module"]}),
  ]},
  { id:"chop-shop", name:"Chop Shop", description:"Run stolen-vehicle processing as a passive operation while you do other activities.", family:"vehicle", mode:"operation", icon:"garage", unlockCrimeExperience:190, baseNerve:6, risk:"HIGH", operationIds:["chop-shop"] }
];

// Plugin export: the registry consumes plugins, while the *_CRIMES array remains a compatibility/data export.
export const VEHICLE_CRIME_PLUGINS = defineCrimePlugins(VEHICLE_CRIMES);
