# Rejection Decoder

**Turn a vague scholarship rejection notice into a clear explanation, a fix checklist, and a ready-to-send letter, using only a hand-written library of reasons and admitting when it isn't sure.**

🔗 **Live demo:** https://rejectiondecoder.vercel.app

Built for the Promptwars x AI Vibeathon 2026 (Hack2Skill).

---

## The problem

Students in India apply for scholarships on portals like NSP, then get a status such as **"Defective"** or **"Rejected"** with a short remark like *"income certificate invalid"* or *"details mismatch."*

They often don't know what it means, whether they can fix it, or who to go to. A missed deadline or a wrong fix can cost them the scholarship. The portal gives the decision, but not the "why" or the "what now?"

## What it does

Paste the status and officer remark from your notice, pick a language, and get:

- **What it means**, in plain words
- **What to do**, as a step-by-step fix checklist
- **Who to contact:** the institute nodal/verification officer, the bank, or the portal helpdesk
- **A draft letter** you can copy, edit, and send
- **An official link** to check before acting

Supported languages: English, Hindi, Tamil, Telugu, Kannada, Malayalam, Bengali, Marathi.

## What makes it different

Anyone can paste a notice into a general chatbot. Existing guides and chatbots are generic. This tool is built to be **grounded and careful**:

1. **It answers from a fixed library.** The AI can only choose from the reasons in `reasons.json`. It is instructed not to invent reasons, rules, deadlines, links, or office names, and the code discards any answer that names a reason that isn't in the library.
2. **It reads the status first.** A *Defective* application can usually be corrected and resubmitted. A *Rejected* or *Fake* one usually can't be corrected, so the route is different. If the status and the matched reason don't fit together, the tool falls back instead of guessing.
3. **It says "I'm not sure" when it should.** An unknown reason, low confidence, or a status/reason mismatch triggers a safe fallback that tells the student to read the exact remark and ask the nodal officer or helpdesk.

The contact, route, and official link in a result always come from the library entry, never from the AI.

## Reasons covered (4)

The library is intentionally small. Each entry lives in `reasons.json`.

| # | Reason | Who to contact |
|---|--------|----------------|
| 1 | **Income Certificate Issue** | Institute scholarship nodal/verification officer, or the official portal helpdesk |
| 2 | **Name Mismatch Across Records** | Institute verification officer |
| 3 | **Bank Account / DBT Seeding Hold** | Bank branch, and the portal's payment/DBT status section |
| 4 | **Vague or Incomplete Portal Remark** *(fallback)* | Institute nodal officer or verifier |

Anything that doesn't clearly match one of these gets the safe fallback.

## How it works

```
Student pastes status + remark and picks a language
            │
            ▼
   Page (index.html + app.js) ── sensitive details masked on the device
            │
            ▼
   Vercel serverless function (api/decode.js)
            │
            ▼
   Gemini gets the notice + the reason library and returns
   the best match in structured JSON
            │
            ▼
   Guardrails (engine.js) check the answer against the library:
   • reason not in the library?   • low confidence?
   • status doesn't fit the reason?
            │
     ┌──────┴──────────────┐
     ▼                     ▼
 Library result        Safe fallback
 (explanation, steps,  (read the exact remark, ask the
  contact, link, letter) nodal officer / helpdesk)
```

If the AI service is unavailable, the app falls back to simple keyword matching against the same library and tells the student that this happened.

The Gemini API key is read from a server-side environment variable. It is never sent to the browser and is not stored in this repository.

## Honest limits

- **Small by design:** 4 entries (3 specific reasons plus a fallback). Many real notices will get the fallback.
- **Only as accurate as the library.** The AI picks from the library; it does not know the rules itself. The entries are hand-written and have not been reviewed by an official body. Corrections are welcome (see below).
- **Rules vary** by scheme, year, state, and institute. Always check the official link and your nodal officer before acting.
- **Not legal advice.** This is an explainer, not an official decision or a guarantee of any outcome.
- **AI wording can vary.** The AI may rewrite the explanation and steps (for example, to translate them), so read the result against the official portal.
- **Privacy:** please paste only the status and remark. Don't paste your name, Aadhaar number, application ID, phone number, or email. The page masks some sensitive patterns on your device, but you shouldn't rely on that alone.
- Sample remarks shown on the page are illustrative.

## Project structure

```
Rejection-decoder/
├── index.html                 # Front-end page
├── README.md
└── Rejection-decoder/
    ├── api/decode.js          # Vercel serverless function (Gemini call)
    ├── engine.js              # Matching, status detection, guardrails
    ├── logic.js               # Helpers (e.g. masking sensitive text)
    ├── app.js                 # Front-end behaviour
    ├── reasons.json           # The reason library
    ├── *.test.js              # Automated tests (api, decoder, engine, logic)
    ├── package.json
    └── .gitignore
```

## Run it locally

1. Clone the repo
   ```bash
   git clone https://github.com/ShivaniAyyappan/Rejection-decoder.git
   cd Rejection-decoder/Rejection-decoder
   ```
2. Install the Vercel CLI
   ```bash
   npm i -g vercel
   ```
3. Create a `.env` file (never commit it) with your own Gemini key:
   ```
   GEMINI_API_KEY=your_key_here
   ```
   Optional: `GEMINI_MODEL` to override the default model.
4. Start the dev server
   ```bash
   vercel dev
   ```
5. Run the tests
   ```bash
   npm test
   ```

Without a `GEMINI_API_KEY`, the API falls back to keyword matching.

## Contributing / correcting the library

The most useful contribution is **correcting or adding reasons.** If you've been through NSP, or you work in a college scholarship office, please help.

- Spot a wrong or outdated entry? [Open an issue](https://github.com/ShivaniAyyappan/Rejection-decoder/issues) with the entry, what's wrong, and a source (NSP guideline page, circular, or FAQ).
- Want to add a reason? Open a pull request that edits `reasons.json` and includes a source link and the date you checked it.

## Tech

- Front-end: HTML / CSS / JavaScript
- Backend: Vercel serverless function (Node.js)
- AI: Google Gemini, used to pick from the library and to translate wording, not as a source of facts
- Tests: Node's built-in test runner

## License

MIT

## Author

Built by [Shivani Ayyappan](https://github.com/ShivaniAyyappan).
