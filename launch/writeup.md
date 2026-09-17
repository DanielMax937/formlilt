# Building FormLilt with GPT-6 Astra

## What was built

FormLilt turns a PDF form into a guided workflow: deterministic question order, dependent and mutually exclusive fields, validation, multilingual questions, optional browser speech, signatures, review, and PDF/JSON/text output. Browser storage supports refresh/resume and explicit clearing. An optional local profile suggests saved values after the user opts in and chooses to use them.

The application uses Next.js 15, React 19, strict TypeScript, Zod, the Vercel AI SDK, unpdf/PDF.js, pdf-lib and embedded Noto fonts. It has no account system or document database. The owner selected Vercel, Doubao Seed 2.0 Pro and basic memory limits without Redis. Quotas apply per server instance and can reset. Provider retention policies apply to uploaded pages and relevant translation inputs; browser speech may use the browser vendor's services.

## How Astra contributed

The supplied spec was implemented in task commits beginning with T0. [BUILD_LOG.md](../BUILD_LOG.md) and the repository history record changes, validation, failures and unresolved requirements. The fifth gallery image renders actual history and measured results. Actual Astra conversation captures remain pending; the rendered evidence image is not a chat screenshot.

The model adapter initially used the owner's agent-im OpenAI-compatible service. Astra and GPT-5.6 Luna generated the checked-in demo schemas and questions. The owner later selected Doubao Seed 2.0 Pro (`doubao-seed-2-0-pro-260215`) through Volcano Engine Ark for live extraction and translation. Its key is ignored locally and stored as a server-only Sensitive variable on Vercel. The adapter supports changing providers through server environment variables.

## Engineering decisions

- Deterministic navigation advances immediately while model wording and explanation arrive asynchronously. A truncated-stream check and explicit deadlines keep interrupted replies from appearing successful.
- Model outputs pass Zod validation and source grounding. Named rows and exact-label references reduce row-index mistakes on long forms; one repair attempt handles malformed output without accepting unvalidated JSON.
- Repeated PDF table fields align to actual painted cells only when source geometry and field counts agree. Visual review caught errors that text/value checks alone missed.
- Eligible two-page text PDFs use two concurrent requests, each retaining the complete document context. Page ownership, references and primary-signature roles are checked before merging. The page stage has a 120-second cap within the 280-second overall budget, preserving time for a whole-document fallback.
- Scans use approximate overlays and bounded quotations from the image. Real scan testing caught initials blanks incorrectly treated as checkboxes. Split printed date components remain separate fields; otherwise an unspecified date format defaults to `MM/DD/YYYY`.
- PDF rendering required fixes for CJK subset-font alignment, native radio recognition in minified builds, and duplicate-label placement. WebKit required storing original bytes and metadata in IndexedDB instead of relying on a File clone.
- Hosting constraints affect behavior: the deployed prepared-upload budget is 4.4 MB, and functions run in Singapore after earlier Hong Kong connection failures. Vercel Hobby custom analytics events remain disabled; page views are enabled.

## Verified behavior

| Scope | Evidence |
| --- | --- |
| Local code checks | 146 unique unit/API cases verified. The initial parallel run passed 144 and timed out in two PDF tests; a single-worker rerun passed all 17 cases in those files under the original deadline. Strict TypeScript and production builds passed. |
| Current Tinley browser flow | On `346f652`, actual system Chrome uploaded the source, answered all 10 questions, signed, reviewed and downloaded. All native PDF values matched and office fields stayed blank. The date appeared as `09/17/2026`. An initial JSON failure recovered through the existing repair. [Evidence](ark-date-default-verification.json). |
| Complex school browser flow | On `a112a3c`, actual Chrome extracted 103 fields, entered 35 synthetic answers covering all 24 required fields, signed, reviewed and downloaded. Both pages passed visual inspection, including seven selected table cells. This covers selected/required inputs, not entry of every question. [Evidence](ark-chrome-school-verification.json). |
| Earlier translation check | The current-Chrome Tinley session confirmed a Chinese-to-English value and exported matching native fields after the interrupted-stream fix. It continued an existing session across deployments. [Evidence](ark-chrome-verification.json). |
| Demo and accessibility checks | Three precomputed demo flows passed Chromium and mobile WebKit. The recorded local mobile Lighthouse result is 97 performance / 100 accessibility. Native VoiceOver passed the first five questions; the user confirmed real Chrome microphone input and app speech. These records retain their original build/provider scope. [Metrics](quality-metrics.json), [native evidence](native-verification.json). |
| Additional sources | Five real PDF browser flows passed with the earlier provider, including two Spanish sources, native fields, flat text and a genuine scan. A separate six-case upload matrix passed five; the school mobile-WebKit request timed out. [Additional forms](extra-browser-verification.json), [matrix](live-upload-verification.json). |

## Limits and unfinished work

Uncached extraction p95 <20 seconds is not met. A direct production school request took 79.674 seconds on `a112a3c`; this is one sample. The later successful Chrome school run confirmed the page-pair path but did not measure exact API latency or exercise stalled-pair recovery. An earlier Chrome timeout is preserved. [Fallback-budget evidence](ark-fallback-budget-verification.json).

Faster experiments are not automatically safer. Source/coordinate partitioning produced misplaced or invented inputs. A later grid-template prototype expanded eight templates into all 40 table cells, but lost second-page sections and made the guardian signature optional. Its full result still took 59.917 seconds. Neither failed strategy was adopted. [Partition evidence](ark-source-partition-probes.json), [compression evidence](ark-grid-compression-probe.json).

The hosted upload limit differs from the spec's 10 MB original-file target. A real phone photograph remains untested. Earlier physical-iPhone/Adobe Reader requirements were superseded by the owner's system-Chrome deployment scope. Current acceptance does not prove arbitrary-form accuracy.

The media pack contains five gallery images, a keyboard GIF and a 60-second captioned keyboard/demo video without audio. Actual upload/voice footage and Astra conversation captures remain outstanding. No speech transcript or chat image was fabricated. Product-owner release acceptance and contest eligibility are pending. The owner authorized an online Product Hunt review draft, which is saved and verified as unscheduled. It contains the prepared text and five existing images; saving it does not establish challenge enrollment. [Media pack](README.md), [contest check](contest-check.md).

## Links

- [Live app](https://formlilt.vercel.app)
- [MIT-licensed source](https://github.com/DanielMax937/formlilt)
- [Original requirements](../SPEC.md) — FillFlow was the working codename.
- [Release readiness and limitations](../QUALITY.md)
