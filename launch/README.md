# FormLilt launch review pack

Prepared from the actual local production build, using synthetic answers. The website is currently a **demo preview**. Check [release readiness](../QUALITY.md) before publishing.

[Native acceptance evidence](native-verification.json) records the three PDF exports in macOS Preview, the first five insurance questions with real macOS VoiceOver, and real Chrome microphone input and question speech confirmed by the user. Physical iPhone and Adobe Reader checks remain open.

[Real upload acceptance](live-upload-verification.json): 5/6 local browser cases passed through agent-im without extraction mocks. The mobile WebKit school request timed out during model extraction; that release gate remains open.

[Scanned-source explanation follow-up](scan-help-verification.json) records a real upload, visible source quote and 16 synthetic applicant answers through signature/date and PDF download. Its first semantic failure remains recorded; this repeats one of the five reviewed sources rather than adding a sixth.

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

No Product Hunt submission, scheduled launch, comment, email or social post was sent. The captioned video is a review draft with explicit keyboard/demo labels and a marked jump cut. No narrated or live-upload/voice video is claimed. Product-owner acceptance is pending.

## Reproduce the video draft

With the local production app running on port 3050, installed Chrome and FFmpeg available:

```sh
node --import tsx scripts/record-demo-video.ts
node --import tsx scripts/render-demo-video.ts tmp/demo-video-<timestamp-printed-by-recorder>
```

The recorder creates the session through the real demo UI and completes all actions through controls; it does not inject application state or mock requests/speech. Raw video and chapter screenshots stay under ignored `tmp/`. The renderer adds the draft label and captions, omits the other required-answer/optional-skip actions at an explicit jump cut, and checks the encoded 60-second duration. It writes the MP4, SRT, sample PDF and provenance under `launch/`. This is media verification, not another uncached-extraction or physical-device acceptance run.
