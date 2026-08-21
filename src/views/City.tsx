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
  hospital: { x: 13.44, y: 10.98 }, police: { x: 35.50, y: 8.68 }, bank: { x: 51.61, y: 9.28 },
  university: { x: 66.31, y: 9.04 }, airport: { x: 84.07, y: 10.98 }, park: { x: 46.41, y: 27.10 },
  property: { x: 27.26, y: 30.86 }, jobs: { x: 68.60, y: 28.55 }, downtown: { x: 41.97, y: 47.34 },
  pharmacy: { x: 10.27, y: 30.73 }, casino: { x: 60.99, y: 44.92 }, nightclub: { x: 68.2, y: 55.8 }, shops: { x: 78.49, y: 48.55 },
  "black-market": { x: 89.90, y: 42.01 }, market: { x: 84.07, y: 67.22 }, gym: { x: 11.79, y: 47.22 },
  jail: { x: 7.99, y: 61.88 }, crime: { x: 7.48, y: 77.16 }, combat: { x: 36.14, y: 74.49 },
  missions: { x: 58.33, y: 74.00 },
};

const FUTURE_MAP_LOCATIONS: MasterMapLocation[] = [
  { id: "chop-shop", name: "Chop Shop / Auto Garage", icon: "🚗", description: "Vehicle work, parts, repairs, customization, and future underground auto activity.", district: "Industrial District", x: "25.99%", y: "53.40%", future: true },
  { id: "courthouse", name: "Courthouse", icon: "⚖️", description: "Future legal cases, fines, warrants, hearings, and justice-system gameplay.", district: "Justice District", x: "28.15%", y: "59.46%", future: true },
  { id: "company-plaza", name: "Player Company Plaza", icon: "🏢", description: "Future headquarters for player-owned companies, hiring, management, and business competition.", district: "Business District", x: "35.00%", y: "59.58%", future: true },
  { id: "transit", name: "Transit Station", icon: "🚆", description: "Future city transit and regional travel connections.", district: "Downtown", x: "43.36%", y: "59.46%", future: true },
  { id: "safehouse", name: "Safehouse Block", icon: "🔐", description: "Future private safehouses, stash storage, protection, and criminal utility.", district: "Downtown", x: "50.34%", y: "59.46%", future: true },
  { id: "luxury-mall", name: "Luxury Mall", icon: "💎", description: "Future premium shopping, rare goods, fashion, collectibles, and high-end services.", district: "Commercial District", x: "57.95%", y: "59.46%", future: true },
  { id: "pawn-loan", name: "Pawn & Loan", icon: "💵", description: "Future pawn sales, loans, valuables, and quick-cash services.", district: "Commercial District", x: "64.03%", y: "59.46%", future: true },
  { id: "harbor", name: "Harbor Docks / Dock Union Port", icon: "⚓", description: "Future cargo, smuggling, logistics, faction work, shipping, and trade routes.", district: "Harbor District", x: "20.16%", y: "87.09%", future: true },
  { id: "warehouses", name: "Warehouse District", icon: "🏭", description: "Future storage, logistics, company inventory, cargo contracts, and crime opportunities.", district: "Warehouse District", x: "46.28%", y: "87.22%", future: true },
  { id: "iron-hq", name: "Iron Syndicate HQ", icon: "☠️", description: "Future headquarters and deeper progression for the Iron Syndicate.", district: "Faction Row", x: "64.79%", y: "87.70%", future: true },
  { id: "guard-hq", name: "Rift Guard Barracks", icon: "🛡️", description: "Future headquarters and deeper progression for the Rift Guard.", district: "Faction Row", x: "71.13%", y: "87.70%", future: true },
  { id: "dock-union-hq", name: "Dock Union Hall", icon: "⚓", description: "Future headquarters and deeper progression for the Dock Union.", district: "Faction Row", x: "77.60%", y: "87.70%", future: true },
];

