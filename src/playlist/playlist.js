import Hls from 'hls.js';
import { MESSAGES, VIDEO_TYPES } from '../utils/constants.js';
import { getVideos, getCurrentIndex, setCurrentIndex, removeVideo } from '../utils/storage.js';

console.log('🎬 Playlist page loaded');

// DOM Elements
const emptyState = document.getElementById('emptyState');
const playerContent = document.getElementById('playerContent');
const videoPlayer = document.getElementById('videoPlayer');
const videoContainer = document.getElementById('videoContainer');
const videoControls = document.getElementById('videoControls');
const currentVideoTitle = document.getElementById('currentVideoTitle');
const currentVideoDomain = document.getElementById('currentVideoDomain');
const currentVideoType = document.getElementById('currentVideoType');
const queueCount = document.getElementById('queueCount');
const playlistItems = document.getElementById('playlistItems');
const prevBtn = document.getElementById('prevBtn');
const nextBtn = document.getElementById('nextBtn');
const playPauseBtn = document.getElementById('playPauseBtn');
const playPauseBtn2 = document.getElementById('playPauseBtn2');
const playIcon = document.getElementById('playIcon');
const pauseIcon = document.getElementById('pauseIcon');
const playIcon2 = document.getElementById('playIcon2');
const pauseIcon2 = document.getElementById('pauseIcon2');
const loopBtn = document.getElementById('loopBtn');
const loopBtn2 = document.getElementById('loopBtn2');
const clearAllBtn = document.getElementById('clearAllBtn');
const closeTabBtn = document.getElementById('closeTabBtn');
const closeTabBtn2 = document.getElementById('closeTabBtn2');
const notificationBanner = document.getElementById('notificationBanner');
const notificationText = document.getElementById('notificationText');
const closeNotificationBtn = document.getElementById('closeNotificationBtn');
const progressBar = document.getElementById('progressBar');
const volumeSlider = document.getElementById('volumeSlider');
const fullscreenBtn = document.getElementById('fullscreenBtn');
const currentTimeEl = document.getElementById('currentTime');
const durationEl = document.getElementById('duration');

// State
let videos = [];
let currentIndex = 0;
let hls = null;
let isLooping = false;
let notificationTimeout = null;
let controlsTimeout = null;

// Listen for messages from service worker about playlist updates
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  const { cmd, data } = message;
  
  console.log('📨 Playlist received message:', cmd);
  
  // Handle async operations properly
  (async () => {
    try {
      switch (cmd) {
        case MESSAGES.VIDEO_ADDED:
          await handleVideoAddedUpdate(data);
          break;
          
        case MESSAGES.VIDEO_REMOVED:
          await handleVideoRemovedUpdate(data);
          break;
          
        case MESSAGES.PLAYLIST_CLEARED:
          await handlePlaylistClearedUpdate();
          break;
          
        default:
          // Let other listeners handle unknown messages
          return;
      }
      
      sendResponse({ received: true });
    } catch (error) {
      console.error('Error handling message:', error);
      sendResponse({ error: error.message });
    }
  })();
  
  return true; // Keep channel open for async response
});

/**
 * Handle video added update from service worker
 */
async function handleVideoAddedUpdate(newVideo) {
  console.log('📺 Video added to playlist:', newVideo.title);
  
  // Reload videos from storage
  const updatedVideos = await getVideos();
  
  // Only update if there are actually new videos
  if (updatedVideos.length <= videos.length) {
    console.log('No new videos to add');
    return;
  }
  
  videos = updatedVideos;
  
  // If playlist was empty, show player
  if (videos.length === 1) {
    showPlayer();
    currentIndex = 0;
    await setCurrentIndex(currentIndex);
    playVideoAtIndex(currentIndex);
  } else {
    // Playlist already had videos, just update the list
    renderPlaylist();
  }
  
  console.log(`✅ Playlist updated. Total videos: ${videos.length}`);
}

/**
 * Handle video removed update from service worker
 */
