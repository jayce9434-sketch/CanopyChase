# Canopy Chase

Flat-file, mobile-first arm-running tag fangame prototype for iOS/iPad and desktop browsers. Every required game file sits directly in the repository root — no folders required.

## Files
- `index.html` — app/game UI
- `game.js` — movement, AI, maps, modes, cosmetics, saving, Room 666/Morse, ban/kick systems, audio
- `style.css` — responsive iOS/mobile UI
- `manifest.webmanifest` — installable PWA metadata
- `sw.js` — offline cache/service worker
- `icon-192.png`, `icon-512.png` — app icons

## Run
Upload every file directly to the root of a GitHub repository and enable GitHub Pages, or serve the files from any static web host.

On iPhone/iPad Safari: **Share → Add to Home Screen**.

## Controls
- iOS/mobile: left + right hand joysticks move the hands and run.
- L/R Index + Grip buttons simulate finger inputs.
- Thumb button opens the mod menu.
- Microphone uses browser speech recognition when available and falls back to text chat.
- Desktop fallback: WASD + mouse/touch UI.

## Included
- 9 randomized AI bots with human-ish skill, jukes, obstacle avoidance, anti-corner-stuck recovery and cosmetic loadouts
- Casual, Tag, Infection and Echo Hunt
- Four real selectable maps: Forest, Hat Plaza, Dark Caves and Leaderboards
- Name changer and 3-digit color codes
- Private/local room codes
- Room `666`: nervous bot behavior, darker atmosphere and a 1% lobby chance for Morse
- Morse: color `000`, long arms, Morse-code audio, scary sounds, ghost/invisibility behavior, random kicks and 2-minute bans
- Player Kick Gun and 4-minute Ban Gun
- Persistent player-ban timer that keeps counting while the game is closed; banned players can use isolated Solo Casual only
- Special Owner Beacon cosmetic; nearby bots get excited and follow the wearer; bots have a 1.5% chance to spawn with it
- 16 permanent cosmetics across hats, holdables, shirts, back and face slots
- 4 mini-event cosmetics; event disappears after 72 hours while purchased items remain usable
- Persistent local save data
- Glow Stone: 100 per active hour only — no offline catch-up rewards
- Long Arms, Platforms, Ghost Monke, Invisible Monke, Kick Gun, Ban Gun and soundboard
- Bots react to frightening audio and Dark Caves ambient scares
- Installable iOS/desktop PWA support
