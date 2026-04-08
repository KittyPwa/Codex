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
const lexiconSearchInput = document.querySelector("#lexicon-search");
const lexiconStatusFilter = document.querySelector("#lexicon-status-filter");
const lexiconRegisterFilter = document.querySelector("#lexicon-register-filter");
const lexiconCategoryFilter = document.querySelector("#lexicon-category-filter");
const lexiconTableBody = document.querySelector("#lexicon-table-body");
const lexiconPageSizeSelect = document.querySelector("#lexicon-page-size");
const lexiconPagePrevButton = document.querySelector("#lexicon-page-prev");
const lexiconPageNextButton = document.querySelector("#lexicon-page-next");
const lexiconPageInfo = document.querySelector("#lexicon-page-info");
const lexiconSortButtons = Array.from(document.querySelectorAll("[data-lexicon-sort]"));
const lexiconNewEntryButton = document.querySelector("#lexicon-new-entry");
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

const DEFAULT_LANGUAGE_RULES = {
  english: {
    fillers: ["the", "a", "an"],
    aliases: {
      bones: "keshoc",
      blood: "keshir",
      voice: "keshti",
      memories: "lietacht",
      stars: "tsen",
      moons: "tsin",
      suns: "tsar",
      bodies: "kesh",
      flesh: "kesh",
      minds: "vacht",
      souls: "vacht",
      spirits: "linvacht",
      guests: "nuhkesh",
      enemies: "cheechtkesh",
      strangers: "valkesh",
      children: "yeket",
      child: "yeket",
      land: "tsol",
      earth: "tsol",
      peace: "tsacht",
      ruin: "koa",
      "bring ruin": "tso'koa",
      our: "neali",
      yours: "tealeh",
      your: "teal",
      us: "neali",
      act: "ta",
      acts: "ta",
      move: "var",
      moves: "var",
      moving: "var",
      rise: "vark",
      rises: "vark",
      fall: "vorn",
      falls: "vorn",
      turn: "tor",
      turns: "tor",
      open: "chi",
      close: "chol",
      strike: "vek",
      strikes: "vek",
      wound: "vekmal",
      wounds: "vekmal",
      kill: "veklin",
      kills: "veklin",
      storm: "rekh",
      sandstorm: "secvar",
      light: "tsarhesh",
      leader: "rekmah",
      chief: "rekmahsi",
      fear: "nuhlcheecht",
      love: "nuhlloo",
      grief: "nuhlsec",
      hope: "nuhltar",
      intuition: "ruval",
      appeared: "lan",
      appears: "lan",
      appearing: "lan",
      vanished: "lin",
      vanishes: "lin",
      remembers: "rutacht",
      remembered: "rutacht",
      knows: "ru",
      seeing: "tcha",
      saw: "tcha",
      feels: "nuhl",
      heard: "kecht",
      hears: "kecht",
      slept: "soo",
      sleeps: "soo",
      sleeping: "soo",
      gave: "tsach",
      gives: "tsach",
      took: "tsich",
      takes: "tsich",
      made: "mel",
      makes: "mel",
      broke: "mal",
      breaks: "mal",
      became: "nocht",
      keeps: "tsocht",
      released: "tsecht",
      remains: "licht",
      begins: "socht",
      continues: "sacht",
      ends: "tchich"
    }
  },
  morphology: {
    productiveSuffixes: ["'s", "eh", "i", "ar", "en"],
    affixMeanings: {
      "'s": ["direction", "intent toward", "toward"],
      eh: ["possession", "belonging"],
      i: ["plural denominator", "plural"],
      ar: ["agent marker", "actor"],
      en: ["object marker"]
    },
    hiddenTranslationMarkers: ["ar", "en", "'s", "eh", "i"]
  },
  normalization: {
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
  },
  composition: {
    contextualRenderings: {
      "neal+i": ["we", "our", "our lives"],
      "teal+eh": ["your", "yours", "belonging to you"],
      "yeket+eh": ["your children"],
      "val+rel": ["do not harm", "no harm"],
      "tso+neal+i+tsacht": ["give us peace"]
    },
    lexicalCompounds: {
      "si+tacht": "before",
      "si+nacht": "after",
      "val+kecht": "silence",
      "nacht+nuh": "fate",
      "val+kei": "few",
      "kesh+'s+keh": "kin",
      "kesh+'s+keh+si": "tribe",
      "kesh+'s+keh+si+ar": "tribe + agent marker",
      "ru+val+nacht": "omen"
    },
    phraseRenderings: {
      "neal+i": "we",
      "teal+eh": "your",
      "kesh+'s+keh+si+ar": "our tribe",
      "mah+ar": "mother",
      "tah+ar": "father",
      "ru+val+nacht": "omen",
      "nacht+nuh": "fate",
      "val+kei": "few"
    },
    lexicalPriority: ["tso'koa", "yeket", "valkesh", "nuhkesh", "ruvalnacht", "raknacht", "valkecht", "kesh'skeh", "kesh'skehsi"],
    compoundEvaluation: {
      direction: "right_to_left",
      preferLexicalized: true,
      directionalBindingMarker: "'s",
      lexicalizedBeforeBinding: true,
      separateWordsRemainPhrases: true
    }
  },
  translation: {
    articleBlockers: ["before", "after", "always", "never", "once", "here", "there"],
    articleExceptions: ["sun", "moon", "day", "night", "wind", "sand", "sky"],
    bareWords: ["our", "your", "we", "mother", "father", "good", "ruin"],
    subjectRenderings: {
      "tribe + agent marker": "our tribe",
      we: "we"
    },
    nounArticles: {
      sun: "the",
      moon: "the",
      day: "the",
      night: "the",
      wind: "the",
      sand: "the",
      sky: "the",
      omen: "an",
      stranger: "a",
      guest: "a"
    },
    objectArticles: {
      journey: "the",
      path: "the",
      breath: "the"
    },
    narrativeRenderings: {
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
    },
    clauseTypes: {
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
    },
    poeticOverrides: {
      "tso'koa, tso'koa": "Bring ruin, bring ruin",
      "neali micht tealeh": "Our lives are yours",
      "neali micht teeleh": "Our lives are yours",
      "neali tso nach tealeh": "We give you our future",
      "neali tso nach teeleh": "We give you our future",
      "tealeh sesh vata kol": "Your winds blind all",
      "teeleh sesh vata kol": "Your winds blind all",
      "val rel kesheh": "Do not harm our flesh",
      "tso teal's tsol nali": "Bring to new lands",
      "koa's - rel's - tsecht's": "Ruin, harm, peace",
      "koa's - rel's - tsacht": "Ruin, harm, peace",
      "neali yeketeh": "We are your children",
      "tso neali tsacht": "Give us peace"
    }
  },
  phonology: {
    preferredClusters: ["ts", "ch", "tch", "cht"]
  }
};

