// Event bindings and app bootstrap.


englishInput.addEventListener("input", () => {
  if (!appReady) {
    return;
  }

  if (activeSource === "ancient") {
    return;
  }

  activeSource = "english";
  ancientInput.value = translateEnglishToAncient(englishInput.value);
  renderAnalysis(analyzeAncientText(ancientInput.value));
  activeSource = null;
});

ancientInput.addEventListener("input", () => {
  if (!appReady) {
    return;
  }

  if (activeSource === "english") {
    return;
  }

  activeSource = "ancient";
  const analysis = analyzeAncientText(ancientInput.value);
  englishInput.value = getSelectedOutput(analysis);
  renderAnalysis(analysis);
  activeSource = null;
});

fillEnglishButton.addEventListener("click", () => {
  if (!appReady) {
    return;
  }

  englishInput.value = "bring ruin, bring ruin\nour lives are yours";
  englishInput.dispatchEvent(new Event("input"));
});

fillAncientButton.addEventListener("click", () => {
  if (!appReady) {
    return;
  }

  ancientInput.value = "Tso'koa, Tso'koa\nNeali micht tealeh\nVal rel kesheh";
  ancientInput.dispatchEvent(new Event("input"));
});

includeInferredToggle.addEventListener("change", () => {
  if (!appReady) {
    return;
  }

  refreshLexiconState();

  if (activeSource === "ancient" || ancientInput.value.trim()) {
    ancientInput.dispatchEvent(new Event("input"));
    return;
  }

  englishInput.dispatchEvent(new Event("input"));
});

outputModeSelect.addEventListener("change", () => {
  if (!appReady) {
    return;
  }

  if (ancientInput.value.trim()) {
    ancientInput.dispatchEvent(new Event("input"));
  }
});

lexiconSearchInput?.addEventListener("input", () => {
  if (appReady) {
    renderLexiconTable();
  }
});

lexiconStatusFilter?.addEventListener("change", () => {
  if (appReady) {
    renderLexiconTable();
  }
});

lexiconRegisterFilter?.addEventListener("change", () => {
  if (appReady) {
    renderLexiconTable();
  }
});

lexiconCategoryFilter?.addEventListener("change", () => {
  if (appReady) {
    renderLexiconTable();
  }
});

for (const button of lexiconSortButtons) {
  button.addEventListener("click", () => {
    const field = button.dataset.lexiconSort;
    if (!field) {
      return;
    }

    if (lexiconSortState.field === field) {
      lexiconSortState.direction = lexiconSortState.direction === "asc" ? "desc" : "asc";
    } else {
      lexiconSortState = { field, direction: "asc" };
    }

    syncLexiconSortButtons();
    if (appReady) {
      renderLexiconTable();
    }
  });
}

for (const button of tabButtons) {
  button.addEventListener("click", () => {
    const target = button.dataset.tabTarget;
    setActiveTab(target);
  });
}

lexiconGraphCloseButton?.addEventListener("click", closeLexiconGraphModal);
lexiconGraphBackdrop?.addEventListener("click", closeLexiconGraphModal);
document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && !lexiconGraphModal?.hidden) {
    closeLexiconGraphModal();
    return;
  }

  if (event.key === "Escape" && !lexiconEntryModal?.hidden) {
    closeLexiconEntryModal();
  }
});

downloadLexiconMarkdownButton?.addEventListener("click", () => {
  if (!appReady) {
    return;
  }

  downloadLexiconMarkdown();
});

syncLexiconSortButtons();

lexiconFileInput?.addEventListener("change", async (event) => {
  const [file] = event.target.files ?? [];
  if (!file) {
    return;
  }

  try {
    setLexiconStatus(`Loading ${file.name}...`);
    const text = await file.text();
    const payload = JSON.parse(text);
    persistImportedLexicon(payload);
    applyLexiconPayload(payload);
    setLexiconStatus(`Using imported lexicon: ${file.name}`);
    translatorNote.textContent = "Imported JSON lexicon is active and saved locally for reuse in this browser.";
    appReady = true;
    rerenderActiveSource();
  } catch (error) {
    console.error(error);
    setLexiconStatus(`Could not read ${file.name}. Expected JSON with confirmed/inferred arrays.`, true);
  } finally {
    event.target.value = "";
  }
});

lexiconNewEntryButton?.addEventListener("click", () => {
  openLexiconEntryModal();
});

lexiconEntryCancelButton?.addEventListener("click", closeLexiconEntryModal);
lexiconEntryBackdrop?.addEventListener("click", closeLexiconEntryModal);
lexiconEntryDeleteButton?.addEventListener("click", async () => {
  if (!supportsFileEditing()) {
    setLexiconEditorStatus("File editing requires the local server launcher.", true);
    return;
  }

  const ancient = lexiconEntryOriginalInput?.value?.trim();
  const group = lexiconEntryOriginalGroupInput?.value?.trim();
  if (!ancient || !group) {
    closeLexiconEntryModal();
    return;
  }

  await deleteLexiconEntry(ancient, group);
});

lexiconEntryForm?.addEventListener("submit", async (event) => {
  event.preventDefault();
  await saveLexiconEntryFromForm();
});

rulesEditButton?.addEventListener("click", () => {
  if (!rulesEditor) {
    return;
  }

  rulesEditor.value = rulesNotesMarkdown;
  rulesEditor.hidden = false;
  rulesContent.hidden = true;
  rulesEditButton.hidden = true;
  rulesSaveButton.hidden = false;
  rulesCancelButton.hidden = false;
  rulesEditorStatus.textContent = supportsFileEditing()
    ? "Editing rules-notes.md directly. Save writes back to the file."
    : "File editing requires the local server launcher.";
  rulesEditorDirty = false;
});

rulesCancelButton?.addEventListener("click", closeRulesEditor);
rulesSaveButton?.addEventListener("click", async () => {
  await saveRulesNotesMarkdown();
});
rulesEditor?.addEventListener("input", () => {
  rulesEditorDirty = true;
});

initializeApp();

