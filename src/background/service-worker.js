import { MESSAGES } from '../utils/constants.js';
import {
  getVideos,
  addVideo,
  addVideoAtStart,
  removeVideo,
  clearAllVideos,
  updateBadge,
  getPlaylistTabId,
  setPlaylistTabId,
  getCurrentIndex,
  setCurrentIndex
} from '../utils/storage.js';
import { extractVideoInfo, generateThumbnailColor } from '../utils/detector.js';

// Track active tabs to get page info
const tabInfo = new Map();

// Listen for web requests to detect video streams
chrome.webRequest.onHeadersReceived.addListener(
  async (details) => {
    const { url, statusCode, responseHeaders, tabId } = details;

    // Only process successful requests
    if (statusCode < 200 || statusCode >= 300) {
      return;
    }

    // Extract video info
    const videoInfo = extractVideoInfo(details);

    if (videoInfo) {
      console.log('🎥 Video detected:', url);

      // Get page title from tab if available
      try {
        const tab = await chrome.tabs.get(tabId);
        if (tab?.title && !tab.title.startsWith('chrome://')) {
          videoInfo.title = tab.title;
        }
      } catch (error) {
        console.log('Could not get tab info:', error);
      }

      // Generate thumbnail color
      videoInfo.thumbnailColor = generateThumbnailColor(videoInfo.domain);

      // Store in tab info (for popup to use)
      tabInfo.set(tabId, videoInfo);

      // Update badge to show video is available
      await updateBadge();
    }
  },
  { urls: ['<all_urls>'] },
  ['responseHeaders']
);

// Listen for messages from content scripts and popup
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  const { cmd, data } = message;

  switch (cmd) {
    case 'register_playlist_tab':
      handleRegisterPlaylistTab(data, sender);
      break;

    case MESSAGES.VIDEO_DETECTED:
      handleVideoDetected(data, sender);
      break;

    case MESSAGES.MSE_SEGMENT_CAPTURED:
      handleMSESegment(data, sender);
      break;

    case MESSAGES.GET_VIDEOS:
      handleGetVideos(sendResponse);
      return true; // Keep channel open for async response

    case MESSAGES.ADD_TO_PLAYLIST:
      handleAddToPlaylist(data, sendResponse);
      return true;

    case MESSAGES.PLAY_NOW:
      handlePlayNow(data, sendResponse);
      return true;

    case MESSAGES.CLEAR_PLAYLIST:
      handleClearPlaylist(sendResponse);
      return true;

    case MESSAGES.REMOVE_VIDEO:
      handleRemoveVideo(data, sendResponse);
      return true;

    case MESSAGES.PLAY_VIDEO_AT_INDEX:
      handlePlayVideoAtIndex(data, sendResponse);
      return true;
  }
});

/**
 * Handle playlist tab registration
 */
async function handleRegisterPlaylistTab(data, sender) {
  const tabId = sender.tab?.id;
  if (tabId) {
    await setPlaylistTabId(tabId);
    console.log(`📌 Playlist tab registered: ${tabId}`);
  }
}

/**
 * Handle video detected from content script
 */
async function handleVideoDetected(videoInfo, sender) {
  const tabId = sender.tab?.id;
  if (tabId) {
    tabInfo.set(tabId, videoInfo);
    await updateBadge();
  }
}

/**
 * Handle MSE segment captured
 */
async function handleMSESegment(segmentInfo, sender) {
  console.log('📦 MSE segment captured:', segmentInfo);

  // TODO: Store segments for MSE-based videos
  // For now, we'll just log them
}

/**
 * Get current video for the active tab
 */
async function handleGetVideos(sendResponse) {
  try {
    // Get current active tab
    const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });

    // Get video info for this tab
    const currentVideo = activeTab ? tabInfo.get(activeTab.id) : null;

    // Get all videos in playlist
    const allVideos = await getVideos();

    sendResponse({
      success: true,
      currentVideo,
      allVideos,
      count: allVideos.length
    });
  } catch (error) {
    console.error('Error getting videos:', error);
    sendResponse({ success: false, error: error.message });
  }
}

/**
 * Add current video to playlist
 */
async function handleAddToPlaylist(data, sendResponse) {
  try {
    const { video } = data;

    if (!video) {
      // Get video from active tab
      const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
      const currentVideo = activeTab ? tabInfo.get(activeTab.id) : null;

      if (!currentVideo) {
        sendResponse({ success: false, error: 'No video detected on this page' });
        return;
      }

      const added = await addVideo(currentVideo);
      await updateBadge();

      // Notify playlist tab if open
      if (added) {
        await notifyPlaylistUpdate(MESSAGES.VIDEO_ADDED, currentVideo);
      }

      sendResponse({ success: added });
    } else {
      const added = await addVideo(video);
      await updateBadge();

      // Notify playlist tab if open
      if (added) {
        await notifyPlaylistUpdate(MESSAGES.VIDEO_ADDED, video);
      }

      sendResponse({ success: added });
    }
  } catch (error) {
    console.error('Error adding to playlist:', error);
    sendResponse({ success: false, error: error.message });
  }
}

