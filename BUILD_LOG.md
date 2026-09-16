# FillFlow build log

All times Asia/Shanghai. Built in the Codex task with GPT-6 Astra. Entries distinguish implementation, automated evidence and unverified release requirements.

## 2026-09-16 · Preflight / decisions

- Read SPEC.md in full. Workspace initially contained only the spec; no existing app or Git history.
- User override: agent-im is the initial provider instead of Ark. Ark console/key checks are therefore replaced with inspection of the local agent-im implementation and a live image+JSON request. Real configured model: `codex-login/gpt-6-astra`; base URL `http://127.0.0.1:3300/v1`; placeholder token `agent-im-local` is not an account secret.
- Agent-im health returned 200. It has no `/v1/models` route; model format and default verified from its source/tests. Image preflight pending.
- Keep Next.js 15, Node runtime and Vercel as explicitly specified. Sites' default Vinext/Cloudflare starter and hosting are inapplicable to this user-selected architecture. Apply its accessibility/visual principles only.
- Privacy: no FillFlow database. Browser stores progress and original files. Agent-im/provider may retain its own sessions; disclose this accurately. Demo flow must work without model calls.
- Development can use an in-memory limiter; deployed production must use shared Redis and fail closed when unconfigured.
- Live preflight passed: HTTP 200 in 53.245s, model correctly returned `FILLFLOW VISION CHECK` and `Full name:` from the synthetic JPEG with JSON-object response mode. No user document was sent. This already exceeds the target latency; do not claim p95 compliance.

## 2026-09-16 01:10 · T0 complete
- Initialized Next.js 15.5.25 / React 19 / Tailwind 4, strict TypeScript, Vitest and Playwright. Added validated server-only environment configuration, README and ignored local env.
- Acceptance: `pnpm test` 1/1 passed; `pnpm build` passed (home and not-found prerendered). No ignored type/build errors.
- Registry mirror was unavailable; installed from the official npm registry. Local server port is 3050.

## 2026-09-16 01:10 · T1 complete
- Added bounded zod models for fields, schemas, answers, turns, finalize and browser sessions. Validate unique IDs, section membership, anchor bounds, options, cyclic dependencies, signature references and 30 KB schema limit.
- Acceptance: `pnpm test` 4/4 passed, including invalid models and invalid API inputs.
- Strict JSON-schema image preflight also passed (HTTP 200), but took 137.896s versus 53.245s for JSON-object mode. Initial agent-im default remains JSON mode with application-level zod validation and one repair retry; full demo extraction timing remains to be measured.

## 2026-09-16 01:15 · T2 complete
- Server uses unpdf text coordinates in displayed top-left page space, plus pdf-lib widget rectangles and option lists. Photos use the scan path. Added client PDF/JPEG/PNG/HEIC rendering, 1600px bound, worker/font asset copy at install.
- Three complete two-page demo forms: IRS text items [122,213], 25 widgets; VA [117,40], 48 widgets; Dublin school [103,69], 0 widgets. All pages classified text. JPEG fixture classified scan.
- Acceptance: `pnpm test` 9/9 passed; `pnpm typecheck` passed. Six sample page images rendered with Poppler at <=1600px. Client rendering will additionally be exercised in browser e2e.
- Real documents caught library API changes (unpdf cleanup through loadingTask and viewport rectangle conversion); corrected against installed types. Rejected encrypted/oversize source samples; school PDF consists of the complete two-page medical form extracted from a larger packet, with source attribution.

## 2026-09-16 01:30 · T3 verification in progress
- Implemented provider switching, SDK generateObject + zod, one repair retry, grounded labels, bounded multipart input, safe errors and extract route.
- Fixed two real agent-im compatibility issues: the compatible SDK's JSON-object mode drops response schema, so the schema is explicitly supplied in the system prompt; agent-im uses Ajv2020, so strict-mode requests convert draft-07 tuple items to prefixItems and remove the draft declaration.
- Synthetic photo full FormSchema accepted in 64.471s with codex-login/gpt-5.6-luna, JSON mode, 1/1 field. Full demo extraction requests still running. No claim of latency target compliance.
- Current automated acceptance: 17/17 unit tests and typecheck passed. Raw model outputs are not logged by routes; fixture-only verification records structured counts and timing.
- Full-schema requests for the three demos timed out at the 300s local test bound. Changed only the model wire representation to compact indexed rows: the server assembles the specified FormSchema from trusted text/widget references. This reduces duplicated labels/coordinates and makes those references exact by construction. New live checks are running. T3 remains open until their result is inspected; prepare subsequent deterministic components while these external checks run, without marking their acceptance complete.

