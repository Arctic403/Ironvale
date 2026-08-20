import React, { useState } from "react";
import type { useRiftCity } from "../hooks/useRiftCity";

import { Panel, Button } from "../components/ui";

import {
  EDUCATION,
  ITEMS,
  JOBS,
  MISSIONS,
  PROPERTIES,
  getProperty,
} from "../data/gameData";

import { money, formatTime } from "../core/gameCore";
import { DAILY_CHALLENGES, WEEKLY_CHALLENGES, MERIT_UPGRADES, PROPERTY_UPGRADES, FACTIONS, NPCS, WORLD_EVENTS, getFactionRank } from "../data/expansion";

type Game = ReturnType<typeof useRiftCity>;

/* =========================================================
   CHARACTER
========================================================= */

export function Character({ g }: { g: Game }) {
  const [amount, setAmount] = useState("100");

  const n = Math.max(0, Number(amount) || 0);

  const happinessMax =
    (getProperty(g.gameState.ownedProperty)?.maxHappiness ?? 100) +
    (g.gameState.propertyUpgrades["bedroom"] ?? 0) * 10;

  return (
    <div className="ui-grid two-col">
      <Panel title="Combat Stats">
        <div className="stats-list">
          {Object.entries(g.gameState.stats).map(([key, value]) => (
            <div className="stat-row" key={key}>
              <span className="stat-name">{key}</span>

              <strong className="stat-val">
                {(value as number).toFixed(2)}
              </strong>
            </div>
          ))}
        </div>
      </Panel>

      <Panel title="Core Resources">
        <div className="data-list">
          <div className="data-row">
            <span>❤️ Health</span>

            <b>
              {Math.floor(g.gameState.health)} / {g.maxHealth}
            </b>
          </div>

          <div className="data-row">
            <span>⚡ Energy</span>

            <b>
              {g.gameState.energy} / {g.maxEnergy}
            </b>
          </div>

          <div className="data-row">
            <span>🧠 Nerve</span>

            <b>
              {g.gameState.nerve} / {g.maxNerve}
            </b>
          </div>

          <div className="data-row">
            <span>😊 Happiness</span>

            <b>
              {Math.floor(g.gameState.happiness)} / {happinessMax}
            </b>
          </div>
        </div>
      </Panel>

      <Panel title="Progress Overview">
        <div className="data-list">
          <div className="data-row">
            <span>Crime Experience</span>
            <b>{g.gameState.crimeExperience}</b>
          </div>

          <div className="data-row">
            <span>Gym Experience</span>
            <b>{g.gameState.gymExperience}</b>
          </div>

          <div className="data-row">
            <span>Crimes Completed</span>

            <b>
              {g.gameState.crimesCompleted} /{" "}
              {g.gameState.crimesFailed} failed
            </b>
          </div>

          <div className="data-row">
            <span>Fight Record</span>

            <b>
              {g.gameState.fightsWon}W / {g.gameState.fightsLost}L
            </b>
          </div>

          <div className="data-row"><span>Attacks</span><b>{g.gameState.attacks}</b></div>
          <div className="data-row"><span>🔥 Heat</span><b>{g.gameState.heat} / 100</b></div>
          <div className="data-row"><span>Locations Discovered</span><b>{g.gameState.locationsVisited.length}</b></div>
          <div className="data-row"><span>Job Actions</span><b>{g.gameState.jobActions}</b></div>
          <div className="data-row"><span>Bank Interest Earned</span><b>{money(g.gameState.bankInterest)}</b></div>
        </div>
      </Panel>

      <Panel title="Bank Vault">
        <div className="bank-control">
          <h2 className="bank-balance">
            {money(g.gameState.bank)}
          </h2>

          <div className="input-group">
            <input
              type="number"
              min="0"
              value={amount}
              onChange={(event) =>
                setAmount(event.target.value)
              }
            />

            <div className="btn-group">
              <Button
                disabled={n <= 0}
                onClick={() => g.bankDeposit(n)}
              >
                Deposit
              </Button>

              <Button
                disabled={n <= 0}
                onClick={() => g.bankWithdraw(n)}
              >
                Withdraw
              </Button>
            </div>
          </div>
        </div>
      </Panel>
    </div>
  );
}

/* =========================================================
   JOBS
========================================================= */

