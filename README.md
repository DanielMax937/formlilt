# FillFlow

Turn a PDF form into a guided conversation. Next.js 15, React 19, strict TypeScript.

## Local development

```sh
pnpm install
cp .env.example .env.local
pnpm dev
```

Open http://localhost:3050. Start agent-im separately at port 3300 with its Codex runner signed in. Demo forms will work without model calls.

## LLM configuration

Default: `LLM_PROVIDER=agent-im`, OpenAI-compatible `/v1/chat/completions`, model `codex-login/gpt-6-astra`. Change base URL, key and model in server-only `.env.local`. Switch to `openai` or `doubao` via `LLM_PROVIDER` and the corresponding environment variables. Never put credentials in `NEXT_PUBLIC_*` variables.

## Validation

`pnpm test` · `pnpm typecheck` · `pnpm build` · `pnpm test:e2e`

See [SPEC.md](SPEC.md) for requirements and [BUILD_LOG.md](BUILD_LOG.md) for verified progress.

## Privacy

FillFlow has no document database. Files stay in browser IndexedDB and answers in localStorage until cleared. Uploaded documents are sent to the configured model provider for extraction; answers may be sent for translation or explanation. Provider retention rules apply. In agent-im development mode, the local runner may retain conversation files. Do not use the local demo deployment for sensitive real documents until its retention settings have been reviewed.

## Deployment

Target: Vercel Node runtime, region hkg1. Public deployments require a reachable model API and Upstash Redis. `127.0.0.1` only works on the developer machine; it cannot reach agent-im from Vercel. Deployment validation will be documented when available.
