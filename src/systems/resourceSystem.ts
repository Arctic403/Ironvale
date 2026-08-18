export const MAX_ENERGY = 100;

export const ENERGY_REGEN_INTERVAL = 60 * 1000;

export const BASE_NERVE_MAX = 10;

export const NERVE_REGEN_INTERVAL = 5 * 60 * 1000;

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
    naturalNerveMax + propertyNerveBonus
  );
}

export function regenerateResources(
  state: ResourceState,
  now: number,
  maxNerve: number
): ResourceState {
  let updated = {
    ...state,
  };

  /*
   * ENERGY
   *
   * Energy regenerates independently
   * from Nerve.
   */
  if (
    state.energy < MAX_ENERGY &&
    now > state.lastEnergyUpdate
  ) {
    const ticks = Math.floor(
      (now - state.lastEnergyUpdate) /
        ENERGY_REGEN_INTERVAL
    );

    if (ticks > 0) {
      updated.energy = Math.min(
        MAX_ENERGY,
        state.energy + ticks
      );

      updated.lastEnergyUpdate =
        state.lastEnergyUpdate +
        ticks * ENERGY_REGEN_INTERVAL;
    }
  } else if (
    state.energy >= MAX_ENERGY
  ) {
    /*
     * Once full, keep the timestamp
     * current enough that coming back
     * later does not create a giant
     * backlog.
     */
    updated.energy = MAX_ENERGY;
    updated.lastEnergyUpdate = now;
  }

  /*
   * NERVE
   *
   * Nerve has its own completely
   * independent regeneration clock.
   */
  if (
    state.nerve < maxNerve &&
    now > state.lastNerveUpdate
  ) {
    const ticks = Math.floor(
      (now - state.lastNerveUpdate) /
        NERVE_REGEN_INTERVAL
    );

    if (ticks > 0) {
      updated.nerve = Math.min(
        maxNerve,
        state.nerve + ticks
      );

      updated.lastNerveUpdate =
        state.lastNerveUpdate +
        ticks * NERVE_REGEN_INTERVAL;
    }
  } else if (
    state.nerve >= maxNerve
  ) {
    updated.nerve = maxNerve;
    updated.lastNerveUpdate = now;
  }

  return updated;
}

export function getResourceTimeRemaining(
  current: number,
  max: number,
  lastUpdate: number,
  interval: number,
  now: number
): number {
  if (current >= max) {
    return 0;
  }

  const elapsed =
    now - lastUpdate;

  const remainder =
    elapsed % interval;

  return Math.max(
    0,
    interval - remainder
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
  return Math.min(
    MAX_ENERGY,
    Math.max(0, current + amount)
  );
}

export function addNerve(
  current: number,
  amount: number,
  maxNerve: number
): number {
  return Math.min(
    maxNerve,
    Math.max(0, current + amount)
  );
}

export function spendEnergy(
  current: number,
  amount: number
): number | null {
  if (amount < 0) {
    return current;
  }

  if (current < amount) {
    return null;
  }

  return current - amount;
}

export function spendNerve(
  current: number,
  amount: number
): number | null {
  if (amount < 0) {
    return current;
  }

  if (current < amount) {
    return null;
  }

  return current - amount;
}