export function Jobs({ g }: { g: Game }) {
  return (
    <>
      {g.job && g.jobPosition && (
        <Panel title="Current Employment">
          <div className="data-list">
            <div className="data-row"><span>Company</span><b>{g.job.company}</b></div>
            <div className="data-row"><span>Position</span><b>{g.jobPosition.title}</b></div>
            <div className="data-row"><span>Hourly Pay</span><b>{money(g.jobPosition.salary)}</b></div>
          </div>
          <div className="btn-group">
            <Button disabled={g.gameState.energy < 8} onClick={g.workShift}>Work Shift (8 ⚡)</Button>
            <Button onClick={g.quitJob}>Quit Job</Button>
          </div>
        </Panel>
      )}
      <div className="ui-grid two-col">
        {JOBS.map((job) => {
          const current = g.gameState.currentJob === job.id;
          const position = current && g.jobPosition ? g.jobPosition : job.positions[0];
          const next = job.positions.find((p) => p.tier === position.tier + 1);
          const skillValues = job.skills.map((skill) => g.gameState.jobSkills[`${job.id}:${skill.id}`] ?? 0);
          const bestSkill = Math.max(0, ...skillValues);
          const promotionPct = next ? Math.min(100, (bestSkill / next.requiredSkillLevel) * 100) : 100;
          return (
            <div className="card job-card" key={job.id}>
              <span className="card-tag">{job.company}</span>
              <h3>{job.title}</h3><p>{job.description}</p>
              <div className="data-row"><span>Pay</span><b>{money(position.salary)}/hr</b></div>
              <div className="data-row"><span>Position</span><b>{position.title}</b></div>
              {current && <><div className="data-row"><span>Next Promotion</span><b>{next ? next.title : "Top Rank"}</b></div><div className="bar-track"><div className="bar-fill mission" style={{width:`${promotionPct}%`}} /></div></>}
              <div className="job-skills">{job.skills.map((skill) => { const value=g.gameState.jobSkills[`${job.id}:${skill.id}`]??0; return <div className="data-row" key={skill.id}><span>{skill.name}</span><b>{value.toFixed(2)}/10</b></div>; })}</div>
              <Button disabled={current} onClick={() => g.joinJob(job.id)}>{current ? "Current Job" : "Apply Now"}</Button>
            </div>
          );
        })}
      </div>
    </>
  );
}

/* =========================================================
   INVENTORY
========================================================= */

export function Inventory({ g }: { g: Game }) {
  const ownedItems = ITEMS.filter((item) => (g.gameState.inventory[item.id] || 0) > 0);
  if (!ownedItems.length) return <Panel title="Inventory"><div className="empty-state"><span className="card-tag">EMPTY</span><h3>Your inventory is empty.</h3><p>Purchased and faction reward items appear here.</p></div></Panel>;
  return <div className="ui-grid three-col">{ownedItems.map((item) => {
    const owned=g.gameState.inventory[item.id]||0;
    const equippable=item.type==="weapon"||item.type==="armor";
    const equipped=item.type==="weapon"?g.gameState.equippedWeapon===item.id:item.type==="armor"?g.gameState.equippedArmor===item.id:false;
    return <div className="card item-card" key={item.id}>
      <span className="card-tag">{item.rarity ?? "Common"} · {item.type.toUpperCase()}</span>
      <h3>{item.name}</h3><p>{item.description}</p>
      <div className="data-list"><div className="data-row"><span>Owned</span><b>{owned}</b></div>
      {item.effect != null && <div className="data-row"><span>{item.type==="weapon"?"Damage":item.type==="armor"?"Defense":"Effect"}</span><b>{item.effect}</b></div>}
      {item.accuracy != null && <div className="data-row"><span>Accuracy</span><b>{item.accuracy}%</b></div>}
      {item.durability != null && <div className="data-row"><span>Durability</span><b>{item.durability}%</b></div>}
      {item.sellValue != null && <div className="data-row"><span>Base Sell Value</span><b>{money(item.sellValue)}</b></div>}
      {equippable && <div className="data-row"><span>Status</span><b>{equipped?"Equipped":"Stored"}</b></div>}</div>
      {equippable?<Button disabled={equipped} onClick={()=>g.equip(item.id)}>{equipped?"Equipped":"Equip"}</Button>:<Button onClick={()=>g.useItem(item.id)}>Use</Button>}
    </div>;
  })}</div>;
}

/* =========================================================
   SHOPS
========================================================= */

