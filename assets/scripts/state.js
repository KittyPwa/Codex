// State, DOM references, constants, and shared app state.

let confirmedLexicon = [];
let inferredLexicon = [];

const englishInput = document.querySelector("#english-input");
const ancientInput = document.querySelector("#ancient-input");
const fillEnglishButton = document.querySelector("#fill-english");
const fillAncientButton = document.querySelector("#fill-ancient");
const analysisList = document.querySelector("#analysis-list");
const glossSummary = document.querySelector("#gloss-summary");
const translatorNote = document.querySelector("#translator-note");
const includeInferredToggle = document.querySelector("#include-inferred");
const outputModeSelect = document.querySelector("#output-mode");
const lexiconStatus = document.querySelector("#lexicon-status");
const lexiconFileInput = document.querySelector("#lexicon-file");
const downloadLexiconMarkdownButton = document.querySelector("#download-lexicon-md");
const tabButtons = Array.from(document.querySelectorAll("[data-tab-target]"));
const tabPanels = Array.from(document.querySelectorAll(".tab-panel"));
const lexiconTableSummary = document.querySelector("#lexicon-table-summary");
const lexiconSearchInput = document.querySelector("#lexicon-search");
const lexiconStatusFilter = document.querySelector("#lexicon-status-filter");
const lexiconRegisterFilter = document.querySelector("#lexicon-register-filter");
const lexiconCategoryFilter = document.querySelector("#lexicon-category-filter");
const lexiconTableBody = document.querySelector("#lexicon-table-body");
const lexiconSortButtons = Array.from(document.querySelectorAll("[data-lexicon-sort]"));
const lexiconNewEntryButton = document.querySelector("#lexicon-new-entry");
const lexiconEditorStatus = document.querySelector("#lexicon-editor-status");
const lexiconGraphModal = document.querySelector("#lexicon-graph-modal");
const lexiconGraphBackdrop = document.querySelector("#lexicon-graph-backdrop");
const lexiconGraphCloseButton = document.querySelector("#lexicon-graph-close");
const lexiconGraphSummary = document.querySelector("#lexicon-graph-summary");
const lexiconGraphRoot = document.querySelector("#lexicon-graph-root");
const lexiconEntryModal = document.querySelector("#lexicon-entry-modal");
const lexiconEntryBackdrop = document.querySelector("#lexicon-entry-backdrop");
const lexiconEntryForm = document.querySelector("#lexicon-entry-form");
const lexiconEntryDeleteButton = document.querySelector("#lexicon-entry-delete");
const lexiconEntryCancelButton = document.querySelector("#lexicon-entry-cancel");
const lexiconEntryStatus = document.querySelector("#lexicon-entry-status");
const lexiconEntryOriginalInput = document.querySelector("#lexicon-entry-original");
const lexiconEntryOriginalGroupInput = document.querySelector("#lexicon-entry-original-group");
const entryAncientInput = document.querySelector("#entry-ancient");
const entryGroupInput = document.querySelector("#entry-group");
const entryStatusInput = document.querySelector("#entry-status");
const entryRegisterInput = document.querySelector("#entry-register");
const entryMeaningsInput = document.querySelector("#entry-meanings");
const entryPartOfSpeechInput = document.querySelector("#entry-part-of-speech");
const entryComponentsInput = document.querySelector("#entry-components");
const entryEtymologyInput = document.querySelector("#entry-etymology");
const entryNotesInput = document.querySelector("#entry-notes");
const entryPronunciationInput = document.querySelector("#entry-pronunciation");
const entryLexicalizedInput = document.querySelector("#entry-lexicalized");
const entryCanDecomposeInput = document.querySelector("#entry-can-decompose");
const entryAllowNominalReadingInput = document.querySelector("#entry-allow-nominal-reading");
const entryOptionalInput = document.querySelector("#entry-optional");
const rulesSummary = document.querySelector("#rules-summary");
const rulesContent = document.querySelector("#rules-content");
const rulesEditButton = document.querySelector("#rules-edit-button");
const rulesSaveButton = document.querySelector("#rules-save-button");
const rulesCancelButton = document.querySelector("#rules-cancel-button");
const rulesEditorStatus = document.querySelector("#rules-editor-status");
const rulesEditor = document.querySelector("#rules-editor");
const morphemeOutput = document.querySelector("#morpheme-output");
const literalOutput = document.querySelector("#literal-output");
const idiomaticOutput = document.querySelector("#idiomatic-output");

