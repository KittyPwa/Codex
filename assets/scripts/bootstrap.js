// Event bindings and app bootstrap.


englishInput.addEventListener("input", async () => {
  if (!appReady) {
    return;
  }

  if (activeSource === "ancient") {
    return;
  }

  activeSource = "english";
  const requestId = ++translationRequestSequence;

  try {
    const result = await translateEnglishWithBestAvailable(englishInput.value);
    if (requestId !== translationRequestSequence) {
      return;
    }

    ancientInput.value = result.ancient;
    renderAnalysis(result.analysis);
    translatorNote.textContent = "Translation is being served by the backend API.";
  } catch (error) {
    console.error(error);
    if (requestId !== translationRequestSequence) {
      return;
    }
    translatorNote.textContent = error.message || "The backend translation API could not complete this request.";
  } finally {
    if (requestId === translationRequestSequence) {
      activeSource = null;
    }
  }
});

ancientInput.addEventListener("input", async () => {
  if (!appReady) {
    return;
  }

  if (activeSource === "english") {
    return;
  }

  activeSource = "ancient";
  const requestId = ++translationRequestSequence;

  try {
    const result = await analyzeAncientWithBestAvailable(ancientInput.value);
    if (requestId !== translationRequestSequence) {
      return;
    }

    englishInput.value = getSelectedOutput(result.analysis);
    renderAnalysis(result.analysis);
    translatorNote.textContent = "Analysis is being served by the backend API.";
  } catch (error) {
    console.error(error);
    if (requestId !== translationRequestSequence) {
      return;
    }
    translatorNote.textContent = error.message || "The backend translation API could not complete this request.";
  } finally {
    if (requestId === translationRequestSequence) {
      activeSource = null;
    }
  }
});

fillEnglishButton.addEventListener("click", () => {
  if (!appReady) {
    return;
  }

  const sample = getDefaultEnglishSample();
  if (!sample) {
    resetTranslationWorkspace({
      note: `No built-in English sample is configured for ${getActiveLanguageName()}.`
    });
    return;
  }

  englishInput.value = sample;
  englishInput.dispatchEvent(new Event("input"));
});

fillAncientButton.addEventListener("click", () => {
  if (!appReady) {
    return;
  }

  const sample = getDefaultLoadedLanguageSample();
  if (!sample) {
    resetTranslationWorkspace({
      note: `No built-in ${getActiveLanguageName()} sample is configured for this pack.`
    });
    return;
  }

  ancientInput.value = sample;
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
    lexiconPaginationState.page = 1;
    renderLexiconTable();
  }
});

lexiconStatusFilter?.addEventListener("change", () => {
  if (appReady) {
    lexiconPaginationState.page = 1;
    renderLexiconTable();
  }
});

lexiconRegisterFilter?.addEventListener("change", () => {
  if (appReady) {
    lexiconPaginationState.page = 1;
    renderLexiconTable();
  }
});

lexiconCategoryFilter?.addEventListener("change", () => {
  if (appReady) {
    lexiconPaginationState.page = 1;
    renderLexiconTable();
  }
});

lexiconPageSizeSelect?.addEventListener("change", () => {
  const pageSize = Number.parseInt(lexiconPageSizeSelect.value, 10);
  lexiconPaginationState.pageSize = [10, 25, 50].includes(pageSize) ? pageSize : 25;
  lexiconPaginationState.page = 1;
  if (appReady) {
    renderLexiconTable();
  }
});

lexiconPagePrevButton?.addEventListener("click", () => {
  if (lexiconPaginationState.page > 1) {
    lexiconPaginationState.page -= 1;
    if (appReady) {
      renderLexiconTable();
    }
  }
});

lexiconPageNextButton?.addEventListener("click", () => {
  lexiconPaginationState.page += 1;
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

  if (event.key === "Escape" && !languagePackModal?.hidden) {
    closeLanguagePackModal();
    return;
  }

  if (event.key === "Escape" && !lexiconEntryModal?.hidden) {
    closeLexiconEntryModal();
  }
});

