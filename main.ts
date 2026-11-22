// Midnight Vault, handed in. The game itself is the game/ folder beside this file: plain static
// files (game/index.html and its ES modules) that a desktop browser plays offline, with no
// library and no network request. This program copies game/ and screenshots/ into /output and
// writes /output/dossier.json, the summary the judge reads, with the vendored make.fun library.
//
// Serve the game locally with `node serve.ts`, then open http://localhost:8080.
// Outside the grader's container, MAKEFUN_OUTPUT_DIR stands in for /output:
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts

import { cpSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const repoRoot = fileURLToPath(new URL('.', import.meta.url));
const outputDir = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

// The caps are the scorer's own (reference/gate.json). Only text_max_bytes shapes the bytes of
// the dossier; the rest make this program refuse an entry the scorer would refuse anyway: more
// than 4 screenshots or one over 256 KiB, more than 993 files or 48 MiB under game/, or a path
// under game/ longer than 1000 bytes.
const GATE_CAPS = {
  text_max_bytes: 163840,
  screenshots: { max: 4, max_bytes: 262144 },
  game_max_files: 993,
  game_max_bytes: 50331648,
  game_path_max_bytes: 1000,
};

/** Copy one of the entry's folders into /output, creating the destination first. */
function handIn(folder) {
  mkdirSync(join(outputDir, folder), { recursive: true });
  if (existsSync(join(repoRoot, folder))) {
    cpSync(join(repoRoot, folder), join(outputDir, folder), { recursive: true });
  }
}

mkdirSync(outputDir, { recursive: true });
handIn('game');
handIn('screenshots');
writeFileSync(join(outputDir, 'dossier.json'), buildDossier(outputDir, GATE_CAPS));