## 2026-09-16 01:40 · T3 functional acceptance complete; latency gate open
- Real extraction succeeded for all requested fixtures after compact source-reference adaptation: address 31 fields / 25 of 25 native fields / 31 matching labels / 186.258s (Luna); insurance 42 fields / 42 of 42 native fields (48 widgets) / 42 matching labels / 129.171s (Astra); school medical 103 fields / no native fields / 103 matching labels / 268.385s (Astra). Photo full-schema test: 1 field / 64.471s (Luna).
- Source visual inventory: address has 25 native inputs + 3 signature lines + 3 dates = 31; insurance 42 unique inputs including signature; school includes contact fields, 20 health checkboxes, 40 medication table cells and signature details. Extracted field counts meet >=90% inventory coverage. Labels are resolved from numbered text items, so text reference match is 100%.
- Existing API unit tests / grounding / repair tests passed. Default remains user-selected agent-im with Astra; raised development request timeout to 300s so tested complex forms can complete. No fabricated success on timeout.
- Release limit: samples take 129–268s, so p95 <20s is NOT met. These local timings are not Vercel-region benchmarks. Runtime for public deployment needs a reachable fast provider; loopback agent-im is not reachable from Vercel. Strict JSON mode full-demo comparison will be recorded separately.

## 2026-09-16 01:41 · T4 complete
- Added repeatable precompute script (live model or validated fixture results), demo manifest and read-only demo API. All three schemas are validated before publishing any file.
- Acceptance: three schemas exist and pass FormSchema validation; sizes 12.8 KB / 16.5 KB / 26.6 KB, all <30 KB. Demo API tests 4/4 passed; typecheck passed. Demo route has no LLM or limiter dependency.

## 2026-09-16 01:43 · T5 complete
- Built responsive homepage with real upload rendering/extraction, three demo cards, saved-session resume and clear-all. Added browser IndexedDB originals, validated localStorage sessions, language switch and four UI dictionaries.
- Acceptance: Chromium e2e clicked the insurance demo, opened its persisted form, refreshed successfully and made zero extract calls: 1/1 passed in 7.3s. Home HTTP 200; preview handed to Codex (queued by app). Typecheck passed.
- The first workspace slice displays the extracted form and sections. Guided question controls follow in T6–T8. No private file or answer is sent in analytics events.

## 2026-09-16 01:44 · T6 complete
- Deterministic section-order routing for answer/skip/back/jump, recursive dependency visibility, inactive-answer pruning and unknown-field rejection. Skipped questions stay available for review instead of causing a loop.
- Acceptance: next-field tests cover branching, revisiting, completion and clearing stale conditional answers; 3/3 passed.

