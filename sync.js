#!/usr/bin/env node
/**
 * CCPG Sync — synchronise challenges from the CCPG-Challenges repository.
 *
 * Usage:
 *   node sync.js      — clone (first run) or pull (update)
 *   npm run sync      — same via package.json script
 *
 * The repo is cloned into .ccpg-challenges/ (gitignored).
 * Challenges live at .ccpg-challenges/challenges/<slug>/
 * Server reads from that path via CHALLENGES_DIR env var (or its default).
 *
 * Inspired by KAPE's KapeFiles sync model.
 */

import { execSync }          from 'child_process';
import { existsSync }        from 'fs';
import { readdirSync }       from 'fs';
import { readFileSync }      from 'fs';
import { fileURLToPath }     from 'url';
import path                  from 'path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Read ccpg.config.json — respect autoPullChallenges setting
let syncConfig = { autoPullChallenges: true };
try {
  syncConfig = JSON.parse(readFileSync(path.join(__dirname, 'ccpg.config.json'), 'utf8'));
} catch {}

if (syncConfig.autoPullChallenges === false) {
  console.log('\n' + '='.repeat(60));
  console.log('CCPG Sync — CyberChef Playground Challenge Sync');
  console.log('='.repeat(60));
  console.log('⏭  autoPullChallenges is disabled in ccpg.config.json — skipping sync.');
  console.log('   Manage challenges manually via CHALLENGES_DIR or local folder.\n');
  process.exit(0);
}

const CHALLENGES_REPO  = syncConfig.challengesRepo || 'https://github.com/ChickenLoner/CCPG-Challenges.git';
const SYNC_DIR         = path.join(__dirname, '.ccpg-challenges');
const CHALLENGES_SUBDIR = path.join(SYNC_DIR, 'challenges');

function run(cmd, opts = {}) {
  execSync(cmd, { stdio: 'inherit', ...opts });
}

console.log('\n' + '='.repeat(60));
console.log('CCPG Sync — CyberChef Playground Challenge Sync');
console.log('='.repeat(60));
console.log(`Repository : ${CHALLENGES_REPO}`);
console.log(`Local path : ${SYNC_DIR}`);
console.log('='.repeat(60) + '\n');

try {
  if (!existsSync(SYNC_DIR)) {
    console.log('First run — cloning CCPG-Challenges...\n');
    run(`git clone "${CHALLENGES_REPO}" "${SYNC_DIR}"`);
    console.log('\n✓ Clone complete!');
  } else {
    console.log('Pulling latest from CCPG-Challenges...\n');
    run(`git -C "${SYNC_DIR}" pull`);
    console.log('\n✓ Up to date!');
  }

  // Report what was synced
  if (existsSync(CHALLENGES_SUBDIR)) {
    const slugs = readdirSync(CHALLENGES_SUBDIR, { withFileTypes: true })
      .filter(e => e.isDirectory())
      .map(e => e.name);
    console.log(`✓ ${slugs.length} challenge(s) available:`);
    slugs.forEach(s => console.log(`  • ${s}`));
  } else {
    console.warn('⚠ No challenges/ subfolder found in the cloned repo.');
  }

  console.log('\nRun `npm start` or `npm run dev` to start the server.\n');

} catch (err) {
  console.error('\n✗ Sync failed:', err.message);
  console.error('  Make sure git is installed and you have network access.\n');
  process.exit(1);
}
