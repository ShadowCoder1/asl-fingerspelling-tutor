/* motion.js: J and Z, the two letters that are MOVEMENTS (and, in the numbers build, TEN).
 *
 * Every other letter is a handshape held still, graded by the model. J is an
 * I (pinky out) that draws a J in the air; Z is an index finger that draws a
 * Z. There is no public data of either as landmark sequences, so this is a
 * RULE, stated in numbers, not a trained model:
 *
 *   shape  a finger is "out" when its tip is at least EXT times as far from
 *          the wrist as its knuckle, "curled" when at most CURL times. On the
 *          owner's recorded holds straight fingers read 1.49-2.05 and curled
 *          ones 0.38-1.13 (research/allletters-2026-09-22/).
 *            J: pinky out; index, middle, ring curled.
 *            Z: index out; middle, ring, pinky curled.
 *   motion over the frames in that shape during the few seconds before the
 *          hand came to rest, the moving fingertip (smoothed) must have:
 *            J: travelled at least J_DROP palm-lengths down and J_HOOK across.
 *            Z: spanned Z_WIDTH across and Z_DROP down, and reversed its
 *               sideways direction at least twice (right, back, right).
 *
 * Palm-length = wrist to middle knuckle, so the rule does not care how far
 * the hand is from the camera. The movement is checked on every frame of a J
 * or Z trial and a recognised one is the answer at once, with no hold
 * (experiments/asl-tutor/engine.js, JT 2026-09-24); holding still is only the
 * fallback that grades a movement that was not recognised.
 *
 * TEN (the numbers build, tools/build-mobile-site.sh --set numbers) is a thumbs-up given a small twist or shake:
 *   shape  index, middle, ring and pinky curled (as above), the thumb out of the fist (its tip at least T10_THUMB
 *          palm-lengths from the index knuckle: on FSboard's Deaf signers an S reads 0.20 at the median, an A 0.51,
 *          an L 0.85; research/numbers-2026-10-24/thumb_measure.py) and pointing up (within T10_UP_DEG of straight up).
 *   motion the thumb swings: its direction turns through T10_TWIST_DEG and back (a twist), or its tip goes
 *          T10_SHAKE palm-lengths sideways and back (a shake). Either one counts; holding still does not.
 *
 * ELEVEN, TWELVE, FIFTEEN (the numbers build) are fingers that FLICK or BEND, over and over, while the hand stays put:
 *   11  the index flicks up from under the thumb; middle, ring and pinky stay curled.
 *   12  the index and middle fingers flick up together; ring and pinky stay curled.
 *   15  a 5 (thumb out) whose four fingers bend down at the knuckles together.
 *   shape  the fingers that do not move curled (at most FLICK_STILL: looser than CURL, since a curled finger next to
 *          one flicking reads up to 1.35, and 1.49 for a moment as the flick goes by); for 15, the thumb out (T10_THUMB).
 *   motion the moving fingers (11 the index, 12 index and middle, 15 all four) go from straight (all of them at least
 *          FLICK_UP) to bent (all of them at most FLICK_DOWN; for 15, three of the four, as the pinky bends least) or
 *          back FLICK_FLIPS times in a row: up, down, up, or down, up, down (twice). A finger that only wobbles between the
 *          two (a tracking glitch, a curled finger turned with the hand) never counts. And QUICKLY (JT, 24 Oct: "it
 *          required 2 quick movements; i did the two movements in slow succession and it still worked"): each move
 *          takes at most FLICK_MOVE_MS (from where the fingers last rested, within FLICK_REST of the furthest they
 *          went, to where they arrive) and comes within FLICK_GAP_MS of the move before; a slow move starts the count
 *          again. The signer in the videos moves in 30-200 ms (a few up to 0.6 s, between repetitions) and makes the
 *          next move within 0.84 s; the limits are 2.5 and 1.8 times that, for beginners.
 *          Measured on Learn How to Sign's videos of 11, 12 and 15 (research/numbers-2026-10-24/FLICKS.md): the index
 *          reads 1.1-1.3 under the thumb and 2.0-2.2 flicked up; 12's lower finger 1.3-1.6 and 2.1-2.5; 15's lowest
 *          2.0-2.2 open, its third-lowest 1.35-1.46 bent (seen from the front). A curled index turned with a twisting
 *          10 swings 0.46 but never reaches 1.75. */