## 2026-09-16 01:51 · T7 complete
- Added streamed turn API with deterministic decisions, localized validation, source-bound explanations, optional model translation and explicit translation confirmation. Browser hook persists optimistic local changes and aborts stale requests.
- Working question workspace includes section todo status, revisiting answers and a live progress ring. Routine turns require no model call; model output cannot change which field comes next.
- Acceptance: turn API tests 3/3 passed; Chromium e2e answered three questions, skipped one, went back, jumped to a prior answer and restored it after refresh: 1/1 passed in 8.3s. Typecheck passed.
- Strict-mode comparison: all three full-demo attempts failed (two optional-property schema requirements from Codex's strict validator; one upstream WebSocket disconnect). JSON mode passed all three; leave LLM_STRUCTURED_OUTPUT=false. Strict mode is not the production recommendation for this agent-im adapter.

## 2026-09-16 02:02 · T8 complete
- Added date/number/email/telephone/select/multiselect/boolean controls, responsive question layout, section todo navigation and progress ring. Keyboard focus follows the current input; reduced motion is respected.
- Visual check caught off-screen status text expanding page height and a Tailwind class-name collision; corrected positioning and progress class naming.
- Mobile WebKit exposed File-object IndexedDB transaction failures. Store ArrayBuffer plus metadata instead, while preserving compatibility with existing File entries. All demo downloads still use the original bytes.
- Acceptance: typed controls, yes/no dependency switching, keyboard submit and no horizontal overflow pass on Chromium and iPhone/WebKit. Screenshots saved in launch/. Typecheck passed.

## 2026-09-16 02:02 · T9 complete
- Type/constraint validation reports inline, localized errors and keeps the current question. Regex checks use a linear-time engine. Explanations cite supplied form help; missing help says the source does not explain it.
- Acceptance: 4/4 validation unit tests (calendar/leap dates, email, phone, numeric bounds, enums, length, adversarial regex); validation e2e passes in Chromium and mobile WebKit. Combined T8/T9 browser acceptance: 4/4 passed in 13.0s.

## 2026-09-16 · T10 implemented; physical-device acceptance open
- Added opt-in question/error speech synthesis and microphone capture, editable transcripts, unsupported-browser feedback, and cancellation when moving to another field. No audio upload endpoint exists in FillFlow; browser speech providers may process recognition remotely, which will be disclosed in About.
- Acceptance: typecheck passed; Chromium and mobile WebKit integration tests exercise recognition callbacks and persisted speech toggle. Physical Chrome microphone and iPhone Safari listening/voice quality require real-device acceptance; automated mocked recognition is not evidence of that manual gate.

## 2026-09-16 · T11 complete
- Added transparent PNG signature drawing with pointer capture (mouse/touch/pen), clear action, keyboard typed signature, signer full name, and auto-filled linked date. Signing does not overwrite an existing date or another person's fields.
- Acceptance: 32/32 unit tests passed, including attribution/date rules and all existing route tests. Four signature e2e cases passed on Chromium and mobile WebKit (typed and pointer paths); typecheck passed. Real stylus hardware remains a manual device check.

## 2026-09-16 · T12 complete
- Added review route with all active sections, inline typed/signature editing, missing required answers, original-page preview, lock option (off by default), JSON export and copyable text summary. PDF download is wired to the T13 endpoint.
- Acceptance: typecheck and 2/2 Chromium/mobile WebKit e2e passed. Verified inline edits survive reload, missing fields remain highlighted, original pages render, and invalid forms cannot start export.

## 2026-09-16 · T13 complete
- Implemented native text/checkbox/radio/select fields, transparent attributed signatures, text-label/blank-line placement, table/scan bounds, photo-to-PDF, embedded Latin/CJK/Arabic fonts, optional flattening and finalize API. Original page count/dimensions, source labels, native field names and all required answers are checked again before export.
- Export rejects overflow rather than truncating an answer. Summary uses a 1.8s model deadline with a source-based fallback; known demos use the deterministic summary and make no model calls. Known-demo exemption compares a complete parsed-schema hash, not a client slug.
- Acceptance: three real forms download and render in Chromium and mobile WebKit (6 full flows passed across the completed runs). 42/42 full unit tests passed, plus 4 new rotation cases; focused fill tests 10/10 passed. Native values, optional flattening, Unicode values, photos and rotations 0/90/180/270 are covered.
- Poppler visual review found and fixed address clipping, signature widget removal without an appearance, and CJK glyph corruption. CFF subsetting was not portable. Converted official Noto CJK variable TrueType to a static 400-weight font and aligned glyf records to 2 bytes to match fontkit's short-loca subsets. Chinese 陈美玲, Japanese 山田花子 and Arabic أحمد علي now render visibly; image/scan outputs open and fit their specified bounds. Rebuild script and OFL notices included.
- Browser end-to-end checks also exposed a localhost/127.0.0.1 origin mismatch and a model language name "English" versus "en". Fixed host-aware same-origin checks and language normalization, with regression tests; full-flow tests now fail on API HTTP errors as well as JS errors.
- Remaining release gates are not implied by these results: physical phone photo, real iOS audio, VoiceOver, and opening outputs in macOS Preview/Adobe Reader still need explicit verification. Placement based on scan/table bounds must be checked against the PDF before external submission.

## 2026-09-16 · T14 complete
- Added oversized PNG-header checks before decompression, reserved-ID rejection, suppressed SDK error logging that could otherwise include provider data, and configurable quota wording. Existing routes enforce bounded bodies, magic bytes, page limits, source validation and no-store/no-referrer headers.
- Acceptance: typecheck and 52/52 tests passed. Four sequential valid upload requests produce [200,200,200,429] and only three model calls; turn 121 is denied; window expiry works; production without Redis fails closed. Forged files, 16-page PDFs, oversized PNG dimensions and oversized bodies are rejected. Exact known-demo schemas receive the documented no-model/no-upload-quota path.

## T15 — 2026-09-16 08:04 CST — privacy, analytics and accessibility

- Implemented four-language About/privacy/model/license information, MIT license, explicit opt-in Vercel Analytics with query/session identifiers removed and no answers in event payloads.
- Added cached, agent-im-generated Chinese/Spanish/Japanese questions for all 176 demo fields. Ordinary demo questions need no runtime model call. Corrected the address form's first three applicability questions after reviewing their meaning.
- Improved contrast, heading hierarchy, signature image restoration, deterministic summary coverage, translation confirmation and source-grounded wording tests. Applied consistent Prettier formatting across the source.
- Public name changed from the spec codename FillFlow to **FormLilt**: existing same-category products found at fillflow.ai and fillflow.co; exact Product Hunt/web search returned no matching FormLilt product; npm registry and .com RDAP returned 404. This is a preliminary availability check, not a trademark clearance or domain purchase. Internal browser storage keys remain compatible.
- Acceptance: `pnpm test` **56/56**, `pnpm typecheck`, `pnpm build` pass. Full production-mode Playwright run **27/28**; final WebKit keyboard test passed after using Safari's Option+Tab (all-controls navigation), yielding all **28 cases verified** across Chromium and mobile WebKit. All three real demo flows produce readable 2-page downloads. Axe reports zero WCAG A/AA violations on home/workspace/signature/review/About in both engines. Keyboard-only address flow signs and downloads in both engines.
- Mobile Lighthouse: **Performance 97, Accessibility 100**, report `tmp/lighthouse-mobile.report.html`, portable metrics `launch/quality-metrics.json`. Preview visually shows the Chinese name and correctly placed school-form answers. Poppler and browser PDF.js export rendering were verified in T13.
- **Release gate remains open**: §7 cannot honestly be fully checked. Local agent-im extraction is still 64–268 seconds (fails <20s target); physical iPhone audio/VoiceOver, Adobe Reader, a real phone photo and five additional manual PDF reviews remain pending. Additional public-form checks are running. T16 can proceed as a clearly identified demo deployment while these gates stay visible; this does not constitute launch acceptance.
