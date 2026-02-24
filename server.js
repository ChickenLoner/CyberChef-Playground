import express from 'express';
import crypto from 'crypto';
import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import chef from 'cyberchef-node';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

app.use(express.json({ limit: '10mb' })); // Increase limit for large recipes
app.use(express.static('public'));
app.use('/challenges', express.static('challenges'));

// Load challenges from per-challenge folders
const challengesCache = new Map();

async function loadChallenge(level) {
  // Check cache first
  if (challengesCache.has(level)) {
    return challengesCache.get(level);
  }

  try {
    // Load challenge config from per-challenge folder: challenges/levelN/challenge.json
    const configPath = path.join(__dirname, 'challenges', `level${level}`, 'challenge.json');
    const data = await fs.readFile(configPath, 'utf8');
    const challenge = JSON.parse(data);

    // Load solution recipe from same folder: challenges/levelN/solution.json
    const solutionPath = path.join(__dirname, 'challenges', `level${level}`, 'solution.json');
    const solutionData = await fs.readFile(solutionPath, 'utf8');
    challenge.solutionRecipe = JSON.parse(solutionData);

    challengesCache.set(level, challenge);
    return challenge;
  } catch (error) {
    console.error(`Failed to load challenge ${level}:`, error.message);
    return null;
  }
}

// Get total number of challenges by counting levelN subdirectories
async function getTotalChallenges() {
  try {
    const challengesDir = path.join(__dirname, 'challenges');
    const entries = await fs.readdir(challengesDir, { withFileTypes: true });
    return entries.filter(e => e.isDirectory() && /^level\d+$/.test(e.name)).length;
  } catch (error) {
    return 5; // Default fallback
  }
}

// User progress tracking
const userProgress = new Map();

// Parse CyberChef deep link URL to extract recipe
function parseDeepLink(url) {
  try {
    console.log('Parsing deep link:', url);
    
    // Extract the hash part (everything after #)
    const hashIndex = url.indexOf('#');
    if (hashIndex === -1) {
      throw new Error('Invalid deep link: No # found in URL');
    }
    
    const hashPart = url.substring(hashIndex + 1);
    
    // Parse URL parameters from hash
    const params = new URLSearchParams(hashPart);
    
    // Get the recipe parameter
    let recipeString = params.get('recipe');
    if (!recipeString) {
      throw new Error('Invalid deep link: No recipe parameter found');
    }
    
    console.log('Raw recipe from URL:', recipeString);
    
    // URL decode the recipe
    recipeString = decodeURIComponent(recipeString);
    console.log('Decoded recipe:', recipeString);
    
    // Parse the recipe string which is in Chef format
    // Example: To_Base64('A-Za-z0-9+/=')
    return parseChefFormat(recipeString);
    
  } catch (error) {
    console.error('Deep link parsing error:', error.message);
    throw new Error(`Failed to parse deep link: ${error.message}`);
  }
}

// Parse Chef format string to JSON recipe
function parseChefFormat(chefString) {
  // Chef format example: XOR({'option':'Hex','string':'42'},'Standard',false)
  // or: From_Base64('A-Za-z0-9+/=',true)
  // We need to convert this to JSON format
  
  const operations = [];
  const lines = chefString.trim().split('\n');
  
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    
    // Extract operation name and args
    // Operation names can contain underscores: From_Base64, To_Base64, etc.
    const match = trimmed.match(/^([\w_]+)\((.*)\)$/);
    if (!match) {
      throw new Error(`Invalid Chef format: ${trimmed}`);
    }
    
    let opName = match[1];
    const argsString = match[2];
    
    // Convert underscores to spaces in operation names
    // Chef format: From_Base64 → CyberChef JSON: "From Base64"
    opName = opName.replace(/_/g, ' ');
    
    // Parse args - this is tricky because it's JavaScript-like
    let args = [];
    
    if (argsString.trim()) {
      // Convert single quotes to double quotes for JSON parsing
      let jsonArgs = argsString
        .replace(/'/g, '"')
        .replace(/(\w+):/g, '"$1":'); // Add quotes to keys
      
      // Parse the arguments
      try {
        args = JSON.parse(`[${jsonArgs}]`);
      } catch (e) {
        // If parsing fails, try simple comma split for primitive values
        args = argsString.split(',').map(arg => {
          arg = arg.trim();
          // Remove quotes
          if ((arg.startsWith("'") && arg.endsWith("'")) || 
              (arg.startsWith('"') && arg.endsWith('"'))) {
            return arg.slice(1, -1);
          }
          // Try to parse as number or boolean
          if (arg === 'true') return true;
          if (arg === 'false') return false;
          if (!isNaN(arg)) return Number(arg);
          return arg;
        });
      }
    }
    
    operations.push({
      op: opName,
      args: args
    });
  }
  
  return operations;
}