async function handleVideoRemovedUpdate(data) {
  const { videoId } = data;
  console.log('🗑️ Video removed from playlist:', videoId);
  
  // Reload videos from storage
  const newVideos = await getVideos();
  const removedIndex = videos.findIndex(v => v.id === videoId);
  videos = newVideos;
  
  if (videos.length === 0) {
    showEmptyState();
    if (hls) {
      hls.destroy();
      hls = null;
    }
    return;
  }
  
  // Adjust current index if necessary
  if (removedIndex < currentIndex) {
    currentIndex--;
    await setCurrentIndex(currentIndex);
  } else if (removedIndex === currentIndex) {
    // Currently playing video was removed
    if (currentIndex >= videos.length) {
      currentIndex = videos.length - 1;
    }
    await setCurrentIndex(currentIndex);
    playVideoAtIndex(currentIndex);
  }
  
  // Re-render playlist
  renderPlaylist();
}

/**
 * Handle playlist cleared update from service worker
 */
async function handlePlaylistClearedUpdate() {
  console.log('🧹 Playlist cleared');
  
  videos = [];
  currentIndex = 0;
  showEmptyState();
  
  if (hls) {
    hls.destroy();
    hls = null;
  }
  
  videoPlayer.src = '';
  console.log('✅ Playlist cleared');
}

/**
 * Initialize playlist page
 */
async function init() {
  // Register this tab as the playlist tab
  const currentTab = await chrome.tabs.getCurrent();
  if (currentTab?.id) {
    await chrome.storage.session.set({
      'playlistTabId': currentTab.id
    });
    console.log(`📌 Registered playlist tab ID: ${currentTab.id}`);
  }
  
  videos = await getVideos();
  currentIndex = await getCurrentIndex();
  
  console.log(`📋 Loaded ${videos.length} videos, current index: ${currentIndex}`);
  
  if (videos.length === 0) {
    showEmptyState();
  } else {
    showPlayer();
    renderPlaylist();
    playVideoAtIndex(currentIndex);
  }
  
  // Initialize all control listeners
  initializeControls();
}

/**
 * Initialize overlay control event listeners
 */
function initializeControls() {
  // Overlay play/pause button
  if (playPauseBtn2) {
    playPauseBtn2.addEventListener('click', () => {
      if (videoPlayer.paused) {
        videoPlayer.play().catch(err => {
          if (err.name !== 'AbortError') {
            console.error('Play error:', err);
          }
        });
      } else {
        videoPlayer.pause();
      }
    });
  }
  
  // Main video area play/pause toggle (spacebar already handled in keydown)
  if (playPauseBtn) {
    playPauseBtn.addEventListener('click', () => {
      if (videoPlayer.paused) {
        videoPlayer.play().catch(err => {
          if (err.name !== 'AbortError') {
            console.error('Play error:', err);
          }
        });
      } else {
        videoPlayer.pause();
      }
    });
  }
  
  // Progress bar interaction
  if (progressBar) {
    // Update on timeupdate
    videoPlayer.addEventListener('timeupdate', () => {
      if (videoPlayer.duration) {
        const percent = (videoPlayer.currentTime / videoPlayer.duration) * 100;
        progressBar.value = percent;
        progressBar.style.setProperty('--progress-width', percent + '%');
        updateTimeDisplay();
      }
    });
    
    // Seek on click
    progressBar.addEventListener('click', (e) => {
      const rect = progressBar.getBoundingClientRect();
      const percent = (e.clientX - rect.left) / rect.width;
      videoPlayer.currentTime = percent * videoPlayer.duration;
    });
    
    // Allow drag to seek
    progressBar.addEventListener('input', (e) => {
      const percent = e.target.value / 100;
      videoPlayer.currentTime = percent * videoPlayer.duration;
      progressBar.style.setProperty('--progress-width', e.target.value + '%');
    });
  }
  
  // Volume slider
  if (volumeSlider) {
    volumeSlider.value = videoPlayer.volume * 100;
    volumeSlider.addEventListener('input', (e) => {
      videoPlayer.volume = e.target.value / 100;
    });
  }
  
  // Fullscreen button
  if (fullscreenBtn) {
    fullscreenBtn.addEventListener('click', () => {
      if (!document.fullscreenElement) {
        videoContainer.requestFullscreen().catch(err => {
          console.error('Fullscreen error:', err);
        });
      } else {
        document.exitFullscreen();
      }
    });
  }
  
  // Loop button (overlay)
  if (loopBtn2) {
    loopBtn2.addEventListener('click', toggleLoop);
  }
  
  // Video controls auto-hide on inactivity
  if (videoContainer) {
    videoContainer.addEventListener('mousemove', showOverlayControls);
    videoContainer.addEventListener('mouseleave', () => {
      // Hide controls immediately when mouse leaves
      hideOverlayControls();
    });
    
    // Play/pause on video click
    videoContainer.addEventListener('click', (e) => {
      // Don't toggle if clicking on controls
      if (e.target.closest('#videoControls')) return;
      togglePlayPause();
    });
  }
  
  // Next/Prev buttons
  if (nextBtn) {
    nextBtn.addEventListener('click', () => playNext());
  }
  if (prevBtn) {
    prevBtn.addEventListener('click', () => playPrev());
  }
  
  // Main loop button
  if (loopBtn) {
    loopBtn.addEventListener('click', toggleLoop);
  }
  
  // Clear all button
  if (clearAllBtn) {
    clearAllBtn.addEventListener('click', () => {
      chrome.runtime.sendMessage({
        cmd: MESSAGES.CLEAR_PLAYLIST
      });
    });
  }
  
  // Close tab buttons
  if (closeTabBtn) {
    closeTabBtn.addEventListener('click', () => {
      chrome.tabs.getCurrent(tab => {
        chrome.tabs.remove(tab.id);
      });
    });
  }
  if (closeTabBtn2) {
    closeTabBtn2.addEventListener('click', () => {
      chrome.tabs.getCurrent(tab => {
        chrome.tabs.remove(tab.id);
      });
    });
  }
  
  // Close notification
  if (closeNotificationBtn) {
    closeNotificationBtn.addEventListener('click', hideNotification);
  }
  
  // Keyboard shortcuts
  document.addEventListener('keydown', handleKeyboardShortcuts);
}

