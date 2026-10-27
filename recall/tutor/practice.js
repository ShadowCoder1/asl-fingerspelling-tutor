/* practice.js: what a TEACHING trial asks of the learner (experiments/asl-study.js).
 *
 * Two kinds of practice, picked by the URL (?practice=):
 *
 *   copy     (the default, and what every session before 2026-10-27 had) the
 *            letter WITH its picture on every teaching trial: copy it, hold it.
 *
 *   recall   recall first (2026-10-27, after the cluster pilot showed no gain).
 *            Round 1 is copy, so every shape has been seen once. From round
 *            RECALL_FROM_ROUND on, a teaching trial shows the letter ALONE: the
 *            learner makes it from memory. The picture comes up after their
 *            first wrong try, or after RECALL_REVEAL_MS without a right one, and
 *            from then on the trial is the copy trial it always was (hints,
 *            five misses and move on).
 *
 *   Why: in the 102 people on copy practice, teaching trials were right 85-88%
 *   of the time and the same letters from memory at the test 51-57%: practice
 *   trained copying, the test asks for recall. Retrieval with feedback
 *   (the testing effect; Karpicke & Roediger 2008) and withdrawing guidance
 *   (Salmoni, Schmidt & Lee 1984) are the two strongest known levers on that gap.
 *
 * The letters, their order (tutor/schedule.js) and the number of trials are
 * untouched; so are the baseline and the post-test. Everything here is pure. */

export const PRACTICES = Object.freeze(["copy", "recall"]);
export const DEFAULT_PRACTICE = "copy";

/* Round numbers are 1-based (round 1 = the first teaching pass). */
export const RECALL_FROM_ROUND = 2;
/* With no right hold by then, the picture comes up anyway: long enough to try,
 * short enough that someone with no idea is not left staring at a letter. */
export const RECALL_REVEAL_MS = 6000;

export function parsePractice(raw) {
  if (raw === null || raw === "") return DEFAULT_PRACTICE;
  const p = raw.toLowerCase();
  if (!PRACTICES.includes(p)) throw new Error(`?practice=${raw} is not a kind of practice; use ${PRACTICES.join(" or ")}.`);
  return p;
}

/* Is this teaching round (1-based) recalled first under this practice? */
export const isRecallRound = (practice, round) => practice === "recall" && round >= RECALL_FROM_ROUND;
