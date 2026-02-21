<script>
  import { onMount, onDestroy } from "svelte";
  import {
    getVideos,
    getCurrentIndex,
    setCurrentIndex,
    removeVideo,
    saveVideos,
  } from "../utils/storage.js";
  import { STORAGE_KEYS } from "../utils/constants.js";

  import VideoPlayer from "./components/VideoPlayer.svelte";
  import PlaylistSidebar from "./components/PlaylistSidebar.svelte";

  let videos = $state([]);
  let currentIndex = $state(0);
  let isReady = $state(false);
  let isPlaying = $state(false);

  let currentVideo = $derived(videos[currentIndex]);
  let nextVideo = $derived(
    currentIndex + 1 < videos.length ? videos[currentIndex + 1] : null,
  );

  onMount(async () => {
    await init();
    registerPlaylistTab();
    listenForMessages();
    listenForStorageChanges();
  });

  async function init() {
    try {
      videos = await getVideos();
      const savedIndex = await getCurrentIndex();

      // Ensure index is valid
      if (savedIndex >= videos.length && videos.length > 0) {
        currentIndex = videos.length - 1;
        await setCurrentIndex(currentIndex);
      } else {
        currentIndex = savedIndex || 0;
      }

      isReady = true;
    } catch (error) {
      console.error("❌ Error initializing playlist:", error);
      isReady = true;
    }
  }

  async function handlePlayIndex(index) {
    if (index >= 0 && index < videos.length) {
      currentIndex = index;
      await setCurrentIndex(currentIndex);
    }
  }

  async function handleDelete(videoId) {
    await removeVideo(videoId);
    videos = await getVideos();

    if (videos.length > 0 && currentIndex >= videos.length) {
      currentIndex = videos.length - 1;
      await setCurrentIndex(currentIndex);
    }
  }

  async function handleReorder(fromIndex, toIndex) {
    if (fromIndex === toIndex) return;

    const newVideos = [...videos];
    const [movedItem] = newVideos.splice(fromIndex, 1);
    newVideos.splice(toIndex, 0, movedItem);

    videos = newVideos;

    // Update currentIndex
    if (currentIndex === fromIndex) {
      currentIndex = toIndex;
    } else if (fromIndex < currentIndex && toIndex >= currentIndex) {
      currentIndex--;
    } else if (fromIndex > currentIndex && toIndex <= currentIndex) {
      currentIndex++;
    }

    await setCurrentIndex(currentIndex);
    await saveVideos(videos);
  }

  function handleNextVideo() {
    if (nextVideo) {
      handlePlayIndex(currentIndex + 1);
    }
  }

  function handlePreviousVideo() {
    if (currentIndex > 0) {
      handlePlayIndex(currentIndex - 1);
    }
  }

  // --- Chrome Extension Integration ---

  async function registerPlaylistTab() {
    try {
      const tab = await chrome.tabs.getCurrent();
      if (tab?.id) {
        chrome.runtime
          .sendMessage({
            cmd: "register_playlist_tab",
            data: { tabId: tab.id },
          })
          .catch((e) => console.log("Could not register tab:", e));
      }
    } catch (error) {
      console.error("Error registering playlist tab:", error);
    }
  }

  function listenForMessages() {
    chrome.runtime.onMessage.addListener(async (message, _, sendResponse) => {
      const { cmd } = message;

      if (cmd === "video_added") {
        videos = await getVideos();
        sendResponse({ received: true });
      }

      if (cmd === "play_now") {
        videos = await getVideos();
        currentIndex = await getCurrentIndex(); // Should be 0
        sendResponse({ received: true });
      }

      if (cmd === "video_removed") {
        videos = await getVideos();
        if (currentIndex >= videos.length && videos.length > 0) {
          currentIndex = videos.length - 1;
          await setCurrentIndex(currentIndex);
        }
        sendResponse({ received: true });
      }

      if (cmd === "playlist_cleared") {
        videos = [];
        currentIndex = 0;
        sendResponse({ received: true });
      }
    });
  }

  function listenForStorageChanges() {
    // Only available if running as extension, polyfill/skip otherwise
    if (chrome.storage?.session) {
      const listener = async (changes, areaName) => {
        if (areaName !== "session") return;
        if (changes[STORAGE_KEYS.VIDEOS]) {
          videos = await getVideos();
          if (videos.length === 0) {
            currentIndex = 0;
          } else if (currentIndex >= videos.length) {
            currentIndex = 0;
            await setCurrentIndex(currentIndex);
          }
        }
      };
      chrome.storage.session.onChanged.addListener(listener);
    }
  }

  // Global Keyboard Shortcuts
  function handleKeydown(e) {
    if (e.target.tagName === "INPUT" && e.target.type !== "range") return;

    if (e.altKey) {
      if (e.key === "ArrowLeft") {
        e.preventDefault();
        handlePreviousVideo();
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        handleNextVideo();
      }
    }
  }
</script>

<svelte:window onkeydown={handleKeydown} />

<svelte:head>
  <title
    >{currentVideo ? currentVideo.title : "No videos in playlist"} - Streamlist Player</title
  >
</svelte:head>

<section class="grid grid-cols-[auto_500px] flex-1 min-h-0 overflow-hidden">
  {#if !isReady}
    <main
      class="size-full flex flex-col items-center justify-center text-neutral-500"
    >
      Loading...
    </main>
  {:else}
    <VideoPlayer
      video={currentVideo}
      {nextVideo}
      bind:isPlaying
      onNext={handleNextVideo}
    />
  {/if}

  <PlaylistSidebar
    {videos}
    {currentIndex}
    {isPlaying}
    onPlay={handlePlayIndex}
    onDelete={handleDelete}
    onReorder={handleReorder}
  />
</section>