/**
 * Show overlay controls and reset auto-hide timeout
 */
function showOverlayControls() {
  if (videoControls) {
    videoControls.classList.remove('opacity-0');
    videoControls.classList.add('opacity-100');
  }
  
  // Clear existing timeout
  if (controlsTimeout) {
    clearTimeout(controlsTimeout);
  }
  
  // Set new timeout to hide after 3 seconds of inactivity
  if (!videoPlayer.paused) {
    controlsTimeout = setTimeout(() => {
      hideOverlayControls();
    }, 3000);
  }
}

/**
 * Hide overlay controls
 */
function hideOverlayControls() {
  if (videoControls && !videoPlayer.paused) {
    videoControls.classList.add('opacity-0');
    videoControls.classList.remove('opacity-100');
  }
}

/**
 * Update time display (currentTime / duration)
 */
function updateTimeDisplay() {
  if (!currentTimeEl || !durationEl) return;
  
  // Format current time
  const current = isNaN(videoPlayer.currentTime) ? 0 : videoPlayer.currentTime;
  currentTimeEl.textContent = formatSeconds(current);
  
  // Format duration
  const duration = isNaN(videoPlayer.duration) ? 0 : videoPlayer.duration;
  durationEl.textContent = formatSeconds(duration);
}

/**
 * Format seconds to MM:SS
 */
