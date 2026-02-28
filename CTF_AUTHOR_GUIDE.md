# 📚 CTF Author Guide — Adding New Challenges

## 🗺️ Overview

Challenges live in a **separate repository**: [CCPG-Challenges](https://github.com/ChickenLoner/CCPG-Challenges).
This keeps the main app repo clean and safe from GitHub scanning CTF binaries or malware samples.

Each challenge is a **self-contained folder** named with a meaningful slug.
Progression order is controlled by the `id` field in `challenge.json` — not the folder name — so the same structure works for both linear and jeopardy-style CTFs.

---

## 📁 Repository Structure

```
CCPG-Challenges/
├── challenges/
│   ├── xor-warmup/                ← slug (any name you choose)
│   │   ├── challenge.json         ← metadata: id, name, category, hint, flag, files
│   │   ├── solution.json          ← CyberChef recipe (server-side only, never shared)
│   │   ├── xor_challenge.zip      ← download package for players
│   │   └── validation.bin         ← server-only validation file
│   ├── base64-layering/
│   └── my-new-challenge/
└── README.md
```

> 📌 **Rule:** folder name = slug (lowercase, hyphens). Order = `id` field in `challenge.json`.

---

## 📝 File Reference

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

**Field reference:**
| Field | Required | Description |
|-------|:--------:|-------------|
| `id` | ✅ | Integer — controls order. Lower = earlier. |
| `name` | ✅ | Challenge title shown to players |
| `flag` | ✅ | Awarded on success — format: `CHEF{...}` |
| `validationFile` | ✅ | Filename used for server-side validation — **never given to players** |
| `category` | ➕ | Groups challenges on the jeopardy board. Defaults to `General` if omitted. |
| `description` | ➕ | What the challenge is about |
| `hint` | ➕ | Help text for stuck players. **Omit entirely to hide the hint box.** |
| `challengeFiles` | ➕ | Array of files players can download |
| `challengeFiles[].name` | ✅ | Button label (e.g. `"Challenge Package"`, `"Binary"`, `"PCAP"`) |
| `challengeFiles[].file` | ✅ | Filename inside this challenge's folder |
| `challengeFiles[].description` | ➕ | Optional tooltip text |

> ✅ = required &nbsp; ➕ = optional

**Multiple download files example:**
```json
"challengeFiles": [
  { "name": "Binary",          "file": "encrypt",      "description": "Encryption program" },
  { "name": "Network Capture", "file": "traffic.pcap", "description": "Encrypted traffic" },
  { "name": "Encrypted Sample","file": "sample.bin",   "description": "Practice file" }
]
```

**Category suggestions for jeopardy mode:**
```
Cryptography · Reverse Engineering · Forensics · Network · Steganography
```

---

### `solution.json`

A CyberChef recipe in **Clean JSON** format. The server runs this against `validationFile` to get the expected output, then compares it against what the player's recipe produces.

> ⚠️ Always use **Clean JSON** — not Deep Link or Chef Format. This ensures consistent parsing on every platform.

**Single operation:**
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

**Multi-operation example:**
```json
[
  { "op": "From Base64", "args": ["A-Za-z0-9+/=", true, false] },
  { "op": "XOR",        "args": [{"option": "Hex", "string": "42"}, "Standard", false] },
  { "op": "ROT47",      "args": [47] }
]
```

---

## 🚀 Step-by-Step: Adding a New Challenge

### Step 1 — Clone CCPG-Challenges

```bash
git clone https://github.com/ChickenLoner/CCPG-Challenges.git
cd CCPG-Challenges
```

---

### Step 2 — Create your challenge folder

Pick a descriptive slug. Order is set by `id`, not the folder name.

```bash
mkdir challenges/my-new-challenge
cd challenges/my-new-challenge
```

---

### Step 3 — Create your encrypted files

You need two files:
- 📦 **`sample.bin`** — players download and practice on this
- 🔒 **`validation.bin`** — server-side only, never shared with players

```c
// encrypt.c — example XOR encryption
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
./encrypt        # generates sample.bin + validation.bin

# Package for players — binary + sample ONLY, never include validation.bin
zip challenge.zip encrypt sample.bin
```

---

### Step 4 — Build and test your solution in CyberChef 🍳

1. Open https://gchq.github.io/CyberChef/
2. Load **`sample.bin`** as input
3. Build your decryption recipe until the output looks correct
4. ⚠️ **Test on `validation.bin` too** — the exact same recipe must work on both files
5. Click **Save recipe → Clean JSON** → save as `solution.json`

---

### Step 5 — Write `challenge.json`

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

> Set `id` to the next integer in sequence. Omit `hint` entirely if you don't want the hint box to appear.

---

### Step 6 — Verify your folder layout

```
challenges/my-new-challenge/
  ├── challenge.json    ← metadata
  ├── solution.json     ← decryption recipe (Clean JSON)
  ├── challenge.zip     ← players download this
  └── validation.bin    ← 🔒 server-only, never share
```

---

### Step 7 — Commit and push

```bash
git add challenges/my-new-challenge/
git commit -m "Add my-new-challenge"
git push
```

---

### Step 8 — Test locally ✅

**npm (local dev):**
```bash
# In the CyberChef-Playground repo
npm run sync    # pulls latest from CCPG-Challenges
npm start       # your new challenge should appear in the list
```

**Docker:**
```bash
# Rebuild the image to re-clone the latest challenges from GitHub
docker compose build --no-cache && docker compose up -d
docker compose logs   # confirm your challenge appears
```

The server prints on startup:
```
✓ 6 challenge(s) loaded:
  [1] xor-warmup — XOR Warmup
  ...
  [6] my-new-challenge — My New Challenge
```

---

## 🎮 Choosing a Game Mode

Edit (or create) `ccpg.config.json` in the CyberChef-Playground root:

| Mode | Config | Behaviour |
|------|--------|-----------|
| 🔒 **Linear** (default) | `{ "mode": "linear" }` | Players unlock challenges one at a time |
| 🗂️ **Jeopardy** | `{ "mode": "jeopardy" }` | All challenges open at once on a category board |

> In jeopardy mode, plan your `category` values before building your challenge set — they become the column headers on the board.

---

## ⚙️ How Validation Works

```
🧑 Player submits recipe (Deep Link / Chef Format / JSON)
        ↓
🔄 Server parses recipe into CyberChef operation array
        ↓
📂 Reads validationFile from challenge folder (hidden from players)
        ↓
▶️  Runs player recipe   →  SHA256 of raw byte output
▶️  Runs solution recipe →  SHA256 of raw byte output
        ↓
🔑 Hashes match?
   ✅ Yes → Award flag + unlock next (linear) / mark solved (jeopardy)
   ❌ No  → Return hint message
```

> ⚠️ The comparison is **byte-exact via SHA256** — even a single trailing newline will cause a mismatch. Always test your recipe on `validation.bin` directly in CyberChef before publishing.

---

## 🛠️ Useful CyberChef Operations for Challenge Design

| Category | Operations |
|----------|-----------|
| 🔡 **Encoding** | From/To Base64, Base32, Base58, Hex, URL Decode |
| 🔐 **Symmetric crypto** | XOR, AES Decrypt, DES Decrypt, RC4, Blowfish |
| 🏛️ **Classical ciphers** | ROT13, ROT47, Substitution, Vigenère |
| #️⃣ **Hashing** | MD5, SHA1, SHA256, HMAC |
| 🔀 **Data manipulation** | Reverse, Swap endianness, Subsection, Extract |
| 🔍 **Analysis** | Magic (auto-detect), Entropy, Frequency distribution |

---

## 💡 Challenge Design Tips

1. ✅ **Test both files** — `solution.json` must decrypt both `sample.bin` and `validation.bin` identically
2. 💡 **Write meaningful hints** — point to the right CyberChef operation, not the answer. Omit `hint` entirely to hide the hint box.
3. 📈 **Progressive difficulty** — use `id` to sequence easy → hard
4. 🗂️ **Use categories** — especially in jeopardy mode; group by topic
5. 🏷️ **Descriptive slugs** — `aes-cbc-ransomware` is far more useful than `challenge6`
6. 📦 **Multiple files** — give players a binary, PCAP, or memory dump for realistic RE scenarios
7. 🔗 **Test all 4 recipe formats** — especially Deep Link, the most common player workflow

---

## 🐛 Troubleshooting

**❓ Challenge not appearing after sync?**
- Validate `challenge.json` syntax: `node -e "JSON.parse(require('fs').readFileSync('challenge.json','utf8'))"`
- Confirm the folder is inside `CCPG-Challenges/challenges/`
- Re-run `npm run sync` and check server startup logs

**❓ "Failed to load challenges" on startup?**
- **Docker:** rebuild the image — `docker compose build --no-cache && docker compose up -d`
- **npm:** run `npm run sync` first — challenges aren't bundled with the app
- Check network access to GitHub

**❓ Solution not matching?**
- Test your recipe on `validation.bin` in CyberChef (not just `sample.bin`)
- Operation names use spaces, not underscores — `"From Base64"` not `"From_Base64"`
- Verify all args have the correct type (string vs number vs boolean)
- Remove any extra trailing operations from your recipe

**❓ Deep link not parsing?**
- URL must contain `#recipe=`
- Include the full URL starting with `https://`
- Paste the link in a browser to confirm CyberChef loads the recipe correctly

**❓ Hint box is not showing?**
- Expected — this happens when `hint` is omitted from `challenge.json`
- Add a `"hint": "..."` field to make it appear

---

Happy challenge building! 🚀🍳
