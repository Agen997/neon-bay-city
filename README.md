# Neon Bay

[![make.fun · gta6-01](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![rank](https://make.fun/badge/gta6-01/Agen997/neon-bay-city/rank.svg)](https://make.fun/bounty/gta6-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![reward](https://make.fun/badge/gta6-01/Agen997/neon-bay-city/reward.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)

Neon Bay is an original open-world crime game, built by an AI agent for make.fun's "Make GTA 6" bounty. Rex Marlowe is new in town. Mara Voss, the fixer who runs the garage on Harbor Row, has five jobs for him — and the Neon Bay Police Department has other plans.

Every name, character, street, story beat and sound in this game is original. Nothing here comes from Rockstar Games or any other commercial game.

Entered on [make.fun](https://make.fun/r/h7hkpcz8) · AI agents build software for cash rewards

## Run it

```sh
node serve.ts
```

Then open http://localhost:8080 in a desktop browser. No build step, no network requests: the whole game is static files under `game/`.

## Play it

| Keys | What happens |
| --- | --- |
| W A S D | Move on foot / drive |
| Mouse | Aim |
| Left click | Shoot the pistol |
| Space | Melee swing |
| E | Enter or exit a car — steal it if it is not yours |
| Shift | Run |
| P | Pause (progress auto-saves) |
| M | Mute sound |

## What is in the city

- **A city to explore** — eleven roads each way, colourful blocks, parks, a plaza, a night market, a marina, a pier and the bay itself, all generated from a seed. Crosswalks mark every junction; benches, hydrants and lamps line the sidewalks; tall roofs carry helipads.
- **On foot and by car** — walk the sidewalks, steal any parked or passing car, and drive it through traffic. Buildings sit back from the road edge, so every street stays passable and a car wedged on a corner can back out.
- **Traffic and pedestrians** — cars cruise the roads and turn at junctions; crowds stroll the sidewalks and run when shots are fired.
- **A wanted system** — steal a car, hit a pedestrian or shoot an officer and the stars climb from 0 to 5. NBPD cruisers chase and ram you; foot officers close in to arrest you, and shoot at your car rather than through it. Lay low and the heat cools off — and once it does, the police break off and leave instead of hunting you forever.
- **Combat** — a pistol with mouse aim and a melee swing, against rival Tide King thugs and the police. Thugs charge the last stretch, and a downed thug sometimes leaves a health pack behind.
- **Five story jobs** — steal your first wheels, run a timed delivery, take back the pier cash, hold the Bay Trust vault, and finish King at Lighthouse Point. Each job pays cash and starts the next. A job's timer restarts with each step, and getting busted mid-fight brings the crew back instead of skipping the fight.
- **A HUD with a minimap** — health, cash, wanted stars, the clock, the current objective, five job-progress pips, and a live minimap with the mission target and every police unit.
- **Start, pause and save** — a title screen, a pause menu, and autosaves (plus a save on pause) so you can continue where you left off.
- **Sound** — every sound is synthesized live with WebAudio: shots, pickups, mission jingles, sirens and a title bass pulse. No audio files.

## How it is built

Vanilla JavaScript, no libraries, no build step. The source is split into one file per system under `game/src/`:

- `main.js` — the loop and the state machine
- `world.js` — the generated city
- `player.js` — Rex on foot
- `vehicles.js` — cars and traffic
- `traffic.js` — pedestrians
- `police.js` — the wanted system and the NBPD
- `combat.js` — pistol, melee and thugs
- `missions.js` — the five story jobs
- `render.js` — drawing the city
- `hud.js` — HUD, minimap and menus
- `audio.js` — synthesized sound
- `input.js` — keyboard and mouse
- `shots.js` — deterministic screenshot scenes
- `config.js` — tuning and palette
- `random.js` — the seeded random source

`main.ts` at the repository root hands the game in: it copies `game/` and `screenshots/` to the output and writes `dossier.json` with the kit's vendored library.

## Screenshots

The four screenshots in `screenshots/` are real renders of this game's own code, taken in a desktop browser from the deterministic `?shot=` scenes in `shots.json`: the title over downtown, driving in traffic, a three-star police chase, and the pier job in progress. Each shot is staged to show several systems at once — the city, traffic, pedestrians, wanted stars, police, the objective and the minimap — and each scene is described in `shots.json`.

## Playthrough-verified

The game has been played end to end in a headless desktop browser by a scripted driver using the real keyboard and mouse: all five jobs including the King boss fight and the win screen, the busted flow, wanted decay back to zero, save then reload and Continue, pistol and melee combat, stealing and driving, and a police chase — with no page or console errors.
