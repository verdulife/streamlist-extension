<script>
  let {
    videos = [],
    currentIndex = 0,
    onPlay = () => {},
    onDelete = () => {},
    onReorder = () => {},
  } = $props();

  let draggedItemIndex = $state(null);
  let dragHoverIndex = $state(null);
  let dragHoverPosition = $state(null); // 'top' or 'bottom'

  function handleDragStart(e, index) {
    draggedItemIndex = index;
    e.dataTransfer.effectAllowed = "move";
  }

  function handleDragOver(e, index) {
    e.preventDefault(); // Necessary to allow dropping
    e.dataTransfer.dropEffect = "move";

    const bounding = e.currentTarget.getBoundingClientRect();
    const offset = e.clientY - bounding.top;

    dragHoverIndex = index;
    if (offset > bounding.height / 2) {
      dragHoverPosition = "bottom";
    } else {
      dragHoverPosition = "top";
    }
  }

  function handleDragLeave() {
    dragHoverIndex = null;
    dragHoverPosition = null;
  }

  function handleDrop(e, index) {
    e.preventDefault();

    if (draggedItemIndex === null || draggedItemIndex === index) {
      cleanupDrag();
      return;
    }

    const bounding = e.currentTarget.getBoundingClientRect();
    const offset = e.clientY - bounding.top;

    let targetIndex = index;
    if (offset > bounding.height / 2) {
      targetIndex++; // Drop after
    }

    if (draggedItemIndex < targetIndex) {
      targetIndex--;
    }

    onReorder(draggedItemIndex, targetIndex);
    cleanupDrag();
  }

  function handleDragEnd() {
    cleanupDrag();
  }

  function cleanupDrag() {
    draggedItemIndex = null;
    dragHoverIndex = null;
    dragHoverPosition = null;
  }
</script>

<aside
  id="playlist"
  class="border-l border-neutral-900 bg-neutral-950 flex flex-col h-full overflow-hidden p-6"
>
  {#if videos.length === 0}
    <div class="p-4 text-center text-neutral-400">No videos in playlist</div>
  {:else}
    <div class="overflow-y-auto flex flex-col gap-2 flex-1">
      {#each videos as video, index (video.id ? video.id + "-" + index : index)}
        {@const isActive = index === currentIndex}
        {@const isDragging = draggedItemIndex === index}
        {@const isHoveredTop =
          dragHoverIndex === index && dragHoverPosition === "top"}
        {@const isHoveredBottom =
          dragHoverIndex === index && dragHoverPosition === "bottom"}

        <!-- svelte-ignore a11y_no_static_element_interactions -->
        <div
          class="relative px-3 py-6 border bg-neutral-900 border-neutral-800 cursor-pointer transition-colors rounded-lg"
          class:bg-neutral-900_50={isActive}
          class:hover:bg-neutral-900={!isActive}
          class:opacity-50={isDragging}
          class:border-t-2={isHoveredTop}
          class:border-t-blue-500={isHoveredTop}
          class:border-b-2={isHoveredBottom}
          class:border-b-blue-500={isHoveredBottom}
          draggable="true"
          ondragstart={(e) => handleDragStart(e, index)}
          ondragover={(e) => handleDragOver(e, index)}
          ondragleave={handleDragLeave}
          ondrop={(e) => handleDrop(e, index)}
          ondragend={handleDragEnd}
        >
          <div class="flex gap-3 items-center justify-between select-none p-1">
            <div class="flex gap-3 flex-1 min-w-0">
              <div
                class="flex-shrink-0 flex items-center justify-center {isActive
                  ? 'text-blue-500'
                  : 'text-neutral-500 opacity-0 group-hover:opacity-100 transition-opacity'}"
              >
                {#if isActive}
                  <img
                    src="/icons/play.svg"
                    alt="Active Playing"
                    class="w-4 h-4"
                  />
                {:else}
                  <img
                    src="/icons/play.svg"
                    alt="Play"
                    class="w-4 h-4 opacity-50"
                  />
                {/if}
              </div>

              <!-- svelte-ignore a11y_click_events_have_key_events -->
              <div
                class="min-w-0 flex items-center gap-2 flex-1"
                onclick={(e) => {
                  if (!e.target.closest(".delete-btn")) {
                    onPlay(index);
                  }
                }}
              >
                <p
                  class="text-[14px] font-medium line-clamp-3 {isActive
                    ? 'text-blue-500'
                    : 'text-neutral-300'}"
                >
                  {video.title || "Untitled"}
                </p>
              </div>
            </div>

            <!-- svelte-ignore a11y_consider_explicit_label -->
            <button
              class="delete-btn flex-shrink-0 p-1 rounded hover:bg-red-900/30 transition-colors"
              title="Delete"
              onclick={(e) => {
                e.stopPropagation();
                onDelete(video.id);
              }}
            >
              <svg
                class="w-4 h-4 text-neutral-400 hover:text-red-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          </div>
        </div>
      {/each}
    </div>
  {/if}
</aside>

<style>
  .bg-neutral-900_50 {
    background-color: rgba(23, 23, 23, 0.5);
  }
</style>