export const MOTION_LETTERS = Object.freeze(["J", "Z", "10", "11", "12", "15"]);
export const EXT = 1.45;
export const CURL = 1.3;
export const WINDOW_MS = 3500;       // how far back from the hold to look for the movement
export const MIN_SHAPE_FRAMES = 6;
export const J_DROP = 0.45, J_HOOK = 0.25;
export const Z_WIDTH = 0.6, Z_DROP = 0.35, Z_REVERSALS = 2, Z_HYST = 0.15;
export const T10_THUMB = 0.45, T10_UP_DEG = 60, T10_TWIST_DEG = 18, T10_TWIST_HYST_DEG = 7, T10_SHAKE = 0.3, T10_SHAKE_HYST = 0.1;
export const FLICK_STILL = 1.5, FLICK_UP = 1.75, FLICK_DOWN = 1.6, FLICK_FLIPS = 3, FLICK_REST = 0.1, FLICK_MOVE_MS = 500, FLICK_GAP_MS = 1500;
/* The same numbers as one object: the engine takes it as an option, so a
 * replay of recorded trials can try other values (research/prolific-pilot-2026-09-28). */
export const MOTION_DEFAULTS = Object.freeze({ WINDOW_MS, EXT, CURL, MIN_SHAPE_FRAMES, J_DROP, J_HOOK, Z_WIDTH, Z_DROP, Z_REVERSALS, Z_HYST,
  T10_THUMB, T10_UP_DEG, T10_TWIST_DEG, T10_TWIST_HYST_DEG, T10_SHAKE, T10_SHAKE_HYST, FLICK_STILL, FLICK_UP, FLICK_DOWN, FLICK_FLIPS, FLICK_REST, FLICK_MOVE_MS, FLICK_GAP_MS });

const FINGER = { index: [5, 8], middle: [9, 12], ring: [13, 16], pinky: [17, 20] };
const SHAPE = {
  J: { out: ["pinky"], curled: ["index", "middle", "ring"], tip: 20 },
  Z: { out: ["index"], curled: ["middle", "ring", "pinky"], tip: 8 },
  10: { out: [], curled: ["index", "middle", "ring", "pinky"], tip: 4, thumbUp: true },
  11: { out: [], curled: [], still: ["middle", "ring", "pinky"], flick: ["index"], track: "min", tip: 8 },
  12: { out: [], curled: [], still: ["ring", "pinky"], flick: ["index", "middle"], track: "min", tip: 12 },
  15: { out: [], curled: [], still: [], flick: ["index", "middle", "ring", "pinky"], track: "three", tip: 12, thumbOut: true },
};
/* The landmark each movement is drawn and measured with (experiments/asl-tutor/engine.js, motion-guide.js). */
export const MOTION_TIP = Object.freeze(Object.fromEntries(Object.entries(SHAPE).map(([k, v]) => [k, v.tip])));

const pt = (flat, i, aspect) => [flat[3 * i] * aspect, flat[3 * i + 1]];
const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);

export function extension(flat, finger, aspect) {
  const [m, t] = FINGER[finger];
  const w = pt(flat, 0, aspect);
  const d0 = dist(pt(flat, m, aspect), w);
  return d0 > 0 ? dist(pt(flat, t, aspect), w) / d0 : NaN;
}

export function inShape(letter, flat, aspect, p = MOTION_DEFAULTS) {
  const s = SHAPE[letter];
  if (!s || !flat || flat.some((v) => !Number.isFinite(v))) return false;
  if (!(s.out.every((f) => extension(flat, f, aspect) >= p.EXT) && s.curled.every((f) => extension(flat, f, aspect) <= p.CURL))) return false;
  if (s.still && !s.still.every((f) => extension(flat, f, aspect) <= p.FLICK_STILL)) return false;
  if (s.thumbOut && !(thumbOut(flat, aspect) >= p.T10_THUMB)) return false;
  return !s.thumbUp || thumbUp(flat, aspect, p);
}

/* The thumb tip's distance from the index knuckle, in palm lengths: out of the fist (or the palm) when large. */
function thumbOut(flat, aspect) {
  const palm = dist(pt(flat, 0, aspect), pt(flat, 9, aspect));
  return palm > 0 ? dist(pt(flat, 4, aspect), pt(flat, 5, aspect)) / palm : NaN;
}