export function Shops({ g }: { g: Game }) {
  const shopGroups = [
    {
      title: "Weapon Shop",
      tag: "WEAPONS",
      description: "Melee weapons and firearms for combat.",
      types: ["weapon"],
    },
    {
      title: "Equipment Shop",
      tag: "ARMOR",
      description: "Protective equipment for dangerous work.",
      types: ["armor"],
    },
    {
      title: "RiftCare Pharmacy",
      tag: "MEDICAL",
      description: "Medical, energy, and nerve supplies.",
      types: ["medical", "energy", "nerve"],
    },
  ] as const;

  return (
    <div className="shop-list">
      {shopGroups.map((shop) => {
        const items = ITEMS.filter((item) =>
          item.price > 0 && shop.types.some((type) => type === item.type)
        );

        return (
          <section className="shop-section" key={shop.title}>
            <Panel title={shop.title}>
              <p>{shop.description}</p>

              <div className="ui-grid three-col">
                {items.map((item) => {
                  const owned = g.gameState.inventory[item.id] || 0;
                  const affordable = g.gameState.cash >= item.price;

                  return (
                    <div className="card item-card" key={item.id}>
                      <span className="card-tag">{shop.tag}</span>

                      <h3>{item.name}</h3>
                      <p>{item.description}</p>

                      <div className="data-list">
                        <div className="data-row">
                          <span>Price</span>
                          <b>{money(item.price)}</b>
                        </div>

                        <div className="data-row">
                          <span>Owned</span>
                          <b>{owned}</b>
                        </div>
                      </div>

                      <Button
                        disabled={!affordable}
                        onClick={() => g.buyItem(item.id)}
                      >
                        {affordable ? "Buy" : "Not Enough Cash"}
                      </Button>
                    </div>
                  );
                })}
              </div>
            </Panel>
          </section>
        );
      })}
    </div>
  );
}


/* =========================================================
   MISSIONS
========================================================= */

export function Missions({ g }: { g: Game }) {
  return (
    <div className="ui-grid two-col">
      {MISSIONS.map((mission) => {
        const progress =
          g.missionProgress(mission);

        const completed =
          g.gameState.completedMissions.includes(
            mission.id
          );

        const percent =
          mission.target > 0
            ? Math.min(
                100,
                (progress / mission.target) * 100
              )
            : 100;

        const prerequisiteMet = !mission.prerequisite || g.gameState.completedMissions.includes(mission.prerequisite);

        const canClaim =
          !completed &&
          prerequisiteMet &&
          progress >= mission.target;

        return (
          <div
            className="card mission-card"
            key={mission.id}
          >
            <span className="card-tag">
              CHAPTER {mission.chapter ?? 1}
            </span>

            <h3>{mission.name}</h3>

            <p>{mission.description}</p>

            <div className="bar-track">
              <div
                className="bar-fill mission"
                style={{
                  width: `${percent}%`,
                }}
              />
            </div>

            <div className="data-row">
              <span>Progress</span>

              <b>
                {Math.min(
                  progress,
                  mission.target
                ).toLocaleString()}{" "}
                /{" "}
                {mission.target.toLocaleString()}
              </b>
            </div>

            {!prerequisiteMet && <p className="status-text">Locked: complete the previous mission first.</p>}

            <Button
              disabled={!canClaim}
              onClick={() =>
                g.claimMission(mission.id)
              }
            >
              {completed
                ? "Claimed"
                : !prerequisiteMet
                ? "Chain Locked"
                : canClaim
                ? "Claim Reward"
                : "In Progress"}
            </Button>
          </div>
        );
      })}
    </div>
  );
}

/* =========================================================
   EDUCATION
========================================================= */

export function Education({ g }: { g: Game }) {
  return (
    <>
      <Panel title="Active Course Status">
        {g.education ? (
          <div className="course-active">
            <h3>{g.education.name}</h3>

            <p>
              Duration:{" "}
              {g.education.durationHours} hours
            </p>

            <Button onClick={g.finishEducation}>
              Check Completion
            </Button>
          </div>
        ) : (
          <p>No course currently active.</p>
        )}
      </Panel>

      <div className="ui-grid two-col">
        {EDUCATION.map((course) => {
          const completed =
            g.gameState.educationCompleted.includes(
              course.id
            );

          const active =
            Boolean(g.education);

          const affordable =
            g.gameState.cash >= course.cost;

          return (
            <div
              className="card course-card"
              key={course.id}
            >
              <h3>{course.name}</h3>

              <p>{course.description}</p>

              <div className="data-list">
                <div className="data-row">
                  <span>Cost</span>

                  <b>{money(course.cost)}</b>
                </div>

                <div className="data-row">
                  <span>Time</span>

                  <b>
                    {course.durationHours}h
                  </b>
                </div>
              </div>

              <Button
                disabled={
                  completed ||
                  active ||
                  !affordable
                }
                onClick={() =>
                  g.startEducation(course.id)
                }
              >
                {completed
                  ? "Completed"
                  : active
                  ? "Course Active"
                  : !affordable
                  ? "Not Enough Cash"
                  : "Enroll"}
              </Button>
            </div>
          );
        })}
      </div>
    </>
  );
}

