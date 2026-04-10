// State, DOM references, constants, and shared app state.

let confirmedLexicon = [];
let inferredLexicon = [];
let translationApiHealth = null;

const englishInput = document.querySelector("#english-input");
const ancientInput = document.querySelector("#ancient-input");
const loadedLanguageTitle = document.querySelector("#loaded-language-title");
const loadedLanguageInputLabel = document.querySelector("#loaded-language-input-label");
const fillEnglishButton = document.querySelector("#fill-english");
const fillAncientButton = document.querySelector("#fill-ancient");
const analysisList = document.querySelector("#analysis-list");
const glossSummary = document.querySelector("#gloss-summary");
const translatorNote = document.querySelector("#translator-note");
const includeInferredToggle = document.querySelector("#include-inferred");
const outputModeSelect = document.querySelector("#output-mode");
const lexiconStatus = document.querySelector("#lexicon-status");
const lexiconFileInput = document.querySelector("#lexicon-file");
const languagePackSelect = document.querySelector("#language-pack-select");
const languagePackNewButton = document.querySelector("#language-pack-new");
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
const languagePackModal = document.querySelector("#language-pack-modal");
const languagePackBackdrop = document.querySelector("#language-pack-backdrop");
const languagePackForm = document.querySelector("#language-pack-form");
const languagePackCancelButton = document.querySelector("#language-pack-cancel");
const languagePackStatus = document.querySelector("#language-pack-status");
const languagePackNameInput = document.querySelector("#language-pack-name");
const languagePackIdInput = document.querySelector("#language-pack-id");
const languagePackVersionInput = document.querySelector("#language-pack-version");
const languagePackDescriptionInput = document.querySelector("#language-pack-description");
const languagePackActivateInput = document.querySelector("#language-pack-activate");
const rulesSummary = document.querySelector("#rules-summary");
const rulesContent = document.querySelector("#rules-content");
const rulesEditButton = document.querySelector("#rules-edit-button");
const rulesSaveButton = document.querySelector("#rules-save-button");
const rulesCancelButton = document.querySelector("#rules-cancel-button");
const rulesEditorStatus = document.querySelector("#rules-editor-status");
const rulesEditor = document.querySelector("#rules-editor");
const rulesConfigSummary = document.querySelector("#rules-config-summary");
const rulesConfigContent = document.querySelector("#rules-config-content");
const rulesConfigEditButton = document.querySelector("#rules-config-edit-button");
const rulesConfigSaveButton = document.querySelector("#rules-config-save-button");
const rulesConfigCancelButton = document.querySelector("#rules-config-cancel-button");
const rulesConfigEditorStatus = document.querySelector("#rules-config-editor-status");
const rulesConfigEditor = document.querySelector("#rules-config-editor");
const rulesConfigApplyGuidedButton = document.querySelector("#rules-config-apply-guided");
const rulesConfigFormatButton = document.querySelector("#rules-config-format-button");
const rulesConfigLanguageNameInput = document.querySelector("#rules-config-language-name");
const rulesConfigLanguageVersionInput = document.querySelector("#rules-config-language-version");
const rulesConfigLanguageDescriptionInput = document.querySelector("#rules-config-language-description");
const rulesConfigEnglishFillersBuilder = document.querySelector("#rules-config-english-fillers-builder");
const rulesConfigEnglishFillersAddButton = document.querySelector("#rules-config-english-fillers-add");
const rulesConfigEnglishAliasesBuilder = document.querySelector("#rules-config-english-aliases-builder");
const rulesConfigEnglishAliasesAddButton = document.querySelector("#rules-config-english-aliases-add");
const rulesConfigTokenPatternInput = document.querySelector("#rules-config-token-pattern");
const rulesConfigTokenSampleInput = document.querySelector("#rules-config-token-sample");
const rulesConfigTokenPresetSimpleButton = document.querySelector("#rules-config-token-preset-simple");
const rulesConfigTokenPresetApostropheButton = document.querySelector("#rules-config-token-preset-apostrophe");
const rulesConfigTokenPresetMultilineButton = document.querySelector("#rules-config-token-preset-multiline");
const rulesConfigTokenPresetSaveCustomButton = document.querySelector("#rules-config-token-preset-save-custom");
const rulesConfigTokenPresetLoadCustomButton = document.querySelector("#rules-config-token-preset-load-custom");
const rulesConfigTokenPreview = document.querySelector("#rules-config-token-preview");
const rulesConfigTokenPreviewStatus = document.querySelector("#rules-config-token-preview-status");
const rulesConfigTokenMatchList = document.querySelector("#rules-config-token-match-list");
const rulesConfigFallbackTemplateInput = document.querySelector("#rules-config-fallback-template");
const rulesConfigFieldHeadwordInput = document.querySelector("#rules-config-field-headword");
const rulesConfigFieldMeaningsInput = document.querySelector("#rules-config-field-meanings");
const rulesConfigGlossPrimaryInput = document.querySelector("#rules-config-gloss-primary");
const schemaSummary = document.querySelector("#schema-summary");
const schemaContent = document.querySelector("#schema-content");
const schemaEditButton = document.querySelector("#schema-edit-button");
const schemaSaveButton = document.querySelector("#schema-save-button");
const schemaCancelButton = document.querySelector("#schema-cancel-button");
const schemaEditorStatus = document.querySelector("#schema-editor-status");
const schemaEditor = document.querySelector("#schema-editor");
const schemaApplyGuidedButton = document.querySelector("#schema-apply-guided");
const schemaFormatButton = document.querySelector("#schema-format-button");
const schemaVersionInput = document.querySelector("#schema-version-input");
const schemaKindInput = document.querySelector("#schema-kind-input");
const schemaDescriptionInput = document.querySelector("#schema-description-input");
const schemaRequiredPathsBuilder = document.querySelector("#schema-required-paths-builder");
const schemaRequiredPathsAddButton = document.querySelector("#schema-required-paths-add");
const schemaRecommendedPathsBuilder = document.querySelector("#schema-recommended-paths-builder");
const schemaRecommendedPathsAddButton = document.querySelector("#schema-recommended-paths-add");
const schemaResolverNamesBuilder = document.querySelector("#schema-resolver-names-builder");
const schemaResolverNamesAddButton = document.querySelector("#schema-resolver-names-add");
const schemaResolverTypesBuilder = document.querySelector("#schema-resolver-types-builder");
const schemaResolverTypesAddButton = document.querySelector("#schema-resolver-types-add");
const schemaSegmenterTypesBuilder = document.querySelector("#schema-segmenter-types-builder");
const schemaSegmenterTypesAddButton = document.querySelector("#schema-segmenter-types-add");
const morphemeOutput = document.querySelector("#morpheme-output");
const literalOutput = document.querySelector("#literal-output");
const idiomaticOutput = document.querySelector("#idiomatic-output");

