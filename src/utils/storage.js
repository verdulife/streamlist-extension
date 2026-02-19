import { STORAGE_KEYS, DEFAULT_SETTINGS } from './constants.js';

/**
 * Get all videos from storage
 */
export async function getVideos() {
  const result = await chrome.storage.session.get(STORAGE_KEYS.VIDEOS);
  return result[STORAGE_KEYS.VIDEOS] || [];
}

/**
 * Save videos to storage
 */
export async function saveVideos(videos) {
  await chrome.storage.session.set({
    [STORAGE_KEYS.VIDEOS]: videos
  });
}

/**
 * Add a video to the playlist
 */
export async function addVideo(video) {
  const videos = await getVideos();

  // Check if video already exists (by URL)
  const exists = videos.some(v => v.url === video.url || v.manifest === video.manifest);
  if (exists) {
    console.log('Video already in playlist');
    return false;
  }

  videos.push({
    id: crypto.randomUUID(),
    timestamp: Date.now(),
    ...video
  });

  await saveVideos(videos);
  return true;
}

/**
 * Remove a video by ID
 */
export async function removeVideo(videoId) {
  const videos = await getVideos();
  const filtered = videos.filter(v => v.id !== videoId);
  await saveVideos(filtered);
  return filtered;
}

/**
 * Clear all videos
 */
export async function clearAllVideos() {
  await saveVideos([]);
  await chrome.storage.session.remove(STORAGE_KEYS.CURRENT_INDEX);
}

/**
 * Get current playing index
 */
export async function getCurrentIndex() {
  const result = await chrome.storage.session.get(STORAGE_KEYS.CURRENT_INDEX);
  return result[STORAGE_KEYS.CURRENT_INDEX] || 0;
}

/**
 * Set current playing index
 */
export async function setCurrentIndex(index) {
  await chrome.storage.session.set({
    [STORAGE_KEYS.CURRENT_INDEX]: index
  });
}

/**
 * Get settings
 */
export async function getSettings() {
  const result = await chrome.storage.local.get(STORAGE_KEYS.SETTINGS);
  return result[STORAGE_KEYS.SETTINGS] || DEFAULT_SETTINGS;
}

/**
 * Save settings
 */
export async function saveSettings(settings) {
  await chrome.storage.local.set({
    [STORAGE_KEYS.SETTINGS]: { ...DEFAULT_SETTINGS, ...settings }
  });
}

/**
 * Get or create playlist tab ID
 */
export async function getPlaylistTabId() {
  const result = await chrome.storage.session.get(STORAGE_KEYS.PLAYLIST_TAB_ID);
  return result[STORAGE_KEYS.PLAYLIST_TAB_ID];
}

/**
 * Set playlist tab ID
 */
export async function setPlaylistTabId(tabId) {
  await chrome.storage.session.set({
    [STORAGE_KEYS.PLAYLIST_TAB_ID]: tabId
  });
}

/**
 * Update badge with video count
 */
export async function updateBadge() {
  const videos = await getVideos();
  const count = videos.length;

  if (count > 0) {
    await chrome.action.setBadgeText({ text: count.toString() });
    await chrome.action.setBadgeBackgroundColor({ color: '#ff0000' });
  } else {
    await chrome.action.setBadgeText({ text: '' });
  }
}

/**
 * Get last saved volume (default: 1)
 */
export async function getVolume() {
  const result = await chrome.storage.local.get('playerVolume');
  return result.playerVolume !== undefined ? result.playerVolume : 1;
}

/**
 * Save volume preference
 */
export async function setVolume(volume) {
  await chrome.storage.local.set({ playerVolume: volume });
}

/**
 * Get last saved volume before mute
 */
export async function getPreviousVolume() {
  const result = await chrome.storage.local.get('playerPreviousVolume');
  return result.playerPreviousVolume !== undefined ? result.playerPreviousVolume : 0.5;
}

/**
 * Save volume before mute
 */
export async function setPreviousVolume(volume) {
  await chrome.storage.local.set({ playerPreviousVolume: volume });
}