/* =============================================================================
 *  questions.js: the demographic questions asked before the task starts.
 * =============================================================================
 *
 *  THIS FILE IS MEANT TO BE EDITED. Add, remove, or reorder the entries in
 *  DEMOGRAPHIC_QUESTIONS below and reload the page. Nothing else needs changing:
 *  the form builds itself, validates itself, and the answers are saved under
 *  `demographics` in each session.
 *
 *  After editing, open index.html and click through to the questions screen to
 *  see them the way participants will. A bad question shows up there straight
 *  away: a drop-down with nothing in it, a label that does not read right, a
 *  required field that cannot be filled.
 *
 *  Full guide with examples: docs/EDITING-QUESTIONS.md
 *
 *  ---------------------------------------------------------------------------
 *  ADDING A QUESTION
 *  ---------------------------------------------------------------------------
 *  Copy one of the entries below and change it. Every question needs an `id`
 *  and a `label`. The `id` becomes the column name in your data, so use short
 *  names without spaces, and do not reuse one.
 *
 *      { id: "handedness", label: "Dominant hand", type: "select",
 *        options: ["Right", "Left"] }
 *
 *  ---------------------------------------------------------------------------
 *  THE FIVE TYPES
 *  ---------------------------------------------------------------------------
 *      type: "select"     a drop-down. Needs `options`.
 *      type: "radio"      the same, but all choices shown at once. Needs `options`.
 *      type: "checkboxes" choose any number. Needs `options`. Saved as a list.
 *      type: "number"     a number box. Optional `min` and `max`.
 *      type: "text"       a single line of text.
 *      type: "textarea"   a larger box for a longer answer.
 *      type: "range"      a slider. Optional `min`, `max`, `step` and `unit`
 *                         (shown after the number). Unanswered until moved.
 *      type: "heading"    not a question: a section title (label) and an
 *                         optional note (help) between questions.
 *
 *  ---------------------------------------------------------------------------
 *  OPTIONAL SETTINGS ON ANY QUESTION
 *  ---------------------------------------------------------------------------
 *      required: true     participant cannot continue without answering.
 *                         Shown with a red asterisk. Defaults to false.
 *      help: "..."        smaller grey text under the label.
 *      placeholder: "..." greyed-out example inside a text or number box.
 *
 *  ---------------------------------------------------------------------------
 *  ONE SPECIAL ID
 *  ---------------------------------------------------------------------------
 *  A question with id "participantId" is also used as the participant's ID in
 *  your data. If they arrived from Prolific it is filled in for them. If they
 *  leave it blank they are given a random anonymous ID instead. Delete this
 *  question if you do not want to ask for it.
 *
 *  To skip demographics entirely, set DEMOGRAPHIC_QUESTIONS to an empty list:
 *      export const DEMOGRAPHIC_QUESTIONS = [];
 * ===========================================================================*/

export const DEMOGRAPHIC_QUESTIONS = [

  // JT, 2026-09-23: four questions only, for the short demo.
  { id: "age",
    label: "Age",
    type: "number",
    required: true,
    placeholder: "e.g. 42",
    min: 18,
    max: 120 },

  { id: "sexAtBirth",
    label: "Sex",
    type: "select",
    required: true,
    options: ["Female", "Male", "Intersex", "Prefer not to say"] },

  // ASL specifically (JT, 2026-09-28): the pilot asked about ANY sign language,
  // and three people who said 1 to 2 years knew almost none of the ASL
  // alphabet. A new id, so these answers are never pooled with the pilot's.
  { id: "aslYears",
    label: "How many years have you used American Sign Language (ASL)?",
    help: "Count classes, apps and everyday use. Other sign languages (for example BSL) do not count here. If you have never used ASL, choose None.",
    type: "radio",
    required: true,
    options: ["None",
              "Less than 1 year",
              "1 to 2 years",
              "3 to 5 years",
              "More than 5 years"] },

  // The study asks for this hand by name (experiments/asl-study.js studyHand):
  // "Left" means the left hand, anything else the right.
  { id: "dominantHand",
    label: "Dominant hand",
    help: "The hand you write with.",
    type: "radio",
    required: true,
    options: ["Right", "Left"] },

];

/* The expert link's questions (?mode=expert; JT, 2026-10-18). The ASL question
 * comes first and has two answers: on the Prolific expert link, anyone who does
 * not say fluent is thanked and stops there (experiments/asl-study.js,
 * screening). Years of ASL is a number on a slider, 0 to 100. Both have new ids
 * (aslFluency, aslYearsNumber), so they are never pooled with the novice
 * study's year categories (aslYears). */
export const ASL_FLUENT = "Fluent: I can talk about anything in ASL comfortably";
const asked = (id) => DEMOGRAPHIC_QUESTIONS.find((q) => q.id === id);
export const EXPERT_DEMOGRAPHIC_QUESTIONS = [
  { id: "aslFluency",
    label: "How would you describe your ASL?",
    type: "radio",
    required: true,
    options: ["I do not use ASL", ASL_FLUENT] },

  { id: "aslYearsNumber",
    label: "How many years have you used American Sign Language (ASL)?",
    help: "Drag the slider. Count classes, apps and everyday use. Other sign languages (for example BSL) do not count here.",
    type: "range",
    required: true,
    min: 0,
    max: 100,
    step: 1,
    unit: "years" },

  asked("age"),
  asked("sexAtBirth"),
  asked("dominantHand"),
];

