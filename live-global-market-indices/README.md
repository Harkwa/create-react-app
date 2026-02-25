# Live Global Market Indices (React)

Simple React dashboard that tracks these major indices in near real time:

- S&P 500
- Dow Jones Industrial Average
- Nasdaq Comp
- BSE Sensex
- Nikkei 225
- Shanghai Comp

## Run locally

```bash
npm install
npm run dev
```

Then open the local Vite URL shown in your terminal.

## How data is fetched

- Data source: [Stooq](https://stooq.com/)
- Endpoint used by the app: `/api/stooq`
- Production uses a Vercel serverless function at `api/stooq.js` as a stable proxy to Stooq.
- Local development uses Vite proxying for `/api/stooq` in `vite.config.js`.

## Notes

- Values are market-feed values from Stooq and can be delayed depending on the exchange.
- The dashboard auto-refreshes every 20 seconds and also supports manual refresh.
