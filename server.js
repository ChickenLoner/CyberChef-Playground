import express from 'express';
import crypto from 'crypto';
import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import chef from 'cyberchef-node';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ---------------------------------------------------------------------------
// Load ccpg.config.json — controls mode and sync behaviour.
// ---------------------------------------------------------------------------
const CONFIG_PATH = path.join(__dirname, 'ccpg.config.json');
let appConfig = { mode: 'linear', autoPullChallenges: true };
try {
  appConfig = JSON.parse(await fs.readFile(CONFIG_PATH, 'utf8'));
} catch {
  console.warn('⚠  No ccpg.config.json found, defaulting to linear mode.');
}
const MODE = appConfig.mode === 'jeopardy' ? 'jeopardy' : 'linear';

// Challenges are stored in a separate repo (CCPG-Challenges).
// Locally: run `npm run sync` → clones into .ccpg-challenges/challenges/
// Docker:  baked in at build time, overridden via CHALLENGES_DIR env var.
const CHALLENGES_DIR = process.env.CHALLENGES_DIR
  || path.join(__dirname, '.ccpg-challenges', 'challenges');

const app = express();

app.use(express.json({ limit: '10mb' }));
app.use(express.static('public'));
app.use('/challenges', express.static(CHALLENGES_DIR));

// ---------------------------------------------------------------------------
// Challenge registry — loaded once at startup, keyed by id (integer).
// Each entry has the challenge config + solutionRecipe + folderName.
// ---------------------------------------------------------------------------
const challengesById = new Map(); // id → challenge object

async function loadAllChallenges() {
  challengesById.clear();

  const entries = await fs.readdir(CHALLENGES_DIR, { withFileTypes: true });
  const folders = entries.filter(e => e.isDirectory());

  for (const folder of folders) {
    try {
      const configPath   = path.join(CHALLENGES_DIR, folder.name, 'challenge.json');
      const solutionPath = path.join(CHALLENGES_DIR, folder.name, 'solution.json');

      const challenge = JSON.parse(await fs.readFile(configPath, 'utf8'));
      challenge.solutionRecipe = JSON.parse(await fs.readFile(solutionPath, 'utf8'));
      challenge.folderName = folder.name;

      challengesById.set(challenge.id, challenge);
    } catch (e) {
      console.warn(`  ⚠ Skipping "${folder.name}": ${e.message}`);
    }
  }

  // Keep map sorted by id so iteration order matches progression
  const sorted = [...challengesById.entries()].sort(([a], [b]) => a - b);
  challengesById.clear();
  for (const [id, ch] of sorted) challengesById.set(id, ch);
}

function getChallenge(id) {
  return challengesById.get(id) || null;
}

function getTotalChallenges() {
  return challengesById.size;
}

// Returns the next challenge id after `id`, or null if it's the last one
function getNextId(id) {
  const ids = [...challengesById.keys()];
  const idx = ids.indexOf(id);
  return idx !== -1 && idx < ids.length - 1 ? ids[idx + 1] : null;
}

// ---------------------------------------------------------------------------
// User progress tracking
// ---------------------------------------------------------------------------
const userProgress = new Map();

// ---------------------------------------------------------------------------
// Recipe parsing helpers
// ---------------------------------------------------------------------------

function parseDeepLink(url) {
  try {
    console.log('Parsing deep link:', url);

    const hashIndex = url.indexOf('#');
    if (hashIndex === -1) throw new Error('No # found in URL');

    const params = new URLSearchParams(url.substring(hashIndex + 1));
    let recipeString = params.get('recipe');
    if (!recipeString) throw new Error('No recipe parameter found');

    console.log('Raw recipe from URL:', recipeString);
    recipeString = decodeURIComponent(recipeString);
    console.log('Decoded recipe:', recipeString);

    return parseChefFormat(recipeString);
  } catch (error) {
    console.error('Deep link parsing error:', error.message);
    throw new Error(`Failed to parse deep link: ${error.message}`);
  }
}

function parseChefFormat(chefString) {
  const operations = [];
  const lines = chefString.trim().split('\n');

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    const match = trimmed.match(/^([\w_]+)\((.*)\)$/);
    if (!match) throw new Error(`Invalid Chef format: ${trimmed}`);

    let opName = match[1].replace(/_/g, ' ');
    const argsString = match[2];
    let args = [];

    if (argsString.trim()) {
      let jsonArgs = argsString
        .replace(/'/g, '"')
        .replace(/(\w+):/g, '"$1":');
      try {
        args = JSON.parse(`[${jsonArgs}]`);
      } catch {
        args = argsString.split(',').map(arg => {
          arg = arg.trim();
          if ((arg.startsWith("'") && arg.endsWith("'")) ||
              (arg.startsWith('"') && arg.endsWith('"'))) return arg.slice(1, -1);
          if (arg === 'true')  return true;
          if (arg === 'false') return false;
          if (!isNaN(arg))     return Number(arg);
          return arg;
        });
      }
    }

    operations.push({ op: opName, args });
  }

  return operations;
}

