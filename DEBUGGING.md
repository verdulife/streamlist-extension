# 🐛 Debugging Guide

## Chrome DevTools

### Service Worker (Background)

1. Go to `chrome://extensions/`
2. Find "Video Playlist Player"
3. Click "service worker" link under "Inspect views"
4. Opens DevTools for background script

**Check here for:**

- Video detection logs: `🎥 Video detected:`
- Message handling: `📨 Message received:`
- Storage operations
- Network request interceptions

### Content Scripts

1. Open DevTools on any webpage (F12)
2. Go to Console tab
3. Look for: `🎬 Video Playlist - Content Script Loaded`

**Check here for:**

- MSE interception: `📦 MSE segment captured:`
- Video element detection: `📹 Video element detected:`

### Popup

1. Right-click extension icon → "Inspect popup"
2. Opens DevTools for popup

**Check here for:**

- Button states
- Video info display
- Message sending to background

### Playlist Page

1. Open playlist page
2. Press F12 to open DevTools

**Check here for:**

- HLS playback errors
- Video loading issues
- Playlist rendering

## Common Issues

### 1. Videos Not Being Detected

**Check:**

```javascript
// In service worker console
chrome.webRequest.onHeadersReceived.hasListener(); // Should be true
```

**Test manually:**

```javascript
// In service worker console
chrome.storage.session.get("videos", (result) => {
  console.log("Current videos:", result.videos);
});
```

**Solution:**

- Reload extension: `chrome://extensions/` → Click reload button
- Check if domain is blocked: See `BLOCKED_DOMAINS` in constants.js
- Verify webRequest permission in manifest.json

### 2. Popup Shows "No video detected"

**Check:**

```javascript
// In popup console
chrome.runtime.sendMessage({ cmd: "get_videos" }, (response) => {
  console.log("Response:", response);
});
```

**Solution:**

- Make sure you played the video on the page
- Wait a few seconds after starting playback
- Refresh the page and try again

### 3. Videos Won't Play

**Check:**

```javascript
// In playlist page console
console.log("HLS supported:", Hls.isSupported());
console.log(
  "Native HLS:",
  videoElement.canPlayType("application/vnd.apple.mpegurl"),
);
```

**Common errors:**

- `CORS error` → Video requires special headers
- `404 Not Found` → Manifest URL expired/invalid
- `Network error` → Video is geo-blocked or requires authentication

**Solution:**

- Try playing the video on the original site first
- Check Network tab for failed requests
- Some videos simply can't be played due to CORS/DRM

### 4. MSE Hook Not Working

**Check:**

```javascript
// In page console (not content script console)
console.log(
  "MediaSource modified:",
  MediaSource.prototype.addSourceBuffer !==
    MediaSource.prototype.addSourceBuffer.toString().includes("native"),
);
```

**Solution:**

- Make sure script is injected in MAIN world
- Check web_accessible_resources in manifest.json
- Try reloading the page

### 5. Extension Crashes or Hangs

**Check:**

```javascript
// In service worker console
chrome.storage.session.getBytesInUse((bytes) => {
  console.log("Storage used:", bytes, "of", chrome.storage.session.QUOTA_BYTES);
});
```

**Solution:**

- Clear playlist: Click "Clear All" in popup
- Check console for memory errors
- Reduce number of videos in playlist

## Testing Checklist

### Initial Setup

- [ ] Extension loads without errors in `chrome://extensions/`
- [ ] Icon appears in toolbar
- [ ] Popup opens when clicking icon
- [ ] No console errors in service worker

### Video Detection

- [ ] Navigate to test video site (e.g., vimeo.com)
- [ ] Play a video
- [ ] Badge shows "1" on extension icon
- [ ] Popup shows video info
- [ ] "Add to Playlist" button is enabled

### Adding Videos

- [ ] Click "Add to Playlist"
- [ ] Success message appears
- [ ] Badge updates
- [ ] "Open Playlist" button appears
- [ ] Can add multiple videos from different tabs

### Playlist Playback

- [ ] Click "Play Now" or "Open Playlist"
- [ ] Playlist page opens in new tab
- [ ] Video loads and plays automatically
- [ ] Title and metadata display correctly
- [ ] Queue shows all videos

### Player Controls

- [ ] Play/Pause button works
- [ ] Previous/Next buttons work
- [ ] Previous button disabled on first video
- [ ] Next button disabled on last video
- [ ] Loop button toggles correctly
- [ ] Videos auto-advance when ended

### Keyboard Shortcuts

- [ ] Space toggles play/pause
- [ ] N/P navigate between videos
- [ ] Arrow keys work (seek, volume)
- [ ] L toggles loop

### Playlist Management

- [ ] Can remove individual videos
- [ ] "Clear All" removes all videos
- [ ] Removing current video plays next one
- [ ] Empty state shows when no videos

### Edge Cases

- [ ] Extension handles page reloads gracefully
- [ ] Multiple tabs can detect videos simultaneously
- [ ] Storage doesn't exceed limits
- [ ] Old playlist tab closes when opening new one

## Performance Testing

### Memory Usage

```javascript
// In service worker console
setInterval(() => {
  chrome.storage.session.getBytesInUse((bytes) => {
    console.log("Storage:", (bytes / 1024 / 1024).toFixed(2), "MB");
  });
}, 5000);
```

### Detection Speed

```javascript
// In service worker console
let detectionCount = 0;
let startTime = Date.now();

chrome.webRequest.onHeadersReceived.addListener(
  () => {
    detectionCount++;
    console.log(`Detected ${detectionCount} in ${Date.now() - startTime}ms`);
  },
  { urls: ["<all_urls>"] },
);
```

## Test Sites

Good sites for testing (no login required):

**HLS Streams:**

- https://www.vimeo.com/ (most videos)
- https://www.dailymotion.com/
- https://www.ted.com/talks

**Direct MP4:**

- https://www.w3schools.com/html/html5_video.asp
- Test files: http://commondatastorage.googleapis.com/gtv-videos-bucket/sample/

**Important:**

- DO NOT test on YouTube, Netflix, or other blocked sites
- Respect copyright and terms of service

## Debugging Tips

1. **Always check service worker console first** - This is where detection happens

2. **Use `console.log` liberally** - Already included throughout codebase

3. **Check Network tab** - See actual video requests

4. **Storage Inspector**:

   ```javascript
   chrome.storage.session.get(null, (data) =>
     console.log("All storage:", data),
   );
   ```

5. **Clear everything and start fresh**:
   ```javascript
   chrome.storage.session.clear();
   chrome.storage.local.clear();
   ```

## Getting Help

If you're stuck:

1. Check console in all contexts (service worker, content script, popup, playlist)
2. Look for error messages (usually red text)
3. Copy the full error message
4. Note what you were doing when the error occurred
5. Check if it's reproducible

## Advanced Debugging

### Enable Verbose Logging

In `src/utils/constants.js`, add:

```javascript
export const DEBUG_MODE = true;
```

Then update service-worker.js:

```javascript
import { DEBUG_MODE } from "../utils/constants.js";

const log = (...args) => {
  if (DEBUG_MODE) console.log(...args);
};
```

### Trace Message Flow

Add logging to track messages:

```javascript
// service-worker.js
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  console.log("📥 RECEIVED:", msg.cmd, "from:", sender.tab?.id || "popup");
  // ... rest of handler
  console.log("📤 SENDING:", response);
});
```

### Monitor Storage Changes

```javascript
chrome.storage.onChanged.addListener((changes, namespace) => {
  console.log("Storage changed in", namespace, ":", changes);
});
```
