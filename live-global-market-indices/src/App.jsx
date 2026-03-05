import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { fetchMarketIndices } from './lib/marketData';
import './App.css';

const AUTO_REFRESH_MS = 20_000;
const STOOQ_SOURCE_OFFSET = '+01:00';
const TIMESTAMP_FORMAT_OPTIONS = {
  year: 'numeric',
  month: 'numeric',
  day: 'numeric',
  hour: 'numeric',
  minute: '2-digit',
};

function formatPoints(value) {
  if (value === null) {
    return 'N/A';
  }

  return new Intl.NumberFormat('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

function formatPercent(value) {
  if (value === null) {
    return 'N/A';
  }

  return `${value >= 0 ? '+' : ''}${value.toFixed(2)}%`;
}

function formatSignedPoints(value) {
  if (value === null) {
    return 'N/A';
  }

  return `${value >= 0 ? '+' : ''}${formatPoints(value)}`;
}

function formatUpdatedAt(timestamp, timeZone, timeZoneLabel) {
  if (!timestamp) {
    return 'N/A';
  }

  // Stooq quote timestamps are treated as GMT+1.
  const parsed = new Date(`${timestamp.replace(' ', 'T')}${STOOQ_SOURCE_OFFSET}`);
  if (Number.isNaN(parsed.getTime())) {
    return timestamp;
  }

  const formatted = parsed.toLocaleString(
    undefined,
    timeZone ? { ...TIMESTAMP_FORMAT_OPTIONS, timeZone } : TIMESTAMP_FORMAT_OPTIONS,
  );
  return timeZoneLabel ? `${formatted} ${timeZoneLabel}` : formatted;
}

function getDirectionClass(change) {
  if (change === null || change === 0) {
    return '';
  }
  return change > 0 ? 'is-up' : 'is-down';
}

function App() {
  const [indices, setIndices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [lastUpdatedAt, setLastUpdatedAt] = useState(null);
  const [nextRefreshAt, setNextRefreshAt] = useState(Date.now() + AUTO_REFRESH_MS);
  const [clock, setClock] = useState(Date.now());
  const inFlightRef = useRef(false);

  const loadIndices = useCallback(async ({ silent = false } = {}) => {
    if (inFlightRef.current) {
      return;
    }

    inFlightRef.current = true;
    if (silent) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }

    try {
      const rows = await fetchMarketIndices();
      setIndices(rows);
      setError('');
      setLastUpdatedAt(new Date().toISOString());
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Failed to fetch market data.');
    } finally {
      inFlightRef.current = false;
      setLoading(false);
      setRefreshing(false);
      setNextRefreshAt(Date.now() + AUTO_REFRESH_MS);
    }
  }, []);

  useEffect(() => {
    loadIndices();

    const pollTimer = setInterval(() => {
      loadIndices({ silent: true });
    }, AUTO_REFRESH_MS);

    const clockTimer = setInterval(() => {
      setClock(Date.now());
    }, 1000);

    return () => {
      clearInterval(pollTimer);
      clearInterval(clockTimer);
    };
  }, [loadIndices]);

  const secondsUntilRefresh = useMemo(() => {
    const seconds = Math.ceil((nextRefreshAt - clock) / 1000);
    return seconds > 0 ? seconds : 0;
  }, [clock, nextRefreshAt]);

  return (
    <main className="app-shell">
      <header className="app-header">
        <h1>Live Global Market Indices</h1>
        <div className="controls-row">
          <button
            type="button"
            className="refresh-button"
            onClick={() => loadIndices({ silent: true })}
            disabled={loading || refreshing}
          >
            {refreshing ? 'Refreshing...' : 'Refresh now'}
          </button>
          <p className="refresh-meta">
            <span>
              Last synced: <strong>{lastUpdatedAt ? new Date(lastUpdatedAt).toLocaleTimeString() : 'Never'}</strong>
            </span>
            <span className="next-refresh-line">
              Next update in <strong>{secondsUntilRefresh}s</strong>
            </span>
          </p>
        </div>
      </header>

      {error && (
        <div className="error-banner" role="alert">
          {error}
        </div>
      )}

      {loading && indices.length === 0 ? (
        <section className="loading-state">
          <p>Loading live index data...</p>
        </section>
      ) : (
        <section className="cards-grid">
          {indices.map((index) => (
            <article className="index-card" key={index.symbol}>
              <div className="card-topline">
                <span className="region-badge">{index.region}</span>
                <span className="symbol-code">{index.symbol}</span>
              </div>

              <h2>{index.label}</h2>
              <p className="price">{formatPoints(index.close)}</p>
              <div className={`change-row ${getDirectionClass(index.change)}`}>
                <span>{formatSignedPoints(index.change)}</span>
                <span>{formatPercent(index.changePercent)}</span>
              </div>

              <p className="quote-time">
                {formatUpdatedAt(index.quoteTimestamp, index.timeZone, index.timeZoneLabel)}
              </p>
            </article>
          ))}
        </section>
      )}
    </main>
  );
}

export default App;
