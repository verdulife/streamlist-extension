# Extension Icons

You need to add icon files to this directory:

- `icon-16.png` - 16x16 pixels (toolbar icon, small)
- `icon-48.png` - 48x48 pixels (extension management)
- `icon-128.png` - 128x128 pixels (Chrome Web Store)

## Quick Icon Generation

### Option 1: Use an online tool

- https://favicon.io/favicon-generator/
- https://www.favicon-generator.org/

### Option 2: Use an AI generator

- "Generate a red play button icon on dark background"
- Export as PNG in required sizes

### Option 3: Use Figma/Photoshop

Create a simple design with:

- Red circle (#FF0000)
- White play triangle
- Dark or transparent background

### Option 4: Placeholder (for development)

Run this command to create simple placeholder icons:

```bash
# Install imagemagick first (if not installed)
# macOS: brew install imagemagick
# Ubuntu: sudo apt install imagemagick
# Windows: download from imagemagick.org

# Generate placeholder icons
convert -size 16x16 xc:red -fill white -draw "polygon 6,4 6,12 12,8" public/icons/icon-16.png
convert -size 48x48 xc:red -fill white -draw "polygon 18,12 18,36 36,24" public/icons/icon-48.png
convert -size 128x128 xc:red -fill white -draw "polygon 48,32 48,96 96,64" public/icons/icon-128.png
```

## Temporary Solution

For now, you can use any 3 PNG files (even screenshots) renamed to the correct sizes. Chrome will resize them automatically, though they may look blurry.

Just make sure:

1. All three files exist
2. They are PNG format
3. They are named correctly

The extension will work without proper icons, but Chrome will show a warning.
