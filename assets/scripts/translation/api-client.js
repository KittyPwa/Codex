// Translator API client and browser-side fallback coordination.

function normalizeAnalysisArray(value) {
  if (Array.isArray(value)) {
    return value;
  }

  if (value === null || value === undefined || value === "") {
    return [];
  }

  return [value];
}

function normalizeTranslationAnalysis(analysis) {
  if (!analysis || typeof analysis !== "object") {
    return analysis;
  }

  const normalizedLines = normalizeAnalysisArray(analysis.lines).map((line) => ({
    ...line,
    tokens: normalizeAnalysisArray(line?.tokens),
    normalizedTokens: normalizeAnalysisArray(line?.normalizedTokens).map((parts) => normalizeAnalysisArray(parts))
  }));

  const normalizedAnalyses = normalizeAnalysisArray(analysis.analyses).map((item) => ({
    ...item,
    meanings: normalizeAnalysisArray(item?.meanings),
    components: normalizeAnalysisArray(item?.components),
    etymology: normalizeAnalysisArray(item?.etymology),
    notes: normalizeAnalysisArray(item?.notes),
    path: normalizeAnalysisArray(item?.path)
  }));

  return {
    ...analysis,
    lines: normalizedLines,
    analyses: normalizedAnalyses
  };
}

async function probeTranslationApi() {
  if (window.location.protocol === "file:") {
    translationApiHealth = null;
    return false;
  }

  try {
    const response = await fetch("./api/health", { cache: "no-store" });
    if (!response.ok) {
      translationApiHealth = null;
      return false;
    }

    const payload = await response.json();
    translationApiHealth = payload;
    return Boolean(payload?.translationApi);
  } catch (error) {
    console.warn("Translation API health check failed.", error);
    translationApiHealth = null;
    return false;
  }
}

function getTranslationApiStatusMessage() {
  const validationErrors = Array.isArray(translationApiHealth?.validation?.errors)
    ? translationApiHealth.validation.errors
    : [];

  if (validationErrors.length) {
    const firstError = validationErrors[0]?.message;
    if (firstError) {
      return `The backend language pack is invalid: ${firstError}`;
    }
  }

  if (translationApiHealth?.status === "degraded") {
    return "The backend translation API is degraded. Check the active language pack and restart the local server.";
  }

  return "The backend translation API is unavailable. Restart the local server and try again.";
}

function requireTranslationApi() {
  if (window.location.protocol === "file:") {
    throw new Error("Translation requires the local server. Open the app through start-translator.bat.");
  }

  if (!serverTranslationApiAvailable) {
    throw new Error(getTranslationApiStatusMessage());
  }
}

async function requestTranslationApi(action, text, options = {}) {
  requireTranslationApi();
  const includeInferred = options.includeInferred ?? includeInferredToggle?.checked ?? false;
  const response = await fetch("./api/translate", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      action,
      text,
      includeInferred
    })
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => "");
    throw new Error(
      errorText
        ? `Translation API failed with HTTP ${response.status}: ${errorText}`
        : `Translation API failed with HTTP ${response.status}.`
    );
  }

  return response.json();
}

async function translateEnglishWithBestAvailable(text) {
  const translationPayload = await requestTranslationApi("english-to-ancient", text);
  const analysisPayload = await requestTranslationApi("analyze-ancient", translationPayload.translation);
  return {
    ancient: translationPayload.translation,
    analysis: normalizeTranslationAnalysis(analysisPayload.analysis),
    source: "api"
  };
}

async function analyzeAncientWithBestAvailable(text) {
  const payload = await requestTranslationApi("analyze-ancient", text);
  return {
    analysis: normalizeTranslationAnalysis(payload.analysis),
    source: "api"
  };
}
