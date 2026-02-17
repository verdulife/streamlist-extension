// Content types que indican video streams
export const VIDEO_CONTENT_TYPES = [
  // HLS
  'application/x-mpegurl',
  'application/vnd.apple.mpegurl',
  'audio/mpegurl',
  'audio/x-mpegurl',

  // DASH
  'application/dash+xml',

  // Transport Stream
  'video/mp2t',
  'video/MP2T',

  // Progressive
  'video/mp4',
  'video/webm',
  'video/ogg',
  'video/quicktime',
  'video/x-matroska',

  // Audio (opcional)
  'audio/mp4',
  'audio/mpeg',
  'audio/aac',
];

// Extensiones de archivo que indican streams
export const VIDEO_EXTENSIONS = [
  // Manifests
  'm3u8', 'm3u', 'mpd',

  // Segments
  'ts', 'm4s', 'm4v', 'mp4', 'webm',

  // Audio segments
  'aac', 'm4a', 'mp3',
];

// Patterns en URLs que indican streams
export const URL_PATTERNS = [
  /\.m3u8/i,
  /\.mpd/i,
  /\.ts$/i,
  /\.m4s$/i,
  /\/playlist\//i,
  /\/manifest\//i,
  /\/hls\//i,
  /\/dash\//i,
];

// Dominios bloqueados (evitar problemas legales)
export const BLOCKED_DOMAINS = [
  'youtube.com',
  'youtu.be',
  'netflix.com',
  'disneyplus.com',
  'hbomax.com',
  'primevideo.com',
];

// Tipos de video detectados
export const VIDEO_TYPES = {
  HLS: 'hls',
  DASH: 'dash',
  MP4: 'mp4',
  WEBM: 'webm',
  MSE: 'mse', // Media Source Extensions (capturado via hook)
};

// Comandos de mensajería entre componentes
export const MESSAGES = {
  // Content -> Background
  VIDEO_DETECTED: 'video_detected',
  MSE_SEGMENT_CAPTURED: 'mse_segment_captured',

  // Background -> Popup
  GET_VIDEOS: 'get_videos',
  ADD_TO_PLAYLIST: 'add_to_playlist',
  PLAY_NOW: 'play_now',
  CLEAR_PLAYLIST: 'clear_playlist',

  // Background -> Playlist
  GET_CURRENT_VIDEO: 'get_current_video',
  PLAY_VIDEO_AT_INDEX: 'play_video_at_index',
  REMOVE_VIDEO: 'remove_video',
  UPDATE_PLAYING_INDEX: 'update_playing_index',
  
  // Notifications for playlist updates
  PLAYLIST_UPDATED: 'playlist_updated',
  VIDEO_ADDED: 'video_added',
  VIDEO_REMOVED: 'video_removed',
  PLAYLIST_CLEARED: 'playlist_cleared',
};

// Configuración de storage
export const STORAGE_KEYS = {
  VIDEOS: 'videos',
  CURRENT_INDEX: 'currentPlayingIndex',
  SETTINGS: 'settings',
  PLAYLIST_TAB_ID: 'playlistTabId',
};

// Settings por defecto
export const DEFAULT_SETTINGS = {
  autoplay: true,
  loop: false,
  captureAudio: true,
  captureVideo: true,
  maxVideos: 50,
};