/* 11, 12, 15: how far up the moving fingers are, a frame: [up, down]. Up is the lowest of them (all are straight when
 * it is); down is the same for 11 and 12, and for 15 the second highest (three of the four are bent when it is: the
 * pinky bends least, and often reads straight). */
function flickTrack(s, flat, aspect) {
  const e = s.flick.map((f) => extension(flat, f, aspect)).sort((a, b) => a - b);
  return [e[0], s.track === "three" ? e[e.length - 2] : e[0]];
}

/* The thumb out of the fist and pointing up (TEN): far enough from the index knuckle, and its direction within
 * T10_UP_DEG of straight up on the screen. */
function thumbUp(flat, aspect, p) {
  const palm = dist(pt(flat, 0, aspect), pt(flat, 9, aspect));
  if (!(palm > 0) || dist(pt(flat, 4, aspect), pt(flat, 5, aspect)) / palm < p.T10_THUMB) return false;
  return Math.abs(thumbAngle(flat, aspect)) <= p.T10_UP_DEG;
}

/* The thumb's direction (its first joint to its tip) in degrees from straight up on the screen, positive clockwise. */
export function thumbAngle(flat, aspect) {
  const a = pt(flat, 2, aspect), b = pt(flat, 4, aspect);
  return (Math.atan2(b[0] - a[0], a[1] - b[1]) * 180) / Math.PI;
}

function smooth(points, k = 5) {
  return points.map((_, i) => {
    const lo = Math.max(0, i - (k >> 1)), hi = Math.min(points.length, i + (k >> 1) + 1);
    let x = 0, y = 0;
    for (let j = lo; j < hi; j++) { x += points[j][0]; y += points[j][1]; }
    return [x / (hi - lo), y / (hi - lo)];
  });
}

/* Sideways direction changes of a 1-D track, counting only swings larger than
 * `hyst` (so tracker jitter is not a reversal). */
export function reversals(xs, hyst) {
  let dir = 0, anchor = xs[0], count = 0;
  for (const x of xs) {
    if (dir >= 0 && x < anchor - hyst) { if (dir > 0) count++; dir = -1; anchor = x; }
    else if (dir <= 0 && x > anchor + hyst) { if (dir < 0) count++; dir = 1; anchor = x; }
    else if ((dir > 0 && x > anchor) || (dir < 0 && x < anchor)) anchor = x;
  }
  return count;
}

/**
 * @param {"J"|"Z"} letter
 * @param {{tMs:number, flat:number[]|null}[]} frames  the frames before and during the hold
 * @param {number} aspect
 * @param {object} [p]  thresholds (MOTION_DEFAULTS)
 * @returns {{ok:boolean, reason:string|null, stats:object}}
 */