const GENERIC_LANGUAGE_RULES = {
  language: {
    name: "Loaded language",
    version: "0.0.0",
    description: ""
  },
  workspace: {
    markdown: {
      title: "Loaded language",
      overview: "This lexicon document was generated directly from the active loaded vocabulary.",
      sectionOrder: ["Additional Entries"],
      sections: {},
      inferredSection: "Inferred Entries",
      compoundSection: "Compounds",
      additionalSection: "Additional Entries"
    }
  },
  english: { fillers: [], aliases: {} },
  morphology: { productiveSuffixes: [], affixMeanings: {}, hiddenTranslationMarkers: [] },
  normalization: {},
  composition: { contextualRenderings: {}, lexicalCompounds: {}, phraseRenderings: {}, lexicalPriority: [], compoundEvaluation: {} },
  translation: {
    articleBlockers: [],
    articleExceptions: [],
    bareWords: [],
    subjectRenderings: {},
    nounArticles: {},
    objectArticles: {},
    narrativeRenderings: {},
    clauseTypes: {},
    poeticOverrides: {},
    englishToAncientOverrides: {},
    syntaxPatterns: [],
    headSequenceOverrides: [],
    componentSequenceOverrides: [],
    tailRenderings: [],
    continuationRenderings: [],
    locationReorderings: []
  },
  phonology: { preferredClusters: [] }
};

