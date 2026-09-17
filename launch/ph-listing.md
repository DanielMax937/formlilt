# Product Hunt listing draft

**Name:** FormLilt  
**Tagline:** Fill PDF forms one question at a time  
**Topics:** Productivity · Artificial Intelligence · Inclusivity (Product Hunt’s current result for Accessibility; GitHub is also attached by its open-source setting)
**Website:** https://formlilt.vercel.app  
**Source:** https://github.com/DanielMax937/formlilt

## Description

Answer a form one question at a time, check its instructions, add your signature, and download the filled PDF. Four interface languages, keyboard controls, and optional browser speech. Try three real forms without an account, or upload your own small PDF or photo. Live extraction and answer translation use Doubao Seed 2.0 Pro.

## Accurate launch positioning

The public Vercel site has live uploads and answer translation enabled. Current system Chrome passed a complete 10-question Tinley upload/sign/review/PDF flow on deployment `346f652`. It also passed a two-page school flow on `a112a3c`: 103 extracted fields, 35 synthetic answers covering all 24 required fields, typed signature, review and download. Both school PDF pages passed visual review; this does not mean all 103 questions were answered. Earlier timeouts and the date run's successful JSON repair remain recorded in the linked evidence.

Complex extraction remains slow. A recent direct production school request took 79.674 seconds; the browser check did not measure exact API latency. The p95 <20-second target is not met. Prepared-upload requests are limited to 4.4 MB, basic quotas apply per server instance, and scan placement needs review. Do not claim arbitrary-form accuracy or untested device compatibility. See [release readiness](../QUALITY.md), [school acceptance](ark-chrome-school-verification.json) and [date/default acceptance](ark-date-default-verification.json).

Built with GPT-6 Astra (agent) · Powered by Doubao Seed 2.0 Pro (`doubao-seed-2-0-pro-260215`) via Volcano Engine Ark. Precomputed demo assets were generated earlier with Astra and GPT-5.6 Luna through agent-im. The model adapter remains switchable through server environment variables.

## Contest and schedule

The [official announcement](https://www.producthunt.com/p/producthunt/product-hunt-teams-up-with-openaidevs-for-the-gpt-6-astra-challenge) confirms September 18, 2026 as the challenge launch date. The spec's September 17 submission deadline and 00:01 Pacific launch time remain planning targets; an available slot and full entry conditions have not been verified in the authenticated form. See [official-source check](contest-check.md).

## Review and submission status

- Review [QUALITY.md](../QUALITY.md) and decide how to handle the unmet speed target and remaining release gates.
- Review the [media pack](README.md). The existing GIF uses keyboard input; the 60-second captioned video is a silent draft. Actual upload/voice footage and 3–5 Astra conversation captures are still missing.
- The owner authorized saving a review draft. [The saved editor](https://www.producthunt.com/posts/formlilt/edit) has been reopened and checked; see [verification](ph-draft-verification.json).
- Approve the final claims, assets and launch details before public submission.

The Product Hunt product is saved as an unscheduled draft, with first-comment text stored and visible in its preview. No separate Comment or Schedule action was taken; no email or social update was sent. Saving this general product draft does not establish challenge enrollment or private visibility.
