# CLAUDE.md — CyberChef-Playground

## Project Overview

CyberChef-Playground is a CTF-style challenge platform for learning cryptography and reverse engineering using [CyberChef](https://gchq.github.io/CyberChef/). Players solve challenges by constructing CyberChef recipes that produce the correct output from a given input file. The platform validates answers server-side using SHA256 comparison.

Two game modes are supported:
- **Linear**: Challenges unlock sequentially; players must complete each level before advancing.
- **Jeopardy**: All challenges are available immediately, grouped by category.

The project follows a two-repo model: this repo contains the platform; a separate [CCPG-Challenges](https://github.com/ChickenLoner/CCPG-Challenges) repo contains the actual challenge content.

---

## Repository Structure

```
CyberChef-Playground/
├── public/
│   └── index.html          # Single-file SPA frontend (no build step)
├── .claude/
│   └── launch.json         # VS Code debug configurations
├── server.js               # Express backend — main application logic
├── sync.js                 # Challenge sync script (git clone/pull)
├── package.json            # Project metadata and npm scripts
├── package-lock.json       # Dependency lockfile
├── ccpg.config.json        # Runtime configuration (mode, repo URL)
├── docker-compose.yml      # Docker Compose orchestration
├── Dockerfile              # Multi-stage Docker build
├── README.md               # User-facing project documentation
└── CTF_AUTHOR_GUIDE.md     # Guide for creating challenges
```

Challenges live outside this repo under `.ccpg-challenges/` (git-ignored), populated by `npm run sync`.

---

## Technology Stack

| Layer | Technology |
|---|---|
| Runtime | Node.js ≥18.0.0 (ES modules — `"type": "module"`) |
| Backend | Express.js 4.18.2 |
| CyberChef engine | cyberchef-node 2.0.3 |
| Frontend | Vanilla HTML5 / CSS3 / JavaScript (no framework, no build step) |
| Deployment | npm (local) or Docker / Docker Compose |

**No build tools, bundlers, transpilers, or testing frameworks are configured.**

---

## Development Workflows

### Local Development

```bash
# First-time setup
npm install
npm run sync          # Clones CCPG-Challenges into .ccpg-challenges/

# Development (auto-restarts on file save)
npm run dev

# Production
npm start
```

The server runs on port **3000** by default. Override with the `PORT` environment variable.

### Challenge Directory

Challenges are loaded from `.ccpg-challenges/challenges/` by default. Override with:

```bash
CHALLENGES_DIR=/path/to/challenges npm start
```

Each challenge folder must contain:
- `challenge.json` — metadata (id, name, description, category, hint, files)
- `solution.json` — server-side CyberChef recipe (never sent to client)
- `validation.bin` (or other files) — binary input for validation

### Docker

```bash
npm run docker:build          # Build image (tag: cyberchef-playground:latest)
npm run docker:run            # Run container (port 3000)
npm run docker:compose        # Start with Compose (port 8080 → 3000)
npm run docker:compose:down   # Stop Compose services
npm run docker:compose:logs   # Stream Compose logs
```

### Syncing Challenges

```bash
npm run sync   # First run: git clone; subsequent runs: git pull
```

Controlled by `ccpg.config.json`:
```json
{
  "mode": "jeopardy",
  "autoPullChallenges": true,
  "challengesRepo": "https://github.com/ChickenLoner/CCPG-Challenges"
}
```

---

## Architecture

### Backend (`server.js`)

The backend is a single Express file (~478 lines). Key areas:

**Challenge Loading**
- On startup, scans all subdirectories in `CHALLENGES_DIR`
- Loads `challenge.json` + `solution.json` into a `Map<id, challenge>` sorted by ID
- Challenges missing either file are skipped with a warning

**Session Management**
- In-memory `Map` keyed by `sessionId` (UUID string from client)
- Sessions expire after **2 hours** of inactivity; eviction runs every **30 minutes**
- Session ID is sent by the client in the `X-Session-ID` request header
- Created via `POST /api/init`

**Recipe Parsing**
Four input formats are accepted (auto-detected in order):
1. **Deep Link** — full `https://gchq.github.io/CyberChef/#recipe=...` URL
2. **Clean JSON** — `[{"op":"...", "args":{...}}]`
3. **Compact JSON** — `[{"op":"...","args":[...]}]`
4. **Chef Format** — `XOR({'option':'Hex','string':'42'},false)`

**Validation Flow**
```
POST /api/validate/:level
  → parse player recipe
  → read validation.bin from challenge folder
  → execute player recipe → SHA256 hash
  → execute solution recipe → SHA256 hash
  → timingSafeEqual comparison
  → if match: award flag, advance progress
  → if mismatch: return hint
```

The flag is derived from a SHA256 hash of the challenge ID + a server-side secret.

**File Download Security**
`GET /challenges/:folder/:filename` prevents path traversal by resolving the requested path and verifying it is within `CHALLENGES_DIR`.

### Frontend (`public/index.html`)

A single self-contained HTML file — no bundler, no framework, no external CDN dependencies. Communicates with the backend via the `fetch` API.

- **Linear mode**: Loads and displays one challenge at a time
- **Jeopardy mode**: Loads all challenges; renders sidebar grouped by category
- Keyboard shortcut: `Ctrl+Enter` / `Cmd+Enter` submits the recipe
- Flags are displayed with a one-click copy button

**Color palette (CSS custom properties):**

| Variable | Value | Usage |
|---|---|---|
| `--primary` | `#00ff41` | Primary text, borders, accents |
| `--secondary` | `#f0e040` | Highlights, category labels |
| `--danger` | `#ff4444` | Errors, wrong answers |
| `--info` | `#4da6ff` | Secondary info |
| `--bg-dark` | `#0d0f14` | Page background |
| `--bg-card` | `#111418` | Card backgrounds |
| `--bg-panel` | `#161b22` | Panel backgrounds |

---

## API Reference

All JSON endpoints consume and produce `application/json`. Session-protected routes require the `X-Session-ID` header.

| Method | Path | Auth | Description |
|---|---|---|---|
| `GET` | `/api/config` | No | Returns `{ mode }` |
| `POST` | `/api/init` | No | Creates session, returns `{ sessionId }` |
| `GET` | `/api/challenges` | Yes | Lists all challenges (metadata only) |
| `GET` | `/api/challenge/:level` | Yes | Single challenge detail + hint |
| `POST` | `/api/validate/:level` | Yes | Validate a recipe, returns flag or hint |
| `GET` | `/api/progress` | Yes | Current session progress |
| `GET` | `/challenges/:folder/:filename` | Yes | Download challenge file |
| `GET` | `/` | No | Serves `public/index.html` |

---

## Code Conventions

### JavaScript Style

- **ES modules** throughout (`import`/`export`, no `require`)
- No TypeScript; no linter is configured
- `async/await` for all async operations; `try/catch` for error handling
- Node.js built-ins are imported using the `node:` protocol prefix where applicable

### Error Handling

- API routes return structured JSON errors: `{ error: "message" }`
- HTTP status codes: `400` bad request, `401` unauthorized, `403` forbidden, `404` not found, `500` server error
- Non-fatal errors (e.g., malformed challenge folder) are logged and skipped; they do not crash the server

### Security Considerations

- Path traversal is prevented on file downloads (resolved path checked against `CHALLENGES_DIR`)
- Hash comparisons use `crypto.timingSafeEqual` to prevent timing attacks
- Docker image runs as non-root user (`nodejs:1001`), read-only root filesystem
- Solution recipes are **never** sent to the client

### Adding Features

When modifying `server.js`:
- Keep challenge loading and session logic in their respective sections near the top
- API route handlers are grouped together toward the bottom of the file
- Helper functions (recipe parsing, CyberChef execution) live between the two sections

When modifying `public/index.html`:
- CSS custom properties are defined in `:root` at the top of the `<style>` block
- JavaScript lives in a single `<script>` tag at the bottom; avoid inline event handlers
- Maintain the hacker/terminal aesthetic (dark background, green-on-dark, monospace fonts)

---

## Challenge Format Reference

For creating or modifying challenges (see `CTF_AUTHOR_GUIDE.md` for full details):

**`challenge.json`**
```json
{
  "id": 1,
  "name": "Challenge Name",
  "description": "What the player needs to do.",
  "category": "Encoding",
  "hint": "Try looking at Base64.",
  "files": ["validation.bin"]
}
```

**`solution.json`**
```json
[
  { "op": "From Base64", "args": { "alphabet": "Standard", "remove_non-alphabet_chars": true } }
]
```

---

## Environment Variables

| Variable | Default | Description |
|---|---|---|
| `PORT` | `3000` | HTTP server port |
| `CHALLENGES_DIR` | `.ccpg-challenges/challenges` | Path to challenges directory |
| `NODE_ENV` | (unset) | Set to `production` in Docker |

---

## No Tests / No Linting

There is currently no test suite and no linter configured. The `.gitignore` explicitly excludes `test/` and `*.test.js`. When adding tests, consider Jest or Node's built-in test runner (`node:test`).

---

## Common Tasks

**Run the platform locally with custom challenges:**
```bash
CHALLENGES_DIR=./my-challenges npm run dev
```

**Add a new API endpoint:**
Edit `server.js` — add the route near the other route definitions at the bottom of the file, before `app.listen`.

**Change the game mode:**
Edit `ccpg.config.json` — set `"mode"` to `"linear"` or `"jeopardy"`. Restart the server.

**Build and push Docker image:**
```bash
npm run docker:build
docker tag cyberchef-playground:latest your-registry/cyberchef-playground:latest
docker push your-registry/cyberchef-playground:latest
```

**Inspect loaded challenges at startup:**
The server logs each loaded challenge ID and name to stdout on startup.
