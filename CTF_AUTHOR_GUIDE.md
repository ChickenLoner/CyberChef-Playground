📚 CTF Author Guide - Adding New Challenges

🎯 Overview
Challenges are now stored as separate JSON files in the challenges-config/ directory. Each challenge has its own configuration file with a solution recipe instead of a hardcoded hash.

📁 Directory Structure
```
CyberChef-Playground/
├── challenges-config/          ← Challenge metadata
│   ├── level1.json
│   ├── level2.json
│   └── ...
├── solutions/                  ← Solution recipes (clean JSON from CyberChef)
│   ├── level1_solution.json
│   ├── level2_solution.json
│   └── ...
├── challenges/                 ← ALL challenge files (flexible!)
│   ├── level1_challenge.zip    ← ZIP with binary + sample
│   ├── level1_validation.bin   ← Validation file (different from sample)
│   ├── level2_challenge.zip
│   ├── level2_validation.bin
│   ├── level3_binary           ← Can be individual files
│   ├── level3_traffic.pcap     ← Or PCAP files
│   ├── level3_validation.bin
│   └── ...
└── server.js
```

📝 Challenge File Format

Challenge Config (challenges-config/levelN.json)
```json
{
  "id": 1,
  "name": "XOR Warmup",
  "description": "A simple XOR encryption. Reverse the binary to find the key.",
  "hint": "Look for the XOR operation in the binary. The key is a single byte.",
  "flag": "CYBER{x0r_1s_r3v3rs1bl3}",
  "challengeFiles": [
    {
      "name": "Challenge Package",
      "file": "level1_challenge.zip",
      "description": "Binary and sample encrypted file"
    }
  ],
  "validationFile": "level1_validation.bin",
  "solutionFile": "level1_solution.json"
}
```

Multiple Files Example
```json
{
  "challengeFiles": [
    {
      "name": "Binary",
      "file": "level3_binary",
      "description": "Encryption program"
    },
    {
      "name": "Network Capture",
      "file": "level3_traffic.pcap",
      "description": "PCAP with encrypted traffic"
    },
    {
      "name": "Memory Dump",
      "file": "level3_memory.dmp"
    }
  ]
}
```

Solution Recipe (solutions/levelN_solution.json)
```json
[
  {
    "op": "XOR",
    "args": [
      {"option": "Hex", "string": "42"},
      "Standard",
      false
    ]
  }
]
```

Why This Structure?
✅ Flexible File Types: ZIP, PCAP, binaries, memory dumps, anything!
✅ Multiple Files: Give players whatever they need
✅ Separate Validation: Use different file than sample to prevent hardcoding
✅ Clean Configs: Metadata separated from solution logic
✅ No Decrypted Output: Players only see flag, keeping validation clean

Field Descriptions:
- **id**: Challenge level number (1, 2, 3, ...)
- **name**: Challenge title (shown to players)
- **description**: What the challenge is about
- **hint**: Help text for stuck players
- **flag**: The flag awarded upon completion
- **challengeFiles**: Array of files to download
  - **name**: Button text (e.g., "Challenge Package", "Binary", "PCAP File")
  - **file**: Filename in challenges/ directory
  - **description** (optional): Tooltip text
- **validationFile**: File used for validation (must be different from sample!)
- **solutionFile**: Reference to solution recipe in solutions/ directory

🚀 Adding a New Challenge

Step 1: Create the Encryption & Files
Create your encryption program (any language):
```c
// level6_custom.c
#include <stdio.h>

void encrypt_data(char *data, int len, char key) {
    for (int i = 0; i < len; i++) {
        data[i] ^= key;
    }
}

int main() {
    char key = 0x99;
    
    // Create sample file for players to practice
    char sample[] = "sample";
    encrypt_data(sample, 6, key);
    FILE *f1 = fopen("level6_sample.bin", "wb");
    fwrite(sample, 1, 6, f1);
    fclose(f1);
    
    // Create DIFFERENT validation file (hidden from players)
    char validation[] = "test";  // Different content!
    encrypt_data(validation, 4, key);
    FILE *f2 = fopen("level6_validation.bin", "wb");
    fwrite(validation, 1, 4, f2);
    fclose(f2);
    
    return 0;
}
```

