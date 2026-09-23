export function getCdnPublicBaseUrl(): string {
  return (process.env.NEXT_PUBLIC_CDN_PUBLIC_BASE_URL || 'https://cdn.insighthire.com').replace(/\/$/, '');
}

export function cdnVideoPlayerUrl(slug: string): string {
  return `${getCdnPublicBaseUrl()}/v/${slug}`;
}

export function cdnVideoStreamUrl(slug: string): string {
  return `${getCdnPublicBaseUrl()}/v/${slug}/stream`;
}
