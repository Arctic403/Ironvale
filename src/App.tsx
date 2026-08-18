import React, { useState } from "react";

// Assumes helper components, constants, and types are imported above:
// import { useRiftCity, getLevel, getProperty, getItem, money, MAX_ENERGY, Panel, Button, Screen } from './your-imports';

function App() {
  const g = useRiftCity();
  const levelInfo = getLevel(g.gameState.xp);
  const nav: { id: Screen; label: string; icon: string }[] = [
    { id: "character", label: "Character", icon: "👤" },
    { id: "city", label: "City", icon: "🏙️" },
    { id: "crimes", label: "Crimes", icon: "🕵️" },
    { id: "combat", label: "Combat", icon: "⚔️" },
    { id: "gym", label: "Gym", icon: "🏋️" },
    { id: "jobs", label: "Jobs", icon: "💼" },
    { id: "items", label: "Items", icon: "🎒" },
    { id: "missions", label: "Missions", icon: "📜" },
    { id: "education", label: "Education", icon: "🎓" },
    { id: "property", label: "Property", icon: "🏠" },
    { id: "market", label: "Market", icon: "📈" },
    { id: "faction", label: "Faction", icon: "🛡️" },
    { id: "awards", label: "Awards", icon: "🏆" },
  ];
  const title = nav.find((n) => n.id === g.currentScreen)?.label || "RiftCity";

  return (
    <div className="app-shell">
      {/* App Shell Content */}
    </div>
  );
}

function Character({ g }: { g: ReturnType<typeof useRiftCity> }) {
  const [amount, setAmount] = useState("100");
  const n = Math.max(0, Number(amount) || 0);

  return (
    <div className="grid two">
      <Panel title="Combat Stats">
        <div className="stat-grid">
          {Object.entries(g.gameState.stats).map(([k, v]) => (
            <div className="stat" key={k}>
              <span>{k}</span>
              <strong>{(v as number).toFixed(2)}</strong>
            </div>
          ))}
        </div>
      </Panel>
      <Panel title="Core Resources">
        <div className="resource-grid">
          <div>
            <b>❤️ Health</b>
            <span>
              {Math.floor(g.gameState.health)} / {g.maxHealth}
            </span>
          </div>
          <div>
            <b>⚡ Energy</b>
            <span>
              {g.gameState.energy} / {MAX_ENERGY}
            </span>
          </div>
          <div>
            <b>🧠 Nerve</b>
            <span>
              {g.gameState.nerve} / {g.maxNerve}
            </span>
          </div>
          <div>
            <b>😊 Happiness</b>
            <span>
              {Math.floor(g.gameState.happiness)} /{" "}
              {getProperty(g.gameState.ownedProperty)?.maxHappiness ?? 100}
            </span>
          </div>
        </div>
      </Panel>
      <Panel title="Progress">
        <div className="rows">
          <p>
            <span>Crime experience</span>
            <b>{g.gameState.crimeExperience}</b>
          </p>
          <p>
            <span>Gym experience</span>
            <b>{g.gameState.gymExperience}</b>
          </p>
          <p>
            <span>Crimes</span>
            <b>
              {g.gameState.crimesCompleted} / {g.gameState.crimesFailed} failed
            </b>
          </p>
          <p>
            <span>Fights</span>
            <b>
              {g.gameState.fightsWon}W / {g.gameState.fightsLost}L
            </b>
          </p>
          <p>
            <span>Current job</span>
            <b>{g.job?.title ?? "Unemployed"}</b>
          </p>
          <p>
            <span>Property</span>
            <b>{getProperty(g.gameState.ownedProperty)?.name}</b>
          </p>
        </div>
      </Panel>
      <Panel title="Bank">
        <div className="bank">
          <h3>{money(g.gameState.bank)}</h3>
          <input
            type="number"
            min="0"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
          />
          <div>
            <Button onClick={() => g.bankDeposit(n)}>Deposit</Button>
            <Button onClick={() => g.bankWithdraw(n)}>Withdraw</Button>
          </div>
        </div>
      </Panel>
      <Panel title="Wallet & Equipment">
        <div className="rows">
          <p>
            <span>Cash</span>
            <b>{money(g.gameState.cash)}</b>
          </p>
          <p>
            <span>Weapon</span>
            <b>
              {getItem(g.gameState.equippedWeapon || "")?.name || "None"}
            </b>
          </p>
          <p>
            <span>Armor</span>
            <b>{getItem(g.gameState.equippedArmor || "")?.name || "None"}</b>
          </p>
        </div>
      </Panel>
    </div>
  );
}

export default App;
