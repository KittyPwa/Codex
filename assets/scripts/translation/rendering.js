// Translator rendering and narrative output helpers.

function buildLiteralLine(analyses) {
  const components = analyses.flatMap((entry) => entry.components.length ? entry.components : [normalizeAncientKey(entry.headword)]);
  const phraseRendering = lookupPhraseRendering(components);
  if (phraseRendering) {
    return phraseRendering;
  }
  const lexicalCollapse = collapseLexicalCompound(components);
  if (lexicalCollapse) {
    return lexicalCollapse;
  }

  return analyses
    .map((entry) => entry.resolvedGloss ?? entry.literalGloss ?? entry.primaryGloss)
    .filter((word) => !HIDDEN_TRANSLATION_MARKERS.has(normalizeAncientKey(word)))
    .join(" ");
}

function findHeadSequenceOverride(heads) {
  const patterns = languageRulesConfig.translation?.headSequenceOverrides ?? [];
  const key = heads.join("|");
  for (const pattern of patterns) {
    if ((pattern.heads ?? []).join("|") === key) {
      return pattern.output ?? null;
    }
  }
  return null;
}

function findComponentSequenceOverride(components) {
  const patterns = languageRulesConfig.translation?.componentSequenceOverrides ?? [];
  const key = components.join("|");
  for (const pattern of patterns) {
    if ((pattern.components ?? []).join("|") === key) {
      return pattern.output ?? null;
    }
  }
  return null;
}

function findIncludePatternOutput(patterns, values) {
  for (const pattern of patterns) {
    const includes = pattern.includes ?? [];
    if (includes.length && includes.every((value) => values.includes(value))) {
      return pattern.output ?? null;
    }
  }
  return null;
}

function smoothClause(analyses) {
  const words = analyses.map((entry) => entry.narrativeGloss ?? entry.literalGloss ?? entry.primaryGloss);
  const heads = analyses.map((entry) => normalizeAncientKey(entry.headword));
  const components = analyses.flatMap((entry) => entry.components.length ? entry.components : [normalizeAncientKey(entry.headword)]);
  const lexicalCollapse = collapseLexicalCompound(components);

  const headOverride = findHeadSequenceOverride(heads);
  if (headOverride) {
    return headOverride;
  }

  const componentOverride = findComponentSequenceOverride(components);
  if (componentOverride) {
    return componentOverride;
  }

  if (heads[0] === "lan" && heads[1] && heads[2] === "ouk" && heads[3] === "tsal") {
    return `${capitalize(withArticle(words[1]))} appeared above the sky.`;
  }

  if (heads.length >= 4 && heads[1] === "lan" && heads[2] === "jino" && heads[3] === "tsal") {
    return `${capitalize(withArticle(words[0]))} ${words[1]} between the skies.`;
  }

  if (heads[0] === "mah" && heads[1] === "tsach") {
    return `Mother ${words[1]} ${words.slice(2).join(" ")}`.trim() + ".";
  }

  if (heads[0] === "tah" && heads[1] === "tsocht") {
    return `Father ${words[1]} ${withArticle(words[2] ?? "")}`.trim() + ".";
  }

  if (lexicalCollapse && analyses.length === 1) {
    return `${capitalize(lexicalCollapse)}.`;
  }

  const reordered = reorderLocationPhrase(analyses, words);
  const sentence = reordered.join(" ").replace(/\s+([,.;:!?])/g, "$1").trim();
  if (!sentence) {
    return "";
  }

  return sentence.charAt(0).toUpperCase() + sentence.slice(1) + (/[.!?]$/.test(sentence) ? "" : ".");
}

