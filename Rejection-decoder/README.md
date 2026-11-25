# Rejection Decoder

Paste a scholarship rejection or "defective" notice and get a plain-language explanation, a fix checklist, who to contact, and a draft letter, in your language.

## The problem

Students often get notices like "documents mismatched" or "application not recommended" with no clear next step. Existing resources are generic guides, and general chatbots can guess wrong. A wrong fix can cost a student a deadline.

## How it works

1. The notice goes to a small serverless function (`api/decode.js`).
2. The AI may only choose from `reasons.json`, a library of rejection reasons with fixes and official links.
3. Guardrails in code: unknown reason, low confidence, or a status that does not fit the reason gives an honest "we could not match this" answer.
4. The official link, route and contact always come from the library, never from the AI.
5. The status matters. A *Defective* application can be corrected and resubmitted. A *Rejected* or *Fake* one usually cannot, so it goes to grievance or the next cycle.

## Run locally

```bash
npm i -g vercel
export GEMINI_API_KEY=your_key      # from aistudio.google.com
vercel dev
```

Optional: `GEMINI_MODEL` (default `gemini-2.5-flash`).

## Deploy

Import this repo in Vercel and add the `GEMINI_API_KEY` environment variable. No build step is needed.

## Limits

- Covers NSP-style scholarship notices only (8 reasons so far).
- `reasons.json` is hand-written. Check the `last_checked` date before relying on it.
- Not legal advice. Always confirm on the official portal.
- Sample notices in the app are made up.