async function executeCyberChefRecipe(inputData, recipe) {
  try {
    console.log(`Executing recipe with ${recipe.length} operations`);
    console.log(`Operations: ${recipe.map(r => r.op).join(' → ')}`);

    const dish   = new chef.Dish(inputData, chef.Dish.ARRAY_BUFFER);
    const result = await chef.bake(dish, recipe);
    const output = await result.get(chef.Dish.ARRAY_BUFFER);
    const buffer = Buffer.from(output);

    console.log(`Result: ${buffer.length} bytes (${buffer.slice(0, 64).toString('hex')}${buffer.length > 64 ? '...' : ''})`);
    return buffer;
  } catch (error) {
    console.error('CyberChef execution error:', error.message);
    throw error;
  }
}

// ---------------------------------------------------------------------------
// API routes
// ---------------------------------------------------------------------------

// Return active config (mode only — never expose secrets)
app.get('/api/config', (_req, res) => {
  res.json({ mode: MODE });
});

// List all challenges (used by jeopardy board; also works in linear mode)
app.get('/api/challenges', (req, res) => {
  const sessionId = req.headers['x-session-id'];
  if (!sessionId || !userProgress.has(sessionId)) {
    return res.status(401).json({ error: 'Invalid session' });
  }
  const progress = userProgress.get(sessionId);
  const challenges = [...challengesById.values()].map(ch => ({
    id:          ch.id,
    name:        ch.name,
    description: ch.description || '',
    category:    ch.category || 'General',
    completed:   progress.completedLevels.includes(ch.id)
  }));
  res.json({ challenges });
});

// Initialize user session
app.post('/api/init', (_req, res) => {
  const sessionId    = crypto.randomUUID();
  const firstId      = [...challengesById.keys()][0] ?? 1;
  userProgress.set(sessionId, { currentLevel: firstId, completedLevels: [] });
  res.json({ sessionId, currentLevel: firstId });
});

// Get challenge info by id
app.get('/api/challenge/:level', async (req, res) => {
  const id        = parseInt(req.params.level);
  const sessionId = req.headers['x-session-id'];

  if (!sessionId || !userProgress.has(sessionId)) {
    return res.status(401).json({ error: 'Invalid session' });
  }

  const progress = userProgress.get(sessionId);
  if (MODE === 'linear' && id > progress.currentLevel) {
    return res.status(403).json({ error: 'Level not unlocked yet' });
  }

  const challenge = getChallenge(id);
  if (!challenge) return res.status(404).json({ error: 'Challenge not found' });

  const files = challenge.challengeFiles.map(f => ({
    name:        f.name,
    url:         `/challenges/${challenge.folderName}/${f.file}`,
    description: f.description || null
  }));

  res.json({ level: id, name: challenge.name, category: challenge.category || 'General', description: challenge.description, hint: challenge.hint, files });
});

