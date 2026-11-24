'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { api } from '@/lib/api';
import { toLocalInput } from '@/lib/dates';
import { ChannelBadge } from './Badge';
import type { Channel, Post } from './types';

type MediaItem = { url: string; type?: string };
type When = 'now' | 'at' | 'queue';

type Props = {
  brand: string | null;
  channels: Channel[];
  editing?: Post;
  initialAt?: Date;
  onClose: () => void;
  onSaved: () => void;
};

const NEEDS_TITLE = new Set(['youtube', 'pinterest']);
const len = (s: string) => [...s].length; // count characters, not UTF-16 units

export default function Composer({ brand, channels, editing, initialAt, onClose, onSaved }: Props) {
  const usable = channels.filter((c) => c.connected && !c.needs_reconnect);
  const [picked, setPicked] = useState<string[]>(() => editing?.channels || []);
  const [caption, setCaption] = useState(editing?.caption || '');
  const [perChannel, setPerChannel] = useState<Record<string, string>>(() => ({ ...(editing?.captions_by_channel || {}) }));
  const [customize, setCustomize] = useState(() => Object.keys(editing?.captions_by_channel || {}).length > 0);
  const [title, setTitle] = useState(editing?.title || '');
  const [media, setMedia] = useState<MediaItem[]>(() => (editing?.media || []).map((m) => ({ url: m.url!, type: m.type })));
  const [mediaUrl, setMediaUrl] = useState('');
  const [when, setWhen] = useState<When>(editing || initialAt ? 'at' : 'now');
  const [at, setAt] = useState(() =>
    toLocalInput(editing?.scheduled_at ? new Date(editing.scheduled_at) : initialAt || new Date(Date.now() + 60 * 60_000)),
  );
  const [uploading, setUploading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // One key per composed post: a retry after a dropped connection replays the first request instead of posting twice.
  const [idemKey] = useState(() => crypto.randomUUID());
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const k = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  }, [onClose]);

  const byId = useMemo(() => Object.fromEntries(channels.map((c) => [c.id!, c])), [channels]);
  const limits = picked.map((id) => {
    const text = customize && perChannel[id] !== undefined ? perChannel[id] : caption;
    const max = byId[id]?.caption_max ?? null;
    return { id, name: byId[id]?.name || id, used: len(text), max, over: max !== null && len(text) > max };
  });
  const anyOver = limits.some((l) => l.over);
  const needsTitle = picked.some((id) => NEEDS_TITLE.has(id));
  const carouselIssues = media.length > 1
    ? picked.filter((id) => !byId[id]?.carousel).map((id) => byId[id]?.name || id)
    : [];

  function toggle(id: string) {
    setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));
  }

  async function uploadFiles(files: FileList | null) {
    if (!files?.length) return;
    setUploading(true);
    setError(null);
    try {
      for (const f of Array.from(files)) {
        const url = new URL('/api/media', window.location.origin);
        if (brand) url.searchParams.set('brand', brand);
        const res = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': f.type || 'application/octet-stream', 'X-File-Name': f.name },
          body: f,
        });
        const body = await res.json();
        if (!res.ok) throw new Error(body?.error?.message || `Upload failed (HTTP ${res.status})`);
        setMedia((m) => [...m, { url: body.url, type: body.type }]);
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  }

  async function addUrl() {
    if (!mediaUrl.trim()) return;
    setUploading(true);
    setError(null);
    try {
      const body = await api<{ url: string; type?: string }>('/api/media', brand, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: mediaUrl.trim() }),
      });
      setMedia((m) => [...m, { url: body.url, type: body.type }]);
      setMediaUrl('');
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setUploading(false);
    }
  }

  async function submit() {
    setBusy(true);
    setError(null);
    const overrides = customize
      ? Object.fromEntries(picked.filter((id) => perChannel[id]?.trim()).map((id) => [id, perChannel[id]]))
      : {};
    const payload: Record<string, unknown> = {
      channels: picked,
      caption,
      media: media.map((m) => ({ url: m.url, ...(m.type === 'image' || m.type === 'video' ? { type: m.type } : {}) })),
      captions_by_channel: overrides,
      ...(title.trim() ? { title: title.trim() } : {}),
    };
    if (when === 'at') payload.scheduled_at = new Date(at).toISOString();
    if (when === 'queue') payload.use_queue = true;
    try {
      if (editing) {
        await api(`/api/posts/${encodeURIComponent(editing.id!)}`, brand, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
      } else {
        await api('/api/posts', brand, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Idempotency-Key': idemKey },
          body: JSON.stringify(payload),
        });
      }
      onSaved();
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  }

  const canSend = picked.length > 0 && (caption.trim() || media.length) && !anyOver && !busy && !uploading;
  const action = editing ? 'Save changes' : when === 'now' ? 'Post now' : when === 'queue' ? 'Add to queue' : 'Schedule';

  return (
    <div className="overlay center" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()} role="dialog" aria-label={editing ? 'Edit post' : 'New post'}>
        <div className="modal-head">
          <h2>{editing ? 'Edit scheduled post' : 'New post'}</h2>
          <button className="btn icon" onClick={onClose} aria-label="Close">✕</button>
        </div>

        <div className="field">
          <div className="label">Channels</div>
          {usable.length === 0 ? (
            <p className="hint">No channels connected yet. Connect them in <a href="https://app.hermoso.ai" target="_blank" rel="noreferrer">Hermoso</a>, then reload.</p>
          ) : (
            <div className="pickers">
              {usable.map((c) => (
                <button key={c.id} className={`picker ${picked.includes(c.id!) ? 'on' : ''}`} onClick={() => toggle(c.id!)} title={c.account || undefined}>
                  <ChannelBadge id={c.id!} size={16} /> {c.name}
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="field">
          <div className="label-row">
            <div className="label">Caption</div>
            {picked.length > 1 && (
              <label className="check"><input type="checkbox" checked={customize} onChange={(e) => setCustomize(e.target.checked)} /> Customize per channel</label>
            )}
          </div>
          <textarea className="textarea" rows={5} value={caption} onChange={(e) => setCaption(e.target.value)} placeholder="What do you want to say?" />
          {customize &&
            picked.map((id) => (
              <div key={id} className="override">
                <div className="override-head"><ChannelBadge id={id} size={14} /> {byId[id]?.name || id}</div>
                <textarea className="textarea small" rows={3} value={perChannel[id] ?? ''} placeholder="Leave empty to use the main caption" onChange={(e) => setPerChannel((m) => ({ ...m, [id]: e.target.value }))} />
              </div>
            ))}
          {limits.length > 0 && (
            <div className="limits">
              {limits.map((l) => (
                <span key={l.id} className={`limit ${l.over ? 'over' : ''}`}>
                  <ChannelBadge id={l.id} size={13} /> {l.used.toLocaleString()}{l.max !== null ? ` / ${l.max.toLocaleString()}` : ''}
                </span>
              ))}
            </div>
          )}
        </div>

        {needsTitle && (
          <div className="field">
            <div className="label">Title <span className="hint inline">YouTube and Pinterest show a headline; taken from the caption when empty</span></div>
            <input className="input" value={title} onChange={(e) => setTitle(e.target.value)} />
          </div>
        )}

        <div className="field">
          <div className="label">Media</div>
          {media.length > 0 && (
            <div className="media-row">
              {media.map((m, i) => (
                <div key={m.url + i} className="media-item">
                  {m.type === 'video' ? <video src={m.url} muted /> : (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={m.url} alt="" />
                  )}
                  <button className="remove" onClick={() => setMedia((x) => x.filter((_, j) => j !== i))} aria-label="Remove">✕</button>
                </div>
              ))}
            </div>
          )}
          <div className="media-add">
            <button className="btn ghost" onClick={() => fileRef.current?.click()} disabled={uploading}>{uploading ? 'Uploading…' : 'Upload files'}</button>
            <input ref={fileRef} type="file" accept="image/*,video/*" multiple hidden onChange={(e) => uploadFiles(e.target.files)} />
            <input className="input" placeholder="or paste an image or video URL" value={mediaUrl} onChange={(e) => setMediaUrl(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && addUrl()} />
            <button className="btn ghost" onClick={addUrl} disabled={uploading || !mediaUrl.trim()}>Add</button>
          </div>
          {carouselIssues.length > 0 && <p className="hint warn-text">Two or more files make a carousel, which {carouselIssues.join(', ')} cannot carry.</p>}
        </div>

        <div className="field">
          <div className="label">When</div>
          <div className="seg">
            {!editing && <button className={when === 'now' ? 'on' : ''} onClick={() => setWhen('now')}>Post now</button>}
            <button className={when === 'at' ? 'on' : ''} onClick={() => setWhen('at')}>Pick a time</button>
            {!editing && <button className={when === 'queue' ? 'on' : ''} onClick={() => setWhen('queue')}>Next free slot</button>}
          </div>
          {when === 'at' && <input className="input when" type="datetime-local" value={at} onChange={(e) => setAt(e.target.value)} />}
        </div>

        {error && <div className="alert">{error}</div>}

        <div className="modal-actions">
          <span className="hint">Publishing costs no credits.</span>
          <button className="btn ghost" onClick={onClose}>Close</button>
          <button className="btn primary" onClick={submit} disabled={!canSend}>{busy ? 'Sending…' : action}</button>
        </div>
      </div>
    </div>
  );
}
