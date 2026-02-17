# 🚀 Quick Start Guide

## 1. Prerequisites Check

Make sure you have installed:

- ✅ Node.js 18+ or Bun
- ✅ Chrome or Brave browser

Check versions:

```bash
node --version  # Should be v18 or higher
npm --version
```

Or if using Bun:

```bash
bun --version
```

## 2. Install Dependencies

Choose ONE of these:

**Using npm:**

```bash
npm install
```

**Using Bun (faster):**

```bash
bun install
```

Wait for installation to complete (~30 seconds).

## 3. Build the Extension

**For development (with hot reload):**

```bash
npm run dev
# or
bun run dev
```

**For production:**

```bash
npm run build
# or
bun run build
```

This creates a `dist/` folder with your extension.

## 4. Load in Chrome/Brave

1. **Open Extensions Page**
   - Chrome: `chrome://extensions/`
   - Brave: `brave://extensions/`
2. **Enable Developer Mode**
   - Toggle the switch in the top right corner
3. **Load Unpacked Extension**
   - Click "Load unpacked" button
   - Navigate to this project folder
   - Select the `dist` folder
   - Click "Select"

4. **Verify Installation**
   - You should see "Video Playlist Player" in your extensions list
   - The extension icon should appear in your toolbar
   - No errors should be shown

## 5. Create Icons (Optional but Recommended)

The extension will work without icons, but it's better to add them:

1. Go to `public/icons/`
2. Add three PNG files:
   - `icon-16.png` (16x16 pixels)
   - `icon-48.png` (48x48 pixels)
   - `icon-128.png` (128x128 pixels)

See `public/icons/README.md` for icon generation options.

## 6. Test the Extension

### Quick Test:

1. **Go to Vimeo** - https://vimeo.com/
2. **Play any video** - Wait for it to start
3. **Click extension icon** - Should show video detected
4. **Click "Play Now"** - Opens playlist and plays video

### What Should Happen:

✅ Badge shows "1" on extension icon  
✅ Popup shows video title and domain  
✅ Buttons are enabled  
✅ Playlist page opens in new tab  
✅ Video plays automatically

## 7. Development Workflow

If you used `npm run dev` / `bun run dev`:

- Changes to code auto-rebuild
- Refresh extension in `chrome://extensions/`
- Reload page you're testing on
- Changes take effect immediately

## Troubleshooting

### "Module not found" error

```bash
# Delete node_modules and reinstall
rm -rf node_modules
npm install
```

### Extension won't load

- Make sure you selected the `dist` folder, not the project root
- Check for errors in `chrome://extensions/`
- Try building again: `npm run build`

### Videos not detected

- Make sure the video is actually playing
- Check service worker console for errors
- See DEBUGGING.md for detailed troubleshooting

### Build fails

```bash
# Clear cache and rebuild
rm -rf dist node_modules
npm install
npm run build
```

## Next Steps

✅ **Read README.md** - Full documentation  
✅ **Check DEBUGGING.md** - When something doesn't work  
✅ **Try different sites** - Test video detection  
✅ **Customize** - Edit code to fit your needs

## Common Commands

```bash
# Install dependencies
npm install

# Development build (auto-reload)
npm run dev

# Production build
npm run build

# View build output
ls -la dist/

# Clean build
rm -rf dist && npm run build
```

## Need Help?

1. Check the console logs (see DEBUGGING.md)
2. Make sure you followed all steps
3. Try the test sites listed in DEBUGGING.md
4. Check that permissions are granted in manifest.json

---

**You're ready to go! 🎉**

Start by testing on Vimeo or Dailymotion to see it in action.
