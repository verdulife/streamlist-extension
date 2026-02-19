import { MESSAGES } from '../utils/constants.js';

console.log('🎬 Popup loaded');

// DOM Elements
const currentVideoInfo = document.getElementById('currentVideoInfo');
const noVideoMessage = document.getElementById('noVideoMessage');
const videoCount = document.getElementById('videoCount');
const videoTitle = document.getElementById('videoTitle');
const videoDomain = document.getElementById('videoDomain');
const videoThumbnail = document.getElementById('videoThumbnail');
const addToPlaylistBtn = document.getElementById('addToPlaylistBtn');
const playNowBtn = document.getElementById('playNowBtn');
const openPlaylistBtn = document.getElementById('openPlaylistBtn');
const clearPlaylistBtn = document.getElementById('clearPlaylistBtn');

let currentVideo = null;
let allVideos = [];

/**
 * Initialize popup
 */
async function init() {
  // Get videos from background
  const response = await chrome.runtime.sendMessage({
    cmd: MESSAGES.GET_VIDEOS
  });

  if (response.success) {
    currentVideo = response.currentVideo;
    allVideos = response.allVideos;

    updateUI();
  }
}

/**
 * Update UI based on current state
 */
function updateUI() {
  // Update video count
  videoCount.textContent = allVideos.length;

  // Show/hide current video info
  if (currentVideo) {
    currentVideoInfo.classList.remove('hidden');
    noVideoMessage.classList.add('hidden');

    // Update video info
    videoTitle.textContent = currentVideo.title || 'Untitled Video';
    videoDomain.textContent = currentVideo.domain || 'Unknown source';

    // Set thumbnail color
    if (currentVideo.thumbnailColor) {
      videoThumbnail.style.backgroundColor = currentVideo.thumbnailColor;
    }

    // Enable buttons
    addToPlaylistBtn.disabled = false;
    playNowBtn.disabled = false;
  } else {
    currentVideoInfo.classList.add('hidden');
    noVideoMessage.classList.remove('hidden');

    // Disable buttons
    addToPlaylistBtn.disabled = true;
    playNowBtn.disabled = true;
  }

  // Show/hide playlist management buttons
  if (allVideos.length > 0) {
    openPlaylistBtn.classList.remove('hidden');
    openPlaylistBtn.classList.add('flex');
    clearPlaylistBtn.classList.remove('hidden');
    clearPlaylistBtn.classList.add('flex');
  } else {
    openPlaylistBtn.classList.add('hidden');
    openPlaylistBtn.classList.remove('flex');
    clearPlaylistBtn.classList.add('hidden');
    clearPlaylistBtn.classList.remove('flex');
  }
}

/**
 * Add current video to playlist
 */
async function addToPlaylist() {
  addToPlaylistBtn.disabled = true;
  addToPlaylistBtn.innerHTML = `
    <svg class="w-5 h-5 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
    </svg>
    Adding...
  `;

  const response = await chrome.runtime.sendMessage({
    cmd: MESSAGES.ADD_TO_PLAYLIST,
    data: { video: currentVideo }
  });

  if (response.success) {
    // Show success feedback
    addToPlaylistBtn.innerHTML = `
      <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/>
      </svg>
      Added!
    `;
    addToPlaylistBtn.classList.remove('bg-blue-500', 'hover:bg-blue-600');
    addToPlaylistBtn.classList.add('bg-green-500');

    // Refresh UI
    setTimeout(async () => {
      await init();
      addToPlaylistBtn.innerHTML = `
        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"/>
        </svg>
        Add to Playlist
      `;
      addToPlaylistBtn.classList.remove('bg-green-500');
      addToPlaylistBtn.classList.add('bg-blue-500', 'hover:bg-blue-600');
    }, 1000);
  } else {
    // Show error
    addToPlaylistBtn.innerHTML = `
      <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
      </svg>
      ${response.error || 'Error'}
    `;
    addToPlaylistBtn.classList.add('bg-red-500');

    setTimeout(() => {
      addToPlaylistBtn.innerHTML = `
        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"/>
        </svg>
        Add to Playlist
      `;
      addToPlaylistBtn.classList.remove('bg-red-500');
      addToPlaylistBtn.classList.add('bg-blue-500', 'hover:bg-blue-600');
      addToPlaylistBtn.disabled = false;
    }, 2000);
  }
}

