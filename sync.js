#!/usr/bin/env node
/**
 * CCPG Sync — synchronise challenges from the CCPG-Challenges repository.
 *
 * Usage:
 *   node sync.js          — clone (first run) or pull (update)
 *   npm run sync          — same via package.json script
 *
 * Inspired by KAPE's KapeFiles sync model:
 *   https://www.kroll.com/en/services/cyber-risk/incident-response-litigation-support/kroll-artifact-parser-extractor-kape
 */

import { execSync } from 'child_process';
import { existsSync } from 'fs';
import { fileURLToPath } from 'url';
import path from 'path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const CHALLENGES_REPO = 'https://github.com/ChickenLoner/CCPG-Challenges.git';
const CHALLENGES_DIR  = path.join(__dirname, 'challenges');

function run(cmd, opts = {}) {
  execSync(cmd, { stdio: 'inherit', ...opts });
}

console.log('\n' + '='.repeat(60));
console.log('CCPG Sync — CyberChef Playground Challenge Sync');
console.log('='.repeat(60));
console.log(`Repository : ${CHALLENGES_REPO}`);
console.log(`Local path : ${CHALLENGES_DIR}`);
console.log('='.repeat(60) + '\n');

try {
  if (!existsSync(CHALLENGES_DIR)) {
    console.log('Challenges folder not found. Cloning from CCPG-Challenges...\n');
    run(`git clone "${CHALLENGES_REPO}" "${CHALLENGES_DIR}"`);
    console.log('\n✓ Challenges synced successfully!');
  } else {
    console.log('Challenges folder found. Pulling latest from CCPG-Challenges...\n');
    run(`git -C "${CHALLENGES_DIR}" pull`);
    console.log('\n✓ Challenges up to date!');
  }

  // Count challenges detected
  const { readdirSync } = await import('fs');
  const levels = readdirSync(CHALLENGES_DIR, { withFileTypes: true })
    .filter(e => e.isDirectory() && /^level\d+$/.test(e.name));
  console.log(`✓ ${levels.length} challenge(s) available: ${levels.map(e => e.name).join(', ')}\n`);

} catch (err) {
  console.error('\n✗ Sync failed:', err.message);
  console.error('  Make sure git is installed and you have network access.\n');
  process.exit(1);
}
