# 📚 CTF Author Guide — Adding New Challenges

## 🎯 Overview

Challenges live in a **separate repository**: [CCPG-Challenges](https://github.com/ChickenLoner/CCPG-Challenges).
This keeps the main app repo clean and safe from GitHub scanning CTF binaries or malware samples.

Each challenge is a **self-contained folder** named with a meaningful slug. Progression order is set by the `id` field in `challenge.json` — not the folder name — so the same structure works for both linear campaign-style and jeopardy-style CTFs.

---

## 📁 CCPG-Challenges Repository Structure

```
CCPG-Challenges/
├── challenges/
│   ├── xor-warmup/                ← slug (any name you choose)
│   │   ├── challenge.json         ← metadata: id, name, hint, flag, files
│   │   ├── solution.json          ← CyberChef recipe (kept server-side)
│   │   ├── xor_challenge.zip      ← download package for players
│   │   └── validation.bin         ← server-only validation file
│   ├── base64-layering/
│   │   ├── challenge.json
│   │   ├── solution.json
│   │   └── ...
│   └── my-new-challenge/
│       └── ...
└── README.md
```

> **Rule:** folder name = slug (lowercase, hyphens). Order = `id` in `challenge.json`.

---

## 📝 File Formats

### `challenge.json`

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
      "file": "xor_challenge.zip",
      "description": "Encryption binary and sample encrypted file"
    }
  ],
  "validationFile": "validation.bin"
}
```

**Fields:**
| Field | Description |
|-------|-------------|
| `id` | Integer — controls progression order. Lower = earlier. |
| `name` | Displayed to players |
| `description` | What the challenge is about |
| `hint` | Help text for stuck players |
| `flag` | Awarded on success (format: `CHEF{...}`) |
| `challengeFiles` | Array of files players can download |
| `challengeFiles[].name` | Button label (e.g. "Challenge Package", "Binary", "PCAP") |
| `challengeFiles[].file` | Filename inside this challenge's folder |
| `challengeFiles[].description` | *(optional)* Tooltip text |
| `validationFile` | File used for server-side validation — **never given to players** |

**Multiple files example:**
```json
"challengeFiles": [
  { "name": "Binary",          "file": "encrypt",          "description": "Encryption program" },
  { "name": "Network Capture", "file": "traffic.pcap",     "description": "Encrypted traffic" },
  { "name": "Encrypted Sample","file": "sample.bin",       "description": "Practice file" }
]
```

---

### `solution.json`

A CyberChef recipe exported as Clean JSON. The server runs this against `validationFile` to get the expected output, then compares against the player's result.

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

Multi-operation example:
```json
[
  { "op": "From Base64", "args": ["A-Za-z0-9+/=", true, false] },
  { "op": "XOR",        "args": [{"option": "Hex", "string": "42"}, "Standard", false] },
  { "op": "ROT47",      "args": [47] }
]
```

---

## 🚀 Adding a New Challenge — Step by Step

### Step 1: Clone CCPG-Challenges

```bash
git clone https://github.com/ChickenLoner/CCPG-Challenges.git
cd CCPG-Challenges
```

### Step 2: Create your challenge folder

Pick a descriptive slug. The `id` in `challenge.json` controls order, not the folder name.

```bash
mkdir challenges/my-new-challenge
cd challenges/my-new-challenge
```

### Step 3: Write your encryption program

Create two encrypted files — a **sample** for players to practice, and a **validation file** the server uses (never shared with players):

```c
// encrypt.c
#include <stdio.h>

void xor_data(char *data, int len, char key) {
    for (int i = 0; i < len; i++) data[i] ^= key;
}

int main() {
    char key = 0x99;

    // Sample — players practice on this
    char sample[] = "Hello, player!";
    xor_data(sample, sizeof(sample) - 1, key);
    FILE *f = fopen("sample.bin", "wb");
    fwrite(sample, 1, sizeof(sample) - 1, f);
    fclose(f);

    // Validation — server uses this, NEVER share with players
    char secret[] = "supersecretvalue";
    xor_data(secret, sizeof(secret) - 1, key);
    f = fopen("validation.bin", "wb");
    fwrite(secret, 1, sizeof(secret) - 1, f);
    fclose(f);

    return 0;
}
```

```bash
gcc encrypt.c -o encrypt
./encrypt          # generates sample.bin + validation.bin

