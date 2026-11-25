/* Pure, DOM-free helpers. Loaded in the browser as window.RejectionLogic and
   imported by the Node test runner (see tests/logic.test.js). */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.RejectionLogic = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var MAX_LEN = 2000;
  var MIN_LEN = 8;

  // Order matters: most specific patterns first.
  var PII_RULES = [
    { re: /[\w.+-]+@[\w-]+(?:\.[\w-]+)+/g, tag: '[email hidden]' },
    { re: /(?:\+91[\s-]?)?\b[6-9]\d{9}\b/g, tag: '[phone hidden]' },
    { re: /\b\d{4}\s?\d{4}\s?\d{4}\b/g, tag: '[Aadhaar hidden]' },
    { re: /\b\d{9,18}\b/g, tag: '[number hidden]' }
  ];

  function redactPII(text) {
    var count = 0;
    var out = String(text == null ? '' : text);
    PII_RULES.forEach(function (rule) {
      out = out.replace(rule.re, function () { count++; return rule.tag; });
    });
    return { text: out, count: count };
  }

  function validateNotice(text) {
    var t = String(text == null ? '' : text).trim();
    if (t.length < MIN_LEN) return { ok: false, error: 'Paste the status and remark from your portal first.' };
    if (t.length > MAX_LEN) return { ok: false, error: 'That is longer than ' + MAX_LEN + ' characters. Paste only the status and the officer remark.' };
    return { ok: true, text: t };
  }

  function cacheKey(text, language) {
    return String(language) + '|' + String(text).trim().toLowerCase().replace(/\s+/g, ' ');
  }

  function statusTone(status, matched) {
    if (!matched) return 'unknown';
    var s = String(status || '').toLowerCase();
    if (s === 'defective' || s === 'pending' || s === 'payment failed') return 'warn';
    if (s === 'rejected' || s === 'fake') return 'bad';
    if (s === 'approved' || s === 'verified' || s === 'ok') return 'ok';
    return 'unknown';
  }

  function safeLink(url) {
    try {
      var u = new URL(String(url));
      return u.protocol === 'https:' ? u.href : '';
    } catch (e) { return ''; }
  }

  function str(v, fallback) { return typeof v === 'string' && v.trim() ? v : fallback; }

  // Never trust the server shape blindly: coerce to a safe, complete object.
  function normalizeResponse(raw) {
    var d = raw && typeof raw === 'object' ? raw : {};
    var steps = Array.isArray(d.fix_steps) ? d.fix_steps.filter(function (s) { return typeof s === 'string' && s.trim(); }) : [];
    return {
      matched: d.matched === true,
      status: str(d.status, 'Unknown'),
      confidence: str(d.confidence, ''),
      title: str(d.title, 'We could not identify this notice'),
      explanation: str(d.explanation, ''),
      fix_steps: steps,
      route: str(d.route, ''),
      contact: str(d.contact, 'your institute nodal officer'),
      letter: typeof d.letter === 'string' ? d.letter : '',
      note: str(d.note, ''),
      official_link: safeLink(d.official_link)
    };
  }

  return { MAX_LEN: MAX_LEN, MIN_LEN: MIN_LEN, redactPII: redactPII, validateNotice: validateNotice,
           cacheKey: cacheKey, statusTone: statusTone, safeLink: safeLink, normalizeResponse: normalizeResponse };
});