/* =========================================================
   PROPERTY
========================================================= */

export function PropertyView({ g }: { g: Game }) {
  const currentProperty=getProperty(g.gameState.ownedProperty);
  const currentPrice=currentProperty?.price||0;
  return <>
    <Panel title="Residence Upgrades">
      <div className="ui-grid three-col">{PROPERTY_UPGRADES.map((upgrade)=>{
        const rank=g.gameState.propertyUpgrades[upgrade.id]??0;
        const cost=upgrade.basePrice*(rank+1);
        return <div className="card" key={upgrade.id}><span className="card-tag">HOME · RANK {rank}/{upgrade.maxRank}</span><h3>{upgrade.name}</h3><p>{upgrade.description}</p><div className="data-row"><span>Benefit</span><b>{upgrade.benefit}</b></div><div className="data-row"><span>Next Cost</span><b>{rank>=upgrade.maxRank?"MAX":money(cost)}</b></div><Button disabled={rank>=upgrade.maxRank||g.gameState.cash<cost} onClick={()=>g.buyPropertyUpgrade(upgrade.id)}>{rank>=upgrade.maxRank?"Maxed":"Upgrade"}</Button></div>;
      })}</div>
    </Panel>
    <div className="ui-grid two-col">{PROPERTIES.map((property)=>{
      const current=g.gameState.ownedProperty===property.id; const cheaper=property.price<currentPrice; const affordable=g.gameState.cash>=property.price;
      return <div className={`card property-card ${cheaper?"disabled":""}`} key={property.id}><span className="card-tag">REAL ESTATE</span><h3>{property.name}</h3><p>{property.description}</p><div className="data-list"><div className="data-row"><span>Price</span><b>{money(property.price)}</b></div><div className="data-row"><span>Health Bonus</span><b>+{property.maxHealthBonus}</b></div><div className="data-row"><span>Nerve Bonus</span><b>+{property.nerveBonus}</b></div><div className="data-row"><span>Happiness</span><b>{property.maxHappiness}</b></div></div><Button disabled={cheaper||current||!affordable} onClick={()=>g.buyProperty(property.id)}>{current?"Current Residence":cheaper?"Already Surpassed":!affordable?"Not Enough Cash":"Purchase"}</Button></div>;
    })}</div>
  </>;
}

/* =========================================================
   MARKET
========================================================= */

export function Market({ g }: { g: Game }) {
  const goods=Object.keys(g.gameState.market);
  const portfolio=goods.reduce((sum,id)=>sum+(g.gameState.inventory[id]||0)*(g.gameState.market[id]||0),0);
  return <Panel title="Dynamic Commodities Market">
    <div className="data-row"><span>Portfolio Market Value</span><b>{money(portfolio)}</b></div>
    <div className="ui-grid four-col">{goods.map((id)=>{
      const price=g.gameState.market[id]; const owned=g.gameState.inventory[id]||0; const hist=g.gameState.marketHistory[id]??[price]; const previous=hist.length>1?hist[hist.length-2]:price; const direction=price>previous?"▲":price<previous?"▼":"—"; const low=Math.min(...hist); const high=Math.max(...hist);
      return <div className="card market-card" key={id}><span className="card-tag">COMMODITY {direction}</span><h3>{id.toUpperCase()}</h3><p>Unit Price: {money(price)}</p><div className="data-row"><span>12-Tick Range</span><b>{money(low)}–{money(high)}</b></div><span className="item-count">Owned: {owned}</span><div className="btn-group"><Button disabled={g.gameState.cash<price} onClick={()=>g.tradeMarket(id,true,1)}>Buy 1</Button><Button disabled={g.gameState.cash<price*5} onClick={()=>g.tradeMarket(id,true,5)}>Buy 5</Button><Button disabled={owned<1} onClick={()=>g.tradeMarket(id,false,1)}>Sell 1</Button><Button disabled={owned<5} onClick={()=>g.tradeMarket(id,false,5)}>Sell 5</Button></div></div>;
    })}</div>
  </Panel>;
}

