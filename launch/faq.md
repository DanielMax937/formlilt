# FAQ reply drafts

**Where is my data stored?**  
Your browser retains files, answers, signatures, and any optional profile until you clear them. The application has no document database. Uploaded pages and relevant translation inputs go to your configured model provider, whose retention policy applies. Local agent-im may retain runner sessions and attachments outside the app.

**Can I upload my own PDF?**  
The local version supports PDF/JPG/PNG/HEIC input, up to 10 MB and 15 pages. The current public preview offers three ready-to-use forms. Live hosting needs a reachable model service and quota storage; the Vercel request-size limit also applies.

**Does it work with scanned forms or photos?**  
The implementation supports visual extraction and approximate overlay placement. Review the downloaded PDF. A real phone-photo acceptance test is still outstanding.

**Which languages are available?**  
The interface supports English, Simplified Chinese, Spanish and Japanese. Demo questions are precomputed in those languages. Local model-assisted answer translation requires confirmation. Public-preview answers are used as written.

**Can I use a keyboard or screen reader?**  
Keyboard completion and automated accessibility audits pass in Chrome and mobile WebKit. Safari's all-controls navigation uses Option+Tab. Physical VoiceOver and iPhone microphone checks remain open, so we are not claiming that they have passed.

**Is this a certified digital signature?**  
No. It places a signature image with the entered signer name. It does not issue a signing certificate or automatically submit anything to an institution.

**Is it open source? Will it cost money?**  
The app is MIT licensed. The current preview is free on Vercel Hobby and makes no live model calls. There is no payment flow or announced paid plan. Self-hosted model usage follows your provider's terms and billing.

**How fast is it?**  
The precomputed demos open without model extraction. Local normal-turn p95 was 8 ms; uncached model extraction took 64–268 seconds on the initial samples and later real forms timed out at 300 seconds. Improving that latency is an open release gate.

**Can it tell me how to minimize taxes or choose medical treatment?**  
It is designed to explain the form's own text and collect your answers. Professional judgment questions need a qualified professional.