let languageRulesConfig = cloneRulesObject(DEFAULT_LANGUAGE_RULES);
let ENGLISH_FILLERS = new Set(DEFAULT_LANGUAGE_RULES.english.fillers);
let ENGLISH_ALIASES = { ...DEFAULT_LANGUAGE_RULES.english.aliases };
let PRODUCTIVE_SUFFIXES = [...DEFAULT_LANGUAGE_RULES.morphology.productiveSuffixes];
let AFFIX_MEANINGS = cloneRulesObject(DEFAULT_LANGUAGE_RULES.morphology.affixMeanings);
let NORMALIZATION_MAP = { ...DEFAULT_LANGUAGE_RULES.normalization };
let CONTEXTUAL_RENDERINGS = cloneRulesObject(DEFAULT_LANGUAGE_RULES.composition.contextualRenderings);
let LEXICAL_COMPOUNDS = cloneRulesObject(DEFAULT_LANGUAGE_RULES.composition.lexicalCompounds);
let PHRASE_RENDERINGS = cloneRulesObject(DEFAULT_LANGUAGE_RULES.composition.phraseRenderings);
let LEXICAL_PRIORITY = new Set(DEFAULT_LANGUAGE_RULES.composition.lexicalPriority);
let HIDDEN_TRANSLATION_MARKERS = new Set(DEFAULT_LANGUAGE_RULES.morphology.hiddenTranslationMarkers);
let ARTICLE_BLOCKERS = new Set(DEFAULT_LANGUAGE_RULES.translation.articleBlockers);
let ARTICLE_EXCEPTIONS = new Set(DEFAULT_LANGUAGE_RULES.translation.articleExceptions);
let NARRATIVE_RENDERINGS = cloneRulesObject(DEFAULT_LANGUAGE_RULES.translation.narrativeRenderings);
let CLAUSE_TYPES = cloneRulesObject(DEFAULT_LANGUAGE_RULES.translation.clauseTypes);
let POETIC_OVERRIDES = new Map(Object.entries(DEFAULT_LANGUAGE_RULES.translation.poeticOverrides));

