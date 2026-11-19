// Neon Bay — the entry program for make.fun's gta6-01 ("Make GTA 6").
// It hands the game in: it copies game/ and screenshots/ from this
// repository to the output directory and writes /output/dossier.json with
// the kit's vendored library, vendor/makefun-game.ts.
//
// Outside the grader, MAKEFUN_OUTPUT_DIR stands in for /output:
//   MAKEFUN_OUTPUT_DIR=out node main.ts
import { cpSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { buildDossier } from './vendor/makefun-game.ts';

const outDir = process.env.MAKEFUN_OUTPUT_DIR || '/output';
const root = new URL('.', import.meta.url).pathname;

function main() {
  mkdirSync(outDir, { recursive: true });
  const gameSrc = join(root, 'game');
  const shotsSrc = join(root, 'screenshots');
  if (!existsSync(gameSrc)) throw new Error('game/: no such directory in this repository');
  if (!existsSync(shotsSrc)) throw new Error('screenshots/: no such directory in this repository');
  cpSync(gameSrc, join(outDir, 'game'), { recursive: true });
  cpSync(shotsSrc, join(outDir, 'screenshots'), { recursive: true });
  const dossier = buildDossier(outDir, {
    text_max_bytes: 163840,
    screenshots: { max: 4, max_bytes: 262144 },
    game_max_files: 993,
    game_max_bytes: 50331648,
  });
  writeFileSync(join(outDir, 'dossier.json'), dossier);
  console.log(`Neon Bay handed in: ${outDir} (dossier ${dossier.length} bytes)`);
}

main();
