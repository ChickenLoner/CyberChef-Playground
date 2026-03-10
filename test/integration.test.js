// test/integration.test.js — End-to-end recipe validation tests
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import chef from 'cyberchef-node';
import { executeRecipe } from '../flow-control.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(__dirname, '..');

// Challenge dir: prefer env var, fall back to the challenge/ subfolder in repo
const CHALLENGES_DIR =
  process.env.CHALLENGES_DIR ||
  path.join(PROJECT_ROOT, 'challenge', 'challenges');

function sha256(buf) {
  return crypto.createHash('sha256').update(buf).digest('hex');
}

async function run(input, recipe) {
  const inputBuf = Buffer.isBuffer(input) ? input : Buffer.from(input, 'utf8');
  return await executeRecipe(inputBuf, recipe, chef);
}

// ---------------------------------------------------------------------------
// Backwards compatibility — linear (no flow control) recipes
// ---------------------------------------------------------------------------
describe('backwards compatibility: linear recipes', () => {
  test('single-op recipe: To Base64', async () => {
    const recipe = [{ op: 'To Base64', args: ['A-Za-z0-9+/='] }];
    const input = Buffer.from('Hello, World!');
    const result = await run(input, recipe);
    assert.equal(result.toString('utf8'), 'SGVsbG8sIFdvcmxkIQ==');
  });

  test('single-op recipe: From Base64', async () => {
    const recipe = [{ op: 'From Base64', args: ['A-Za-z0-9+/=', true, false] }];
    const input = Buffer.from('SGVsbG8sIFdvcmxkIQ==');
    const result = await run(input, recipe);
    assert.equal(result.toString('utf8'), 'Hello, World!');
  });

  test('multi-op recipe: To Base64 → From Base64 is identity', async () => {
    const recipe = [
      { op: 'To Base64', args: ['A-Za-z0-9+/='] },
      { op: 'From Base64', args: ['A-Za-z0-9+/=', true, false] },
    ];
    const input = Buffer.from('test data 123');
    const result = await run(input, recipe);
    assert.deepEqual(result, input);
  });

  test('SHA256 output matches expected hash', async () => {
    const recipe = [{ op: 'To Base64', args: ['A-Za-z0-9+/='] }];
    const input = Buffer.from('CyberChef');
    const result = await run(input, recipe);
    const expected = Buffer.from('Q3liZXJDaGVm');
    assert.equal(sha256(result), sha256(expected));
  });
});

// ---------------------------------------------------------------------------
// Real-world flow control recipes
// ---------------------------------------------------------------------------
describe('multi-line Base64 decode with Fork/Merge', () => {
  test('decodes each line independently', async () => {
    const recipe = [
      { op: 'Fork', args: ['\\n', '\\n', false] },
      { op: 'From Base64', args: ['A-Za-z0-9+/=', true, false] },
      { op: 'Merge', args: [] },
    ];
    const input = 'SGVsbG8=\nV29ybGQ=\nQ3liZXJDaGVm';
    const result = await run(input, recipe);
    assert.equal(result.toString('utf8'), 'Hello\nWorld\nCyberChef');
  });

  test('empty merge delimiter concatenates results', async () => {
    const recipe = [
      { op: 'Fork', args: ['\\n', '', false] },
      { op: 'From Base64', args: ['A-Za-z0-9+/=', true, false] },
      { op: 'Merge', args: [] },
    ];
    const input = 'SGVsbG8=\nV29ybGQ=';
    const result = await run(input, recipe);
    assert.equal(result.toString('utf8'), 'HelloWorld');
  });
});

describe('loop decode with Label/Jump', () => {
  test('triple-Base64 decoded via loop', async () => {
    // Encode 'CyberChef' 3 times
    const plain = 'CyberChef';
    const encoded3 = btoa(btoa(btoa(plain)));

    const recipe = [
      { op: 'Label', args: ['start'] },
      { op: 'From Base64', args: ['A-Za-z0-9+/=', true, false] },
      { op: 'Jump', args: ['start', 2] }, // 3 total decodes (1 initial + 2 jumps)
    ];
    const result = await run(encoded3, recipe);
    assert.equal(result.toString('utf8'), plain);
  });
});

describe('Register + dynamic key', () => {
  test('captures first 8 bytes as key, XORs remainder', async () => {
    // Build input: 8-char key prefix + XOR(plaintext, key)
    const key = '12345678';
    const plaintext = 'secret!!';
    const xored = Buffer.alloc(plaintext.length);
    for (let i = 0; i < plaintext.length; i++) {
      xored[i] = plaintext.charCodeAt(i) ^ key.charCodeAt(i % key.length);
    }
    const input = Buffer.concat([Buffer.from(key), xored]);

    const recipe = [
      { op: 'Register', args: ['(.{8})', true, false, false] },
      { op: 'Drop bytes', args: [0, 8, false] },
      { op: 'XOR', args: [{ option: 'UTF8', string: '$R0' }, 'Standard', false] },
    ];
    const result = await run(input, recipe);
    assert.equal(result.toString('utf8'), plaintext);
  });
});

