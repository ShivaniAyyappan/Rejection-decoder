/* Pure, DOM-free helpers. Loaded in the browser as window.RejectionLogic
   and imported by the Node test runner. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.RejectionLogic = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var MAX_LEN = 2000;
  var MIN_LEN = 8;

  var PII_RULES = [
    { re: /[\w.+-]+@[\w-]+(?:\.[\w-]+)+/g, tag: '[email hidden]' },
    { re: /(?:\+91[\s-]?)?\b[6-9]\d{9}\b/g, tag: '[phone hidden]' },
    { re: /\b\d{4}[\s-]?\d{4}[\s-]?\d{4}\b/g, tag: '[ID hidden]' },
    { re: /\b\d{9,18}\b/g, tag: '[number hidden]' }
  ];

  var STATUS_TONES = Object.freeze({
    defective: 'warn',
    pending: 'warn',
    'payment failed': 'warn',
    rejected: 'bad',
    fake: 'bad',
    approved: 'ok',
    verified: 'ok',
    ok: 'ok'
  });

  function redactPII(text) {
    var count = 0;
    var out = String(text == null ? '' : text);
    for (var i = 0; i < PII_RULES.length; i++) {
      var rule = PII_RULES[i];
      out = out.replace(rule.re, function () {
        count += 1;
        return rule.tag;
      });
    }
    return { text: out, count: count };
  }

  function validateNotice(text) {
    var t = String(text == null ? '' : text).trim();
    if (t.length < MIN_LEN) {
      return { ok: false, error: 'Paste the status and remark from your portal first.' };
    }
    if (t.length > MAX_LEN) {
      return {
        ok: false,
        error: 'That is longer than ' + MAX_LEN + ' characters. Paste only the status and the officer remark.'
      };
    }
    return { ok: true, text: t };
  }

  function cacheKey(text, language) {
    var normalizedText = String(text == null ? '' : text)
      .trim()
      .toLowerCase()
      .replace(/\s+/g, ' ');
    return String(language == null ? '' : language) + '|' + normalizedText;
  }

  function statusTone(status, matched) {
    if (!matched) return 'unknown';
    var key = String(status || '').trim().toLowerCase();
    return Object.prototype.hasOwnProperty.call(STATUS_TONES, key) ? STATUS_TONES[key] : 'unknown';
  }

  function safeLink(url) {
    if (typeof url !== 'string' || !url.trim()) return '';
    try {
      var parsed = new URL(url.trim());
      return parsed.protocol === 'https:' ? parsed.href : '';
    } catch (_) {
      return '';
    }
  }

  function pickNonEmptyString(value, fallback) {
    return typeof value === 'string' && value.trim() ? value.trim() : fallback;
  }

  function normalizeResponse(raw) {
    var d = raw && typeof raw === 'object' ? raw : {};
    var rawSteps = Array.isArray(d.fix_steps) ? d.fix_steps : [];
    var steps = [];
    for (var i = 0; i < rawSteps.length; i++) {
      if (typeof rawSteps[i] === 'string' && rawSteps[i].trim()) {
        steps.push(rawSteps[i].trim());
      }
    }

    return {
      matched: d.matched === true,
      status: pickNonEmptyString(d.status, 'Unknown'),
      confidence: pickNonEmptyString(d.confidence, ''),
      title: pickNonEmptyString(d.title, 'We could not identify this notice'),
      explanation: pickNonEmptyString(d.explanation, ''),
      fix_steps: steps,
      route: pickNonEmptyString(d.route, ''),
      contact: pickNonEmptyString(d.contact, 'your institute nodal officer'),
      letter: typeof d.letter === 'string' ? d.letter : '',
      note: pickNonEmptyString(d.note, ''),
      official_link: safeLink(d.official_link)
    };
  }

  return {
    MAX_LEN: MAX_LEN,
    MIN_LEN: MIN_LEN,
    redactPII: redactPII,
    validateNotice: validateNotice,
    cacheKey: cacheKey,
    statusTone: statusTone,
    safeLink: safeLink,
    normalizeResponse: normalizeResponse
  };
});
