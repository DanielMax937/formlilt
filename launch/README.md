# FormLilt launch review pack

Prepared from the actual local production build, using synthetic answers. The website now has **live Ark uploads and translation**. These existing visual assets were captured earlier and retain their original demo/keyboard labels. Check [release readiness](../QUALITY.md) before publishing.

[Native acceptance evidence](native-verification.json) records the three PDF exports in macOS Preview, the first five insurance questions with real macOS VoiceOver, and real Chrome microphone input and question speech confirmed by the user. These historical checks are separate from the owner’s current-system-Chrome deployment acceptance.

[Real upload acceptance](live-upload-verification.json): 5/6 local browser cases passed through agent-im without extraction mocks. The mobile WebKit school request timed out during model extraction; that release gate remains open.

[Scanned-source explanation follow-up](scan-help-verification.json) records a real upload, visible source quote and 16 synthetic applicant answers through signature/date and PDF download. Its first semantic failure remains recorded; this repeats one of the five reviewed sources rather than adding a sixth.

[Ark three-form integration attempts](ark-demo-verification.json) record the current provider’s schema/source checks, failures and latency limits. These are API/library checks, not native Chrome or PDF visual acceptance.

[Live Ark deployment evidence](ark-production-verification.json) records the Singapore HTTP extraction, translation and PDF export checks. [Synthetic exported PDF](ark-production-filled.pdf) passed native-value and visual review. [Current system Chrome acceptance](ark-chrome-verification.json) passed actual Tinley upload, all 10 questions, drawn signature, review, translated-answer confirmation and download, with the same saved session continued after the timeout fix. [Final synthetic PDF](ark-chrome-filled.pdf). [Deployment follow-up](ark-deployment-followup.json) records earlier translation success, school-form failure and unadopted output-mode experiments. [Object-row and placement follow-up](ark-object-extraction.json) records the subsequent 103-field production extraction and visually reviewed [synthetic school export](ark-school-filled.pdf), including its initial placement failure.

## Visual assets

- [60-second captioned review draft](formlilt-demo-draft.mp4) — actual local demo UI, H.264, 1440×1120, 25 fps, 2.37 MB. No audio. Keyboard answers, source explanation, skip/return, pointer-drawn test signature, linked date and PDF download. Live-upload/voice footage still needs recording; this is not complete §2.3 acceptance.
- [Video captions](formlilt-demo-draft.srt), [video provenance](video-manifest.json), [actual PDF from the video](video-sample-insurance.pdf).

- [8-second GIF](formlilt-demo.gif) — 1000×694, 207 KB, exactly 8.0 seconds. Real homepage → demo → typed answer → next question. It does not simulate voice recognition or live extraction.
- [01 · Guided workspace](screenshots/01-guided-workspace.png)
- [02 · Explanation from the source](screenshots/02-source-explanation.png)
- [03 · Signature](screenshots/03-signature.png)
- [04 · Review and download](screenshots/04-review-and-download.png)
- [05 · Build evidence](screenshots/05-build-evidence.png) — a rendered view of actual Git history and verified metrics; not a screenshot of an Astra conversation.
- [Filled insurance sample](sample-filled-insurance.pdf) — fake test details, never submitted to any institution.

All gallery images are 1440×1000. Capture metadata is in [capture-manifest.json](capture-manifest.json); the reproducible script is [capture-launch.ts](../scripts/capture-launch.ts). The fifth image's source is [build-evidence.html](build-evidence.html).

## Text drafts

- [Listing, tagline and owner checklist](ph-listing.md)
- [60-second video script](video-script.md)
- [Maker comment](maker-comment.md)
- [FAQ replies](faq.md)
- [Build writeup](writeup.md)

The owner-authorized Product Hunt review draft is saved and unscheduled, with the prepared first-comment text stored in its preview. No separate Comment or Schedule action, email or social post was sent. The captioned video is a review draft with explicit keyboard/demo labels and a marked jump cut. No narrated or live-upload/voice video is claimed. Product-owner acceptance is pending.

## Reproduce the video draft

With the local production app running on port 3050, installed Chrome and FFmpeg available:

```sh
node --import tsx scripts/record-demo-video.ts
node --import tsx scripts/render-demo-video.ts tmp/demo-video-<timestamp-printed-by-recorder>
```

The recorder creates the session through the real demo UI and completes all actions through controls; it does not inject application state or mock requests/speech. Raw video and chapter screenshots stay under ignored `tmp/`. The renderer adds the draft label and captions, omits the other required-answer/optional-skip actions at an explicit jump cut, and checks the encoded 60-second duration. It writes the MP4, SRT, sample PDF and provenance under `launch/`. This is media verification, not another uncached-extraction or physical-device acceptance run.

[Isolated Ark parallel-extraction probes](ark-parallel-probes.json) record a 49.693-second two-page result and a rejected eight-region experiment. The [synthetic local PDF](ark-parallel-school-filled.pdf) passed two-page visual review. These isolated results do not establish the latency gate. The two-page approach was later integrated and deployed; [production follow-up](ark-page-pair-verification.json) records 77.397s extraction, a new 103-field schema and the visually reviewed [synthetic export](ark-page-pair-school-filled.pdf).

The separate system-Chrome school upload on that deployment timed out with HTTP 502 (`TimeoutError`). The localized retry screen recovered correctly, but no schema or PDF came from that browser attempt. This failure is preserved in `ark-page-pair-verification.json`; the successful HTTP/PDF check is not a substitute for it.

[Fallback time reservation](ark-fallback-budget-verification.json) records the subsequent 120-second page-pair cap within the unchanged 280-second total budget, 145 passing tests/builds and a direct production extraction in 79.674s. That request did not exercise fallback. After unlock, [current system-Chrome school verification](ark-chrome-school-verification.json) passed real upload, 103-field extraction, selected/required answers, typed signature, review and download. Both pages of the [synthetic browser export](ark-chrome-school-filled.pdf) passed Poppler and Chrome visual inspection. The [unmodified UI-exported answer record](ark-chrome-school-answers.json) contains only synthetic data. This request used the page pair directly, so stalled extraction fallback recovery remains unproven.

[Rejected source-partition experiments](ark-source-partition-probes.json) compare ordinary JSON, Schema-guided and explicit-strict requests using the same public blank source/model. Small probes passed, but full-form runs failed structural or source-fidelity checks; none changed production or established the latency gate.

[Date-default conformance](ark-date-default-verification.json) records deployment `346f652`, the restored SPEC `MM/DD/YYYY` default, 146 verified cases and a fresh real Chrome Tinley flow. All 10 answers and native PDF values passed, with a preserved initial JSON failure followed by successful repair. [Synthetic PDF](ark-date-default-filled.pdf) · [Actual UI answer export](ark-date-default-answers.json).

[Source-grid compression probe](ark-grid-compression-probe.json) records an unadopted 59.917-second local result. Eight templates preserve 40 table cells, but second-page section/signature metadata failed review. Production and its Chrome acceptance remain unchanged; this sample does not establish p95.

[Official contest check](contest-check.md) verifies the announced launch date and records the initially rejected write, subsequent explicit owner authorization and saved unscheduled draft. Listing, FAQ and writeup now reflect the successful current-Chrome school and date-default checks while retaining failed attempts and open latency/media gates.

[Saved Product Hunt draft verification](ph-draft-verification.json) records the actual system-Chrome create-and-reopen check. [Edit the draft](https://www.producthunt.com/posts/formlilt/edit). Video remains blank; five existing gallery images are saved.
