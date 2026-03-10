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
├── server.js               # Express backend — routing, sessions, validation
├── flow-control.js         # Flow control engine (Fork, Merge, Jump, Register, etc.)
├── sync.js                 # Challenge sync script (git clone/pull)
├── package.json            # Project metadata and npm scripts
├── package-lock.json       # Dependency lockfile
├── ccpg.config.json        # Runtime configuration (mode, repo URL)
├── tasks.md                # Implementation task tracking
├── docker-compose.yml      # Docker Compose orchestration
├── Dockerfile              # Multi-stage Docker build
├── README.md               # User-facing project documentation
├── CTF_AUTHOR_GUIDE.md     # Guide for creating challenges
└── test/
    ├── flow-control.test.js  # Unit tests for flow control engine
    └── integration.test.js   # End-to-end recipe validation tests
```

Challenges live outside this repo under `.ccpg-challenges/` (git-ignored), populated by `npm run sync`.

---

## Technology Stack

| Layer | Technology |
|---|---|
| Runtime | Node.js ≥18.0.0 (ES modules — `"type": "module"`) |
| Backend | Express.js 4.18.2 |
| CyberChef operations | cyberchef-node 2.0.3 (300+ operations, **excludes flow control**) |
| Flow control | Custom engine (`flow-control.js`) — handles Fork, Merge, Jump, Register, etc. |
| Frontend | Vanilla HTML5 / CSS3 / JavaScript (no framework, no build step) |
| Testing | Node.js built-in test runner (`node:test`) |
| Deployment | npm (local) or Docker / Docker Compose |

---

## Critical Design Constraint: Flow Control

### The Problem

`cyberchef-node` (and the official CyberChef Node API) **explicitly excludes all flow control operations**. Calling them throws `ExcludedOperationError`. The affected operations are:

| Operation | Purpose |
|---|---|
| **Fork** | Split input by delimiter, run subsequent ops on each piece |
| **Merge** | Join forked/subsectioned branches back together |
| **Subsection** | Apply ops only to regex-matched portions of input |
| **Register** | Capture regex groups into `$R0`, `$R1`, ... for use in later args |
| **Label** | Mark a named position in the recipe |
| **Jump** | Unconditional goto a label (with max iteration limit) |
| **Conditional Jump** | Jump if output matches/doesn't match a regex |
| **Return** | Stop recipe execution immediately |
| **Comment** | No-op documentation within recipes |

Players build recipes in the CyberChef web UI which **does** support flow control. When they submit those recipes to this platform, the server must be able to execute them. Without the custom flow control engine, any recipe containing these operations would crash.

### The Solution: `flow-control.js`

A custom execution engine that sits on top of `cyberchef-node`:

```
Recipe (parsed array of {op, args} steps)
  ↓
FlowControlEngine.execute(inputData, recipe)
  ├── Pre-scan: build labelMap (label name → recipe index)
  ├── Maintain state: ip, registers, forkStack, jumpCounters
  ├── Main loop: while ip < recipe.length
  │   ├── Flow control op → handle with custom logic
  │   └── Regular op → substitute $Rn in args → chef.bake(dish, [singleOp])
  └── Return final Buffer
```

**Key design decisions:**
- Regular ops execute one-at-a-time via `chef.bake()` (not batched), giving the engine control over data flow between steps
- Flow control ops are identified by name and handled entirely in custom code
- Register substitution (`$Rn` → captured value) is applied recursively to all arg types (strings, objects, arrays) before each regular op executes
- Fork/Subsection use recursive execution for their inner blocks (ops between Fork/Subsection and Merge)
- `resolveOpName()` must pass flow control names through untouched (they don't exist in cyberchef-node's exports)

---

## Architecture

### Recipe Execution Pipeline

```
Player submits recipe (any of 4 formats)
  ↓
server.js: parse recipe → array of {op, args}
  ↓
flow-control.js: FlowControlEngine.execute(inputData, parsedRecipe)
  ├── Contains flow control ops? → full engine with ip, registers, fork stack
  └── Pure linear recipe? → same engine (flow control ops simply absent)
  ↓
Returns: Buffer (raw bytes)
  ↓