const MARKDOWN_SECTION_ORDER = [
  "Grammar Markers",
  "Core Verbs",
  "Perception, Relation, and Core Concepts",
  "Motion and Force",
  "Conflict and Survival",
  "Direction and Space",
  "Number and Quantity",
  "Time",
  "Celestial and Natural Elements",
  "Body and Being",
  "Mind, Knowledge, and Spirit",
  "Emotion",
  "People and Social Structure",
  "Change, Learning, and Relation",
  "Qualities and Abstract Oppositions",
  "Ritual and Liturgical Forms",
  "Inferred / Etymological Roots",
  "Additional Entries"
];

const MARKDOWN_SECTION_SETS = {
  "Grammar Markers": new Set(["ar", "en", "'s", "eh", "i"]),
  "Core Verbs": new Set(["sul", "sal", "tsich", "tsach", "mel", "mal", "nocht", "tsocht", "tsecht", "la", "licht", "lin", "lan", "socht", "sacht", "tchich", "ta"]),
  "Perception, Relation, and Core Concepts": new Set(["tcha", "kecht", "nuhl", "ru", "soo", "teal", "neal", "val", "rel", "kol", "nal", "koa", "tso", "tsacht", "tsol"]),
  "Motion and Force": new Set(["tik", "ri", "ren", "reh", "rez", "ro", "rok", "rocht", "tal", "tocht"]),
  "Conflict and Survival": new Set(["vik", "vicht", "valtsoum", "sult", "zicht", "xok", "zir", "zik"]),
  "Direction and Space": new Set(["ji", "jo", "ja", "ja's", "rek", "rak", "raknacht", "to", "sulneh", "neh", "jija", "jino", "ouk", "oun", "xi"]),
  "Number and Quantity": new Set(["ni", "no", "kei", "valkei"]),
  "Time": new Set(["tacht", "nacht", "tem", "sitacht", "sinacht", "let", "lak", "locht"]),
  "Celestial and Natural Elements": new Set(["tsar", "tsin", "tsen", "ko", "ka", "hesh", "hwir", "hoc", "sec", "sesh", "tsal", "sachthoc", "tsecht lietacht", "heshtsali", "hocsesh", "rekwir", "zok"]),
  "Body and Being": new Set(["kesh", "keshir", "keshoc", "kesheh", "keshti", "ti", "heshtsoum", "naltsoum", "reksacht", "rektchich"]),
  "Mind, Knowledge, and Spirit": new Set(["vacht", "nila", "valka", "soolie", "titsoum", "lietacht", "ruval", "rutacht", "linru", "linvacht", "ruvalnacht", "nachtnuh", "nuh", "nu", "soh", "sicht", "valkecht", "nachtvacht", "heshvacht"]),
  "Emotion": new Set(["nuhzik", "nuhtsecht", "tihesh", "nutsoum", "valtsecht", "sizir", "nuhzir", "sizik", "tar", "rektsecht"]),
  "People and Social Structure": new Set(["mah", "tah", "kesh'skeh", "kesh'skehsi", "sikeshi", "valkesh", "cheechtkesh", "nuhkesh", "chi", "sachtchi", "ta'sikeshi", "sachtsoum", "sitsoum", "yeket"]),
  "Change, Learning, and Relation": new Set(["tasacht", "tasi", "tavalge", "nochtno", "nochtni", "nochtsi", "tsi", "tichtsi", "tichti", "tasachtsoum", "zecht", "zoh", "go", "ge"]),
  "Qualities and Abstract Oppositions": new Set(["cheecht", "loo", "si", "sacht", "acht", "ocht", "ohm", "uhm", "ocho"]),
  "Ritual and Liturgical Forms": new Set(["tso'koa"]),
  "Inferred / Etymological Roots": new Set(["yecht"])
};

