import React, { useRef, useState } from "react";
import { CITY_LOCATIONS, type CityLocation } from "../data/cityLocations";
import { LOCATION_TRAITS } from "../data/expansion";
import type { useRiftCity } from "../hooks/useRiftCity";
import { Button } from "../components/ui";
import { money } from "../core/gameCore";

type Game = ReturnType<typeof useRiftCity>;

/* =========================================================
   CITY
   RIFTCITY — INTERACTIVE CITY MAP
========================================================= */

type PointerPoint = {
  x: number;
  y: number;
};

type GestureState = {
  mode: "idle" | "drag" | "pinch";
  startX: number;
  startY: number;
  panX: number;
  panY: number;
  startZoom: number;
  startDistance: number;
  startMidX: number;
  startMidY: number;
  moved: boolean;
};

export function City({ g }: { g: Game }) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [dragging, setDragging] = useState(false);

  const mapRef = useRef<HTMLDivElement | null>(null);

  const pointersRef = useRef(
    new Map<number, PointerPoint>(),
  );

  const gestureRef = useRef<GestureState>({
    mode: "idle",
    startX: 0,
    startY: 0,
    panX: 0,
    panY: 0,
    startZoom: 1,
    startDistance: 0,
    startMidX: 0,
    startMidY: 0,
    moved: false,
  });

  /* =========================================================
     MAP CONSTANTS
  ========================================================= */

  const MAP_WIDTH = 1000;
  const MAP_HEIGHT = 700;

  const MIN_ZOOM = 1;
  const MAX_ZOOM = 2.5;

  /* =========================================================
     ZOOM
  ========================================================= */

  const clampZoom = (value: number) => {
    return Math.min(
      MAX_ZOOM,
      Math.max(MIN_ZOOM, value),
    );
  };

  /* =========================================================
     PAN
     
     Pan is stored in SVG viewBox units.

     At 1x the map fills the viewport, so there is no
     additional world outside the edges.

     As zoom increases, the available pan grows.
  ========================================================= */

  const clampPan = (
    next: { x: number; y: number },
    nextZoom: number,
  ) => {
    const maxX =
      ((nextZoom - 1) * MAP_WIDTH) / 2;

    const maxY =
      ((nextZoom - 1) * MAP_HEIGHT) / 2;

    return {
      x: Math.max(
        -maxX,
        Math.min(maxX, next.x),
      ),

      y: Math.max(
        -maxY,
        Math.min(maxY, next.y),
      ),
    };
  };

  /* =========================================================
     SCREEN → SVG COORDINATES
  ========================================================= */

  const svgPoint = (
    clientX: number,
    clientY: number,
  ): PointerPoint => {
    const svg =
      mapRef.current?.querySelector(
        "svg",
      ) as SVGSVGElement | null;

    if (!svg) {
      return { x: 0, y: 0 };
    }

    const rect =
      svg.getBoundingClientRect();

    if (
      !rect.width ||
      !rect.height
    ) {
      return { x: 0, y: 0 };
    }

    return {
      x:
        ((clientX - rect.left) /
          rect.width) *
        MAP_WIDTH,

      y:
        ((clientY - rect.top) /
          rect.height) *
        MAP_HEIGHT,
    };
  };

  /* =========================================================
     GAME STATE
  ========================================================= */

  const incapacitated = Boolean(
    g.gameState.jailUntil ||
      g.gameState.hospitalUntil,
  );

  const hospitalized = Boolean(
    g.gameState.hospitalUntil,
  );

  const jailed = Boolean(
    g.gameState.jailUntil,
  );

  const selected =
    CITY_LOCATIONS.find(
      (location) =>
        location.id === selectedId,
    ) ?? null;

  const canEnterLocation = (location: CityLocation) =>
    !incapacitated ||
    (jailed && location.id === "jail") ||
    (hospitalized && location.id === "hospital");

  const goTo = (location: CityLocation) => {
    if (!canEnterLocation(location)) return;
    g.visitLocation(location.id);
    if (location.screen) {
      g.setCurrentScreen(location.screen);
    }
  };

  /* =========================================================
     MAP CONTROLS
  ========================================================= */

  const resetMap = () => {
    setZoom(1);
    setPan({
      x: 0,
      y: 0,
    });
    setSelectedId(null);

    gestureRef.current = {
      mode: "idle",
      startX: 0,
      startY: 0,
      panX: 0,
      panY: 0,
      startZoom: 1,
      startDistance: 0,
      startMidX: 0,
      startMidY: 0,
      moved: false,
    };

    pointersRef.current.clear();
    setDragging(false);
  };

  const zoomAtCenter = (
    delta: number,
  ) => {
    setZoom((currentZoom) => {
      const nextZoom =
        clampZoom(
          currentZoom + delta,
        );

      setPan((currentPan) =>
        clampPan(
          currentPan,
          nextZoom,
        ),
      );

      return nextZoom;
    });
  };

  /* =========================================================
     POINTER DOWN
  ========================================================= */

  const onPointerDown = (
    event: React.PointerEvent<HTMLDivElement>,
  ) => {
    /*
     * Only accept the primary mouse button.
     * Touch and pen are always allowed.
     */
    if (
      event.pointerType === "mouse" &&
      event.button !== 0
    ) {
      return;
    }

    event.preventDefault();

    const point = svgPoint(
      event.clientX,
      event.clientY,
    );

    pointersRef.current.set(
      event.pointerId,
      point,
    );

    try {
      event.currentTarget.setPointerCapture(
        event.pointerId,
      );
    } catch {
      /*
       * iOS/Safari can occasionally reject
       * pointer capture. The gesture can still
       * continue without it.
       */
    }

    const points = [
      ...pointersRef.current.values(),
    ];

    /* ---------------------------------------------------------
       SECOND FINGER = PINCH
    --------------------------------------------------------- */

    if (points.length >= 2) {
      const [a, b] = points;

      const distance = Math.max(
        1,
        Math.hypot(
          b.x - a.x,
          b.y - a.y,
        ),
      );

      gestureRef.current = {
        mode: "pinch",

        startX: 0,
        startY: 0,

        panX: pan.x,
        panY: pan.y,

        startZoom: zoom,

        startDistance: distance,

        startMidX:
          (a.x + b.x) / 2,

        startMidY:
          (a.y + b.y) / 2,

        moved: true,
      };

      setDragging(true);

      return;
    }

    /* ---------------------------------------------------------
       FIRST FINGER = DRAG
    --------------------------------------------------------- */

    gestureRef.current = {
      mode: "drag",

      startX: point.x,
      startY: point.y,

      panX: pan.x,
      panY: pan.y,

      startZoom: zoom,

      startDistance: 0,
      startMidX: 0,
      startMidY: 0,

      moved: false,
    };

    setDragging(true);
  };

  /* =========================================================
     POINTER MOVE
  ========================================================= */

  const onPointerMove = (
    event: React.PointerEvent<HTMLDivElement>,
  ) => {
    if (
      !pointersRef.current.has(
        event.pointerId,
      )
    ) {
      return;
    }

    event.preventDefault();

    const point = svgPoint(
      event.clientX,
      event.clientY,
    );

    pointersRef.current.set(
      event.pointerId,
      point,
    );

    const gesture =
      gestureRef.current;

    const points = [
      ...pointersRef.current.values(),
    ];

    /* ---------------------------------------------------------
       PINCH / TWO-FINGER PAN
    --------------------------------------------------------- */

    if (
      points.length >= 2 &&
      gesture.mode === "pinch"
    ) {
      const [a, b] = points;

      const distance = Math.max(
        1,
        Math.hypot(
          b.x - a.x,
          b.y - a.y,
        ),
      );

      const nextZoom =
        clampZoom(
          gesture.startZoom *
            (distance /
              gesture.startDistance),
        );

      const midX =
        (a.x + b.x) / 2;

      const midY =
        (a.y + b.y) / 2;

      const nextPan =
        clampPan(
          {
            x:
              gesture.panX +
              (midX -
                gesture.startMidX),

            y:
              gesture.panY +
              (midY -
                gesture.startMidY),
          },
          nextZoom,
        );

      setZoom(nextZoom);
      setPan(nextPan);

      return;
    }

    /* ---------------------------------------------------------
       ONE-FINGER DRAG
    --------------------------------------------------------- */

    if (
      gesture.mode === "drag"
    ) {
      const currentPoint =
        pointersRef.current.get(
          event.pointerId,
        );

      if (!currentPoint) {
        return;
      }

      const dx =
        currentPoint.x -
        gesture.startX;

      const dy =
        currentPoint.y -
        gesture.startY;

      /*
       * Once movement exceeds a tiny threshold,
       * this is definitely a drag and not a tap.
       */
      if (
        Math.abs(dx) +
          Math.abs(dy) >
        5
      ) {
        gesture.moved = true;
      }

      const nextPan =
        clampPan(
          {
            x:
              gesture.panX + dx,

            y:
              gesture.panY + dy,
          },
          zoom,
        );

      setPan(nextPan);
    }
  };

  /* =========================================================
     POINTER UP / CANCEL
  ========================================================= */

  const stopPointer = (
    event: React.PointerEvent<HTMLDivElement>,
  ) => {
    pointersRef.current.delete(
      event.pointerId,
    );

    try {
      event.currentTarget.releasePointerCapture(
        event.pointerId,
      );
    } catch {
      /*
       * Pointer capture may already have
       * been released by Safari.
       */
    }

    const points = [
      ...pointersRef.current.values(),
    ];

    /* ---------------------------------------------------------
       PINCH → ONE FINGER DRAG
    --------------------------------------------------------- */

    if (points.length === 1) {
      const point = points[0];

      gestureRef.current = {
        mode: "drag",

        startX: point.x,
        startY: point.y,

        panX: pan.x,
        panY: pan.y,

        startZoom: zoom,

        startDistance: 0,
        startMidX: 0,
        startMidY: 0,

        /*
         * A pinch has already moved, so don't
         * accidentally turn the remaining finger
         * into a location click.
         */
        moved: true,
      };

      setDragging(true);

      return;
    }

    /* ---------------------------------------------------------
       ALL POINTERS RELEASED
    --------------------------------------------------------- */

    if (points.length === 0) {
      gestureRef.current.mode =
        "idle";

      /*
       * Delay slightly so the final click event
       * can see gestureRef.current.moved.
       */
      window.setTimeout(() => {
        setDragging(false);
      }, 0);
    }
  };

  /* =========================================================
     WHEEL ZOOM
  ========================================================= */

  const onWheel = (
    event: React.WheelEvent<HTMLDivElement>,
  ) => {
    event.preventDefault();

    zoomAtCenter(
      event.deltaY < 0
        ? 0.12
        : -0.12,
    );
  };

  return (
    <div className="city-page">

      {/* =====================================================
          CITY HEADER
      ===================================================== */}

      <div className="city-header card">
        <div>
          <span className="card-tag">
            RIFTCITY
          </span>

          <h2>The City</h2>

          <p>
            Explore the city, follow the roads, and tap a
            destination to travel there.
          </p>
        </div>

        <div className="city-status">

          <div className="city-status-item">
            <span>💵 Cash</span>

            <strong>
              {money(g.gameState.cash)}
            </strong>
          </div>

          <div className="city-status-item">
            <span>🏦 Bank</span>

            <strong>
              {money(g.gameState.bank)}
            </strong>
          </div>

          <div className="city-status-item">
            <span>⚡ Energy</span>

            <strong>
              {g.gameState.energy}/{g.maxEnergy}
            </strong>
          </div>

        </div>
      </div>

      {/* =====================================================
          INCAPACITATED STATUS
      ===================================================== */}

      {incapacitated && (
        <div
          className={`city-incapacitated ${
            hospitalized
              ? "hospitalized"
              : jailed
                ? "jailed"
                : ""
          }`}
        >
          <span>
            {hospitalized
              ? "🏥"
              : "🚔"}
          </span>

          <div>
            <strong>
              {hospitalized
                ? "You are hospitalized"
                : "You are in jail"}
            </strong>

            <p>
              Other city activities are locked until your current timer expires.
            </p>
            <Button
              onClick={() =>
                g.setCurrentScreen(hospitalized ? "hospital" : "jail")
              }
            >
              Open {hospitalized ? "Hospital" : "Jail"} Record
            </Button>
          </div>
        </div>
      )}

      {/* =====================================================
          CITY MAP
      ===================================================== */}

      <section className="city-map-panel card">

        <div className="city-map-header">

          <div>
            <span className="card-tag">
              CITY MAP
            </span>

            <h3>RiftCity</h3>

            <p className="city-map-subtitle">
              Northside · Downtown · Southside
            </p>
          </div>

          <div className="city-map-tools">

            <span className="city-map-live">
              ● LIVE CITY
            </span>

            <button
              type="button"
              className="city-map-tool"
              onClick={() =>
                zoomAtCenter(0.1)
              }
              aria-label="Zoom in"
            >
              +
            </button>

            <button
              type="button"
              className="city-map-tool"
              onClick={() =>
                zoomAtCenter(-0.1)
              }
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

        {/* ===================================================
            MAP
        =================================================== */}

        <div
          ref={mapRef}
          className={`riftcity-map interactive-map ${
            dragging
              ? "is-dragging"
              : ""
          }`}
          onPointerDown={
            onPointerDown
          }
          onPointerMove={
            onPointerMove
          }
          onPointerUp={
            stopPointer
          }
          onPointerCancel={
            stopPointer
          }
          onWheel={onWheel}
        >

          <svg
            className="riftcity-map-svg"
            viewBox="0 0 1000 700"
            role="application"
            aria-label="Interactive map of RiftCity"
          >

            <g
              className="map-world"
              transform={`translate(${
                500 + pan.x
              } ${
                350 + pan.y
              }) scale(${zoom}) translate(-500 -350)`}
            >

              {/* =================================================
                  MAP GROUND
              ================================================= */}

              <rect
                className="map-ground"
                x="0"
                y="0"
                width="1000"
                height="700"
                rx="28"
              />

              {/* =================================================
                  RIVER
              ================================================= */}

              <path
                className="map-river-shadow"
                d="M-30 120 C160 70 210 190 330 165 C470 135 505 35 640 78 C785 124 770 248 1030 214 L1030 325 C820 355 760 270 630 288 C510 305 470 410 320 390 C185 372 150 285 -30 330 Z"
              />

              <path
                className="map-river"
                d="M-30 110 C160 60 210 180 330 155 C470 125 505 25 640 68 C785 114 770 238 1030 204 L1030 305 C820 345 760 260 630 278 C510 295 470 400 320 380 C185 362 150 275 -30 320 Z"
              />

              {/* =================================================
                  DISTRICTS
              ================================================= */}

              <g className="map-district-labels">
                <text x="75" y="65">
                  NORTHSIDE
                </text>

                <text x="440" y="360">
                  DOWNTOWN
                </text>

                <text x="62" y="660">
                  SOUTHSIDE
                </text>

                <text x="820" y="365">
                  EAST MARKET
                </text>
              </g>

              {/* =================================================
                  ROADS
              ================================================= */}

              <g className="map-roads">

                <path d="M40 210 C220 180 360 220 500 195 C650 170 810 185 960 145" />

                <path d="M40 365 C205 345 330 355 465 340 C625 322 790 340 960 305" />

                <path d="M55 525 C220 500 345 510 500 500 C670 488 805 505 950 470" />

                <path d="M170 50 C150 180 180 300 210 430 C235 535 210 625 195 680" />

                <path d="M505 40 C485 160 515 255 500 365 C485 480 520 575 505 675" />

                <path d="M820 35 C790 160 815 260 800 360 C785 470 815 565 790 680" />

                <path d="M300 80 C365 170 390 250 365 340 C345 420 370 515 425 610" />

              </g>

              {/* =================================================
                  ROAD LABELS
              ================================================= */}

              <g className="map-road-labels">

                <text x="95" y="194">
                  RIVERSIDE AVE
                </text>

                <text x="82" y="350">
                  CENTRAL AVE
                </text>

                <text x="85" y="492">
                  SOUTH AVE
                </text>

                <text x="180" y="110">
                  NORTH ST
                </text>

                <text x="512" y="110">
                  MAIN ST
                </text>

                <text x="826" y="110">
                  EAST ST
                </text>

              </g>

              {/* =================================================
                  CITY BLOCKS
              ================================================= */}

              <g className="map-blocks">

                <rect
                  x="70"
                  y="245"
                  width="120"
                  height="72"
                  rx="10"
                />

                <rect
                  x="235"
                  y="235"
                  width="125"
                  height="82"
                  rx="10"
                />

                <rect
                  x="410"
                  y="235"
                  width="115"
                  height="72"
                  rx="10"
                />

                <rect
                  x="570"
                  y="225"
                  width="125"
                  height="82"
                  rx="10"
                />

                <rect
                  x="745"
                  y="225"
                  width="145"
                  height="82"
                  rx="10"
                />

                <rect
                  x="80"
                  y="405"
                  width="120"
                  height="72"
                  rx="10"
                />

                <rect
                  x="245"
                  y="400"
                  width="110"
                  height="70"
                  rx="10"
                />

                <rect
                  x="595"
                  y="390"
                  width="120"
                  height="72"
                  rx="10"
                />

                <rect
                  x="760"
                  y="380"
                  width="130"
                  height="82"
                  rx="10"
                />

                <rect
                  x="70"
                  y="555"
                  width="125"
                  height="65"
                  rx="10"
                />

                <rect
                  x="250"
                  y="550"
                  width="120"
                  height="70"
                  rx="10"
                />

                <rect
                  x="585"
                  y="545"
                  width="135"
                  height="70"
                  rx="10"
                />

                <rect
                  x="765"
                  y="535"
                  width="140"
                  height="75"
                  rx="10"
                />

              </g>

              {/* =================================================
                  CENTRAL PARK
              ================================================= */}

              <g className="map-park">

                <ellipse
                  cx="500"
                  cy="135"
                  rx="105"
                  ry="52"
                />

                <path d="M430 135 Q500 92 570 135 Q500 177 430 135Z" />

                <text
                  x="500"
                  y="140"
                >
                  CENTRAL PARK
                </text>

              </g>

              {/* =================================================
                  BRIDGE
              ================================================= */}

              <g className="map-bridge">

                <rect
                  x="425"
                  y="172"
                  width="150"
                  height="30"
                  rx="8"
                />

                <line
                  x1="445"
                  y1="172"
                  x2="445"
                  y2="202"
                />

                <line
                  x1="475"
                  y1="172"
                  x2="475"
                  y2="202"
                />

                <line
                  x1="505"
                  y1="172"
                  x2="505"
                  y2="202"
                />

                <line
                  x1="535"
                  y1="172"
                  x2="535"
                  y2="202"
                />

                <line
                  x1="565"
                  y1="172"
                  x2="565"
                  y2="202"
                />

              </g>

              {/* =================================================
                  LANDMARKS
              ================================================= */}

              <g className="map-landmarks">

                <circle
                  cx="925"
                  cy="90"
                  r="18"
                />

                <text
                  x="925"
                  y="95"
                >
                  ⚓
                </text>

                <circle
                  cx="100"
                  cy="600"
                  r="18"
                />

                <text
                  x="100"
                  y="605"
                >
                  🚉
                </text>

              </g>

              {/* =================================================
                  CITY LOCATIONS
              ================================================= */}

              {CITY_LOCATIONS.map(
                (location) => {
                  const x =
                    (Number.parseFloat(
                      location.x,
                    ) /
                      100) *
                    MAP_WIDTH;

                  const y =
                    (Number.parseFloat(
                      location.y,
                    ) /
                      100) *
                    MAP_HEIGHT;

                  const active = selectedId === location.id;
                  const isCurrent = g.gameState.currentLocation === location.id;
                  const isVisited = g.gameState.locationsVisited.includes(location.id);

                  return (
                    <g
                      key={location.id}
                      className={`map-location ${
                        active ? "is-selected" : ""
                      } ${isCurrent ? "is-current" : ""} ${isVisited ? "is-visited" : ""}`}
                      transform={`translate(${x} ${y})`}
                      onClick={() => {
                        /*
                         * IMPORTANT:
                         * A location can be tapped,
                         * but dragging across it must
                         * NOT select it.
                         */
                        if (
                          !gestureRef.current
                            .moved
                        ) {
                          setSelectedId(
                            location.id,
                          );
                        }
                      }}
                      role="button"
                      tabIndex={0}
                      aria-label={
                        location.name
                      }
                      onKeyDown={(
                        event,
                      ) => {
                        if (event.key === "Enter") {
                          event.preventDefault();
                          goTo(location);
                        } else if (event.key === " ") {
                          event.preventDefault();
                          setSelectedId(location.id);
                        }
                      }}
                    >

                      <circle
                        className="map-location-halo"
                        r="31"
                      />

                      <rect
                        className="map-building"
                        x="-29"
                        y="-25"
                        width="58"
                        height="50"
                        rx="10"
                      />

                      <text
                        className="map-location-icon"
                        x="0"
                        y="7"
                        textAnchor="middle"
                      >
                        {
                          location.icon
                        }
                      </text>

                      <text
                        className="map-location-label"
                        x="0"
                        y="43"
                        textAnchor="middle"
                      >
                        {
                          location.name
                        }
                      </text>

                      <circle
                        className="map-location-dot"
                        cx="24"
                        cy="-22"
                        r="5"
                      />

                    </g>
                  );
                },
              )}

              {/* =================================================
                  PLAYER MARKER
              ================================================= */}

              <g
                className="player-marker"
                transform="translate(500 365)"
              >

                <circle
                  className="player-pulse"
                  r="25"
                />

                <circle
                  className="player-dot"
                  r="9"
                />

                <text
                  x="0"
                  y="-17"
                  textAnchor="middle"
                >
                  YOU
                </text>

              </g>

              {/* =================================================
                  COMPASS
              ================================================= */}

              <g
                className="map-compass"
                transform="translate(925 610)"
              >

                <circle r="34" />

                <text
                  x="0"
                  y="-14"
                  textAnchor="middle"
                >
                  N
                </text>

                <text
                  x="0"
                  y="22"
                  textAnchor="middle"
                >
                  S
                </text>

                <text
                  x="-18"
                  y="5"
                  textAnchor="middle"
                >
                  W
                </text>

                <text
                  x="18"
                  y="5"
                  textAnchor="middle"
                >
                  E
                </text>

              </g>

            </g>
          </svg>

          {/* ===================================================
              MAP HINT
          =================================================== */}

          <div className="map-drag-hint">
            <span>✋</span>
            Drag to explore · Scroll or use + / − to zoom
          </div>

          {/* ===================================================
              LOCATION PANEL
          =================================================== */}

          {selected && (
            <div className="map-location-panel">

              <button
                type="button"
                className="map-location-close"
                onClick={() =>
                  setSelectedId(null)
                }
                aria-label="Close location details"
              >
                ×
              </button>

              <div className="map-location-panel-icon">
                {
                  selected.icon
                }
              </div>

              <div className="map-location-panel-copy">

                <span>
                  {
                    selected.district
                  }
                </span>

                <h4>
                  {
                    selected.name
                  }
                </h4>

                <p>{selected.description}</p>
                <div className="map-location-status-row">
                  {g.gameState.currentLocation === selected.id && <span className="map-status-chip current">YOU ARE HERE</span>}
                  {g.gameState.locationsVisited.includes(selected.id) && <span className="map-status-chip">VISITED</span>}
                  {!g.gameState.locationsVisited.includes(selected.id) && <span className="map-status-chip new">NEW</span>}
                </div>
                {LOCATION_TRAITS[selected.id] && (
                  <p className="status-text"><b>Local Effect:</b> {LOCATION_TRAITS[selected.id]}</p>
                )}

                <Button
                  disabled={!canEnterLocation(selected)}
                  onClick={() =>
                    goTo(selected)
                  }
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