// Execute CyberChef recipe using the Node.js API
async function executeCyberChefRecipe(inputData, recipe) {
  try {
    console.log(`Executing recipe with ${recipe.length} operations`);
    console.log(`Operations: ${recipe.map(r => r.op).join(' → ')}`);
    
    // Create a Dish (CyberChef's data container)
    const dish = new chef.Dish(inputData, chef.Dish.ARRAY_BUFFER);
    
    // Bake the recipe
    const result = await chef.bake(dish, recipe);
    
    // Get the result as ArrayBuffer (raw bytes) - works for both binary and text
    const output = await result.get(chef.Dish.ARRAY_BUFFER);
    
    // Convert ArrayBuffer to Buffer for Node.js operations
    const buffer = Buffer.from(output);
    
    console.log(`Result: ${buffer.length} bytes (${buffer.slice(0, 64).toString('hex')}${buffer.length > 64 ? '...' : ''})`);
    
    return buffer;
    
  } catch (error) {
    console.error('CyberChef execution error:', error.message);
    throw error;
  }
}

// Initialize user session
app.post('/api/init', (req, res) => {
  const sessionId = crypto.randomUUID();
  userProgress.set(sessionId, { currentLevel: 1, completedLevels: [] });
  res.json({ sessionId, currentLevel: 1 });
});

// Get challenge info
app.get('/api/challenge/:level', async (req, res) => {
  const level = parseInt(req.params.level);
  const sessionId = req.headers['x-session-id'];
  
  if (!sessionId || !userProgress.has(sessionId)) {
    return res.status(401).json({ error: 'Invalid session' });
  }
  
  const progress = userProgress.get(sessionId);
  
  if (level > progress.currentLevel) {
    return res.status(403).json({ error: 'Level not unlocked yet' });
  }
  
  const challenge = await loadChallenge(level);
  if (!challenge) {
    return res.status(404).json({ error: 'Challenge not found' });
  }
  
  // Build download URLs for all challenge files (served from per-challenge folder)
  const files = challenge.challengeFiles.map(f => ({
    name: f.name,
    url: `/challenges/level${level}/${f.file}`,
    description: f.description || null
  }));
  
  res.json({
    level,
    name: challenge.name,
    description: challenge.description,
    hint: challenge.hint,
    files: files
  });
});