**Important:** Create TWO encrypted files:
1. **Sample file**: For players to practice (included in challenge ZIP)
2. **Validation file**: For server validation (NOT given to players)

Compile and generate files:
```bash
gcc level6_custom.c -o level6_custom
./level6_custom

# Package for players (sample + binary)
zip level6_challenge.zip level6_custom level6_sample.bin
```

Step 2: Test Decryption in CyberChef
1. Go to https://gchq.github.io/CyberChef/
2. Load level6_sample.bin (the practice file)
3. Build your decryption recipe
4. Verify output is "sample"
5. Click "Copy recipe" → Select "Clean JSON"
6. Save as solutions/level6_solution.json

Example solutions/level6_solution.json:
```json
[
  {
    "op": "XOR",
    "args": [
      {"option": "Hex", "string": "99"},
      "Standard",
      false
    ]
  }
]
```

**Important:** Test your solution also works on the validation file!
```bash
# Manually test validation file
# Load level6_validation.bin in CyberChef
# Apply same recipe → should output "test"
```

Step 3: Create Challenge Config
Create challenges-config/level6.json:
```json
{
  "id": 6,
  "name": "Custom Challenge",
  "description": "Your challenge description here",
  "hint": "Your hint here",
  "flag": "CYBER{your_fl4g_h3r3}",
  "challengeFiles": [
    {
      "name": "Challenge Package",
      "file": "level6_challenge.zip",
      "description": "Binary and sample encrypted file"
    }
  ],
  "validationFile": "level6_validation.bin",
  "solutionFile": "level6_solution.json"
}
```

**Note:** Players get the challenge ZIP, but validation file stays on server!

Step 4: Copy Files
```bash
# Copy challenge package (for players to download)
cp level6_challenge.zip challenges/

# Copy validation file (server-only, NOT in ZIP)
cp level6_validation.bin challenges/

# Solution recipe is already in solutions/level6_solution.json
# Config is already in challenges-config/level6.json
```

**File Organization:**
- `challenges/level6_challenge.zip` → Players download this
- `challenges/level6_validation.bin` → Server uses this (hidden)
- Players practice on sample, server validates on different data!

Step 5: Test
```bash
# Restart server
npm start

# Open browser
# Challenge should appear automatically!
```

✅ Benefits of This System

1. **Separate Solution Files**
   - Copy-paste directly from CyberChef
   - No risk of breaking JSON syntax in challenge config
   - Clean separation of concerns

2. **No Hardcoded Hashes**
   - Server runs solution recipe to get expected output
   - Compares user output with solution output
   - More flexible and maintainable

3. **Easy to Add Challenges**
   - Drop 2 JSON files: config + solution
   - No need to edit server.js
   - Auto-discovered by server

4. **Easy to Update**
   - Change flag: Edit challenge config
   - Change hint: Edit challenge config
   - Fix solution: Edit solution recipe
   - No code changes needed!

5. **Version Control Friendly**
   - Each challenge is separate file
   - Solutions are separate from metadata
   - Easy to see what changed
   - Easy to collaborate

6. **Error-Proof**
   - Challenge config is simple (8 fields)
   - Solution recipe is pure CyberChef export
   - Less chance of syntax errors

🔗 NEW: Deep Link Support

The playground now supports **4 recipe formats**:

1. **🔗 Deep Link (URL)** - NEW!
   - Paste the full CyberChef URL
   - Automatically extracts recipe from URL
   - Ignores input data
   - URL decoded automatically
   
   Example:
   ```
   https://gchq.github.io/CyberChef/#recipe=XOR(%7B'option':'Hex','string':'42'%7D,'Standard',false)&input=c2Rhc2FkYXNkYXNkYXNkc2Fk
   ```

2. **📄 Clean JSON**
   - In CyberChef: Save recipe → Clean JSON
   ```json
   [
     {
       "op": "XOR",
       "args": [
         {"option": "Hex", "string": "42"},
         "Standard",
         false
       ]
     }
   ]
   ```

3. **📦 Compact JSON**
   - In CyberChef: Save recipe → Compact JSON
   ```json
   [{"op":"XOR","args":[{"option":"Hex","string":"42"},"Standard",false]}]
   ```

4. **🔧 Chef Format**
   - In CyberChef: Save recipe → Chef format
   ```
   XOR({'option':'Hex','string':'42'},'Standard',false)
   ```

