import React, { useEffect, useRef, useState } from "react";
import { CITY_LOCATIONS, type CityLocation } from "../data/cityLocations";
import { LOCATION_TRAITS } from "../data/expansion";
import type { useRiftCity } from "../hooks/useRiftCity";
import { Button } from "../components/ui";
import { money } from "../core/gameCore";
import masterMapImage from "../assets/riftcity-master-map.jpeg";

type Game = ReturnType<typeof useRiftCity>;

type MasterMapLocation = CityLocation & { future?: boolean };

const MASTER_MAP_POSITIONS: Record<string, { x: number; y: number }> = {
  hospital: { x: 10.6, y: 18.9 }, police: { x: 28.0, y: 17.0 }, bank: { x: 40.7, y: 17.5 },
  university: { x: 52.3, y: 17.3 }, airport: { x: 66.3, y: 18.9 }, park: { x: 36.6, y: 32.2 },
  property: { x: 21.5, y: 35.3 }, jobs: { x: 54.1, y: 33.4 }, downtown: { x: 33.1, y: 48.9 },
  pharmacy: { x: 8.1, y: 35.2 }, casino: { x: 48.1, y: 46.9 }, shops: { x: 61.9, y: 49.9 },
  "black-market": { x: 70.9, y: 44.5 }, market: { x: 66.3, y: 65.3 }, gym: { x: 9.3, y: 48.8 },
  jail: { x: 6.3, y: 60.9 }, crime: { x: 5.9, y: 73.5 }, combat: { x: 28.5, y: 71.3 },
  missions: { x: 46.0, y: 70.9 },
};

const FUTURE_MAP_LOCATIONS: MasterMapLocation[] = [
  { id: "chop-shop", name: "Chop Shop / Auto Garage", icon: "🚗", description: "Vehicle work, parts, repairs, customization, and future underground auto activity.", district: "Industrial District", x: "20.5%", y: "53.9%", future: true },
  { id: "courthouse", name: "Courthouse", icon: "⚖️", description: "Future legal cases, fines, warrants, hearings, and justice-system gameplay.", district: "Justice District", x: "22.2%", y: "58.9%", future: true },
  { id: "company-plaza", name: "Player Company Plaza", icon: "🏢", description: "Future headquarters for player-owned companies, hiring, management, and business competition.", district: "Business District", x: "27.6%", y: "59.0%", future: true },
  { id: "transit", name: "Transit Station", icon: "🚆", description: "Future city transit and regional travel connections.", district: "Downtown", x: "34.2%", y: "58.9%", future: true },
  { id: "safehouse", name: "Safehouse Block", icon: "🔐", description: "Future private safehouses, stash storage, protection, and criminal utility.", district: "Downtown", x: "39.7%", y: "58.9%", future: true },
  { id: "luxury-mall", name: "Luxury Mall", icon: "💎", description: "Future premium shopping, rare goods, fashion, collectibles, and high-end services.", district: "Commercial District", x: "45.7%", y: "58.9%", future: true },
  { id: "pawn-loan", name: "Pawn & Loan", icon: "💵", description: "Future pawn sales, loans, valuables, and quick-cash services.", district: "Commercial District", x: "50.5%", y: "58.9%", future: true },
  { id: "nightlife", name: "Nightlife Strip", icon: "🍸", description: "Future clubs, social events, nightlife jobs, encounters, and entertainment.", district: "Entertainment District", x: "55.3%", y: "58.9%", future: true },
  { id: "harbor", name: "Harbor Docks / Dock Union Port", icon: "⚓", description: "Future cargo, smuggling, logistics, faction work, shipping, and trade routes.", district: "Harbor District", x: "15.9%", y: "81.7%", future: true },
  { id: "warehouses", name: "Warehouse District", icon: "🏭", description: "Future storage, logistics, company inventory, cargo contracts, and crime opportunities.", district: "Warehouse District", x: "36.5%", y: "81.8%", future: true },
  { id: "iron-hq", name: "Iron Syndicate HQ", icon: "☠️", description: "Future headquarters and deeper progression for the Iron Syndicate.", district: "Faction Row", x: "51.1%", y: "82.2%", future: true },
  { id: "guard-hq", name: "Rift Guard Barracks", icon: "🛡️", description: "Future headquarters and deeper progression for the Rift Guard.", district: "Faction Row", x: "56.1%", y: "82.2%", future: true },
  { id: "dock-union-hq", name: "Dock Union Hall", icon: "⚓", description: "Future headquarters and deeper progression for the Dock Union.", district: "Faction Row", x: "61.2%", y: "82.2%", future: true },
];