server.js: SHA256(result) === SHA256(solution result) → flag or hint
```

### Flow Control Engine State Model

```javascript
{
  ip: 0,                          // Instruction pointer (current recipe index)
  registers: new Map(),            // $R0 → "value", $R1 → "value", ...
  forkStack: [],                   // Stack of { mergeDelimiter, startIp } for nesting
  jumpCounters: new Map(),         // "labelName" → iteration count
  labelMap: new Map(),             // "labelName" → recipe index (built in pre-scan)
  stepCount: 0                     // Total ops executed (for safety limit)
}
```

### Flow Control Operation Semantics

**Fork** `args: [splitDelimiter, mergeDelimiter]`
- Convert current data to string
- Split by `splitDelimiter`
- For each piece: execute ops from ip+1 until matching Merge (respecting nesting depth)
- Join all results with `mergeDelimiter`
- Set ip to the instruction after the matching Merge

**Merge** `args: []`
- Signals end of a Fork or Subsection block
- If encountered outside a fork/subsection context, treat as no-op

**Subsection** `args: [regex, caseSensitive, sectionDelimiter]`
- Apply regex to current data (as string)
- For each match: execute ops from ip+1 until matching Merge
- Replace matched portions with processed results; non-matched text preserved
- Set ip to after Merge

**Register** `args: [regex, caseSensitive, multiline, dotAll]`
- Apply regex to current data (as string)
- Store capture groups: group 1 → `$R0`, group 2 → `$R1`, etc.
- Data passes through unchanged (Register is observation-only)

**Label** `args: [name]`
- No-op at execution time; position was recorded during pre-scan

**Jump** `args: [label, maxIterations]`
- If `jumpCounters[label] < maxIterations`: increment counter, set ip to labelMap[label]
- Otherwise: fall through to next instruction

**Conditional Jump** `args: [label, maxIterations, regex]`
- Convert current data to string; test against regex
- If matches AND `jumpCounters[label] < maxIterations`: jump to label
- Otherwise: fall through

**Return** `args: []`
- Immediately exit the execution loop; return current data as final result

**Comment** `args: [text]`
- Skip entirely (increment ip, do nothing else)

### Register Substitution

Before executing any regular operation, the engine scans its `args` and replaces `$Rn` tokens:

```
"prefix_$R0_suffix"  →  "prefix_capturedValue_suffix"
{"option":"Hex","string":"$R1"}  →  {"option":"Hex","string":"capturedValue"}
["$R0", true, 42]  →  ["capturedValue", true, 42]
```

Substitution is recursive: it handles nested objects and arrays within args.

### Safety Limits

| Limit | Default | Purpose |
|---|---|---|
| `MAX_STEPS` | 10,000 | Total operations executed across all branches/loops |
| `MAX_FORK_DEPTH` | 10 | Maximum nesting level for Fork/Subsection |
| `MAX_REGISTERS` | 100 | Maximum number of `$Rn` registers |
| `EXECUTION_TIMEOUT` | 30,000ms | Wall-clock time limit per recipe execution |

Exceeding any limit throws a descriptive error returned to the player as a 500 response.

### Finding the Matching Merge

Fork and Subsection need to find their corresponding Merge instruction. The engine scans forward from the current ip, tracking nesting depth:
- Fork/Subsection increment depth
- Merge decrements depth
- When depth reaches 0, that's the matching Merge

This correctly handles nested Fork→Fork→Merge→Merge patterns.

---

### Backend (`server.js`)

Express server handling routing, sessions, challenge loading, and validation orchestration.

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
Four input formats are accepted:
1. **Deep Link** — full `https://gchq.github.io/CyberChef/#recipe=...` URL
2. **Clean JSON** — `[{"op":"...", "args":{...}}]`
3. **Compact JSON** — `[{"op":"...","args":[...]}]`
4. **Chef Format** — `XOR({'option':'Hex','string':'42'},false)`

All parsers already handle flow control operation names correctly (e.g. `Fork('\\n','\\n')` parses to `{op:"Fork", args:["\\n","\\n"]}`).

**Validation Flow**
```
POST /api/validate/:level
  → parse player recipe (any of 4 formats)
  → read validation.bin from challenge folder
  → FlowControlEngine.execute(validationData, playerRecipe)  → SHA256
  → FlowControlEngine.execute(validationData, solutionRecipe) → SHA256
  → compare hashes
  → if match: award flag, advance progress
  → if mismatch: return hint
```

**Operation Name Resolution**
`resolveOpName()` maps CyberChef display names to cyberchef-node function keys. Flow control operation names (Fork, Merge, Register, etc.) must be detected and passed through without lookup, since they don't exist in cyberchef-node's exports.

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

