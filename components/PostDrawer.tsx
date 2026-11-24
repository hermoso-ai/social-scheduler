'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { prettyChannel, STATUS_LABEL } from '@/lib/channels';
import { fmtDateTime } from '@/lib/dates';
import { ChannelBadge, StatusDot } from './Badge';
import type { Post } from './types';

type Props = {
  post: Post;
  brand: string | null;
  names: Record<string, string>;
  onClose: () => void;
  onEdit: (p: Post) => void;
  onChanged: () => void;
};

export default function PostDrawer({ post: initial, brand, names, onClose, onEdit, onChanged }: Props) {
  const [post, setPost] = useState<Post>(initial);
  const [tab, setTab] = useState<string>('all');
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // The list row is enough to draw; re-read the post so per-channel results are current.
  useEffect(() => {
    api<Post>(`/api/posts/${encodeURIComponent(initial.id!)}`, brand).then(setPost).catch((e) => setError(e.message));
  }, [initial.id, brand]);

  useEffect(() => {
    const k = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  }, [onClose]);

  // Only overrides for channels this post actually goes to.
  const overrides = Object.fromEntries(
    Object.entries(post.captions_by_channel || {}).filter(([c, t]) => (post.channels || []).includes(c) && t && t !== post.caption),
  );
  const caption = tab === 'all' ? post.caption : overrides[tab] ?? post.caption;
  const when = new Date(post.scheduled_at || post.created_at || 0);
  const results = post.results || [];

  async function cancel() {
    setBusy(true);
    setError(null);
    try {
      await api(`/api/posts/${encodeURIComponent(post.id!)}`, brand, { method: 'DELETE' });
      onChanged();
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  }

  return (
    <div className="overlay" onClick={onClose}>
      <aside className="drawer" onClick={(e) => e.stopPropagation()} aria-label="Post detail">
        <div className="drawer-head">
          <div>
            <div className="status-line"><StatusDot status={post.status || ''} /> {STATUS_LABEL[post.status || ''] || post.status}</div>
            <div className="drawer-when">{fmtDateTime(when)}</div>
          </div>
          <button className="btn icon" onClick={onClose} aria-label="Close">✕</button>
        </div>

        <div className="drawer-channels">
          {(post.channels || []).map((c) => (
            <span key={c} className="chan-pill"><ChannelBadge id={c} size={16} /> {prettyChannel(c, names)}</span>
          ))}
        </div>

        {Object.keys(overrides).length > 0 && (
          <div className="tabs">
            <button className={tab === 'all' ? 'on' : ''} onClick={() => setTab('all')}>Main caption</button>
            {Object.keys(overrides).map((c) => (
              <button key={c} className={tab === c ? 'on' : ''} onClick={() => setTab(c)}>{prettyChannel(c, names)}</button>
            ))}
          </div>
        )}
        <p className="drawer-caption">{caption || '(no caption)'}</p>

        {(post.media || []).length > 0 && (
          <div className="drawer-media">
            {(post.media || []).map((m, i) =>
              m.type === 'video' ? (
                <video key={i} src={m.url} controls preload="metadata" />
              ) : (
                // eslint-disable-next-line @next/next/no-img-element
                <img key={i} src={m.url} alt="" />
              ),
            )}
          </div>
        )}

        {results.length > 0 && (
          <div className="results">
            <div className="label">Per channel</div>
            {results.map((r, i) => (
              <div key={i} className={`result ${r.ok ? 'ok' : 'bad'}`}>
                <ChannelBadge id={r.channel || ''} size={16} />
                <span className="result-name">{prettyChannel(r.channel || '', names)}</span>
                {r.ok && r.url ? (
                  <a href={r.url} target="_blank" rel="noreferrer">View post ↗</a>
                ) : r.ok ? (
                  <span className="okay">Published</span>
                ) : (
                  <span className="err">{r.error || 'Failed'}</span>
                )}
              </div>
            ))}
          </div>
        )}

        {error && <div className="alert">{error}</div>}

        {post.status === 'scheduled' && (
          <div className="drawer-actions">
            {confirming ? (
              <>
                <span className="confirm-q">Cancel this post? It will not go out.</span>
                <button className="btn ghost" onClick={() => setConfirming(false)} disabled={busy}>Keep it</button>
                <button className="btn danger" onClick={cancel} disabled={busy}>{busy ? 'Cancelling…' : 'Cancel post'}</button>
              </>
            ) : (
              <>
                <button className="btn ghost" onClick={() => setConfirming(true)}>Cancel post</button>
                <button className="btn primary" onClick={() => onEdit(post)}>Edit or reschedule</button>
              </>
            )}
          </div>
        )}
      </aside>
    </div>
  );
}
