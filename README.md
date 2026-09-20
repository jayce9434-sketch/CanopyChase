# Canopy Chase

A flat-file, mobile-first tag fangame prototype made for iOS/desktop browsers. All required game files are in this single folder so you can upload them directly to a GitHub repository root.

## Files
- `index.html` — main game page
- `game.js` — game logic, AI bots, game modes, cosmetics, saving, mod menu, soundboard, voice/chat reactions
- `style.css` — responsive iOS/mobile UI
- `manifest.webmanifest` — installable web-app metadata
- `sw.js` — offline cache/service worker
- `icon-192.png`, `icon-512.png` — app icons

## Run
Upload every file to the root of a GitHub repository and enable GitHub Pages, or serve the folder with any static web server.

On iPhone/iPad Safari, use **Share → Add to Home Screen** to install it like an app.

## Controls
- Mobile/iOS: two joysticks control the left/right hands and movement.
- Finger buttons: toggle index/grip poses.
- Thumb button: opens the sandbox mod menu.
- Microphone button: uses browser speech recognition when supported, otherwise opens text chat.
- Desktop fallback: WASD moves; UI buttons still work with mouse.

## Included
- 9 AI bots with randomized names/colors/cosmetics and variable skill
- Casual, Tag, Infection, Echo Hunt
- Forest, Hat Plaza, leaderboard, Echo Cave
- 16 permanent cosmetics + 4 three-day event cosmetics
- Event auto-removes after 72 hours; purchased event cosmetics remain owned
- Private room codes (local simulated rooms)
- Color codes and settings
- Persistent local save data
- Glow Stone currency: exactly 100 per active hour; no offline catch-up, so missed days/weeks do not award currency
- Long Arms, Platforms, Ghost Monke, Invisible Monke, Kick Gun
- Soundboard with AI fear/reaction behavior
- Voice/text interaction with bot responses
- Procedural sound effects and ambient music
- Installable PWA support
