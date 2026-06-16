# Localtify Linux release test

Use this for the Linux build check before publishing.

## Build

```bash
npm install
npm run build
npm run dist:linux
```

Expected release files:

```txt
.AppImage
.deb
.rpm
latest-linux.yml
```

## AppImage test

```bash
chmod +x Localtify-0.4.1-x86_64.AppImage
./Localtify-0.4.1-x86_64.AppImage
```

Check:

```txt
app opens
window icon shows
titlebar buttons work
sidebar scroll works
songs import
songs play
albums open
downloads page opens
open folder works
settings save after restart
```

If AppImage does not open, install FUSE/libfuse2 for the distro and retry.

## Wayland/X11 checks

Run once on the normal desktop session.

Optional debug:

```bash
XDG_SESSION_TYPE
echo $XDG_CURRENT_DESKTOP
```

Check:

```txt
no blank window
no transparent/compositor holes
no white startup screen
header/titlebar renders
page switching works
playback continues while app is backgrounded
```

## Download tools check

YouTube download depends on the bundled/downloaded yt-dlp binary.

Check:

```txt
first YouTube download downloads yt-dlp
yt-dlp is executable on Linux
download completes
downloaded track imports into library
```

## Fallback launch flags

Only use these for debugging broken drivers/compositors:

```bash
LOCALTIFY_DISABLE_GPU_TUNING=1 ./Localtify-0.4.1-x86_64.AppImage
LOCALTIFY_DISABLE_LINUX_OZONE_AUTO=1 ./Localtify-0.4.1-x86_64.AppImage
```

Localtify should work without those flags on normal installs.

