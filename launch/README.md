# FormLilt launch review pack

Prepared from the actual local production build, using synthetic answers. The website is currently a **demo preview**. Check [release readiness](../QUALITY.md) before publishing.

[Native acceptance evidence](native-verification.json) records the three PDF exports in macOS Preview, the first five insurance questions with real macOS VoiceOver, and real Chrome microphone input and question speech confirmed by the user. Physical iPhone and Adobe Reader checks remain open.

## Visual assets

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

No Product Hunt submission, scheduled launch, comment, email or social post was sent. The video deliverable is the requested script; no finished narrated 60-second video is claimed. Product-owner acceptance is pending.
