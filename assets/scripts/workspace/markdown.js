// Lexicon markdown export and rules document rendering.

async function downloadLexiconMarkdown() {
  let markdown;

  if (window.location.protocol !== "file:") {
    const response = await fetch("./api/export-markdown", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        includeInferred: includeInferredToggle?.checked ?? false
      })
    });

    if (!response.ok) {
      throw new Error(`Markdown export API failed with HTTP ${response.status}.`);
    }

    markdown = await response.text();
  } else {
    markdown = buildLexiconMarkdown(activeLexicon, {
      includeInferred: includeInferredToggle?.checked ?? false
    });
  }

  const blob = new Blob([markdown], { type: "text/markdown;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  const stamp = new Date().toISOString().slice(0, 10);
  const safeName = (getActiveLanguageName() || "loaded_language")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
  link.href = url;
  link.download = `${safeName || "loaded_language"}_lexicon_${stamp}.md`;
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
  translatorNote.textContent = window.location.protocol === "file:"
    ? "Lexicon markdown exported from the in-browser vocabulary."
    : "Lexicon markdown exported from the backend-managed vocabulary.";
}

function buildLexiconMarkdown(entries, options = {}) {
  const grouped = groupEntriesForMarkdown(entries);
  const lines = [];
  const inferredCount = entries.filter((entry) => entry.status === "inferred").length;
  const confirmedCount = entries.length - inferredCount;
  const markdownConfig = languageRulesConfig.workspace?.markdown ?? {};
  const languageName = markdownConfig.title || getActiveLanguageName();
  const overview = markdownConfig.overview || `This lexicon document was generated directly from the active ${languageName} vocabulary loaded in the translator.`;

  lines.push(`# ${languageName}`);
  lines.push("");
  lines.push("## Overview");
  lines.push("");
  lines.push(overview);
  lines.push("");
  lines.push(`- confirmed entries included: ${confirmedCount}`);
  lines.push(`- inferred entries included: ${inferredCount}`);
  lines.push(`- export mode included inferred entries: ${options.includeInferred ? "yes" : "no"}`);
  lines.push("");
  lines.push("---");
  lines.push("");

  for (const section of getMarkdownSectionOrder()) {
    const sectionEntries = grouped.get(section) ?? [];
    if (!sectionEntries.length) {
      continue;
    }

    lines.push(`## ${section}`);
    lines.push("");
    lines.push("| Ancient | Meaning |");
    lines.push("|---|---|");

    for (const entry of sectionEntries) {
      lines.push(`| \`${escapeMarkdownCell(entry.ancient)}\` | ${formatMeaningCell(entry)} |`);
    }

    lines.push("");
    lines.push("---");
    lines.push("");
  }

  lines.push("## Export Notes");
  lines.push("");
  lines.push("- Entries are grouped automatically from the active lexicon.");
  lines.push("- Meanings are taken directly from the current loaded vocabulary.");
  lines.push("- When inferred mode is disabled, inferred entries are omitted from the export.");
  lines.push("");

  if (rulesNotesMarkdown.trim()) {
    lines.push("---");
    lines.push("");
    lines.push(rulesNotesMarkdown.trim());
    lines.push("");
  }

  return lines.join("\n");
}

function renderRulesNotes() {
  if (!rulesContent || !rulesSummary) {
    return;
  }

  if (!rulesNotesMarkdown.trim()) {
    rulesSummary.textContent = "No rules or notes are currently loaded.";
    rulesContent.innerHTML = "<p>No rules or notes are currently loaded.</p>";
    return;
  }

  const lineCount = rulesNotesMarkdown.split(/\r?\n/).length;
  rulesSummary.textContent = `Loaded rules and notes from data/rules-notes.md (${lineCount} lines).`;
  rulesContent.innerHTML = renderMarkdownDocument(rulesNotesMarkdown);
}

function renderJsonDocument(value) {
  return `<pre><code>${escapeHtml(JSON.stringify(value ?? {}, null, 2))}</code></pre>`;
}

function renderRulesConfigDocument() {
  if (!rulesConfigContent || !rulesConfigSummary) {
    return;
  }

  const jsonText = JSON.stringify(rulesConfigDocument ?? {}, null, 2);
  const lineCount = jsonText.split(/\r?\n/).length;
  rulesConfigSummary.textContent = `Loaded ${getActiveRulesConfigPath()} (${lineCount} lines).`;
  rulesConfigContent.innerHTML = renderJsonDocument(rulesConfigDocument);
  syncRulesConfigGuidedFields();
}

function renderLanguagePackSchemaDocument() {
  if (!schemaContent || !schemaSummary) {
    return;
  }

  const jsonText = JSON.stringify(languagePackSchemaDocument ?? {}, null, 2);
  const lineCount = jsonText.split(/\r?\n/).length;
  schemaSummary.textContent = `Loaded ${getActiveSchemaPath()} (${lineCount} lines).`;
  schemaContent.innerHTML = renderJsonDocument(languagePackSchemaDocument);
  syncSchemaGuidedFields();
}

function renderMarkdownDocument(markdown) {
  const lines = markdown.replace(/\r\n/g, "\n").split("\n");
  const html = [];
  let inList = false;
  let inBlockquote = false;
  let inCode = false;
  let codeBuffer = [];
  let paragraphBuffer = [];

  const flushParagraph = () => {
    if (!paragraphBuffer.length) {
      return;
    }
    html.push(`<p>${renderInlineMarkdown(paragraphBuffer.join(" "))}</p>`);
    paragraphBuffer = [];
  };

  const closeList = () => {
    if (inList) {
      html.push("</ul>");
      inList = false;
    }
  };

  const closeBlockquote = () => {
    if (inBlockquote) {
      html.push("</blockquote>");
      inBlockquote = false;
    }
  };

  const flushCode = () => {
    if (!inCode) {
      return;
    }
    html.push(`<pre><code>${escapeHtml(codeBuffer.join("\n"))}</code></pre>`);
    codeBuffer = [];
    inCode = false;
  };

  for (const rawLine of lines) {
    const line = rawLine.trimEnd();

    if (line.startsWith("```")) {
      flushParagraph();
      closeList();
      closeBlockquote();
      if (inCode) {
        flushCode();
      } else {
        inCode = true;
        codeBuffer = [];
      }
      continue;
    }

    if (inCode) {
      codeBuffer.push(rawLine);
      continue;
    }

    if (!line.trim()) {
      flushParagraph();
      closeList();
      closeBlockquote();
      continue;
    }

    if (line === "---") {
      flushParagraph();
      closeList();
      closeBlockquote();
      html.push("<hr>");
      continue;
    }

    const headingMatch = line.match(/^(#{2,4})\s+(.*)$/);
    if (headingMatch) {
      flushParagraph();
      closeList();
      closeBlockquote();
      const level = Math.min(headingMatch[1].length, 4);
      html.push(`<h${level}>${renderInlineMarkdown(headingMatch[2])}</h${level}>`);
      continue;
    }

    const blockquoteMatch = line.match(/^>\s?(.*)$/);
    if (blockquoteMatch) {
      flushParagraph();
      closeList();
      if (!inBlockquote) {
        html.push("<blockquote>");
        inBlockquote = true;
      }
      html.push(`<p>${renderInlineMarkdown(blockquoteMatch[1])}</p>`);
      continue;
    }

    const bulletMatch = line.match(/^-\s+(.*)$/);
    if (bulletMatch) {
      flushParagraph();
      closeBlockquote();
      if (!inList) {
        html.push("<ul>");
        inList = true;
      }
      html.push(`<li>${renderInlineMarkdown(bulletMatch[1])}</li>`);
      continue;
    }

    const numberMatch = line.match(/^\d+\.\s+(.*)$/);
    if (numberMatch) {
      flushParagraph();
      closeList();
      closeBlockquote();
      html.push(`<p>${renderInlineMarkdown(line)}</p>`);
      continue;
    }

    paragraphBuffer.push(line);
  }

  flushParagraph();
  closeList();
  closeBlockquote();
  flushCode();

  return html.join("\n");
}

function renderInlineMarkdown(text) {
  let output = escapeHtml(text);
  output = output.replace(/`([^`]+)`/g, "<code>$1</code>");
  output = output.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
  output = output.replace(/\*([^*]+)\*/g, "<em>$1</em>");
  return output;
}

function escapeHtml(text) {
  return String(text ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function groupEntriesForMarkdown(entries) {
  const grouped = new Map(getMarkdownSectionOrder().map((section) => [section, []]));

  for (const entry of [...entries].sort((left, right) => (left.ancient ?? "").localeCompare(right.ancient ?? ""))) {
    const section = classifyEntryForMarkdown(entry);
    if (!grouped.has(section)) {
      grouped.set(section, []);
    }
    grouped.get(section).push(entry);
  }

  return grouped;
}

function classifyEntryForMarkdown(entry) {
  const markdownConfig = languageRulesConfig.workspace?.markdown ?? {};
  const ancient = normalizeAncientKey(entry.ancient);

  for (const [section, values] of Object.entries(markdownConfig.sections ?? {})) {
    if (Array.isArray(values) && values.map((value) => normalizeAncientKey(value)).includes(ancient)) {
      return section;
    }
  }

  const categories = getLexiconCategories(entry);

  if (entry.status === "inferred") {
    return markdownConfig.inferredSection || "Inferred Entries";
  }

  if (categories.includes("compound")) {
    return markdownConfig.compoundSection || "Compounds";
  }

  if (categories.length) {
    return categories[0];
  }

  return markdownConfig.additionalSection || "Additional Entries";
}

function getMarkdownSectionOrder() {
  const configured = languageRulesConfig.workspace?.markdown?.sectionOrder;
  return Array.isArray(configured) && configured.length ? configured : ["Additional Entries"];
}

function formatMeaningCell(entry) {
  const meaning = escapeMarkdownCell((entry.meanings ?? []).join(", "));
  const extras = [];

  if (entry.components?.length) {
    extras.push(`components: ${entry.components.map((part) => `\`${escapeMarkdownCell(part)}\``).join(" + ")}`);
  }

  if (entry.etymology?.length) {
    extras.push(`etymology: ${entry.etymology.map((part) => `\`${escapeMarkdownCell(part)}\``).join(" + ")}`);
  }

  if (!extras.length) {
    return meaning;
  }

  return `${meaning} (${extras.join("; ")})`;
}

function escapeMarkdownCell(value) {
  return String(value ?? "").replace(/\|/g, "\\|");
}

function finalCleanup(text) {
  return text
    .replace(/\s+/g, " ")
    .replace(/\s\./g, ".")
    .replace(/\s,/g, ",")
    .trim();
}


function renderRulesNotes() {
  if (!rulesContent || !rulesSummary) {
    return;
  }

  const editing = !rulesEditor?.hidden;
  if (rulesEditButton) {
    rulesEditButton.hidden = editing || !supportsFileEditing();
  }
  if (rulesSaveButton) {
    rulesSaveButton.hidden = !editing;
  }
  if (rulesCancelButton) {
    rulesCancelButton.hidden = !editing;
  }

  if (!rulesNotesMarkdown.trim()) {
    rulesSummary.textContent = "No rules or notes are currently loaded.";
    rulesContent.innerHTML = "<p>No rules or notes are currently loaded.</p>";
  } else {
    const lineCount = rulesNotesMarkdown.split(/\r?\n/).length;
    rulesSummary.textContent = `Loaded rules and notes from ${getActiveRulesNotesPath()} (${lineCount} lines).`;
    rulesContent.innerHTML = renderMarkdownDocument(rulesNotesMarkdown);
  }

  if (rulesEditorStatus && !editing) {
    rulesEditorStatus.textContent = supportsFileEditing()
      ? `This tab is rendered directly from ${getActiveRulesNotesPath()} and can be edited here.`
      : `Run start-translator.bat to edit the external ${getActiveRulesNotesPath()} file from the app.`;
  }
}

