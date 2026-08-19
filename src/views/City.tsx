import type { Game } from "./GameScreens";
import React, { useState } from "react";
import { CITY_LOCATIONS, type CityLocation } from "../data/cityLocations";
import type { useRiftCity } from "../hooks/useRiftCity";
/* =========================================================
   CITY
   RIFTCITY — INTERACTIVE CITY MAP
========================================================= */

export function City({ g }: { g: Game }) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [dragging, setDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });

  const incapacitated = Boolean(
    g.gameState.jailUntil || g.gameState.hospitalUntil
  );
  const hospitalized = Boolean(g.gameState.hospitalUntil);
  const jailed = Boolean(g.gameState.jailUntil);

  const selected =
    CITY_LOCATIONS.find((location) => location.id === selectedId) ??
    null;

  const goTo = (screen?: CityLocation["screen"]) => {
  if (!incapacitated && screen) {
    g.setCurrentScreen(screen);
  }
};

  const clampZoom = (value: number) =>
    Math.min(1.65, Math.max(0.72, value));

  const resetMap = () => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
  };

  const zoomAtCenter = (delta: number) => {
    setZoom((current) => clampZoom(current + delta));
  };

  const onPointerDown = (event: React.PointerEvent<SVGSVGElement>) => {
    if (event.button !== 0) return;
    setDragging(true);
    setDragStart({
      x: event.clientX - pan.x,
      y: event.clientY - pan.y,
    });
    event.currentTarget.setPointerCapture?.(event.pointerId);
  };

  const onPointerMove = (event: React.PointerEvent<SVGSVGElement>) => {
    if (!dragging) return;
    setPan({
      x: event.clientX - dragStart.x,
      y: event.clientY - dragStart.y,
    });
  };

  const stopDragging = () => setDragging(false);

  const onWheel = (event: React.WheelEvent<SVGSVGElement>) => {
    event.preventDefault();
    zoomAtCenter(event.deltaY < 0 ? 0.08 : -0.08);
  };

  return (
    <div className="city-page">
      <div className="city-header card">
        <div>
          <span className="card-tag">RIFTCITY</span>
          <h2>The City</h2>
          <p>
            Explore the city, follow the roads, and tap a destination to
            travel there.
          </p>
        </div>

        <div className="city-status">
          <div className="city-status-item">
            <span>💵 Cash</span>
            <strong>{money(g.gameState.cash)}</strong>
          </div>
          <div className="city-status-item">
            <span>🏦 Bank</span>
            <strong>{money(g.gameState.bank)}</strong>
          </div>
          <div className="city-status-item">
            <span>⚡ Energy</span>
            <strong>
              {g.gameState.energy}/{MAX_ENERGY}
            </strong>
          </div>
        </div>
      </div>

      {incapacitated && (
        <div
          className={`city-incapacitated ${
            hospitalized ? "hospitalized" : jailed ? "jailed" : ""
          }`}
        >
          <span>{hospitalized ? "🏥" : "🚔"}</span>
          <div>
            <strong>
              {hospitalized ? "You are hospitalized" : "You are in jail"}
            </strong>
            <p>
              You cannot access city activities until your current timer
              expires.
            </p>
          </div>
        </div>
      )}

      <section className="city-map-panel card">
        <div className="city-map-header">
          <div>
            <span className="card-tag">CITY MAP</span>
            <h3>RiftCity</h3>
            <p className="city-map-subtitle">
              Northside · Downtown · Southside
            </p>
          </div>

          <div className="city-map-tools">
            <span className="city-map-live">● LIVE CITY</span>
            <button
              type="button"
              className="city-map-tool"
              onClick={() => zoomAtCenter(0.1)}
              aria-label="Zoom in"
            >
              +
            </button>
            <button
              type="button"
              className="city-map-tool"
              onClick={() => zoomAtCenter(-0.1)}
              aria-label="Zoom out"
            >
              −
            </button>
            <button
              type="button"
              className="city-map-tool city-map-reset"
              onClick={resetMap}
            >
              Reset
            </button>
          </div>
        </div>

        <div className={`riftcity-map interactive-map ${dragging ? "is-dragging" : ""}`}>
          <svg
            className="riftcity-map-svg"
            viewBox="0 0 1000 700"
            role="application"
            aria-label="Interactive map of RiftCity"
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={stopDragging}
            onPointerCancel={stopDragging}
            onWheel={onWheel}
          >
            <g
              className="map-world"
              transform={`translate(${500 + pan.x / 2} ${350 + pan.y / 2}) scale(${zoom}) translate(-500 -350)`}
            >
              <rect className="map-ground" x="0" y="0" width="1000" height="700" rx="28" />

              <path
                className="map-river-shadow"
                d="M-30 120 C160 70 210 190 330 165 C470 135 505 35 640 78 C785 124 770 248 1030 214 L1030 325 C820 355 760 270 630 288 C510 305 470 410 320 390 C185 372 150 285 -30 330 Z"
              />
              <path
                className="map-river"
                d="M-30 110 C160 60 210 180 330 155 C470 125 505 25 640 68 C785 114 770 238 1030 204 L1030 305 C820 345 760 260 630 278 C510 295 470 400 320 380 C185 362 150 275 -30 320 Z"
              />

              <g className="map-district-labels">
                <text x="75" y="65">NORTHSIDE</text>
                <text x="440" y="360">DOWNTOWN</text>
                <text x="62" y="660">SOUTHSIDE</text>
                <text x="820" y="365">EAST MARKET</text>
              </g>

              <g className="map-roads">
                <path d="M40 210 C220 180 360 220 500 195 C650 170 810 185 960 145" />
                <path d="M40 365 C205 345 330 355 465 340 C625 322 790 340 960 305" />
                <path d="M55 525 C220 500 345 510 500 500 C670 488 805 505 950 470" />
                <path d="M170 50 C150 180 180 300 210 430 C235 535 210 625 195 680" />
                <path d="M505 40 C485 160 515 255 500 365 C485 480 520 575 505 675" />
                <path d="M820 35 C790 160 815 260 800 360 C785 470 815 565 790 680" />
                <path d="M300 80 C365 170 390 250 365 340 C345 420 370 515 425 610" />
              </g>

              <g className="map-road-labels">
                <text x="95" y="194">RIVERSIDE AVE</text>
                <text x="82" y="350">CENTRAL AVE</text>
                <text x="85" y="492">SOUTH AVE</text>
                <text x="180" y="110">NORTH ST</text>
                <text x="512" y="110">MAIN ST</text>
                <text x="826" y="110">EAST ST</text>
              </g>

              <g className="map-blocks">
                <rect x="70" y="245" width="120" height="72" rx="10" />
                <rect x="235" y="235" width="125" height="82" rx="10" />
                <rect x="410" y="235" width="115" height="72" rx="10" />
                <rect x="570" y="225" width="125" height="82" rx="10" />
                <rect x="745" y="225" width="145" height="82" rx="10" />
                <rect x="80" y="405" width="120" height="72" rx="10" />
                <rect x="245" y="400" width="110" height="70" rx="10" />
                <rect x="595" y="390" width="120" height="72" rx="10" />
                <rect x="760" y="380" width="130" height="82" rx="10" />
                <rect x="70" y="555" width="125" height="65" rx="10" />
                <rect x="250" y="550" width="120" height="70" rx="10" />
                <rect x="585" y="545" width="135" height="70" rx="10" />
                <rect x="765" y="535" width="140" height="75" rx="10" />
              </g>

              <g className="map-park">
                <ellipse cx="500" cy="135" rx="105" ry="52" />
                <path d="M430 135 Q500 92 570 135 Q500 177 430 135Z" />
                <text x="500" y="140">CENTRAL PARK</text>
              </g>

              <g className="map-bridge">
                <rect x="425" y="172" width="150" height="30" rx="8" />
                <line x1="445" y1="172" x2="445" y2="202" />
                <line x1="475" y1="172" x2="475" y2="202" />
                <line x1="505" y1="172" x2="505" y2="202" />
                <line x1="535" y1="172" x2="535" y2="202" />
                <line x1="565" y1="172" x2="565" y2="202" />
              </g>

              <g className="map-landmarks">
                <circle cx="925" cy="90" r="18" />
                <text x="925" y="95">⚓</text>
                <circle cx="100" cy="600" r="18" />
                <text x="100" y="605">🚉</text>
              </g>

              {CITY_LOCATIONS.map((location) => {
                const x = (Number.parseFloat(location.x) / 100) * 1000;
                const y = (Number.parseFloat(location.y) / 100) * 700;
                const active = selectedId === location.id;

                return (
                  <g
                    key={location.id}
                    className={`map-location ${active ? "is-selected" : ""}`}
                    transform={`translate(${x} ${y})`}
                    onPointerDown={(event) => event.stopPropagation()}
                    onClick={() => setSelectedId(location.id)}
                    role="button"
                    tabIndex={0}
                    aria-label={location.name}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        setSelectedId(location.id);
                      }
                    }}
                  >
                    <circle className="map-location-halo" r="31" />
                    <rect className="map-building" x="-29" y="-25" width="58" height="50" rx="10" />
                    <text className="map-location-icon" x="0" y="7" textAnchor="middle">
                      {location.icon}
                    </text>
                    <text className="map-location-label" x="0" y="43" textAnchor="middle">
                      {location.name}
                    </text>
                    <circle className="map-location-dot" cx="24" cy="-22" r="5" />
                  </g>
                );
              })}

              <g className="player-marker" transform="translate(500 365)">
                <circle className="player-pulse" r="25" />
                <circle className="player-dot" r="9" />
                <text x="0" y="-17" textAnchor="middle">YOU</text>
              </g>

              <g className="map-compass" transform="translate(925 610)">
                <circle r="34" />
                <text x="0" y="-14" textAnchor="middle">N</text>
                <text x="0" y="22" textAnchor="middle">S</text>
                <text x="-18" y="5" textAnchor="middle">W</text>
                <text x="18" y="5" textAnchor="middle">E</text>
              </g>
            </g>
          </svg>

          <div className="map-drag-hint">
            <span>✋</span> Drag to explore · Scroll or use + / − to zoom
          </div>

          {selected && (
            <div className="map-location-panel">
              <button
                type="button"
                className="map-location-close"
                onClick={() => setSelectedId(null)}
                aria-label="Close location details"
              >
                ×
              </button>
              <div className="map-location-panel-icon">{selected.icon}</div>
              <div className="map-location-panel-copy">
                <span>{selected.district}</span>
                <h4>{selected.name}</h4>
                <p>{selected.description}</p>
                <Button
                  disabled={incapacitated}
                  onClick={() => goTo(selected.screen)}
                >
                  Enter Location
                </Button>
              </div>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}

