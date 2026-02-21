<script>
  import { onMount, onDestroy } from "svelte";
  import Hls from "hls.js";
  import {
    getVolume,
    setVolume,
    getPreviousVolume,
    setPreviousVolume,
  } from "../../utils/storage.js";
  import { VIDEO_TYPES } from "../../utils/constants.js";
  import { castManager } from "../cast.js";

  let { video, nextVideo, isPlaying = $bindable(false), onNext } = $props();

  let videoPlayer = $state(null);
  let videoBlur = $state(null);
  let videoContainer = $state(null);
  let progressBarContainer = $state(null);

  let hlsPlayer = $state(null);
  let hlsBlur = $state(null);

  // Player State
  let volume = $state(1);
  let isMuted = $state(false);
  let currentTime = $state(0);
  let duration = $state(0);
  let bufferPercent = $state(0);
  let progressPercent = $state(0);
  let isFullscreen = $state(false);

  // UI State
  let showControls = $state(true);
  let isDraggingProgress = $state(false);
  let autoHideTimeout = null;
  let clickTimeout = null;
  let castTooltipMsg = $state("");
  let showCastTooltip = $state(false);
  let castTooltipTimeout = null;

  let isCasting = $state(false);

  $effect(() => {
    // Only track `video` changes, ignore mutations inside initVideo
    if (video) {
      import("svelte").then(({ untrack }) => {
        untrack(() => initVideo(video));
      });
    }
  });

  onMount(async () => {
    // Initial Volume setup
    const savedVol = await getVolume();
    setVolumeState(savedVol);

    // Cast callback bindings
    await castManager.init(videoPlayer);

    castManager.onStateChange = (playing) => {
      isPlaying = playing;
      isCasting = castManager.isCasting; // update casting state
    };

    castManager.onTimeUpdate = (curr, tot) => {
      if (!isDraggingProgress) {
        currentTime = curr;
        duration = tot;
        calcProgress();
      }
    };

    castManager.onVolumeChange = (vol, muted) => {
      setVolumeState(muted ? 0 : vol);
      isMuted = muted;
    };

    castManager.onError = (errorMsg) => {
      displayCastTooltip(errorMsg);
    };

    document.addEventListener("fullscreenchange", handleFullscreenChange);
  });

  onDestroy(() => {
    cleanupPlayers();
    document.removeEventListener("fullscreenchange", handleFullscreenChange);
    if (autoHideTimeout) clearTimeout(autoHideTimeout);
    if (castTooltipTimeout) clearTimeout(castTooltipTimeout);
  });

  function cleanupPlayers() {
    if (hlsPlayer) {
      hlsPlayer.destroy();
      hlsPlayer = null;
    }
    if (hlsBlur) {
      hlsBlur.destroy();
      hlsBlur = null;
    }
    if (videoPlayer) {
      videoPlayer.pause();
      videoPlayer.removeAttribute("src"); // empty src
      videoPlayer.load();
    }
    if (videoBlur) {
      videoBlur.pause();
      videoBlur.removeAttribute("src"); // empty src
      videoBlur.load();
    }
  }

  async function initVideo(vid) {
    if (!videoPlayer || !videoBlur) return;

    if (castManager.isCasting) {
      castManager.loadMedia(vid);
      return;
    }

    cleanupPlayers();

    const videoUrl = vid.manifest || vid.url;

    if (vid.type === VIDEO_TYPES.HLS && Hls.isSupported()) {
      hlsPlayer = new Hls({ debug: false, enableWorker: true });
      hlsBlur = new Hls({ debug: false, enableWorker: true });

      hlsPlayer.loadSource(videoUrl);
      hlsBlur.loadSource(videoUrl);

      hlsPlayer.attachMedia(videoPlayer);
      hlsBlur.attachMedia(videoBlur);

      hlsPlayer.on(Hls.Events.MANIFEST_PARSED, () => {
        play();
      });

      hlsPlayer.on(Hls.Events.ERROR, (_, data) => {
        if (data.fatal) {
          switch (data.type) {
            case Hls.ErrorTypes.MEDIA_ERROR:
              console.warn("HLS Media Error (recovering...)", data);
              hlsPlayer.recoverMediaError();
              break;
            case Hls.ErrorTypes.NETWORK_ERROR:
              console.error("❌ HLS Network Error:", data);
              break;
            default:
              console.error("❌ HLS Fatal Error:", data);
              hlsPlayer.destroy();
              break;
          }
        }
      });
    } else {
      videoPlayer.src = videoUrl;
      videoBlur.src = videoUrl;
      play();
    }
  }

  // --- Core playback controls
  function play() {
    if (castManager.isCasting) return castManager.playOrPause();
    videoPlayer?.play();
    videoBlur?.play();
  }

  function pause() {
    if (castManager.isCasting) return castManager.playOrPause();
    videoPlayer?.pause();
    videoBlur?.pause();
  }

  function togglePlay() {
    isPlaying ? pause() : play();
  }

  // --- Volume
  async function setVolumeState(newVol) {
    volume = newVol;
    isMuted = newVol === 0;

    if (videoPlayer) {
      videoPlayer.volume = newVol;
    }
    if (castManager.isCasting) {
      castManager.setVolume(newVol);
    }

    await setVolume(newVol);
  }

  async function handleVolumeChange(e) {
    const newVol = parseFloat(e.target.value);
    await setVolumeState(newVol);
  }

  async function toggleMute() {
    if (isMuted) {
      const prev = await getPreviousVolume();
      await setVolumeState(prev || 1);
    } else {
      await setPreviousVolume(volume);
      if (castManager.isCasting) {
        castManager.toggleMute();
      } else {
        await setVolumeState(0);
      }
    }
  }

  // --- Seeking
  function handleRewind() {
    if (castManager.isCasting && castManager.player) {
      castManager.seek(Math.max(0, castManager.player.currentTime - 10));
      return;
    }
    if (videoPlayer) {
      videoPlayer.currentTime = Math.max(0, videoPlayer.currentTime - 10);
    }
  }

  function handleForward() {
    if (castManager.isCasting && castManager.player) {
      castManager.seek(
        Math.min(
          castManager.player.duration,
          castManager.player.currentTime + 10,
        ),
      );
      return;
    }
    if (videoPlayer) {
      videoPlayer.currentTime = Math.min(
        videoPlayer.duration,
        videoPlayer.currentTime + 10,
      );
    }
  }

  // --- Time updates
  function calcProgress() {
    if (!duration) {
      progressPercent = 0;
      return;
    }

    const rect = progressBarContainer?.getBoundingClientRect();
    const rawPercent = (currentTime / duration) * 100 || 0;
    progressPercent = getSteppedWidthPercent(rawPercent, rect?.width);
  }

  function handleTimeUpdate() {
    if (castManager.isCasting) return;
    if (!isDraggingProgress && videoPlayer?.duration) {
      currentTime = videoPlayer.currentTime;
      duration = videoPlayer.duration;
      calcProgress();
    }
  }

  function handleProgressUpdate() {
    if (castManager.isCasting) return;
    if (videoPlayer?.duration > 0 && videoPlayer?.buffered.length > 0) {
      const rect = progressBarContainer?.getBoundingClientRect();
      const bufferedEnd = videoPlayer.buffered.end(
        videoPlayer.buffered.length - 1,
      );
      const rawPercent = (bufferedEnd / videoPlayer.duration) * 100;
      bufferPercent = getSteppedWidthPercent(rawPercent, rect?.width);
    }
  }

  // --- Progress Bar Stepping logic
  function getSteppedWidthPercent(rawPercent, totalWidth) {
    if (!totalWidth) return rawPercent;

    const computedStyle = getComputedStyle(progressBarContainer);
    const size = parseFloat(computedStyle.getPropertyValue("--size")) || 3;
    const gap = parseFloat(computedStyle.getPropertyValue("--gap")) || 0.5;
    const stepSizePx = size + gap;

    const rawWidthPx = (rawPercent / 100) * totalWidth;
    const numSteps = Math.round(rawWidthPx / stepSizePx);
    const steppedWidthPx = numSteps * stepSizePx;

    return (steppedWidthPx / totalWidth) * 100;
  }

  // --- Seeking from Timeline
  function updateProgressFromEvent(e) {
    const dur = castManager.isCasting
      ? castManager.player?.duration || 0
      : videoPlayer?.duration;
    if (!dur || !progressBarContainer) return;

    const rect = progressBarContainer.getBoundingClientRect();
    let pos = (e.clientX - rect.left) / rect.width;
    pos = Math.max(0, Math.min(1, pos));

    const targetTime = pos * dur;

    if (castManager.isCasting) {
      castManager.seek(targetTime);
    } else {
      videoPlayer.currentTime = targetTime;
    }

    progressPercent = getSteppedWidthPercent(pos * 100, rect.width);
    currentTime = targetTime;
  }

  function onProgressMouseDown(e) {
    isDraggingProgress = true;
    updateProgressFromEvent(e);
  }

  function onProgressMouseMove(e) {
    if (isDraggingProgress) updateProgressFromEvent(e);
  }

  function onProgressMouseUp() {
    isDraggingProgress = false;
  }

  // --- Fullscreen and UI Auto-hide
  function resetAutoHide() {
    if (autoHideTimeout) clearTimeout(autoHideTimeout);
    showControls = true;

    if (videoContainer) {
      videoContainer.style.cursor = "auto";
    }

    if (isPlaying) {
      autoHideTimeout = setTimeout(() => {
        showControls = false;
        if (isFullscreen && videoContainer) {
          videoContainer.style.cursor = "none";
        }
      }, 3000);
    }
  }

  async function toggleFullscreen() {
    try {
      if (!document.fullscreenElement) {
        await videoContainer?.requestFullscreen();
      } else {
        await document.exitFullscreen();
      }
    } catch (e) {
      console.error("Fullscreen error", e);
    }
  }

  function handleFullscreenChange() {
    isFullscreen = !!document.fullscreenElement;
  }

  function onVideoClick(e) {
    e.stopPropagation();
    if (clickTimeout) {
      clearTimeout(clickTimeout);
      clickTimeout = null;
      toggleFullscreen();
    } else {
      clickTimeout = setTimeout(() => {
        togglePlay();
        clickTimeout = null;
      }, 250);
    }
  }

  // --- Chrome Cast Integration
  function displayCastTooltip(msg, dur = 4000) {
    castTooltipMsg = msg;
    showCastTooltip = true;
    if (castTooltipTimeout) clearTimeout(castTooltipTimeout);
    castTooltipTimeout = setTimeout(() => {
      showCastTooltip = false;
    }, dur);
  }

  // Keyboard controls
  function handleKeydown(e) {
    if (e.target.tagName === "INPUT" && e.target.type !== "range") return;

    switch (e.key.toLowerCase()) {
      case " ":
        e.preventDefault();
        togglePlay();
        break;
      case "m":
        e.preventDefault();
        toggleMute();
        break;
      case "arrowleft":
        if (!e.altKey) {
          e.preventDefault();
          if (e.ctrlKey) {
            if (videoPlayer)
              videoPlayer.currentTime = Math.max(
                0,
                videoPlayer.currentTime - 30,
              );
          } else {
            handleRewind();
          }
        }
        break;
      case "arrowright":
        if (!e.altKey) {
          e.preventDefault();
          if (e.ctrlKey) {
            if (videoPlayer)
              videoPlayer.currentTime = Math.min(
                duration,
                videoPlayer.currentTime + 30,
              );
          } else {
            handleForward();
          }
        }
        break;
      case "arrowup":
        e.preventDefault();
        setVolumeState(Math.min(1, volume + 0.1));
        break;
      case "arrowdown":
        e.preventDefault();
        setVolumeState(Math.max(0, volume - 0.1));
        break;
      case "enter":
        if (e.ctrlKey) {
          e.preventDefault();
          toggleFullscreen();
        }
        break;
      case "f":
        e.preventDefault();
        toggleFullscreen();
        break;
    }
  }

  // Utils
  function formatTime(seconds) {
    if (!seconds || isNaN(seconds)) return "0:00";
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs < 10 ? "0" : ""}${secs}`;
  }
</script>

<svelte:window
  onkeydown={handleKeydown}
  onmousemove={onProgressMouseMove}
  onmouseup={onProgressMouseUp}
/>

<main class="size-full flex flex-col min-h-0 bg-black">
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <!-- svelte-ignore a11y_no_noninteractive_element_to_interactive_role -->
  <div
    bind:this={videoContainer}
    class="relative size-full bg-black group/player flex items-center justify-center shrink-0"
    onmousemove={resetAutoHide}
    onmouseleave={() => {
      if (autoHideTimeout) clearTimeout(autoHideTimeout);
    }}
    role="region"
  >
    <!-- Blur layer -->
    <video
      bind:this={videoBlur}
      class="absolute inset-10 aspect-video scale-105 blur-3xl opacity-25 pointer-events-none"
      muted
    ></video>

    <!-- svelte-ignore a11y_click_events_have_key_events -->
    <!-- Main Player -->
    <video
      bind:this={videoPlayer}
      class="relative w-full aspect-video"
      onplay={() => {
        isPlaying = true;
        resetAutoHide();
      }}
      onpause={() => {
        isPlaying = false;
        showControls = true;
      }}
      ontimeupdate={handleTimeUpdate}
      onprogress={handleProgressUpdate}
      onended={() => (isPlaying = false)}
      onloadedmetadata={() => {
        duration = videoPlayer.duration;
        setVolumeState(volume); // reaply volume
      }}
      onclick={onVideoClick}
    >
      <track kind="captions" />
    </video>

    <!-- Overlay Controls -->
    <!-- svelte-ignore a11y_click_events_have_key_events -->
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <div
      class="absolute inset-0 top-auto transition-opacity p-4 flex flex-col justify-end gap-4 pointer-events-none"
      class:opacity-100={showControls}
      class:opacity-0={!showControls}
      onclick={(e) => e.stopPropagation()}
    >
      <!-- Progress bar -->
      <div
        bind:this={progressBarContainer}
        class="relative bg-neutral-950/70 w-full cursor-pointer pointer-events-auto"
        id="progressBarContainer"
        onmousedown={onProgressMouseDown}
      >
        <div
          class="absolute h-full top-0 left-0 bg-neutral-600 transition-all duration-200"
          style="width: {bufferPercent}%"
          id="progressBarBuffer"
        ></div>
        <div
          class="absolute h-full top-0 left-0 bg-neutral-200 transition-none"
          style="width: {progressPercent}%"
          id="progressBarProgress"
        ></div>
        <div class="absolute size-full top-0 left-0" id="progressBarBg"></div>
      </div>

      <div class="flex justify-between pointer-events-auto">
        <!-- Left Controls -->
        <div class="flex gap-1" id="left">
          <div class="flex bg-neutral-950/70 rounded items-center">
            <button
              class="size-8 p-2 hover:bg-white/10 rounded-l transition-colors"
              onclick={togglePlay}
              title={isPlaying ? "Pause" : "Play"}
            >
              <img
                class="size-full"
                src={isPlaying ? "/icons/pause.svg" : "/icons/play.svg"}
                alt={isPlaying ? "Pause" : "Play"}
              />
            </button>

            <p
              class="px-2 text-xs font-mono text-neutral-300 pointer-events-none"
            >
              <span>{formatTime(currentTime)}</span>
              <span class="opacity-50 mx-1">/</span>
              <span>{formatTime(duration)}</span>
            </p>
          </div>

          <div class="flex bg-neutral-950/70 rounded items-center">
            <button
              class="h-8 p-2 flex items-center gap-2 hover:bg-white/10 rounded-l text-xs font-mono transition-colors"
              onclick={handleRewind}
              title="-10s"
            >
              <img class="size-full" src="/icons/rewind.svg" alt="Rewind 10s" />
              <span>-10s</span>
            </button>
            <button
              class="h-8 p-2 flex items-center gap-2 hover:bg-white/10 rounded-r text-xs font-mono transition-colors"
              onclick={handleForward}
              title="+10s"
            >
              <img
                class="size-full"
                src="/icons/foward.svg"
                alt="Forward 10s"
              />
              <span>+10s</span>
            </button>
          </div>
        </div>

        <!-- Right Controls -->
        <div class="flex gap-1" id="right">
          {#if nextVideo}
            <button
              class="h-8 p-2 flex bg-neutral-950/70 rounded gap-2 hover:bg-white/10 transition-colors text-xs font-mono items-center"
              title="Next: {nextVideo.title || 'Untitled'}"
              onclick={onNext}
            >
              <img
                class="h-full aspect-square"
                src="/icons/next.svg"
                alt="Next"
              />
              <span class="max-w-48 truncate"
                >{nextVideo.title || "Untitled"}</span
              >
            </button>
          {/if}

          <div
            class="flex bg-neutral-950/70 rounded hover:bg-white/10 transition-colors"
          >
            <div class="relative flex group/volume">
              <button
                class="size-8 p-2"
                onclick={toggleMute}
                title={isMuted ? "Unmute" : "Mute"}
              >
                <img
                  class="size-full"
                  src={isMuted
                    ? "/icons/volume-off.svg"
                    : "/icons/volume-on.svg"}
                  alt="Volume"
                />
              </button>

              <!-- Slider vertical popup -->
              <div
                class="absolute group-hover/volume:opacity-100 w-8 p-2 flex justify-center items-center bg-neutral-950/70 rounded bottom-[calc(100%+0.25rem)] left-0 opacity-0 transition-opacity pointer-events-none group-hover/volume:pointer-events-auto"
              >
                <input
                  class="[writing-mode:vertical-lr] [direction:rtl] [vertical-align:middle] accent-neutral-200 h-20"
                  type="range"
                  min="0"
                  max="1"
                  step="0.01"
                  value={volume}
                  oninput={handleVolumeChange}
                />
              </div>
            </div>

            <!-- Cast Button -->
            <div class="relative flex items-center justify-center">
              <button
                class="size-8 p-2 hover:bg-white/10 transition-colors"
                onclick={() => castManager.toggleCastMenu()}
                title="Cast"
              >
                <img
                  class="size-full"
                  src="/icons/cast.svg"
                  alt="Cast"
                  class:brightness-150={isCasting}
                  class:sepia={isCasting}
                  class:hue-rotate-[190deg]={isCasting}
                />
              </button>

              <!-- Cast Tooltip -->
              <div
                class="absolute bottom-[calc(100%+0.5rem)] right-0 w-48 bg-neutral-800 text-neutral-100 text-xs px-3 py-2 rounded border border-neutral-700 shadow-2xl transition-all duration-300 pointer-events-none z-50"
                class:opacity-0={!showCastTooltip}
                class:translate-y-2={!showCastTooltip}
                class:opacity-100={showCastTooltip}
                class:translate-y-0={showCastTooltip}
              >
                {castTooltipMsg}
                <div
                  class="absolute top-full right-3 border-8 border-transparent border-t-neutral-800"
                ></div>
              </div>
            </div>

            <button
              class="size-8 p-2 hover:bg-white/10 rounded-r transition-colors"
              onclick={toggleFullscreen}
              title="Fullscreen"
            >
              <img
                class="size-full"
                src="/icons/fullscreen.svg"
                alt="Fullscreen"
              />
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</main>
