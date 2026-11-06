# Spacewar! 3D arcade exhibit

Open **arcade.html** to play the original 1962 Spacewar! game inside a stylised, Three.js-rendered arcade museum cabinet. The cabinet is an artistic exhibit, **not** a historically accurate reconstruction of PDP-1 hardware.

## How it works

- The existing, unmodified **spacewar.js** PDP-1 emulator and **spacewar.bin.js** game data still run the game.
- Its existing 550 × 550 **swcanvas** is used as a live **THREE.CanvasTexture** on the virtual cabinet's circular monitor.
- Three.js renders only the room, cabinet, screen bezel and other decorative objects.
- OrbitControls lets visitors drag to look around the machine and scroll to zoom.
- Desktop keyboard controls are passed directly to the original emulator:
  - Ship 1: W thrust, A / D rotate, S fire.
  - Ship 2: I thrust, J / L rotate, K fire.
- On touch-screen devices, two on-screen pads control the same emulator bit flags. Multi-touch is supported.

## Deployment

This is an ordinary static GitHub Pages project. No build, package installation, Node server, or changes to the existing research website are required.

1. Enable GitHub Pages from the repository root, if not already enabled.
2. Open the URL at username.github.io/spacewar/arcade.html.
3. The page loads Three.js **0.187.0** from jsDelivr using a pinned ES-module import map. An internet connection is required on first load, and for any sessions where Three.js is not cached.

To test locally, from the repository root:

    python3 -m http.server 8000

Then open http://localhost:8000/arcade.html.

## Manual checks

- Confirm the original game's star field, both spacecraft, shots, and star gravity appear on the circular screen.
- Use W/A/S/D and I/J/K/L to play two-player on desktop.
- Hold two or more separate touch buttons at once on mobile.
- Drag the background to inspect the cabinet without moving the ships.
- Resize portrait/landscape and use browser Full screen / Restart.
- Check console for WebGL/CDN errors and verify **play.html** remains fully usable.

## Credits and licenses

The original 1962 Spacewar! game is identified as public domain by the upstream preservation project, but **the JavaScript emulator and surrounding repository code have their own licenses**. In this fork the LICENSE file contains GPL-3.0 text, while the upstream README describes the emulator/site as AGPL-3.0. Confirm and reconcile the upstream notices before reusing emulator files in another product or claiming the whole fork is public-domain. Three.js is MIT-licensed. Preserve applicable attribution and licensing notices.

The original emulation is credited in this repository's README and play.html; this exhibit uses those same local emulator files rather than copying or modifying them.
