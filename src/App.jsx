import { useCallback, useEffect, useRef, useState } from 'react';
import { fetchForecast, hoursForDay, searchPlaces, getDeviceLocation, reverseGeocode } from './weather.js';
import { recommend, bandFor, fmtHourShort, biasLabel, compareDays, deltaText, temp, tempDelta } from './outfit.js';
import Icon from './Icons.jsx';

const KEY = 'hey-mom:v1';
const DEFAULTS = { unit: 'F', startHour: 7, endHour: 15, bias: 0, place: null, lastFeedback: null, cache: null };
const STALE_MS = 30 * 60 * 1000;
const SKY = {
  light: { freezing: '#d9e4ff', cold: '#d7ecf5', cool: '#e9e2f7', mild: '#dcf1e2', warm: '#fff0c9', hot: '#ffdcd2' },
  dark: { freezing: '#141a33', cold: '#0f2430', cool: '#1e1830', mild: '#102419', warm: '#2a2210', hot: '#2e1612' },
};

function load() {
  try { return { ...DEFAULTS, ...JSON.parse(localStorage.getItem(KEY) || '{}') }; }
  catch { return { ...DEFAULTS }; }
}
function persist(s) {
  try { localStorage.setItem(KEY, JSON.stringify(s)); } catch { /* storage full or blocked */ }
}
// Local date without toISOString (avoids the UTC "tomorrow" bug)
function localDate(d = new Date()) {
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}
// v2: forecast includes yesterday, so older caches are ignored
const placeKey = (p) => (p ? `${p.lat},${p.lon}|v2` : '');
const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n));