function formatSeconds(seconds) {
  if (isNaN(seconds) || !isFinite(seconds)) return '0:00';
  
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

/**
 * Handle keyboard shortcuts
 */
function handleKeyboardShortcuts(e) {
  // Don't trigger if user is typing in an input
  if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
  
  switch (e.key) {
    case ' ':
      e.preventDefault();
      togglePlayPause();
      break;
    case 'ArrowLeft':
      e.preventDefault();
      videoPlayer.currentTime = Math.max(0, videoPlayer.currentTime - 5);
      break;
    case 'ArrowRight':
      e.preventDefault();
      videoPlayer.currentTime = Math.min(videoPlayer.duration, videoPlayer.currentTime + 5);
      break;
    case 'ArrowUp':
      e.preventDefault();
      videoPlayer.volume = Math.min(1, videoPlayer.volume + 0.1);
      break;
    case 'ArrowDown':
      e.preventDefault();
      videoPlayer.volume = Math.max(0, videoPlayer.volume - 0.1);
      break;
    case 'n':
    case 'N':
      e.preventDefault();
      playNext();
      break;
    case 'p':
    case 'P':
      e.preventDefault();
      playPrev();
      break;
    case 'l':
    case 'L':
      e.preventDefault();
      toggleLoop();
      break;
  }
}

/**
 * Show empty state
 */
function showEmptyState() {
  emptyState.classList.remove('hidden');
  playerContent.classList.add('hidden');
}

/**
 * Show player
 */
function showPlayer() {
  emptyState.classList.add('hidden');
  playerContent.classList.remove('hidden');
}

/**
 * Render playlist items
 */
function renderPlaylist() {
  playlistItems.innerHTML = '';
  queueCount.textContent = `${videos.length} video${videos.length !== 1 ? 's' : ''}`;
  
  videos.forEach((video, index) => {
    const item = createPlaylistItem(video, index);
    playlistItems.appendChild(item);
  });
  
  updatePlaylistHighlight();
}

/**
 * Create playlist item element
 */
function createPlaylistItem(video, index) {
  const div = document.createElement('div');
  div.className = 'group cursor-pointer rounded-lg p-2 hover:bg-gray-700 transition-colors';
  div.dataset.index = index;
  
  const isPlaying = index === currentIndex;
  
  div.innerHTML = `
    <div class="flex items-start gap-2">
      <div class="w-12 h-9 flex-shrink-0 rounded flex items-center justify-center relative" style="background-color: ${video.thumbnailColor || '#666'}">
        <svg class="w-6 h-6 text-white" fill="currentColor" viewBox="0 0 24 24">
          <path d="M8 5v14l11-7z"/>
        </svg>
        ${isPlaying ? '<div class="absolute inset-0 bg-black/50 flex items-center justify-center"><div class="w-2 h-2 bg-white rounded-full animate-pulse"></div></div>' : ''}
      </div>
      <div class="flex-1 min-w-0">
        <div class="flex items-start justify-between gap-2">
          <div class="flex-1 min-w-0">
            <h4 class="text-sm font-medium truncate ${isPlaying ? 'text-youtube-red' : 'text-white'}">
              ${video.title || 'Untitled Video'}
            </h4>
            <p class="text-xs text-gray-400 truncate">${video.domain || 'Unknown'}</p>
          </div>
          <button class="remove-btn opacity-0 group-hover:opacity-100 p-1 hover:bg-gray-600 rounded transition-opacity" data-id="${video.id}" title="Remove">
            <svg class="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
            </svg>
          </button>
        </div>
      </div>
    </div>
  `;
  
  // Click to play
  div.addEventListener('click', (e) => {
    if (!e.target.closest('.remove-btn')) {
      playVideoAtIndex(index);
    }
  });
  
  // Remove button
  const removeBtn = div.querySelector('.remove-btn');
  removeBtn.addEventListener('click', async (e) => {
    e.stopPropagation();
    await handleRemoveVideo(video.id);
  });
  
  return div;
}

/**
 * Update playlist highlight
 */
function updatePlaylistHighlight() {
  const items = playlistItems.querySelectorAll('[data-index]');
  items.forEach((item, index) => {
    if (index === currentIndex) {
      item.classList.add('bg-gray-700');
    } else {
      item.classList.remove('bg-gray-700');
    }
  });
}

/**
 * Play video at specific index
 */
async function playVideoAtIndex(index) {
  if (index < 0 || index >= videos.length) {
    console.log('Invalid index:', index);
    return;
  }
  
  currentIndex = index;
  await setCurrentIndex(currentIndex);
  
  const video = videos[currentIndex];
  console.log('▶️ Playing video:', video.title);
  
  // Update UI
  currentVideoTitle.textContent = video.title || 'Untitled Video';
  currentVideoDomain.textContent = video.domain || 'Unknown source';
  currentVideoType.textContent = video.type || 'unknown';
  
  // Update button states
  prevBtn.disabled = currentIndex === 0;
  nextBtn.disabled = currentIndex === videos.length - 1;
  
  // Update playlist highlight
  updatePlaylistHighlight();
  
  // Scroll to current item in playlist
  const currentItem = playlistItems.querySelector(`[data-index="${currentIndex}"]`);
  if (currentItem) {
    currentItem.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }
  
  // Initialize time display
  updateTimeDisplay();
  
  // Load and play video
  loadVideo(video);
}

/**
 * Load video into player
 */
function loadVideo(video) {
  // Clean up previous HLS instance
  if (hls) {
    hls.destroy();
    hls = null;
  }
  
  // Stop current video playback
  videoPlayer.pause();
  videoPlayer.src = '';
  
  const { url, manifest, type } = video;
  const videoUrl = manifest || url;
  
  console.log('📺 Loading video:', videoUrl, 'type:', type);
  
  if (type === VIDEO_TYPES.HLS) {
    // HLS video
    if (Hls.isSupported()) {
      hls = new Hls({
        debug: false,
        enableWorker: true,
        lowLatencyMode: false,
      });
      
      hls.loadSource(videoUrl);
      hls.attachMedia(videoPlayer);
      
      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        console.log('✅ HLS manifest parsed');
        hideNotification(); // Clear any loading errors
        videoPlayer.play().catch(err => {
          // Ignore AbortError - it means another video was loaded
          if (err.name === 'AbortError') {
            console.log('Play interrupted by new load request (normal)');
            return;
          }
          console.error('Playback error:', err);
          showNotification(`❌ Error al reproducir video: ${err.message}`);
        });
      });
      
      hls.on(Hls.Events.ERROR, (event, data) => {
        console.error('HLS error:', data);
        
        if (data.fatal) {
          let errorMessage = 'Error desconocido';
          let shouldRecovery = true;
          
          switch (data.type) {
            case Hls.ErrorTypes.NETWORK_ERROR:
              errorMessage = '🌐 Error de red. Reintentando...';
              console.log('Network error, trying to recover...');
              hls.startLoad();
              showNotification(errorMessage, 3000);
              return;
              
            case Hls.ErrorTypes.MEDIA_ERROR:
              // Check for codec errors or other unrecoverable issues
              if (data.details === 'bufferAddCodecError' || 
                  data.details === 'fpsDropLevelCapping' ||
                  data.details === 'manifestIncompatibleCodecsError') {
                errorMessage = `❌ Problema de codec/formato. Pasando al siguiente video...`;
                shouldRecovery = false;
                console.error('Unrecoverable media error (codec issue), skipping video');
              } else {
                errorMessage = '📽️ Error de media. Reintentando...';
                console.log('Media error, trying to recover...');
                try {
                  hls.recoverMediaError();
                  showNotification(errorMessage, 3000);
                  return;
                } catch (err) {
                  // Recovery failed, treat as fatal
                  shouldRecovery = false;
                  errorMessage = `❌ Error de media irrecuperable. Pasando al siguiente video...`;
                }
              }
              
              if (!shouldRecovery) {
                hls.destroy();
                hls = null;
                showNotification(errorMessage, 5000);
                
                setTimeout(() => {
                  console.log('Skipping to next video due to codec error...');
                  playNext();
                }, 5000);
              }
              return;
              
            default:
              errorMessage = `❌ Error: ${data.reason || 'No se pudo reproducir el video'}`;
              console.error('Fatal error, cannot recover');
              hls.destroy();
              hls = null;
              
              showNotification(errorMessage, 5000);
              
              setTimeout(() => {
                console.log('Attempting to play next video...');
                playNext();
              }, 5000);
          }
        }
      });
    } else if (videoPlayer.canPlayType('application/vnd.apple.mpegurl')) {
      // Native HLS support (Safari)
      videoPlayer.src = videoUrl;
      videoPlayer.play().catch(err => {
        if (err.name === 'AbortError') {
          console.log('Play interrupted by new load request (normal)');
          return;
        }
        console.error('Playback error:', err);
        showNotification(`❌ Error al reproducir video: ${err.message}`);
      });
    } else {
      showNotification('❌ HLS no es soportado en este navegador');
    }
  } else {
    // Direct video (MP4, WebM, etc.)
    videoPlayer.src = videoUrl;
    
    // Add error listener for direct videos
    const errorHandler = () => {
      const error = videoPlayer.error;
      let errorMessage = '❌ Error al reproducir video';
      
      if (error) {
        switch (error.code) {
          case error.MEDIA_ERR_ABORTED:
            console.log('Video playback aborted (normal when skipping)');
            return; // Don't show notification for aborts
          case error.MEDIA_ERR_NETWORK:
            errorMessage = '🌐 Error de red';
            break;
          case error.MEDIA_ERR_DECODE:
            errorMessage = '📝 Error al decodificar el video';
            break;
          case error.MEDIA_ERR_SRC_NOT_SUPPORTED:
            errorMessage = '❌ Formato de video no soportado';
            break;
        }
      }
      
      console.error('Video error:', errorMessage);
      showNotification(errorMessage, 5000);
      
      // Auto-play next video after error
      setTimeout(() => {
        console.log('Attempting to play next video...');
        playNext();
      }, 5000);
    };
    
    videoPlayer.addEventListener('error', errorHandler, { once: true });
    
    videoPlayer.play().catch(err => {
      if (err.name === 'AbortError') {
        console.log('Play interrupted by new load request (normal)');
        return;
      }
      console.error('Playback error:', err);
      showNotification(`❌ Error al reproducir video: ${err.message}`);
    });
  }
}

