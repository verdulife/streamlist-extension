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
      // NOTE: MSE segment interception turned off for performance reasons
      // console.log(`📊 appendBuffer called: ${data.byteLength} bytes, mimeType: ${mimeType}`);
      // This was cloning blobs and sending postMessages on EVERY chunk, crashing the browser on long videos.
      // Re-enable when building out the explicit 'record/download HLS' feature.

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