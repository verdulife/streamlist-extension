// This script runs in the MAIN world (same context as page scripts)
// It can intercept native APIs like MediaSource

(function () {
  'use strict';

  console.log('🎥 MSE Interceptor injected');

  // Check if MediaSource is available
  if (typeof MediaSource === 'undefined') {
    console.log('MediaSource API not available');
    return;
  }

  // Store original methods
  const originalAddSourceBuffer = MediaSource.prototype.addSourceBuffer;

  // Track captured segments
  const capturedSegments = new Map();
  let mediaSourceId = 0;

  // Override MediaSource.prototype.addSourceBuffer
  MediaSource.prototype.addSourceBuffer = function (mimeType) {
    console.log('📦 MediaSource.addSourceBuffer called:', mimeType);

    // Call original method
    const sourceBuffer = originalAddSourceBuffer.call(this, mimeType);

    // Store original appendBuffer method
    const originalAppendBuffer = sourceBuffer.appendBuffer;

    // Generate unique ID for this MediaSource instance
    if (!this._interceptorId) {
      this._interceptorId = ++mediaSourceId;
      console.log('🆔 MediaSource ID:', this._interceptorId);
    }

    // Generate unique ID for this SourceBuffer
    sourceBuffer._bufferId = Math.random().toString(36).substr(2, 9);

    // Override appendBuffer to capture data
    sourceBuffer.appendBuffer = function (data) {
      console.log(`📊 appendBuffer called: ${data.byteLength} bytes, mimeType: ${mimeType}`);

      // Notify content script about the segment
      try {
        // Convert ArrayBuffer to Blob for later use
        const blob = new Blob([data], { type: mimeType });
        const url = URL.createObjectURL(blob);

        // Send message to content script
        window.postMessage({
          type: 'MSE_SEGMENT_CAPTURED',
          data: {
            mimeType,
            size: data.byteLength,
            blobUrl: url,
            mediaSourceId: this._interceptorId,
            bufferId: sourceBuffer._bufferId,
            timestamp: Date.now()
          }
        }, '*');

        // Store segment info
        if (!capturedSegments.has(mimeType)) {
          capturedSegments.set(mimeType, []);
        }
        capturedSegments.get(mimeType).push({
          url,
          size: data.byteLength,
          timestamp: Date.now()
        });

        // Auto-cleanup old blob URLs to prevent memory leaks
        setTimeout(() => {
          URL.revokeObjectURL(url);
        }, 60000); // 1 minute

      } catch (error) {
        console.error('Error capturing MSE segment:', error);
      }

      // Call original method
      return originalAppendBuffer.call(this, data);
    };

    // Notify that a video is being played via MSE
    window.postMessage({
      type: 'VIDEO_DETECTED',
      data: {
        url: window.location.href,
        manifest: window.location.href,
        type: 'mse',
        mimeType,
        title: document.title,
        domain: window.location.hostname,
        source: 'mse-interceptor'
      }
    }, '*');

    return sourceBuffer;
  };

  console.log('✅ MSE Interceptor ready');
})();