let languageRulesConfig = cloneRulesObject(GENERIC_LANGUAGE_RULES);
let ENGLISH_FILLERS = new Set(GENERIC_LANGUAGE_RULES.english.fillers);
let ENGLISH_ALIASES = { ...GENERIC_LANGUAGE_RULES.english.aliases };
let PRODUCTIVE_SUFFIXES = [...GENERIC_LANGUAGE_RULES.morphology.productiveSuffixes];
let AFFIX_MEANINGS = cloneRulesObject(GENERIC_LANGUAGE_RULES.morphology.affixMeanings);
let NORMALIZATION_MAP = { ...GENERIC_LANGUAGE_RULES.normalization };
let CONTEXTUAL_RENDERINGS = cloneRulesObject(GENERIC_LANGUAGE_RULES.composition.contextualRenderings);
let LEXICAL_COMPOUNDS = cloneRulesObject(GENERIC_LANGUAGE_RULES.composition.lexicalCompounds);
let PHRASE_RENDERINGS = cloneRulesObject(GENERIC_LANGUAGE_RULES.composition.phraseRenderings);
let LEXICAL_PRIORITY = new Set(GENERIC_LANGUAGE_RULES.composition.lexicalPriority);
let HIDDEN_TRANSLATION_MARKERS = new Set(GENERIC_LANGUAGE_RULES.morphology.hiddenTranslationMarkers);
let ARTICLE_BLOCKERS = new Set(GENERIC_LANGUAGE_RULES.translation.articleBlockers);
let ARTICLE_EXCEPTIONS = new Set(GENERIC_LANGUAGE_RULES.translation.articleExceptions);
let NARRATIVE_RENDERINGS = cloneRulesObject(GENERIC_LANGUAGE_RULES.translation.narrativeRenderings);
let CLAUSE_TYPES = cloneRulesObject(GENERIC_LANGUAGE_RULES.translation.clauseTypes);
let POETIC_OVERRIDES = new Map(Object.entries(GENERIC_LANGUAGE_RULES.translation.poeticOverrides));

let activeLexicon = confirmedLexicon;
let lexiconByAncient = new Map();
let activeSource = null;
let appReady = false;
let lexiconSortState = { field: "ancient", direction: "asc" };
let lexiconPaginationState = { page: 1, pageSize: 25 };
let selectedLexiconHeadword = null;
let rulesNotesMarkdown = "";
let rulesConfigDocument = {};
let rulesConfigPath = "data/rules.json";
let languagePackSchemaDocument = {};
let languagePackSchemaDocumentPath = "data/language-pack.schema.json";
let rulesConfigSource = null;
let lexiconSourcePayload = { confirmed: [], inferred: [] };
let rulesEditorDirty = false;
let rulesConfigEditorDirty = false;
let schemaEditorDirty = false;
let serverTranslationApiAvailable = false;
let translationRequestSequence = 0;
let availableLanguagePacks = [];
let activeLanguagePackId = "default";
let activeLanguagePackStatus = null;

function supportsFileEditing() {
  return window.location.protocol !== "file:";
}

function cloneRulesObject(value) {
  return JSON.parse(JSON.stringify(value));
}

function getActiveLanguageName() {
  return languageRulesConfig?.language?.name || translationApiHealth?.language?.name || "Loaded language";
}

function getDefaultEnglishSample() {
  if (activeLanguagePackId === "default") {
    return "bring ruin, bring ruin\nour lives are yours";
  }

  return "";
}

function getDefaultLoadedLanguageSample() {
  if (activeLanguagePackId === "default") {
    return "Tso'koa, Tso'koa\nNeali micht tealeh\nVal rel kesheh";
  }

  return "";
}

function getActiveLexiconPath() {
  return activeLanguagePackStatus?.activePaths?.lexicon || translationApiHealth?.activePaths?.lexicon || "data/lexicon.json";
}

function getActiveRulesNotesPath() {
  return activeLanguagePackStatus?.activePaths?.rulesNotes || translationApiHealth?.activePaths?.rulesNotes || "data/rules-notes.md";
}

function getActiveRulesConfigPath() {
  return activeLanguagePackStatus?.activePaths?.rulesConfig || translationApiHealth?.activePaths?.rulesConfig || rulesConfigPath || "data/rules.json";
}

function getActiveSchemaPath() {
  return activeLanguagePackStatus?.activePaths?.schema || translationApiHealth?.activePaths?.schema || languagePackSchemaDocumentPath || "data/language-pack.schema.json";
}

function applyLanguageRulesConfig(config) {
  const merged = mergeRulesConfig(GENERIC_LANGUAGE_RULES, config ?? {});
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