/**
 * Play video now (add to start of playlist and open playlist page)
 */
async function handlePlayNow(data, sendResponse) {
  try {
    const { video } = data;

    if (!video) {
      // Get video from active tab
      const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
      const currentVideo = activeTab ? tabInfo.get(activeTab.id) : null;

      if (!currentVideo) {
        sendResponse({ success: false, error: 'No video detected on this page' });
        return;
      }

      // Add to start of playlist
      const added = await addVideoAtStart(currentVideo);
      
      if (added) {
        // Set to play from index 0
        await setCurrentIndex(0);
        await updateBadge();

        // Notify playlist tab if open
        await notifyPlaylistUpdate(MESSAGES.PLAY_NOW, currentVideo);
      }

      // Open or focus playlist tab
      await openPlaylistTab();

      sendResponse({ success: added });
    } else {
      // Add to start of playlist
      const added = await addVideoAtStart(video);
      
      if (added) {
        // Set to play from index 0
        await setCurrentIndex(0);
        await updateBadge();

        // Notify playlist tab if open
        await notifyPlaylistUpdate(MESSAGES.PLAY_NOW, video);
      }

      // Open or focus playlist tab
      await openPlaylistTab();

      sendResponse({ success: added });
    }
  } catch (error) {
    console.error('Error playing now:', error);
    sendResponse({ success: false, error: error.message });
  }
}

/**
 * Clear all videos from playlist
 */
async function handleClearPlaylist(sendResponse) {
  try {
    await clearAllVideos();
    await updateBadge();

    // Clear tab info
    tabInfo.clear();

    // Notify playlist tab if open
    await notifyPlaylistUpdate(MESSAGES.PLAYLIST_CLEARED, null);

    sendResponse({ success: true });
  } catch (error) {
    console.error('Error clearing playlist:', error);
    sendResponse({ success: false, error: error.message });
  }
}

/**
 * Remove a video from playlist
 */
async function handleRemoveVideo(data, sendResponse) {
  try {
    const { videoId } = data;
    const remaining = await removeVideo(videoId);
    await updateBadge();

    // Notify playlist tab if open
    await notifyPlaylistUpdate(MESSAGES.VIDEO_REMOVED, { videoId });

    sendResponse({ success: true, remaining });
  } catch (error) {
    console.error('Error removing video:', error);
    sendResponse({ success: false, error: error.message });
  }
}

/**
 * Play video at specific index
 */
async function handlePlayVideoAtIndex(data, sendResponse) {
  try {
    const { index } = data;
    await setCurrentIndex(index);

    sendResponse({ success: true });
  } catch (error) {
    console.error('Error setting video index:', error);
    sendResponse({ success: false, error: error.message });
  }
}

/**
 * Open or focus the playlist tab
 */
async function openPlaylistTab() {
  const playlistUrl = chrome.runtime.getURL('src/playlist/playlist.html');

  // Check if playlist tab already exists
  const existingTabId = await getPlaylistTabId();

  if (existingTabId) {
    try {
      // Try to focus existing tab
      const tab = await chrome.tabs.get(existingTabId);
      await chrome.tabs.update(existingTabId, { active: true });
      await chrome.windows.update(tab.windowId, { focused: true });
      return;
    } catch {
      // Tab doesn't exist anymore, create new one
    }
  }

  // Create new playlist tab
  const tab = await chrome.tabs.create({ url: playlistUrl });
  await setPlaylistTabId(tab.id);
}

// Clean up tab info when tabs are closed
chrome.tabs.onRemoved.addListener((tabId) => {
  tabInfo.delete(tabId);
});

// Handle extension icon click (open popup is default, but we can add logic here)
chrome.action.onClicked.addListener(async (tab) => {
  // This won't fire if popup is defined, but keeping it for reference
  console.log('Extension icon clicked on tab:', tab.id);
});

// Initialize badge on startup
updateBadge();

/**
 * Notify playlist tab about updates (fire and forget)
 */
async function notifyPlaylistUpdate(messageType, data) {
  try {
    const playlistTabId = await getPlaylistTabId();

    if (playlistTabId) {
      // Send message without waiting for response to avoid conflicts
      chrome.tabs.sendMessage(playlistTabId, {
        cmd: messageType,
        data: data
      }).catch(error => {
        // Tab doesn't exist or is not responsive, clear the stored ID
        console.log('Playlist tab not responsive, clearing stored ID:', error.message);
        setPlaylistTabId(null);
      });

      console.log(`📢 Notified playlist about ${messageType}`);
    }
  } catch (error) {
    console.error('Error notifying playlist:', error);
  }
}