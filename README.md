# Rejection Decoder

**Turn a vague scholarship rejection notice into a clear explanation, a fix checklist, and a ready-to-send letter, using only verified rules and admitting when it isn't sure.**

🔗 **Live demo:** https://rejectiondecoder.vercel.app

Built for the Promptwars x AI Vibeathon 2026 (Hack2Skill).

---

## The problem

Students in India apply for scholarships on portals like NSP, then get a status such as **"Defective"** or **"Rejected"** with a short remark like *"income certificate invalid"* or *"details mismatch."*

They often don't know what it means, whether they can fix it, or who to go to. A missed deadline or a wrong fix can cost them the scholarship. The portal gives the decision, but not the "why" or the "what now?"

## What it does

Paste the text of your notice, pick a language, and get:

- **What it means**, in plain words, in your language
- **What to do**, as a step-by-step fix list
- **Where to go:** the nodal officer, the issuing authority, or the grievance route
- **A draft letter** you can copy, edit, and send
- **An official link** to check before acting

## What makes it different

Anyone can paste a notice into a general chatbot. Existing guides and chatbots are generic. This tool is built to be **grounded and safe**:

1. **It only answers from a hand-checked library.** The AI can only choose from the reasons in `reasons.json`. It can't invent rules, deadlines, or office names.
2. **It treats the status first.** A *Defective* application can usually be corrected and resubmitted. A *Rejected* application usually can't be corrected, so those get a grievance or next-cycle route. Mixing these up is the costly mistake.
3. **It says "I'm not sure" when it should.** Code-level guardrails catch an unknown reason, low confidence, or a mismatch between status and reason, and show a safe fallback instead of guessing.

The official link, route, and contact always come from the library, never from the AI.

## How it works

```
Student pastes notice + picks language
            │
            ▼
   Page (index.html) ──► Backend function on Vercel
                                │
                                ▼
              Gemini gets the notice + the reason library
              and returns the best match in structured form
                                │
                                ▼
        Guardrails check the answer against the library:
        • unknown reason?        • low confidence?
        • status/reason mismatch?
                                │
                 ┌──────────────┴──────────────┐
                 ▼                             ▼
          Verified result               Safe fallback
   (explanation, steps, route,      (generic next steps, helpline,
    letter, official link)           how to reach the nodal officer)
```

The Gemini API key stays on the server, in Vercel environment variables. It is never sent to the browser or stored in this repo.

## Reasons covered (8, NSP-style)

The library is intentionally narrow. Each entry lives in `reasons.json`.

| # | Reason | Applies to status |
|---|--------|-------------------|
| 1 | [e.g. Income certificate invalid] | [Defective / Rejected] |
| 2 | [e.g. Details mismatch] | [ ] |
| 3 | [ ] | [ ] |
| 4 | [ ] | [ ] |
| 5 | [ ] | [ ] |
| 6 | [ ] | [ ] |
| 7 | [ ] | [ ] |
| 8 | [ ] | [ ] |

> Each entry should include its **source** and a **last verified** date. See [Contributing](#contributing--verifying-the-library).

## Honest limits

- **Narrow by design:** only 8 reasons for now. Anything else gets a safe fallback.
- **Only as accurate as the library.** The AI picks from the library; it does not know the rules itself. Entries are hand-written and must be verified.
- **Rules vary** by scheme, year, and state. Always check the official link in the result before acting.
- **Not legal advice.** This is an explainer. Confirm with your institute's nodal officer or the official portal.
- **Privacy:** please don't paste your name, Aadhaar number, or application ID into the notice box.

## Project structure

```
Rejection-decoder/
├── index.html            # Front-end page
├── [api/ ... ]           # Vercel serverless function (Gemini call + guardrails)
├── [reasons.json]        # The verified reason library
└── README.md
```

> Update the paths above to match your repo.

## Run it locally

1. Clone the repo
   ```bash
   git clone https://github.com/ShivaniAyyappan/Rejection-decoder.git
   cd Rejection-decoder
   ```
2. Install the Vercel CLI
   ```bash
   npm i -g vercel
   ```
3. Create a `.env` file (never commit it) with your own Gemini key:
   ```
   GEMINI_API_KEY=your_key_here
   ```
4. Start the dev server
   ```bash
   vercel dev
   ```

## Contributing / verifying the library

The most useful contribution is **correcting or adding verified reasons.** If you've been through NSP, or you work in a college scholarship office, please help.

- Spot a wrong or outdated entry? [Open an issue](https://github.com/ShivaniAyyappan/Rejection-decoder/issues) with the entry, what's wrong, and a source (NSP guideline page, circular, or FAQ).
- Want to add a reason? Open a pull request that edits `reasons.json` and includes a source link and the date you checked it.

## Tech

- Front-end: HTML / CSS / JavaScript
- Backend: Vercel serverless function
- AI: Google Gemini (used as a classifier over the library, not as a source of facts)

## License

[Choose a license, e.g. MIT, or remove this section]

## Author

Built by [Shivani Ayyappan](https://github.com/ShivaniAyyappan).
