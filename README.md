# AI Election Errors

Public report form: people report AI tools giving wrong election information in everyday use
(stale training data, bot-farm or forum sources, made-up facts). Started 2026-09-24 to catalogue
real-world, in-the-wild instances for regulators, press and researchers.

- **Live:** https://ai-election-errors.vercel.app
- **Stack:** one static page (`report-ai-election-error.html`, served at `/` by a rewrite in
  `vercel.json`), `report-form.js`, and two Vercel functions in `api/`. No framework. The only
  build step is the vendored upload helper (`npm run build:client`, output committed; CI checks it
  is current).
- **Storage:** a private Vercel Blob store connected to the project. Nothing in it is publicly
  readable. Each report is `reports/<yyyy>/<mm>/<id>.json`; attachments are
  `attachments/<report id>/<file>`. `npm run export` pulls every report into `exports/` as JSONL
  and CSV for loading into a database or spreadsheet.
- **One list of fields:** `lib/schema.js` feeds both the form's choices and the server's checks.
  Change a field there and bump `schema_version` in `api/report.js`.
- **Privacy:** the raw IP is never stored. A salted hash (`REPORTER_HASH_SALT`) lets repeat
  submitters be grouped. Coarse network location (country, region, city) comes from Vercel headers.
- **Spam:** a hidden honeypot field and a minimum fill time.
- **Checks:** `npm test`; CI in `.github/workflows/ci.yml`. `npm run icons` re-renders the icons
  and preview card.