// Download challenge files from per-challenge folders
app.get('/challenges/:level/:filename', async (req, res) => {
  try {
    const level = req.params.level;
    const filename = path.basename(req.params.filename); // prevent path traversal
    const filepath = path.join(__dirname, 'challenges', level, filename);

    try {
      await fs.access(filepath);
    } catch (error) {
      return res.status(404).json({ error: 'File not found' });
    }

    res.download(filepath, (err) => {
      if (err) {
        console.error('Download error:', err);
        if (!res.headersSent) {
          res.status(500).json({ error: 'Download failed' });
        }
      }
    });
  } catch (error) {
    console.error('File download error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Validate CyberChef recipe
app.post('/api/validate/:level', async (req, res) => {
  const level = parseInt(req.params.level);
  const sessionId = req.headers['x-session-id'];
  
  if (!sessionId || !userProgress.has(sessionId)) {
    return res.status(401).json({ error: 'Invalid session' });
  }
  
  const progress = userProgress.get(sessionId);
  
  if (level > progress.currentLevel) {
    return res.status(403).json({ error: 'Level not unlocked yet' });
  }
  
  const challenge = await loadChallenge(level);
  if (!challenge) {
    return res.status(404).json({ error: 'Challenge not found' });
  }
  
  try {
    const { recipe, format } = req.body;
    
    if (!recipe) {
      return res.status(400).json({ error: 'Recipe is required' });
    }
    
    console.log(`\n${'='.repeat(50)}`);
    console.log(`Validating Level ${level}: ${challenge.name}`);
    console.log(`Recipe format: ${format || 'json'}`);
    
    // Parse recipe based on format
    let parsedRecipe;
    try {
      if (format === 'deeplink') {
        // Parse CyberChef deep link URL
        parsedRecipe = parseDeepLink(recipe);
        console.log('Parsed from deep link:', JSON.stringify(parsedRecipe, null, 2));
      } else if (format === 'chef') {
        // Parse Chef format: XOR({'option':'Hex','string':'42'},'Standard',false)
        parsedRecipe = parseChefFormat(recipe);
      } else {
        // JSON formats (clean or compact)
        parsedRecipe = typeof recipe === 'string' ? JSON.parse(recipe) : recipe;
      }
      
      if (!Array.isArray(parsedRecipe)) {
        throw new Error('Recipe must be an array of operations');
      }
    } catch (parseError) {
      return res.status(400).json({
        success: false,
        message: 'Invalid recipe format',
        error: parseError.message
      });
    }
    
    // Read validation file from per-challenge folder
    const validationPath = path.join(__dirname, 'challenges', `level${level}`, challenge.validationFile);
    const validationData = await fs.readFile(validationPath);
    
    console.log(`Validation file: ${validationData.length} bytes, hex: ${validationData.slice(0, 32).toString('hex')}${validationData.length > 32 ? '...' : ''}`);
    
    // Execute user's recipe on validation data
    const userResult = await executeCyberChefRecipe(validationData, parsedRecipe);
    
    // Execute solution recipe on validation data
    const expectedResult = await executeCyberChefRecipe(validationData, challenge.solutionRecipe);
    
    // Calculate hashes on raw bytes (works for both binary and text)
    const userHash = crypto.createHash('sha256').update(userResult).digest('hex');
    const expectedHash = crypto.createHash('sha256').update(expectedResult).digest('hex');
    
    console.log(`User result: ${userResult.length} bytes, SHA256: ${userHash}`);
    console.log(`Expected result: ${expectedResult.length} bytes, SHA256: ${expectedHash}`);
    console.log(`Match: ${userHash === expectedHash ? '✓ YES' : '✗ NO'}`);
    console.log('='.repeat(50) + '\n');
    
    // Validate hash
    if (userHash === expectedHash) {
      // Update progress
      if (!progress.completedLevels.includes(level)) {
        progress.completedLevels.push(level);
        const totalChallenges = await getTotalChallenges();
        progress.currentLevel = Math.min(level + 1, totalChallenges + 1);
      }
      
      const totalChallenges = await getTotalChallenges();
      const isLastLevel = level === totalChallenges;
      
      return res.json({
        success: true,
        message: 'Correct! Challenge solved!',
        flag: challenge.flag,
        nextLevel: isLastLevel ? null : progress.currentLevel,
        isComplete: isLastLevel
      });
    } else {
      return res.json({
        success: false,
        message: 'Incorrect decryption. The result does not match the expected output.',
        hint: 'Review your recipe operations and parameters. Try testing in CyberChef first.'
      });
    }
    
  } catch (error) {
    console.error('Validation error:', error);
    res.status(500).json({
      success: false,
      message: 'Validation error',
      error: error.message
    });
  }
});

// Get user progress
app.get('/api/progress', async (req, res) => {
  const sessionId = req.headers['x-session-id'];
  
  if (!sessionId || !userProgress.has(sessionId)) {
    return res.status(401).json({ error: 'Invalid session' });
  }
  
  const progress = userProgress.get(sessionId);
  const totalChallenges = await getTotalChallenges();
  
  res.json({
    ...progress,
    totalChallenges
  });
});

// Serve frontend
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

const PORT = process.env.PORT || 3000;

console.log('\n' + '='.repeat(60));
console.log('CyberChef Playground - Node.js API Mode');
console.log('='.repeat(60));
console.log('\n✓ Using cyberchef-node v2.0.3 (Node.js compatible)');
console.log('✓ ALL 300+ operations supported!');
console.log('✓ Deep link support enabled!');
console.log('✓ No browser needed - pure Node.js\n');

app.listen(PORT, () => {
  console.log(`✓ Server running on port ${PORT}`);
  console.log(`✓ Access at: http://localhost:${PORT}`);
  console.log('\n' + '='.repeat(60) + '\n');
});