**Why Deep Link?**
- Users can simply copy browser URL
- No need to export recipe manually
- Fastest workflow for players
- Most intuitive for beginners

**How It Works:**
1. User creates recipe in CyberChef
2. Copies URL from browser
3. Pastes entire URL in playground
4. Server extracts recipe from URL hash
5. URL decodes and parses recipe
6. Validates solution

🎨 Advanced Examples

Multi-Operation Chain (solutions/levelN_solution.json)
```json
[
  {
    "op": "From Base64",
    "args": ["A-Za-z0-9+/=", true, false]
  },
  {
    "op": "XOR",
    "args": [
      {"option": "Hex", "string": "42"},
      "Standard",
      false
    ]
  },
  {
    "op": "ROT47",
    "args": [47]
  },
  {
    "op": "From Hex",
    "args": ["Auto"]
  }
]
```

Using AES Encryption (solutions/levelN_solution.json)
```json
[
  {
    "op": "AES Decrypt",
    "args": [
      {"option": "Hex", "string": "0123456789abcdef0123456789abcdef"},
      {"option": "Hex", "string": ""},
      "CBC",
      "Hex",
      "Raw",
      {"option": "Hex", "string": ""}
    ]
  }
]
```

Using Custom Encoding (solutions/levelN_solution.json)
```json
[
  {
    "op": "From Base58",
    "args": ["123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz", true]
  },
  {
    "op": "Reverse",
    "args": ["Character"]
  }
]
```

🔍 How Validation Works

```
1. User submits recipe (any of 4 formats)
   ↓
2. Server parses recipe format:
   - Deep Link: Extract from URL, decode, parse
   - Chef Format: Parse operations
   - JSON: Parse directly
   ↓
3. Server runs user's recipe on validation file
   → Gets user output
   ↓
4. Server runs solution recipe on same file
   → Gets expected output
   ↓
5. Server compares SHA256 hashes
   → Match? Award flag!
   → No match? Show hint
```

📊 Challenge Difficulty Progression

Recommended progression:
- **Level 1-2**: Single operation (XOR, Base64)
- **Level 3-4**: Two operations
- **Level 5-7**: Three operations
- **Level 8+**: Complex chains, custom crypto

🛠️ Useful CyberChef Operations

**Encoding/Decoding:**
- From/To Base64, Base32, Base58
- From/To Hex
- URL Decode
- HTML Entity Decode

**Crypto:**
- XOR, XOR Brute Force
- AES Decrypt, DES Decrypt
- RC4, Blowfish

**Hashing:**
- MD5, SHA1, SHA2, SHA3
- HMAC

**Data Manipulation:**
- ROT13, ROT47
- Reverse
- Swap endianness
- Subsection

**Analysis:**
- Entropy
- Frequency distribution
- Magic (auto-detect)

💡 Tips for Creating Good Challenges

1. **Start Simple**: Test your encryption in CyberChef first
2. **Clear Hints**: Give players a path forward
3. **Test Thoroughly**: Make sure solution works in all 4 formats
4. **Unique Flags**: Use format like `CTF{descriptive_flag_text}`
5. **Binary Analysis**: Include hints in the binary for realistic RE
6. **Deep Link Friendly**: Test that your recipe works via URL copy-paste

🐛 Troubleshooting

**Challenge not appearing?**
- Check filename: must be levelN.json where N is a number
- Check JSON syntax: use a validator
- Check file location: must be in challenges-config/

**Solution not working?**
- Test recipe in CyberChef web interface first
- Try submitting via deep link (copy URL)
- Check operation names (spaces, not underscores in JSON)
- Verify all arguments are correct
- Check encrypted file is in challenges/ directory

**Deep link not parsing?**
- Check URL contains `#recipe=` parameter
- Verify URL is complete (including https://)
- Check for URL encoding issues
- Test in browser first - does CyberChef load correctly?

**Players seeing wrong error?**
- Check solution recipe produces expected output
- Verify binary file exists
- Verify encrypted file exists
- Test all 4 recipe formats

🎉 You're Ready!

Start creating awesome challenges! Remember:
- Keep it fun but challenging
- Progressive difficulty
- Good hints for stuck players
- Test everything!
- **NEW**: Test deep link format for best UX!

Happy CTF creating! 🚀
