export const MAX_ENERGY = 100;

/*
 * +1 Energy every minute.
 */
export const ENERGY_REGEN_INTERVAL =
  60 * 1000;

/*
 * +1 Nerve every 5 minutes.
 */
export const NERVE_REGEN_INTERVAL =
  5 * 60 * 1000;

export const BASE_NERVE_MAX = 10;

export type ResourceState = {
  energy: number;
  nerve: number;

  lastEnergyUpdate: number;
  lastNerveUpdate: number;
};

export function getEnergyMax(): number {
  return MAX_ENERGY;
}

export function getNerveMax(
  naturalNerveMax: number,
  propertyNerveBonus = 0
): number {
  return Math.max(
    BASE_NERVE_MAX,
    naturalNerveMax +
      propertyNerveBonus
  );
}

function validTimestamp(
  value: unknown,
  fallback: number
): number {
  return typeof value ===
    "number" &&
    Number.isFinite(value) &&
    value > 0
    ? value
    : fallback;
}

function clamp(
  value: number,
  min: number,
  max: number
): number {
  if (!Number.isFinite(value)) {
    return min;
  }

  return Math.min(
    max,
    Math.max(
      min,
      value
    )
  );
}

/*
 * Normalize resource values before doing
 * any regeneration calculation.
 *
 * This is important for old saves.
 */
export function normalizeResourceState(
  state: Partial<ResourceState>,
  now: number,
  maxNerve: number
): ResourceState {
  return {
    energy: clamp(
      typeof state.energy ===
        "number"
        ? state.energy
        : MAX_ENERGY,
      0,
      MAX_ENERGY
    ),

    nerve: clamp(
      typeof state.nerve ===
        "number"
        ? state.nerve
        : BASE_NERVE_MAX,
      0,
      maxNerve
    ),

    lastEnergyUpdate:
      validTimestamp(
        state.lastEnergyUpdate,
        now
      ),

    lastNerveUpdate:
      validTimestamp(
        state.lastNerveUpdate,
        now
      ),
  };
}

/*
 * Deterministic passive regeneration.
 *
 * Important:
 *
 * We only advance the clock by completed ticks.
 *
 * This means:
 *
 * 100 Energy -> spend 40 -> 60 Energy
 *
 * keeps the correct regeneration clock.
 *
 * It also means coming back after an hour
 * correctly gives the elapsed regeneration.
 */
export function regenerateResources(
  state: ResourceState,
  now: number,
  maxNerve: number
): ResourceState {
  const normalized =
    normalizeResourceState(
      state,
      now,
      maxNerve
    );

  let energy =
    normalized.energy;

  let nerve =
    normalized.nerve;

  let lastEnergyUpdate =
    normalized.lastEnergyUpdate;

  let lastNerveUpdate =
    normalized.lastNerveUpdate;

  /*
   * ENERGY
   */
  if (
    energy >= MAX_ENERGY
  ) {
    energy = MAX_ENERGY;

    /*
     * When full, there is no reason to
     * accumulate an old backlog.
     */
    lastEnergyUpdate =
      now;
  } else if (
    now >
    lastEnergyUpdate
  ) {
    const ticks =
      Math.floor(
        (
          now -
          lastEnergyUpdate
        ) /
          ENERGY_REGEN_INTERVAL
      );

    if (
      ticks > 0
    ) {
      energy =
        Math.min(
          MAX_ENERGY,
          energy + ticks
        );

      lastEnergyUpdate +=
        ticks *
        ENERGY_REGEN_INTERVAL;

      /*
       * If the regeneration filled the
       * resource, reset the clock.
       */
      if (
        energy >=
        MAX_ENERGY
      ) {
        energy =
          MAX_ENERGY;

        lastEnergyUpdate =
          now;
      }
    }
  }

  /*
   * NERVE
   */
  if (
    nerve >= maxNerve
  ) {
    nerve =
      maxNerve;

    lastNerveUpdate =
      now;
  } else if (
    now >
    lastNerveUpdate
  ) {
    const ticks =
      Math.floor(
        (
          now -
          lastNerveUpdate
        ) /
          NERVE_REGEN_INTERVAL
      );

    if (
      ticks > 0
    ) {
      nerve =
        Math.min(
          maxNerve,
          nerve + ticks
        );

      lastNerveUpdate +=
        ticks *
        NERVE_REGEN_INTERVAL;

      if (
        nerve >=
        maxNerve
      ) {
        nerve =
          maxNerve;

        lastNerveUpdate =
          now;
      }
    }
  }

  return {
    energy,
    nerve,
    lastEnergyUpdate,
    lastNerveUpdate,
  };
}

export function getResourceTimeRemaining(
  current: number,
  max: number,
  lastUpdate: number,
  interval: number,
  now: number
): number {
  if (
    current >= max
  ) {
    return 0;
  }

  const safeLastUpdate =
    validTimestamp(
      lastUpdate,
      now
    );

  const elapsed =
    Math.max(
      0,
      now -
        safeLastUpdate
    );

  const remainder =
    elapsed %
    interval;

  return Math.max(
    0,
    interval -
      remainder
  );
}

export function getEnergyTimeRemaining(
  energy: number,
  now: number,
  lastEnergyUpdate: number
): number {
  return getResourceTimeRemaining(
    energy,
    MAX_ENERGY,
    lastEnergyUpdate,
    ENERGY_REGEN_INTERVAL,
    now
  );
}

export function getNerveTimeRemaining(
  nerve: number,
  maxNerve: number,
  now: number,
  lastNerveUpdate: number
): number {
  return getResourceTimeRemaining(
    nerve,
    maxNerve,
    lastNerveUpdate,
    NERVE_REGEN_INTERVAL,
    now
  );
}

export function addEnergy(
  current: number,
  amount: number
): number {
  return clamp(
    current + amount,
    0,
    MAX_ENERGY
  );
}

export function addNerve(
  current: number,
  amount: number,
  maxNerve: number
): number {
  return clamp(
    current + amount,
    0,
    maxNerve
  );
}

export function spendEnergy(
  current: number,
  amount: number
): number | null {
  if (
    amount < 0
  ) {
    return current;
  }

  if (
    current < amount
  ) {
    return null;
  }

  return current - amount;
}

export function spendNerve(
  current: number,
  amount: number
): number | null {
  if (
    amount < 0
  ) {
    return current;
  }

  if (
    current < amount
  ) {
    return null;
  }

  return current - amount;
}
