'use client';

import { useEffect, useMemo, useState } from 'react';
import { api } from '@/lib/api';
import { prettyChannel } from '@/lib/channels';
import { DAY_NAMES } from '@/lib/dates';
import { ChannelBadge } from './Badge';

// GET /v1/analytics/best-time, per channel: a day x hour grid of this brand's own measured posts, each cell's lift
// against that channel's usual, and the best weekday / 3-hour band when one clearly beats the usual.
type Cell = { dow: number; hour: number; posts: number; lift: number | null };
type Bucket = { key: string; n: number; lift: number | null };
type ChannelStats = {
  channel: string;
  unit?: string;
  usual?: number;
  measured?: number;
  need?: number;
  ready?: boolean;
  grid?: Cell[];
  weekdays?: Bucket[];
  bands?: Bucket[];
  bestDay?: Bucket | null;
  bestBand?: Bucket | null;
  why?: string;
  blocked?: string;
};
type Resp = { zone?: string; days?: number; channels?: ChannelStats[] };

const HOURS = Array.from({ length: 24 }, (_, h) => h);

function hourLabel(h: number) {
  const d = new Date(2000, 0, 1, h);
  return d.toLocaleTimeString(undefined, { hour: 'numeric' });
}

function heat(c: Cell | undefined) {
  if (!c || !c.posts) return undefined;
  if (c.lift === null) return 'var(--heat-thin)';
  const strength = Math.max(-1, Math.min(1, Math.log2(c.lift) / 2)); // 4x usual = full colour
  if (strength >= 0) return `color-mix(in srgb, var(--accent) ${Math.round(18 + strength * 82)}%, var(--surface))`;
  return `color-mix(in srgb, var(--muted) ${Math.round(28 + -strength * 40)}%, var(--surface))`;
}

export default function BestTimeView({ brand, timezone, names }: { brand: string | null; timezone: string; names: Record<string, string> }) {
  const [data, setData] = useState<Resp | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pick, setPick] = useState<string | null>(null);

  useEffect(() => {
    if (!brand) return;
    setData(null);
    setError(null);
    api<Resp>(`/api/best-time?timezone=${encodeURIComponent(timezone)}`, brand)
      .then((r) => {
        setData(r);
        const first = (r.channels || []).find((c) => c.ready && (c.grid || []).length) || (r.channels || [])[0];
        setPick(first?.channel || null);
      })
      .catch((e) => setError(e.message));
  }, [brand, timezone]);

  const chans = useMemo(() => data?.channels || [], [data]);
  const cur = chans.find((c) => c.channel === pick) || null;
  const grid = useMemo(() => {
    const m = new Map<string, Cell>();
    for (const c of cur?.grid || []) m.set(`${c.dow}-${c.hour}`, c);
    return m;
  }, [cur]);

  if (error) return <div className="alert">{error}</div>;
  if (!data) return <div className="loading-block">Reading your posts’ performance…</div>;
  if (!chans.length) return <div className="empty-block">No measured posts yet. Publish a few and check back.</div>;

  const unit = cur?.unit ? cur.unit.toLowerCase() : 'engagement';

  return (
    <div className="best">
      <div className="best-intro">
        <h1 className="title">Best time to post</h1>
        <p className="meta">From this brand’s own posts over the last {data.days || 90} days, in {data.zone || timezone}. Each channel is compared with its own usual, never pooled.</p>
      </div>
      <div className="tabs wrap">
        {chans.map((c) => (
          <button key={c.channel} className={pick === c.channel ? 'on' : ''} onClick={() => setPick(c.channel)}>
            <ChannelBadge id={c.channel} size={14} /> {prettyChannel(c.channel, names)}
          </button>
        ))}
      </div>

      {cur && (
        <div className="best-body">
          <div className="best-cards">
            <div className="stat">
              <div className="stat-label">Best day</div>
              <div className="stat-value">{cur.bestDay ? cur.bestDay.key : '—'}</div>
              <div className="stat-sub">{cur.bestDay?.lift ? `${cur.bestDay.lift.toFixed(1)}× usual ${unit} · ${cur.bestDay.n} posts` : 'Nothing stands out yet'}</div>
            </div>
            <div className="stat">
              <div className="stat-label">Best hours</div>
              <div className="stat-value">{cur.bestBand ? cur.bestBand.key.replace('-', '–') + 'h' : '—'}</div>
              <div className="stat-sub">{cur.bestBand?.lift ? `${cur.bestBand.lift.toFixed(1)}× usual ${unit} · ${cur.bestBand.n} posts` : 'Nothing stands out yet'}</div>
            </div>
            <div className="stat">
              <div className="stat-label">Measured posts</div>
              <div className="stat-value">{cur.measured ?? 0}</div>
              <div className="stat-sub">{cur.ready ? `usual ${unit}: ${cur.usual ?? 0}` : `needs ${cur.need ?? 15} to compare`}</div>
            </div>
          </div>

          {cur.why && <p className="why">{cur.why}</p>}

          {(cur.grid || []).length > 0 && (
            <div className="heatmap-wrap">
              <div className="heatmap" role="table" aria-label="Lift by day and hour">
                <div />
                {HOURS.map((h) => <div key={h} className="hm-hour">{h % 3 === 0 ? hourLabel(h) : ''}</div>)}
                {DAY_NAMES.map((d, dow) => (
                  <div key={d} className="hm-row" style={{ display: 'contents' }}>
                    <div className="hm-day">{d}</div>
                    {HOURS.map((h) => {
                      const c = grid.get(`${dow}-${h}`);
                      return (
                        <div
                          key={h}
                          className="hm-cell"
                          style={{ background: heat(c) }}
                          title={c ? `${d} ${hourLabel(h)}: ${c.posts} post${c.posts === 1 ? '' : 's'}${c.lift !== null ? `, ${c.lift.toFixed(2)}× usual` : ', too few to compare'}` : `${d} ${hourLabel(h)}: no posts`}
                        />
                      );
                    })}
                  </div>
                ))}
              </div>
              <div className="legend">
                <span><i style={{ background: 'transparent' }} /> no posts</span>
                <span><i style={{ background: 'color-mix(in srgb, var(--muted) 45%, var(--surface))' }} /> below usual</span>
                <span><i style={{ background: 'var(--heat-thin)' }} /> too few posts</span>
                <span><i style={{ background: 'color-mix(in srgb, var(--accent) 50%, var(--surface))' }} /> above usual</span>
                <span><i style={{ background: 'var(--accent)' }} /> 4× usual</span>
              </div>
            </div>
          )}

          {(cur.weekdays || []).some((w) => w.n) && (
            <div className="bars-row">
              <Bars title="By weekday" rows={cur.weekdays || []} />
              <Bars title="By time of day" rows={(cur.bands || []).map((b) => ({ ...b, key: b.key.replace('-', '–') + 'h' }))} />
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function Bars({ title, rows }: { title: string; rows: Bucket[] }) {
  const max = Math.max(1, ...rows.map((r) => r.lift || 0));
  return (
    <div className="bars">
      <div className="label">{title}</div>
      {rows.map((r) => (
        <div key={r.key} className="bar">
          <span className="bar-key">{r.key}</span>
          <span className="bar-track">
            <span className={`bar-fill ${r.lift && r.lift >= 1.15 ? 'hot' : ''}`} style={{ width: `${r.lift ? (r.lift / max) * 100 : 0}%` }} />
          </span>
          <span className="bar-val">{r.lift ? `${r.lift.toFixed(2)}×` : r.n ? 'few' : '—'}</span>
          <span className="bar-n">{r.n}</span>
        </div>
      ))}
    </div>
  );
}
