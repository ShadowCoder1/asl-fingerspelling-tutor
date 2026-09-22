/* flow.js: one trial of the tutor, as a pure state machine.
 *
 * WHAT IT IS. Everything the tutor DECIDES lives here: which attempt is
 * consumed, what the learner is told, when the trial ends, what goes in the
 * log and what the schedule is told afterwards. Nothing here touches the DOM,
 * a clock, the network or Math.random -- it takes events in and returns a list
 * of EFFECTS, and experiments/asl-tutor.js is the only file that turns those
 * into pixels, log entries and endTrial() calls.
 *
 * WHY THE SPLIT. A tutor's rules are the part that is easy to get subtly wrong
 * and impossible to check by eye: "does an abstain consume an attempt", "is
 * this trial a first-time success", "which of two blamed blocks does the
 * learner hear about, and when". Fused into a browser file, those can only be
 * checked by a person with a webcam. Here they run under `node --test`
 * (tests/tutor-flow.test.js) with a stub verifier, and every rule below has a
 * test that fails if it changes.
 *
 * TIME COMES IN, IT IS NEVER READ. Retrieval latency and the status
 * rate-limiter both need a clock, and both take it from the event -- the
 * runner's per-trial tMs, which restarts near 0 every trial. A pure reducer
 * that reads Date.now() is not a pure reducer.
 *
 * WHAT IS DELIBERATELY NOT HERE: the ring (tutor/commit.js decides when an
 * attempt exists), the model (tutor/verifier.js grades it), the blame
 * (tutor/blame.js), the words (tutor/letters.js) and which letter comes next
 * (tutor/schedule-dropout.js). Those are injected as `deps` so the tests can
 * stub the two that need a 600 KB model file, and so this file cannot quietly
 * grow a second opinion about any of them. */

import { verify as realVerify, standardize as realStandardize } from "../../tutor/verifier.js";
import { chooseCorrection as realChooseCorrection } from "../../tutor/blame.js";
import { letterSpec as realLetterSpec, hintFor as realHintFor, pictureUrl as realPictureUrl } from "../../tutor/letters.js";

/* Stamped on every session so a log can say which tutor produced it. Bump it
 * when a rule below changes -- the logs from before and after a rule change
 * are not the same measurement, and nothing else in the record says so. */
export const TUTOR_VERSION = "asl-tutor/4";

export const MAX_ATTEMPTS = 3;

/* AN INTRO STAYS UP UNTIL THE LEARNER HAS MADE THE SIGN. It used to end on the
 * first hand held still, right or wrong, with "it will come back as a test" --
 * so a learner could leave an intro having held the picture's mirror image, or
 * the wrong orientation, and be none the wiser (first real sessions,
 * 2026-09-20: "at least I'd know the right orientation"). Now the picture and
 * its description stay on screen, a miss gets the same one-thing-to-change
 * hint a test would, and the intro ends when the hand is accepted.
 *
 * It is still NOT a test: nothing here reaches the schedule, no point is
 * scored, and every row is logged `graded: false`.
 *
 * THE SAFETY VALVE. The grader wrongly rejects some correct hands (on real
 * video, N was accepted 40% of the time). A learner must not be held in front
 * of a letter the grader cannot see, so after this many DIFFERENT missed hands
 * the intro ends anyway, and says so without claiming the hand was right. */
export const INTRO_MAX_MISSES = 5;

/* Three abstains in one trial and the trial is over. The learner has done
 * nothing wrong and cannot fix it by trying again: the camera, the light or
 * the framing is the problem, and repeating "I cannot see your hand" a fourth
 * time teaches only that the tutor is broken. */
export const MAX_SENSOR_ABSTAINS = 3;

/* How long the status line has to hold still before it may change. Without
 * this it re-renders on the frame "move your hand closer" and "I keep losing
 * your hand" trade places, thirty times a second, which is unreadable. */
export const STATUS_MIN_GAP_MS = 1500;