/* =============================================================================
 *  AFTER the task. Same format. Shown on its own screen once the last trial
 *  is done and before the results; saved in the session document as
 *  `postQuestionnaire`. An empty list means no screen.
 * ===========================================================================*/
export const POST_QUESTIONS = [

  { id: "confidence",
    label: "How confident are you that you could sign these letters now?",
    type: "radio",
    required: true,
    options: ["Not at all", "A little", "Somewhat", "Quite", "Very"] },

  { id: "hardestLetters",
    label: "Which letters were hardest? (optional)",
    type: "text",
    placeholder: "e.g. D F" },

  { id: "feedbackHelped",
    label: "In the learning part, did the corrections (what to change) help?",
    type: "radio",
    required: true,
    options: ["They were wrong or confusing", "They did not help much", "They helped a bit", "They helped a lot", "I did not get any"] },

  // 2026-09-28: what it was like, and what would make it more fun
  { id: "experience",
    label: "What was the task like for you?",
    help: "What you liked, what you didn't, what felt easy or hard.",
    type: "textarea",
    required: true },

  { id: "improve",
    label: "What would make it more fun and engaging?",
    help: "Anything you would change or add: the pace, the pictures, the feedback, rewards, games.",
    type: "textarea",
    required: true },

  { id: "comments",
    label: "Anything else? Problems with the camera, things that were unclear. (optional)",
    type: "textarea" },

];

/* The expert link's questions at the end (Indranil Nyamsuren, 2026-10-18; JT: experts do the test, then one practice
 * cycle, then these). All optional (JT/Indranil: "optional or for bonus payment"). Indranil's wording, in his order
 * and under his headings. */
const openQ = (id, label) => ({ id, label, type: "textarea" });
export const EXPERT_POST_QUESTIONS = [
  { id: "intro", type: "heading", label: "Your feedback (optional)",
    help: "These questions are optional, but your answers will help us design the next version for people learning fingerspelling. Answer as many as you like." },

  { id: "hUsability", type: "heading", label: "Using the platform" },
  openQ("clearIntuitive", "What aspects of the platform were immediately clear or intuitive?"),
  openQ("unsureNext", "Were there any moments when you were unsure what to do next?"),

  { id: "hLetters", type: "heading", label: "Recognizing letters" },
  openQ("inaccurateLetters", "Did you notice letters that were represented inaccurately?"),
  openQ("recognizedConsistently", "Did the platform appear to recognize correctly produced letters consistently?"),
  openQ("wrongAcceptReject", "Were there instances when you thought an incorrect response was accepted, or a correct response was rejected?"),

  { id: "hBeginners", type: "heading", label: "Sharing with beginners" },
  openQ("trustAssessment", "Would you trust this platform’s assessment of fingerspelling ability? Why or why not?"),
  openQ("helpfulForLearners", "In what ways might this platform be helpful for someone learning fingerspelling?"),
  openQ("confusingForLearners", "In what ways might this platform be confusing for someone learning fingerspelling?"),
  openQ("teachingUse", "If you were teaching someone fingerspelling, how would you use this platform in your instruction?"),

  { id: "hFeedback", type: "heading", label: "The feedback in the practice part" },
  openQ("feedbackClarity", "How clear was the feedback provided after each response?"),
  openQ("feedbackUnderstanding", "Did the feedback help you understand what was correct or incorrect?"),
  openQ("recommendLikelihood", "How likely would you be to recommend this platform to someone learning fingerspelling? Why?"),
];

/* Asked BEFORE the task on the expert link (Indranil, 2026-10-18: "we kind of want to prime them to think about their
 * learning journey at the start"): after the ASL check, before the camera. Moved here from the questions at the end. */
export const EXPERT_PRETASK_QUESTIONS = [
  { id: "hBackground", type: "heading", label: "Your background",
    help: "Think back to when you were first learning to fingerspell." },
  openQ("learnedFingerspelling", "How did you learn to fingerspell?"),
  openQ("fingerspellingObstacles", "What were the biggest obstacles you faced while trying to learn fingerspelling?"),
];
export const EXPERT_PRETASK_QUESTIONS_REQUIRED = EXPERT_PRETASK_QUESTIONS.map((q) => (q.type !== "heading" ? { ...q, required: true } : q));

/* The same questions, all required, for people Prolific sent (2026-10-18): the completion code comes only after the
 * last page, so it comes only once every answer is in. Karen's lab link keeps them optional. */
export const EXPERT_POST_QUESTIONS_REQUIRED = EXPERT_POST_QUESTIONS.map((q) =>
  q.type !== "heading" ? { ...q, required: true }
    : q.id === "intro" ? { ...q, label: "Your feedback", help: "Please answer each question. A sentence or two is enough; your answers will help us design the next version for people learning fingerspelling." }
    : q);

