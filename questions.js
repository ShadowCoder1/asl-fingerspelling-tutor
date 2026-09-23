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

  { id: "signLanguageYears",
    label: "How many years have you used any sign language?",
    help: "Count classes, apps and everyday use. If you have never signed, choose None.",
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

  { id: "comments",
    label: "Anything else? Problems with the camera, things that were unclear. (optional)",
    type: "textarea" },

];
