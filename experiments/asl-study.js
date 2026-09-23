/* asl-study.js: JT's fixed three-part study (2026-09-21), as one task.
 *
 *   1. BASELINE   every letter once, letter only, no picture: the first hold
 *                 is recorded and the trial ends. The learner is told only
 *                 that it was recorded -- the ring and its (orange) burst
 *                 say the hold was taken, never right/wrong.       5 x 1 = 5
 *   2. TEACHING   every letter ten times, letter WITH its picture. A right
 *                 hold ends the trial (green burst, "Good job"); a wrong one
 *                 gets the hint.                                  5 x 10 = 50
 *   3. POST-TEST  as the baseline.                                5 x 1 = 5
 *
 * Five letters by default (DEMO_LETTERS, JT 2026-09-23); ?letters= for more.
 *
 * Every part is made of shuffled passes through the alphabet (a pass = each
 * letter once), seeded from the participant id, so no letter is seen twice
 * before every letter has been seen once. The questionnaire before is
 * questions.js (DEMOGRAPHIC_QUESTIONS); the one after is POST_QUESTIONS.
 *
 * The per-frame machinery is the tutor's (experiments/asl-tutor/engine.js and
 * flow.js: the hold-still ring, the grader, the hints, the pacing); what this
 * file owns is WHICH trial comes next and the study's stripped-down screen
 * (ui.js layout "study": the camera, the letter with its ring, the picture).
 *
 * URL: ?exp=asl-study   [&letters=…] [&reps=2,10,2] [&seed=n] [&debug=1]
 * `reps` shortens a run for trying it out; the numbers are logged. */

import { flattenRounded, DECIMALS } from "../tutor/landmarks.js";
import { loadModel } from "../tutor/verifier.js";
import { LETTERS, pictureUrl } from "../tutor/letters.js";
import { createPrng } from "../tutor/prng.js";
import { TUTOR_VERSION } from "./asl-tutor/flow.js";
import { createEngine, TUTOR_COMMIT_OPTS } from "./asl-tutor/engine.js";
import { createDebug } from "./asl-tutor/debug.js";
import { mountTutor } from "./asl-tutor/ui.js";
import { drawLandmarks } from "../js/core/experiment.js";
import { createHandPicker } from "../tutor/pick-hand.js";
import { seedFromParticipant, parseHintPolicy } from "./asl-tutor.js";

const MODEL_PATH = "tutor/model.json";
export const STUDY_VERSION = "asl-study/2";
// JT, 2026-09-22: one pass for each test, ten for teaching.
export const DEFAULT_REPS = Object.freeze({ pre: 1, teach: 10, post: 1 });
/* JT, 2026-09-23: five letters, for a short demo. The five the grader is surest
 * of on data it never saw (research/allletters-2026-09-22, per_letter.py:
 * correct hands accepted 0.93-0.99, look-alikes 0.00-0.03), none a movement,
 * none a look-alike of another, and each one a letter the owner's pilot went
 * from wrong to right on. The whole alphabet is ?letters=ABCDEFGHIJKLMNOPQRSTUVWXYZ. */
export const DEMO_LETTERS = Object.freeze(["B", "D", "F", "I", "V"]);

/* Which hand to sign with, from the questionnaire's dominantHand. Everyone is
 * asked to use ONE hand; "Left" means the left, anything else the right (the
 * pictures are drawn for a right hand, tutor/letters.js). */
export function studyHand(demographics) {
  return /^left/i.test(demographics?.dominantHand ?? "") ? "left" : "right";
}
const PHASES = ["pre", "teach", "post"];

/* A quiz trial that never gets a hold ends here, recorded as no answer; a
 * teaching trial gets the tutor's usual forty seconds. */
const QUIZ_DURATION_SEC = 20;
const TEACH_DURATION_SEC = 40;

/* A short looping film of a few trials, shown before a part starts (JT,
 * 2026-09-23). Made by tools/demo-video/, from real recorded hands. Browsers
 * only autoplay a muted video, so its music is behind a button. */
export const demoVideo = (src, label) => `
  <figure class="study-demo">
    <video src="${src}" autoplay loop muted playsinline preload="auto" aria-label="${label}"></video>
    <button type="button" class="study-demo-sound"
      onclick="const v=this.previousElementSibling; v.muted=!v.muted; this.textContent=v.muted?'Sound on':'Sound off'">Sound on</button>
  </figure>`;
