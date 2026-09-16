# Release readiness

This file separates implemented behavior from acceptance that still needs evidence. The current hosted build is a **demo preview**, not the full launch described in SPEC.md.

| Gate | Evidence / status |
| --- | --- |
| Unit/API tests | 77 passed after the split-date and checkbox-position follow-up; every API route covered |
| TypeScript and production build | Latest local checks passed, build `I5gwm5Iq-zTxKttqTgiak`. The hosted preview passed its earlier build and does not yet contain these extraction/export follow-ups |
| Three demo forms, Chromium + mobile WebKit | All six full question/sign/review/download flows passed both locally and on production after the final export change |
| Production regression | Full suite: 12/12 passed in 5.1 minutes on the export-fix deployment. Latest error-handling deployment: 2/2 targeted Chrome/mobile-WebKit review regressions passed in 1.1 minutes. Existing network proxy and Chrome HTTP/1.1 were used; this is functional evidence, not a latency benchmark. Deployment IDs are recorded in `launch/production-verification.json` |
| Upload → live extraction → download in one browser run | **5/6 passed; gate remains open.** Address and insurance sources passed real upload, extraction, required questions/signatures and PDF download in Chrome and mobile WebKit. School passed in Chrome; mobile WebKit's school request returned 502 `llm_error` after the 300-second model timeout, before question entry. Per-run evidence is in `launch/live-upload-verification.json`; no extraction mocks or precomputed demo endpoint were used |
| Error handling and retry | Chrome + mobile WebKit: 4/4 targeted cases pass for localized upload failures, retry, switching to a demo and review edits. Extraction responses are mocked for these error-path tests; no model-accuracy claim |
| Keyboard-only | Address form completed and downloaded in Chrome and WebKit; Safari uses Option+Tab |
| Automated accessibility | Axe WCAG A/AA: zero violations on home, workspace, signature, review, About in both engines |
| Lighthouse mobile | Measured local production build (2026-09-16 01:02 UTC): Performance 99, Accessibility 100; no run warnings. Not rerun after the extraction follow-up |
| Normal turn / demo response speed | 20 local production samples: turn first-byte p95 8 ms, demo endpoint p95 7 ms |
| Uncached extraction p95 <20s | **Failed**: original source benchmarks took 64–268s. Successful real browser uploads took 106.5–295.4s including client rendering/upload; one school request hit the 300s model timeout. The latest German source extraction took 169.629s; French Cerfa still timed out at 300s |
| Five extra real PDFs, including two non-English and one scan | **Not passed**. Two additional real Chrome upload-to-download flows passed with manually chosen synthetic answers and visual review: Spanish Andalucía library (29 fields) and English Sterling Heights library (25 fields). The Spanish file contains vector outlines, so it exercises vision fallback but does not prove a physical scan. Berlin has a separately reviewed library/API export from actual extraction, not a complete browser flow. W-9 and French Cerfa remain extraction failures. See `launch/extra-browser-verification.json` and `launch/extra-form-results.json` |
| Physical phone photograph | **Not tested**; generated image fixture does not count as a real photograph |
| Export appearance | Poppler + browser PDF.js verified. All three two-page exports visually inspected in macOS Preview 11.0, including Chinese text, signatures and preserved instruction pages. Adobe Reader pending; exact inspected file hashes are in `launch/native-verification.json` |
| First five questions with macOS VoiceOver | **Passed** in real Chrome on macOS 26.3.1: keyboard submission advanced through five insurance questions with correct focus; user confirmed audible question and control names. VoiceOver restored to off |
| Desktop microphone and question speech | **Passed** in real Chrome 152: temporary microphone permission, actual synthetic address transcription, editable correction and submission to the next question. With VoiceOver off, user confirmed the app's city-question speech was clear. App speech restored to off |
| Physical iPhone speech and VoiceOver | **Not tested**; desktop acceptance, mocked speech API tests and mobile WebKit do not establish physical iPhone compatibility |
| Daily upload quota | Fourth valid upload returns 429 in API integration tests; production live mode requires Redis |
| Console/hydration | No page errors or API errors in full demo E2E flows |
| Production live model + Redis | **Not configured**. Preview has zero model calls and no uploads |
| Analytics | Code and privacy filters tested; Vercel Hobby does not include custom events. Free page views enabled; custom events remain off pending a suitable plan |
| Product-owner launch acceptance | Pending |
| Requested launch visuals | Five gallery images and an 8-second keyboard demo GIF exist. The specified drag/upload → voice-answer GIF and 3–5 actual Astra conversation captures remain pending; repository evidence is not a substitute |
| Launch video | T18's 60-second script is delivered. The recorded, captioned video requested in §8.2 is not produced |
| Challenge submission and PH schedule | Not submitted or scheduled; eligibility and owner acceptance remain unverified |