/**
 * Play next video
 */
function playNext() {
  if (currentIndex < videos.length - 1) {
    playVideoAtIndex(currentIndex + 1);
  } else if (isLooping) {
    playVideoAtIndex(0);
  }
}

/**
 * Play previous video
 */
function playPrev() {
  if (currentIndex > 0) {
    playVideoAtIndex(currentIndex - 1);
  }
}

/**
 * Toggle play/pause
 */
function togglePlayPause() {
  if (videoPlayer.paused) {
    videoPlayer.play();
  } else {
    videoPlayer.pause();
  }
}

/**
 * Toggle loop
 */
function toggleLoop() {
  isLooping = !isLooping;
  loopBtn.classList.toggle('text-youtube-red', isLooping);
  loopBtn.classList.toggle('bg-gray-700', isLooping);
  console.log('Loop:', isLooping);
}

/**
 * Handle remove video
 */
async function handleRemoveVideo(videoId) {
  const videoIndex = videos.findIndex(v => v.id === videoId);
  
  if (videoIndex === -1) return;
  
  // Remove from storage
  await removeVideo(videoId);
  
  // Update local state
  videos = await getVideos();
  
  // Adjust current index if necessary
  if (videoIndex < currentIndex) {
    currentIndex--;
    await setCurrentIndex(currentIndex);
  } else if (videoIndex === currentIndex) {
    // Currently playing video was removed
    if (videos.length === 0) {
      // No more videos
      showEmptyState();
      return;
    } else {
      // Play next video (or first if we were at the end)
      if (currentIndex >= videos.length) {
        currentIndex = videos.length - 1;
      }
      await playVideoAtIndex(currentIndex);
    }
  }
  
  // Re-render playlist
  renderPlaylist();
}

