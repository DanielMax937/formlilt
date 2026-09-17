# FAQ reply drafts

**Where is my data stored?**  
Your browser retains files, answers, signatures, and any optional profile until you clear them. The application has no document database. Uploaded pages and relevant translation inputs go to your configured model provider, whose retention policy applies. Local agent-im may retain runner sessions and attachments outside the app.

**Can I upload my own PDF?**  
Yes. The live site supports PDF/JPG/PNG/HEIC input and up to 15 pages, with a 4.4 MB prepared-upload request limit. Large forms may need splitting. Three ready-to-use forms are also available. Local/self-hosted mode supports original files up to 10 MB. Complex live forms remain experimental: the reviewed school sample now passes production extraction and PDF visual checks, but took about 102 seconds. The three precomputed demos remain available.

**Does it work with scanned forms or photos?**  
The implementation supports visual extraction and approximate overlay placement. Review the downloaded PDF. A real phone-photo acceptance test is still outstanding.

**Which languages are available?**  
The interface supports English, Simplified Chinese, Spanish and Japanese. Demo questions are precomputed in those languages. Live model-assisted answer translation asks you to confirm the translated value before using it.

**Can I use a keyboard or screen reader?**  
Keyboard completion and automated accessibility audits pass in Chrome and mobile WebKit. Safari's all-controls navigation uses Option+Tab. The first five insurance questions passed with real macOS VoiceOver and keyboard input, with the user confirming clear question and control names. Real desktop Chrome microphone input and app speech also passed. Those earlier checks do not establish physical iPhone compatibility. The owner selected current system Chrome for the new deployment acceptance; that Tinley UI flow now passes, including confirmed Chinese-to-English translation and a visually reviewed download. A timeout found during acceptance was fixed; failures and deployment provenance are preserved in `ark-chrome-verification.json`.

**Is this a certified digital signature?**  
No. It places a signature image with the entered signer name. It does not issue a signing certificate or automatically submit anything to an institution.

**Is it open source? Will it cost money?**  
The app is MIT licensed. There is no user payment flow or announced paid plan. Hosting currently uses Vercel Hobby; live model requests consume the deployment owner’s Ark resources. Basic memory limits are per instance and can reset, so they do not guarantee a global daily quota. Self-hosted model usage follows the provider’s terms and billing.

**How fast is it?**  
The precomputed demos open without model extraction. In one production test on the Singapore node, a one-page form extracted in 12.820 seconds and a Chinese answer translated in 4.623 seconds. This is not a p95 estimate or a guarantee for larger forms. Local Ark tests of the three two-page samples took about 29–204 seconds after reference repairs; larger forms remain slow. The earlier agent-im implementation took 64–268 seconds on its initial samples; those historical timings describe a different provider.

**Can it tell me how to minimize taxes or choose medical treatment?**  
It is designed to explain the form's own text and collect your answers. Professional judgment questions need a qualified professional.
