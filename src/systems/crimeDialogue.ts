import type { ActivityType } from "../types/riftCity";

export type CrimeDialogueInput = {
  crimeId: string;
  actionLabel: string;
  subject?: string;
  district?: string;
  activityType: ActivityType;
  activityId: number;
  activityText?: string;
};

export type CrimeDialogue = {
  headline: string;
  body: string;
  kicker: string;
};

type SceneSet = { success:string[]; fail:string[]; busted:string[]; system:string[] };

const pick = (items:string[], seed:number, salt:number) => items[Math.abs((seed * 1103515245 + salt * 2654435761) | 0) % items.length];
const replaceToken=(text:string, token:string, value:string)=>text.split(token).join(value);
const fill = (text:string, input:CrimeDialogueInput) => {
  let out=replaceToken(text,"{subject}",input.subject || input.actionLabel);
  out=replaceToken(out,"{district}",input.district || "the city");
  return replaceToken(out,"{action}",input.actionLabel);
};

const GENERIC: SceneSet = {
  success:[
    "The opening holds just long enough. {action} comes together cleanly, and you are moving again before the street has time to settle.",
    "For a few seconds the city cooperates. You keep your composure through {action}, take the result, and disappear back into the flow.",
    "The read was right. {subject} gives you the window you needed, and the job ends on your terms instead of the city's.",
    "Nothing dramatic gives you away. {action} lands quietly, leaving only the result and a little more experience behind.",
    "Timing, patience, and a little luck line up. You finish around {subject} without drawing the kind of attention that ruins a night.",
  ],
  fail:[
    "Something about the moment feels wrong halfway through. You cut it short around {subject} and leave with less than you wanted, but with the lesson intact.",
    "The opportunity closes faster than expected. {action} falls apart before the payoff, forcing you to back off and blend into {district}.",
    "You push for the opening, but the city pushes back. There is no clean score here this time, only a quick exit and another read for next time.",
    "A small detail changes the whole situation. You abandon {action} before a bad moment becomes an expensive one.",
    "The timing never quite arrives. You leave {subject} behind and move on before anyone has a reason to remember you.",
  ],
  busted:[
    "The situation turns hard and fast. There is no clean exit from {subject}; the attempt ends with authorities taking control of the scene.",
    "One bad break becomes three. By the time you realize the area has tightened up, the route out is already gone.",
    "The city notices this one. {action} collapses into an enforcement response, and the consequences are heavier than the score ever would have been.",
    "You stay a moment too long. Attention locks onto you around {district}, and this attempt ends in custody instead of profit.",
  ],
  system:[
    "The preparation is in motion. Nothing pays immediately, but the pieces are now moving in the background and the next decision is yours.",
    "You finish the setup and step away. The operation has entered its live phase; from here, time and pressure start doing the work.",
    "The groundwork is complete. The city keeps moving while your setup develops in the background.",
  ],
};