const MASTER_DISTRICTS = [
  { name: "Medical District", x: 1.27, y: 0.19, w: 25.36, h: 37.57 },
  { name: "Northside", x: 27.89, y: 0, w: 15.22, h: 23.22 },
  { name: "Financial District", x: 43.11, y: 0, w: 16.48, h: 23.22 },
  { name: "University District", x: 59.59, y: 0, w: 15.22, h: 23.22 },
  { name: "Airport District", x: 74.81, y: 0, w: 21.56, h: 31.71 },
  { name: "Central District", x: 34.23, y: 17.16, w: 25.36, h: 21.82 },
  { name: "Residential District", x: 17.75, y: 20.80, w: 19.02, h: 21.82 },
  { name: "Business District", x: 60.86, y: 19.58, w: 19.02, h: 21.82 },
  { name: "Downtown", x: 31.70, y: 37.76, w: 22.82, h: 23.03 },
  { name: "Entertainment District", x: 53.25, y: 36.55, w: 19.02, h: 21.82 },
  { name: "Commercial District", x: 71.01, y: 36.55, w: 17.75, h: 24.24 },
  { name: "East Market", x: 86.22, y: 29.28, w: 10.14, h: 26.67 },
  { name: "Industrial District", x: 1.27, y: 38.98, w: 27.89, h: 20.60 },
  { name: "Justice District", x: 1.27, y: 55.95, w: 22.82, h: 16.97 },
  { name: "Underground District", x: 1.27, y: 70.49, w: 21.56, h: 19.39 },
  { name: "Combat District", x: 27.89, y: 68.07, w: 25.36, h: 18.18 },
  { name: "Operations District", x: 51.99, y: 66.85, w: 25.36, h: 18.18 },
  { name: "Market District", x: 76.08, y: 55.95, w: 20.29, h: 21.82 },
  { name: "Harbor District", x: 8.88, y: 82.61, w: 26.63, h: 17.39 },
  { name: "Warehouse District", x: 36.77, y: 82.61, w: 20.29, h: 17.39 },
  { name: "Faction Row", x: 58.33, y: 81.40, w: 26.63, h: 18.60 },
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
  const [isFullscreen, setIsFullscreen] = useState(false);

  const panelRef = useRef<HTMLElement | null>(null);
  const mapRef = useRef<HTMLDivElement | null>(null);
  const fallbackFullscreenRef = useRef(false);

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

  useEffect(() => {
    const syncFullscreen = () => {
      // Native fullscreen reports through document.fullscreenElement. The
      // CSS fallback used by iOS Safari has no fullscreenchange event, so
      // native exit must not accidentally close an active fallback overlay.
      if (document.fullscreenElement) {
        fallbackFullscreenRef.current = false;
        setIsFullscreen(document.fullscreenElement === panelRef.current);
      } else if (!fallbackFullscreenRef.current) {
        setIsFullscreen(false);
      }
    };

    document.addEventListener("fullscreenchange", syncFullscreen);
    return () => document.removeEventListener("fullscreenchange", syncFullscreen);
  }, []);

  useEffect(() => {
    if (!isFullscreen) return;

    const root = document.documentElement;
    const body = document.body;
    root.classList.add("riftcity-map-fullscreen-open");
    body.classList.add("riftcity-map-fullscreen-open");

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape" || document.fullscreenElement) return;
      fallbackFullscreenRef.current = false;
      setIsFullscreen(false);
    };

    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      root.classList.remove("riftcity-map-fullscreen-open");
      body.classList.remove("riftcity-map-fullscreen-open");
    };
  }, [isFullscreen]);

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

  const MAP_WIDTH = 1142;
  const MAP_HEIGHT = 896;

  const MIN_ZOOM = 1;
  const MAX_ZOOM = 2.5;

  /*
   * Give zoomed maps some controlled overscroll on every side. Without this,
   * clampPan only allows an edge of the map to reach an edge of the viewport,
   * which makes locations close to the north/west borders impossible to bring
   * toward the middle for a close look.
   *
   * The extra room ramps in as the player zooms so the 1x map remains locked
   * neatly in place while a genuinely zoomed map can focus any edge/corner.
   */
  const PAN_FOCUS_PADDING_X = MAP_WIDTH * 0.34;
  const PAN_FOCUS_PADDING_Y = MAP_HEIGHT * 0.34;
  const PAN_FOCUS_FULL_AT_ZOOM = 1.5;

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
    const baseMaxX =
      ((nextZoom - 1) * MAP_WIDTH) / 2;

    const baseMaxY =
      ((nextZoom - 1) * MAP_HEIGHT) / 2;

    const focusProgress = Math.min(
      1,
      Math.max(
        0,
        (nextZoom - MIN_ZOOM) /
          (PAN_FOCUS_FULL_AT_ZOOM - MIN_ZOOM),
      ),
    );

    const maxX =
      baseMaxX +
      PAN_FOCUS_PADDING_X * focusProgress;

    const maxY =
      baseMaxY +
      PAN_FOCUS_PADDING_Y * focusProgress;

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

  const toggleFullscreen = async () => {
    const target = panelRef.current;
    if (!target) return;

    // Exit native fullscreen when it is active.
    if (document.fullscreenElement) {
      try {
        await document.exitFullscreen();
      } finally {
        fallbackFullscreenRef.current = false;
        setIsFullscreen(false);
      }
      return;
    }

    // If we are using the CSS fullscreen fallback (notably iPhone Safari),
    // the same button simply closes it.
    if (isFullscreen) {
      fallbackFullscreenRef.current = false;
      setIsFullscreen(false);
      return;
    }

    // Prefer the browser Fullscreen API where supported. iOS Safari can
    // reject requestFullscreen on normal elements, so fall back to a fixed
    // 100dvh overlay that behaves like fullscreen inside the usable viewport.
    if (typeof target.requestFullscreen === "function") {
      try {
        fallbackFullscreenRef.current = false;
        await target.requestFullscreen();
        setIsFullscreen(true);
        return;
      } catch {
        // Continue into the CSS fallback below.
      }
    }

    fallbackFullscreenRef.current = true;
    setIsFullscreen(true);
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

    const singleTouchCanPan = zoom > MIN_ZOOM + 0.02;

    // At 1x, one finger scrolls the page. Once zoomed, one finger pans the map.
    if (event.pointerType !== "touch" || singleTouchCanPan) {
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
      if (event.pointerType !== "touch" || singleTouchCanPan) {
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

    // At 1x a single finger remains page-scroll; zoomed maps use one-finger pan.
    if (event.pointerType === "touch" && pointersRef.current.size === 1 && zoom <= MIN_ZOOM + 0.02) {
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

      <section ref={panelRef} className={`city-map-panel card ${isFullscreen ? "is-fullscreen" : ""}`}>

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

            <button
              type="button"
              className="city-map-tool city-map-fullscreen"
              onClick={toggleFullscreen}
            >
              {isFullscreen ? "Exit Fullscreen" : "Fullscreen"}
            </button>

          </div>
        </div>

        {/* ===================================================
            MAP
        =================================================== */}

        <div
          ref={mapRef}
          className={`riftcity-map interactive-map ${dragging ? "is-dragging" : ""} ${zoom > MIN_ZOOM + 0.02 ? "is-zoomed" : ""}`}
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
            viewBox="0 0 1142 896"
            role="application"
            aria-label="Interactive RiftCity master map"
          >
            <g
              className="map-world master-map-world"
              transform={`translate(${571 + pan.x} ${448 + pan.y}) scale(${zoom}) translate(-571 -448)`}
            >
              <image
                href={masterMapImage}
                x="0"
                y="0"
                width="1142"
                height="896"
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
            Tap a location or district · Zoom, then drag to pan
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
