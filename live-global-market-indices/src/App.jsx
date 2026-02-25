import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { fetchMarketIndices } from './lib/marketData';
import './App.css';

const AUTO_REFRESH_MS = 20_000;
const TIMESTAMP_PATTERN = /^(\d{4})-(\d{2})-(\d{2}) (\d{2}):(\d{2}):(\d{2})$/;
const timeZoneFormatterCache = new Map();

function getTimeZoneFormatter(timeZone) {
  if (!timeZoneFormatterCache.has(timeZone)) {
    timeZoneFormatterCache.set(
      timeZone,
      new Intl.DateTimeFormat('en-CA', {
        timeZone,
        hour12: false,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      }),
    );
  }

  return timeZoneFormatterCache.get(timeZone);
}

function getTimeZoneOffsetMs(timeZone, utcMillis) {
  const formatter = getTimeZoneFormatter(timeZone);
  const parts = formatter.formatToParts(new Date(utcMillis));
  const values = {};

  parts.forEach((part) => {
    if (part.type !== 'literal') {
      values[part.type] = part.value;
    }
  });

  const asUtcMillis = Date.UTC(
    Number(values.year),
    Number(values.month) - 1,
    Number(values.day),
    Number(values.hour),
    Number(values.minute),
    Number(values.second),
  );

  return asUtcMillis - utcMillis;
}

function toLocalDateFromMarketTimestamp(timestamp, sourceTimeZone) {
  if (!timestamp || !sourceTimeZone) {
    return null;
  }

  const matches = TIMESTAMP_PATTERN.exec(timestamp);
  if (!matches) {
    return null;
  }

  const [, yearValue, monthValue, dayValue, hourValue, minuteValue, secondValue] = matches;
  const year = Number(yearValue);
  const month = Number(monthValue);
  const day = Number(dayValue);
  const hour = Number(hourValue);
  const minute = Number(minuteValue);
  const second = Number(secondValue);
  const localAsUtcMillis = Date.UTC(year, month - 1, day, hour, minute, second);

  let utcMillis = localAsUtcMillis;
  for (let i = 0; i < 3; i += 1) {
    const offset = getTimeZoneOffsetMs(sourceTimeZone, utcMillis);
    const corrected = localAsUtcMillis - offset;
    if (Math.abs(corrected - utcMillis) < 1) {
      break;
    }
    utcMillis = corrected;
  }

  return new Date(utcMillis);
}

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

function formatUpdatedAt(timestamp, sourceTimeZone) {
  if (!timestamp) {
    return 'N/A';
  }

  const parsed = toLocalDateFromMarketTimestamp(timestamp, sourceTimeZone);
  if (!parsed || Number.isNaN(parsed.getTime())) {
    return timestamp;
  }

  return parsed.toLocaleString();
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

              <p className="quote-time">{formatUpdatedAt(index.quoteTimestamp, index.timeZone)}</p>
            </article>
          ))}
        </section>
      )}
    </main>
  );
}

export default App;
