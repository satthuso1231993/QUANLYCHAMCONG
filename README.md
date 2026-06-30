<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://ai.google.dev/static/site-assets/images/share-ais-513315318.png" />
</div>

# Run and deploy your AI Studio app

This contains everything you need to run your app locally.

View your app in AI Studio: https://ai.studio/apps/f7937a28-db83-4ccc-a79d-e7da4bc125b1

## Run Locally

**Prerequisites:**  Node.js


1. Install dependencies:
   `npm install`
2. Set the `GEMINI_API_KEY` in [.env.local](.env.local) to your Gemini API key
3. Run the app:
   `npm run dev`

## ONLYOFFICE Word Editor

The report editor now includes a web-embedded Word-like mode powered by ONLYOFFICE.

- Frontend entrypoint: `src/components/OnlyOfficeEditorModal.tsx`
- Config helper: `src/lib/onlyOffice.ts`
- Main integration notes: `docs/onlyoffice-integration.md`

Required environment variables:

```env
VITE_ONLYOFFICE_DOCUMENT_SERVER_URL="https://your-onlyoffice-docs.example.com"
VITE_ONLYOFFICE_CONFIG_ENDPOINT="/api/onlyoffice/config"
```

Note:

- The React app now opens the embedded editor UI, but you still need a backend endpoint that returns the ONLYOFFICE config and a callback endpoint that saves document updates.
- See `docs/onlyoffice-integration.md` for the request/response contract and deployment checklist.