/**
 * Clear all videos
 */
async function handleClearAll() {
  if (!confirm('Clear all videos from playlist?')) return;
  
  await chrome.runtime.sendMessage({ cmd: MESSAGES.CLEAR_PLAYLIST });
  
  // Cleanup
  if (hls) {
    hls.destroy();
    hls = null;
  }
  
  videos = [];
  showEmptyState();
}

/**
 * Close tab
 */
function closeTab() {
  // Clean up playlist tab ID from storage
  chrome.storage.session.remove('playlistTabId');
  window.close();
}

// Video player event listeners
videoPlayer.addEventListener('ended', () => {
  console.log('Video ended, playing next...');
  playNext();
});

videoPlayer.addEventListener('play', () => {
  playIcon.classList.add('hidden');
  pauseIcon.classList.remove('hidden');
});

videoPlayer.addEventListener('pause', () => {
  playIcon.classList.remove('hidden');
  pauseIcon.classList.add('hidden');
});

// Button event listeners
prevBtn.addEventListener('click', playPrev);
nextBtn.addEventListener('click', playNext);
playPauseBtn.addEventListener('click', togglePlayPause);
loopBtn.addEventListener('click', toggleLoop);
clearAllBtn.addEventListener('click', handleClearAll);
closeTabBtn.addEventListener('click', closeTab);

// Note: Keyboard shortcuts are initialized in initializeControls()

/**
 * Show notification banner
 */
function showNotification(message, duration = 5000) {
  notificationText.textContent = message;
  notificationBanner.classList.remove('hidden');
  
  // Clear any existing timeout
  if (notificationTimeout) {
    clearTimeout(notificationTimeout);
  }
  
  // Auto-hide after duration
  if (duration > 0) {
    notificationTimeout = setTimeout(() => {
      hideNotification();
    }, duration);
  }
}

/**
 * Hide notification banner
 */
function hideNotification() {
  notificationBanner.classList.add('hidden');
  if (notificationTimeout) {
    clearTimeout(notificationTimeout);
    notificationTimeout = null;
  }
}

// Initialize on load
init();