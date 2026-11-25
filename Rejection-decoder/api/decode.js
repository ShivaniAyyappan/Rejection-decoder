// Vercel serverless function: POST /api/decode  { notice: string, language: string }
const library = require('../reasons.json');
const E = require('../lib/engine');

const MODEL = process.env.GEMINI_MODEL || 'gemini-2.5-flash';
const TIMEOUT_MS = 15000;

module.exports = async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') return res.status(405).json({ error: 'Use POST.' });

  const body = (typeof req.body === 'string' ? E.safeParse(req.body) : req.body) || {};
  const notice = E.sanitizeNotice(body.notice);
  const language = E.pickLanguage(body.language);

  if (notice.length < E.MIN_NOTICE) return res.status(400).json({ error: 'Please paste the text of your notice.' });
  if (notice.length > E.MAX_NOTICE) return res.status(400).json({ error: 'Notice is too long. Paste only the status and remark (under ' + E.MAX_NOTICE + ' characters).' });

  const key = process.env.GEMINI_API_KEY;
  if (!key) {
    console.error('GEMINI_API_KEY is not set; using keyword rules only.');
    return res.status(200).json(E.ruleBasedResult(notice, language, library));
  }

  try {
    const r = await fetch(
      'https://generativelanguage.googleapis.com/v1beta/models/' + MODEL + ':generateContent',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key },
        signal: AbortSignal.timeout(TIMEOUT_MS),
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: E.buildSystem(language) }] },
          contents: [{ role: 'user', parts: [{ text: E.buildPrompt(notice, library) }] }],
          generationConfig: { temperature: 0.2, responseMimeType: 'application/json' }
        })
      }
    );
    if (!r.ok) throw new Error('AI service status ' + r.status);

    const data = await r.json();
    const text = data?.candidates?.[0]?.content?.parts?.map((p) => p.text || '').join('') || '';
    const out = E.safeParse(text.replace(/```json|```/g, '').trim());
    return res.status(200).json(E.buildFromModel(out, library, language));
  } catch (e) {
    // AI down, slow or malformed: the hand-checked library still answers.
    console.error('decode fallback:', e && e.message);
    return res.status(200).json(E.ruleBasedResult(notice, language, library));
  }
};
