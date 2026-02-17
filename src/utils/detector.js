import {
  VIDEO_CONTENT_TYPES,
  VIDEO_EXTENSIONS,
  URL_PATTERNS,
  BLOCKED_DOMAINS,
  VIDEO_TYPES
} from './constants.js';

/**
 * Check if domain is blocked
 */
export function isBlockedDomain(url) {
  try {
    const hostname = new URL(url).hostname.toLowerCase();
    return BLOCKED_DOMAINS.some(domain => hostname.includes(domain));
  } catch {
    return false;
  }
}

/**
 * Extract file extension from URL
 */
export function getExtensionFromUrl(url) {
  try {
    const pathname = new URL(url).pathname;
    const match = pathname.match(/\.([a-z0-9]+)(?:\?|$)/i);
    return match ? match[1].toLowerCase() : null;
  } catch {
    return null;
  }
}

/**
 * Detect video type from content-type header
 */
export function detectTypeFromContentType(contentType) {
  if (!contentType) return null;

  const ct = contentType.toLowerCase();

  if (ct.includes('mpegurl') || ct.includes('m3u')) {
    return VIDEO_TYPES.HLS;
  }

  if (ct.includes('dash+xml')) {
    return VIDEO_TYPES.DASH;
  }

  if (ct.includes('mp2t')) {
    return VIDEO_TYPES.HLS; // TS segments are part of HLS
  }

  if (ct.includes('video/mp4')) {
    return VIDEO_TYPES.MP4;
  }

  if (ct.includes('video/webm')) {
    return VIDEO_TYPES.WEBM;
  }

  return null;
}

/**
 * Detect video type from URL
 */
export function detectTypeFromUrl(url) {
  const ext = getExtensionFromUrl(url);

  if (!ext) return null;

  if (ext === 'm3u8' || ext === 'm3u') {
    return VIDEO_TYPES.HLS;
  }

  if (ext === 'mpd') {
    return VIDEO_TYPES.DASH;
  }

  if (ext === 'ts' || ext === 'm4s') {
    return VIDEO_TYPES.HLS; // Segments
  }

  if (ext === 'mp4') {
    return VIDEO_TYPES.MP4;
  }

  if (ext === 'webm') {
    return VIDEO_TYPES.WEBM;
  }

  return null;
}

/**
 * Check if content-type indicates a video stream
 */
export function isVideoContentType(contentType) {
  if (!contentType) return false;
  const ct = contentType.toLowerCase();
  return VIDEO_CONTENT_TYPES.some(type => ct.includes(type.toLowerCase()));
}

/**
 * Check if URL matches video patterns
 */
export function matchesVideoPattern(url) {
  return URL_PATTERNS.some(pattern => pattern.test(url));
}

/**
 * Check if URL is a manifest (not a segment)
 */
export function isManifest(url, contentType) {
  const ext = getExtensionFromUrl(url);
  const ct = contentType?.toLowerCase() || '';

  // HLS manifest
  if (ext === 'm3u8' || ext === 'm3u' || ct.includes('mpegurl')) {
    return true;
  }

  // DASH manifest
  if (ext === 'mpd' || ct.includes('dash+xml')) {
    return true;
  }

  return false;
}

/**
 * Check if URL is a segment (not a manifest)
 */
export function isSegment(url, contentType) {
  const ext = getExtensionFromUrl(url);
  const ct = contentType?.toLowerCase() || '';

  // TS segment
  if (ext === 'ts' && !url.includes('playlist')) {
    return true;
  }

  // MP4/M4S segment
  if ((ext === 'm4s' || ext === 'mp4') && (url.includes('segment') || url.includes('chunk'))) {
    return true;
  }

  // Transport stream content-type
  if (ct.includes('mp2t')) {
    return true;
  }

  return false;
}

/**
 * Extract video info from request
 */
export function extractVideoInfo(details) {
  const { url, responseHeaders, tabId } = details;

  // Check if blocked domain
  if (isBlockedDomain(url)) {
    return null;
  }

  // Get content-type from headers
  const contentTypeHeader = responseHeaders?.find(
    h => h.name.toLowerCase() === 'content-type'
  );
  const contentType = contentTypeHeader?.value || '';

  // Only process manifests, not segments
  if (!isManifest(url, contentType)) {
    return null;
  }

  // Detect type
  const type = detectTypeFromContentType(contentType) || detectTypeFromUrl(url);

  if (!type) {
    return null;
  }

  // Extract domain for display
  const domain = new URL(url).hostname;

  return {
    url,
    manifest: url,
    type,
    contentType,
    domain,
    tabId,
    title: `Video from ${domain}`,
    thumbnail: null, // Will be generated later if possible
  };
}

/**
 * Generate a simple thumbnail color based on domain
 */
export function generateThumbnailColor(domain) {
  let hash = 0;
  for (let i = 0; i < domain.length; i++) {
    hash = domain.charCodeAt(i) + ((hash << 5) - hash);
  }
  const hue = hash % 360;
  return `hsl(${hue}, 70%, 60%)`;
}