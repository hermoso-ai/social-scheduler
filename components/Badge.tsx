import { channelBadge } from '@/lib/channels';

export function ChannelBadge({ id, size = 18, title }: { id: string; size?: number; title?: string }) {
  const b = channelBadge(id);
  return (
    <span
      className="badge"
      title={title || id}
      style={{ background: b.color, width: size, height: size, fontSize: Math.round(size * 0.48) }}
    >
      {b.short}
    </span>
  );
}

export function StatusDot({ status }: { status: string }) {
  return <span className={`dot dot-${status}`} aria-hidden />;
}
