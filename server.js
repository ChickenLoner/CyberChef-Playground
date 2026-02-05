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

// Challenge configuration
const CHALLENGES = {
  1: {
    name: "XOR Warmup",
    description: "A simple XOR encryption. Reverse the binary to find the key.",
    binaryFile: "level1_xor",
    encryptedFile: "level1_encrypted.bin",
    expectedHash: "9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08",
    hint: "Look for the XOR operation in the binary. The key is a single byte.",
    flag: "CYBER{x0r_1s_r3v3rs1bl3}"
  },
  2: {
    name: "Base64 Layering",
    description: "Multiple encoding layers. What's hiding beneath?",
    binaryFile: "level2_base64",
    encryptedFile: "level2_encrypted.bin",
    expectedHash: "9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08",
    hint: "Sometimes data is encoded multiple times. Check how many layers there are.",
    flag: "CYBER{b4s364_0n10n_l4y3rs}"
  },
  3: {
    name: "Substitution Mystery",
    description: "Simple substitution cipher. Can you extract the key?",
    binaryFile: "level3_aes",
    encryptedFile: "level3_encrypted.bin",
    expectedHash: "9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08",
    hint: "Look for ADD or SUB operations. The key is visible in the binary.",
    flag: "CYBER{subst1tut10n_c1ph3r}"
  },
  4: {
    name: "ROT Combination",
    description: "Classical cipher with a twist.",
    binaryFile: "level4_rot",
    encryptedFile: "level4_encrypted.bin",
    expectedHash: "9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08",
    hint: "ROT13 isn't the only rotation. Try different amounts.",
    flag: "CYBER{r0t4t3_4ll_th3_w4y}"
  },
  5: {
    name: "Final Boss: Multi-Stage",
    description: "Ransomware-like encryption chain. Decrypt all stages to win!",
    binaryFile: "level5_boss",
    encryptedFile: "level5_encrypted.bin",
    expectedHash: "9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08",
    hint: "Multiple operations in sequence. Find all parameters and correct order.",
    flag: "CTF{m4st3r_0f_cyb3rch3f_pl4ygr0und}"
  }
};

// User progress tracking
const userProgress = new Map();

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
    
    // Get the result as string
    const output = await result.get(chef.Dish.STRING);
    
    console.log(`Result: "${output}" (${output.length} chars)`);
    
    return output;
    
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
  
  const challenge = CHALLENGES[level];
  if (!challenge) {
    return res.status(404).json({ error: 'Challenge not found' });
  }
  
  res.json({
    level,
    name: challenge.name,
    description: challenge.description,
    hint: challenge.hint,
    binaryUrl: `/challenges/${challenge.binaryFile}`,
    encryptedFileUrl: `/challenges/${challenge.encryptedFile}`
  });
});

// Download challenge files
app.get('/challenges/:filename', async (req, res) => {
  try {
    const filename = req.params.filename;
    const sanitized = path.basename(filename);
    const filepath = path.join(__dirname, 'challenges', sanitized);
    
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
  
  const challenge = CHALLENGES[level];
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
      if (format === 'chef') {
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
    
    // Read encrypted file
    const encryptedPath = path.join(__dirname, 'challenges', challenge.encryptedFile);
    const encryptedData = await fs.readFile(encryptedPath);
    
    console.log(`Input: ${encryptedData.length} bytes, hex: ${encryptedData.toString('hex')}`);
    
    // Execute recipe using CyberChef Node.js API
    const result = await executeCyberChefRecipe(encryptedData, parsedRecipe);
    
    // Calculate hash of result
    const resultHash = crypto.createHash('sha256')
      .update(result)
      .digest('hex');
    
    console.log(`Expected hash: ${challenge.expectedHash}`);
    console.log(`Result hash:   ${resultHash}`);
    console.log(`Match: ${resultHash === challenge.expectedHash ? '✓ YES' : '✗ NO'}`);
    console.log('='.repeat(50) + '\n');
    
    // Validate hash
    if (resultHash === challenge.expectedHash) {
      // Update progress
      if (!progress.completedLevels.includes(level)) {
        progress.completedLevels.push(level);
        progress.currentLevel = Math.min(level + 1, Object.keys(CHALLENGES).length + 1);
      }
      
      const isLastLevel = level === Object.keys(CHALLENGES).length;
      
      return res.json({
        success: true,
        message: 'Correct! Challenge solved!',
        flag: challenge.flag,
        nextLevel: isLastLevel ? null : progress.currentLevel,
        decryptedContent: result,
        isComplete: isLastLevel
      });
    } else {
      return res.json({
        success: false,
        message: 'Incorrect decryption. The hash does not match.',
        expectedHash: challenge.expectedHash,
        gotHash: resultHash,
        decryptedContent: result.substring(0, 100),
        hint: 'Review your recipe operations and parameters.'
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
app.get('/api/progress', (req, res) => {
  const sessionId = req.headers['x-session-id'];
  
  if (!sessionId || !userProgress.has(sessionId)) {
    return res.status(401).json({ error: 'Invalid session' });
  }
  
  const progress = userProgress.get(sessionId);
  res.json(progress);
});

// Serve frontend
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

const PORT = process.env.PORT || 3000;

console.log('\n' + '='.repeat(60));
console.log('CyberChef Playground CTF - Node.js API Mode');
console.log('='.repeat(60));
console.log('\n✓ Using cyberchef-node v2.0.3 (Node.js compatible)');
console.log('✓ ALL 300+ operations supported!');
console.log('✓ No browser needed - pure Node.js\n');

app.listen(PORT, () => {
  console.log(`✓ Server running on port ${PORT}`);
  console.log(`✓ Access at: http://localhost:${PORT}`);
  console.log('\n' + '='.repeat(60) + '\n');
});