export const TEST_DEMO = "assets/demo/test-demo.mp4";
export const TEACH_DEMO = "assets/demo/teach-demo.mp4";

/* The break screens between parts. As short as JT asked for; the film shows
 * the rest. The runner shows them on its rest screen (js/core/experiment.js). */
export const BREAKS = Object.freeze({
  teach: {
    restHeading: "Now we will teach you the signs",
    restHtml: `<p>Copy the picture, then hold your hand still until the circle fills.</p>
      ${demoVideo(TEACH_DEMO, "A short film of someone copying three signs")}`,
    restButton: "Start",
  },
  post: {
    restHeading: "Now show us the signs again",
    restHtml: `<p>Like the first part: no pictures, so sign each letter from memory.</p>
      ${demoVideo(TEST_DEMO, "A short film of someone signing three letters")}`,
    restButton: "Start",
  },
});

/* The whole session, as a list, in order. Pure: same inputs, same list.
 * @param {string[]} letters
 * @param {{pre:number, teach:number, post:number}} reps
 * @param {number} seed */
export function buildPlan(letters, reps, seed) {
  const prng = createPrng(seed);
  const plan = [];
  for (const phase of PHASES) {
    for (let pass = 0; pass < reps[phase]; pass++) {
      for (const letter of prng.shuffle(letters)) plan.push({ letter, kind: phase, pass });
    }
  }
  return plan;
}

export function parseReps(raw) {
  if (raw === null) return { ...DEFAULT_REPS };
  const parts = raw.split(",").map((v) => Number(v));
  if (parts.length !== 3 || parts.some((n) => !Number.isInteger(n) || n < 0) || parts.every((n) => n === 0)) {
    throw new Error(`?reps=${raw} should be three whole numbers, baseline,teaching,post-test -- for example reps=2,10,2.`);
  }
  return { pre: parts[0], teach: parts[1], post: parts[2] };
}

export function parseStudyLetters(raw) {
  if (raw === null) return DEMO_LETTERS.slice();
  const letters = raw.toUpperCase().split("");
  const bad = letters.filter((l) => !LETTERS.includes(l));
  if (bad.length || !letters.length) throw new Error(`?letters=${raw} contains ${bad.join(", ") || "nothing"}, which are not letters. Use A-Z.`);
  if (new Set(letters).size !== letters.length) throw new Error(`?letters=${raw} repeats a letter; each should appear once.`);
  return letters;
}

const params = new URLSearchParams(typeof location === "undefined" ? "" : location.search);
const hintPolicy = parseHintPolicy(params.get("hints"));
const debugOn = params.get("debug") === "1";

/* The runner reads maxTrials before mount, for "Trial 3 of N": N is the plan's
 * length, known from the URL alone. A bad URL falls back to the default; mount
 * then reports the real complaint. */
function plannedTrials() {
  try {
    const r = parseReps(params.get("reps"));
    return parseStudyLetters(params.get("letters")).length * (r.pre + r.teach + r.post);
  } catch {
    return DEMO_LETTERS.length * (DEFAULT_REPS.pre + DEFAULT_REPS.teach + DEFAULT_REPS.post);
  }
}

let view = null;
let debug = null;
let session = null;
let mountError = null;
let picker = null;

