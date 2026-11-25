'use strict';
const fs = require('fs');
const path = require('path');
const E = require('../engine');

const MODEL = process.env.GEMINI_MODEL || 'gemini-2.5-flash';
const TIMEOUT_MS = 15000;

let cachedLibrary = null;
function getLibrary() {
  if (cachedLibrary) return cachedLibrary;
  const libPath = path.join(__dirname, '..', 'reasons.json');
  cachedLibrary = JSON.parse(fs.readFileSync(libPath, 'utf8'));
  return cachedLibrary;
}

module.exports = async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Use POST.' });
  }

  const body = (typeof req.body === 'string' ? E.safeParse(req.body) : req.body) || {};
  const sanitized = E.sanitizeNotice(body.notice);
  const redacted = typeof E.redactPII === 'function' ? E.redactPII(sanitized).text : sanitized;
  const language = E.pickLanguage(body.language);

  if (redacted.length < E.MIN_NOTICE) {
    return res.status(400).json({ error: 'Please paste the text of your notice.' });
  }
  if (redacted.length > E.MAX_NOTICE) {
    return res.status(400).json({
      error: 'Notice is too long. Paste only the status and remark (under ' + E.MAX_NOTICE + ' characters).'
    });
  }

  const library = getLibrary();
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return res.status(200).json(E.ruleBasedResult(redacted, language, library));
  }

  try {
    const response = await fetch(
      'https://generativelanguage.googleapis.com/v1beta/models/' + encodeURIComponent(MODEL) + ':generateContent',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-goog-api-key': apiKey
        },
        signal: AbortSignal.timeout(TIMEOUT_MS),
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: E.buildSystem(language) }] },
          contents: [{ role: 'user', parts: [{ text: E.buildPrompt(redacted, library) }] }],
          generationConfig: {
            temperature: 0.2,
            responseMimeType: 'application/json'
          }
        })
      }
    );

    if (!response.ok) {
      throw new Error('AI service status ' + response.status);
    }

    const data = await response.json();
    const parts = data && data.candidates && data.candidates[0] && data.candidates[0].content && data.candidates[0].content.parts;
    const rawText = Array.isArray(parts) ? parts.map((p) => (p && p.text) || '').join('') : '';
    const parsed = E.safeParse(rawText.replace(/```json|```/g, '').trim());
    return res.status(200).json(E.buildFromModel(parsed, library, language));
  } catch (err) {
    console.error('decode fallback:', err && err.message ? err.message : 'unknown error');
    return res.status(200).json(E.ruleBasedResult(redacted, language, library));
  }
};