/* PACING. Version 1 had none: a trial ended on the frame its last hold was
 * graded and the next letter was up 30 ms later, so nobody ever saw "yes" or
 * the revealed sign, and a hand still held up from the last letter was graded
 * against the next one (first camera session, 2026-09-20). Two kinds of pause,
 * both decided here and carried out by the glue:
 *
 *   END_DWELL_MS   how long a finished trial stays on screen, by how it ended.
 *                  The `end-trial` effect carries it as `afterMs`.
 *   HOLD_OFF_MS    how long the ring stays shut while the learner is READING
 *                  something -- a new letter, a hint. A `hold-off` effect.
 *
 * The numbers are reading times, not measurements: about a second to take in
 * one word, two for a sentence, and long enough to study a picture that has
 * just been revealed. They are logged with the session (TUTOR_VERSION). */
export const END_DWELL_MS = Object.freeze({
  "intro-done": 1000, accept: 1300, corrected: 1300, failed: 5000, sensor: 3000,
  recorded: 800,    // "Recorded." -- a quiz answer, or a teach letter the model cannot grade
});
export const HOLD_OFF_MS = Object.freeze({
  intro: 1500,      // a picture and a description to look at first
  teach: 1500,
  test: 700,        // one letter to read
  review: 700,
  pre: 700,
  post: 700,
  correction: 2200, // a hint sentence, usually with the picture beside it
  borderline: 1200,
  sensor: 1500,
  samePose: 1000,
});

/* A block's gain counts toward the retrieval/execution triage when it is at
 * least this fraction of the best block's gain (spec A5.1, slice form). Two
 * blocks that BOTH matter mean the learner has recalled a different letter,
 * not fumbled one finger of this one -- and a different letter is not fixed by
 * being told about a finger. */
export const TRIAGE_SHARE = 0.25;

/* The classes in the model that are not letters. A rejected hand whose nearest
 * rival is one of these is unlike every letter rather than mixed up with one,
 * so it can never be a retrieval failure. */
const NON_LETTER_CLASSES = new Set(["_background", "_atypical"]);

/* What the learner is told when the grader abstained. Deliberately about the
 * room and the camera, never about the model: "I could not grade that" tells
 * someone holding up their hand nothing they can act on. */
const ABSTAIN_LINES = {
  tracking: "I couldn't see your hand clearly — move it to the middle, closer to the camera.",
  "not-gradable": "I couldn't see your hand clearly — move it to the middle, closer to the camera.",
  borderline: "Close — hold it clearly and try once more.",
};

/* THE SAME ANSWER IS NOT A SECOND ANSWER. After a reject or an abstain the
 * ring can close again on a hand that has not changed -- tracker noise alone
 * re-arms it on real video, and a learner reading a hint is a learner holding
 * still. Charging that as attempt two (and three) took all three tries off a
 * hand that never moved, in nine seconds. So a commit the engine marks
 * `samePose` is graded, and:
 *   - if it is now ACCEPTED, it counts, as the attempt it would have been (a
 *     hand on the edge of acceptance was right all along);
 *   - otherwise nothing happens: no attempt consumed, no new feedback, nothing
 *     added to the abstain counts, one status line saying why. Logged with
 *     `repeat: true`, so the rate is measurable.
 * The asymmetry is deliberate and is in the learner's favour. */
export const SAME_POSE_LINE = "Same shape as before — change it, then hold still.";

const STATUS_LINES = {
  tooSmall: "Move your hand closer.",
  dropout: "I keep losing your hand — check the lighting.",
  // The committer is still disarmed against the pose it graded last trial
  // (tutor/commit.js nextTrial): nothing can happen until the hand lets go.
  "held-over": "Relax your hand, then make this letter.",
  "unsteady-tracking": "I keep losing your hand — check the lighting.",
  moved: "Hold still when you have the shape.",
};

/* JSON has no way to write an infinity or a NaN, and JSON.stringify turns all
 * three into null -- which reads back as "there was no score" rather than
 * "the score was off the end of the scale". Both happen here for real: a hand
 * the features could not measure scores -Infinity, and its distance is
 * +Infinity. The fixtures already use these three words
 * (tools/make-verifier-fixture.py), so the log matches them. */
