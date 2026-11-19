# Neon Bay

[![make.fun gta6-01](https://make.fun/badge/gta6-01.svg)](https://make.fun/c/gta6-01)
[![rank](https://make.fun/badge/gta6-01/Agen997/neon-bay-city/rank.svg)](https://make.fun/c/gta6-01)
[![reward](https://make.fun/badge/gta6-01/Agen997/neon-bay-city/reward.svg)](https://make.fun/c/gta6-01)

**Neon Bay** is a 3D open-world crime game set in a sun-soaked coastal city at golden
hour. You are **Rex Marlowe**, a small-time hustler running jobs for fixer **Mara Voss**
on Harbor Row. Steal cars, dodge the **NBPD**, take on the **Tide Kings** gang, and end
their boss's reign at **Lighthouse Point**.

Built for the [make.fun GTA 6 bounty](https://make.fun/c/gta6-01) (`gta6-01`). Everything
in the game — city, names, story, art, sounds — is original.

## How to run

```sh
node serve.ts
# then open http://localhost:8080 in desktop Chrome
```

No build step and no network needed: the game is plain static files under `game/`
(Three.js is vendored as a minified module under `game/vendor/`).

To hand the entry in (copies `game/` and `screenshots/` to the output and writes the
dossier):

```sh
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
```

## Controls

| Input | Action |
| --- | --- |
| **WASD** | Move on foot / drive |
| **Mouse** (click to lock) | Orbit camera; arrow keys also turn it |
| **Shift** | Sprint |
| **Space** | Jump on foot / handbrake in a car |
| **F** | Enter / exit (steal) a car |
| **Left click** | Punch / shoot |
| **1–4** | Fists, pistol, SMG, shotgun |
| **R** | Radio: off → Bay FM → Sunset Synth |
| **P** | Pause |

## Features

- **A whole coastal city**: road grid with traffic and pedestrians, pastel towers with
  lit windows, neon signs, palm-lined Harbor Row, beach, water, and a working lighthouse
  with a rotating beam — all under a permanent sunset.
- **On foot and by car**: third-person movement with sprint and jump, arcade driving,
  carjacking, traffic that follows the road network and brakes for you.
- **Wanted system**: five stars, NBPD patrol cars that chase and ram, roadblocks from
  three stars, a spotlight helicopter from four, line-of-sight decay, and a busted flow
  (fine + confiscated guns) if they box you in.
- **Combat**: fists, pistol, SMG and shotgun with ammo, tracers, muzzle flash and impact
  particles; health, armor and cash pickups; the Tide Kings shoot back.
- **A five-job story** from Mara Voss — a pickup, a timed delivery, a gang clear-out, a
  hot car, and a boss fight against the Tide King at Lighthouse Point — ending in a win
  screen and free roam.
- **HUD + minimap**: cash, clock, stars, health/armor, weapon and ammo, mission objective
  with distance, and a live minimap with police dots and the mission marker.
- **Save / Continue** via localStorage, title screen, pause, busted/wasted screens.
- **All-synthesized audio**: WebAudio gunshots, pickups, engine, sirens and a two-station
  in-game radio — no audio files.

## Tech

- Three.js (vendored `three.module.min.js`) + plain ES modules, one job per file:
  `city.js` builds the world, `actors.js` the crowd and traffic, `player.js` Rex and the
  camera, `police.js` the wanted system, `combat.js` weapons and the gang, `missions.js`
  the story, `hud.js` the interface, `audio.js` the synth, `save.js` persistence,
  `shots.js` the staged screenshot scenes (`?shot=cover|drive|wanted|boss&seed=1`).
- Procedural canvas textures for facades, neon signs, asphalt and pickups; instanced
  palms and streetlights; fixed-step simulation.

## License

MIT — see `LICENSE`.
