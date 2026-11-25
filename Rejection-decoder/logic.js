const MAX_CACHE_ENTRIES = 100;
const explanationCache = new Map();

function maskSensitiveText(text) {
  if (typeof text !== "string") return { cleaned: "", maskedCount: 0 };
  let maskedCount = 0;
  let cleaned = text;

  cleaned = cleaned.replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, () => {
    maskedCount++;
    return "[EMAIL MASKED]";
  });

  cleaned = cleaned.replace(/\b\d{4}[\s-]?\d{4}[\s-]?\d{4}\b/g, () => {
    maskedCount++;
    return "[ID MASKED]";
  });

  cleaned = cleaned.replace(/(?:\+91[\s-]?)?\b[6-9]\d{9}\b/g, () => {
    maskedCount++;
    return "[PHONE MASKED]";
  });

  cleaned = cleaned.replace(/\b\d{9,18}\b/g, () => {
    maskedCount++;
    return "[NUMBER MASKED]";
  });

  return { cleaned, maskedCount };
}

function classifyRemark(text) {
  const lower = (text || "").toLowerCase();
  if (lower.includes("income") || lower.includes("certificate")) return "income";
  if (lower.includes("name") || lower.includes("mismatch") || lower.includes("spelling")) return "name";
  if (lower.includes("bank") || lower.includes("npci") || lower.includes("account") || lower.includes("dbt")) return "bank";
  return "unclear";
}

function setCachedExplanation(key, value) {
  if (explanationCache.has(key)) {
    explanationCache.delete(key);
  } else if (explanationCache.size >= MAX_CACHE_ENTRIES) {
    const oldestKey = explanationCache.keys().next().value;
    explanationCache.delete(oldestKey);
  }
  explanationCache.set(key, value);
}

function getCachedExplanation(key) {
  if (!explanationCache.has(key)) return null;
  const val = explanationCache.get(key);
  explanationCache.delete(key);
  explanationCache.set(key, val);
  return val;
}

module.exports = {
  maskSensitiveText,
  classifyRemark,
  setCachedExplanation,
  getCachedExplanation,
  MAX_CACHE_ENTRIES
};
