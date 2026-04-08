// Translator shared helpers and lookup utilities.

function normalizeEnglishKey(text) {
  return text.toLowerCase().trim().replace(/\s+/g, " ");
}

function normalizeAncientKey(text) {
  return text
    .toLowerCase()
    .trim()
    .replace(/[â€™`]/g, "'")
    .replace(/[â€“â€”]/g, "-");
}

function normalizeOverrideKey(text) {
  return normalizeAncientKey(text).replace(/\s+/g, " ");
}

function lookupEntry(key) {
  return lexiconByAncient.get(normalizeAncientKey(key)) ?? null;
}

function inferPronunciation(term) {
  return term.includes("cht")
    ? "Contains 'cht', pronounced with a guttural fricative like German 'Bach' or 'Nacht'."
    : "";
}

function lookupContextualRendering(parts) {
  const key = Array.isArray(parts) ? parts.join("+") : parts;
  return CONTEXTUAL_RENDERINGS[key]?.[0] ?? null;
}

function collapseLexicalCompound(parts) {
  const key = Array.isArray(parts) ? parts.join("+") : parts;
  return LEXICAL_COMPOUNDS[key] ?? null;
}

function lookupPhraseRendering(parts) {
  const key = Array.isArray(parts) ? parts.join("+") : parts;
  return PHRASE_RENDERINGS[key] ?? null;
}

