# 🎬 Video Playlist Extension

Chrome/Brave extension to capture video streams from websites and play them in a YouTube-style playlist without ads, popups, or distractions.

## ✨ Features

- 🎥 **Auto-detect video streams** - Captures HLS (M3U8), DASH (MPD), and direct MP4/WebM videos
- 🔍 **MSE Interception** - Advanced capturing using MediaSource Extensions hooks
- 📋 **Playlist Management** - Add multiple videos to a temporary playlist
- ▶️ **YouTube-style Player** - Clean interface with auto-advance to next video
- ⚡ **One-Click Play** - Instantly play videos without downloading
- 🚫 **Ad-Free Experience** - Watch videos without website clutter
- ⌨️ **Keyboard Shortcuts** - Control playback with keyboard
- 🎨 **Dark Mode UI** - Beautiful Tailwind-based interface

## 🚀 Installation

### Prerequisites

- Node.js 18+ or Bun
- Chrome or Brave browser

### Setup

1. **Clone or download this repository**

2. **Install dependencies**

   Using npm:

   ```bash
   npm install
   ```

   Or using Bun (recommended):

   ```bash
   bun install
   ```

3. **Build the extension**

   Development mode (with hot reload):

   ```bash
   npm run dev
   # or
   bun run dev
   ```

   Production build:

   ```bash
   npm run build
   # or
   bun run build
   ```

4. **Load in Chrome/Brave**
   - Open `chrome://extensions/` (or `brave://extensions/`)
   - Enable **Developer mode** (toggle in top right)
   - Click **Load unpacked**
   - Select the `dist` folder from this project

5. **Done!** The extension icon should appear in your toolbar

## 📖 How to Use

### Capturing Videos

1. **Navigate to a video page** (e.g., Vimeo, Dailymotion, streaming sites)
2. **Play the video** - The extension will auto-detect the stream
3. **Click the extension icon** - A badge will show the number of detected videos

### Adding to Playlist

In the popup, you have 3 options:

- **🎬 Add to Playlist** - Saves the video for later
- **▶️ Play Now** - Immediately opens the playlist and starts playing
- **📋 Open Playlist** - Opens the playlist viewer (only shown if videos exist)

### Playlist Page

The playlist page features:

- **Video Player** - Plays HLS, DASH, MP4, and WebM videos
- **Queue Sidebar** - Shows all videos in the playlist
- **Auto-Advance** - Automatically plays next video when current ends
- **Loop Mode** - Click the loop button to repeat playlist
- **Remove Videos** - Hover over items to reveal remove button

### Keyboard Shortcuts

When on the playlist page:

| Key     | Action           |
| ------- | ---------------- |
| `Space` | Play/Pause       |
| `N`     | Next video       |
| `P`     | Previous video   |
| `L`     | Toggle loop      |
| `←`     | Seek backward 5s |
| `→`     | Seek forward 5s  |
| `↑`     | Volume up        |
| `↓`     | Volume down      |

## 🛠️ Development

### Project Structure

```
video-playlist-extension/
├── src/
│   ├── background/
│   │   └── service-worker.js      # Background service worker
│   ├── content/
│   │   ├── content.js              # Content script (ISOLATED)
│   │   └── mse-interceptor.js      # MSE hooks (MAIN world)
│   ├── popup/
│   │   ├── popup.html
│   │   ├── popup.js
│   │   └── popup.css
│   ├── playlist/
│   │   ├── playlist.html
│   │   ├── playlist.js
│   │   └── playlist.css
│   └── utils/
│       ├── constants.js            # Shared constants
│       ├── storage.js              # Storage helpers
│       └── detector.js             # Video detection logic
├── public/
│   └── icons/                      # Extension icons
├── manifest.json                   # Extension manifest
├── vite.config.js                  # Vite configuration
├── tailwind.config.js              # Tailwind configuration
└── package.json
```

### Technology Stack

- **Build Tool**: Vite + @crxjs/vite-plugin
- **Styling**: Tailwind CSS
- **Video Player**: hls.js for HLS streams
- **APIs**: Chrome Extension APIs (webRequest, storage, scripting, tabs)

### Detection Methods

The extension uses multiple methods to detect videos:

1. **webRequest API** - Intercepts network requests for M3U8/MPD manifests
2. **MSE Interception** - Hooks into MediaSource.addSourceBuffer() to capture segments
3. **Video Element Detection** - Finds `<video>` tags with direct sources

### Storage

- **chrome.storage.session** - Temporary playlist (cleared when browser closes)
- **chrome.storage.local** - User settings (persistent)

### Adding Custom Detection

To add support for new video types, edit `src/utils/constants.js`:

```javascript
export const VIDEO_CONTENT_TYPES = [
  "your/content-type",
  // ...
];

export const VIDEO_EXTENSIONS = [
  "xyz",
  // ...
];
```

## 🔧 Troubleshooting

### Videos Not Detected

- Make sure the video is actually playing on the page
- Check that the site isn't on the blocked list (YouTube, Netflix, etc.)
- Open DevTools Console and look for detection logs
- Try refreshing the page and playing the video again

### Playback Issues

- Some streams require specific CORS headers - these won't work
- DRM-protected content (Widevine) cannot be captured
- Check browser console for error messages

### Extension Not Loading

- Make sure you're loading the `dist` folder (after running build)
- Check `chrome://extensions/` for error messages
- Try rebuilding: `npm run build` or `bun run build`

## 🚫 Limitations

### Blocked Sites

For legal reasons, the following sites are blocked:

- YouTube (use YouTube directly or Premium)
- Netflix
- Disney+
- HBO Max
- Amazon Prime Video

### DRM Content

Videos protected with DRM (Widevine, PlayReady, FairPlay) cannot be captured as the decryption happens in a secure enclave.

### CORS Restrictions

Some videos may not play due to Cross-Origin Resource Sharing (CORS) policies. This is a browser security feature.

## 📝 TODO / Roadmap

- [ ] Add DASH playback support (dash.js)
- [ ] Generate video thumbnails automatically
- [ ] Export/import playlist functionality
- [ ] Download videos for offline viewing
- [ ] Quality selector for multi-bitrate streams
- [ ] Playback speed control
- [ ] Picture-in-Picture mode
- [ ] Search/filter in playlist
- [ ] Drag & drop to reorder videos

## 🤝 Contributing

Contributions are welcome! Please feel free to submit issues or pull requests.

## ⚖️ Legal Notice

This extension is for personal use only. Users are responsible for ensuring they have the right to access and view content. Respect copyright laws and terms of service of websites you visit.

## 📄 License

MIT License - See LICENSE file for details

## 🙏 Credits

- Built with [Vite](https://vitejs.dev/)
- Video playback powered by [hls.js](https://github.com/video-dev/hls.js/)
- Styled with [Tailwind CSS](https://tailwindcss.com/)
- Icons from [Heroicons](https://heroicons.com/)

---

**Enjoy ad-free video watching! 🎉**
