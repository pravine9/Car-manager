# Car Tracker

Track and shortlist cars you're looking to buy, with automatic DVLA data.

## How it works

1. Enter a **registration** (+ optional listing URL) in the Quick Add bar
2. The app calls the DVLA API to fill in make, year, fuel, engine, colour, MOT/tax status
3. Add **price**, **mileage**, and **notes** from the listing
4. Save — the car appears in a sortable, searchable table
5. ⭐ **Star** cars to shortlist your favourites

## Deployment

### Vercel (Recommended)
This app is ready for Vercel. Vercel's "Serverless Functions" replace `server.js` to keep your API key secure.

1. Create a new project on [Vercel](https://vercel.com).
2. Connect your repository.
3. In **Settings -> Environment Variables**, add:
   - `DVLA_API_KEY`: your_dvla_api_key_here
4. Deploy!

### GitHub Pages
You can host the static files, but **DVLA lookup will not work** because GitHub Pages does not support server-side keys.

## Stack

- **Tailwind CSS v4** — styling
- **Alpine.js** — reactive UI (CDN)
- **Dexie.js** — IndexedDB storage (CDN)
- **Express** — local dev server + DVLA proxy

## Files

| File | Purpose |
|---|---|
| `index.html` | UI (Alpine.js directives) |
| `app.js` | Dexie DB + Alpine component |
| `server.js` | Express server + DVLA proxy |
| `src/input.css` | Tailwind source |
| `styles.css` | Generated Tailwind output |
| `vehicleTaxRates.js` | UK VED rate lookup |
| `docs/` | API reference docs |

## Data

All cars are stored locally in IndexedDB (via Dexie). Use **Export/Import** (JSON) for backups.
