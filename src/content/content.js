import { MESSAGES } from '../utils/constants.js';

console.log('🎬 Video Playlist - Content Script Loaded');

// Inject MSE interceptor into the main world
const script = document.createElement('script');
script.src = chrome.runtime.getURL('src/content/mse-interceptor.js');
script.onload = function () {
  this.remove();
};
(document.head || document.documentElement).appendChild(script);

// Listen for messages from the injected script (main world)
window.addEventListener('message', (event) => {
  // Only accept messages from same origin
  if (event.source !== window) return;

  const { type, data } = event.data;

  if (type === 'MSE_SEGMENT_CAPTURED') {
    // Forward to background script
    chrome.runtime.sendMessage({
      cmd: MESSAGES.MSE_SEGMENT_CAPTURED,
      data
    });
  }

  if (type === 'VIDEO_DETECTED') {
    // Forward to background script
    chrome.runtime.sendMessage({
      cmd: MESSAGES.VIDEO_DETECTED,
      data
    });
  }
});

// Detect regular video elements
function detectVideoElements() {
  const videos = document.querySelectorAll('video[src], video source[src]');

  videos.forEach(video => {
    const src = video.src || video.querySelector('source')?.src;

    if (src && src.startsWith('http')) {
      console.log('📹 Video element detected:', src);

      chrome.runtime.sendMessage({
        cmd: MESSAGES.VIDEO_DETECTED,
        data: {
          url: src,
          manifest: src,
          type: src.endsWith('.m3u8') ? 'hls' : 'mp4',
          title: document.title,
          domain: window.location.hostname,
          source: 'video-element'
        }
      });
    }
  });
}

// Run detection on load and on DOM changes
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', detectVideoElements);
} else {
  detectVideoElements();
}

// Watch for new videos added dynamically
const observer = new MutationObserver((mutations) => {
  for (const mutation of mutations) {
    for (const node of mutation.addedNodes) {
      if (node.nodeName === 'VIDEO' || node.querySelector?.('video')) {
        detectVideoElements();
        break;
      }
    }
  }
});

observer.observe(document.documentElement, {
  childList: true,
  subtree: true
});