const ENGLISH_FILLERS = new Set(["the", "a", "an"]);
const PRODUCTIVE_SUFFIXES = ["'s", "eh", "i", "ar", "en"];
const AFFIX_MEANINGS = {
  "'s": ["direction", "intent toward", "toward"],
  eh: ["possession", "belonging"],
  i: ["plural denominator", "plural"],
  ar: ["agent marker", "actor"],
  en: ["object marker"]
};
const NORMALIZATION_MAP = {
  nach: "nacht",
  teeleh: "tealeh",
  neali: "neal+i",
  tealeh: "teal+eh",
  yeketeh: "yeket+eh",
  "koa's": "koa+'s",
  "rel's": "rel+'s",
  "tsecht's": "tsecht+'s",
  "kesh'skehsiar": "kesh'skehsi+ar",
  "mah-ar": "mah+ar",
  "tah-ar": "tah+ar",
  "tso'koa": "tso'koa",
  "tsoâ€™koa": "tso'koa",
  tsokoa: "tso'koa",
  nali: "nal+i"
};
const CONTEXTUAL_RENDERINGS = {
  "neal+i": ["we", "our", "our lives"],
  "teal+eh": ["your", "yours", "belonging to you"],
  "yeket+eh": ["your children"],
  "val+rel": ["do not harm", "no harm"],
  "tso+neal+i+tsacht": ["give us peace"]
};
const LEXICAL_COMPOUNDS = {
  "si+tacht": "before",
  "si+nacht": "after",
  "val+kecht": "silence",
  "nacht+nuh": "fate",
  "val+kei": "few",
  "kesh+'s+keh": "kin",
  "kesh+'s+keh+si": "tribe",
  "kesh+'s+keh+si+ar": "tribe + agent marker",
  "ru+val+nacht": "omen"
};
const PHRASE_RENDERINGS = {
  "neal+i": "we",
  "teal+eh": "your",
  "kesh+'s+keh+si+ar": "our tribe",
  "mah+ar": "mother",
  "tah+ar": "father",
  "ru+val+nacht": "omen",
  "nacht+nuh": "fate",
  "val+kei": "few"
};
const LEXICAL_PRIORITY = new Set([
  "tso'koa",
  "yeket",
  "valkesh",
  "nuhkesh",
  "ruvalnacht",
  "raknacht",
  "valkecht",
  "kesh'skeh",
  "kesh'skehsi"
]);
const HIDDEN_TRANSLATION_MARKERS = new Set(["ar", "en", "'s", "eh", "i"]);
const ARTICLE_BLOCKERS = new Set([
  "before",
  "after",
  "always",
  "never",
  "once",
  "here",
  "there"
]);
const ARTICLE_EXCEPTIONS = new Set([
  "sun",
  "moon",
  "day",
  "night",
  "wind",
  "sand",
  "sky"
]);
const NARRATIVE_RENDERINGS = {
  licht: { narrative: "remained", literal: "remain" },
  lan: { narrative: "appeared", literal: "appear" },
  lin: { narrative: "vanished", literal: "vanish" },
  sal: { narrative: "came", literal: "come" },
  socht: { narrative: "began", literal: "begin" },
  sacht: { narrative: "continued", literal: "continue" },
  ru: { narrative: "knew", literal: "know" },
  rutacht: { narrative: "remembered", literal: "remember" },
  tsach: { narrative: "gave", literal: "give" },
  tsocht: { narrative: "kept", literal: "keep" },
  kecht: { narrative: "heard", literal: "hear" },
  la: { narrative: "was", literal: "be" }
};

const CLAUSE_TYPES = {
  lan: "appearance",
  licht: "state",
  lin: "state",
  la: "state",
  sal: "motion",
  sul: "motion",
  sacht: "motion",
  ru: "knowledge",
  rutacht: "knowledge",
  kecht: "perception",
  tsach: "action",
  tsocht: "action"
};

const POETIC_OVERRIDES = new Map([
  ["tso'koa, tso'koa", "Bring ruin, bring ruin"],
  ["neali micht tealeh", "Our lives are yours"],
  ["neali micht teeleh", "Our lives are yours"],
  ["neali tso nach tealeh", "We give you our future"],
  ["neali tso nach teeleh", "We give you our future"],
  ["tealeh sesh vata kol", "Your winds blind all"],
  ["teeleh sesh vata kol", "Your winds blind all"],
  ["val rel kesheh", "Do not harm our flesh"],
  ["tso teal's tsol nali", "Bring to new lands"],
  ["koa's - rel's - tsecht's", "Ruin, harm, peace"],
  ["koa's - rel's - tsacht", "Ruin, harm, peace"],
  ["neali yeketeh", "We are your children"],
  ["tso neali tsacht", "Give us peace"]
]);

let activeLexicon = confirmedLexicon;
let lexiconByAncient = new Map();
let englishToAncient = new Map();
let activeSource = null;
let appReady = false;
let lexiconSortState = { field: "ancient", direction: "asc" };
let selectedLexiconHeadword = null;
let rulesNotesMarkdown = "";
let lexiconSourcePayload = { confirmed: [], inferred: [] };
let rulesEditorDirty = false;

function supportsFileEditing() {
  return window.location.protocol !== "file:";
}
