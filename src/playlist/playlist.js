import Hls from "hls.js";
import { getVideos, getCurrentIndex, setCurrentIndex, removeVideo } from "../utils/storage.js";
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
      <div class="flex gap-3 items-center justify-between p">
        <div class="flex gap-3 flex-1 min-w-0">
          <div class="w-12 h-9 flex-shrink-0 rounded bg-neutral-700 flex items-center justify-center">
            <svg class="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
              <path d="M8 5v14l11-7z"/>
            </svg>
          </div>
          <div class="min-w-0">
            <p class="text-[14px] font-medium">${video.title || 'Untitled'}</p>
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
      sendResponse({ received: true });
    }

    if (cmd === 'video_removed') {
      videos = await getVideos();
      if (currentIndex >= videos.length && videos.length > 0) {
        currentIndex = videos.length - 1;
        await setCurrentIndex(currentIndex);
      }
      renderPlaylist();
      sendResponse({ received: true });
    }

    if (cmd === 'playlist_cleared') {
      videos = [];
      currentIndex = 0;
      showEmptyMessage();
      renderPlaylist();
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
    }
  });
}

// Player Controls
function setupPlayerControls() {
  const progressBar = document.getElementById("progressBar");
  const playBtn = document.getElementById("playBtn");
  const pauseBtn = document.getElementById("pauseBtn");
  const volumeBtn = document.getElementById("volumeBtn");
  const muteBtn = document.getElementById("muteBtn");
  const volumeSlider = document.getElementById("volumeSlider");
  const fullscreenBtn = document.getElementById("fullscreenBtn");
  const videoPlayer = document.getElementById("videoPlayer");
  const videoFooter = document.getElementById("videoFooter");

  // Track if user is dragging the progress bar
  let isDragging = false;

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

  // Actualizar progress bar suavemente con requestAnimationFrame
  function updateProgressBar() {
    if (!isDragging && videoPlayer.duration) {
      const percent = (videoPlayer.currentTime / videoPlayer.duration) * 100 || 0;
      progressBar.value = percent;
    }
    requestAnimationFrame(updateProgressBar);
  }

  updateProgressBar();

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
  volumeSlider.addEventListener("input", (e) => {
    const volume = parseFloat(e.target.value);
    videoPlayer.volume = volume;

    if (volume === 0) {
      volumeBtn.classList.add("hidden");
      muteBtn.classList.remove("hidden");
    } else {
      muteBtn.classList.add("hidden");
      volumeBtn.classList.remove("hidden");
    }
  });

  volumeBtn.addEventListener("click", () => {
    videoPlayer.volume = 0;
    volumeSlider.value = 0;
    volumeBtn.classList.add("hidden");
    muteBtn.classList.remove("hidden");
  });

  muteBtn.addEventListener("click", () => {
    videoPlayer.volume = 0.5;
    volumeSlider.value = 0.5;
    muteBtn.classList.add("hidden");
    volumeBtn.classList.remove("hidden");
  });

  // Fullscreen
  fullscreenBtn.addEventListener("click", async () => {
    try {
      if (!document.fullscreenElement) {
        await videoPlayer.requestFullscreen();
      } else {
        await document.exitFullscreen();
      }
    } catch (error) {
      console.error("Error toggling fullscreen:", error);
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

registerPlaylistTab();
listenForMessages();
listenForStorageChanges();

init();
setupPlayerControls();