import type { CrimeCareerAction, CrimeCareerDefinition } from "../core/types";
import { defineCrimePlugins } from "../core/plugin";

const action = (value: CrimeCareerAction) => value;

export const FRAUD_CRIMES: CrimeCareerDefinition[] = [
  { id:"card-skimming", name:"Card Skimming", description:"Deploy an abstract game device, let value build over time, then collect before detection catches up.", family:"fraud", mode:"operation", icon:"chip", unlockCrimeExperience:55, baseNerve:3, risk:"MEDIUM", operationIds:["card-skimming"] },
  { id:"email-fraud", name:"Email Fraud", description:"Fund fictional campaign tiers that resolve over time. No real-world procedures are modeled.", family:"fraud", mode:"operation", icon:"envelope", unlockCrimeExperience:90, baseNerve:4, risk:"MEDIUM", operationIds:["email-fraud"] },
  { id:"forgery", name:"Forgery", description:"Use an abstract forgery bench to create value through timed underground commissions.", family:"fraud", mode:"operation", icon:"badge", unlockCrimeExperience:135, baseNerve:5, risk:"HIGH", operationIds:["forgery-run"] },
  { id:"counterfeit-run", name:"Counterfeit Goods", description:"Finance fictional underground goods batches and sell the finished output into the simulated economy.", family:"fraud", mode:"operation", icon:"package", unlockCrimeExperience:145, baseNerve:5, risk:"HIGH", operationIds:["counterfeit-run"] },
  { id:"identity-fraud", name:"Identity Fraud", description:"A high-tier abstract fraud operation with expensive setup and stronger investigation pressure.", family:"fraud", mode:"operation", icon:"character", unlockCrimeExperience:220, baseNerve:7, risk:"HIGH", operationIds:["identity-fraud"] },
  { id:"corporate-fraud", name:"Corporate Fraud", description:"Late-game passive financial crime with large setup capital, big returns and serious Heat exposure.", family:"fraud", mode:"operation", icon:"building", unlockCrimeExperience:360, baseNerve:10, risk:"EXTREME", operationIds:["corporate-fraud"] }
];

// Plugin export: the registry consumes plugins, while the *_CRIMES array remains a compatibility/data export.
export const FRAUD_CRIME_PLUGINS = defineCrimePlugins(FRAUD_CRIMES);
