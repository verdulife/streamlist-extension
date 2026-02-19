import { MESSAGES } from '../utils/constants.js';

console.log('🎬 Popup loaded');

// DOM Elements
const currentVideoInfo = document.getElementById('currentVideoInfo');
const noVideoMessage = document.getElementById('noVideoMessage');
const videoCount = document.getElementById('videoCount');
const videoTitle = document.getElementById('videoTitle');
const videoDomain = document.getElementById('videoDomain');
const addToPlaylistBtn = document.getElementById('addToPlaylistBtn');
const playNowBtn = document.getElementById('playNowBtn');
const openPlaylistBtn = document.getElementById('openPlaylistBtn');
const clearPlaylistBtn = document.getElementById('clearPlaylistBtn');
const playlistList = document.getElementById('playlistList');
const emptyPlaylistMsg = document.getElementById('emptyPlaylistMsg');

let currentVideo = null;
let allVideos = [];

/**
 * Initialize popup
 */
async function init() {
  console.log('🎬 Initializing popup...');
  
  try {
    // Get videos from background
    const response = await chrome.runtime.sendMessage({
      cmd: MESSAGES.GET_VIDEOS
    });

    console.log('📨 Response from background:', response);

    if (response.success) {
      currentVideo = response.currentVideo;
      allVideos = response.allVideos;

      console.log('✅ Data loaded:', { currentVideo, videosCount: allVideos.length });
      updateUI();
    } else {
      console.error('❌ Failed to get videos:', response.error);
    }
  } catch (error) {
    console.error('❌ Error during init:', error);
  }
}

/**
 * Render playlist items
 */
function renderPlaylistItems() {
  console.log('🎬 Rendering playlist items, total:', allVideos.length);
  
  playlistList.innerHTML = '';

  if (allVideos.length === 0) {
    console.log('📭 No videos, showing empty message');
    emptyPlaylistMsg.classList.remove('hidden');
    return;
  }

  emptyPlaylistMsg.classList.add('hidden');

  allVideos.forEach((video, index) => {
    const item = document.createElement('div');
    item.className = 'bg-neutral-900 hover:bg-neutral-800 rounded p-2 cursor-pointer transition-colors text-xs overflow-hidden';
    item.innerHTML = `
      <p class="text-neutral-100 truncate font-medium">${video.title || 'Untitled'}</p>
      <p class="text-neutral-500 truncate text-xs mt-0.5">${video.domain || 'Unknown'}</p>
    `;
    item.addEventListener('click', () => {
      playVideoByIndex(index);
    });
    playlistList.appendChild(item);
  });
  
  console.log('✅ Rendered', allVideos.length, 'items');
}

/**
 * Play video by index
 */
async function playVideoByIndex(index) {
  const response = await chrome.runtime.sendMessage({
    cmd: MESSAGES.PLAY_VIDEO,
    data: { index }
  });

  if (response.success) {
    // Actualizar UI después de reproducir
    init();
  }
}

/**
 * Update UI based on current state
 */
function updateUI() {
  console.log('🎨 Updating UI...');
  
  // Update video count
  videoCount.textContent = `${allVideos.length} ${allVideos.length === 1 ? 'video' : 'videos'}`;
  console.log('📊 Video count:', allVideos.length);

  // Show/hide current video info
  if (currentVideo) {
    console.log('📹 Current video found:', currentVideo.title);
    currentVideoInfo.classList.remove('hidden');
    noVideoMessage.classList.add('hidden');

    // Update video info
    videoTitle.textContent = currentVideo.title || 'Untitled Video';
    videoDomain.textContent = currentVideo.domain || 'Unknown source';

    // Enable buttons
    addToPlaylistBtn.disabled = false;
    playNowBtn.disabled = false;
  } else {
    console.log('❌ No current video');
    currentVideoInfo.classList.add('hidden');
    noVideoMessage.classList.remove('hidden');

    // Disable buttons
    addToPlaylistBtn.disabled = true;
    playNowBtn.disabled = true;
  }

  // Show/hide playlist management buttons and render list
  if (allVideos.length > 0) {
    console.log('✅ Showing playlist buttons');
    openPlaylistBtn.classList.remove('hidden');
    openPlaylistBtn.classList.add('flex');
    clearPlaylistBtn.classList.remove('hidden');
    clearPlaylistBtn.classList.add('flex');
  } else {
    console.log('❌ Hiding playlist buttons');
    openPlaylistBtn.classList.add('hidden');
    openPlaylistBtn.classList.remove('flex');
    clearPlaylistBtn.classList.add('hidden');
    clearPlaylistBtn.classList.remove('flex');
  }

  // Render playlist items
  renderPlaylistItems();
}

/**
 * Add current video to playlist
 */
async function addToPlaylist() {
  addToPlaylistBtn.disabled = true;
  const originalHTML = addToPlaylistBtn.innerHTML;

  addToPlaylistBtn.innerHTML = `
    <svg class="w-4 h-4 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
    </svg>
    <span>Adding...</span>
  `;

  const response = await chrome.runtime.sendMessage({
    cmd: MESSAGES.ADD_TO_PLAYLIST,
    data: { video: currentVideo }
  });

  if (response.success) {
    // Show success feedback
    addToPlaylistBtn.innerHTML = `
      <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/>
      </svg>
      <span>Added!</span>
    `;
    addToPlaylistBtn.classList.add('bg-neutral-700');

    // Refresh UI
    setTimeout(async () => {
      await init();
      addToPlaylistBtn.innerHTML = originalHTML;
      addToPlaylistBtn.classList.remove('bg-neutral-700');
    }, 1000);
  } else {
    // Show error
    addToPlaylistBtn.innerHTML = `
      <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
      </svg>
      <span>Error</span>
    `;
    addToPlaylistBtn.classList.add('bg-red-900/30');

    setTimeout(() => {
      addToPlaylistBtn.innerHTML = originalHTML;
      addToPlaylistBtn.classList.remove('bg-red-900/30');
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
  const originalHTML = playNowBtn.innerHTML;

  playNowBtn.innerHTML = `
    <svg class="w-4 h-4 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
    </svg>
    <span>Opening...</span>
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
    playNowBtn.innerHTML = originalHTML;
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
  const originalHTML = clearPlaylistBtn.innerHTML;

  clearPlaylistBtn.innerHTML = `
    <svg class="w-4 h-4 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
    </svg>
    <span>Clearing...</span>
  `;

  await chrome.runtime.sendMessage({ cmd: MESSAGES.CLEAR_PLAYLIST });

  // Refresh UI
  await init();

  clearPlaylistBtn.innerHTML = originalHTML;
  clearPlaylistBtn.disabled = false;
}

// Event Listeners
addToPlaylistBtn.addEventListener('click', addToPlaylist);
playNowBtn.addEventListener('click', playNow);
openPlaylistBtn.addEventListener('click', openPlaylist);
clearPlaylistBtn.addEventListener('click', clearPlaylist);

// Initialize on load
init();