# FormLilt

A PDF form assistant: answer one question at a time, sign, review, and download the filled original. Built with GPT-6 Astra. Next.js 15, React 19, strict TypeScript, MIT.

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2FDanielMax937%2Fformlilt&project-name=formlilt)

[Live app](https://formlilt.vercel.app) · [Release readiness](QUALITY.md)

The production app runs on Vercel with **Doubao Seed 2.0 Pro** for live uploads and answer translation. Three checked-in public forms also work without extraction calls: address change, insurance claim and school medical authorization. No account is required. Fresh deployments default to demo-only mode until the server environment is configured.

## Run locally

Requirements: Node.js 22+, pnpm 10, and a configured model provider for uploads or translation.

```sh
pnpm install
cp .env.example .env.local
pnpm dev
```

Open [localhost:3050](http://localhost:3050). Start agent-im separately at `127.0.0.1:3300` with its Codex runner signed in. Built-in demos work without model calls. Original files live in browser IndexedDB; session answers live in localStorage. Use **Clear all saved forms** on About to remove them.

## Local profile suggestions

On the homepage, expand **Save details for your next form** to opt in to saving a name, current address and identity-document number in this browser. Matching questions offer a button to use the saved value; nothing is automatically submitted. Relatives’ names, split first/last names, old addresses and insurance policy numbers are deliberately excluded. **Clear all saved forms** also deletes the profile.

## Model configuration

Default server configuration uses agent-im's OpenAI-compatible `/v1/chat/completions`:

```dotenv
LLM_PROVIDER=agent-im
AGENT_IM_BASE_URL=http://127.0.0.1:3300/v1
AGENT_IM_API_KEY=agent-im-local
AGENT_IM_MODEL=codex-login/gpt-6-astra
LLM_STRUCTURED_OUTPUT=false
LLM_TIMEOUT_MS=300000
```

The key above is a local placeholder, not a production secret. Match the authentication required by your agent-im installation. Generic JSON mode plus Zod validation and one repair attempt was more reliable than strict structured output in this installation. Extraction sends page images and source text; the model has no tool access from the application. Provider-side runner restrictions and retention still apply.

Switch `LLM_PROVIDER` to `openai` or `doubao` and set the corresponding `OPENAI_*` or `ARK_*`/`DOUBAO_MODEL` variables from [.env.example](.env.example). The OpenAI option also accepts a custom compatible base URL. Never expose API keys in `NEXT_PUBLIC_*` values. Runtime providers/models are disclosed on About.

## Production configuration

The checked-in Vercel config uses Node functions in **sin1**, with Fluid Compute enabled and extraction `maxDuration=300` (other routes use 60 seconds). `.env.local` is excluded from Git and deployments.

To enable live uploads after validation:

1. Configure a **publicly reachable** model endpoint and server-only key. Vercel cannot access your computer's `127.0.0.1`. Do not expose an unauthenticated agent-im runner to the Internet.
2. This deployment uses `RATE_LIMIT_MODE=memory`, explicitly approved without Redis. It limits extraction to 3 requests per rolling 24 hours/IP **per instance**; restarts and separate instances can reset or bypass that count. It is basic abuse protection, not a global quota. For shared quotas, use `RATE_LIMIT_MODE=shared` and configure both `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN`; hosted shared mode fails closed if unavailable. Checked-in demo schemas are verified before exemption.
3. Set `NEXT_PUBLIC_DEMO_ONLY=false` and redeploy. The current server configuration is `LLM_PROVIDER=doubao`, `ARK_BASE_URL=https://ark.cn-beijing.volces.com/api/v3`, `DOUBAO_MODEL=doubao-seed-2-0-pro-260215`, `DOUBAO_THINKING=disabled`, `LLM_STRUCTURED_OUTPUT=false`, and `LLM_TIMEOUT_MS=280000`. Store `ARK_API_KEY` as a Vercel Sensitive environment variable, never in source or a public variable. [Fluid Compute supports 300 seconds on Hobby](https://vercel.com/docs/functions/configuring-functions/duration). Ark requests use a dedicated connection pool with automatic address-family selection and a 20-second connect timeout, within the existing request deadline and one network retry. Provider changes do not by themselves prove the <20s extraction target.
4. Vercel's [4.5 MB function payload limit](https://vercel.com/docs/functions/limitations) includes the original file **plus all rendered pages**. Hosted clients check a conservative 4,400,000-byte budget before sending. Local/self-hosted mode supports originals up to 10 MB / 15 pages and requests up to 18 MB. The original specification's 10 MB upload promise cannot hold on this stateless Vercel architecture; larger uploads require a separately approved transport/storage design.
5. Optional: enable Web Analytics for this project in Vercel, then set `NEXT_PUBLIC_ENABLE_ANALYTICS=true`. Paths have session IDs/query strings removed; events contain no answers. Hobby supports page views but **custom events require Pro**; custom event collection is off in the current preview. Set `NEXT_PUBLIC_ENABLE_CUSTOM_EVENTS=true` only on a compatible plan. Set `NEXT_PUBLIC_CONTACT_URL` to your support URL.
6. Inspect your Vercel plan's [spend management](https://vercel.com/docs/spend-management) and your model provider's limit. Vercel Pro's automatic pause affects **every project in the team**. Do not change a shared team cap without accounting for its other projects. Hobby uses included free-tier limits. Demo mode makes zero runtime model calls.

## Validation

Latest production check (2026-09-17, Singapore): real Ark extraction **12.820s**, Chinese-to-English answer translation **4.623s**, and PDF export passed HTTP integration. All 10 native values and the rendered signature were verified; office fields stayed blank. This is one source, not a p95 estimate. See [production evidence](launch/ark-production-verification.json). The current system Chrome reached the live upload screen; full UI acceptance is waiting for the Mac to be unlocked.

```sh
pnpm test
pnpm typecheck
pnpm build
pnpm start
# In another terminal:
pnpm test:e2e
```

`PLAYWRIGHT_BASE_URL=https://your-host` runs browser tests against a deployed instance. Use `tests/e2e/complete.spec.ts` for the three download flows. Chromium uses installed Chrome; install WebKit with `pnpm exec playwright install webkit`. Safari all-controls keyboard navigation uses Option+Tab.

`tests/e2e/live-upload.spec.ts` separately exercises actual file upload and model extraction before filling and downloading each demo source. It is skipped unless `RUN_LIVE_UPLOAD=1` is set. Run one source/browser case at a time against a fresh local production server using the local in-memory limits; restarting does not reset Redis-backed limits. A live-enabled deployment can also be tested with public blank forms and synthetic answers; these runs consume its upload allowance and model resources. For example, start `pnpm exec next start --hostname 127.0.0.1 --port 3051`, then run:

```sh
RUN_LIVE_UPLOAD=1 PLAYWRIGHT_BASE_URL=http://127.0.0.1:3051 \
  pnpm exec playwright test tests/e2e/live-upload.spec.ts \
  --project=chromium --grep 'change-of-address:' --workers=1
```

This sends a public blank PDF to the configured model and consumes its resources. Each run saves its real extraction response, timing, final PDF and synthetic-answer verification under `test-results/` (or the supplied `--output` directory). The recorded live matrix is **5/6 passed**: the mobile WebKit school request hit the model's 300-second timeout. See [live-upload evidence](launch/live-upload-verification.json) and [release readiness](QUALITY.md).

For an additional public blank form, save it as `tmp/<name>.pdf`, start the separate production server on `127.0.0.1:3051`, then run `RUN_LIVE_UPLOAD=1 pnpm exec tsx scripts/verify-extra-browser.ts <name> <en|zh-CN|es|ja>`. This uploads the actual source in Chrome, saves its extracted schema and pauses for up to 20 minutes. Inspect the original and `tmp/extra-browser/<name>/schema.json`, then write `manual-answers.json` in that directory with `{ "schemaSha256": "<hash printed by the runner>", "answers": { "f0": { "value": "Alex" }, "f1": null } }`. Include every encountered field: `null` explicitly skips it; signatures use `{ "value": "Alex Rivera", "signedBy": "Alex Rivera" }`. Use synthetic data only. The runner verifies the schema hash, enters these answers through the UI, requires every non-null intended answer to be reached and saved, and downloads the PDF. Inspect every exported page before marking visual acceptance. Existing run directories are preserved: archive them before an intentional rerun. This workflow needs the local Poppler tools only for subsequent PDF rendering. For English forms with source instructions, set `VERIFY_SOURCE_HELP=1` to also open one explanation, assert that its displayed text matches the extracted source quote, and save a screenshot. Review that quote against the original yourself; the assertion checks UI transport, not OCR accuracy.

Latest local checks: **103 unit/API tests**, strict TypeScript and production build passed. Model repair uses nested validation paths; long-form signature and exclusive-choice references accept exact unique labels, reducing row-counting errors without relaxing source validation. See [Ark integration attempts](launch/ark-demo-verification.json) for current-provider successes and preserved failures. The extraction adapter preserves printed date formats, defaults unspecified dates to `YYYY-MM-DD`, and carries mutually exclusive checkbox groups into answer validation. Split dates interrupted by printed words/year prefixes become separate blanks; non-native checkbox marks are centered. Extraction skips read-only, hidden and zero-area native widgets. The extraction prompt excludes office-only inputs, but model output still needs source review; optional office fields in the latest Ark run were skipped and stayed blank; role-specific signatures may remain optional for the appropriate person. Impossible dependency values are rejected; conditions such as age are shown as optional fields with source instructions instead of hiding them behind unsupported expressions. Scanned instructions can now appear as bounded quotations from the page image, including in mixed text/scan documents. The reviewed scan also preserves initials blanks separately from nearby Yes/No choices; see [scan-help evidence](launch/scan-help-verification.json). Five additional actual Chrome uploads (three Spanish/English library forms, a native Tinley dog-license form and a genuine paper scan) passed question entry, signature, review, download and visual export checks; see [extra-browser evidence](launch/extra-browser-verification.json). A German source also produced a separately reviewed library/API export, with ten checkbox conflict/allowed-answer checks in [extra-form evidence](launch/extra-form-results.json). These checks remain separate from the earlier six-case browser matrix.

Recorded mobile Lighthouse on build `dcVIDd1qONvV0YFqIG2R0` (2026-09-17 CST): **97 performance / 100 accessibility**, without run warnings. Later changes affect server extraction. The latest targeted validation/source-explanation regressions passed in Chrome and mobile WebKit (2/2); they do not add new test cases. See [BUILD_LOG.md](BUILD_LOG.md), [quality metrics](launch/quality-metrics.json), and [extraction benchmark](launch/extraction-benchmark.json). Separate [native acceptance](launch/native-verification.json) passed all three exports in macOS Preview, the first five insurance questions with macOS VoiceOver, and real Chrome microphone input plus question speech. The user confirmed audible output. Automated speech tests use browser API mocks; the owner has selected current system Chrome for deployment acceptance instead of physical iPhone and Adobe Reader checks.

**Acceptance scope updated by the owner (2026-09-17):** Vercel production with Doubao, basic memory limits without Redis, GitHub source, and current system Chrome after deployment. Earlier device checks are retained as history, not requirements for this deployment. Extraction latency and the hosted 4.4 MB request budget remain explicit limitations. Launch media/submission are separate from this deployment.

## PDF output and privacy

- Native AcroForm fields are filled directly. Flat forms use text-layer anchors. Scans/photos use approximate boxes and need visual review. Chinese/Japanese/Arabic fonts are embedded; oversized answers are rejected rather than silently clipped.
- Signatures are attributed PNG images, not cryptographic certificate signatures. Linked signature dates fill only when empty. Flattening is opt-in.
- The application has no document database. Files and answers are processed in request memory and retained in the user's browser until cleared. Model-provider retention rules apply; local agent-im may retain runner sessions and image attachments outside this application. Browser speech services may use their own remote provider. No audio is uploaded by FormLilt.
- Demo assets are public third-party forms, documented in [sources](public/demo-forms/README.md). Test answers are synthetic and are never submitted to the issuing institutions. Source forms and bundled fonts retain their own licenses.

[Report an issue](https://github.com/DanielMax937/formlilt/issues) · [MIT license](LICENSE)