const MASTER_DISTRICTS = [
  { name: "Medical District", x: 1, y: 10, w: 20, h: 31 },
  { name: "Northside", x: 22, y: 9, w: 12, h: 20 },
  { name: "Financial District", x: 34, y: 9, w: 13, h: 20 },
  { name: "University District", x: 47, y: 9, w: 12, h: 20 },
  { name: "Airport District", x: 59, y: 8, w: 17, h: 28 },
  { name: "Central District", x: 27, y: 24, w: 20, h: 18 },
  { name: "Residential District", x: 14, y: 27, w: 15, h: 18 },
  { name: "Business District", x: 48, y: 26, w: 15, h: 18 },
  { name: "Downtown", x: 25, y: 41, w: 18, h: 19 },
  { name: "Entertainment District", x: 42, y: 40, w: 15, h: 18 },
  { name: "Commercial District", x: 56, y: 40, w: 14, h: 20 },
  { name: "East Market", x: 68, y: 34, w: 8, h: 22 },
  { name: "Industrial District", x: 1, y: 42, w: 22, h: 17 },
  { name: "Justice District", x: 1, y: 56, w: 18, h: 14 },
  { name: "Underground District", x: 1, y: 68, w: 17, h: 16 },
  { name: "Combat District", x: 22, y: 66, w: 20, h: 15 },
  { name: "Operations District", x: 41, y: 65, w: 20, h: 15 },
  { name: "Market District", x: 60, y: 56, w: 16, h: 18 },
  { name: "Harbor District", x: 7, y: 78, w: 21, h: 17 },
  { name: "Warehouse District", x: 29, y: 78, w: 16, h: 17 },
  { name: "Faction Row", x: 46, y: 77, w: 21, h: 18 },
];


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
  const [selectedDistrict, setSelectedDistrict] = useState<string | null>(null);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [dragging, setDragging] = useState(false);

  useEffect(() => {
    try {
      const saved = window.sessionStorage.getItem("riftcity-map-view");
      if (!saved) return;
      const parsed = JSON.parse(saved) as {
        selectedId?: string | null;
        zoom?: number;
        pan?: { x?: number; y?: number };
      };
      if (typeof parsed.zoom === "number") {
        setZoom(parsed.zoom);
      }
      if (parsed.pan && typeof parsed.pan.x === "number" && typeof parsed.pan.y === "number") {
        setPan({ x: parsed.pan.x, y: parsed.pan.y });
      }
      if (typeof parsed.selectedId === "string" || parsed.selectedId === null) {
        setSelectedId(parsed.selectedId ?? null);
      }
    } catch {
      /* ignore map view restore failures */
    }
  }, []);

  useEffect(() => {
    try {
      window.sessionStorage.setItem(
        "riftcity-map-view",
        JSON.stringify({ selectedId, zoom, pan }),
      );
    } catch {
      /* ignore map view save failures */
    }
  }, [selectedId, zoom, pan]);

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
  const MAP_HEIGHT = 750;

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

  const allMapLocations: MasterMapLocation[] = [...CITY_LOCATIONS, ...FUTURE_MAP_LOCATIONS];

  const selected =
    allMapLocations.find(
      (location) => location.id === selectedId,
    ) ?? null;

  const currentLocation =
    CITY_LOCATIONS.find(
      (location) =>
        location.id === g.gameState.currentLocation,
    ) ?? null;

  const quickAccess = CITY_LOCATIONS.filter((location) =>
    ["bank", "downtown", "shops", "missions", "hospital", "jail"].includes(location.id),
  );

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

  useEffect(() => {
    setSelectedId((current) => current ?? g.gameState.currentLocation);
    setSelectedDistrict(null);
  }, [g.gameState.currentLocation]);

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
    setSelectedDistrict(null);

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

    // On touch screens, keep one-finger vertical scrolling available.
    // Mouse/pen still use the custom drag system; two-finger touch can still
    // transition into the pinch path when a second pointer arrives.
    if (event.pointerType !== "touch") {
      event.preventDefault();
    }

    const point = svgPoint(
      event.clientX,
      event.clientY,
    );

    pointersRef.current.set(
      event.pointerId,
      point,
    );

    try {
      if (event.pointerType !== "touch") {
        event.currentTarget.setPointerCapture(
          event.pointerId,
        );
      }
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

    // A single finger is reserved for normal page scrolling on mobile.
    // This prevents the map from trapping the user at the bottom of the page.
    if (event.pointerType === "touch" && pointersRef.current.size === 1) {
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

      <div className="city-header card city-overview-card">
        <div>
          <span className="card-tag">RIFTCITY HUB</span>

          <h2>The City</h2>

          <p>
            Jump into any district, use the quick access shortcuts, or tap a marker for more details.
          </p>
        </div>

        <div className="city-status compact">
          <div className="city-status-item">
            <span>Current District</span>
            <strong>{currentLocation?.district ?? "Unknown"}</strong>
          </div>

          <div className="city-status-item">
            <span>Visited</span>
            <strong>{g.gameState.locationsVisited.length}/{CITY_LOCATIONS.length}</strong>
          </div>

          <div className="city-status-item">
            <span>Heat Level</span>
            <strong>{g.gameState.heat ?? 0}</strong>
          </div>
        </div>
      </div>

      <div className="city-quickbar">
        {quickAccess.map((location) => (
          <button
            key={location.id}
            type="button"
            className={`city-quick-access ${g.gameState.currentLocation === location.id ? "active" : ""}`}
            disabled={!canEnterLocation(location)}
            onClick={() => {
              setSelectedId(location.id);
              goTo(location);
            }}
          >
            <span>{location.icon}</span>
            <strong>{location.name}</strong>
            <small>{location.district}</small>
          </button>
        ))}
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

            <h3>RiftCity Tactical Map</h3>

            <p className="city-map-subtitle">
              Select a district, inspect a location, and enter instantly
            </p>
          </div>

          <div className="city-map-tools">

            <span className="city-map-live">
              ● TACTICAL VIEW
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
            className="riftcity-map-svg master-map-svg"
            viewBox="0 0 1000 750"
            role="application"
            aria-label="Interactive RiftCity master map"
          >
            <g
              className="map-world master-map-world"
              transform={`translate(${500 + pan.x} ${375 + pan.y}) scale(${zoom}) translate(-500 -375)`}
            >
              <image
                href={masterMapImage}
                x="0"
                y="0"
                width="1000"
                height="750"
                preserveAspectRatio="xMidYMid meet"
                className="master-map-image"
              />

              {MASTER_DISTRICTS.map((district) => (
                <rect
                  key={district.name}
                  className="master-district-hotspot"
                  x={(district.x / 100) * MAP_WIDTH}
                  y={(district.y / 100) * MAP_HEIGHT}
                  width={(district.w / 100) * MAP_WIDTH}
                  height={(district.h / 100) * MAP_HEIGHT}
                  rx="18"
                  role="button"
                  tabIndex={0}
                  aria-label={`Open ${district.name}`}
                  onClick={() => {
                    if (!gestureRef.current.moved) {
                      setSelectedId(null);
                      setSelectedDistrict(district.name);
                    }
                  }}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      setSelectedId(null);
                      setSelectedDistrict(district.name);
                    }
                  }}
                />
              ))}

              {allMapLocations.map((location) => {
                const configured = MASTER_MAP_POSITIONS[location.id];
                const xPercent = configured?.x ?? Number.parseFloat(location.x);
                const yPercent = configured?.y ?? Number.parseFloat(location.y);
                const x = (xPercent / 100) * MAP_WIDTH;
                const y = (yPercent / 100) * MAP_HEIGHT;
                const active = selectedId === location.id;
                const isCurrent = !location.future && g.gameState.currentLocation === location.id;

                return (
                  <g
                    key={location.id}
                    className={`master-map-location ${active ? "is-selected" : ""} ${isCurrent ? "is-current" : ""} ${location.future ? "is-future" : ""}`}
                    transform={`translate(${x} ${y})`}
                    role="button"
                    tabIndex={0}
                    aria-label={`${location.name}${location.future ? ", future expansion" : ""}`}
                    onClick={() => {
                      if (!gestureRef.current.moved) {
                        setSelectedDistrict(null);
                        setSelectedId(location.id);
                      }
                    }}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        setSelectedDistrict(null);
                        setSelectedId(location.id);
                      }
                    }}
                  >
                    <circle className="master-map-hit-target" r={location.future ? 22 : 27} />
                    {(active || isCurrent) && <circle className="master-map-selection-ring" r={location.future ? 23 : 29} />}
                  </g>
                );
              })}
            </g>
          </svg>

          {/* ===================================================
              MAP HINT
          =================================================== */}

          <div className="map-drag-hint">
            <span>✋</span>
            Tap a map location or district · Drag to explore · Pinch / + / − to zoom
          </div>


        </div>

        {/* ===================================================
              LOCATION PANEL
          =================================================== */}

          {selected && (
            <div className={`map-location-panel master-map-popup ${selected.future ? "future" : "live"}`}>
              <button
                type="button"
                className="map-location-close"
                onClick={() => setSelectedId(null)}
                aria-label="Close location details"
              >×</button>

              <div className="map-location-panel-icon">{selected.icon}</div>
              <div className="map-location-panel-copy">
                <span>{selected.future ? "FUTURE EXPANSION · " : "LIVE NOW · "}{selected.district}</span>
                <h4>{selected.name}</h4>
                <p>{selected.description}</p>

                {!selected.future && (
                  <div className="map-location-status-row">
                    {g.gameState.currentLocation === selected.id && <span className="map-status-chip current">YOU ARE HERE</span>}
                    {g.gameState.locationsVisited.includes(selected.id) && <span className="map-status-chip">VISITED</span>}
                    {!g.gameState.locationsVisited.includes(selected.id) && <span className="map-status-chip new">NEW</span>}
                  </div>
                )}

                {!selected.future && LOCATION_TRAITS[selected.id] && (
                  <p className="status-text"><b>Local Effect:</b> {LOCATION_TRAITS[selected.id]}</p>
                )}

                {selected.future ? (
                  <div className="master-map-coming-soon">COMING SOON · Reserved in the city map for a future system.</div>
                ) : (
                  <Button
                    disabled={!canEnterLocation(selected)}
                    onClick={() => goTo(selected)}
                  >
                    Enter Location
                  </Button>
                )}
              </div>
            </div>
          )}

          {selectedDistrict && !selected && (
            <div className="map-location-panel master-map-popup district-popup">
              <button
                type="button"
                className="map-location-close"
                onClick={() => setSelectedDistrict(null)}
                aria-label="Close district details"
              >×</button>
              <div className="map-location-panel-icon">🏙️</div>
              <div className="map-location-panel-copy">
                <span>DISTRICT</span>
                <h4>{selectedDistrict}</h4>
                <p>Select a location inside this district.</p>
                <div className="district-location-list">
                  {allMapLocations.filter((location) => location.district === selectedDistrict).map((location) => (
                    <button
                      key={location.id}
                      type="button"
                      className="district-location-choice"
                      onClick={() => {
                        setSelectedDistrict(null);
                        setSelectedId(location.id);
                      }}
                    >
                      <span>{location.icon}</span>
                      <strong>{location.name}</strong>
                      <small>{location.future ? "Future" : "Live"}</small>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}


      </section>

      <button
        type="button"
        className="city-map-back-top"
        onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
        aria-label="Back to city menu"
      >
        ↑ City Menu
      </button>
    </div>
  );
}
