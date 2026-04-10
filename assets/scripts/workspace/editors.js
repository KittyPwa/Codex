// Lexicon and rules editor workflows.

function setLexiconEditorStatus(message, isError = false) {
  void message;
  void isError;
}

function openLexiconEntryModal(entry = null) {
  if (!lexiconEntryModal || !lexiconEntryForm) {
    return;
  }

  if (!supportsFileEditing()) {
    setLexiconEditorStatus("Run start-translator.bat to edit data/lexicon.json from the app.", true);
    return;
  }

  if (entry) {
    populateLexiconEntryForm(entry);
    lexiconEntryDeleteButton.hidden = false;
    lexiconEntryStatus.textContent = "Editing an existing entry from data/lexicon.json.";
  } else {
    lexiconEntryForm.reset();
    lexiconEntryOriginalInput.value = "";
    lexiconEntryOriginalGroupInput.value = "confirmed";
    entryGroupInput.value = "confirmed";
    entryStatusInput.value = "confirmed";
    entryRegisterInput.value = "both";
    lexiconEntryDeleteButton.hidden = true;
    lexiconEntryStatus.textContent = "Creating a new entry in data/lexicon.json.";
  }

  lexiconEntryModal.hidden = false;
  document.body.classList.add("modal-open");
}

function closeLexiconEntryModal() {
  if (!lexiconEntryModal) {
    return;
  }

  lexiconEntryModal.hidden = true;
  if (lexiconGraphModal?.hidden !== false) {
    document.body.classList.remove("modal-open");
  }
}

function populateLexiconEntryForm(entry) {
  const sourceGroup = findLexiconGroupForEntry(entry.ancient);
  lexiconEntryOriginalInput.value = entry.ancient ?? "";
  lexiconEntryOriginalGroupInput.value = sourceGroup;
  entryAncientInput.value = entry.ancient ?? "";
  entryGroupInput.value = sourceGroup;
  entryStatusInput.value = entry.status ?? sourceGroup;
  entryRegisterInput.value = entry.register ?? "";
  entryMeaningsInput.value = (entry.meanings ?? []).join("\n");
  entryPartOfSpeechInput.value = (entry.partOfSpeech ?? []).join("\n");
  entryComponentsInput.value = (entry.components ?? []).join("\n");
  entryEtymologyInput.value = (entry.etymology ?? []).join("\n");
  entryNotesInput.value = (entry.notes ?? []).join("\n");
  entryPronunciationInput.value = entry.pronunciation ?? "";
  entryLexicalizedInput.checked = Boolean(entry.lexicalized);
  entryCanDecomposeInput.checked = Boolean(entry.canDecompose);
  entryAllowNominalReadingInput.checked = Boolean(entry.allowNominalReading);
  entryOptionalInput.checked = Boolean(entry.optional);
}

function findLexiconGroupForEntry(ancient) {
  const key = normalizeAncientKey(ancient);
  if (confirmedLexicon.some((entry) => normalizeAncientKey(entry.ancient) === key)) {
    return "confirmed";
  }

  if (inferredLexicon.some((entry) => normalizeAncientKey(entry.ancient) === key)) {
    return "inferred";
  }

  return "confirmed";
}

