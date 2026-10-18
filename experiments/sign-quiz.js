/* sign-quiz.js: a short ASL check before the expert fingerspelling test (JT, 2026-10-18).
 *
 * Prolific's "experts" were not fluent (2026-10-04/05: they reported 1-5 years of ASL and fingerspelled like novices),
 * so the Prolific expert link now asks two things first:
 *   1. how they would describe their ASL (one question, FLUENCY_QUESTION), and
 *   2. ten short videos of everyday ASL signs (not fingerspelling), each with four English words to choose from.
 * Only someone who says they are fluent (FLUENT) AND gets at least PASS_SCORE of the ten right goes on to the
 * fingerspelling test; everyone else is thanked and the session ends (js/core/experiment.js, screening).
 *
 * The signs (tools/sign-quiz/answers.json, which says how they were chosen): PopSign ASL v1.0 clips that are
 * one-handed and in their citation form, hard to guess for people who do not sign (ASL-LEX 2.0 iconicity rated by
 * hearing non-signers <= 2.5 of 7; not initialized, so knowing the alphabet does not give them away) and well known
 * to deaf signers (ASL-LEX frequency >= 4.5 of 7). The three wrong words are from the same category (a colour among
 * colours), so knowing what kind of word it is does not help. Guessing four-way, 8 of 10 happens about 4 times in
 * 10,000. No answer is ever marked right or wrong on the screen.
 *
 * The page never names the right option: the clips have opaque names and each question carries only a hash of its
 * answer (sign-quiz-key.js). Everything a participant chose, and how long they took, is saved under `screening`. */
import { QUESTIONS } from "./sign-quiz-data.js";
import { answerKey } from "./sign-quiz-key.js";
import { createPrng } from "../tutor/prng.js";

export const QUIZ_VERSION = "sign-quiz/1";
export const PASS_SCORE = 8;
export const FLUENT = Object.freeze(["Fluent: I can talk about anything in ASL comfortably", "Native: ASL is my first language"]);
export const FLUENCY_QUESTION = Object.freeze({
  id: "aslFluency",
  label: "How would you describe your ASL?",
  type: "radio",
  required: true,
  options: ["I do not use ASL", "Beginner: I know some signs", "Intermediate: I can have a simple conversation", ...FLUENT],
});
export const CREDIT = "Sign videos: PopSign ASL v1.0 (Starner et al., 2023), CC BY 4.0.";

/** The questions in this participant's order, each with its options in this participant's order. Pure. */
export function quizOrder(seed, questions = QUESTIONS) {
  const prng = createPrng(seed);
  return prng.shuffle(questions).map((q) => ({ ...q, options: prng.shuffle(q.options) }));
}

export async function isCorrect(question, option) {
  return (await answerKey(question.qid, option)) === question.key;
}

export function screeningPassed({ fluency, score }) {
  return FLUENT.includes(fluency) && score >= PASS_SCORE;
}

/* ---- the screens ---------------------------------------------------------- */
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

/**
 * Runs the check in `root` (the runner's #screening-body) and resolves with the record saved under `screening`.
 * @param {{seed:number, root:HTMLElement, show:() => void, form:{renderForm, readForm, focusField}, now?:() => number}} ctx
 */
export async function runSignQuiz({ seed, root, show, form, now = () => performance.now() }) {
  const startedAt = new Date().toISOString();
  const t0 = now();
  show();

  // 1. the fluency question, on the intro page
  root.innerHTML = `
    <h2>First, a short ASL check</h2>
    <div class="prose">
      <p>This study is for people who are fluent in American Sign Language (ASL).</p>
      <p>You will see <strong>10 short videos of everyday ASL signs</strong>. For each one, choose the English word it means.
         Each video repeats, so take the time you need. It takes about two minutes.</p>
    </div>
    <div id="sign-quiz-fluency"></div>
    <button id="sign-quiz-start" class="primary">Start</button>`;
  const formEl = root.querySelector("#sign-quiz-fluency");
  form.renderForm(formEl, [FLUENCY_QUESTION], {});
  let fluency;
  while (true) {
    await click(root.querySelector("#sign-quiz-start"));
    const { ok, values, firstError } = form.readForm(formEl, [FLUENCY_QUESTION]);
    if (ok) { fluency = values[FLUENCY_QUESTION.id]; break; }
    form.focusField(formEl, firstError);
  }

  // 2. the ten signs, one at a time, no feedback
  const order = quizOrder(seed);
  const answers = [];
  for (let i = 0; i < order.length; i++) {
    const q = order[i];
    root.innerHTML = `
      <p class="subtle sign-quiz-progress">Sign ${i + 1} of ${order.length}</p>
      <h2 class="sign-quiz-ask">What does this sign mean?</h2>
      <div class="sign-quiz-video"><video src="${esc(q.clip)}" autoplay loop muted playsinline preload="auto"
        aria-label="A short video of an ASL sign"></video></div>
      <div class="sign-quiz-options">
        ${q.options.map((o, k) => `<button type="button" class="sign-quiz-option" data-k="${k}">${esc(o)}</button>`).join("")}
      </div>
      <p class="subtle sign-quiz-credit">${esc(CREDIT)}</p>`;
    const shownAt = now();
    const k = await new Promise((resolve) => {
      root.querySelectorAll(".sign-quiz-option").forEach((b) => {
        b.onclick = () => {
          root.querySelectorAll(".sign-quiz-option").forEach((x) => { x.disabled = true; });
          resolve(Number(b.dataset.k));
        };
      });
    });
    const chosen = q.options[k];
    answers.push({ qid: q.qid, clip: q.clip, options: q.options, chosen, correct: await isCorrect(q, chosen), rtMs: Math.round(now() - shownAt) });
  }
  root.innerHTML = "";
  const score = answers.filter((a) => a.correct).length;
  return {
    version: QUIZ_VERSION, startedAt, durationMs: Math.round(now() - t0), seed,
    fluency, answers, score, of: answers.length, passScore: PASS_SCORE, fluentOptions: [...FLUENT],
    passed: screeningPassed({ fluency, score }),
  };
}

function click(button) {
  return new Promise((resolve) => { button.addEventListener("click", resolve, { once: true }); });
}