function renderNarrativeClause(analyses) {
  const heads = analyses.map((entry) => normalizeAncientKey(entry.headword));
  const words = analyses.map((entry) => entry.resolvedGloss ?? entry.narrativeGloss ?? entry.literalGloss ?? entry.primaryGloss);
  const renderedWords = words.filter((word) => !HIDDEN_TRANSLATION_MARKERS.has(normalizeAncientKey(word)));

  if (heads[0] === "sitacht" && heads[1] === "valkecht" && heads[2] === "licht") {
    return "Before, silence remained.";
  }

  if (heads.length === 2 && heads[1] === "licht") {
    return `${capitalize(resolveSubject(words[0], "translation"))} remained.`;
  }

  if (heads.length === 2 && heads[1] === "lin") {
    return `${capitalize(resolveSubject(words[0], "translation"))} vanished.`;
  }

  if (heads[0] === "lan" && heads[1]) {
    return `${capitalize(resolveSubject(words[1], "translation"))} appeared${words.length > 2 ? ` ${reorderNarrativeTail(analyses, words.slice(2))}` : ""}.`;
  }

  if (heads[1] === "lan" && heads[0]) {
    return `${capitalize(resolveSubject(words[0], "translation"))} appeared${words.length > 2 ? ` ${reorderNarrativeTail(analyses, words.slice(2))}` : ""}.`;
  }

  if (heads.length >= 2 && heads[1] === "sal") {
    return `${capitalize(resolveSubject(words[0], "translation"))} came${words.length > 2 ? ` ${reorderNarrativeTail(analyses, words.slice(2))}` : ""}.`;
  }

  if (heads.length >= 3 && heads[1] === "ru") {
    return `${capitalize(resolveSubject(words[0], "translation"))} knew ${resolveObject(words.slice(2))}.`;
  }

  if (heads.length >= 3 && heads[1] === "rutacht") {
    return `${capitalize(resolveSubject(words[0], "translation"))} remembered ${resolveObject(words.slice(2))}.`;
  }

  if (heads.length >= 3 && heads[1] === "sacht") {
    return `${capitalize(resolveSubject(words[0], "translation"))} continued ${reorderContinuationObject(analyses, words.slice(2))}.`;
  }

  if (heads.length >= 3 && heads[1] === "tsach") {
    return `${capitalize(resolveSubject(words[0], "translation"))} gave ${resolveObject(words.slice(2))}.`;
  }

  if (heads.length >= 3 && heads[1] === "tsocht") {
    return `${capitalize(resolveSubject(words[0], "translation"))} kept ${resolveObject(words.slice(2))}.`;
  }

  if (heads.length >= 4 && heads[1] === "kecht" && heads[3] === "rutacht") {
    const subject = capitalize(resolveSubject(words[0], "translation"));
    const heardObject = resolveObject([words[2]]);
    const rememberedObject = resolveObject(words.slice(4));
    return `${subject} heard ${heardObject} and remembered ${rememberedObject}.`;
  }

  if (heads.length >= 4 && heads[1] === "ru" && heads[3] === "rutacht") {
    const subject = capitalize(resolveSubject(words[0], "translation"));
    const knewObject = resolveObject([words[2]]);
    const rememberedObject = resolveObject(words.slice(4));
    return `${subject} knew ${knewObject} and remembered ${rememberedObject}.`;
  }

  if (heads.length >= 4 && heads[1] === "tsach" && heads[3] === "tsocht") {
    const subject = capitalize(resolveSubject(words[0], "translation"));
    const gaveObject = resolveObject([words[2]]);
    const keptObject = resolveObject(words.slice(4));
    return `${subject} gave ${gaveObject} and kept ${keptObject}.`;
  }

  if (renderedWords.length >= 4) {
    const predicatePositions = [];
    for (let index = 0; index < heads.length; index += 1) {
      if (NARRATIVE_RENDERINGS[heads[index]]) {
        predicatePositions.push(index);
      }
    }

    if (predicatePositions.length >= 2 && predicatePositions[0] + 2 === predicatePositions[1]) {
      const subject = capitalize(resolveSubject(words[0], "translation"));
      const firstVerb = renderedWords[1];
      const firstObject = resolveObject([renderedWords[2]]);
      const secondVerb = renderedWords[3];
      const secondObject = resolveObject(renderedWords.slice(4));
      if (firstObject && secondObject) {
        return `${subject} ${firstVerb} ${firstObject} and ${secondVerb} ${secondObject}.`;
      }
    }
  }

  return null;
}

function reorderNarrativeTail(analyses, tailWords) {
  const tailHeads = analyses.slice(2).map((entry) => normalizeAncientKey(entry.headword));
  const patternOutput = findIncludePatternOutput(languageRulesConfig.translation?.tailRenderings ?? [], tailHeads);
  if (patternOutput) {
    return patternOutput;
  }

  return tailWords.join(" ");
}