const SCENES: Record<string, Partial<SceneSet>> = {
  scavenging:{
    success:[
      "You slow down around {subject} and let the crowd move past before checking the overlooked corners. Something useful finally turns up where most people would have kept walking.",
      "The opportunity reading was worth trusting. A patient sweep of {subject} turns city leftovers into something you can actually use.",
      "You work {subject} without rushing it—benches, edges, forgotten spots, the places people stop noticing. This pass pays off.",
      "The city leaves little clues everywhere. At {subject}, one of them leads to a find before the opportunity window starts cooling off.",
      "A quiet pass through {subject} turns up more than loose junk. You pocket the result and keep moving before the area changes again.",
      "You catch {subject} at the right part of its daily rhythm. The search is short, careful, and actually worth the Nerve.",
    ],
    fail:[
      "You give {subject} a proper sweep, but the good window has already been picked thin. Nothing worth carrying makes it into your hands.",
      "Plenty of movement, not much value. You search the obvious and not-so-obvious spots around {subject} and come away empty.",
      "The opportunity meter looked better than the ground did. {subject} gives you noise, trash, and false hope—nothing that pays.",
      "You spend a few minutes reading the area, but somebody else got here first. The useful finds are gone before your search begins.",
      "A promising glint turns into worthless clutter. You call the search before wasting more time on a dead patch.",
    ],
    busted:[
      "You are still searching {subject} when the area suddenly stops feeling anonymous. Security closes the distance and the search becomes an expensive mistake.",
      "The wrong person notices you lingering around {subject}. Questions turn into consequences before you can make the situation look ordinary.",
      "This part of {district} is hotter than the meter suggested. Your search gets interrupted by enforcement, and there is no casual way to walk it off.",
    ],
  },
  pickpocket:{
    success:[
      "{subject} keeps moving and never breaks stride. For one clean moment you match the city's rhythm, make the play, and let the crowd swallow the distance between you.",
      "You read {subject}'s pace correctly. The window is tiny, but it is enough; by the time they look around, you are already another face in {district}.",
      "No chase, no scene, no second look. {subject} passes through your space and the attempt is over almost as quickly as it began.",
      "You wait until {subject}'s attention drifts elsewhere. The moment opens, closes, and leaves you with the score before the street changes again.",
      "The live feed handed you the right target. {subject} keeps going, unaware that the opportunity disappeared with you.",
      "Your timing beats their awareness. {subject} is already leaving the block when you realize the attempt went as clean as it felt.",
    ],
    fail:[
      "{subject} shifts at exactly the wrong second. You abandon the move and let them continue rather than turning a bad read into a worse one.",
      "The target is more alert than they looked. You feel the window disappear and peel away into {district} before the moment becomes memorable.",
      "You make the read, start the move, then catch a glance that changes everything. {subject} gets away with their valuables and you keep your distance.",
      "Their pace changes without warning. The opening vanishes, and the smartest move is pretending you were never interested in the first place.",
      "Too many eyes converge at once. You let {subject} go and take the small loss instead of forcing the attempt.",
    ],
    busted:[
      "{subject} reacts instantly and the street around you wakes up with them. The attempt turns public, then official, before you can fade out.",
      "A bad read meets bad timing. Someone nearby understands exactly what happened, and the exit from {district} closes fast.",
      "The target's reaction brings the wrong kind of attention. This one ends with authorities involved and the crowd watching.",
    ],
  },
  shoplift:{
    success:[
      "You keep the basket ordinary-looking and move with the store instead of against it. The doors open, the pressure drops, and {subject} is behind you before anyone commits to a second look.",
      "The crowd and staffing pattern give you just enough cover. You leave {subject} with the basket intact and the suspicion meter never turns into a confrontation.",
      "Every extra item made the walk out feel longer, but the timing holds. You cross the threshold and let the store noise bury the moment.",
      "You resist the urge to hesitate at the exit. One steady walk later, {subject} is somebody else's problem and the basket is yours.",
      "Cameras, staff, crowd—everything stays just disconnected enough. The risk was real, but the exit is clean.",
    ],
    fail:[
      "The store suddenly feels smaller. A staff member changes direction, the suspicion is too high, and you leave the basket rather than turning it into a charge.",
      "A quiet moment becomes too quiet. You catch the attention shift inside {subject} and abandon the score before anyone makes it official.",
      "The basket got greedier than the conditions allowed. You dump the attempt and walk out with nothing but a better sense of the store's rhythm.",
      "Security pressure rises faster than expected. You cut your losses, leave the merchandise, and make the exit look boring.",
    ],
    busted:[
      "The suspicion meter stops being theoretical. Store security commits, the exits become controlled, and {subject} turns into paperwork and penalties.",
      "One more item was one too many. The store reacts before you can reset the situation, and the attempt ends in custody.",
      "The conditions shift against you at the worst point in the basket. Staff attention becomes security attention, then enforcement.",
    ],
  },
  graffiti:{
    success:[
      "You finish the last line and step back just long enough to see it sit in the city. {subject} carries your name now, and people are going to notice.",
      "The wall takes the piece cleanly. You leave {subject} with fresh color, a stronger name, and just enough time before the area gets curious.",
      "The spot is visible for all the right reasons. Your tag lands, the city keeps moving, and your reputation gets a little harder to ignore.",
      "You commit to the piece instead of rushing it. By the time you leave {subject}, the mark looks like it belongs there.",
      "A blank surface becomes reputation. You pack up, move out, and leave {district} with your name doing the talking behind you.",
    ],
    fail:[
      "The area never settles enough to finish cleanly. You cut the piece short at {subject} and leave before unfinished art becomes finished evidence.",
      "Foot traffic keeps breaking the rhythm. You stop before the location can turn your name into the wrong kind of recognition.",
      "The spot is hotter than expected. You leave the wall unfinished and save the rest of the idea for another night.",
    ],
  },
  burglary:{
    success:[
      "The scouting pays off. {subject} behaves almost exactly the way the intel suggested, and the job stays controlled from entry to exit.",
      "You trust the notes, watch the timing, and move only when the property goes quiet. The score comes together without the target ever feeling predictable enough to get careless.",
      "Good intel turns a dangerous property into a manageable one. You leave {subject} with the value and none of the noise.",
      "The property gives you the opening the scout work promised. You take what the window allows and leave before greed changes the math.",
    ],
    fail:[
      "The scouting was right about the risk and wrong about the timing. Something changes inside {subject}, and you back out before the property turns hostile.",
      "A small inconsistency in the intel is enough. You abandon the attempt and leave the property untouched rather than improvise into trouble.",
      "The place feels wrong as soon as the window opens. You trust the instinct, break off the job, and keep the lesson for the next board refresh.",
    ],
    busted:[
      "The property was ready for more attention than the scout work showed. The response is fast, organized, and leaves you no clean route out.",
      "Something in {subject} trips the whole situation at once. The job ends with authorities instead of loot.",
    ],
  },
  "vehicle-theft":{
    success:[
      "The target moves from 'opportunity' to 'gone' in one tense stretch. {subject} disappears into the city flow and the demand board suddenly matters a lot more.",
      "The security rating looked ugly, but your timing is better. You get the vehicle clear and let {district} shrink behind you.",
      "The live target window holds. {subject} is yours long enough to turn a risky sighting into actual value.",
      "You commit before the board can refresh. A few stressful moments later, the target is off the street and the score is real.",
    ],
    fail:[
      "The target stops feeling worth it halfway through. You break off around {subject} and let the vehicle remain somebody else's problem.",
      "Security pressure jumps before the opportunity settles. You abandon the target and disappear before the attempt becomes a report.",
      "The live window closes on you. {subject} stays put, and you move on before the street starts asking why you were interested.",
    ],
  },
  safecracking:{
    success:[
      "The fictional sync finally settles into place. You hold the pattern, finish {subject}, and the vault gives up its value without the attempt turning chaotic.",
      "Patience wins this one. The timing puzzle clicks into a clean sequence and {subject} opens before pressure can ruin the run.",
      "You stop forcing the pattern and start reading it. That change is enough—{subject} resolves, and the score is waiting on the other side.",
    ],
    fail:[
      "The sync drifts every time you think you have it. You end the attempt before the timer and Heat can turn a puzzle into a disaster.",
      "Too many false beats stack up. You walk away from {subject} rather than burn more Nerve on a pattern that is not there tonight.",
      "The fictional lock never gives you a stable rhythm. You break off and keep the experience, if not the payout.",
    ],
  },
  "art-theft":{
    success:[
      "The hard part is not touching the value—it's leaving with it while it still feels impossible to sell. {subject} is secured, and now the underground market decides what it is really worth.",
      "You get the piece clear without turning the gallery into a scene. The score feels less like cash and more like leverage waiting for the right buyer.",
      "The target is finally in your possession. Nothing about {subject} is liquid yet, but rare value has a way of finding patient buyers.",
    ],
    fail:[
      "The target never gives you a safe enough window. You leave the piece where it is rather than turn a rare opportunity into a permanent problem.",
      "Too much attention settles around {subject}. You call the job and preserve the setup for another opportunity instead of forcing the prestige score.",
    ],
  },
  "data-breach":{
    success:[
      "The abstract security layer gives way at the right point in the simulation. You pull the fictional data package, sever the session, and leave the node quiet behind you.",
      "The Cyber read is clean. {subject} yields value without the security meter escalating into a full response.",
      "You catch the fictional system during a weak pulse and finish before the window hardens again. The data is yours; the node moves on.",
    ],
    fail:[
      "The fictional security pulse shifts against you. You terminate the attempt instead of feeding more Heat into a dead session.",
      "The node hardens faster than expected. You pull out with no data and a better read on where your Cyber skill still needs work.",
      "The simulated security layer never opens far enough. You let the session die rather than force an ugly outcome.",
    ],
  },
  "cargo-theft":{
    success:[
      "The patrol window and cargo value finally line up. You commit to {subject}, move the score through the gap, and let the industrial noise cover the rest.",
      "This shipment is worth the timing. You catch the low-pressure window, take the value, and clear {district} before the patrol pulse climbs again.",
      "The freight board was telling the truth for once. {subject} turns into a clean score before the route can get crowded.",
    ],
    fail:[
      "The patrol pressure climbs at exactly the wrong time. You abandon {subject} and leave the shipment alone rather than fight the whole district for it.",
      "The cargo looks valuable, but the route stops looking survivable. You cut the attempt and wait for the next freight pulse.",
    ],
  },

  "street-theft":{
    success:[
      "You wait for the ordinary rhythm around {subject} to cover the moment. The score is small enough to stay quiet and clean enough to keep moving.",
      "Nothing about {subject} looks dramatic from the outside. That is exactly why the opportunity works; you take the value and let the street keep its routine.",
      "The window opens in the middle of normal city noise. You finish {action} before anyone around {district} has a reason to connect the moment to you.",
      "A low-profile opportunity turns into a real score. You leave {subject} looking almost exactly the way you found it.",
    ],
    fail:[
      "The area never becomes anonymous enough. You leave {subject} alone and move on before a petty score turns into unnecessary Heat.",
      "Too many small details line up against you. You abandon {action}, keep your Nerve loss small, and wait for the city to offer something cleaner.",
      "The opportunity is there, but the cover is not. You walk away from {subject} and let the moment expire.",
    ],
  },
  "major-job":{
    success:[
      "The final decision carries through the whole job. Every earlier choice around {subject} shows up in the ending, and this time the plan survives contact with the city.",
      "The job spends every bit of preparation you put into it. {subject} resolves with the payout intact and the escape still yours.",
      "There are a dozen points where a major score can collapse. You get through the last one, close {action}, and finally see the result of the whole chain.",
      "The city throws changes at the plan, but the route holds. You finish {subject} with a result that feels earned rather than rolled.",
    ],
    fail:[
      "One of the earlier compromises finally catches up with the job. {subject} unravels near the end and you are forced to save yourself instead of the score.",
      "The plan survives most of the night, but not the last pressure spike. You leave {subject} with the payout gone and the consequences still very real.",
      "Major jobs rarely fail in one dramatic instant. This one dies by accumulated pressure until the only smart move left is getting out.",
    ],
    busted:[
      "The job crosses the point where improvising can save it. The response around {subject} locks down, and every earlier risk suddenly becomes part of the arrest.",
      "The final route closes before the crew plan can recover. {subject} ends with enforcement controlling the scene and the score completely lost.",
    ],
  },
  "evidence-cleanup":{
    success:[
      "You spend resources instead of chasing another payout. The cleanup around {subject} lowers the pressure and gives your Heat somewhere to go besides up.",
      "Nothing about cleanup is glamorous, but the city notices what is left behind. This pass removes enough loose ends to matter.",
      "You work backward through the mess from earlier jobs. By the time {subject} is finished, the investigation pressure is lighter than it was.",
    ],
    fail:[
      "The cleanup doesn't buy enough certainty. You burn resources, reduce very little, and leave knowing some pressure is still attached to your name.",
      "Too much has already spread beyond the immediate scene. {subject} helps less than expected, and the Heat remains stubborn.",
    ],
  },
};