export default function App() {
  const [store, setStore] = useState(load);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [day, setDay] = useState(null); // null = pick automatically
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [toast, setToast] = useState('');

  const update = useCallback((patch) => {
    setStore((prev) => {
      const next = { ...prev, ...(typeof patch === 'function' ? patch(prev) : patch) };
      persist(next);
      return next;
    });
  }, []);

  const refresh = useCallback(async (place) => {
    if (!place) return;
    setLoading(true);
    setError('');
    try {
      const data = await fetchForecast(place);
      update({ cache: { data, fetchedAt: Date.now(), key: placeKey(place) } });
    } catch {
      setError("Can't reach the weather service right now.");
    } finally {
      setLoading(false);
    }
  }, [update]);

  // Refs so the visibility handler always sees current values
  const placeRef = useRef(store.place);
  const fetchedRef = useRef(store.cache?.fetchedAt || 0);
  placeRef.current = store.place;
  fetchedRef.current = store.cache?.fetchedAt || 0;

  useEffect(() => {
    if (store.place) refresh(store.place);
  }, [placeKey(store.place), refresh]); // eslint-disable-line react-hooks/exhaustive-deps

  // Older saves used the label "My location": look up the real town name once
  useEffect(() => {
    const p = store.place;
    if (!p || p.name !== 'My location') return;
    reverseGeocode(p.lat, p.lon).then(({ name, detail }) =>
      update((prev) => (prev.place && placeKey(prev.place) === placeKey(p) ? { place: { ...prev.place, name, detail, fromDevice: true } } : {}))
    );
  }, [placeKey(store.place), update]); // eslint-disable-line react-hooks/exhaustive-deps

  // iOS PWAs resume without reloading: refetch when the app comes back if data is old
  useEffect(() => {
    const onVis = () => {
      if (document.visibilityState === 'visible' && placeRef.current && Date.now() - fetchedRef.current > STALE_MS) {
        refresh(placeRef.current);
      }
    };
    document.addEventListener('visibilitychange', onVis);
    return () => document.removeEventListener('visibilitychange', onVis);
  }, [refresh]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(''), 3200);
    return () => clearTimeout(t);
  }, [toast]);

  const cache = store.cache && store.cache.key === placeKey(store.place) ? store.cache : null;
  const data = cache?.data;
  const deviceHour = new Date().getHours();
  const dayIdx = day ?? (deviceHour >= 18 ? 1 : 0);
  // data index: 0 = yesterday, 1 = today, 2 = tomorrow
  const slot = data ? hoursForDay(data, dayIdx + 1, store.startHour, store.endHour) : null;
  const prevSlot = data ? hoursForDay(data, dayIdx, store.startHour, store.endHour) : null;
  const rec = slot ? recommend(slot.hours, store.bias, store.unit, dayIdx === 0 ? 'today' : 'tomorrow') : null;
  const diff = compareDays(prevSlot ? recommend(prevSlot.hours, store.bias) : null, rec, store.unit);
  const otherDay = dayIdx === 0 ? 'yesterday' : 'today';
  const band = rec ? bandFor(rec.avg) : 'mild';

  useEffect(() => {
    document.documentElement.dataset.band = band;
    const dark = window.matchMedia?.('(prefers-color-scheme: dark)').matches;
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', SKY[dark ? 'dark' : 'light'][band]);
  }, [band]);

  const pickPlace = (place) => {
    update({ place });
    setSettingsOpen(false);
  };

  if (!store.place) {
    return (
      <main className="app">
        <div className="thread">
          <p className="bubble me">what do I wear??</p>
          <p className="who">Mom</p>
          <div className="bubble mom">
            <p className="headline">First, where are you?</p>
            <p className="summary">I'll check the weather there every morning.</p>
          </div>
        </div>
        <PlacePicker onPick={pickPlace} />
      </main>
    );
  }

  const isToday = data && data.daily.time[1] === localDate();
  const canRate = dayIdx === 0 && isToday && deviceHour >= store.endHour && store.lastFeedback !== data.daily.time[1];

  const rate = (kind) => {
    const delta = kind === 'cold' ? 2 : kind === 'hot' ? -2 : 0;
    update((prev) => ({ bias: clamp(prev.bias + delta, -12, 12), lastFeedback: data.daily.time[1] }));
    setToast(kind === 'cold' ? "Got it. I'll dress you warmer next time."
      : kind === 'hot' ? "Got it. Lighter next time."
      : 'Nailed it.');
  };

  const fetchedTime = cache ? new Date(cache.fetchedAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }) : '';

  return (
    <main className="app">
      <header className="top">
        <button className="place" onClick={() => setSettingsOpen(true)} aria-label="Change location and settings">
          {store.place.name}
          <svg viewBox="0 0 12 12" width="12" height="12" aria-hidden="true"><path d="M3 4.5 6 7.5 9 4.5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" /></svg>
        </button>
        <div className="seg" role="tablist" aria-label="Which day">
          {['Today', 'Tomorrow'].map((label, i) => (
            <button key={label} role="tab" aria-selected={dayIdx === i} className={dayIdx === i ? 'on' : ''} onClick={() => setDay(i)}>
              {label}
            </button>
          ))}
        </div>
      </header>

      {dayIdx === 0 && data?.current && (
        <p className="now">Right now {temp(data.current.temperature_2m, store.unit)}, feels like {temp(data.current.apparent_temperature, store.unit)}</p>
      )}

      {error && (
        <p className="notice">
          {error} {cache ? `Showing the forecast from ${fetchedTime}.` : ''}{' '}
          <button className="link" onClick={() => refresh(store.place)}>Try again</button>
        </p>
      )}

      {!data && !error && <p className="notice">Checking the weather…</p>}

      {rec && (
        <>
          <div className="thread" aria-live="polite">
            <p className="bubble me">{dayIdx === 0 ? 'what do I wear today??' : 'ok what about tomorrow'}</p>
            <p className="who">Mom</p>
            <div className="bubble mom">
              <p className="headline">{rec.headline}</p>
              <p className="summary">{rec.summary}</p>
            </div>
          </div>

          {diff && <CompareCard diff={diff} otherDay={otherDay} thisDay={dayIdx === 0 ? 'Today' : 'Tomorrow'} />}

          <ul className="outfit">
            {rec.items.map((it) => (
              <li key={it.slot + it.name}>
                <span className="icon"><Icon name={it.icon} /></span>
                <span className="txt">
                  <span className="name">{it.name}</span>
                  <span className="note">{it.note}</span>
                </span>
              </li>
            ))}
          </ul>

          {rec.momRule && <p className="bubble mom rule">{rec.momRule}</p>}

          <section className="hours" aria-label="Feels-like temperature by hour">
            <h2>Hour by hour</h2>
            <HourStrip hours={slot.hours} bias={store.bias} unit={store.unit} />
          </section>

          {canRate && (
            <section className="rate">
              <h2>How did today's outfit go?</h2>
              <div className="rate-btns">
                <button onClick={() => rate('cold')}>Too cold</button>
                <button onClick={() => rate('right')}>Just right</button>
                <button onClick={() => rate('hot')}>Too hot</button>
              </div>
            </section>
          )}
        </>
      )}

      <footer className="foot">
        <button className="link" onClick={() => setSettingsOpen(true)}>
          {biasLabel(store.bias, store.unit)}. Outfits for {fmtHourShort(store.startHour)}–{fmtHourShort(store.endHour)}.
        </button>
        {loading && <span className="loading">Updating…</span>}
      </footer>

      {settingsOpen && (
        <Settings store={store} update={update} onPick={pickPlace} onClose={() => setSettingsOpen(false)} />
      )}

      {toast && <div className="toast" role="status">{toast}</div>}
    </main>
  );
}

