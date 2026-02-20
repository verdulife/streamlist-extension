import Hls from "hls.js";
import { getVideos, getCurrentIndex, setCurrentIndex, removeVideo, getVolume, setVolume, getPreviousVolume, setPreviousVolume } from "../utils/storage.js";
import { VIDEO_TYPES, STORAGE_KEYS } from "../utils/constants.js";

const pageTitle = document.querySelector("title");
const videoPlayer = document.getElementById("videoPlayer");
const videoBlur = document.getElementById("videoBlur");
const playlistContainer = document.getElementById("playlist");

const MOCK_M3U8_URL = "https://demo.unified-streaming.com/k8s/features/stable/video/tears-of-steel/tears-of-steel.ism/.m3u8";

// State
let videos = [];
let currentIndex = 0;
let hlsPlayer = null;
let hlsBlur = null;

function videoPlay() {
  videoPlayer.play();
  videoBlur.play();
}

function videoPause() {
  videoPlayer.pause();
  videoBlur.pause();
}

function videoSrc(url) {
  videoPlayer.src = url;
  videoBlur.src = url;
}

async function init() {
  try {
    videos = await getVideos();
    currentIndex = await getCurrentIndex();

    if (videos.length === 0) {
      showEmptyMessage();
      renderPlaylist();
      return;
    }

    await loadVideoAtIndex(currentIndex);
    renderPlaylist();
  } catch (error) {
    console.error("❌ Error initializing playlist:", error);
    showEmptyMessage();
  }
}

async function loadVideoAtIndex(index) {
  const video = videos[index];

  pageTitle.textContent = video.title;
  updateVideoInfo();
  loadVideo(video);
}

function loadVideo(video) {
  const { url, manifest, type } = video;
  const videoUrl = manifest || url;
  // const videoUrl = MOCK_M3U8_URL;

  if (hlsPlayer) {
    hlsPlayer.destroy();
    hlsPlayer = null;
  }

  if (hlsBlur) {
    hlsBlur.destroy();
    hlsBlur = null;
  }

  videoPause();
  videoSrc("");

  if (type === VIDEO_TYPES.HLS && Hls.isSupported()) {
    hlsPlayer = new Hls({
      debug: false,
      enableWorker: true,
    });

    hlsBlur = new Hls({
      debug: false,
      enableWorker: true,
    });

    hlsPlayer.loadSource(videoUrl);
    hlsBlur.loadSource(videoUrl);
    hlsPlayer.attachMedia(videoPlayer);
    hlsBlur.attachMedia(videoBlur);

    hlsPlayer.on(Hls.Events.MANIFEST_PARSED, () => {
      videoPlay();
    });

    hlsPlayer.on(Hls.Events.ERROR, (_, data) => {
      console.error("❌ HLS Player error:", data);
    });

  } else {
    videoSrc(videoUrl);
    videoPlay();
  }
}

function renderPlaylist() {
  playlistContainer.innerHTML = '';

  if (videos.length === 0) {
    playlistContainer.innerHTML = '<div class="p-4 text-center text-neutral-400">No videos</div>';
    return;
  }

  const itemsContainer = document.createElement('div');
  itemsContainer.className = 'overflow-y-auto';
  videos.forEach((video, index) => {
    const item = document.createElement('div');
    item.className = `px-3 py-6 border-b border-neutral-900 cursor-pointer transition-colors ${index === currentIndex ? 'bg-neutral-800' : 'hover:bg-neutral-900'
      }`;
    item.dataset.index = index;

    item.innerHTML = /* html */`
      <div class="flex gap-3 items-center justify-between">
        <div class="flex gap-3 flex-1 min-w-0">
          <div class="w-12 h-9 flex-shrink-0 rounded bg-neutral-700 flex items-center justify-center">
            <svg class="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
              <path d="M8 5v14l11-7z"/>
            </svg>
          </div>
          <div class="min-w-0">
            <p class="text-[14px] font-medium line-clamp-3">${video.title || 'Untitled'}</p>
          </div>
        </div>
        <button class="delete-btn flex-shrink-0 p-1 rounded hover:bg-red-900/30 transition-colors" data-video-id="${video.id}" title="Delete">
          <svg class="w-4 h-4 text-neutral-400 hover:text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
          </svg>
        </button>
      </div>
    `;

    item.addEventListener('click', (e) => {
      if (e.target.closest('.delete-btn')) return; // Don't play if clicking delete
      playVideoByIndex(index);
    });

    const deleteBtn = item.querySelector('.delete-btn');
    deleteBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      deleteVideo(video.id);
    });

    itemsContainer.appendChild(item);
  });

  playlistContainer.appendChild(itemsContainer);
}

