# CTF Author Guide — Adding New Challenges

## Overview

Challenges live in a **separate repository**: [CCPG-Challenges](https://github.com/ChickenLoner/CCPG-Challenges).
This keeps the main app repo clean and safe from GitHub scanning CTF binaries or malware samples.

Each challenge is a **self-contained folder** named with a meaningful slug. Progression order is set by the `id` field in `challenge.json` — not the folder name — so the same structure works for both linear campaign-style and jeopardy-style CTFs.

---

## CCPG-Challenges Repository Structure

```
CCPG-Challenges/
├── challenges/
│   ├── xor-warmup/                ← slug (any name you choose)
│   │   ├── challenge.json         ← metadata: id, name, category, hint, flag, files
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

## File Formats

### `challenge.json`

```json
{
  "id": 1,
  "name": "XOR Warmup",
  "category": "Cryptography",
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
| Field | Required | Description |
|-------|----------|-------------|
| `id` | Yes | Integer — controls progression order. Lower = earlier. |
| `name` | Yes | Displayed to players |
| `category` | No | Groups challenges on the jeopardy board (defaults to `General` if omitted) |
| `description` | No | What the challenge is about |
| `hint` | No | Help text for stuck players. If omitted, the hint box is hidden. |
| `flag` | Yes | Awarded on success (format: `CHEF{...}`) |
| `challengeFiles` | No | Array of files players can download |
| `challengeFiles[].name` | Yes | Button label (e.g. "Challenge Package", "Binary", "PCAP") |
| `challengeFiles[].file` | Yes | Filename inside this challenge's folder |
| `challengeFiles[].description` | No | Tooltip text |
| `validationFile` | Yes | File used for server-side validation — **never given to players** |

**Multiple files example:**
```json
"challengeFiles": [
  { "name": "Binary",          "file": "encrypt",          "description": "Encryption program" },
  { "name": "Network Capture", "file": "traffic.pcap",     "description": "Encrypted traffic" },
  { "name": "Encrypted Sample","file": "sample.bin",       "description": "Practice file" }
]
```

**Category examples for jeopardy mode:**
```json
"category": "Cryptography"
"category": "Reverse Engineering"
"category": "Forensics"
"category": "Network"
"category": "Steganography"
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

> Use **Clean JSON** format (not Deep Link or Chef Format) for `solution.json`. This ensures the server parses it correctly on every platform.

---

## Adding a New Challenge — Step by Step

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
4. **Test on `validation.bin` too** — the same recipe must work on both files
5. Click **Save recipe → Clean JSON** and save as `solution.json`

### Step 5: Create `challenge.json`

```json
{
  "id": 6,
  "name": "My New Challenge",
  "category": "Cryptography",
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

> Set `id` to the next number in sequence (or any integer — order is by `id` value). Omit `hint` if you don't want a hint box shown to players.

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

## Choosing a Game Mode

Edit (or create) `ccpg.config.json` in the CyberChef-Playground root:

**Linear mode** (default) — players unlock challenges sequentially:
```json
{ "mode": "linear" }
```

**Jeopardy mode** — all challenges open at once on a category board:
```json
{ "mode": "jeopardy" }
```

In jeopardy mode, the `category` field in each `challenge.json` groups challenges on the board. Plan your categories before building the challenge set.

---

## How Validation Works

```
Player submits recipe (Deep Link / Chef Format / JSON)
        ↓
Server parses recipe into CyberChef operation array
        ↓
Reads validationFile from challenge folder (hidden from players)
        ↓
Runs player recipe  → SHA256 of raw byte output
Runs solution recipe → SHA256 of raw byte output
        ↓
Hashes match? → Award flag + unlock next (linear) / mark solved (jeopardy)
              → No match: return hint message
```

The comparison is **byte-exact via SHA256** — even a single trailing newline difference will fail. Test your recipe in CyberChef with the exact `validation.bin` file to make sure the output matches before publishing.

---

## Benefits of This Architecture

| Benefit | Detail |
|---------|--------|
| **Safe main repo** | Binaries and malware samples never touch CyberChef-Playground |
| **Named slugs** | Folder names are readable; `id` controls order |
| **Works for any CTF style** | Linear campaign (sequential ids) or jeopardy (all unlocked, category board) |
| **No server changes** | Drop a folder in CCPG-Challenges, sync, done |
| **Easy Docker** | `docker-compose up --build` clones challenges at build time |
| **Easy local dev** | `npm run sync` to get latest, no rebuild needed |

---

## Useful CyberChef Operations for Challenge Design

**Encoding:** From/To Base64, Base32, Base58, Hex, URL Decode
**Symmetric crypto:** XOR, AES Decrypt, DES Decrypt, RC4, Blowfish
**Classical ciphers:** ROT13, ROT47, Substitution, Vigenère
**Hashing:** MD5, SHA1, SHA256, HMAC
**Data manipulation:** Reverse, Swap endianness, Subsection, Extract
**Analysis:** Magic (auto-detect), Entropy, Frequency distribution

---

## Challenge Design Tips

1. **Test both files** — make sure your `solution.json` decrypts both `sample.bin` and `validation.bin` correctly
2. **Meaningful hints** — point to the right CyberChef operation, not the answer. Omit the `hint` field entirely if you want no hint shown.
3. **Progressive difficulty** — use `id` to sequence easy → hard
4. **Use categories** — especially in jeopardy mode; group by topic (`Cryptography`, `Forensics`, `Reverse Engineering`)
5. **Descriptive slugs** — `aes-cbc-ransomware` is more useful than `challenge6`
6. **Multiple files** — give players a binary, PCAP, or memory dump for realistic RE
7. **Test all 4 recipe formats** — especially Deep Link (most common player workflow)

---

## Troubleshooting

**Challenge not appearing after sync?**
- Check `challenge.json` is valid JSON (use a linter or `node -e "JSON.parse(require('fs').readFileSync('challenge.json','utf8'))"`)
- Confirm the folder is inside `CCPG-Challenges/challenges/`
- Re-run `npm run sync` and check server startup logs

**"Failed to load challenges" on startup?**
- Run `npm run sync` first — challenges aren't bundled with the app
- Check network access to GitHub

**Solution not matching?**
- Test your recipe on `validation.bin` in CyberChef (not just `sample.bin`)
- Check operation names use spaces, not underscores (`"From Base64"` not `"From_Base64"`)
- Verify all args are correct type (string vs number vs boolean)
- Make sure there are no extra trailing operations in your recipe

**Deep link not parsing?**
- URL must contain `#recipe=`
- Include the full URL starting with `https://`
- Test the link in a browser to confirm CyberChef loads the recipe correctly

**Challenge appears but hint box is missing?**
- This is expected behaviour when the `hint` field is omitted from `challenge.json`
- Add a `hint` field if you want the hint box to appear

---

Happy challenge building!
