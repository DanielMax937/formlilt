# Maker comment — draft

Hi Product Hunt — I’m building FormLilt to make paperwork easier to work through.

A form can ask for ordinary information in surprisingly confusing ways. FormLilt turns the blank document into a sequence of questions, keeps track of what is missing, lets you inspect the form’s own instructions, and puts your answers and signature back into the original PDF.

You can try three real forms in the public preview: an address change, an insurance claim, and a school medical authorization. No account is needed. There are four interface languages, a keyboard path, optional browser speech, and an opt-in profile stored on your device.

A few details I want to be clear about:

- Progress is saved in your browser until you clear it. The application has no document database.
- Public demos are precomputed. Uploads and live translation work in the configured local version; extraction is still too slow for the production target.
- Model-provider retention policies apply to local uploads. Browser speech may use the browser vendor’s services.
- Scanned-form placement needs visual review. Signatures are images, and the receiving organization decides what it accepts.

Built with GPT-6 Astra, using Next.js, pdf-lib, and an OpenAI-compatible agent-im integration. Source is MIT licensed.

**Which blank form would you most like me to test next — and which question on it is hardest to understand?**
