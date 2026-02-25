# Live Global Market Indices (React)

Simple React dashboard that tracks these major indices in near real time:

- S&P 500
- Dow Jones Industrial Average
- Nasdaq Composite
- BSE Sensex
- Hang Seng
- Shanghai Composite (China index)
- Nikkei 225

## Run locally

```bash
npm install
npm run dev
```

Then open the local Vite URL shown in your terminal.

## How data is fetched

- Data source: [Stooq](https://stooq.com/)
- Endpoint used by the app: `/stooq-api/q/l/?...`
- The `/stooq-api` prefix is proxied by Vite in `vite.config.js` to avoid browser CORS issues during local development.

## Notes

- Values are market-feed values from Stooq and can be delayed depending on the exchange.
- The dashboard auto-refreshes every 20 seconds and also supports manual refresh.