/* =========================================================
   FACTIONS
========================================================= */

export function Faction({ g }: { g: Game }) {
  const current=g.gameState.faction;
  const rank=getFactionRank(current,g.gameState.factionReputation);
  return <>
    {current && <Panel title={`${current} Headquarters`}><div className="data-list"><div className="data-row"><span>Rank</span><b>{rank?.name}</b></div><div className="data-row"><span>Reputation</span><b>{g.gameState.factionReputation}</b></div><div className="data-row"><span>Rank Bonus</span><b>{rank?.bonus}</b></div></div><div className="btn-group"><Button disabled={g.gameState.energy<10} onClick={g.workFaction}>Faction Work (10 ⚡)</Button><Button disabled={g.gameState.energy<15} onClick={g.runFactionMission}>Faction Mission (15 ⚡)</Button><Button onClick={g.leaveFaction}>Leave Faction</Button></div></Panel>}
    <div className="ui-grid three-col">{FACTIONS.map((faction)=>{ const member=current===faction.id; const blocked=Boolean(current)&&!member; return <div className={`card faction-card ${blocked?"disabled":""}`} key={faction.id}><span className="card-tag">{faction.specialty}</span><h3>{faction.id}</h3><p>{faction.description}</p><Button disabled={blocked||member} onClick={()=>g.joinFaction(faction.id)}>{member?"Member":"Join · $500"}</Button></div>; })}</div>
    {current && <Panel title="Faction Reward Shop"><div className="ui-grid two-col">{FACTIONS.find(f=>f.id===current)?.rewards.map((reward)=>{const claimed=g.gameState.factionRewardsClaimed.includes(reward.id); const unlocked=g.gameState.factionReputation>=reward.reputation&&g.gameState.points>=reward.points; return <div className="card" key={reward.id}><h3>{reward.name}</h3><div className="data-row"><span>Requires</span><b>{reward.reputation} rep · {reward.points} points</b></div><Button disabled={claimed||!unlocked} onClick={()=>g.buyFactionReward(reward.id)}>{claimed?"Claimed":unlocked?"Claim Reward":"Locked"}</Button></div>;})}</div></Panel>}
  </>;
}

/* =========================================================
   AWARDS
========================================================= */

export function Awards({ g }: { g: Game }) {
  const awards:{name:string;category:string;unlocked:boolean}[]=[
    {name:"First Crime",category:"Crime",unlocked:g.gameState.crimesCompleted>=1},{name:"Ten Crimes",category:"Crime",unlocked:g.gameState.crimesCompleted>=10},{name:"Heat Seeker",category:"Crime",unlocked:g.gameState.heat>=50},
    {name:"First Victory",category:"Combat",unlocked:g.gameState.fightsWon>=1},{name:"Ten Wins",category:"Combat",unlocked:g.gameState.fightsWon>=10},{name:"Gym Rat",category:"Training",unlocked:g.gameState.gymSessions>=10},
    {name:"Five Figures",category:"Wealth",unlocked:g.gameState.cash>=10000},{name:"Market Player",category:"Wealth",unlocked:(Object.values(g.gameState.inventory) as number[]).reduce((a,b)=>a+b,0)>=25},{name:"Explorer",category:"World",unlocked:g.gameState.locationsVisited.length>=10},
    {name:"Faction Regular",category:"Faction",unlocked:g.gameState.factionReputation>=100},{name:"Career Climber",category:"Jobs",unlocked:g.gameState.jobActions>=10},{name:"Level 10",category:"Progression",unlocked:g.level>=10},
  ];
  return <><Panel title="Milestones & Achievements"><div className="ui-grid three-col">{awards.map(({name,category,unlocked})=>{const claimed=g.gameState.achievements.includes(name);return <div className={`card achievement-card ${unlocked?"unlocked":"locked"}`} key={name}><span className="card-tag">{category}</span><h3>{name}</h3><span className="status-text">{claimed?"Claimed":unlocked?"Unlocked":"Locked"}</span>{unlocked&&!claimed&&<Button onClick={()=>g.earnMerit(name)}>Claim Merit</Button>}</div>;})}</div></Panel><Panel title="Daily Rewards"><div className="data-row"><span>Current Streak</span><b>{g.gameState.dailyStreak} days</b></div><Button onClick={g.claimDaily}>Claim Daily Bonus</Button></Panel></>;
}