export function motionVerdict(letter, frames, aspect, p = MOTION_DEFAULTS) {
  const s = SHAPE[letter];
  const kept = frames.filter((f) => inShape(letter, f.flat, aspect, p));
  if (kept.length < p.MIN_SHAPE_FRAMES) return { ok: false, reason: "shape", stats: { shapeFrames: kept.length } };
  const palm = kept.map((f) => dist(pt(f.flat, 0, aspect), pt(f.flat, 9, aspect))).sort((a, b) => a - b)[kept.length >> 1];
  const tip = smooth(kept.map((f) => pt(f.flat, s.tip, aspect))).map(([x, y]) => [x / palm, y / palm]);
  const xs = tip.map((p) => p[0]), ys = tip.map((p) => p[1]);
  const width = Math.max(...xs) - Math.min(...xs);
  const stats = { shapeFrames: kept.length, width: +width.toFixed(3) };
  if (letter === "J") {
    // down, then across: the lowest point must come after a drop from the start
    // region, and there must be sideways travel around/after it
    // the drop: from the highest point to the lowest one AFTER it; the hook:
    // sideways travel from where 70% of that drop is done onwards (jitter
    // makes "the lowest frame" a poor place to start measuring from)
    const top = ys.indexOf(Math.min(...ys));
    const after = ys.slice(top);
    const drop = Math.max(...after) - ys[top];
    const i70 = top + Math.max(0, after.findIndex((y) => y - ys[top] >= 0.7 * drop));
    const tail = xs.slice(i70);
    const hook = Math.max(...tail) - Math.min(...tail);
    Object.assign(stats, { drop: +drop.toFixed(3), hook: +hook.toFixed(3) });
    const ok = drop >= p.J_DROP && hook >= p.J_HOOK;
    return { ok, reason: ok ? null : "motion", stats };
  }
  if (s.flick) {
    // up and down, quickly, over and over: the moving fingers go from straight (FLICK_UP) to bent (FLICK_DOWN) or back.
    // A move is timed from where the fingers last rested (within FLICK_REST of the furthest they went, straight or
    // bent) to where they arrive; it must take at most FLICK_MOVE_MS and come within FLICK_GAP_MS of the move before.
    // A slow one starts the count again.
    const track = smooth(kept.map((f) => flickTrack(s, f.flat, aspect)), 3);
    let state = 0, far = null, restT = 0, flips = 0, run = 0, best = 0, prevFlip = -Infinity, slowest = 0;
    const moves = [];
    track.forEach(([up, down], i) => {
      const t = kept[i].tMs;
      const now = up >= p.FLICK_UP ? 1 : down <= p.FLICK_DOWN ? -1 : 0;
      if (now && state && now !== state) {
        const move = t - restT, quick = move <= p.FLICK_MOVE_MS;
        flips++; moves.push(Math.round(move)); slowest = Math.max(slowest, move);
        run = quick && t - prevFlip <= p.FLICK_GAP_MS ? run + 1 : quick ? 1 : 0;
        best = Math.max(best, run);
        prevFlip = t; far = null;
      }
      if (now) state = now;
      if (!state) return;
      const v = state > 0 ? up : down;
      if (far === null || (state > 0 ? v > far : v < far)) far = v;
      if (Math.abs(v - far) <= p.FLICK_REST) restT = t;
    });
    Object.assign(stats, { top: +Math.max(...track.map((t) => t[0])).toFixed(3), bottom: +Math.min(...track.map((t) => t[1])).toFixed(3), flips, quickRun: best, slowestMoveMs: Math.round(slowest), moves });
    const ok = best >= p.FLICK_FLIPS;
    return { ok, reason: ok ? null : "motion", stats };
  }
  if (letter === "10") {
    // a twist turns the thumb and brings it back; a shake carries it sideways and back
    const ang = smooth(kept.map((f) => [thumbAngle(f.flat, aspect), 0])).map(([a]) => a);
    const twist = Math.max(...ang) - Math.min(...ang);
    const twistRev = reversals(ang, p.T10_TWIST_HYST_DEG);
    const shakeRev = reversals(xs, p.T10_SHAKE_HYST);
    Object.assign(stats, { twist: +twist.toFixed(1), twistReversals: twistRev, shakeReversals: shakeRev });
    const ok = (twist >= p.T10_TWIST_DEG && twistRev >= 1) || (width >= p.T10_SHAKE && shakeRev >= 1);
    return { ok, reason: ok ? null : "motion", stats };
  }
  const drop = Math.max(...ys) - Math.min(...ys);
  const rev = reversals(xs, p.Z_HYST);
  Object.assign(stats, { drop: +drop.toFixed(3), reversals: rev });
  const ok = width >= p.Z_WIDTH && drop >= p.Z_DROP && rev >= p.Z_REVERSALS;
  return { ok, reason: ok ? null : "motion", stats };
}

export const MOTION_HINTS = Object.freeze({
  J: { shape: "For J, start with an I: only your pinky up, the other fingers curled.", motion: "For J, draw a J in the air with your pinky: down, then curve it round." },
  Z: { shape: "For Z, point with your index finger only; curl the others.", motion: "For Z, draw a Z in the air with your index finger: across, back diagonally, across again." },
  10: { shape: "For 10, make a thumbs-up: curl your fingers, thumb straight up.", motion: "For 10, give your thumbs-up a small twist, side to side." },
  11: { shape: "For 11, curl your middle finger, ring finger and pinky; only your index finger moves.", motion: "For 11, flick your index finger up from under your thumb, twice, quickly." },
  12: { shape: "For 12, curl your ring finger and pinky; only your index and middle fingers move.", motion: "For 12, flick your index and middle fingers up from under your thumb, twice, quickly." },
  15: { shape: "For 15, start with a 5: all fingers up, thumb out to the side.", motion: "For 15, bend all four fingers down at the knuckles, twice, quickly." },
});
