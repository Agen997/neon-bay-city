// Neon Bay 3D — entrypoint: copy game/ and screenshots/ to the output directory
// and write dossier.json with the kit's vendored buildDossier library.
import { writeFileSync, existsSync, mkdirSync, rmSync, cpSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const out = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';
const root = dirname(fileURLToPath(import.meta.url));
mkdirSync(out, { recursive: true });
for (const dir of ['game', 'screenshots']) {
  const src = join(root, dir);
  const dst = join(out, dir);
  if (existsSync(dst)) rmSync(dst, { recursive: true, force: true });
  if (existsSync(src)) cpSync(src, dst, { recursive: true });
}
const dossier = buildDossier(out, {
  text_max_bytes: 163840,
  screenshots: { max: 4, max_bytes: 262144 },
  game_max_files: 993,
  game_max_bytes: 50331648,
});
writeFileSync(join(out, 'dossier.json'), dossier);
console.log('dossier written:', dossier.length, 'bytes');