function reorderContinuationObject(analyses, tailWords) {
  const tailHeads = analyses.slice(2).map((entry) => normalizeAncientKey(entry.headword));
  const tailComponents = analyses.slice(2).flatMap((entry) => entry.components.length ? entry.components : [normalizeAncientKey(entry.headword)]);
  const continuationPatterns = languageRulesConfig.translation?.continuationRenderings ?? [];
  const componentKey = tailComponents.join("|");
  for (const pattern of continuationPatterns) {
    if ((pattern.components ?? []).join("|") === componentKey) {
      return pattern.output ?? tailWords.join(" ");
    }
    if ((pattern.heads ?? []).length && (pattern.heads ?? []).every((value, index) => tailHeads[index] === value)) {
      return pattern.output ?? tailWords.join(" ");
    }
  }

  return tailWords.join(" ");
}

function reorderLocationPhrase(analyses, words) {
  const heads = analyses.map((entry) => normalizeAncientKey(entry.headword));
  const components = analyses.flatMap((entry) => entry.components.length ? entry.components : [normalizeAncientKey(entry.headword)]);
  const nounArticles = languageRulesConfig.translation?.nounArticles ?? {};

  if (heads[0] === "lan" && words[1]) {
    return [resolveSubject(words[1], "translation"), "appeared", ...words.slice(2)];
  }

  const locationPattern = findIncludePatternOutput(languageRulesConfig.translation?.locationReorderings ?? [], heads);
  if (locationPattern && Array.isArray(locationPattern)) {
    const subject = words[0];
    const verb = words[1] ?? "";
    return [resolveSubject(subject, "translation"), verb, ...locationPattern];
  }

  if (heads[0] === "sesh" && heads[1] === "sacht" && components.slice(2).join("+") === "sec+sec+raknacht+socht") {
    return ["The wind", "continued", "over", "the sand,", "and", "the sand-journey", "began"];
  }

  if (heads[0] === "ruvalnacht" && heads[1] === "lan" && heads[2] === "jino" && heads[3] === "tsal") {
    return ["An omen", "appeared", "between", "the skies"];
  }

  return words.map((word, index) => {
    if (index === 0) {
      return resolveSubject(word, "translation");
    }

    const lowerWord = word.toLowerCase();
    if (index > 0 && nounArticles[lowerWord] === "the") {
      return `the ${word}`;
    }

    return word;
  });
}

function withArticle(word) {
  if (!word) {
    return word;
  }

  const lowerWord = word.toLowerCase();
  const bareWords = new Set(languageRulesConfig.translation?.bareWords ?? []);
  const nounArticles = languageRulesConfig.translation?.nounArticles ?? {};

  if (bareWords.has(lowerWord)) {
    return word;
  }

  if (ARTICLE_BLOCKERS.has(lowerWord)) {
    return word;
  }

  if (nounArticles[lowerWord]) {
    return `${nounArticles[lowerWord]} ${word}`;
  }

  if (ARTICLE_EXCEPTIONS.has(lowerWord)) {
    return `the ${word}`;
  }

  if (/^[aeiou]/i.test(word)) {
    return `an ${word}`;
  }

  return `a ${word}`;
}

function getSelectedOutput(analysis) {
  const mode = outputModeSelect.value;
  if (mode === "gloss") {
    return analysis.naturalGloss;
  }

  if (mode === "resolved") {
    return analysis.literalTranslation;
  }

  return analysis.idiomaticTranslation;
}

function capitalize(value) {
  if (!value) {
    return value;
  }

  return value.charAt(0).toUpperCase() + value.slice(1);
}

function resolveSubject(word, mode) {
  if (mode === "translation") {
    const lowerWord = word.toLowerCase();
    const subjectRenderings = languageRulesConfig.translation?.subjectRenderings ?? {};
    const nounArticles = languageRulesConfig.translation?.nounArticles ?? {};

    if (subjectRenderings[lowerWord]) {
      return subjectRenderings[lowerWord];
    }

    if (nounArticles[lowerWord] === "the") {
      return `the ${word}`;
    }
  }

  return withArticle(word);
}

function resolveObject(words) {
  const joined = words
    .filter((word) => !HIDDEN_TRANSLATION_MARKERS.has(normalizeAncientKey(word)))
    .join(" ")
    .trim();
  const lowerJoined = joined.toLowerCase();
  const objectArticles = languageRulesConfig.translation?.objectArticles ?? {};
  if (/^fate$/i.test(joined)) {
    return "fate";
  }

  if (objectArticles[lowerJoined]) {
    return `${objectArticles[lowerJoined]} ${joined}`;
  }

  return joined;
}
