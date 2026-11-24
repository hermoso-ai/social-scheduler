'use client';

import { addDays, DAY_NAMES, dayKey, fmtTime, sameDay } from '@/lib/dates';
import { ChannelBadge, StatusDot } from './Badge';
import type { Post } from './types';

type Props = {
  view: 'week' | 'month';
  from: Date;
  anchor: Date;
  posts: Post[];
  onOpen: (p: Post) => void;
  onCompose: (at: Date) => void;
  onDrill: (day: Date) => void;
};

function postTime(p: Post) {
  return new Date(p.scheduled_at || p.created_at || 0);
}

function byDay(posts: Post[]) {
  const m = new Map<string, Post[]>();
  for (const p of posts) {
    const k = dayKey(postTime(p));
    if (!m.has(k)) m.set(k, []);
    m.get(k)!.push(p);
  }
  for (const list of m.values()) list.sort((a, b) => +postTime(a) - +postTime(b));
  return m;
}

/** A sensible default slot for "new post on this day": 9:00, or the next half hour if that has passed. */
function slotFor(day: Date) {
  const at = new Date(day);
  at.setHours(9, 0, 0, 0);
  const soon = new Date(Date.now() + 15 * 60_000);
  if (at < soon) {
    soon.setMinutes(soon.getMinutes() < 30 ? 30 : 60, 0, 0);
    return soon;
  }
  return at;
}

function thumb(p: Post) {
  const m = (p.media || []).find((x) => x?.url && x.type !== 'video') || null;
  return m?.url || null;
}

export default function Calendar({ view, from, anchor, posts, onOpen, onCompose, onDrill }: Props) {
  const days = byDay(posts);
  const today = new Date();
  const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate());

  if (view === 'week') {
    return (
      <div className="week">
        {Array.from({ length: 7 }, (_, i) => {
          const d = addDays(from, i);
          const list = days.get(dayKey(d)) || [];
          const past = d < todayStart;
          return (
            <section key={i} className={`day ${sameDay(d, today) ? 'today' : ''} ${past ? 'past' : ''}`}>
              <div className="day-head">
                <span className="dow">{DAY_NAMES[i]}</span>
                <span className="dnum">{d.getDate()}</span>
                {!past && (
                  <button className="add" onClick={() => onCompose(slotFor(d))} aria-label={`New post on ${d.toDateString()}`}>+</button>
                )}
              </div>
              <div className="day-list">
                {list.length === 0 && <div className="empty">{past ? '' : 'Nothing scheduled'}</div>}
                {list.map((p) => {
                  const img = thumb(p);
                  return (
                    <button key={p.id} className={`card status-${p.status}`} onClick={() => onOpen(p)}>
                      <div className="card-top">
                        <StatusDot status={p.status || ''} />
                        <span className="time">{fmtTime(postTime(p))}</span>
                        <span className="badges">
                          {(p.channels || []).slice(0, 4).map((c) => <ChannelBadge key={c} id={c} size={16} />)}
                          {(p.channels || []).length > 4 && <span className="more">+{(p.channels || []).length - 4}</span>}
                        </span>
                      </div>
                      {img && (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img className="thumb" src={img} alt="" loading="lazy" />
                      )}
                      <p className="caption">{p.title_effective || p.caption || '(no caption)'}</p>
                    </button>
                  );
                })}
              </div>
            </section>
          );
        })}
      </div>
    );
  }

  // Month: six rows of seven days, starting on the Monday on or before the 1st.
  return (
    <div className="month">
      {DAY_NAMES.map((n) => <div key={n} className="mhead">{n}</div>)}
      {Array.from({ length: 42 }, (_, i) => {
        const d = addDays(from, i);
        const list = days.get(dayKey(d)) || [];
        const inMonth = d.getMonth() === anchor.getMonth();
        return (
          <div key={i} className={`cell ${inMonth ? '' : 'out'} ${sameDay(d, today) ? 'today' : ''}`}>
            <div className="cell-head">
              <span className="dnum">{d.getDate()}</span>
              {d >= todayStart && <button className="add" onClick={() => onCompose(slotFor(d))} aria-label="New post">+</button>}
            </div>
            {list.slice(0, 3).map((p) => (
              <button key={p.id} className={`chip status-${p.status}`} onClick={() => onOpen(p)}>
                <StatusDot status={p.status || ''} />
                <span className="time">{fmtTime(postTime(p))}</span>
                <span className="badges">{(p.channels || []).slice(0, 3).map((c) => <ChannelBadge key={c} id={c} size={13} />)}</span>
                <span className="chip-text">{p.title_effective || p.caption}</span>
              </button>
            ))}
            {list.length > 3 && (
              <button className="chip more-chip" onClick={() => onDrill(d)}>+{list.length - 3} more</button>
            )}
          </div>
        );
      })}
    </div>
  );
}