function parseListField(value) {
  return value
    .split(/\r?\n|,/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function compactLexiconEntry(entry) {
  const cleaned = {
    ancient: entry.ancient,
    meanings: entry.meanings
  };

  for (const [key, value] of Object.entries(entry)) {
    if (key === "ancient" || key === "meanings") {
      continue;
    }

    if (Array.isArray(value) && value.length) {
      cleaned[key] = value;
      continue;
    }

    if (typeof value === "string" && value.trim()) {
      cleaned[key] = value.trim();
      continue;
    }

    if (typeof value === "boolean" && value) {
      cleaned[key] = value;
    }
  }

  return cleaned;
}

function buildLexiconEntryFromForm() {
  const ancient = entryAncientInput.value.trim();
  const meanings = parseListField(entryMeaningsInput.value);
  if (!ancient || !meanings.length) {
    throw new Error("Ancient form and at least one meaning are required.");
  }

  const group = entryGroupInput.value === "inferred" ? "inferred" : "confirmed";
  const entry = compactLexiconEntry({
    ancient,
    meanings,
    status: entryStatusInput.value.trim() || group,
    register: entryRegisterInput.value.trim(),
    partOfSpeech: parseListField(entryPartOfSpeechInput.value),
    components: parseListField(entryComponentsInput.value),
    etymology: parseListField(entryEtymologyInput.value),
    notes: parseListField(entryNotesInput.value),
    pronunciation: entryPronunciationInput.value.trim(),
    lexicalized: entryLexicalizedInput.checked,
    canDecompose: entryCanDecomposeInput.checked,
    allowNominalReading: entryAllowNominalReadingInput.checked,
    optional: entryOptionalInput.checked
  });

  return { group, entry };
}

function getWritableLexiconPayload() {
  return {
    confirmed: confirmedLexicon.map(cloneLexiconEntry),
    inferred: inferredLexicon.map(cloneLexiconEntry)
  };
}

async function saveLexiconEntryFromForm() {
  if (!supportsFileEditing()) {
    setLexiconEditorStatus("File editing requires the local server launcher.", true);
    return;
  }

  try {
    const { group, entry } = buildLexiconEntryFromForm();
    const originalAncient = lexiconEntryOriginalInput.value.trim();
    const originalGroup = lexiconEntryOriginalGroupInput.value.trim() || "confirmed";
    const payload = getWritableLexiconPayload();
    const normalizedNew = normalizeAncientKey(entry.ancient);

    for (const bucketName of ["confirmed", "inferred"]) {
      payload[bucketName] = payload[bucketName].filter((candidate) => {
        const sameOriginal =
          bucketName === originalGroup &&
          normalizeAncientKey(candidate.ancient) === normalizeAncientKey(originalAncient);
        return !sameOriginal;
      });
    }

    const duplicate = payload[group].some((candidate) => normalizeAncientKey(candidate.ancient) === normalizedNew);
    if (duplicate) {
      throw new Error("Another entry already uses that Ancient form in the target group.");
    }

    payload[group].push(entry);
    payload[group].sort((left, right) => left.ancient.localeCompare(right.ancient));
    await saveLexiconPayload(payload);
    selectedLexiconHeadword = entry.ancient;
    closeLexiconEntryModal();
    setLexiconEditorStatus(`Saved ${entry.ancient} to ${getActiveLexiconPath()}.`);
  } catch (error) {
    console.error(error);
    lexiconEntryStatus.textContent = error.message || "Could not save the lexicon entry.";
    setLexiconEditorStatus(error.message || "Could not save the lexicon entry.", true);
  }
}

async function deleteLexiconEntry(ancient, group) {
  try {
    const payload = getWritableLexiconPayload();
    const normalizedAncient = normalizeAncientKey(ancient);
    const before = payload[group]?.length ?? 0;
    payload[group] = (payload[group] ?? []).filter(
      (entry) => normalizeAncientKey(entry.ancient) !== normalizedAncient
    );

    if ((payload[group]?.length ?? 0) === before) {
      throw new Error("Could not find that entry to delete.");
    }

    await saveLexiconPayload(payload);
    if (normalizeAncientKey(selectedLexiconHeadword ?? "") === normalizedAncient) {
      selectedLexiconHeadword = activeLexicon[0]?.ancient ?? null;
    }
    closeLexiconEntryModal();
    setLexiconEditorStatus(`Deleted ${ancient} from ${getActiveLexiconPath()}.`);
  } catch (error) {
    console.error(error);
    lexiconEntryStatus.textContent = error.message || "Could not delete the lexicon entry.";
    setLexiconEditorStatus(error.message || "Could not delete the lexicon entry.", true);
  }
}

async function saveLexiconPayload(payload) {
  const response = await fetch("./api/lexicon", {
    method: "PUT",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(normalizeLexiconPayload(payload))
  });

  if (!response.ok) {
    throw new Error(`Could not save ${getActiveLexiconPath()} (HTTP ${response.status}).`);
  }

  const savedPayload = await response.json();
  applyLexiconPayload(savedPayload);
  rerenderActiveSource();
}

function closeRulesEditor() {
  if (!rulesEditor || !rulesContent) {
    return;
  }

  rulesEditor.hidden = true;
  rulesContent.hidden = false;
  rulesEditorDirty = false;
  renderRulesNotes();
}

async function saveRulesNotesMarkdown() {
  if (!supportsFileEditing()) {
    if (rulesEditorStatus) {
      rulesEditorStatus.textContent = "File editing requires the local server launcher.";
    }
    return;
  }

  try {
    const value = rulesEditor?.value ?? "";
    const response = await fetch("./api/rules-notes", {
      method: "PUT",
      headers: {
        "Content-Type": "text/markdown;charset=utf-8"
      },
      body: value
    });

    if (!response.ok) {
      throw new Error(`Could not save ${getActiveRulesNotesPath()} (HTTP ${response.status}).`);
    }

    const savedMarkdown = await response.text();
    applyRulesNotesMarkdown(savedMarkdown);
    closeRulesEditor();
    if (rulesEditorStatus) {
      rulesEditorStatus.textContent = `Saved ${getActiveRulesNotesPath()}.`;
    }
  } catch (error) {
    console.error(error);
    if (rulesEditorStatus) {
      rulesEditorStatus.textContent = error.message || `Could not save ${getActiveRulesNotesPath()}.`;
    }
  }
}