## Current external constraints

- The local agent-im health endpoint returns 200. Its inspected chat-completions request contract does not forward a reasoning-effort setting, so lowering it in this application's request would not be an established latency fix. No extra benchmark jobs are running.
- The user approved the temporary localhost test service after the earlier approval-review capacity failures. All six live-upload cases were attempted, then port 3051 was verified closed; the user's existing port 3050 still returns HTTP 200. The remaining live-upload failure is a model timeout, recorded with its actual response and Playwright trace. No unchanged retry is queued.
- The temporary 3051 service was subsequently restarted for the two additional real-source browser checks and stopped after both passed. Its port was verified closed again; the updated user service on 3050 returns HTTP 200. No extraction job remains running.
- The user unlocked the Mac on 2026-09-16. Native Preview, desktop VoiceOver and Chrome microphone/question speech acceptance are now recorded in `launch/native-verification.json`. Adobe Reader is not installed; physical iPhone checks and a real phone photograph still need the corresponding device/input.
- Production live extraction still needs a publicly reachable model endpoint plus Redis credentials. The earlier configuration question remains unanswered; the hosted deployment stays an explicit demo preview.
- The real-upload evidence commit and subsequent extraction fix remain local. Publishing is awaiting the already-requested authorization; the extraction fix has not been deployed. The earlier six-case live-upload matrix predates this fix and retains its original build provenance.

## Additional public form sources

Only public blank forms and synthetic answers are used. No documents are submitted to the issuing institutions.

- [IRS W-9](https://www.irs.gov/pub/irs-pdf/fw9.pdf): 6 text pages, 23 native widgets. agent-im extraction timed out at 300s.
- [Berlin residence registration](https://www.berlin.de/formularverzeichnis/?formular=%2Flabo%2Fzentrale-einwohnerangelegenheiten%2F_assets%2Fanmeldung_bei_der_meldebehoerde.pdf): 1 German page, 53 native widgets. Luna timed out at 300s. Latest Astra extraction succeeded in 169.629s. A manually chosen synthetic fixture exported and passed Poppler visual review; original page dimensions and native values match. The initial required-only fixture produced a blank export and is explicitly excluded from acceptance. Generic all-field fixtures also overflowed narrow boxes; the reviewed fixture uses the printed `PA` document code and skips inapplicable optional fields without modifying the extracted schema.
- [French vehicle registration](https://www.formulaires.service-public.fr/gf/cerfa_13750.do): 1 French text page, no native widgets. Both Luna and Astra timed out; the latest Astra request took 300.081s.
- [Hong Kong employer subsidy application](https://www.offsettingsubsidy.gov.hk/tc/pdf/ER_application_form_chi.pdf): encrypted PDF rejected. No encryption bypass was attempted.
- [Andalucía music-documentation library card](https://www.centrodedocumentacionmusicaldeandalucia.es/documents/162188325/162336533/solicitud-carnet-biblioteca.pdf/055cd1a2-363b-45c4-83d3-85531269286f?version=1.0): one Spanish vector-outline page, only its title extractable, no native widgets. Real Chrome extraction took 116.537s. All 29 manually inventoried blanks were represented; 18 synthetic answers, signature and one-page export passed. A previous extraction combined the three signed-date blanks and caused overlap; the reviewed run preserves day/month/year suffix separately. The source's printed `201_` prefix was completed as the synthetic date 17 September 2019. This is an old test form, not a submitted application.
- [Sterling Heights library card](https://www.sterlingheights.gov/DocumentCenter/View/5381): one English landscape text page, no native widgets. Real Chrome extraction took 109.750s. All 25 manually inventoried user fields were represented; 17 synthetic answers, signature, local date and one-page export passed. Staff-only areas remain untouched. Download failures for other candidates are retained in the browser evidence and do not count as tests.

## Hosting limits

Vercel Hobby was verified through its authenticated API. No plan upgrade, paid add-on, account-wide spend rule, model key, or public tunnel was created. Hobby limits cap free resource usage. [Custom Analytics events require Pro](https://vercel.com/docs/analytics/limits-and-pricing). The [4.5 MB function payload limit](https://vercel.com/docs/functions/limitations) conflicts with the spec's 10 MB original-plus-images upload design; hosted clients enforce a 4.4 MB budget and uploads stay disabled in preview.