function CompareCard({ diff, otherDay, thisDay }) {
  const Other = otherDay[0].toUpperCase() + otherDay.slice(1);
  return (
    <section className="compare" aria-label={`Compared to ${otherDay}`}>
      <div className="compare-temps">
        <span><span className="lbl">{Other}</span>{diff.prevRange}</span>
        <span className="arrow" aria-hidden="true">→</span>
        <span><span className="lbl">{thisDay}</span>{diff.nextRange}</span>
      </div>
      <p className="compare-delta">{deltaText(diff.delta, otherDay, diff.unit)}.</p>
      {diff.changes.length === 0 ? (
        <p className="compare-same">Same outfit as {otherDay} works.</p>
      ) : (
        <ul className="changes">
          {diff.changes.map((c) => (
            <li key={c.kind + (c.from || '') + (c.to || '')}>
              <span className={`verb ${c.kind}`}>{c.kind === 'swap' ? 'Swap' : c.kind === 'add' ? 'Add' : 'Skip'}</span>
              <span>{c.kind === 'swap' ? <>{c.from} <span aria-label="for">→</span> {c.to}</> : c.to || c.from}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function HourStrip({ hours, bias, unit }) {
  const feels = hours.map((h) => h.feels - bias);
  const lo = Math.min(...feels) - 4;
  const hi = Math.max(...feels) + 4;
  return (
    <div className="strip">
      {hours.map((h, i) => {
        const pct = ((feels[i] - lo) / (hi - lo)) * 100;
        return (
          <div className="hr" key={h.hour}>
            <span className="t">{temp(feels[i], unit)}</span>
            <span className="bar"><span style={{ height: `${pct}%` }} /></span>
            <span className={`r ${h.rain >= 30 ? 'wet' : ''}`}>{h.rain >= 30 ? `${h.rain}%` : ''}</span>
            <span className="h">{fmtHourShort(h.hour)}</span>
          </div>
        );
      })}
    </div>
  );
}

function PlacePicker({ onPick }) {
  const [q, setQ] = useState('');
  const [results, setResults] = useState([]);
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);

  const useDevice = async () => {
    setBusy(true); setMsg('');
    try { onPick(await getDeviceLocation()); }
    catch { setMsg('Location is off for this app. Search for your town instead.'); }
    finally { setBusy(false); }
  };

  const search = async () => {
    if (!q.trim()) return;
    setBusy(true); setMsg('');
    try {
      const r = await searchPlaces(q.trim());
      setResults(r);
      if (!r.length) setMsg(`No towns found for "${q.trim()}". Check the spelling.`);
    } catch { setMsg("Search isn't working right now. Try again in a minute."); }
    finally { setBusy(false); }
  };

  return (
    <div className="picker">
      <button className="primary" onClick={useDevice} disabled={busy}>Use my location</button>
      <div className="search">
        <input
          type="search" placeholder="Or search a town" value={q} enterKeyHint="search"
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') search(); }}
          aria-label="Search for a town"
        />
        <button onClick={search} disabled={busy}>Search</button>
      </div>
      {msg && <p className="notice">{msg}</p>}
      {results.length > 0 && (
        <ul className="results">
          {results.map((r) => (
            <li key={placeKey(r)}>
              <button onClick={() => onPick(r)}>
                <span className="name">{r.name}</span>
                <span className="note">{r.detail}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function Settings({ store, update, onPick, onClose }) {
  const hours = Array.from({ length: 24 }, (_, i) => i);
  return (
    <div className="sheet-wrap" onClick={onClose}>
      <div className="sheet" role="dialog" aria-label="Settings" onClick={(e) => e.stopPropagation()}>
        <div className="sheet-head">
          <h2>Settings</h2>
          <button className="link" onClick={onClose}>Done</button>
        </div>

        <h3>Location</h3>
        <p className="note">Now: {store.place.name}{store.place.detail ? `, ${store.place.detail}` : ''}{store.place.fromDevice ? ' (from your location)' : ''}</p>
        <PlacePicker onPick={onPick} />

        <h3>Temperature</h3>
        <div className="seg" role="radiogroup" aria-label="Temperature unit">
          {[['F', '°F'], ['C', '°C']].map(([u, label]) => (
            <button key={u} role="radio" aria-checked={store.unit === u} className={store.unit === u ? 'on' : ''} onClick={() => update({ unit: u })}>
              {label}
            </button>
          ))}
        </div>

        <h3>Time frame</h3>
        <div className="hours-pick">
          <label>From
            <select value={store.startHour} onChange={(e) => update({ startHour: Math.min(Number(e.target.value), store.endHour) })}>
              {hours.map((h) => <option key={h} value={h}>{fmtHourShort(h)}</option>)}
            </select>
          </label>
          <label>To
            <select value={store.endHour} onChange={(e) => update({ endHour: Math.max(Number(e.target.value), store.startHour) })}>
              {hours.map((h) => <option key={h} value={h}>{fmtHourShort(h)}</option>)}
            </select>
          </label>
        </div>

        <h3>How you feel the cold</h3>
        <p className="note">{biasLabel(store.bias, store.unit)}. This changes each time you rate an outfit at the end of the time frame.</p>
        <div className="bias">
          <button onClick={() => update({ bias: clamp(store.bias - 2, -12, 12) })} >I run warm</button>
          <span>{store.bias > 0 ? '+' : store.bias < 0 ? '−' : ''}{tempDelta(Math.abs(store.bias), store.unit)}°</span>
          <button onClick={() => update({ bias: clamp(store.bias + 2, -12, 12) })} >I run cold</button>
          <button className="link" onClick={() => update({ bias: 0 })}>Reset</button>
        </div>
      </div>
    </div>
  );
}