downloadLexiconMarkdownButton?.addEventListener("click", async () => {
  if (!appReady) {
    return;
  }

  try {
    await downloadLexiconMarkdown();
  } catch (error) {
    console.error(error);
    translatorNote.textContent = error.message || "Could not export markdown.";
  }
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

languagePackSelect?.addEventListener("change", async (event) => {
  const packId = event.target.value;
  if (!packId || !appReady) {
    return;
  }

  try {
    languagePackSelect.disabled = true;
    setLexiconStatus("Switching language pack...");
    await switchLanguagePack(packId);
  } catch (error) {
    console.error(error);
    setLexiconStatus(error.message || "Could not switch language pack.", true);
    await loadLanguagePackRegistry().catch(() => {});
    syncLanguagePackSelect();
  } finally {
    languagePackSelect.disabled = window.location.protocol === "file:" || availableLanguagePacks.length <= 1;
  }
});

languagePackNewButton?.addEventListener("click", () => {
  openLanguagePackModal();
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

languagePackCancelButton?.addEventListener("click", closeLanguagePackModal);
languagePackBackdrop?.addEventListener("click", closeLanguagePackModal);
languagePackForm?.addEventListener("submit", async (event) => {
  event.preventDefault();
  await saveLanguagePackFromForm();
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

rulesConfigEditButton?.addEventListener("click", () => {
  if (!rulesConfigEditor) {
    return;
  }

  rulesConfigEditor.value = JSON.stringify(rulesConfigDocument ?? {}, null, 2);
  rulesConfigEditor.hidden = false;
  rulesConfigContent.hidden = true;
  rulesConfigEditButton.hidden = true;
  rulesConfigSaveButton.hidden = false;
  rulesConfigCancelButton.hidden = false;
  rulesConfigEditorStatus.textContent = supportsFileEditing()
    ? "Editing rules.json directly. Save writes back to the file."
    : "File editing requires the local server launcher.";
  rulesConfigEditorDirty = false;
});

rulesConfigCancelButton?.addEventListener("click", closeRulesConfigEditor);
rulesConfigSaveButton?.addEventListener("click", async () => {
  await saveRulesConfigDocument();
});
rulesConfigEditor?.addEventListener("input", () => {
  rulesConfigEditorDirty = true;
});
rulesConfigTokenPatternInput?.addEventListener("input", renderTokenPatternPreview);
rulesConfigTokenSampleInput?.addEventListener("input", renderTokenPatternPreview);
rulesConfigTokenPresetSimpleButton?.addEventListener("click", () => {
  setTokenPatternSample("Lan tsar ouk tsal.");
});
rulesConfigTokenPresetApostropheButton?.addEventListener("click", () => {
  setTokenPatternSample("kesh'skehsiar sacht raknacht");
});
rulesConfigTokenPresetMultilineButton?.addEventListener("click", () => {
  setTokenPatternSample("Lan tsar ouk tsal.\nRuvalnacht lan jino tsal ji.\nmah-ar tsach kesheh, tah-ar tsocht rek");
});
rulesConfigTokenPresetSaveCustomButton?.addEventListener("click", () => {
  saveCurrentTokenPatternSample();
});
rulesConfigTokenPresetLoadCustomButton?.addEventListener("click", () => {
  loadSavedTokenPatternSample();
});
rulesConfigApplyGuidedButton?.addEventListener("click", async () => {
  try {
    applyRulesConfigGuidedFields();
    await saveRulesConfigDocument();
  } catch (error) {
    console.error(error);
    rulesConfigEditorStatus.textContent = error.message || "Could not apply guided rules fields.";
  }
});
rulesConfigEnglishFillersAddButton?.addEventListener("click", () => {
  rulesConfigEnglishFillersBuilder?.append(createBuilderTextRow("", "the"));
});
rulesConfigEnglishAliasesAddButton?.addEventListener("click", () => {
  rulesConfigEnglishAliasesBuilder?.append(createBuilderAliasRow("", ""));
});
rulesConfigFormatButton?.addEventListener("click", () => {
  try {
    formatRulesConfigEditor();
  } catch (error) {
    console.error(error);
    rulesConfigEditorStatus.textContent = error.message || "Could not format rules JSON.";
  }
});

schemaEditButton?.addEventListener("click", () => {
  if (!schemaEditor) {
    return;
  }

  schemaEditor.value = JSON.stringify(languagePackSchemaDocument ?? {}, null, 2);
  schemaEditor.hidden = false;
  schemaContent.hidden = true;
  schemaEditButton.hidden = true;
  schemaSaveButton.hidden = false;
  schemaCancelButton.hidden = false;
  schemaEditorStatus.textContent = supportsFileEditing()
    ? "Editing language-pack.schema.json directly. Save writes back to the file."
    : "File editing requires the local server launcher.";
  schemaEditorDirty = false;
});

schemaCancelButton?.addEventListener("click", closeSchemaEditor);
schemaSaveButton?.addEventListener("click", async () => {
  await saveLanguagePackSchemaDocument();
});
schemaEditor?.addEventListener("input", () => {
  schemaEditorDirty = true;
});
schemaApplyGuidedButton?.addEventListener("click", async () => {
  try {
    applySchemaGuidedFields();
    await saveLanguagePackSchemaDocument();
  } catch (error) {
    console.error(error);
    schemaEditorStatus.textContent = error.message || "Could not apply guided schema fields.";
  }
});
schemaRequiredPathsAddButton?.addEventListener("click", () => {
  schemaRequiredPathsBuilder?.append(createBuilderTextRow("", "language.name"));
});
schemaRecommendedPathsAddButton?.addEventListener("click", () => {
  schemaRecommendedPathsBuilder?.append(createBuilderTextRow("", "translation.syntaxPatterns"));
});
schemaResolverNamesAddButton?.addEventListener("click", () => {
  schemaResolverNamesBuilder?.append(createBuilderTextRow("", "subject"));
});
schemaResolverTypesAddButton?.addEventListener("click", () => {
  schemaResolverTypesBuilder?.append(createBuilderTextRow("", "phrase"));
});
schemaSegmenterTypesAddButton?.addEventListener("click", () => {
  schemaSegmenterTypesBuilder?.append(createBuilderTextRow("", "affix_split"));
});
schemaFormatButton?.addEventListener("click", () => {
  try {
    formatSchemaEditor();
  } catch (error) {
    console.error(error);
    schemaEditorStatus.textContent = error.message || "Could not format schema JSON.";
  }
});

initializeApp();

