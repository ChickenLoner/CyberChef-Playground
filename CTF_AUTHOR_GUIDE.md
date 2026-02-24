📚 CTF Author Guide - Adding New Challenges

🎯 Overview
Each challenge lives in its own self-contained folder under `challenges/`. No more hunting across three directories - everything for a challenge is in one place.

📁 Directory Structure
```
CyberChef-Playground/
├── challenges/
│   ├── level1/
│   │   ├── challenge.json        ← Challenge metadata + config
│   │   ├── solution.json         ← Solution recipe (CyberChef JSON)
│   │   ├── level1_challenge.zip  ← Download for players
│   │   └── level1_validation.bin ← Validation file (server-only)
│   ├── level2/
│   │   ├── challenge.json
│   │   ├── solution.json
│   │   ├── level2_challenge.zip
│   │   └── level2_validation.bin
│   └── level3/
│       ├── challenge.json
│       ├── solution.json
│       ├── level3_binary
│       ├── level3_traffic.pcap   ← Can include any file types
│       ├── level3_encrypted.bin
│       └── level3_validation.bin
└── server.js
```

📝 Challenge File Format

challenge.json (challenges/levelN/challenge.json)
```json
{
  "id": 1,
  "name": "XOR Warmup",
  "description": "A simple XOR encryption. Reverse the binary to find the key.",
  "hint": "Look for the XOR operation in the binary. The key is a single byte.",
  "flag": "CHEF{x0r_1s_r3v3rs1bl3}",
  "challengeFiles": [
    {
      "name": "Challenge Package",
      "file": "level1_challenge.zip",
      "description": "Binary and sample encrypted file"
    }
  ],
  "validationFile": "level1_validation.bin"
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

solution.json (challenges/levelN/solution.json)
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
✅ One Folder Per Challenge: All files together, no hunting across directories
✅ Flexible File Types: ZIP, PCAP, binaries, memory dumps, anything!
✅ Multiple Files: Give players whatever they need
✅ Separate Validation: Use different file than sample to prevent hardcoding
✅ No Decrypted Output: Players only see flag, keeping validation clean

Field Descriptions:
- **id**: Challenge level number (1, 2, 3, ...)
- **name**: Challenge title (shown to players)
- **description**: What the challenge is about
- **hint**: Help text for stuck players
- **flag**: The flag awarded upon completion
- **challengeFiles**: Array of files to download
  - **name**: Button text (e.g., "Challenge Package", "Binary", "PCAP File")
  - **file**: Filename inside this challenge's folder
  - **description** (optional): Tooltip text
- **validationFile**: File used for validation (must be different from sample!)

🚀 Adding a New Challenge

Step 1: Create a new folder
```bash
mkdir challenges/level6
```

Step 2: Create the Encryption & Files
Create your encryption program (any language):
```c
// encrypt.c
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
gcc encrypt.c -o encrypt
./encrypt

# Package for players (binary + sample)
zip level6_challenge.zip encrypt level6_sample.bin
```

Step 3: Test Decryption in CyberChef
1. Go to https://gchq.github.io/CyberChef/
2. Load level6_sample.bin (the practice file)
3. Build your decryption recipe
4. Verify output is "sample"
5. Click "Copy recipe" → Select "Clean JSON"
6. Save as `challenges/level6/solution.json`

Example challenges/level6/solution.json:
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

Step 4: Create challenge.json
Create `challenges/level6/challenge.json`:
```json
{
  "id": 6,
  "name": "Custom Challenge",
  "description": "Your challenge description here",
  "hint": "Your hint here",
  "flag": "CHEF{your_fl4g_h3r3}",
  "challengeFiles": [
    {
      "name": "Challenge Package",
      "file": "level6_challenge.zip",
      "description": "Binary and sample encrypted file"
    }
  ],
  "validationFile": "level6_validation.bin"
}
```

Step 5: Copy Files into the folder
```bash
cp level6_challenge.zip challenges/level6/
cp level6_validation.bin challenges/level6/
# solution.json and challenge.json are already there
```

Your final folder should look like:
```
challenges/level6/
  challenge.json
  solution.json
  level6_challenge.zip     ← Players download this
  level6_validation.bin    ← Server uses this (never given to players)
```

Step 6: Test
```bash
npm start
# Open browser - challenge appears automatically!
```

✅ Benefits of This System

1. **One Folder Per Challenge**
   - Everything in one place
   - Easy to zip/share/archive a challenge
   - No hunting across three directories

2. **No Hardcoded Hashes**
   - Server runs solution recipe to get expected output
   - Compares user output with solution output
   - More flexible and maintainable

3. **Easy to Add Challenges**
   - Drop a new levelN/ folder with the two JSON files + files
   - No need to edit server.js
   - Auto-discovered by server

4. **Easy to Update**
   - Change flag: Edit challenge.json
   - Change hint: Edit challenge.json
   - Fix solution: Edit solution.json
   - No code changes needed!

5. **Version Control Friendly**
   - Each challenge is its own folder
   - Easy to see what changed per challenge
   - Easy to collaborate

🔗 Deep Link Support

The playground supports **4 recipe formats**:

1. **🔗 Deep Link (URL)**
   - Paste the full CyberChef URL
   - Automatically extracts recipe from URL

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

🔍 How Validation Works

```
User submits recipe (any of 4 formats)
         ↓
Server parses format:
  • Deep Link → Extract from URL + decode
  • Chef Format → Parse operations
  • JSON → Parse directly
         ↓
Run user recipe on challenges/levelN/validation.bin
  → Get output as RAW BYTES (Buffer)
         ↓
Run solution recipe on same file
  → Get expected output as RAW BYTES
         ↓
Calculate SHA256 on raw bytes
  → User SHA256 vs Expected SHA256
         ↓
Match? → Award flag!
No match? → Show hint
```

🎨 Advanced Examples

Multi-Operation Chain (solution.json)
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

Using AES Encryption (solution.json)
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

💡 Tips for Creating Good Challenges

1. **Start Simple**: Test your encryption in CyberChef first
2. **Clear Hints**: Give players a path forward
3. **Test Thoroughly**: Make sure solution works in all 4 formats
4. **Unique Flags**: Use format like `CHEF{descriptive_flag_text}`
5. **Binary Analysis**: Include hints in the binary for realistic RE
6. **Deep Link Friendly**: Test that your recipe works via URL copy-paste

🐛 Troubleshooting

**Challenge not appearing?**
- Check folder name: must be `levelN` where N is a number
- Check `challenge.json` syntax: use a JSON validator
- Check folder location: must be directly inside `challenges/`

**Solution not working?**
- Test recipe in CyberChef web interface first
- Try submitting via deep link (copy URL)
- Check operation names (spaces, not underscores in JSON)
- Verify all arguments are correct
- Check files exist in the challenge folder

**Deep link not parsing?**
- Check URL contains `#recipe=` parameter
- Verify URL is complete (including https://)
- Test in browser first - does CyberChef load correctly?

**Players seeing wrong error?**
- Check solution recipe produces expected output
- Verify `validationFile` filename matches the file in the folder
- Test all 4 recipe formats

🎉 You're Ready!

Start creating awesome challenges! Remember:
- Keep it fun but challenging
- Progressive difficulty
- Good hints for stuck players
- Test everything!

Happy CTF creating! 🚀
