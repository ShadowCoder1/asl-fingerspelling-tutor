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

  { id: "age",
    label: "Age",
    type: "number",
    required: true,
    placeholder: "e.g. 42",
    min: 18,
    max: 120 },

  { id: "sexAtBirth",
    label: "Sex assigned at birth",
    type: "select",
    required: true,
    options: ["Female", "Male", "Intersex", "Prefer not to say"] },

  { id: "dominantHand",
    label: "Dominant hand",
    type: "select",
    required: true,
    options: ["Right", "Left", "Ambidextrous", "Prefer not to say"] },

  { id: "device",
    label: "What device are you using?",
    type: "select",
    required: true,
    options: ["Laptop", "Desktop computer", "Tablet", "Phone"] },

  { id: "education",
    label: "Highest education completed",
    type: "select",
    options: ["Less than high school",
              "High school or equivalent",
              "Some college",
              "Bachelor's degree",
              "Master's degree",
              "Doctoral or professional degree",
              "Prefer not to say"] },

  { id: "visionCorrection",
    label: "Vision correction worn now",
    type: "select",
    options: ["None", "Glasses", "Contact lenses", "Prefer not to say"] },

  { id: "exercisePerWeek",
    label: "Physical exercise per week",
    type: "select",
    options: ["None",
              "Less than 1 hour",
              "1 to 3 hours",
              "3 to 5 hours",
              "More than 5 hours",
              "Prefer not to say"] },

  { id: "smokingStatus",
    label: "Smoking status",
    type: "select",
    options: ["Never smoked", "Former smoker", "Current smoker", "Prefer not to say"] },

  { id: "ethnicity",
    label: "Ethnicity",
    type: "select",
    options: ["Hispanic or Latino", "Not Hispanic or Latino", "Prefer not to say"] },

  { id: "race",
    label: "Race",
    type: "select",
    options: ["American Indian or Alaska Native",
              "Asian",
              "Black or African American",
              "Native Hawaiian or Other Pacific Islander",
              "White",
              "More than one race",
              "Prefer not to say"] },

  { id: "participantId",
    label: "Name or Prolific ID",
    type: "text",
    help: "Used only to link your responses. Leave blank for an anonymous ID.",
    placeholder: "e.g. 5f3c..." },

];