# Package for players (binary + sample only, NOT validation.bin)
zip challenge.zip encrypt sample.bin
```

### Step 4: Build and test your solution in CyberChef

1. Open https://gchq.github.io/CyberChef/
2. Load `sample.bin` as input
3. Build your decryption recipe until the output is correct
4. **Test on validation.bin too** — same recipe must work on both files
5. Click **Save recipe → Clean JSON** and save as `solution.json`

### Step 5: Create `challenge.json`

```json
{
  "id": 6,
  "name": "My New Challenge",
  "description": "Short description of what players need to do.",
  "hint": "A helpful nudge in the right direction.",
  "flag": "CHEF{my_fl4g_h3r3}",
  "challengeFiles": [
    {
      "name": "Challenge Package",
      "file": "challenge.zip",
      "description": "Encryption binary and sample file"
    }
  ],
  "validationFile": "validation.bin"
}
```

> Set `id` to the next number in sequence (or any integer — order is by `id` value).

### Step 6: Final folder layout

```
challenges/my-new-challenge/
  challenge.json      ← metadata
  solution.json       ← decryption recipe
  challenge.zip       ← players download this
  validation.bin      ← server-only, never shared
```

### Step 7: Commit and push to CCPG-Challenges

```bash
git add challenges/my-new-challenge/
git commit -m "Add my-new-challenge"
git push
```

### Step 8: Sync and test locally

```bash
# In CyberChef-Playground repo
npm run sync    # pulls latest from CCPG-Challenges
npm start       # server logs should show your new challenge
```

The server will print:
```
✓ 6 challenge(s) loaded:
  [1] xor-warmup — XOR Warmup
  ...
  [6] my-new-challenge — My New Challenge
```

---

## ✅ Benefits of This Architecture

| Benefit | Detail |
|---------|--------|
| **Safe main repo** | Binaries and malware samples never touch CyberChef-Playground |
| **Named slugs** | Folder names are readable; `id` controls order |
| **Works for any CTF style** | Campaign (sequential ids) or jeopardy (all unlocked) |
| **No server changes** | Drop a folder in CCPG-Challenges, sync, done |
| **Easy Docker** | `docker-compose up --build` clones challenges at build time |
| **Easy local dev** | `npm run sync` to get latest, no rebuild needed |

---

## 🔍 How Validation Works

```
Player submits recipe
        ↓
Server parses recipe (Deep Link / Chef / JSON)
        ↓
Reads validationFile from challenge folder (hidden from players)
        ↓
Runs player recipe  → SHA256 of result
Runs solution recipe → SHA256 of result
        ↓
Hashes match? → Award flag + unlock next challenge
              → No match: return hint
```

---

## 🛠️ Useful CyberChef Operations for Challenge Design

**Encoding:** From/To Base64, Base32, Base58, Hex, URL Decode
**Symmetric crypto:** XOR, AES Decrypt, DES Decrypt, RC4, Blowfish
**Classical ciphers:** ROT13, ROT47, Substitution, Vigenère
**Hashing:** MD5, SHA1, SHA256, HMAC
**Data manipulation:** Reverse, Swap endianness, Subsection, Extract
**Analysis:** Magic (auto-detect), Entropy, Frequency distribution

---

## 💡 Challenge Design Tips

1. **Test both files** — make sure your `solution.json` decrypts both `sample.bin` and `validation.bin` correctly
2. **Meaningful hints** — point to the right CyberChef operation, not the answer
3. **Progressive difficulty** — use `id` to sequence easy → hard
4. **Descriptive slugs** — `aes-cbc-ransomware` is more useful than `challenge6`
5. **Multiple files** — give players a binary, PCAP, or memory dump for realistic RE
6. **Test all 4 recipe formats** — especially Deep Link (most common player workflow)

---

## 🐛 Troubleshooting

**Challenge not appearing after sync?**
- Check `challenge.json` is valid JSON (use a validator)
- Confirm the folder is inside `CCPG-Challenges/challenges/`
- Re-run `npm run sync` and check server startup logs

**"Failed to load challenges" on startup?**
- Run `npm run sync` first — challenges aren't bundled with the app
- Check network access to GitHub

**Solution not matching?**
- Test your recipe on `validation.bin` in CyberChef (not just `sample.bin`)
- Check operation names use spaces, not underscores (`"From Base64"` not `"From_Base64"`)
- Verify all args are correct type (string vs number vs boolean)

**Deep link not parsing?**
- URL must contain `#recipe=`
- Include the full URL starting with `https://`
- Test the link in a browser to confirm CyberChef loads the recipe correctly

---

Happy challenge building! 🚀