export default {
  id: "asl-study",
  title: "Learning the fingerspelling alphabet",

  tracker: "hand",
  // Two, so that the other hand coming into view cannot take the tracker away
  // from the one being used: pickHand below keeps the asked-for hand, and the
  // other is never graded, drawn or saved (tutor/pick-hand.js).
  trackerOptions: { numHands: 2 },

  pickHand(res, { aspect, demographics }) {
    const want = studyHand(demographics);
    if (picker?.want !== want) picker = Object.assign(createHandPicker(want), { want });
    return picker(res, aspect);
  },

  maxTrials: plannedTrials(),

  // JT, 2026-09-23: this and a film of a few trials, nothing more.
  instructions: ({ demographics } = {}) => `
    <p>We will first see which signs you already know.</p>
    <p><strong>Please use your ${studyHand(demographics)} hand.</strong></p>
    ${demoVideo(TEST_DEMO, "A short film of someone signing three letters")}
    <p class="subtle">Make the sign, then hold your hand still until the circle fills.</p>`,

  mount(el, { participant, demographics }) {
    let letters = DEMO_LETTERS.slice(), reps = { ...DEFAULT_REPS };
    try {
      letters = parseStudyLetters(params.get("letters"));
      reps = parseReps(params.get("reps"));
    } catch (err) {
      mountError = err;   // thrown from nextTrial, where the runner shows it
    }
    const urlSeed = params.get("seed");
    const seed = urlSeed !== null && urlSeed !== "" && Number.isInteger(Number(urlSeed))
      ? Number(urlSeed) >>> 0 : seedFromParticipant(participant?.participantId);

    const plan = buildPlan(letters, reps, seed);
    session = {
      letters, reps, seed, seedSource: urlSeed ? "url" : "participantId", plan, hand: studyHand(demographics),
      model: null, modelSha: null, engine: null, sessionLogged: false, replayExhausted: false,
      results: [],
    };
    view = mountTutor(el, { letters, hintPolicy, layout: "study", hand: session.hand });
    if (debugOn) debug = createDebug(el, { getModel: () => session.model, canSave: !params.has("replay") });
  },

  async nextTrial(index) {
    if (mountError) throw mountError;
    if (index === 0) await loadEverything();
    if (session.replayExhausted) return null;
    const step = session.plan[index];
    if (!step) return null;
    const next = session.plan[index + 1];
    const lastOfPart = next && next.kind !== step.kind;
    return {
      id: `t${String(index + 1).padStart(3, "0")}_${step.letter}_${step.kind}`,
      letter: step.letter,
      kind: step.kind,
      pass: step.pass,
      durationSec: step.kind === "teach" ? TEACH_DURATION_SEC : QUIZ_DURATION_SEC,
      countdownSec: 0,
      skipRest: !lastOfPart,
      ...(lastOfPart ? BREAKS[next.kind] : {}),
      backgroundUpload: true,
    };
  },

  onTrialStart(trial, { tracker }) {
    session.engine.startTrial(trial);
    debug?.trialStart(trial);
    return { tracker, addEvent: null, overlay: true };
  },

  onFrame({ landmarks, handedness, handednessScore, tMs, trial, state, video, addEvent, endTrial }) {
    state.addEvent = addEvent;
    if (!session.sessionLogged) {
      session.sessionLogged = true;
      addEvent("study-session", sessionRecord());
    }
    const flat = landmarks ? flattenRounded(landmarks, DECIMALS) : null;
    const out = session.engine.frame({ tMs, flat, aspect: video.aspect, videoHeight: video.height, handedness });
    view.progress(out.progress);
    view.paused(out.paused);
    applyEffects(out.effects, { trial, addEvent, endTrial });
    debug?.frame({ flat, handedness, handednessScore, trial, videoInfo: video, committerState: session.engine.committerState, progress: out.progress });

    let derived = { progress: round3(out.progress) };
    if (out.committed) derived = { ...derived, committed: true, sign: out.sign };
    if (state.tracker?.exhausted) {
      session.replayExhausted = true;
      if (session.engine.hasPending()) applyEffects(session.engine.flushAll(), { trial, addEvent, endTrial });
      else if (!session.engine.flowState?.ended) endTrial("replay-finished");
    }
    return derived;
  },

  // Dots on the hand in every part (JT): people should see they are tracked.
  draw(ctx, { landmarks, canvas }) {
    drawLandmarks(ctx, canvas, landmarks);
  },

  onTrialEnd({ state, endReason }) {
    if (state.addEvent == null) console.warn("asl-study: a zero-frame trial; its log rows were dropped");
    for (const e of session.engine.finishTrial(endReason)) {
      if (e.kind === "log") state.addEvent?.(e.event, e.data);
    }
    const s = session.engine.summary();
    const row = {
      letter: s.letter, kind: s.kind, attempts: s.attempts, outcome: s.outcome ?? null, wrongHand: !!s.wrongHand,
      // THE study measure: the model accepted it AND it was made with the asked-for hand.
      correct: s.outcome === "accept" && !s.wrongHand,
      firstHoldRight: s.firstHoldRight,
      firstAttemptCorrect: s.firstAttemptCorrect, assisted: s.assisted, finalOutcome: s.finalOutcome,
      gradable: true,
      strictTier: session.model.tiers[s.letter] ?? null,
    };
    if (session.results.length === 0) {
      row.study = { ...sessionRecord(), modelSha256: session.modelSha, plannedTrials: session.plan.length };
    }
    session.results.push(row);
    return row;
  },

  /* For tools/e2e-smoke.sh: the session in a few numbers. */
  e2eSummary(trialSummaries) {
    const n = (f) => trialSummaries.filter(f).length;
    return {
      letters: session.letters.join(""), reps: session.reps, planned: session.plan.length,
      pre: n((s) => s.kind === "pre"), teach: n((s) => s.kind === "teach"), post: n((s) => s.kind === "post"),
      recorded: n((s) => s.finalOutcome === "recorded"),
      quizAccepted: n((s) => (s.kind === "pre" || s.kind === "post") && s.correct === true),
      taught: n((s) => s.kind === "teach" && s.finalOutcome === "intro-done"),
    };
  },

  /* The page someone reads for ten seconds after they finish. Pre- and
   * post-test outcomes side by side, for the letters the model grades -- and
   * only there: "correct" on an ungraded letter would be a guess. */
  renderResults(summaries) {
    const by = {};
    for (const s of summaries) {
      if (!s.letter || !s.gradable) continue;
      const r = by[s.letter] ??= { pre: [], post: [], teach: 0, taught: 0 };
      if (s.kind === "teach") { r.teach++; if (s.finalOutcome === "intro-done" && s.firstAttemptCorrect) r.taught++; }
      else if (s.kind === "pre" || s.kind === "post") r[s.kind].push(s.correct === true);
    }
    const letters = Object.keys(by).sort();
    if (!letters.length) return `<p class="subtle">No graded letters in this session.</p>`;
    const pct = (a) => (a.length ? `${Math.round(100 * a.filter(Boolean).length / a.length)}%` : "—");
    const all = (k) => pct(letters.flatMap((l) => by[l][k]));
    return `<p>Your letters before and after the learning part (the model's
        verdict, never shown during the checks; a letter made with the other
        hand counts as not right):</p>
      <p><strong>Before: ${all("pre")} &nbsp; After: ${all("post")}</strong></p>
      <table class="results"><tr><th>letter</th><th>before</th><th>after</th></tr>
      ${letters.map((l) => `<tr><th>${l}</th><td>${pct(by[l].pre)}</td><td>${pct(by[l].post)}</td></tr>`).join("")}
      </table>
      <p class="subtle">Grading is approximate and based on public data — it can be wrong.</p>`;
  },
};