// Download challenge files from per-challenge folder
app.get('/challenges/:folder/:filename', async (req, res) => {
  try {
    const folder   = req.params.folder;
    const filename = path.basename(req.params.filename); // prevent traversal

    // Only allow known challenge folder names
    const known = [...challengesById.values()].map(c => c.folderName);
    if (!known.includes(folder)) {
      return res.status(404).json({ error: 'Challenge not found' });
    }

    const filepath = path.join(CHALLENGES_DIR, folder, filename);
    try { await fs.access(filepath); } catch {
      return res.status(404).json({ error: 'File not found' });
    }

    res.download(filepath, err => {
      if (err && !res.headersSent) res.status(500).json({ error: 'Download failed' });
    });
  } catch (error) {
    console.error('File download error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Validate CyberChef recipe
app.post('/api/validate/:level', async (req, res) => {
  const id        = parseInt(req.params.level);
  const sessionId = req.headers['x-session-id'];

  if (!sessionId || !userProgress.has(sessionId)) {
    return res.status(401).json({ error: 'Invalid session' });
  }

  const progress = userProgress.get(sessionId);
  if (MODE === 'linear' && id > progress.currentLevel) {
    return res.status(403).json({ error: 'Level not unlocked yet' });
  }

  const challenge = getChallenge(id);
  if (!challenge) return res.status(404).json({ error: 'Challenge not found' });

  try {
    const { recipe, format } = req.body;
    if (!recipe) return res.status(400).json({ error: 'Recipe is required' });

    console.log(`\n${'='.repeat(50)}`);
    console.log(`Validating [${challenge.folderName}] ${challenge.name}`);
    console.log(`Recipe format: ${format || 'json'}`);

    let parsedRecipe;
    try {
      if (format === 'deeplink')      parsedRecipe = parseDeepLink(recipe);
      else if (format === 'chef')     parsedRecipe = parseChefFormat(recipe);
      else parsedRecipe = typeof recipe === 'string' ? JSON.parse(recipe) : recipe;

      if (!Array.isArray(parsedRecipe)) throw new Error('Recipe must be an array of operations');
    } catch (parseError) {
      return res.status(400).json({ success: false, message: 'Invalid recipe format', error: parseError.message });
    }

    const validationPath = path.join(CHALLENGES_DIR, challenge.folderName, challenge.validationFile);
    const validationData = await fs.readFile(validationPath);

    console.log(`Validation file: ${validationData.length} bytes, hex: ${validationData.slice(0, 32).toString('hex')}${validationData.length > 32 ? '...' : ''}`);

    const userResult     = await executeCyberChefRecipe(validationData, parsedRecipe);
    const expectedResult = await executeCyberChefRecipe(validationData, challenge.solutionRecipe);

    const userHash     = crypto.createHash('sha256').update(userResult).digest('hex');
    const expectedHash = crypto.createHash('sha256').update(expectedResult).digest('hex');

    console.log(`User result:     ${userResult.length} bytes, SHA256: ${userHash}`);
    console.log(`Expected result: ${expectedResult.length} bytes, SHA256: ${expectedHash}`);
    console.log(`Match: ${userHash === expectedHash ? '✓ YES' : '✗ NO'}`);
    console.log('='.repeat(50) + '\n');

    if (userHash === expectedHash) {
      if (!progress.completedLevels.includes(id)) {
        progress.completedLevels.push(id);
        if (MODE === 'linear') {
          const nextId = getNextId(id);
          progress.currentLevel = nextId ?? id;
        }
      }

      const nextId      = MODE === 'linear' ? getNextId(id) : null;
      const isLastLevel = MODE === 'linear' && nextId === null;

      return res.json({
        success:    true,
        message:    'Correct! Challenge solved!',
        flag:       challenge.flag,
        nextLevel:  nextId !== null ? progress.currentLevel : null,
        isComplete: isLastLevel
      });
    }

    return res.json({
      success: false,
      message: 'Incorrect decryption. The result does not match the expected output.',
      hint:    'Review your recipe operations and parameters. Try testing in CyberChef first.'
    });

  } catch (error) {
    console.error('Validation error:', error);
    res.status(500).json({ success: false, message: 'Validation error', error: error.message });
  }
});

// Get user progress
app.get('/api/progress', (req, res) => {
  const sessionId = req.headers['x-session-id'];
  if (!sessionId || !userProgress.has(sessionId)) {
    return res.status(401).json({ error: 'Invalid session' });
  }
  res.json({ ...userProgress.get(sessionId), totalChallenges: getTotalChallenges() });
});

// Serve frontend
app.get('/', (_req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// ---------------------------------------------------------------------------
// Startup
// ---------------------------------------------------------------------------
const PORT = process.env.PORT || 3000;

console.log('\n' + '='.repeat(60));
console.log('CyberChef Playground - Node.js API Mode');
console.log('='.repeat(60));
console.log('\n✓ Using cyberchef-node v2.0.3 (Node.js compatible)');
console.log('✓ ALL 300+ operations supported!');
console.log('✓ Deep link support enabled!');
console.log(`  Challenges dir: ${CHALLENGES_DIR}\n`);

try {
  await loadAllChallenges();

  if (challengesById.size === 0) throw new Error('No challenges found');

  console.log(`✓ ${challengesById.size} challenge(s) loaded:`);
  for (const [id, ch] of challengesById) {
    console.log(`  [${id}] ${ch.folderName} — ${ch.name}`);
  }
  console.log(`✓ Mode: ${MODE}`);
  console.log();

} catch {
  console.error('✗ Failed to load challenges!');
  console.error(`  Directory: ${CHALLENGES_DIR}`);
  console.error('\n  Run the following to sync challenges from CCPG-Challenges:\n');
  console.error('    npm run sync\n');
  console.error('  Or clone manually:');
  console.error('    git clone https://github.com/ChickenLoner/CCPG-Challenges.git .ccpg-challenges\n');
  console.error('='.repeat(60) + '\n');
  process.exit(1);
}

app.listen(PORT, () => {
  console.log(`✓ Server running on port ${PORT}`);
  console.log(`✓ Access at: http://localhost:${PORT}`);
  console.log('\n' + '='.repeat(60) + '\n');
});