async function playVideoByIndex(index) {
  if (index < 0 || index >= videos.length) return;

  currentIndex = index;
  await setCurrentIndex(currentIndex);

  await loadVideoAtIndex(currentIndex);
  renderPlaylist();
  updateNextButtonDisplay();
}

function updateNextButtonDisplay() {
  const nextBtn = document.getElementById("nextBtn");
  const truncatedTitle = document.getElementById("truncatedTitle");
  const nextIndex = currentIndex + 1;

  if (nextIndex < videos.length) {
    nextBtn.classList.remove("hidden");
    truncatedTitle.textContent = videos[nextIndex].title || "Untitled";
  } else {
    nextBtn.classList.add("hidden");
  }
}

async function deleteVideo(videoId) {
  await removeVideo(videoId);
  videos = await getVideos();

  if (videos.length > 0 && currentIndex >= videos.length) {
    currentIndex = videos.length - 1;
    await setCurrentIndex(currentIndex);
    await loadVideoAtIndex(currentIndex);
  } else if (videos.length > 0) {
    await loadVideoAtIndex(currentIndex);
  } else {
    showEmptyMessage();
  }

  renderPlaylist();
  updateNextButtonDisplay();
}

function showEmptyMessage() {
  pageTitle.textContent = "No videos in playlist";
}

function listenForMessages() {
  chrome.runtime.onMessage.addListener(async (message, _, sendResponse) => {
    const { cmd } = message;

    if (cmd === 'video_added') {
      videos = await getVideos();
      renderPlaylist();
      updateNextButtonDisplay();
      sendResponse({ received: true });
    }

    if (cmd === 'play_now') {
      // For play_now, reload everything and force load index 0
      videos = await getVideos();
      currentIndex = await getCurrentIndex(); // Should be 0
      
      if (videos.length > 0) {
        await loadVideoAtIndex(currentIndex);
        renderPlaylist();
      }
      
      updateNextButtonDisplay();
      sendResponse({ received: true });
    }

    if (cmd === 'video_removed') {
      videos = await getVideos();
      if (currentIndex >= videos.length && videos.length > 0) {
        currentIndex = videos.length - 1;
        await setCurrentIndex(currentIndex);
      }
      renderPlaylist();
      updateNextButtonDisplay();
      sendResponse({ received: true });
    }

    if (cmd === 'playlist_cleared') {
      videos = [];
      currentIndex = 0;
      showEmptyMessage();
      renderPlaylist();
      updateNextButtonDisplay();
      sendResponse({ received: true });
    }
  });
}

async function registerPlaylistTab() {
  try {
    const tab = await chrome.tabs.getCurrent();
    if (tab?.id) {
      chrome.runtime.sendMessage({
        cmd: 'register_playlist_tab',
        data: { tabId: tab.id }
      }).catch(error => {
        console.log('Could not register playlist tab:', error);
      });
    }
  } catch (error) {
    console.error('Error registering playlist tab:', error);
  }
}

