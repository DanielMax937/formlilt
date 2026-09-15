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