async function loadEverything() {
  let text;
  try {
    const res = await fetch(MODEL_PATH, { cache: "no-store" });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    text = await res.text();
  } catch (err) {
    throw new Error(`Could not load the grading model from ${MODEL_PATH} (${err?.message || err}).`);
  }
  session.model = loadModel(JSON.parse(text));
  session.engine = createEngine({ model: session.model, letters: session.letters, hintPolicy, gradeAll: true, hand: session.hand });
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  session.modelSha = [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

function sessionRecord() {
  return {
    studyVersion: STUDY_VERSION, tutorVersion: TUTOR_VERSION, hintPolicy,
    letters: session.letters.join(""), reps: session.reps, seed: session.seed, seedSource: session.seedSource,
    plannedTrials: session.plan.length, commitOptions: TUTOR_COMMIT_OPTS, debug: debugOn, hand: session.hand,
  };
}

function applyEffects(effects, { trial, addEvent, endTrial }) {
  for (const e of effects) {
    switch (e.kind) {
      case "cue": view.cue(e); break;
      case "feedback":
        view.feedback(e, trial.letter);
        addEvent("feedback", { trialId: trial.id, letter: trial.letter, tone: e.tone, hintId: e.hintId ?? null, showPicture: !!e.showPicture });
        break;
      case "status": view.status(e.text); break;
      case "reward": view.reward(e.points); break;
      case "complete": view.complete(); break;
      case "log": addEvent(e.event, e.data); if (e.event === "attempt") debug?.attempt(e.data); break;
      case "end-trial": endTrial(e.reason); break;
      case "schedule-report": break;   // the study has no adaptive schedule
      default: console.warn(`asl-study: unknown effect ${e.kind}`);
    }
  }
}

const round3 = (v) => Math.round(v * 1000) / 1000;
export { pictureUrl };