# Run tests
npm test
```

The server runs on port **3000** by default. Override with the `PORT` environment variable.

### Challenge Directory

Challenges are loaded from `.ccpg-challenges/challenges/` by default. Override with:

```bash
CHALLENGES_DIR=/path/to/challenges npm start
```

Each challenge folder must contain:
- `challenge.json` — metadata (id, name, description, category, hint, files)
- `solution.json` — server-side CyberChef recipe (never sent to client). May include flow control operations.
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
- Node.js built-ins imported with `node:` prefix where applicable

### Error Handling

- API routes return structured JSON errors: `{ error: "message" }`
- HTTP status codes: `400` bad request, `401` unauthorized, `403` forbidden, `404` not found, `500` server error
- Non-fatal errors (e.g., malformed challenge folder) are logged and skipped; they do not crash the server
- Flow control errors (e.g., Fork without Merge, jump to nonexistent label) return descriptive messages to help players fix their recipes

### Security Considerations

- Path traversal is prevented on file downloads (resolved path checked against `CHALLENGES_DIR`)
- Hash comparisons use `crypto.timingSafeEqual` to prevent timing attacks
- Docker image runs as non-root user (`nodejs:1001`), read-only root filesystem
- Solution recipes are **never** sent to the client
- Flow control engine enforces execution limits (step count, timeout, fork depth) to prevent resource exhaustion from malicious recipes

### Adding Features

When modifying `server.js`:
- Keep challenge loading and session logic in their respective sections near the top
- API route handlers are grouped together toward the bottom of the file
- Recipe execution is delegated to `flow-control.js`; do not add execution logic to server.js

When modifying `flow-control.js`:
- Flow control op handlers live in the main execution loop's switch statement
- Regular ops are delegated to `chef.bake()` with a single-element recipe array
- Register substitution is a pure function — keep it side-effect-free
- All new flow control ops must have corresponding unit tests

When modifying `public/index.html`:
- CSS custom properties are defined in `:root` at the top of the `<style>` block
- JavaScript lives in a single `<script>` tag at the bottom; avoid inline event handlers
- Maintain the hacker/terminal aesthetic (dark background, green-on-dark, monospace fonts)

---

## Supported Recipe Formats

Recipes can use flow control in any of the four supported input formats:

### Clean JSON (recommended for solution.json)
```json
[
  {"op": "Fork", "args": ["\\n", "\\n"]},
  {"op": "From Base64", "args": ["A-Za-z0-9+/=", true, false]},
  {"op": "Merge", "args": []},
  {"op": "Register", "args": ["(.{8})", true, false, false]},
  {"op": "Drop bytes", "args": [0, 8, false]},
  {"op": "AES Decrypt", "args": [{"option": "UTF8", "string": "$R0"}, {"option": "Hex", "string": ""}, "CBC", "Raw", "Raw"]}
]
```

### Chef Format (from CyberChef deep links)
```
Fork('\\n','\\n')
From_Base64('A-Za-z0-9+/=',true,false)
Merge()
```

### Deep Link
```
https://gchq.github.io/CyberChef/#recipe=Fork('%5Cn','%5Cn')From_Base64('A-Za-z0-9%2B/%3D',true,false)Merge()
```

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
  "flag": "CHEF{example_flag}",
  "challengeFiles": [
    { "name": "Challenge Package", "file": "challenge.zip", "description": "Files for the challenge" }
  ],
  "validationFile": "validation.bin"
}
```

**`solution.json`** — may include flow control operations:
```json
[
  {"op": "Fork", "args": ["\\n", "\\n"]},
  {"op": "From Base64", "args": ["A-Za-z0-9+/=", true, false]},
  {"op": "Merge", "args": []}
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

## Testing

Tests use Node.js built-in test runner (`node:test` + `node:assert`).

```bash
npm test                              # Run all tests
node --test test/flow-control.test.js  # Flow control unit tests only
node --test test/integration.test.js   # Integration tests only
```

### Test Categories

**Flow control unit tests** (`test/flow-control.test.js`):
- Each flow control op tested in isolation
- Register substitution tested with all arg types (string, object, array, nested)
- Safety limits tested (MAX_STEPS, MAX_FORK_DEPTH, EXECUTION_TIMEOUT)
- Error cases: Fork without Merge, Jump to missing label, etc.

**Integration tests** (`test/integration.test.js`):
- Real CyberChef recipes with flow control executed end-to-end
- Multi-line Base64 decode with Fork/Merge
- Looping decode with Label/Jump
- Register capture + dynamic XOR key
- Backwards compatibility: linear recipes (no flow control) produce identical output
- Complex combined recipes (Fork + Register + Conditional Jump)

---

## Common Tasks

**Run the platform locally with custom challenges:**
```bash
CHALLENGES_DIR=./my-challenges npm run dev
```

**Add a new API endpoint:**
Edit `server.js` — add the route near the other route definitions at the bottom of the file, before `app.listen`.

**Add a new flow control operation:**
1. Add handler in `flow-control.js` execution loop
2. Add to the `FLOW_CONTROL_OPS` set
3. Write unit tests in `test/flow-control.test.js`
4. Write integration test with a real recipe

**Change the game mode:**
Edit `ccpg.config.json` — set `"mode"` to `"linear"` or `"jeopardy"`. Restart the server.

**Inspect loaded challenges at startup:**
The server logs each loaded challenge ID and name to stdout on startup.