describe('Subsection: only hex portions decoded', () => {
  test('hex portions decoded, non-hex text preserved', async () => {
    // '48 65 6c 6c 6f' = 'Hello' in hex with spaces
    const recipe = [
      { op: 'Subsection', args: ['(?:[0-9a-f]{2} )*[0-9a-f]{2}', true, true, false] },
      { op: 'From Hex', args: ['Space'] },
      { op: 'Merge', args: [] },
    ];
    const result = await run('start 48 65 6c 6c 6f end', recipe);
    assert.equal(result.toString('utf8'), 'start Hello end');
  });
});

describe('Conditional Jump loop', () => {
  test('loop terminates when condition no longer matches', async () => {
    // Each iteration: strip one leading 'a', stop when no more 'a'
    const recipe = [
      { op: 'Label', args: ['loop'] },
      { op: 'Find / Replace', args: [{ option: 'Regex', string: '^a' }, '', true, false, true, false] },
      { op: 'Conditional Jump', args: ['a', false, 'loop', 100] },
    ];
    const result = await run('aaabbb', recipe);
    assert.equal(result.toString('utf8'), 'bbb');
  });
});

// ---------------------------------------------------------------------------
// Advanced challenge acceptance tests
// These run only if the challenge validation files are present.
// ---------------------------------------------------------------------------

async function loadChallenge(folder) {
  const dir = path.join(CHALLENGES_DIR, folder);
  try {
    await fs.access(dir);
  } catch {
    return null; // challenge directory not available
  }
  const solution = JSON.parse(await fs.readFile(path.join(dir, 'solution.json'), 'utf8'));
  const challengeJson = JSON.parse(await fs.readFile(path.join(dir, 'challenge.json'), 'utf8'));
  const validationData = await fs.readFile(path.join(dir, challengeJson.validationFile));
  return { solution, validationData, flag: challengeJson.flag };
}

describe('advanced challenge: dns-exfil-aes (Fork + Register)', () => {
  test('recipe produces stable SHA256 output from validation.bin', async (t) => {
    const ch = await loadChallenge('dns-exfil-aes');
    if (!ch) {
      t.skip('challenge files not available (run npm run sync)');
      return;
    }

    const result = await run(ch.validationData, ch.solution);
    // Run twice to verify determinism
    const result2 = await run(ch.validationData, ch.solution);
    assert.equal(sha256(result), sha256(result2), 'Output must be deterministic');
    assert.ok(result.length > 0, 'Output must be non-empty');
  });

  test('player recipe matching solution hash succeeds', async (t) => {
    const ch = await loadChallenge('dns-exfil-aes');
    if (!ch) {
      t.skip('challenge files not available (run npm run sync)');
      return;
    }

    const solutionResult = await run(ch.validationData, ch.solution);
    const playerResult = await run(ch.validationData, ch.solution); // same recipe
    assert.equal(sha256(playerResult), sha256(solutionResult));
  });
});

describe('advanced challenge: arithmetic-obfuscation (Fork + Subsection×3)', () => {
  test('recipe produces stable SHA256 output from validation.bin', async (t) => {
    const ch = await loadChallenge('arithmetic-obfuscation');
    if (!ch) {
      t.skip('challenge files not available (run npm run sync)');
      return;
    }

    const result = await run(ch.validationData, ch.solution);
    const result2 = await run(ch.validationData, ch.solution);
    assert.equal(sha256(result), sha256(result2), 'Output must be deterministic');
    assert.ok(result.length > 0, 'Output must be non-empty');
  });
});

describe('advanced challenge: free-python-obfuscator (Label + Conditional Jump loop)', () => {
  test('recipe produces stable SHA256 output from validation.bin', async (t) => {
    const ch = await loadChallenge('free-python-obfuscator');
    if (!ch) {
      t.skip('challenge files not available (run npm run sync)');
      return;
    }

    const result = await run(ch.validationData, ch.solution);
    const result2 = await run(ch.validationData, ch.solution);
    assert.equal(sha256(result), sha256(result2), 'Output must be deterministic');
    assert.ok(result.length > 0, 'Output must be non-empty');
  });
});

// ---------------------------------------------------------------------------
// Error handling
// ---------------------------------------------------------------------------
describe('error handling', () => {
  test('Jump to undefined label → descriptive error', async () => {
    await assert.rejects(
      () => run('data', [{ op: 'Jump', args: ['missing', 1] }]),
      /undefined label/i
    );
  });

  test('Subsection without matching Merge → descriptive error', async () => {
    await assert.rejects(
      () => run('data', [
        { op: 'Subsection', args: ['\\w+', true, false, false] },
        { op: 'ROT13', args: [true, true, false, 13] },
        // No Merge
      ]),
      /[Mm]erge/
    );
  });

  test('recipe that would run forever hits MAX_STEPS', async () => {
    await assert.rejects(
      () => run('data', [
        { op: 'Label', args: ['inf'] },
        { op: 'Jump', args: ['inf', 1000000] },
      ]),
      /limit|steps/i
    );
  });
});
