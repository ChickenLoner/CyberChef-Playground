# 🔐 CyberChef Playground

> A CTF-style challenge platform for learning cryptography and reverse engineering using CyberChef recipes.
> Perfect for blue team training, defensive security education, and security awareness programs.

---

## ✨ Features

| | Feature | Description |
|---|---|---|
| 🎮 | **Two Game Modes** | `linear` (sequential unlock) and `jeopardy` (open category board) |
| 🔗 | **4 Recipe Formats** | Deep Link, Clean JSON, Compact JSON, Chef Format |
| 🪄 | **Format Auto-detect** | Paste any format — the dropdown switches automatically |
| ⌨️ | **Keyboard Shortcut** | `Ctrl+Enter` / `Cmd+Enter` submits your recipe instantly |
| 🏆 | **Flag System** | Earn flags for each solved challenge; copy to clipboard in one click |
| ✅ | **Solved Stamps** | Completed challenges are visually marked on the board |
| 📱 | **Mobile-friendly** | Responsive layout with a collapsible sidebar on small screens |
| 🧩 | **Separated Challenge Repo** | Challenges live in [CCPG-Challenges](https://github.com/ChickenLoner/CCPG-Challenges) — keeps this repo safe from binary/malware scanning |
| 🔄 | **KAPE-style Sync** | `npm run sync` pulls the latest challenges from CCPG-Challenges |
| 🚀 | **No Browser Needed** | Pure Node.js with cyberchef-node (300+ operations) |
| 🐳 | **Docker Ready** | Challenges cloned at build time, no manual setup |

---

## 🏗️ Two-Repo Architecture

Inspired by [KAPE's KapeFiles](https://github.com/EricZimmerman/KapeFiles) model:

| Repo | Purpose |
|------|---------|
| **CyberChef-Playground** *(this repo)* | Application code — server, frontend, Docker config |
| **[CCPG-Challenges](https://github.com/ChickenLoner/CCPG-Challenges)** | Challenge content — binaries, encrypted samples, validation files, solutions |

> Challenges are **never committed** here. This protects the main repo from GitHub flagging CTF binaries or malware samples as malicious.

---

## 🚀 Quick Start

### 🐳 Option 1: Docker (Recommended)

Challenges are automatically cloned from CCPG-Challenges during the image build. No manual steps needed.

**Prerequisites:** [Docker Desktop](https://www.docker.com/products/docker-desktop/) installed and running.

```bash
# Build and start (clones challenges automatically)
docker-compose up --build -d

# Check status
docker-compose ps

# View logs
docker-compose logs -f

# Stop
docker-compose down
```

**Access:** http://localhost:8080

**Common issues:**
| Error | Fix |
|-------|-----|
| `port already in use` | Something else is on port 8080 — stop it or change the port in `docker-compose.yml` |
| `cannot find the file specified` | Docker Desktop isn't running |

---

### 📦 Option 2: Local with npm

```bash
# 1. Install dependencies
npm install

# 2. Sync challenges (first run clones, subsequent runs pull)
npm run sync

# 3. Start the server
npm start          # production
npm run dev        # development (auto-restart on file changes)
```

**Access:** http://localhost:3000

> `npm run sync` clones CCPG-Challenges into `.ccpg-challenges/` (gitignored). Re-run anytime to get new challenges — no server restart needed.

---

## 🎮 Game Modes

Configure the mode in `ccpg.config.json` at the project root.

### 🔒 Linear Mode (default)

Players unlock challenges one at a time. Solve challenge `N` to unlock `N+1`.

```json
{ "mode": "linear" }
```

### 🗂️ Jeopardy Mode

All challenges are open at once on a category board — just like a real CTF.

```json
{ "mode": "jeopardy" }
```

> The `category` field in each `challenge.json` groups challenges on the board.
> Challenges without a category appear under **General**.
> If no `ccpg.config.json` exists, the server defaults to `linear`.

---

## 📁 Project Structure

```
CyberChef-Playground/          ← This repo
├── server.js                  ← Express API server
├── sync.js                    ← Challenge sync script
├── ccpg.config.json           ← Mode config (linear / jeopardy)
├── public/
│   └── index.html             ← Frontend UI (single file)
├── .ccpg-challenges/          ← Gitignored — created by npm run sync
│   └── challenges/
│       ├── xor-warmup/
│       ├── base64-layering/
│       └── ...
├── Dockerfile
└── docker-compose.yml

CCPG-Challenges/               ← Separate repo
└── challenges/
    ├── xor-warmup/
    │   ├── challenge.json     ← Challenge metadata (id, name, hint, flag…)
    │   ├── solution.json      ← Solution recipe — server-side only
    │   ├── xor_challenge.zip  ← Download for players
    │   └── validation.bin     ← Validation file — never given to players
    └── ...
```

---

## 🔄 Challenge Sync

```bash
npm run sync
```

| Run | What happens |
|-----|-------------|
| First time | Clones `CCPG-Challenges` into `.ccpg-challenges/` |
| Subsequent | `git pull` — fetches new or updated challenges |

- Local: challenges read from `.ccpg-challenges/challenges/`
- Docker: `CHALLENGES_DIR=/app/challenges` points to the build-time clone

---

## 🎓 How to Play

1. 🌐 Open http://localhost:8080 (Docker) or http://localhost:3000 (npm)
2. 📥 Download the challenge files
3. 🔍 Analyse the encryption in the binary/source
4. 🍳 Build a decryption recipe in [CyberChef](https://gchq.github.io/CyberChef/)
5. 🚩 Submit your recipe and earn the flag!

**Pro tips:**
- ⌨️ Press **Ctrl+Enter** (or **Cmd+Enter** on Mac) to submit without touching the mouse
- 🪄 Paste any recipe format — the format selector auto-detects it:
  - Full `https://gchq.github.io/CyberChef/#recipe=...` URL → **Deep Link**
  - `[{"op": ...}]` → **JSON**
  - `XOR(...)` style → **Chef Format**
- 📋 Click the **copy button** next to your flag to copy it instantly

---

## 🔗 Supported Recipe Formats

### 1. 🔗 Deep Link *(Recommended)*
Copy the URL straight from your browser while working in CyberChef:
```
https://gchq.github.io/CyberChef/#recipe=XOR(%7B'option':'Hex','string':'42'%7D,'Standard',false)&input=...
```

### 2. 📄 Clean JSON
**CyberChef → Save recipe → Clean JSON:**
```json
[
  {
    "op": "XOR",
    "args": [{"option": "Hex", "string": "42"}, "Standard", false]
  }
]
```

### 3. 📦 Compact JSON
**CyberChef → Save recipe → Compact JSON:**
```json
[{"op":"XOR","args":[{"option":"Hex","string":"42"},"Standard",false]}]
```

### 4. 🔧 Chef Format
**CyberChef → Save recipe → Chef format:**
```
XOR({'option':'Hex','string':'42'},'Standard',false)
```

---

## ⚙️ How Validation Works

```
🧑 Player submits recipe (any of 4 formats)
         ↓
🔄 Server parses it into CyberChef JSON
         ↓
▶️  Runs player's recipe on the hidden validation file  →  raw bytes
▶️  Runs solution recipe on the same file              →  expected bytes
         ↓
🔑 SHA256(player bytes) == SHA256(expected bytes)?
   ✅ Match    →  Award flag, unlock next (linear) / mark solved (jeopardy)
   ❌ No match →  Show hint
```

> Validation is **byte-exact** — works for binary files, shellcode, PE/ELF, PCAP payloads, and plain text.

---

## 💡 Tips & Common Errors

**Tips for players:**
- 🔗 **Deep Link** is the fastest workflow — just copy the browser URL
- ⌨️ **Ctrl+Enter** saves you a click every submission
- 🪄 **Paste to auto-detect** — let the UI pick the right format for you
- 🧪 **Test in CyberChef first** before submitting
- 💡 **Read hints carefully** — they point to the right operation
- 🔮 **Try the Magic operation** when you're unsure about the encoding

**Common errors:**
| ⚠️ Error | Fix |
|----------|-----|
| `Invalid recipe format` | Check URL or JSON syntax |
| `Incorrect decryption` | Verify output matches expected; check key/IV/parameters |
| URL not working | Include the full URL starting with `https://` |

---

## 🧩 Adding New Challenges

Challenges live in [CCPG-Challenges](https://github.com/ChickenLoner/CCPG-Challenges). See [CTF_AUTHOR_GUIDE.md](CTF_AUTHOR_GUIDE.md) for the full walkthrough.

**Quick steps:**
1. Create `CCPG-Challenges/challenges/<your-slug>/`
2. Add `challenge.json` (metadata, `id`, `category`) and `solution.json` (CyberChef recipe)
3. Add player download files and a separate `validation.bin` (server-only)
4. Push to CCPG-Challenges — players sync with `npm run sync`

---

## 🔧 Technical Details

| Component | Detail |
|-----------|--------|
| **Backend** | Express.js 4.18, Node.js 18+ (ES modules) |
| **CyberChef engine** | cyberchef-node v2.0.3 — all 300+ operations, no browser needed |
| **Session management** | In-memory `Map` with 2-hour TTL; idle sessions evicted every 30 min |
| **Challenge discovery** | Scans all subdirs of `CHALLENGES_DIR`, loads `challenge.json`, sorts by `id` |
| **Validation** | SHA256 of raw byte output — solution recipe never sent to clients |
| **Security** | DOM-safe rendering (no `innerHTML` with user data), path traversal prevention, validated filenames on download |

---

## 📚 References

- 📖 [CyberChef Documentation](https://github.com/gchq/CyberChef/wiki) — Learn CyberChef operations
- 📦 [cyberchef-node](https://github.com/gchq/CyberChef-server) — Node.js API docs
- 🗂️ [CCPG-Challenges](https://github.com/ChickenLoner/CCPG-Challenges) — Challenge content repo

## 🤝 Contributing

- **New challenges** → contribute to [CCPG-Challenges](https://github.com/ChickenLoner/CCPG-Challenges)
- **App improvements** → open a PR here

---

## 📝 License

Built for educational and training purposes. CyberChef is developed by GCHQ.

---

> 🐳 **Docker:** `docker-compose up -d` &nbsp;|&nbsp; 📦 **npm:** `npm start` &nbsp;|&nbsp; 🌐 **Access:** http://localhost:8080 (Docker) · http://localhost:3000 (npm)
