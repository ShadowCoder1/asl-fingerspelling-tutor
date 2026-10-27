/* schedule.js: the order of the TEACHING trials in the study (experiments/asl-study.js).
 *
 * Two schedules, picked by the URL (?schedule=):
 *
 *   random   (the default, and what the 66 novices of 2026-09-28 had) every
 *            teaching round is a plain shuffled pass through the letters.
 *
 *   cluster  "contrast then mix" (the PIs, 2026-10-26). The letters people mix
 *            up are taught next to each other first, then mixed:
 *              round 1     each mix-up cluster as one unbroken run, the easiest
 *                          letter of the cluster first; the clusters' order
 *                          shuffled;
 *              rounds 2-7  each cluster still one unbroken run, but both the
 *                          clusters' order and the order inside each shuffled;
 *              rounds 8-10 plain shuffled passes, like the test.
 *            A letter in no cluster (J and Z, the two movement letters) is a
 *            cluster of one.
 *
 * Only the teaching part changes: the same letters, the same number of times.
 * The baseline and post-test passes are untouched (asl-study.js keeps drawing
 * them from the same random numbers as before).
 *
 * Everything here is pure: same inputs, same order. */

import { createPrng } from "./prng.js";

export const SCHEDULES = Object.freeze(["random", "cluster"]);
export const DEFAULT_SCHEDULE = "random";

/* Saved with every trial of a cluster-schedule session, so the data say which
 * tables below ordered it. Change it whenever CLUSTERS or POST_TEST change. */
export const CLUSTER_TABLE_VERSION = "mixups-2026-09-28/post-acc-66-2026-09-28";

/* The confusion clusters: research/prolific-all-2026-09-28/structure_mixups.json
 * ("groups"; k = 6 chosen by held-out cross-validation on the 66 novices'
 * mix-ups). J and Z were not in that analysis (movement letters). */
export const CLUSTERS = Object.freeze(["AEMNSTX", "BFW", "CO", "DGLPQ", "HKRUV", "IY"]);

/* "Easiest" = the 66 novices' final-test (post-test) accuracy, frozen here:
 * research/prolific-all-2026-09-28/difficulty/trials.csv, rows with
 * phase == "post", [number correct, number of trials] per letter (one post-test
 * trial per person per letter). J and Z are not in that file (J and Z out of
 * the difficulty analysis); they are clusters of one, so their ease is never
 * used to order anything. */
export const POST_TEST = Object.freeze({
  A: [42, 66], B: [30, 66], C: [54, 66], D: [11, 66], E: [31, 66], F: [19, 66],
  G: [15, 66], H: [18, 66], I: [42, 66], K: [41, 66], L: [54, 66], M: [37, 66],
  N: [28, 66], O: [58, 66], P: [37, 66], Q: [27, 66], R: [27, 66], S: [31, 66],
  T: [27, 66], U: [24, 66], V: [52, 66], W: [48, 66], X: [23, 66], Y: [36, 66],
});

export const ease = (letter) => (POST_TEST[letter] ? POST_TEST[letter][0] / POST_TEST[letter][1] : null);

/* Round numbers are 1-based (round 1 = the first teaching pass). */
export const EASE_FIRST_ROUNDS = 1;   // rounds 1..1: clusters, easiest letter first
export const CLUSTERED_ROUNDS = 7;    // rounds 1..7: clusters kept together

export function parseSchedule(raw) {
  if (raw === null || raw === "") return DEFAULT_SCHEDULE;
  const s = raw.toLowerCase();
  if (!SCHEDULES.includes(s)) throw new Error(`?schedule=${raw} is not a schedule; use ${SCHEDULES.join(" or ")}.`);
  return s;
}

/* The clusters restricted to the letters being taught, in CLUSTERS' order,
 * then each remaining letter as a cluster of one (in the order given). */
export function clustersOf(letters) {
  const groups = CLUSTERS.map((c) => letters.filter((l) => c.includes(l))).filter((g) => g.length);
  const inSome = new Set(groups.flat());
  return [...groups, ...letters.filter((l) => !inSome.has(l)).map((l) => [l])];
}

/* Highest post-test accuracy first; a tie goes alphabetically; a letter with
 * no accuracy (only possible in a cluster of one) goes last. */
export function easiestFirst(group) {
  const key = (l) => ease(l) ?? -1;
  return group.slice().sort((a, b) => key(b) - key(a) || (a < b ? -1 : a > b ? 1 : 0));
}

export const isClusteredRound = (round) => round <= CLUSTERED_ROUNDS;

/* One clustered teaching round (round <= CLUSTERED_ROUNDS) as a list of letters. */
export function clusteredRound(letters, round, prng) {
  if (!isClusteredRound(round)) throw new Error(`round ${round} is not a clustered round`);
  const order = prng.shuffle(clustersOf(letters));
  return order.flatMap((g) => (round <= EASE_FIRST_ROUNDS ? easiestFirst(g) : prng.shuffle(g)));
}

/* The cluster schedule has its own random numbers, derived from the session
 * seed, so that the main stream (baseline, the plain rounds, post-test) is
 * drawn exactly as in the random schedule. FNV-1a, as seedFromParticipant. */
export function clusterSeed(seed) {
  let h = 0x811c9dc5;
  const s = `cluster/${seed >>> 0}`;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193); }
  return h >>> 0;
}
export const clusterPrng = (seed) => createPrng(clusterSeed(seed));

/* The letter of each cluster (J and Z, clusters of one, count as never
 * sharing one), for counting within-cluster transitions. */
export function clusterIndex(letters) {
  const idx = {};
  clustersOf(letters).forEach((g, i) => { for (const l of g) idx[l] = g.length > 1 ? i : null; });
  return idx;
}
export function withinClusterRate(sequence, letters) {
  const idx = clusterIndex(letters);
  let within = 0;
  for (let i = 1; i < sequence.length; i++) {
    const a = idx[sequence[i - 1]], b = idx[sequence[i]];
    if (a != null && a === b) within++;
  }
  return { within, transitions: sequence.length - 1, rate: within / (sequence.length - 1) };
}
