export type VideoQuality = 'auto' | '2160p' | '1440p' | '1080p' | '720p' | '480p' | '360p';

export function resolutionFromLabel(label: string): number {
  if (/\b(?:4k|uhd|2160p?)\b/i.test(label)) return 2160;
  const dimensions = label.match(/\b(\d{3,4})\s*[x×]\s*(\d{3,4})\b/i);
  if (dimensions) return resolutionFromDimensions(Number(dimensions[1]), Number(dimensions[2]));
  const resolution = label.match(/\b(1440|1080|720|480|360)p?\b/i);
  return resolution ? Number(resolution[1]) : 0;
}

export function resolutionFromDimensions(width: number, height: number): number {
  return width >= 3840 && height < 2160 ? 2160 : height;
}

export function normalizeQuality(value = 'auto'): VideoQuality {
  const height = resolutionFromLabel(value);
  return height ? `${height}p` as VideoQuality : 'auto';
}

export function qualityLabel(height: number): string {
  return height === 2160 ? '4K (2160p)' : height > 0 ? `${height}p` : 'Original da fonte';
}

// Prefer the requested resolution, then the best lower one, then the lowest higher one.
// Keep source order for ties so the provider's priority remains intact.
export function preferredQualityIndex(heights: number[], preference: string): number {
  const target = resolutionFromLabel(preference);
  if (!target) return -1;
  const known = heights.map((height, index) => ({height, index})).filter(item => item.height > 0);
  const exact = known.find(item => item.height === target);
  if (exact) return exact.index;
  const lower = known.filter(item => item.height < target).sort((a, b) => b.height - a.height);
  if (lower.length) return lower[0].index;
  return known.sort((a, b) => a.height - b.height)[0]?.index ?? -1;
}
