# FormLilt

A PDF form assistant: answer one question at a time, sign, review, and download the filled original. Built with GPT-6 Astra. Next.js 15, React 19, strict TypeScript, MIT.

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2FDanielMax937%2Fformlilt&project-name=formlilt)

[Live preview](https://formlilt.vercel.app) · [Release readiness](QUALITY.md)

Vercel deployments default to **demo mode**. Three checked-in public forms work without model credentials: address change, insurance claim and school medical authorization. Uploads and answer translation are explicitly disabled in that preview; answers are used as written. No account is required.

## Run locally

Requirements: Node.js 22+, pnpm 10, and a running agent-im instance for uploads or translation.

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

The checked-in Vercel config uses Node functions in **hkg1**, with route `maxDuration=60`. `.env.local` is excluded from Git and deployments.

To enable live uploads after validation:

1. Configure a **publicly reachable** model endpoint and server-only key. Vercel cannot access your computer's `127.0.0.1`. Do not expose an unauthenticated agent-im runner to the Internet.
2. Set `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN`. Hosted live endpoints fail closed without Redis; local development uses an in-memory limiter. Default extraction allowance is 3 per rolling 24 hours/IP; checked-in demo schemas are verified before exemption.
3. Set `NEXT_PUBLIC_DEMO_ONLY=false` and redeploy. Set the model timeout below the chosen function duration (for this 60s deployment use at most 55000 ms), then verify extraction p95 against the target. The current local agent-im takes **64–268 seconds for the demo sources**, and a six-page W-9 timed out at 300 seconds; it does **not** meet the <20s target.
4. Vercel's [4.5 MB function payload limit](https://vercel.com/docs/functions/limitations) includes the original file **plus all rendered pages**. Hosted clients check a conservative 4,400,000-byte budget before sending. Local/self-hosted mode supports originals up to 10 MB / 15 pages and requests up to 18 MB. The original specification's 10 MB upload promise cannot hold on this stateless Vercel architecture; larger uploads require a separately approved transport/storage design.
5. Optional: enable Web Analytics for this project in Vercel, then set `NEXT_PUBLIC_ENABLE_ANALYTICS=true`. Paths have session IDs/query strings removed; events contain no answers. Hobby supports page views but **custom events require Pro**; custom event collection is off in the current preview. Set `NEXT_PUBLIC_ENABLE_CUSTOM_EVENTS=true` only on a compatible plan. Set `NEXT_PUBLIC_CONTACT_URL` to your support URL.
6. Inspect your Vercel plan's [spend management](https://vercel.com/docs/spend-management) and your model provider's limit. Vercel Pro's automatic pause affects **every project in the team**. Do not change a shared team cap without accounting for its other projects. Hobby uses included free-tier limits. Demo mode makes zero runtime model calls.

## Validation

```sh
pnpm test
pnpm typecheck
pnpm build
pnpm start
# In another terminal:
pnpm test:e2e
```

`PLAYWRIGHT_BASE_URL=https://your-host` runs browser tests against a deployed instance. Use `tests/e2e/complete.spec.ts` for the three download flows. Chromium uses installed Chrome; install WebKit with `pnpm exec playwright install webkit`. Safari all-controls keyboard navigation uses Option+Tab.

`tests/e2e/live-upload.spec.ts` separately exercises actual file upload and model extraction before filling and downloading each demo source. It is skipped unless `RUN_LIVE_UPLOAD=1` is set. Run one source/browser case at a time against a fresh local production server using the local in-memory limits; restarting does not reset Redis-backed limits. Do not run it against the public demo-only deployment. For example, start `pnpm exec next start --hostname 127.0.0.1 --port 3051`, then run:

```sh
RUN_LIVE_UPLOAD=1 PLAYWRIGHT_BASE_URL=http://127.0.0.1:3051 \
  pnpm exec playwright test tests/e2e/live-upload.spec.ts \
  --project=chromium --grep 'change-of-address:' --workers=1
```

This sends a public blank PDF to the configured model and consumes its resources. Each run saves its real extraction response, timing, final PDF and synthetic-answer verification under `test-results/` (or the supplied `--output` directory). The recorded live matrix is **5/6 passed**: the mobile WebKit school request hit the model's 300-second timeout. See [live-upload evidence](launch/live-upload-verification.json) and [release readiness](QUALITY.md).

For an additional public blank form, save it as `tmp/<name>.pdf`, start the separate production server on `127.0.0.1:3051`, then run `RUN_LIVE_UPLOAD=1 pnpm exec tsx scripts/verify-extra-browser.ts <name> <en|zh|es|ja>`. This uploads the actual source in Chrome, saves its extracted schema and pauses for up to 20 minutes. Inspect the original and `tmp/extra-browser/<name>/schema.json`, then write `manual-answers.json` in that directory with `{ "schemaSha256": "<hash printed by the runner>", "answers": { "f0": { "value": "Alex" }, "f1": null } }`. Include every encountered field: `null` explicitly skips it; signatures use `{ "value": "Alex Rivera", "signedBy": "Alex Rivera" }`. Use synthetic data only. The runner verifies the schema hash, enters these answers through the UI and downloads the PDF. Inspect every exported page before marking visual acceptance. Existing run directories are preserved: archive them before an intentional rerun. This workflow needs the local Poppler tools only for subsequent PDF rendering.

Latest local checks: **77 unit/API tests**, strict TypeScript and production build passed. The extraction adapter preserves printed date formats, defaults unspecified dates to `YYYY-MM-DD`, and carries mutually exclusive checkbox groups into answer validation. Split dates interrupted by printed words/year prefixes become separate blanks; non-native checkbox marks are centered. Two additional actual Chrome uploads (Spanish and English library forms) passed question entry, signature, review, download and visual export checks; see [extra-browser evidence](launch/extra-browser-verification.json). A German source also produced a separately reviewed library/API export, with ten checkbox conflict/allowed-answer checks in [extra-form evidence](launch/extra-form-results.json). These checks remain separate from the earlier six-case browser matrix.

Mobile Lighthouse measured on 2026-09-16: **99 performance / 100 accessibility**; it was not rerun after the extraction follow-up. See [BUILD_LOG.md](BUILD_LOG.md), [quality metrics](launch/quality-metrics.json), and [extraction benchmark](launch/extraction-benchmark.json). Separate [native acceptance](launch/native-verification.json) passed all three exports in macOS Preview, the first five insurance questions with macOS VoiceOver, and real Chrome microphone input plus question speech. The user confirmed audible output. Automated speech tests use browser API mocks; physical iPhone acceptance remains open.

**Release gates still open:** uncached extraction speed, five extra real PDFs including a scan, a real phone photo, physical iPhone speech/VoiceOver, Adobe Reader, and product-owner acceptance. These are not represented as passed.

## PDF output and privacy

- Native AcroForm fields are filled directly. Flat forms use text-layer anchors. Scans/photos use approximate boxes and need visual review. Chinese/Japanese/Arabic fonts are embedded; oversized answers are rejected rather than silently clipped.
- Signatures are attributed PNG images, not cryptographic certificate signatures. Linked signature dates fill only when empty. Flattening is opt-in.
- The application has no document database. Files and answers are processed in request memory and retained in the user's browser until cleared. Model-provider retention rules apply; local agent-im may retain runner sessions and image attachments outside this application. Browser speech services may use their own remote provider. No audio is uploaded by FormLilt.
- Demo assets are public third-party forms, documented in [sources](public/demo-forms/README.md). Test answers are synthetic and are never submitted to the issuing institutions. Source forms and bundled fonts retain their own licenses.

[Report an issue](https://github.com/DanielMax937/formlilt/issues) · [MIT license](LICENSE)