function logNumber(v) {
  if (Number.isFinite(v)) return v;
  if (v === Infinity) return "inf";
  if (v === -Infinity) return "-inf";
  return "nan";
}

/**
 * @param {object} o
 * @param {object} o.model        a loaded model (tutor/verifier.js loadModel)
 * @param {string[]} o.letters    the letters this session teaches, in order
 * @param {"strict"|"lenient"} o.hintPolicy
 * @param {object} [o.deps]       verify / standardize / chooseCorrection /
 *                                letterSpec / hintFor / pictureUrl overrides
 * @returns a flow: startTrial, onCommit, onStatus, finishTrial, summary, state
 */
export function createFlow({ model, letters, hintPolicy = "strict", maxAttempts = MAX_ATTEMPTS, deps = {} }) {
  if (!model) throw new Error("createFlow: a loaded model is required");
  if (hintPolicy !== "strict" && hintPolicy !== "lenient") {
    throw new Error(`createFlow: hintPolicy must be "strict" or "lenient", got ${JSON.stringify(hintPolicy)}`);
  }
  const verify = deps.verify ?? realVerify;
  const standardize = deps.standardize ?? realStandardize;
  const chooseCorrection = deps.chooseCorrection ?? realChooseCorrection;
  const letterSpec = deps.letterSpec ?? realLetterSpec;
  const hintFor = deps.hintFor ?? realHintFor;
  const pictureUrl = deps.pictureUrl ?? realPictureUrl;

  // Per-trial state. Every field is set by startTrial, so a trial can never
  // inherit half of the previous one's.
  let t = null;

  /* THE STUDY'S TRIAL KINDS (experiments/asl-study.js, JT's design of
   * 2026-09-21), beside the tutor's intro / test / review:
   *   pre, post   a QUIZ. The letter alone; the first hold is recorded and the
   *               trial ends. The learner is told only that it was recorded --
   *               never whether it was right. The model's verdict is still
   *               logged, tier-blind, so pre/post accuracy can be read off the
   *               session without re-grading; it is never shown.
   *   teach       the letter WITH its picture, like an intro: a correct hold
   *               ends it, a wrong one gets the hint, and after INTRO_MAX_MISSES
   *               it moves on. A letter the model does not grade (tier 2, or J
   *               and Z, which are movements) is recorded on its first hold and
   *               moves on -- the picture did the teaching. */
  const isQuiz = (kind) => kind === "pre" || kind === "post";
  const isIntroLike = (kind) => kind === "intro" || kind === "teach";
  // A letter the model has a class for. Tests stub the model with a tier
  // table alone, so the tiers are the fallback.
  const inModel = (letter) => (model.letters ? model.letters.includes(letter) : letter in model.tiers);
  const gradable = (letter) => inModel(letter) && model.tiers[letter] === 1;

  function startTrial(trial) {
    t = {
      trial,
      letter: trial.letter,
      kind: trial.kind,
      attempts: 0,          // CONSUMED attempts -- abstains are not among them
      commits: 0,           // every committed hold, graded or not
      sensorAbstains: 0,
      borderlineRun: 0,
      assisted: false,
      firstAttemptCorrect: null,
      heldBackBlock: null,  // the second blamed block, saved for the next reject
      lastOutcome: null,    // the last graded verdict of this trial
      ended: false,
      endReason: null,
      reported: false,
      statusText: null,
      statusAt: null,
    };

    const spec = letterSpec(trial.letter);
    const intro = isIntroLike(trial.kind);
    return [{
      kind: "cue",
      letter: trial.letter,
      trialKind: trial.kind,
      // A test shows the LETTER only. Retrieval first: a learner copying a
      // picture is practicing copying, and the thing being taught is recalling
      // the shape from the letter (spec A4).
      showPicture: intro,
      pictureUrl: intro ? pictureUrl(trial.letter) : null,
      describe: intro ? spec.describe : null,
      mnemonic: intro ? (spec.mnemonic ?? null) : null,
      // The landmark skeleton helps someone copying a shape and gives away
      // nothing; during a test it is a distraction from their own hand.
      overlay: intro,
    }, holdOff(HOLD_OFF_MS[trial.kind] ?? HOLD_OFF_MS.test)];
  }

  /* One committed hold: the learner has declared an attempt (tutor/commit.js).
   *
   * @param {object} o
   * @param {object} o.committed   what createCommitter returned
   * @param {number[]} o.x         the raw 46 features
   * @param {object} o.quality     handPresentFrac / palmSizePx / centered /
   *                               chiralityMargin, as verify demands
   * @param {number} [o.sign]      chirality sign, logged only
   * @param {boolean} [o.samePose] the engine's word that this is the pose it
   *                               graded last time in this trial
   */
  function onCommit({ committed, x, quality, sign = null, samePose = false }) {
    if (t === null) throw new Error("flow.onCommit: no trial has been started");
    if (t.ended) return [];   // the runner has one more frame in flight; ignore it
    t.commits++;

    const graded = !isIntroLike(t.kind) && !isQuiz(t.kind);
    // An intro is never scored, but it IS verified, tier-blind, and logged: a
    // session's intro attempts are the only record of what a learner's hand
    // looked like before they were told anything, and they cost nothing to
    // keep. `graded: false` on the row says the tutor acted on none of it.
    // A letter the model has no class for (J, Z) gets a null verdict, not a
    // crash: the hold is still the data.
    const v = inModel(t.letter)
      ? verify(model, x, t.letter, quality, graded ? undefined : { ignoreTier: true })
      : { outcome: null, reason: "not-in-model", score: NaN, d2: NaN, gate: NaN, rival: null, tier: null };

    const base = {
      trialId: t.trial.id,
      letter: t.letter,
      trialKind: t.kind,
      graded,
      outcome: v.outcome,
      reason: v.reason,
      score: logNumber(v.score),
      d2: logNumber(v.d2),
      gate: logNumber(v.gate),
      rival: v.rival ?? null,
      tier: v.tier,
      tierIgnored: v.tierIgnored ?? false,
      hintPolicy,
      // cue -> hold start, and hold start -> commit. The first is retrieval
      // (how long it took to remember the shape), the second is how long the
      // ring took; mixing them would make neither readable.
      retrievalLatencyMs: committed.tStart,
      holdMs: committed.tCommit - committed.tStart,
      handPresentFrac: committed.handPresentFrac,
      palmSizePx: quality.palmSizePx,
      centered: quality.centered,
      chiralitySign: sign,
      chiralityMargin: logNumber(quality.chiralityMargin),
      // Filled in by whichever branch runs; present on every row either way,
      // so an analysis never has to ask whether a key exists.
      attempt: t.attempts,
      consumed: false,
      triage: null,
      blocks: [],
      gains: null,
      selfConsistent: null,
      fallback: null,
      nothingToSay: false,
      hintId: null,
      // True when the hint on this row is the block held back from an EARLIER
      // correction in this trial rather than one chosen from this attempt.
      // Without it the two are indistinguishable in the log, and "did the
      // second hint help" is a question about a different thing than "did the
      // first one".
      heldBack: false,
      // True when this is the same pose as the last graded one (see
      // SAME_POSE_LINE). A repeat that is not an accept changes nothing.
      repeat: false,
    };

    if (isQuiz(t.kind) || (t.kind === "teach" && !gradable(t.letter))) {
      // Recorded and done. `consumed` stays false: nothing was charged to the
      // learner, and the analysis reads `outcome` (null for J and Z).
      t.lastOutcome = v.outcome;
      return [log("attempt", base), say("Recorded.", "done"), ...end("recorded")];
    }
    if (!graded) return onIntroCommit(base, v, x, samePose);
    if (samePose === true && (t.lastOutcome === "reject" || t.lastOutcome === "abstain")) {
      base.repeat = true;
      if (v.outcome !== "accept") {
        base.attempt = t.attempts;
        return [log("attempt", base), { kind: "status", text: SAME_POSE_LINE }, holdOff(HOLD_OFF_MS.samePose)];
      }
    }
    t.lastOutcome = v.outcome;
    if (v.outcome === "accept") return onAccept(base);
    if (v.outcome === "abstain") return onAbstain(base, v);
    return onReject(base, v, x);
  }

  /* One held hand on an intro (see INTRO_MAX_MISSES for the why). */
  function onIntroCommit(base, v, x, samePose) {
    const missedBefore = t.lastOutcome === "reject" || t.lastOutcome === "abstain";
    if (samePose === true && missedBefore && v.outcome !== "accept") {
      // The same hand again: nothing new to say about it (SAME_POSE_LINE).
      base.repeat = true;
      base.attempt = t.attempts;
      return [log("attempt", base), { kind: "status", text: SAME_POSE_LINE }, holdOff(HOLD_OFF_MS.samePose)];
    }
    base.repeat = samePose === true && missedBefore;
    t.lastOutcome = v.outcome;

    if (v.outcome === "accept") {
      base.attempt = t.attempts + 1;
      return [
        log("attempt", base),
        { kind: "reward", points: 0 },   // the glow, not a point: this was not a test
        say(`Yes — that is ${t.letter}. It will come back as a test.`, "correct"),
        ...end("intro-done"),
      ];
    }

    if (v.outcome === "abstain") {
      base.attempt = t.attempts;
      if (v.reason === "borderline") {
        return [log("attempt", base), say(ABSTAIN_LINES.borderline, "neutral"), holdOff(HOLD_OFF_MS.borderline)];
      }
      t.sensorAbstains++;
      const effects = [log("attempt", base), say(ABSTAIN_LINES[v.reason] ?? ABSTAIN_LINES.tracking, "sensor")];
      if (t.sensorAbstains >= MAX_SENSOR_ABSTAINS) effects.push(...end("sensor"));
      else effects.push(holdOff(HOLD_OFF_MS.sensor));
      return effects;
    }

    // A miss: the same correction a test would give, beside the picture that
    // is already up -- so the effect must not re-set the reference panel, which
    // would drop the description and the mnemonic the intro is showing.
    t.attempts++;
    base.attempt = t.attempts;
    const correction = correctionEffects(base, x, v).map((e) =>
      (e.kind === "feedback" ? { ...e, showPicture: false, pictureUrl: null, describe: null } : e));
    const effects = [log("attempt", base), ...correction];
    if (t.attempts >= INTRO_MAX_MISSES) {
      effects.push(say(t.kind === "teach" ? "Let's move on." : `Let's move on — ${t.letter} will come back as a test.`, "done"), ...end("intro-done"));
    } else {
      effects.push(holdOff(HOLD_OFF_MS.correction));
    }
    return effects;
  }

  function onAccept(base) {
    t.borderlineRun = 0;
    t.attempts++;
    base.attempt = t.attempts;
    base.consumed = true;
    if (t.firstAttemptCorrect === null) t.firstAttemptCorrect = true;
    return [
      log("attempt", base),
      { kind: "reward", points: 1 },
      say(`Yes — that is ${t.letter}.`, "correct"),
      ...end(t.attempts === 1 ? "accept" : "corrected"),
    ];
  }

  function onAbstain(base, v) {
    if (v.reason === "borderline") {
      t.borderlineRun++;
      if (t.borderlineRun >= 2) {
        /* Twice in a row on the edge is not a camera problem and not a run of
         * bad luck: the hand is consistently almost-but-not-this-letter, and
         * "hold it clearly and try once more" has already been said once. So
         * the learner gets a real correction. The ATTEMPT is still not
         * consumed -- the model declined to say the hand was wrong, and
         * spending one of three tries on a verdict nobody gave would punish
         * the learner for the grader's uncertainty. The row is logged under
         * its own reason so the rate of this is measurable. */
        t.borderlineRun = 0;
        base.reason = "borderline-escalated";
        base.attempt = t.attempts;
        return [log("attempt", base), ...correctionEffects(base), holdOff(HOLD_OFF_MS.correction)];
      }
      base.attempt = t.attempts;
      return [log("attempt", base), say(ABSTAIN_LINES.borderline, "neutral"), holdOff(HOLD_OFF_MS.borderline)];
    }

    // Anything else the grader would not answer. "tier2" should be impossible
    // -- experiments/asl-tutor.js refuses tier-2 letters -- so it is counted
    // here with the sensor abstains and logged as itself rather than being
    // silently swallowed.
    t.borderlineRun = 0;
    t.sensorAbstains++;
    base.attempt = t.attempts;
    const effects = [log("attempt", base)];
    if (v.reason === "tier2") {
      effects.push(log("anomaly", { what: "tier2 abstain reached the flow", letter: t.letter }));
    }
    if (t.sensorAbstains >= MAX_SENSOR_ABSTAINS) {
      effects.push(say(ABSTAIN_LINES.tracking, "sensor"), ...end("sensor"));
      return effects;
    }
    effects.push(say(ABSTAIN_LINES[v.reason] ?? ABSTAIN_LINES.tracking, "sensor"), holdOff(HOLD_OFF_MS.sensor));
    return effects;
  }

  function onReject(base, v, x) {
    t.borderlineRun = 0;
    t.attempts++;
    base.attempt = t.attempts;
    base.consumed = true;
    if (t.firstAttemptCorrect === null) t.firstAttemptCorrect = false;

    const effects = [];
    const correction = correctionEffects(base, x, v);
    // The log row is built by correctionEffects (it is what learns the triage
    // and the blocks), so it is emitted after, not before.
    effects.push(log("attempt", base), ...correction);

    if (t.attempts >= maxAttempts) {
      const spec = letterSpec(t.letter);
      effects.push({
        kind: "feedback", tone: "reveal",
        text: "Here is the sign. Have a look, and we will come back to it.",
        showPicture: true, pictureUrl: pictureUrl(t.letter), describe: spec.describe, hintId: null,
      });
      t.assisted = true;
      effects.push(...end("failed"));
    } else {
      effects.push(holdOff(HOLD_OFF_MS.correction));
    }
    return effects;
  }

  /* The correction the learner sees after a reject (or an escalated
   * borderline), and the fields it writes onto that attempt's log row.
   *
   * `x` is absent for an escalated borderline: the model declined to reject
   * that hand, so asking the blamer which block is wrong would be asking about
   * a verdict nobody gave. That case gets the picture and the description --
   * the honest "look at it again" -- with no block named. */
  function correctionEffects(base, x, v) {
    const spec = letterSpec(t.letter);
    t.assisted = true;

    if (x === undefined) {
      // No triage: the model declined to reject this hand, so nothing was
      // blamed and nothing was compared. Writing "retrieval" here because the
      // feedback LOOKS like the retrieval feedback would put a verdict nobody
      // reached into every retrieval-rate the logs are asked for.
      base.triage = null;
      return [{
        kind: "feedback", tone: "correction",
        text: "Not quite. Here is the shape again.",
        showPicture: true, pictureUrl: pictureUrl(t.letter), describe: spec.describe, hintId: null,
      }];
    }

    const z = standardize(model, x);
    const c = chooseCorrection(model, z, t.letter);
    base.blocks = c.blocks.slice();
    base.gains = { ...c.gains };
    base.selfConsistent = c.selfConsistent;
    base.fallback = c.fallback;
    base.nothingToSay = c.nothingToSay === true;

    const effects = [];
    if (c.nothingToSay) {
      // The model rejected this hand and then said it needs no correction.
      // Those cannot both be true; something upstream disagrees with itself
      // and the rate of it is worth a row of its own.
      effects.push(log("anomaly", {
        what: "nothingToSay after a reject", letter: t.letter, trialId: t.trial.id, outcome: base.outcome,
      }));
      base.triage = "execution";
      effects.push({
        kind: "feedback", tone: "correction", text: "Try again.",
        showPicture: true, pictureUrl: pictureUrl(t.letter), describe: spec.describe, hintId: null,
      });
      return effects;
    }

    base.triage = triage(v?.rival, c.gains);
    if (base.triage === "retrieval") {
      t.heldBackBlock = null;   // a different letter is not fixed one block at a time
      effects.push({
        kind: "feedback", tone: "correction",
        text: "That is a different sign. Here is this one again.",
        showPicture: true, pictureUrl: pictureUrl(t.letter), describe: spec.describe, hintId: null,
      });
      return effects;
    }

    const { block, heldBack } = chooseBlock(c);
    if (block === null) {
      effects.push({
        kind: "feedback", tone: "correction",
        text: "Not quite — have a look at the shape again.",
        showPicture: true, pictureUrl: pictureUrl(t.letter), describe: spec.describe, hintId: null,
      });
      return effects;
    }

    base.hintId = `${t.letter}.${block}`;
    base.heldBack = heldBack;
    effects.push({
      kind: "feedback", tone: "correction",
      text: hintFor(t.letter, block),
      // The picture goes up beside every hint: "straighten your index finger"
      // means one thing next to the shape it belongs to and another on its own.
      showPicture: true, pictureUrl: pictureUrl(t.letter), describe: null, hintId: base.hintId,
    });
    return effects;
  }

  /* Which single block the learner hears about.
   *
   * A block held back from an EARLIER correction in this trial wins: the
   * blamer already said those two together would be enough, and the learner
   * has just done the first one. Re-blaming from scratch would start the
   * conversation over on a hand that has already moved once on our advice. */
  function chooseBlock(c) {
    if (t.heldBackBlock !== null) {
      const held = t.heldBackBlock;
      t.heldBackBlock = null;
      return { block: held, heldBack: true };
    }
    if (hintPolicy === "lenient") {
      // Whatever would help most, whether or not fixing it alone is enough by
      // the model's own arithmetic. More hints, some of them wrong: the
      // trade-off is the point of the switch, and the logs measure it.
      return { block: bestGainBlock(c.gains), heldBack: false };
    }
    // strict: only a correction the model itself says would be sufficient.
    if (!c.selfConsistent || c.blocks.length === 0) return { block: null, heldBack: false };
    if (c.blocks.length > 1) t.heldBackBlock = c.blocks[1];
    return { block: c.blocks[0], heldBack: false };
  }

  function bestGainBlock(gains) {
    let best = null, bestGain = 0;
    for (const [block, gain] of Object.entries(gains ?? {})) {
      if (Number.isFinite(gain) && gain > bestGain) { best = block; bestGain = gain; }
    }
    return best;
  }

  /* Retrieval or execution (spec A5.1, slice form). Retrieval means the
   * learner produced a DIFFERENT letter: the nearest rival is another letter,
   * and the hand is wrong in more than one place at once. One finger out of
   * place with a letter next door is still this letter, fumbled. */
  function triage(rival, gains) {
    if (typeof rival !== "string" || NON_LETTER_CLASSES.has(rival)) return "execution";
    if (rival === t.letter) return "execution";
    const values = Object.values(gains ?? {}).filter((g) => Number.isFinite(g) && g > 0);
    if (values.length < 2) return "execution";
    const best = Math.max(...values);
    const supported = values.filter((g) => g >= TRIAGE_SHARE * best).length;
    return supported >= 2 ? "retrieval" : "execution";
  }

  /* The one-line status under the ring: what the committer is struggling with.
   * Rate-limited by the caller's own clock, and a repeat of the current line
   * is never re-emitted, so the UI is not asked to rewrite the same sentence
   * thirty times a second. */
  function onStatus({ tMs, tooSmall, lastResetReason }) {
    if (t === null || t.ended) return [];
    // A hand too small to measure outranks a reset reason: the reset is a
    // CONSEQUENCE of the size, and telling someone their tracking is unsteady
    // when the fix is "come closer" sends them to check their light bulbs.
    const text = tooSmall ? STATUS_LINES.tooSmall : (lastResetReason ? STATUS_LINES[lastResetReason] ?? null : null);
    // A repeat's own line (SAME_POSE_LINE) stays until the committer has
    // something new to say; without this the very next frame would clear it.
    if (text === null && t.statusText === SAME_POSE_LINE) return [];
    if (text === t.statusText) return [];
    if (t.statusAt !== null && tMs - t.statusAt < STATUS_MIN_GAP_MS) return [];
    t.statusText = text;
    t.statusAt = tMs;
    const effects = [{ kind: "status", text: text ?? "" }];
    if (text !== null) effects.push(log("status", { trialId: t.trial.id, tMs, text, tooSmall, lastResetReason }));
    return effects;
  }

  /* The trial is over, however it ended -- the flow's own end() above, the
   * runner's duration cap, or a replay running dry. The schedule hears about
   * it here and nowhere else, exactly once. */
  function finishTrial(endReason) {
    if (t === null) throw new Error("flow.finishTrial: no trial has been started");
    if (t.reported) return [];
    t.reported = true;
    t.ended = true;
    if (t.endReason === null) t.endReason = endReason;

    const s = summary();
    /* A test or review that never consumed an attempt graded NOBODY: the
     * camera lost the hand, the time ran out before anything was held still,
     * a replay ran dry. Reported as firstAttemptCorrect: false -- the only
     * other honest-looking choice -- the schedule would record an error and
     * send the letter's mastery backwards, immediately after this same file
     * told the learner it could not see their hand. `ungraded` is the third
     * answer: the letter still has to come back, and it costs nothing.
     *
     * An intro is never "ungraded" in this sense, because it was never going
     * to be graded; it reports the booleans the schedule ignores, as before. */
    const report = s.ungraded
      ? { kind: "schedule-report", letter: t.letter, ungraded: true }
      // Booleans always, even on an intro or a review where the schedule
      // ignores both: it throws on anything else for a test trial, and a
      // caller that sends null "because it does not matter here" is one
      // refactor away from sending null where it does.
      : { kind: "schedule-report", letter: t.letter, firstAttemptCorrect: s.firstAttemptCorrect, assisted: s.assisted };
    return [log("trial-end", { trialId: t.trial.id, ...s }), report];
  }

  /* What onTrialEnd hands back to the runner. Deliberately NOT named
   * endReason: the runner writes its own, last, and a summary key of that name
   * would be overwritten (or worse, overwrite it). */
  function summary() {
    // "The learner was never given a verdict on this trial." See finishTrial.
    const ungraded = !isIntroLike(t.kind) && !isQuiz(t.kind) && t.attempts === 0;
    return {
      letter: t.letter,
      kind: t.kind,
      attempts: t.attempts,
      // The model's last verdict on this trial, shown or not. On a quiz it is
      // the one thing the study measures, and it was never shown.
      outcome: t.lastOutcome,
      // null, not false, when ungraded: `false` reads as a real wrong answer,
      // and an analyst who forgets to join on `ungraded` would recreate the
      // exact bug ungraded reporting exists to prevent, one layer up (m7).
      firstAttemptCorrect: ungraded ? null : t.firstAttemptCorrect === true,
      assisted: t.assisted,
      ungraded,
      finalOutcome: t.endReason,
    };
  }

  function end(reason) {
    t.ended = true;
    t.endReason = reason;
    return [{ kind: "end-trial", reason, afterMs: END_DWELL_MS[reason] ?? 0 }];
  }

  const holdOff = (ms) => ({ kind: "hold-off", ms });
  const log = (event, data) => ({ kind: "log", event, data });
  const say = (text, tone) => ({ kind: "feedback", tone, text, showPicture: false, pictureUrl: null, describe: null, hintId: null });

  return {
    startTrial, onCommit, onStatus, finishTrial, summary,
    get state() {
      return t === null ? null : {
        letter: t.letter, kind: t.kind, attempts: t.attempts, commits: t.commits,
        sensorAbstains: t.sensorAbstains, assisted: t.assisted, ended: t.ended, endReason: t.endReason,
      };
    },
  };
}
