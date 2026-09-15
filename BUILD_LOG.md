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
