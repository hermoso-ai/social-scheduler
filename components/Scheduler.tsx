'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { api } from '@/lib/api';
import { addDays, startOfMonth, startOfWeek } from '@/lib/dates';
import { ChannelBadge } from './Badge';
import BestTimeView from './BestTime';
import Calendar from './Calendar';
import Composer from './Composer';
import PostDrawer from './PostDrawer';
import type { BrandRow, Channel, Post, View } from './types';

export default function Scheduler() {
  const [brands, setBrands] = useState<BrandRow[]>([]);
  const [brand, setBrand] = useState<string | null>(null);
  const [channels, setChannels] = useState<Channel[]>([]);
  const [posts, setPosts] = useState<Post[]>([]);
  const [view, setView] = useState<View>('week');
  const [anchor, setAnchor] = useState(() => new Date());
  const [filter, setFilter] = useState<string | null>(null);
  const [selected, setSelected] = useState<Post | null>(null);
  const [composing, setComposing] = useState<{ post?: Post; at?: Date } | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const tz = useMemo(() => Intl.DateTimeFormat().resolvedOptions().timeZone, []);

  // Window of the calendar currently on screen.
  const range = useMemo(() => {
    if (view === 'month') {
      const first = startOfWeek(startOfMonth(anchor));
      return { from: first, to: addDays(first, 42) };
    }
    const first = startOfWeek(anchor);
    return { from: first, to: addDays(first, 7) };
  }, [anchor, view]);

  useEffect(() => {
    api<{ brands: BrandRow[]; initial: string | null }>('/api/brands', null)
      .then((r) => {
        setBrands(r.brands);
        setBrand(r.initial);
      })
      .catch((e) => setError(e.message));
  }, []);

  useEffect(() => {
    if (!brand) return;
    setChannels([]);
    api<{ data: Channel[] }>('/api/channels', brand)
      .then((r) => setChannels(r.data || []))
      .catch((e) => setError(e.message));
  }, [brand]);

  const loadPosts = useCallback(async () => {
    if (!brand || view === 'best') return;
    setLoading(true);
    setError(null);
    try {
      const q = `?from=${range.from.toISOString()}&to=${range.to.toISOString()}`;
      const r = await api<{ data: Post[] }>(`/api/posts${q}`, brand);
      setPosts(r.data || []);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [brand, range, view]);

  useEffect(() => {
    loadPosts();
  }, [loadPosts]);

  const names = useMemo(() => Object.fromEntries(channels.map((c) => [c.id!, c.name!])), [channels]);
  const visible = useMemo(() => (filter ? posts.filter((p) => p.channels?.includes(filter)) : posts), [posts, filter]);
  const counts = useMemo(() => {
    const m: Record<string, number> = {};
    for (const p of posts) for (const c of p.channels || []) m[c] = (m[c] || 0) + 1;
    return m;
  }, [posts]);
  const connected = channels.filter((c) => c.connected);
  const others = channels.filter((c) => !c.connected);
  const scheduledCount = posts.filter((p) => p.status === 'scheduled').length;

  const step = (dir: number) => {
    const x = new Date(anchor);
    if (view === 'month') x.setMonth(x.getMonth() + dir);
    else x.setDate(x.getDate() + 7 * dir);
    setAnchor(x);
  };

  const title =
    view === 'month'
      ? anchor.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })
      : `${range.from.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} – ${addDays(range.to, -1).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}`;

  return (
    <div className="shell">
      <header className="topbar">
        <div className="brandmark">
          <span className="logo" aria-hidden>
            <svg viewBox="0 0 24 24" width="18" height="18"><rect x="3" y="5" width="18" height="16" rx="3" fill="none" stroke="currentColor" strokeWidth="1.8" /><path d="M3 10h18M8 3v4M16 3v4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" /></svg>
          </span>
          <span className="wordmark">Social Scheduler</span>
        </div>
        {brands.length > 1 && (
          <select className="select" value={brand || ''} onChange={(e) => { setBrand(e.target.value); setSelected(null); setFilter(null); }} aria-label="Brand">
            {brands.map((b) => (
              <option key={b.id} value={b.id}>{b.name}</option>
            ))}
          </select>
        )}
        <div className="seg" role="tablist">
          {(['week', 'month', 'best'] as View[]).map((v) => (
            <button key={v} role="tab" aria-selected={view === v} className={view === v ? 'on' : ''} onClick={() => setView(v)}>
              {v === 'best' ? 'Best time' : v[0].toUpperCase() + v.slice(1)}
            </button>
          ))}
        </div>
        <div className="spacer" />
        <button className="btn primary" onClick={() => setComposing({})} disabled={!brand}>New post</button>
      </header>

      <div className="body">
        <aside className="rail">
          <div className="rail-head">Channels</div>
          <button className={`rail-row ${filter === null ? 'on' : ''}`} onClick={() => setFilter(null)}>
            <span className="all-dot" />
            <span className="rail-name">All channels</span>
            <span className="rail-count">{view !== 'best' ? posts.length || '' : ''}</span>
          </button>
          {connected.map((c) => (
            <button
              key={c.id}
              className={`rail-row ${filter === c.id ? 'on' : ''}`}
              onClick={() => setFilter(filter === c.id ? null : c.id!)}
              title={c.account ? `Connected: ${c.account}` : 'Connected'}
            >
              <ChannelBadge id={c.id!} />
              <span className="rail-name">{c.name}</span>
              {c.needs_reconnect ? <span className="tag warn">Reconnect</span> : <span className="rail-count">{view !== 'best' ? counts[c.id!] || '' : ''}</span>}
            </button>
          ))}
          {others.length > 0 && <div className="rail-head sub">Not connected</div>}
          {others.map((c) => (
            <a
              key={c.id}
              className="rail-row muted"
              href="https://app.hermoso.ai"
              target="_blank"
              rel="noreferrer"
              title={c.available === false ? c.unavailable_reason || 'Not available yet' : 'Connect it in Hermoso'}
            >
              <ChannelBadge id={c.id!} />
              <span className="rail-name">{c.name}</span>
              <span className="rail-connect">{c.available === false ? 'Soon' : 'Connect'}</span>
            </a>
          ))}
        </aside>

        <main className="main">
          {view !== 'best' && (
            <div className="toolbar">
              <div className="nav">
                <button className="btn icon" onClick={() => step(-1)} aria-label="Previous">‹</button>
                <button className="btn ghost" onClick={() => setAnchor(new Date())}>Today</button>
                <button className="btn icon" onClick={() => step(1)} aria-label="Next">›</button>
              </div>
              <h1 className="title">{title}</h1>
              <div className="meta">
                {loading ? 'Loading…' : `${visible.length} post${visible.length === 1 ? '' : 's'} · ${scheduledCount} scheduled`}
                {filter ? <> · <button className="link" onClick={() => setFilter(null)}>{names[filter] || filter} ✕</button></> : null}
              </div>
            </div>
          )}
          {error && <div className="alert">{error}</div>}
          {view === 'best' ? (
            <BestTimeView brand={brand} timezone={tz} names={names} />
          ) : (
            <Calendar
              view={view}
              from={range.from}
              anchor={anchor}
              posts={visible}
              onOpen={setSelected}
              onCompose={(at) => setComposing({ at })}
              onDrill={(day) => { setAnchor(day); setView('week'); }}
            />
          )}
        </main>
      </div>

      <footer className="footer">
        <span>Times shown in {tz}.</span>
        <a href="https://hermoso.ai/?utm_source=github&utm_medium=oss&utm_campaign=social-scheduler" target="_blank" rel="noreferrer">
          Built with Hermoso
        </a>
      </footer>

      {selected && (
        <PostDrawer
          post={selected}
          brand={brand}
          names={names}
          onClose={() => setSelected(null)}
          onEdit={(p) => { setSelected(null); setComposing({ post: p }); }}
          onChanged={() => { setSelected(null); loadPosts(); }}
        />
      )}
      {composing && (
        <Composer
          brand={brand}
          channels={connected}
          editing={composing.post}
          initialAt={composing.at}
          onClose={() => setComposing(null)}
          onSaved={() => { setComposing(null); loadPosts(); }}
        />
      )}
    </div>
  );
}
