# Building FormLilt with GPT-6 Astra

## What was built

FormLilt turns a PDF form into a guided workflow: deterministic question order, dependent and mutually exclusive fields, validation, multilingual prompts, optional browser speech, attributed signatures, review, and PDF/JSON/text output. Browser storage supports refresh/resume and explicit clearing. An optional local profile suggests values only after the user opts in and clicks to use them.

The implementation uses Next.js 15, React 19, strict TypeScript, Zod, the Vercel AI SDK, unpdf/PDF.js, pdf-lib and embedded Noto fonts. It has no account system or document database. The owner selected basic in-memory rate limits without Redis. Counters contain hashed IP keys rather than form contents, apply per server instance, and can reset.

## How Astra contributed

The supplied spec was implemented as individual task commits from T0 onward. `BUILD_LOG.md` records changes, acceptance commands, failures, and unresolved gates. The repository history is the primary evidence; the fifth gallery image renders that actual history and measured results. It is not a simulated chat screenshot or evidence of a different model session.

The model adapter first used the user's local agent-im OpenAI-compatible service. Astra and Luna generated the checked-in demo schemas/questions. Strict structured output was unreliable with this runner, so compact source-index output plus Zod validation and one repair attempt was used. Source text anchors are verified against the document before rendering. The owner subsequently selected Doubao Seed 2.0 Pro (`doubao-seed-2-0-pro-260215`) through Volcano Engine Ark for both local and deployed live requests. The API key is a server-only Sensitive environment variable on Vercel.

## Engineering lessons

- Deterministic navigation lets an answer advance immediately while language work is optional and asynchronous.
- Actual source coordinates are more reliable than model-drawn boxes for text PDFs. Scans remain approximate.
- Logical PDF text is not enough: visual rendering caught a CJK subset-font `loca` alignment defect. A reproducible font preparation script now pads glyph data correctly.
- WebKit required storing original file bytes/metadata in IndexedDB rather than assuming a File clone always survives.
- Pure scans need a path for source instructions as well as field coordinates: bounded image quotations now survive mixed text/scan documents, while text pages retain source-string verification. Real scan testing also caught initials blanks incorrectly classified as checkboxes; the corrected prompt preserves those writing areas.
- Whole-schema verification prevents a user-supplied demo label from bypassing quota checks.
- Hosting constraints matter: Vercel cannot reach a laptop's loopback API and accepts much less than a 10 MB original plus rendered pages in one request.
- Long forms exposed row-index drift and unhelpful repair prompts. Exact unique label references and nested validation feedback repair these errors while rejecting missing, ambiguous or incorrectly typed references. Actual Ark test attempts, including failures, are recorded in `launch/ark-demo-verification.json`.
- Production builds need their own acceptance: minified PDF class names broke native radio recognition. Class-identity checks and a regression test fixed that production-only issue.
- Network region matters: Hong Kong model requests repeatedly failed before HTTP responses. The spec-permitted Singapore node completed live extraction, translation and PDF export using the same Ark endpoint/model.
- Consent and clear wording matter: provider retention, local browser storage and per-instance limits are disclosed. A translated answer needs confirmation before it is used.

## Evidence and current limits

Read `QUALITY.md` and `launch/quality-metrics.json` for current acceptance. The latest local production Lighthouse run scored 97 performance and 100 accessibility. Three full demo workflows and keyboard/signature/validation/privacy flows are covered by Chromium and mobile WebKit tests. Gallery build evidence records the earlier measurement at capture time.

Separate native acceptance passed all three two-page exports in macOS Preview, the first five insurance questions using macOS VoiceOver and keyboard input, and real Chrome microphone transcription with editable correction. The user confirmed clear VoiceOver output and app question speech. File hashes, versions and observations are recorded in `launch/native-verification.json`; this does not establish physical iPhone compatibility.

The separate real-upload browser matrix reached 5/6 passed through agent-im Astra: address and insurance forms in both engines, plus the school form in Chrome. Mobile WebKit's school request hit the 300-second model timeout before entering the questionnaire. Successful upload/extraction times ranged from 106.5 to 295.4 seconds, including client rendering/upload. `launch/live-upload-verification.json` records the successful PDFs and failed response; the full live-upload gate remains open.

Five additional real PDF flows passed through the earlier provider, including two Spanish forms, native AcroForm, flat text and a physical scan. The owner later chose the current system Chrome instead of separate physical-iPhone/Reader acceptance.

The live Ark deployment is now on Vercel sin1. A production HTTP check extracted the one-page Tinley form in 12.820s, translated a Chinese answer in 4.623s, and exported a visually reviewed PDF with all 10 native values correct and office fields blank. See `launch/ark-production-verification.json`. This one source does not establish extraction p95 or broad model accuracy. The desktop workflow initially paused at the Mac lock, then resumed when the owner unlocked it. A real phone photograph and complete new-provider acceptance remain unverified. The later connection follow-up passed live translation in 5.948s but school extraction still failed after two malformed model outputs. Two complete function-output probes timed out at 280s; those experiments were not deployed. See `launch/ark-deployment-followup.json`. A subsequent named-object format for flat forms returned 103 school fields from a production upload in 101.807s. Visual review then exposed repeated-table and duplicate-underline placement errors. Grounding against actual PDF grid lines and exact source labels fixed those defects; the current deployment exported the same live schema with 99 synthetic answers in 14.946s, with both pages visually reviewed. The original failed placement and corrected output are preserved in `launch/ark-object-extraction.json`. Current system Chrome subsequently passed a real Tinley upload, all 10 questions, drawn signature, review and download. An upstream timeout exposed silent truncation in the turn stream; a 45-second model deadline, 55-second client deadline and terminal-result validation fixed it. On `dbf236a`, the same saved session confirmed 金色 → gold and downloaded a PDF with all 10 native values correct and office fields blank. See `launch/ark-chrome-verification.json`. This is a saved-session continuation across deployments, not a second extraction.

A 60-second captioned review draft now records the local insurance demo with keyboard entry, source explanation, skipping/returning, a drawn test signature/date and PDF download. The visible draft label and captions identify keyboard input and the edited completion step. It has no audio and does not establish the full upload/voice scenario. Automated speech recording probes returned `no-speech`; no results were mocked for the video. Actual Astra conversation captures also remain unavailable because the desktop tool disallowed access to the Codex app.

## Links

- Live app: https://formlilt.vercel.app
- Source: https://github.com/DanielMax937/formlilt
- Original requirements: `SPEC.md` (FillFlow was a working codename; an existing same-category name led to FormLilt.)

The later two-page parallel integration (`75cd1f8`) retained full document context in both requests and added ownership/reference checks, cancellation and a shared-deadline fallback. Its production school extraction returned 103 fields in 77.397s; the new schema exported in 21.426s and both pages visually passed. This single HTTP sample is slower than the 49.693s local prototype and still misses the 20-second gate; it repeats model input context. See `launch/ark-page-pair-verification.json`.

The separate system-Chrome school upload on that deployment timed out with HTTP 502 (`TimeoutError`). The localized retry screen recovered correctly, but no schema or PDF came from that browser attempt. This failure is preserved in `ark-page-pair-verification.json`; the successful HTTP/PDF check is not a substitute for it.