const SCENE_ALIASES:Record<string,string> = {
  "package-swipe":"street-theft",
  "locker-theft":"street-theft",
  "commercial-burglary":"burglary",
  "parts-theft":"vehicle-theft",
  "robbery":"major-job",
  "warehouse-job":"major-job",
  "bank-job":"major-job",
  "major-heist":"major-job",
};

const OPERATION_IDS = new Set([
  "chop-shop","card-skimming","email-fraud","forgery","counterfeit-run","identity-fraud","corporate-fraud",
  "black-market-delivery","smuggling","protection-racket","underground-gambling",
]);

const operationScene: SceneSet = {
  success:[
    "The timer finally turns into money. {subject} resolves, the pressure drops, and the operation closes with a result worth waiting for.",
    "You cash the operation out before the city can take another bite at it. {subject} is finished and the balance finally reflects the risk.",
    "The background work pays. You close {subject}, collect the outcome, and free the slot for whatever comes next.",
    "The operation reaches the point where waiting longer stops being clever. You collect, shut it down, and take the win.",
  ],
  fail:[
    "The operation develops the wrong kind of attention. You close {subject} with less value than planned and more pressure than you wanted.",
    "Time builds risk as well as value. This run tips the wrong direction before collection, leaving you with an expensive lesson.",
    "The background job never becomes the clean passive score you hoped for. Detection pressure gets there first.",
  ],
  busted:[
    "The operation stays live too long. Detection turns into enforcement, and {subject} stops being passive income the moment authorities step in.",
    "The pressure meter wins the race. {subject} is exposed before you can close it cleanly, and the consequences arrive all at once.",
  ],
  system:[
    "You commit the setup cost and put {subject} into motion. There is nothing else to click right now—the city, the timer, and the risk meter take over.",
    "{subject} is live. The setup disappears into the background while value and exposure begin moving in opposite directions.",
    "The operation starts quietly. From here, patience can build value, but every extra minute also gives the city another chance to notice.",
    "The pieces are deployed and the timer is running. You can leave this screen; {subject} will keep developing in the background.",
  ],
};

