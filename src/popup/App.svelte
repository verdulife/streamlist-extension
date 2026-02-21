<script>
  import { onMount } from 'svelte';
  import { MESSAGES } from '../utils/constants.js';

  // Runes para el estado local
  let currentVideo = $state(null);
  let allVideos = $state([]);
  let isAdding = $state(false);
  let addSuccess = $state(false);
  let isPlayingNow = $state(false);
  let isClearing = $state(false);

  // Derivadas
  let hasCurrentVideo = $derived(!!currentVideo);
  let hasPlaylist = $derived(allVideos.length > 0);
  let videoCountText = $derived(`${allVideos.length} ${allVideos.length === 1 ? 'video' : 'videos'}`);

  onMount(() => {
    init();
  });

  async function init() {
    try {
      const response = await chrome.runtime.sendMessage({
        cmd: MESSAGES.GET_VIDEOS
      });

      if (response && response.success) {
        currentVideo = response.currentVideo;
        allVideos = response.allVideos;
      }
    } catch (error) {
      console.error('❌ Error during init:', error);
    }
  }

  async function playVideoByIndex(index) {
    const response = await chrome.runtime.sendMessage({
      cmd: MESSAGES.PLAY_VIDEO,
      data: { index }
    });

    if (response && response.success) {
      init();
    }
  }

  async function addToPlaylist() {
    isAdding = true;
    
    const response = await chrome.runtime.sendMessage({
      cmd: MESSAGES.ADD_TO_PLAYLIST,
      data: { video: currentVideo }
    });

    if (response && response.success) {
      isAdding = false;
      addSuccess = true;
      
      setTimeout(async () => {
        addSuccess = false;
        await init();
      }, 1000);
    } else {
      isAdding = false;
      // You could add an error state here if needed
      setTimeout(async () => {
        await init();
      }, 2000);
    }
  }

  async function findPlaylistTab() {
    const playlistUrl = chrome.runtime.getURL('src/playlist/playlist.html');
    const tabs = await chrome.tabs.query({ url: playlistUrl });
    return tabs.length > 0 ? tabs[0] : null;
  }

  async function reloadIframeInOriginalTab(sourceTabId) {
    try {
      await chrome.tabs.sendMessage(sourceTabId, {
        cmd: 'reload_iframe'
      });
    } catch (error) {
      console.log('Could not reload iframe in original tab:', error);
    }
  }

  async function playNow() {
    isPlayingNow = true;

    try {
      const currentTab = await chrome.tabs.query({ active: true, currentWindow: true });
      const sourceTabId = currentTab[0]?.id;

      const response = await chrome.runtime.sendMessage({
        cmd: MESSAGES.PLAY_NOW,
        data: { video: currentVideo }
      });

      if (response && response.success) {
        let playlistTab = await findPlaylistTab();
        
        if (!playlistTab) {
          const playlistUrl = chrome.runtime.getURL('src/playlist/playlist.html');
          playlistTab = await chrome.tabs.create({ url: playlistUrl });
        } else {
          await chrome.tabs.update(playlistTab.id, { active: true });
          await chrome.windows.update(playlistTab.windowId, { focused: true });
        }

        if (sourceTabId) {
          await reloadIframeInOriginalTab(sourceTabId);
        }

        window.close();
      }
    } finally {
        isPlayingNow = false;
    }
  }

  async function openPlaylist() {
    const currentTab = await chrome.tabs.query({ active: true, currentWindow: true });
    const sourceTabId = currentTab[0]?.id;

    let playlistTab = await findPlaylistTab();
    
    if (!playlistTab) {
      const playlistUrl = chrome.runtime.getURL('src/playlist/playlist.html');
      playlistTab = await chrome.tabs.create({ url: playlistUrl });
    } else {
      await chrome.tabs.update(playlistTab.id, { active: true });
      await chrome.windows.update(playlistTab.windowId, { focused: true });
    }

    if (sourceTabId) {
      await reloadIframeInOriginalTab(sourceTabId);
    }

    window.close();
  }

  async function clearPlaylist() {
    if (!confirm('Clear all videos from playlist?')) {
      return;
    }

    isClearing = true;
    
    await chrome.runtime.sendMessage({ cmd: MESSAGES.CLEAR_PLAYLIST });
    await init();
    
    isClearing = false;
  }
</script>