function listenForStorageChanges() {
  chrome.storage.session.onChanged.addListener(async (changes, areaName) => {
    if (areaName !== 'session') return;

    if (changes[STORAGE_KEYS.VIDEOS]) {
      console.log("📺 Playlist actualizada detectada");
      videos = await getVideos();

      if (videos.length === 0) {
        showEmptyMessage();
      } else {
        if (currentIndex >= videos.length) {
          currentIndex = 0;
          await setCurrentIndex(currentIndex);
        }
      }

      renderPlaylist();
      updateNextButtonDisplay();
    }
  });
}

// Helper functions
function formatTime(seconds) {
  if (!seconds || isNaN(seconds)) return "0:00";
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs < 10 ? "0" : ""}${secs}`;
}

function updateVideoInfo() {
  const videoPlayer = document.getElementById("videoPlayer");
  const current = videos[currentIndex];
  if (!current) return;

  // Get elements
  const titleEl = document.getElementById("videoInfoTitle");
  const urlEl = document.getElementById("videoInfoUrl");
  const typeEl = document.getElementById("videoInfoType");

  // Update title
  titleEl.textContent = current.title || "Untitled Video";

  // Update URL/Domain
  urlEl.textContent = current.domain || new URL(current.url).hostname;
  urlEl.title = current.url;

  // Update type
  const typeBadgeColor = current.type === "hls" ? "bg-blue-500" : "bg-purple-500";
  typeEl.innerHTML = `<span class="w-2 h-2 rounded-full ${typeBadgeColor}"></span>${current.type.toUpperCase()}`;
}

// Player Controls
async function setupPlayerControls() {
  const progressBar = document.getElementById("progressBar");
  const playBtn = document.getElementById("playBtn");
  const pauseBtn = document.getElementById("pauseBtn");
  const volumeBtn = document.getElementById("volumeBtn");
  const muteBtn = document.getElementById("muteBtn");
  const volumeSlider = document.getElementById("volumeSlider");
  const fullscreenBtn = document.getElementById("fullscreenBtn");
  const rewindBtn = document.getElementById("rewindBtn");
  const forwardBtn = document.getElementById("forwardBtn");
  const nextBtn = document.getElementById("nextBtn");
  const truncatedTitle = document.getElementById("truncatedTitle");
  const currentTimeEl = document.getElementById("currentTime");
  const totalTimeEl = document.getElementById("totalTime");
  const videoPlayer = document.getElementById("videoPlayer");
  const videoFooter = document.getElementById("videoFooter");

  // Track if user is dragging the progress bar
  let isDragging = false;
  let lastVolume = await getVolume();

  // Initialize volume to last saved (default: 1)
  videoPlayer.volume = lastVolume;
  volumeSlider.value = lastVolume;
  updateVolumeUI(lastVolume, volumeBtn, muteBtn);

  // Helper functions for time display
  function updateCurrentTime() {
    currentTimeEl.textContent = formatTime(videoPlayer.currentTime);
  }

  function updateTotalTime() {
    totalTimeEl.textContent = formatTime(videoPlayer.duration);
  }

  // Restaurar volumen cuando se carga un nuevo video
  videoPlayer.addEventListener("loadedmetadata", async () => {
    const savedVolume = await getVolume();
    videoPlayer.volume = savedVolume;
    volumeSlider.value = savedVolume;
    lastVolume = savedVolume;
    updateVolumeUI(savedVolume, volumeBtn, muteBtn);
    updateNextButtonUI();
    updateTotalTime();
    updateVideoInfo();
  });

  // Progress bar
  progressBar.addEventListener("mousedown", () => {
    isDragging = true;
  });

  document.addEventListener("mouseup", () => {
    isDragging = false;
  });

  progressBar.addEventListener("input", (e) => {
    const time = (parseFloat(e.target.value) / 100) * videoPlayer.duration;
    videoPlayer.currentTime = time;
  });

  // Actualizar barra de progreso con timeupdate para fluidez natural
  videoPlayer.addEventListener("timeupdate", () => {
    if (!isDragging && videoPlayer.duration) {
      const percent = (videoPlayer.currentTime / videoPlayer.duration) * 100 || 0;
      progressBar.value = percent;
      updateCurrentTime();
    }
  });

  // Play/Pause buttons
  playBtn.addEventListener("click", () => {
    videoPlay();
    playBtn.classList.add("hidden");
    pauseBtn.classList.remove("hidden");
  });

  pauseBtn.addEventListener("click", () => {
    videoPause();
    pauseBtn.classList.add("hidden");
    playBtn.classList.remove("hidden");
  });

  videoPlayer.addEventListener("play", () => {
    playBtn.classList.add("hidden");
    pauseBtn.classList.remove("hidden");
  });

  videoPlayer.addEventListener("pause", () => {
    pauseBtn.classList.add("hidden");
    playBtn.classList.remove("hidden");
  });

  // Rewind/Forward buttons
  rewindBtn.addEventListener("click", () => {
    videoPlayer.currentTime = Math.max(0, videoPlayer.currentTime - 10);
  });

  forwardBtn.addEventListener("click", () => {
    videoPlayer.currentTime = Math.min(videoPlayer.duration, videoPlayer.currentTime + 10);
  });

  // Volume controls
  volumeSlider.addEventListener("input", async (e) => {
    const volume = parseFloat(e.target.value);
    videoPlayer.volume = volume;
    lastVolume = volume;
    await setVolume(volume);
    updateVolumeUI(volume, volumeBtn, muteBtn);
  });

  volumeBtn.addEventListener("click", async () => {
    await setPreviousVolume(lastVolume);
    videoPlayer.volume = 0;
    volumeSlider.value = 0;
    updateVolumeUI(0, volumeBtn, muteBtn);
  });

  muteBtn.addEventListener("click", async () => {
    const previousVolume = await getPreviousVolume();
    videoPlayer.volume = previousVolume;
    volumeSlider.value = previousVolume;
    lastVolume = previousVolume;
    await setVolume(previousVolume);
    updateVolumeUI(previousVolume, volumeBtn, muteBtn);
  });

  // Fullscreen
  const videoContainer = document.getElementById("videoContainer");
  let clickTimeout;
  let autoHideTimeout;
  let isMouseMoving = false;

  // Toggle fullscreen button
  fullscreenBtn.addEventListener("click", async () => {
    try {
      if (!document.fullscreenElement) {
        await videoContainer.requestFullscreen();
      } else {
        await document.exitFullscreen();
      }
    } catch (error) {
      console.error("Error toggling fullscreen:", error);
    }
  });

  // Double click = fullscreen, single click = play/pause
  videoPlayer.addEventListener("click", (e) => {
    e.stopPropagation();

    if (clickTimeout) {
      clearTimeout(clickTimeout);
      clickTimeout = null;
      // Double click - toggle fullscreen
      toggleFullscreen();
    } else {
      clickTimeout = setTimeout(() => {
        // Single click - toggle play/pause
        if (videoPlayer.paused) {
          videoPlay();
        } else {
          videoPause();
        }
        clickTimeout = null;
      }, 250);
    }
  });

  // Auto-hide controls on mouse inactivity
  function resetAutoHide() {
    if (autoHideTimeout) {
      clearTimeout(autoHideTimeout);
    }

    // Show controls and cursor
    videoFooter.style.opacity = "1";
    videoContainer.style.cursor = "auto";
    isMouseMoving = true;

    // Set timeout to hide after 3 seconds
    autoHideTimeout = setTimeout(() => {
      videoFooter.style.opacity = "0";
      if (document.fullscreenElement === videoContainer) {
        videoContainer.style.cursor = "none";
      }
      isMouseMoving = false;
    }, 3000);
  }

  videoContainer.addEventListener("mousemove", resetAutoHide);
  videoContainer.addEventListener("mouseleave", () => {
    if (autoHideTimeout) {
      clearTimeout(autoHideTimeout);
    }
  });

  // Toggle fullscreen helper
  async function toggleFullscreen() {
    try {
      if (!document.fullscreenElement) {
        await videoContainer.requestFullscreen();
        resetAutoHide();
      } else {
        await document.exitFullscreen();
      }
    } catch (error) {
      console.error("Error toggling fullscreen:", error);
    }
  }

  // Next button
  nextBtn.addEventListener("click", () => {
    const nextIndex = currentIndex + 1;
    if (nextIndex < videos.length) {
      playVideoByIndex(nextIndex);
    }
  });

  // Update next button UI
  function updateNextButtonUI() {
    const nextIndex = currentIndex + 1;
    if (nextIndex < videos.length) {
      nextBtn.classList.remove("hidden");
      truncatedTitle.textContent = videos[nextIndex].title || "Untitled";
    } else {
      nextBtn.classList.add("hidden");
    }
  }

  // Initialize next button UI
  updateNextButtonUI();

  // Initialize time display
  updateTotalTime();
  updateCurrentTime();

  // Keyboard shortcuts
  document.addEventListener("keydown", (e) => {
    // Don't trigger if user is typing in an input
    if (e.target.tagName === "INPUT" && e.target.type !== "range") return;

    switch (e.key.toLowerCase()) {
      // Space: Play/Pause
      case " ":
        e.preventDefault();
        if (videoPlayer.paused) {
          videoPlay();
        } else {
          videoPause();
        }
        break;

      // M: Mute/Unmute
      case "m":
        e.preventDefault();
        if (videoPlayer.volume === 0) {
          // Unmute - restore previous volume
          muteBtn.click();
        } else {
          // Mute
          volumeBtn.click();
        }
        break;

      // Arrow keys for seeking and volume
      case "arrowleft":
        e.preventDefault();
        if (e.ctrlKey) {
          // Ctrl + Left: -30 seconds
          videoPlayer.currentTime = Math.max(0, videoPlayer.currentTime - 30);
        } else {
          // Left: -5 seconds
          videoPlayer.currentTime = Math.max(0, videoPlayer.currentTime - 5);
        }
        break;

      case "arrowright":
        e.preventDefault();
        if (e.ctrlKey) {
          // Ctrl + Right: +30 seconds
          videoPlayer.currentTime = Math.min(videoPlayer.duration, videoPlayer.currentTime + 30);
        } else {
          // Right: +5 seconds
          videoPlayer.currentTime = Math.min(videoPlayer.duration, videoPlayer.currentTime + 5);
        }
        break;

      case "arrowup":
        e.preventDefault();
        // Up arrow: increase volume (+0.1 = 10 steps)
        const newVolumeUp = Math.min(1, videoPlayer.volume + 0.1);
        videoPlayer.volume = newVolumeUp;
        volumeSlider.value = newVolumeUp;
        lastVolume = newVolumeUp;
        setVolume(newVolumeUp);
        updateVolumeUI(newVolumeUp, volumeBtn, muteBtn);
        break;

      case "arrowdown":
        e.preventDefault();
        // Down arrow: decrease volume (-0.1 = 10 steps)
        const newVolumeDown = Math.max(0, videoPlayer.volume - 0.1);
        videoPlayer.volume = newVolumeDown;
        volumeSlider.value = newVolumeDown;
        lastVolume = newVolumeDown;
        setVolume(newVolumeDown);
        updateVolumeUI(newVolumeDown, volumeBtn, muteBtn);
        break;
    }
  });

  // Stop propagation on controls
  videoFooter?.addEventListener("click", (e) => {
    e.stopPropagation();
  });

  videoPlayer.addEventListener("ended", () => {
    pauseBtn.classList.add("hidden");
    playBtn.classList.remove("hidden");
  });
}

function updateVolumeUI(volume, volumeBtn, muteBtn) {
  if (volume === 0) {
    volumeBtn.classList.add("hidden");
    muteBtn.classList.remove("hidden");
  } else {
    muteBtn.classList.add("hidden");
    volumeBtn.classList.remove("hidden");
  }
}

registerPlaylistTab();
listenForMessages();
listenForStorageChanges();

(async () => {
  await init();
  await setupPlayerControls();
})();