# Rejection Decoder

Paste a scholarship rejection or "defective" notice and get a plain-language explanation, a fix checklist, who to contact, and a draft letter, in your language.

## The problem

Students often get notices like "documents mismatched" or "application not recommended" with no clear next step. Existing resources are generic guides, and general chatbots can guess wrong. A wrong fix can cost a student a deadline.

## How it works

1. The page hides Aadhaar, phone, email and long account numbers on the student's device, then sends the notice to a small serverless function (`api/decode.js`).
2. The AI may only choose from `reasons.json`, a library of rejection reasons with fixes and official links.
3. Guardrails in code: unknown reason, low confidence, or a status that does not fit the reason gives an honest "we could not match this" answer.
4. The official link, route and contact always come from the library, never from the AI.
5. If the AI is slow, down or returns something odd, a keyword matcher (`lib/engine.js`) answers from the same library, in English, instead of failing.
6. The status matters. A *Defective* application can be corrected and resubmitted. A *Rejected* or *Fake* one usually cannot, so it goes to grievance or the next cycle.

## Project layout

```
index.html        page (styles inline, no external fonts or scripts)
js/logic.js       browser helpers with no DOM code: redaction, validation, response checks
js/app.js         page behaviour: cache, timeout, accessibility
api/decode.js     serverless endpoint
lib/engine.js     decision logic: status detection, keyword scoring, guardrails on AI output
reasons.json      hand-checked reason library
tests/            automated tests
```

## Assumptions

- Notices follow the NSP style: a status (Defective, Rejected, Fake, Pending, Payment failed) plus an officer remark.
- The library is the only source of facts. The AI may only choose from it and rephrase it.
- Students paste text. They do not upload files.
- When two reasons score exactly equal, we say "could not match" instead of guessing.

## Run locally

```bash
npm i -g vercel
export GEMINI_API_KEY=your_key      # from aistudio.google.com
vercel dev
```

Optional: `GEMINI_MODEL` (default `gemini-2.5-flash`).

## Tests

```bash
npm test
```

Uses the built-in Node test runner, so there is nothing to install. No API key or network is needed, because the AI call is mocked.

| File | What it checks |
| --- | --- |
| `tests/engine.test.js` | one realistic notice per reason reaches the right reason, vague notices do not match, a reason is never used for a status it does not allow, ties are treated as ambiguous, every guardrail on AI output, and the reason library itself (unique ids, https links, required fields) |
| `tests/api.test.js` | wrong method, short or long input, unsupported language, API key sent in a header and not the URL, prompt injection cannot break out of the notice block, invented reason ids, AI errors, timeouts and bad JSON all fall back safely, no-cache header |
| `tests/logic.test.js` | personal-data hiding, input validation, cache keys, link safety, response cleanup |

When you add a reason to `reasons.json`, add one realistic notice for it to the `CASES` list in `tests/engine.test.js`.

## Deploy

Import this repo in Vercel and add the `GEMINI_API_KEY` environment variable. No build step is needed.

## Limits

- Covers NSP-style scholarship notices only (7 reasons so far).
- `reasons.json` is hand-written. Check the `last_checked` date before relying on it.
- Not legal advice. Always confirm on the official portal.
- Sample notices in the app are made up.

## Roadmap

Photo upload of notices, more schemes, more reasons, and RTI draft templates.