/* =========================================================
   PROGRESSION HUB
========================================================= */
export function Progression({ g }: { g: Game }) {
  const activeEvent=WORLD_EVENTS.find(e=>e.id===g.gameState.activeWorldEvent);
  return <>
    <Panel title="Heat / Wanted Level"><div className="data-row"><span>Current Heat</span><b>{g.gameState.heat}/100</b></div><div className="bar-track"><div className="bar-fill mission" style={{width:`${g.gameState.heat}%`}} /></div><p>Higher Heat reduces crime odds and makes the city less forgiving.</p><Button disabled={g.gameState.heat<=0||g.gameState.energy<5} onClick={g.coolHeat}>Lay Low (5 ⚡ · -10 Heat)</Button></Panel>
    <Panel title="Merit Upgrade Tree"><p>Available merits: <b>{g.gameState.merits}</b></p><div className="ui-grid three-col">{MERIT_UPGRADES.map(up=>{const rank=g.gameState.meritUpgrades[up.id]??0; const cost=up.baseCost+rank; return <div className="card" key={up.id}><span className="card-tag">RANK {rank}/{up.maxRank}</span><h3>{up.name}</h3><p>{up.description}</p><div className="data-row"><span>Effect</span><b>{up.effectLabel}</b></div><Button disabled={rank>=up.maxRank||g.gameState.merits<cost} onClick={()=>g.buyMeritUpgrade(up.id)}>{rank>=up.maxRank?"Maxed":`Upgrade · ${cost} merits`}</Button></div>;})}</div></Panel>
    <Panel title="Daily & Weekly Challenges"><div className="ui-grid two-col">{[...DAILY_CHALLENGES,...WEEKLY_CHALLENGES].map(ch=>{const progress=g.getChallengeProgress(ch); const claimed=g.isChallengeClaimed(ch.id); return <div className="card" key={ch.id}><span className="card-tag">{ch.id.startsWith("daily")?"DAILY":"WEEKLY"}</span><h3>{ch.name}</h3><p>{ch.description}</p><div className="bar-track"><div className="bar-fill mission" style={{width:`${Math.min(100,(progress/ch.target)*100)}%`}} /></div><div className="data-row"><span>Progress</span><b>{Math.min(progress,ch.target)}/{ch.target}</b></div><div className="data-row"><span>Rewards</span><b>{money(ch.rewardCash)} · {ch.rewardPoints} pts{ch.rewardMerits?` · ${ch.rewardMerits} merit`:""}</b></div><Button disabled={claimed||progress<ch.target} onClick={()=>g.claimChallenge(ch.id)}>{claimed?"Claimed":progress>=ch.target?"Claim":"In Progress"}</Button></div>;})}</div></Panel>
    <Panel title="World Events">{activeEvent?<div className="card"><span className="card-tag">ACTIVE EVENT</span><h3>{activeEvent.name}</h3><p>{activeEvent.description}</p><div className="data-row"><span>Effect</span><b>{activeEvent.effect}</b></div><div className="data-row"><span>Time Left</span><b>{g.gameState.worldEventUntil?formatTime(Math.max(0,g.gameState.worldEventUntil-Date.now())):"—"}</b></div></div>:<p>No city-wide event is active.</p>}<Button disabled={Boolean(activeEvent)} onClick={g.refreshWorldEvent}>Scan for World Event</Button></Panel>
    <Panel title="RiftCity Contacts"><div className="ui-grid three-col">{NPCS.map(npc=>{const rep=g.gameState.npcReputation[npc.id]??0;return <div className="card" key={npc.id}><span className="card-tag">{npc.role}</span><h3>{npc.name}</h3><p>{npc.description}</p><div className="data-row"><span>Relationship</span><b>{rep}/100</b></div><div className="data-row"><span>Known Area</span><b>{npc.location}</b></div><div className="btn-group"><Button disabled={g.gameState.energy<3} onClick={()=>g.npcInteract(npc.id,true)}>Build Trust</Button><Button disabled={g.gameState.energy<3} onClick={()=>g.npcInteract(npc.id,false)}>Pressure</Button></div></div>;})}</div></Panel>
  </>;
}

