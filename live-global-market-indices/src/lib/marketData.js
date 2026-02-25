const STOOQ_ENDPOINT = '/api/stooq';

export const INDEX_CONFIG = [
  { symbol: '^SPX', label: 'S&P 500', region: 'United States' },
  { symbol: '^DJI', label: 'Dow Jones', region: 'United States' },
  { symbol: '^NDQ', label: 'Nasdaq Composite', region: 'United States' },
  { symbol: '^SNX', label: 'BSE Sensex', region: 'India' },
  { symbol: '^HSI', label: 'Hang Seng', region: 'Hong Kong' },
  { symbol: '^SHC', label: 'Shanghai Composite', region: 'China' },
  { symbol: '^NKX', label: 'Nikkei 225', region: 'Japan' },
];

function asNumber(value) {
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function buildQuoteTimestamp(date, time) {
  if (!date || !time || date === 'N/D' || time === 'N/D') {
    return null;
  }

  return `${date} ${time}`;
}

export async function fetchMarketIndices({ signal } = {}) {
  const response = await fetch(STOOQ_ENDPOINT, {
    signal,
    headers: {
      Accept: 'application/json',
    },
  });

  if (!response.ok) {
    throw new Error(`Market feed request failed (${response.status})`);
  }

  const payload = await response.json();
  const symbolRows = Array.isArray(payload?.symbols) ? payload.symbols : [];
  const rowsBySymbol = new Map(
    symbolRows.map((row) => [String(row.symbol || '').toUpperCase(), row]),
  );

  return INDEX_CONFIG.map((index) => {
    const row = rowsBySymbol.get(index.symbol.toUpperCase());
    const open = asNumber(row?.open);
    const close = asNumber(row?.close);
    const high = asNumber(row?.high);
    const low = asNumber(row?.low);
    const change = open !== null && close !== null ? close - open : null;
    const changePercent =
      open !== null && open !== 0 && change !== null ? (change / open) * 100 : null;

    return {
      symbol: index.symbol,
      label: index.label,
      region: index.region,
      sourceName: row?.name || index.label,
      close,
      open,
      high,
      low,
      change,
      changePercent,
      quoteTimestamp: buildQuoteTimestamp(row?.date, row?.time),
    };
  });
}