function sceneFor(input:CrimeDialogueInput):SceneSet {
  if (OPERATION_IDS.has(input.crimeId)) return operationScene;
  const specific = SCENES[input.crimeId] || SCENES[SCENE_ALIASES[input.crimeId] || ""] || {};
  return {
    success:specific.success || GENERIC.success,
    fail:specific.fail || GENERIC.fail,
    busted:specific.busted || GENERIC.busted,
    system:specific.system || GENERIC.system,
  };
}

const KICKERS:Record<string,string[]> = {
  critical:["A rare break goes your way.","The city gives you more than the normal result.","That was the kind of outcome players remember."],
  success:["The attempt resolves in your favor.","Clean enough to count as a win.","The opportunity pays before it disappears."],
  spooked:["You get out, but the score is gone.","The safest win here is avoiding the bigger loss.","The opportunity dies before the consequences do."],
  failure:["The attempt doesn't produce a score.","No payout this time.","The city wins this exchange."],
  jailed:["This one ends with consequences.","The escape window closes completely.","The city turns the attempt into a charge."],
  system:["The state of the crime has changed.","Setup complete; the next phase is live.","The operation advances."],
};

export function buildCrimeDialogue(input:CrimeDialogueInput):CrimeDialogue {
  const scene = sceneFor(input);
  const type = input.activityType;
  const criticalFail = Boolean(input.activityText && /^CRITICAL FAIL/i.test(input.activityText));
  const isBusted = type === "jailed" || Boolean(input.activityText && /^(BUSTED|ARRESTED)/i.test(input.activityText));
  const effectiveType:ActivityType = criticalFail ? "failure" : type;
  const pool = effectiveType === "system" ? scene.system : isBusted ? scene.busted : (effectiveType === "failure" || effectiveType === "spooked") ? scene.fail : scene.success;
  const body = fill(pick(pool,input.activityId,input.crimeId.length+input.actionLabel.length),input);
  const kicker = pick(KICKERS[effectiveType] || KICKERS.success,input.activityId,input.actionLabel.length);
  const headline = isBusted ? "The situation collapses" : criticalFail ? "The whole attempt turns against you" : effectiveType === "critical" ? "Something unusual happens" : effectiveType === "spooked" ? "You break away" : effectiveType === "failure" ? "The opportunity closes" : effectiveType === "system" ? "The operation moves" : "The moment holds";
  return { headline, body, kicker };
}
