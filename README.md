# 🔐 CyberChef Playground

A CTF-style challenge platform for learning cryptography and reverse engineering using CyberChef recipes. Perfect for blue team training, defensive security education, and security awareness programs.

## ✨ Features

- 🎯 **Progressive Challenges** — unlock the next challenge by solving the current one
- 🔗 **4 Recipe Formats** — Deep Link, Clean JSON, Compact JSON, Chef Format
- 🏆 **Flag System** — earn flags for each solved challenge
- 🧩 **Separated Challenge Repo** — challenges live in [CCPG-Challenges](https://github.com/ChickenLoner/CCPG-Challenges), keeping this repo safe from binary/malware scanning
- 🔄 **KAPE-style Sync** — `npm run sync` pulls the latest challenges from CCPG-Challenges
- 🚀 **No Browser Needed** — pure Node.js with cyberchef-node (300+ operations)
- 🐳 **Docker Ready** — challenges cloned at build time, no manual steps

---

## 🏗️ Two-Repo Architecture

Inspired by [KAPE's KapeFiles](https://github.com/EricZimmerman/KapeFiles) model:

| Repo | Purpose |
|------|---------|
| **CyberChef-Playground** *(this repo)* | Application code — server, frontend, Docker config |
| **[CCPG-Challenges](https://github.com/ChickenLoner/CCPG-Challenges)** | Challenge files — binaries, encrypted samples, validation files, solutions |

Challenges are never committed here. This protects the main repo from GitHub flagging CTF binaries or malware samples as malicious content.

---

## 🚀 Quick Start

### Option 1: Docker (Recommended 🐳)

Challenges are automatically cloned from CCPG-Challenges during the image build. No manual steps needed.

**Prerequisites:** [Docker Desktop](https://www.docker.com/products/docker-desktop/) installed and running.

```bash
# Build image (clones challenges automatically) and start
docker-compose up --build -d

# Check status
docker-compose ps

# View logs
docker-compose logs -f
```

**Access:** http://localhost:3000

```bash
# Stop
docker-compose down

# Restart
docker-compose restart
```

**Troubleshooting:**
- ❌ `port already in use` → Something else is using port 3000. Stop it first or change the port in `docker-compose.yml`.
- ❌ `cannot find the file specified` → Docker Desktop isn't running.

---

### Option 2: Local with npm

```bash
# 1. Install dependencies
npm install

# 2. Sync challenges from CCPG-Challenges (first time clones, subsequent runs pull)
npm run sync

# 3. Start server
npm start          # production
npm run dev        # development (auto-restart on file changes)
```

**Access:** http://localhost:3000

> **Note:** `npm run sync` clones CCPG-Challenges into `.ccpg-challenges/` (gitignored). Re-run it anytime to get new challenges without restarting the server.

---

## 📁 Project Structure

```
CyberChef-Playground/          ← This repo
├── server.js                  ← Express API server
├── sync.js                    ← Challenge sync script
├── public/
│   └── index.html             ← Frontend UI
├── .ccpg-challenges/          ← Gitignored — created by npm run sync
│   └── challenges/
│       ├── xor-warmup/
│       ├── base64-layering/
│       └── ...
├── Dockerfile
├── docker-compose.yml
└── .claude/
    └── launch.json            ← Dev server configs for Claude Code

CCPG-Challenges/               ← Separate repo
└── challenges/
    ├── xor-warmup/
    │   ├── challenge.json     ← Challenge metadata (id, name, hint, flag…)
    │   ├── solution.json      ← Solution recipe (CyberChef JSON)
    │   ├── xor_challenge.zip  ← Download for players
    │   └── validation.bin     ← Server-only validation file
    ├── base64-layering/
    └── ...
```

---

## 🔄 Challenge Sync

```bash
npm run sync
```

- **First run** — clones `https://github.com/ChickenLoner/CCPG-Challenges` into `.ccpg-challenges/`
- **Subsequent runs** — `git pull` to fetch new or updated challenges
- Challenges are read from `.ccpg-challenges/challenges/` by default
- In Docker, `CHALLENGES_DIR=/app/challenges` env var points to the build-time clone

---

## 🎓 How to Play

1. Open http://localhost:3000
2. Download the challenge files
3. Analyse the encryption in the binary/source
4. Build a decryption recipe in [CyberChef](https://gchq.github.io/CyberChef/)
5. Submit your recipe and earn the flag!

---

## 🔗 Supported Recipe Formats

### 1. 🔗 Deep Link *(Recommended)*
Just copy the URL from your browser while working in CyberChef:
```
https://gchq.github.io/CyberChef/#recipe=XOR(%7B'option':'Hex','string':'42'%7D,'Standard',false)&input=...
```

### 2. 📄 Clean JSON
CyberChef → Save recipe → Clean JSON:
```json
[
  {
    "op": "XOR",
    "args": [{"option": "Hex", "string": "42"}, "Standard", false]
  }
]
```

### 3. 📦 Compact JSON
CyberChef → Save recipe → Compact JSON:
```json
[{"op":"XOR","args":[{"option":"Hex","string":"42"},"Standard",false]}]
```

### 4. 🔧 Chef Format
CyberChef → Save recipe → Chef format:
```
XOR({'option':'Hex','string':'42'},'Standard',false)
```

---

## 🎓 How Validation Works

```
Player submits recipe (any of 4 formats)
         ↓
Server parses the recipe into CyberChef JSON
         ↓
Runs player's recipe on the (hidden) validation file
  → Result as raw bytes
         ↓
Runs solution recipe on the same validation file
  → Expected bytes
         ↓
SHA256(player bytes) == SHA256(expected bytes)?
  ✓ Yes → Award flag, unlock next challenge
  ✗ No  → Show hint
```

Validation uses **raw bytes** — works perfectly for binary files, shellcode, PE/ELF, PCAP payloads, and text alike.

---

## 💡 Tips for Players

- 🔗 **Use Deep Link** — fastest workflow, just copy the browser URL
- 🧪 **Test in CyberChef first** before submitting
- 📝 **Read hints carefully** — they point to the right operations
- 🔍 **Try CyberChef's Magic** operation when you're stuck on encoding detection

**Common errors:**
| Error | Fix |
|-------|-----|
| `Invalid recipe format` | Check URL or JSON syntax |
| `Incorrect decryption` | Verify your output matches expected; check key/parameters |
| URL not working | Include the full URL starting with `https://` |

---

## 🎨 Adding New Challenges

Challenges live in [CCPG-Challenges](https://github.com/ChickenLoner/CCPG-Challenges). See [CTF_AUTHOR_GUIDE.md](CTF_AUTHOR_GUIDE.md) for the full walkthrough.

**Quick summary:**
1. Create a folder in `CCPG-Challenges/challenges/<your-slug>/`
2. Add `challenge.json` (metadata + `id`) and `solution.json` (CyberChef recipe)
3. Add challenge files (ZIP for players) and a separate `validation.bin` (server-only)
4. Push to CCPG-Challenges — players sync with `npm run sync`

---

## 🔧 Technical Details

- **Backend:** Express.js, Node.js 18+
- **CyberChef API:** cyberchef-node v2.0.3 (all 300+ operations, no browser needed)
- **Challenge discovery:** server scans all subdirs of `CHALLENGES_DIR`, loads `challenge.json`, sorts by `id`
- **Security:** session-based progress, path sanitisation, validated folder names on download

---

## 📚 References
- [CyberChef Documentation](https://github.com/gchq/CyberChef/wiki) - Learn CyberChef operations
- [cyberchef-node](https://github.com/gchq/CyberChef-server) - Node.js API docs

## 🤝 Contributing

- **New challenges** → contribute to [CCPG-Challenges](https://github.com/ChickenLoner/CCPG-Challenges)
- **App improvements** → open a PR here

---

## 📝 License

Built for educational and training purposes. CyberChef is developed by GCHQ.

---

**Ready to play?** 
- 🐳 Docker: `docker-compose up -d`
- 📦 npm: `npm start`
- 🌐 Access: http://localhost:3000

**Need help?** Check the guides above or open an issue! 🆘
