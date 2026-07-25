export type BracketParticipant = {
  key: string;
  seed: number | null;
};

export type PlannedPairing = {
  homeKey: string | null;
  awayKey: string | null;
};

export type KnockoutPlan = {
  bracketSize: number;
  orderedKeys: string[];
  slots: Array<string | null>;
  pairings: PlannedPairing[];
  warnings: string[];
};

export type DrawPlanOptions = {
  participantOrder?: string[];
  manualPairings?: PlannedPairing[];
  random?: () => number;
};

export function nextPowerOfTwo(value: number) {
  let result = 2;
  while (result < Math.max(2, value)) result *= 2;
  return result;
}

/**
 * Returns the conventional seed layout for a power-of-two bracket.
 * Example for 8 slots: 1,8,4,5,2,7,3,6.
 */
export function standardSeedOrder(size: number) {
  if (size < 2 || (size & (size - 1)) !== 0) {
    throw new Error("INVALID_BRACKET_SIZE");
  }
  let order = [1, 2];
  for (let current = 4; current <= size; current *= 2) {
    order = order.flatMap((seed) => [seed, current + 1 - seed]);
  }
  return order;
}

function shuffled<T>(items: T[], random: () => number) {
  const result = [...items];
  for (let index = result.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(random() * (index + 1));
    [result[index], result[swapIndex]] = [result[swapIndex], result[index]];
  }
  return result;
}

function orderedByKeys<T extends BracketParticipant>(participants: T[], keys: string[]) {
  const byKey = new Map(participants.map((participant) => [participant.key, participant]));
  if (keys.length !== participants.length || new Set(keys).size !== participants.length) {
    throw new Error("INVALID_PARTICIPANT_ORDER");
  }
  const ordered = keys.map((key) => byKey.get(key));
  if (ordered.some((participant) => !participant)) throw new Error("INVALID_PARTICIPANT_ORDER");
  return ordered as T[];
}

function validateExplicitSeeds<T extends BracketParticipant>(participants: T[]) {
  const seeds = participants
    .map((participant) => participant.seed)
    .filter((seed): seed is number => seed !== null);
  if (seeds.some((seed) => !Number.isInteger(seed) || seed < 1)) throw new Error("INVALID_SEED");
  if (new Set(seeds).size !== seeds.length) throw new Error("DUPLICATE_SEED");
}

export function validateManualPairings<T extends BracketParticipant>(
  participants: T[],
  pairings: PlannedPairing[]
) {
  const participantKeys = new Set(participants.map((participant) => participant.key));
  const used = new Set<string>();

  if (!pairings.length) throw new Error("MANUAL_DRAW_EMPTY");
  for (const pairing of pairings) {
    if (!pairing.homeKey && !pairing.awayKey) throw new Error("MANUAL_DRAW_EMPTY_PAIR");
    for (const key of [pairing.homeKey, pairing.awayKey]) {
      if (!key) continue;
      if (!participantKeys.has(key)) throw new Error("MANUAL_DRAW_UNKNOWN_PARTICIPANT");
      if (used.has(key)) throw new Error("MANUAL_DRAW_DUPLICATE_PARTICIPANT");
      used.add(key);
    }
  }
  if (used.size !== participants.length) throw new Error("MANUAL_DRAW_MISSING_PARTICIPANT");
}

export function planKnockout<T extends BracketParticipant>(
  participants: T[],
  mode: "random" | "seeded" | "custom",
  options: DrawPlanOptions = {}
): KnockoutPlan {
  if (participants.length < 2) throw new Error("NOT_ENOUGH_PARTICIPANTS");

  if (options.manualPairings) {
    validateManualPairings(participants, options.manualPairings);
    const pairings = options.manualPairings.map((pairing) => (
      !pairing.homeKey && pairing.awayKey
        ? { homeKey: pairing.awayKey, awayKey: null }
        : pairing
    ));
    const slots = pairings.flatMap((pairing) => [pairing.homeKey, pairing.awayKey]);
    return {
      bracketSize: nextPowerOfTwo(slots.length),
      orderedKeys: slots.filter((key): key is string => Boolean(key)),
      slots,
      pairings,
      warnings: []
    };
  }

  let ordered = [...participants];
  if (options.participantOrder) {
    ordered = orderedByKeys(participants, options.participantOrder);
  } else if (mode === "random") {
    ordered = shuffled(participants, options.random || Math.random);
  } else if (mode === "seeded") {
    validateExplicitSeeds(participants);
    ordered.sort((left, right) => (
      (left.seed ?? Number.MAX_SAFE_INTEGER) - (right.seed ?? Number.MAX_SAFE_INTEGER)
      || left.key.localeCompare(right.key)
    ));
  }

  const warnings: string[] = [];
  if (mode === "seeded" && ordered.some((participant) => participant.seed === null)) {
    warnings.push("برخی شرکت‌کنندگان Seed ندارند و بعد از Seedهای تعیین‌شده قرار گرفته‌اند.");
  }

  const bracketSize = nextPowerOfTwo(ordered.length);
  const slotOrder = standardSeedOrder(bracketSize);
  const byVirtualSeed = new Map(ordered.map((participant, index) => [index + 1, participant.key]));
  const slots = slotOrder.map((virtualSeed) => byVirtualSeed.get(virtualSeed) || null);
  const pairings: PlannedPairing[] = [];
  for (let index = 0; index < slots.length; index += 2) {
    pairings.push({ homeKey: slots[index], awayKey: slots[index + 1] });
  }

  return {
    bracketSize,
    orderedKeys: ordered.map((participant) => participant.key),
    slots,
    pairings,
    warnings
  };
}