<div class="flex flex-col flex-1 overflow-hidden min-h-0">
  <!-- Header -->
  <header class="p-3 border-b border-neutral-900 flex-shrink-0">
    <div class="flex items-center justify-between">
      <img src="/icons/logo.svg" alt="Streamlist Logo" class="h-4">
      <span class="text-xs bg-neutral-800 text-neutral-300 px-2 py-1 rounded">{videoCountText}</span>
    </div>
  </header>

  <main class="flex-1 overflow-y-auto flex flex-col min-h-0">
    <div class="p-3">
      <!-- Current Video Info -->
      {#if hasCurrentVideo}
        <div class="mb-3">
          <div class="bg-neutral-900 rounded p-2 mb-3">
            <p class="text-xs text-neutral-500 uppercase tracking-wider mb-1">Current Video</p>
            <h3 class="text-sm font-medium text-neutral-100 truncate mb-1">
              {currentVideo.title || 'Untitled Video'}
            </h3>
            <p class="text-xs text-neutral-400 truncate">
              {currentVideo.domain || 'Unknown source'}
            </p>
          </div>
        </div>
      {:else}
        <div class="mb-3">
          <div class="bg-neutral-900/50 border border-neutral-800 rounded p-2">
            <p class="text-xs text-neutral-400">
              <span class="font-medium block mb-1">No video detected</span>
              <span class="text-neutral-500">Play a video on this page to capture it</span>
            </p>
          </div>
        </div>
      {/if}

      <!-- Action Buttons -->
      <div class="space-y-2 mb-3">
        <button
          onclick={addToPlaylist}
          disabled={!hasCurrentVideo || isAdding || addSuccess}
          class="w-full bg-neutral-800 hover:bg-neutral-700 disabled:bg-neutral-900 disabled:cursor-not-allowed text-neutral-100 text-sm py-2 px-3 rounded transition-colors flex items-center justify-center gap-2"
          class:bg-neutral-700={addSuccess}
        >
          {#if isAdding}
            <svg class="w-4 h-4 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            <span>Adding...</span>
          {:else if addSuccess}
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/>
            </svg>
            <span>Added!</span>
          {:else}
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
            </svg>
            <span>Add to Playlist</span>
          {/if}
        </button>

        <button
          onclick={playNow}
          disabled={!hasCurrentVideo || isPlayingNow}
          class="w-full bg-neutral-800 hover:bg-neutral-700 disabled:bg-neutral-900 disabled:cursor-not-allowed text-neutral-100 text-sm py-2 px-3 rounded transition-colors flex items-center justify-center gap-2"
        >
          {#if isPlayingNow}
            <svg class="w-4 h-4 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            <span>Opening...</span>
          {:else}
            <svg class="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
              <path d="M8 5v14l11-7z" />
            </svg>
            <span>Play Now</span>
          {/if}
        </button>
      </div>

      <!-- Divider -->
      <div class="border-b border-neutral-900 mb-3"></div>

      <!-- Playlist Section -->
      <div>
        <p class="text-xs text-neutral-500 uppercase tracking-wider mb-2">Playlist</p>
        
        {#if hasPlaylist}
          <div class="space-y-1 max-h-48 overflow-y-auto pr-1">
            {#each allVideos as video, index}
              <!-- svelte-ignore a11y_click_events_have_key_events -->
              <!-- svelte-ignore a11y_no_static_element_interactions -->
              <div 
                class="bg-neutral-900 hover:bg-neutral-800 rounded p-2 cursor-pointer transition-colors text-xs overflow-hidden"
                onclick={() => playVideoByIndex(index)}
              >
                <p class="text-neutral-100 truncate font-medium">{video.title || 'Untitled'}</p>
                <p class="text-neutral-500 truncate text-xs mt-0.5">{video.domain || 'Unknown'}</p>
              </div>
            {/each}
          </div>
        {:else}
          <p class="text-xs text-neutral-500 text-center py-3">No videos in playlist</p>
        {/if}
      </div>
    </div>

    <!-- Footer Buttons -->
    <div class="mt-auto p-3 border-t border-neutral-900 space-y-2 flex-shrink-0">
      {#if hasPlaylist}
        <button
          onclick={openPlaylist}
          class="w-full flex bg-neutral-800 hover:bg-neutral-700 text-neutral-100 text-sm py-2 px-3 rounded transition-colors items-center justify-center gap-2"
        >
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 10h16M4 14h16M4 18h16" />
          </svg>
          <span>Open Playlist</span>
        </button>

        <button
          onclick={clearPlaylist}
          disabled={isClearing}
          class="w-full flex bg-neutral-900 hover:bg-neutral-800 text-neutral-400 hover:text-red-400 text-sm py-2 px-3 rounded transition-colors items-center justify-center gap-2 disabled:opacity-50"
        >
          {#if isClearing}
            <svg class="w-4 h-4 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            <span>Clearing...</span>
          {:else}
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
            <span>Clear Playlist</span>
          {/if}
        </button>
      {/if}
    </div>
  </main>
</div>
