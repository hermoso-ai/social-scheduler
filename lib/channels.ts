// Display details for channel ids. The API's channel list is the source of truth (ids, names, limits); this only adds
// a short badge label and a colour, and falls back gracefully for any channel added later.
const KNOWN: Record<string, { short: string; color: string }> = {
  instagram: { short: 'IG', color: '#d6249f' },
  facebook: { short: 'FB', color: '#1877f2' },
  threads: { short: '@', color: '#101010' },
  tiktok: { short: 'TT', color: '#111111' },
  youtube: { short: 'YT', color: '#ff0033' },
  linkedin: { short: 'in', color: '#0a66c2' },
  linkedin_page: { short: 'in', color: '#0a66c2' },
  bluesky: { short: 'bs', color: '#1185fe' },
  google_business: { short: 'G', color: '#34a853' },
  x: { short: 'X', color: '#000000' },
  telegram: { short: 'TG', color: '#229ed9' },
  pinterest: { short: 'P', color: '#e60023' },
  wordpress: { short: 'W', color: '#21759b' },
  discord: { short: 'D', color: '#5865f2' },
  slack: { short: 'S', color: '#4a154b' },
  whop: { short: 'Wh', color: '#ff6243' },
  shopify_blog: { short: 'Sh', color: '#5e8e3e' },
  webflow: { short: 'Wf', color: '#146ef5' },
  wix: { short: 'Wx', color: '#0c6efc' },
};

export function channelBadge(id: string) {
  return KNOWN[id] || { short: id.slice(0, 2).toUpperCase(), color: '#6b6b6b' };
}

export function prettyChannel(id: string, names: Record<string, string>) {
  return names[id] || id.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

export const STATUS_LABEL: Record<string, string> = {
  scheduled: 'Scheduled',
  processing: 'Sending',
  published: 'Published',
  partially_published: 'Partly published',
  failed: 'Failed',
  indeterminate: 'Unconfirmed',
};