/**
 * Find existing playlist tab
 */
async function findPlaylistTab() {
  const playlistUrl = chrome.runtime.getURL('src/playlist/playlist.html');
  const tabs = await chrome.tabs.query({ url: playlistUrl });
  return tabs.length > 0 ? tabs[0] : null;
}

/**
 * Reload iframe in original tab
 */
async function reloadIframeInOriginalTab(sourceTabId) {
  try {
    await chrome.tabs.sendMessage(sourceTabId, {
      cmd: 'reload_iframe'
    });
  } catch (error) {
    console.log('Could not reload iframe in original tab:', error);
  }
}

/**
 * Play video now (add and open playlist)
 */
async function playNow() {
  playNowBtn.disabled = true;
  playNowBtn.innerHTML = `
    <svg class="w-5 h-5 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
    </svg>
    Opening...
  `;

  // Get current tab ID for reloading iframe
  const currentTab = await chrome.tabs.query({ active: true, currentWindow: true });
  const sourceTabId = currentTab[0].id;

  const response = await chrome.runtime.sendMessage({
    cmd: MESSAGES.PLAY_NOW,
    data: { video: currentVideo }
  });

  if (response.success) {
    // Find or create playlist tab
    let playlistTab = await findPlaylistTab();
    
    if (!playlistTab) {
      // Create new playlist tab
      const playlistUrl = chrome.runtime.getURL('src/playlist/playlist.html');
      playlistTab = await chrome.tabs.create({ url: playlistUrl });
    } else {
      // Focus existing playlist tab
      await chrome.tabs.update(playlistTab.id, { active: true });
      await chrome.windows.update(playlistTab.windowId, { focused: true });
    }

    // Reload iframe in original tab
    await reloadIframeInOriginalTab(sourceTabId);

    // Close popup
    window.close();
  } else {
    playNowBtn.innerHTML = `
      <svg class="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
        <path d="M8 5v14l11-7z"/>
      </svg>
      Play Now
    `;
    playNowBtn.disabled = false;
  }
}

/**
 * Open playlist page
 */
async function openPlaylist() {
  // Get current tab ID for reloading iframe
  const currentTab = await chrome.tabs.query({ active: true, currentWindow: true });
  const sourceTabId = currentTab[0].id;

  // Find or create playlist tab
  let playlistTab = await findPlaylistTab();
  
  if (!playlistTab) {
    // Create new playlist tab
    const playlistUrl = chrome.runtime.getURL('src/playlist/playlist.html');
    playlistTab = await chrome.tabs.create({ url: playlistUrl });
  } else {
    // Focus existing playlist tab
    await chrome.tabs.update(playlistTab.id, { active: true });
    await chrome.windows.update(playlistTab.windowId, { focused: true });
  }

  // Reload iframe in original tab
  await reloadIframeInOriginalTab(sourceTabId);

  // Close popup
  window.close();
}

/**
 * Clear all videos from playlist
 */
async function clearPlaylist() {
  if (!confirm('Clear all videos from playlist?')) {
    return;
  }

  clearPlaylistBtn.disabled = true;
  clearPlaylistBtn.innerHTML = `
    <svg class="w-4 h-4 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
    </svg>
    Clearing...
  `;

  await chrome.runtime.sendMessage({ cmd: MESSAGES.CLEAR_PLAYLIST });

  // Refresh UI
  await init();

  clearPlaylistBtn.innerHTML = `
    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/>
    </svg>
    Clear Playlist
  `;
  clearPlaylistBtn.disabled = false;
}

// Event Listeners
addToPlaylistBtn.addEventListener('click', addToPlaylist);
playNowBtn.addEventListener('click', playNow);
openPlaylistBtn.addEventListener('click', openPlaylist);
clearPlaylistBtn.addEventListener('click', clearPlaylist);

// Initialize on load
init();