let activeLexicon = confirmedLexicon;
let lexiconByAncient = new Map();
let englishToAncient = new Map();
let activeSource = null;
let appReady = false;
let lexiconSortState = { field: "ancient", direction: "asc" };
let lexiconPaginationState = { page: 1, pageSize: 25 };
let selectedLexiconHeadword = null;
let rulesNotesMarkdown = "";
let rulesConfigSource = null;
let lexiconSourcePayload = { confirmed: [], inferred: [] };
let rulesEditorDirty = false;

function supportsFileEditing() {
  return window.location.protocol !== "file:";
}

function cloneRulesObject(value) {
  return JSON.parse(JSON.stringify(value));
}

function applyLanguageRulesConfig(config) {
  const merged = mergeRulesConfig(DEFAULT_LANGUAGE_RULES, config ?? {});
  languageRulesConfig = merged;

  ENGLISH_FILLERS = new Set(merged.english?.fillers ?? []);
  ENGLISH_ALIASES = { ...(merged.english?.aliases ?? {}) };
  PRODUCTIVE_SUFFIXES = [...(merged.morphology?.productiveSuffixes ?? [])];
  AFFIX_MEANINGS = cloneRulesObject(merged.morphology?.affixMeanings ?? {});
  NORMALIZATION_MAP = { ...(merged.normalization ?? {}) };
  CONTEXTUAL_RENDERINGS = cloneRulesObject(merged.composition?.contextualRenderings ?? {});
  LEXICAL_COMPOUNDS = cloneRulesObject(merged.composition?.lexicalCompounds ?? {});
  PHRASE_RENDERINGS = cloneRulesObject(merged.composition?.phraseRenderings ?? {});
  LEXICAL_PRIORITY = new Set(merged.composition?.lexicalPriority ?? []);
  HIDDEN_TRANSLATION_MARKERS = new Set(merged.morphology?.hiddenTranslationMarkers ?? []);
  ARTICLE_BLOCKERS = new Set(merged.translation?.articleBlockers ?? []);
  ARTICLE_EXCEPTIONS = new Set(merged.translation?.articleExceptions ?? []);
  NARRATIVE_RENDERINGS = cloneRulesObject(merged.translation?.narrativeRenderings ?? {});
  CLAUSE_TYPES = cloneRulesObject(merged.translation?.clauseTypes ?? {});
  POETIC_OVERRIDES = new Map(Object.entries(merged.translation?.poeticOverrides ?? {}));
}

function mergeRulesConfig(base, overrides) {
  if (Array.isArray(base)) {
    return Array.isArray(overrides) ? [...overrides] : [...base];
  }

  if (!base || typeof base !== "object") {
    return overrides === undefined ? base : overrides;
  }

  const merged = { ...base };
  if (!overrides || typeof overrides !== "object") {
    return cloneRulesObject(merged);
  }

  for (const [key, value] of Object.entries(overrides)) {
    if (Array.isArray(value)) {
      merged[key] = [...value];
      continue;
    }

    if (value && typeof value === "object") {
      merged[key] = mergeRulesConfig(base[key] ?? {}, value);
      continue;
    }

    merged[key] = value;
  }

  return cloneRulesObject(merged);
}
