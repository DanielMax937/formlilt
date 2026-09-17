# Maker comment — draft

Hi Product Hunt — I’m building FormLilt to make paperwork easier to work through.

A form can ask for ordinary information in surprisingly confusing ways. FormLilt turns the blank document into a sequence of questions, keeps track of what is missing, lets you inspect the form’s own instructions, and puts your answers and signature back into the original PDF.

You can upload a small PDF or photo, or try three ready-to-use forms: an address change, an insurance claim, and a school medical authorization. No account is needed. There are four interface languages, a keyboard path, optional browser speech, and an opt-in profile stored on your device.

A few details I want to be clear about:

- Progress is saved in your browser until you clear it. The application has no document database.
- Public demos are precomputed. Live uploads and translated-answer confirmation now use Doubao Seed 2.0 Pro. Prepared uploads have a 4.4 MB limit; basic rate limits apply per server instance.
- Model-provider retention policies apply to uploaded pages and translated answers. Browser speech may use the browser vendor’s services.
- Scanned-form placement needs visual review. Signatures are images, and the receiving organization decides what it accepts.

Built with GPT-6 Astra (agent) · Powered by Doubao Seed 2.0 Pro through Volcano Engine Ark. The app uses Next.js, pdf-lib, and an OpenAI-compatible model adapter. Source is MIT licensed.

**Which blank form would you most like me to test next — and which question on it is hardest to understand?**
