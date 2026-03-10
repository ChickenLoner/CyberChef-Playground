# tasks.md — Flow Control Engine Implementation Plan

## Background

`cyberchef-node` excludes all flow control operations (Fork, Merge, Register, Jump, Label, Conditional Jump, Subsection, Return, Comment). They throw `ExcludedOperationError`. This file tracks the work to build a custom flow control engine so the platform can execute any recipe players build in the CyberChef web UI.

---

## Phase 1: Core Engine (`flow-control.js`)

### 1.1 Module scaffold and exports
- [ ] Create `flow-control.js` as ES module
- [ ] Export main function: `executeRecipe(inputData, recipe, chefModule)` → `Promise<Buffer>`
- [ ] Define `FLOW_CONTROL_OPS` set: `Fork`, `Merge`, `Subsection`, `Register`, `Label`, `Jump`, `Conditional_Jump` (and alias `Conditional Jump`), `Return`, `Comment`
- [ ] Export `isFlowControlOp(opName)` helper for use by `resolveOpName()`

### 1.2 Pre-scan phase
- [ ] Scan recipe array to build `labelMap`: `Map<string, number>` (label name → index)
- [ ] Validate: error if duplicate label names found
- [ ] Validate: error if Jump/Conditional Jump references a label not in `labelMap`

### 1.3 State initialization
- [ ] `ip = 0` (instruction pointer)
- [ ] `registers = new Map()` ($R0, $R1, ...)
- [ ] `forkStack = []` (for nested Fork/Subsection tracking)
- [ ] `jumpCounters = new Map()` (label → iteration count)
- [ ] `stepCount = 0` (total ops executed)
- [ ] `startTime = Date.now()` (for timeout enforcement)

### 1.4 Main execution loop
- [ ] `while (ip < recipe.length)` loop
- [ ] On each iteration: increment `stepCount`, check against `MAX_STEPS`
- [ ] Check `Date.now() - startTime` against `EXECUTION_TIMEOUT`
- [ ] Read `recipe[ip]`, determine if flow control or regular op
- [ ] Flow control → dispatch to handler
- [ ] Regular op → execute via `executeSingleOp()`

### 1.5 Regular operation execution
- [ ] `executeSingleOp(data, step, registers, chefModule)`
- [ ] Apply register substitution to `step.args` before execution
- [ ] Resolve op name via `chefModule` lookup (same normalization as current `resolveOpName`)
- [ ] Create `Dish` from data, call `chef.bake(dish, [normalizedStep])`, extract result
- [ ] Return result as `Buffer`

### 1.6 Register substitution
- [ ] `substituteRegisters(value, registers)` — recursive function
- [ ] Handle `string`: replace all `$Rn` patterns with `registers.get(n)` (or empty string if unset)
- [ ] Handle `object`: recurse into each value
- [ ] Handle `array`: recurse into each element
- [ ] Handle primitives (number, boolean, null): return unchanged
- [ ] Pattern: `/\$R(\d+)/g` for matching register references

---

## Phase 2: Flow Control Operation Handlers

### 2.1 Comment
- [ ] Simplest handler: increment `ip`, do nothing else
- [ ] Ignore `args[0]` (the comment text)

### 2.2 Return
- [ ] Set a `returned = true` flag to break the main loop
- [ ] Current data becomes the final result

### 2.3 Label
- [ ] No-op at runtime (position already in `labelMap`)
- [ ] Increment `ip`

### 2.4 Register
- [ ] Extract args: `[regexStr, caseSensitive, multiline, dotAll]`
- [ ] Build `RegExp` from args with appropriate flags
- [ ] Apply regex to current data (converted to UTF-8 string)
- [ ] Store capture groups: `match[1]` → `$R0`, `match[2]` → `$R1`, etc.
- [ ] Enforce `MAX_REGISTERS` limit
- [ ] Data passes through unchanged
- [ ] Increment `ip`

### 2.5 Jump
- [ ] Extract args: `[label, maxIterations]`
- [ ] Look up label in `labelMap` (error if not found)
- [ ] Check `jumpCounters.get(label)` vs `maxIterations`
- [ ] If under limit: increment counter, set `ip = labelMap.get(label)`
- [ ] If at limit: increment `ip` (fall through)

### 2.6 Conditional Jump
- [ ] CyberChef arg order: `[matchRegex, invertCondition, labelName, maxIterations]`
  - `args[0]` = regex string to test against current data
  - `args[1]` = boolean; if `true`, jump when regex does NOT match (invert condition)
  - `args[2]` = label name to jump to
  - `args[3]` = max iterations
- [ ] Convert current data to string
- [ ] Test string against regex; apply invert logic
- [ ] If condition met AND under iteration limit: jump to label
- [ ] Otherwise: fall through
- [ ] Handle edge case: empty regex = always match

### 2.7 Fork
- [ ] Extract args: `[splitDelimiter, mergeDelimiter]`
- [ ] Convert current data to string
- [ ] Handle delimiter escape sequences (e.g., `\\n` → `\n`, `\\t` → `\t`)
- [ ] Split data by `splitDelimiter`
- [ ] Find matching Merge: scan forward from `ip+1`, track Fork/Subsection/Merge nesting depth
- [ ] Error if no matching Merge found
- [ ] Extract the "inner recipe" (ops between Fork and Merge)
- [ ] Check fork depth against `MAX_FORK_DEPTH`
- [ ] For each split piece:
  - [ ] Recursively execute the inner recipe on that piece
  - [ ] Collect result
- [ ] Join all results with `mergeDelimiter` (also handle escape sequences)
- [ ] Set `ip` to instruction after the matching Merge
- [ ] The recursive execution must share `registers` and `jumpCounters` state but get fresh `forkStack` context

### 2.8 Merge
- [ ] If encountered at top level (not inside Fork/Subsection recursive call): no-op
- [ ] If inside a recursive Fork/Subsection call: signals end of inner recipe block
- [ ] Increment `ip`

### 2.9 Subsection
- [ ] Extract args: `[regexStr, caseSensitive, sectionDelimiter]`
- [ ] Build `RegExp` with global flag
- [ ] Find all matches in current data (as string)
- [ ] Find matching Merge (same depth-tracking logic as Fork)
- [ ] Extract inner recipe
- [ ] For each match:
  - [ ] Execute inner recipe on matched text
  - [ ] Replace match with result in the original string
- [ ] Non-matched portions preserved in place
- [ ] Set `ip` to after Merge
- [ ] Handle capture groups: if regex has captures, operate on captured group (not full match)

---

## Phase 3: Integrate with `server.js`

### 3.1 Import and wire up
- [ ] `import { executeRecipe, isFlowControlOp } from './flow-control.js'`
- [ ] Replace `executeCyberChefRecipe()` function body (lines 239-250):
  - Call `executeRecipe(inputData, recipe, chef)` instead of `chef.bake()`
- [ ] Keep the existing function signature for backwards compatibility within server.js

### 3.2 Update `resolveOpName()`
- [ ] Before lookup in `_opLookup`, check `isFlowControlOp(displayName)`
- [ ] If flow control: return the canonical name unchanged (do not attempt cyberchef-node lookup)
- [ ] This prevents "not found" fallback behavior for flow control op names

### 3.3 Update startup banner
- [ ] Change "ALL 300+ operations supported!" to include flow control mention
- [ ] Add line: `✓ Flow control operations supported (Fork, Merge, Jump, Register, etc.)`

---

## Phase 4: Testing

### 4.1 Setup
- [ ] Add `"test": "node --test test/"` to `package.json` scripts
- [ ] Create `test/` directory
- [ ] Update `.gitignore`: remove the `test/` and `*.test.js` exclusions
- [ ] Create test helper: function to build a simple recipe array and run through engine

### 4.2 Unit tests — `test/flow-control.test.js`

**Register substitution:**
- [ ] String with single `$R0` → replaced
- [ ] String with multiple registers `$R0...$R1` → both replaced
- [ ] Object with `$Rn` in values → replaced recursively
- [ ] Array with `$Rn` elements → replaced recursively
- [ ] Nested object/array combinations
- [ ] `$Rn` with no matching register → replaced with empty string
- [ ] Non-string primitives (number, boolean, null) → unchanged

**Comment:**
- [ ] Recipe with Comment op → data passes through unchanged

**Return:**
- [ ] Recipe with Return mid-way → only ops before Return execute
- [ ] Return as first op → returns input unchanged

**Label + Jump:**
- [ ] Jump with maxIterations=3 → inner ops execute 3 times
- [ ] Jump with maxIterations=0 → falls through immediately
- [ ] Jump to nonexistent label → throws descriptive error
- [ ] Duplicate label names → throws error during pre-scan

**Conditional Jump:**
- [ ] Data matches regex → jumps
- [ ] Data does not match → falls through
- [ ] Iteration limit respected
- [ ] Empty regex → always matches

**Register:**
- [ ] Single capture group → `$R0` set correctly
- [ ] Multiple capture groups → `$R0`, `$R1`, ... set
- [ ] No match → registers unchanged
- [ ] Data passes through unchanged (not consumed)
- [ ] Subsequent ops can use `$Rn` in their args

**Fork + Merge:**
- [ ] Split by `\n`, process each line, merge with `\n`
- [ ] Split by comma, merge with semicolon
- [ ] Empty branches (consecutive delimiters) → empty results
- [ ] Single branch (no delimiter found) → behaves like no fork
- [ ] Nested Fork: outer splits by `\n`, inner splits by `,`

**Subsection + Merge:**
- [ ] Regex matches portions → only matched text processed
- [ ] Non-matched text preserved in place
- [ ] Multiple matches → all processed independently
- [ ] No match → data unchanged

**Safety limits:**
- [ ] Exceeding `MAX_STEPS` → throws error with step count
- [ ] Exceeding `MAX_FORK_DEPTH` → throws error mentioning nesting
- [ ] Exceeding `EXECUTION_TIMEOUT` → throws error with time elapsed
- [ ] `MAX_REGISTERS` exceeded → throws error

### 4.3 Integration tests — `test/integration.test.js`

**Backwards compatibility (CRITICAL):**
- [ ] Linear recipe (no flow control) produces same output as old `chef.bake()` path
- [ ] Single-op recipe: `[{op: "To Base64", args: [...]}]`
- [ ] Multi-op recipe: Base64 → XOR → ROT13
- [ ] Verify byte-exact match (SHA256 comparison)

**Real-world flow control recipes:**
- [ ] **Multi-line Base64 decode**: `Fork(\n,\n) → From_Base64 → Merge`
  - Input: multiple Base64-encoded lines separated by `\n`
  - Each line decoded independently, results joined by `\n`
- [ ] **Loop decode**: `Label("start") → From_Base64 → Jump("start", 3)`
  - Input: triple-Base64-encoded string
  - Decodes 3 times via loop
- [ ] **Register + dynamic key**: `Register("(.{8})") → Drop_bytes(0,8) → XOR({string:"$R0"})`
  - Input: 8-byte key prefix + XOR-encrypted data
  - Register captures key, XOR uses it
- [ ] **Subsection**: `Subsection("[0-9a-f]+") → From_Hex → Merge`
  - Input: mixed text with hex-encoded portions
  - Only hex portions decoded, rest preserved
- [ ] **Fork + Register combined**: Fork splits lines, Register captures from each line
- [ ] **Conditional Jump loop**: process data until pattern no longer matches

**Advanced challenge validation — Lukas's `advanced_challenges` branch:**

These three challenges from [ChickenLoner/CCPG-Challenges@advanced_challenges](https://github.com/ChickenLoner/CCPG-Challenges/tree/advanced_challenges/challenges) require flow control and serve as end-to-end acceptance tests:

- [ ] **DNS Exfil AES** (`challenges/dns-exfil-aes/`, id 13, category: Reversing)
  - Flow control ops used: `Fork`, `Register`
  - Recipe walkthrough:
    1. `Fork("\\n", "")` — split DNS log lines, merge with no separator
    2. `Regular expression` — extract long Base64url substrings from each DNS query
    3. `From Base64 (URL-safe)` — decode each chunk
    4. `To Hex` — convert to hex string
    5. `Register("(.{32})")` — capture first 32 hex chars as `$R0` (the AES-CBC IV)
    6. `Drop bytes(0, 32)` — remove the IV prefix, leaving ciphertext
    7. `AES Decrypt(key="BootcampSecureKe", iv=$R0, mode=CBC, input=Hex, output=Raw)` — decrypt
  - Key engine requirement: `$R0` substitution inside a nested object arg (`{"option":"Hex","string":"$R0"}`)
  - Test: run `validation.bin` through this recipe, verify SHA256 matches expected hash

- [ ] **Arithmetic Obfuscation** (`challenges/arithmetic-obfuscation/`, id 15, category: Deobfuscation)
  - Flow control ops used: `Fork`, `Subsection` (×3), `Merge` (×3)
  - Recipe walkthrough:
    1. `Regular expression` — extract numeric expressions from `[char](value)` PowerShell cast syntax
    2. `Fork("\\n", "\\n")` — process each extracted expression independently
    3. `Subsection("[0-9]+\\+[0-9]+")` → `Find/Replace("+", " ")` → `Sum("Space")` → `Merge`
    4. `Subsection("[0-9]+-[0-9]+")` → `Find/Replace("-", " ")` → `Subtract("Space")` → `Merge`
    5. `Subsection("[0-9]+/[0-9]+")` → `Find/Replace("/", " ")` → `Divide("Space")` → `Merge`
    6. `From Decimal("Line feed")` — convert decimal char codes to characters
  - Key engine requirement: sequential Subsection/Merge blocks at same nesting level inside a Fork; `Merge` args `[true]` (boolean arg, not empty)
  - Test: run `validation.bin` through this recipe, verify SHA256 matches expected hash

- [ ] **Free Python Obfuscator** (`challenges/free-python-obfuscator/`, id 14, category: Deobfuscation)
  - Flow control ops used: `Label`, `Conditional Jump`
  - Recipe walkthrough:
    1. `Label("Begin")` — loop entry point
    2. `Regular expression` — extract Base64 string from `b'...'` Python bytes literal
    3. `Reverse("Character")` — reverse the extracted string
    4. `From Base64` — decode
    5. `Zlib Inflate` — decompress
    6. `Conditional Jump("exec", false, "Begin", 1000)` — if output still contains `exec`, loop back to "Begin" (up to 1000 times)
  - Arg order for Conditional Jump: `[matchRegex, invertCondition, labelName, maxIterations]`
    - `"exec"` = regex to test against current output
    - `false` = do NOT invert (jump when it DOES match)
    - `"Begin"` = label to jump to
    - `1000` = max iterations
  - Key engine requirement: Label/Conditional Jump loop that terminates when the deobfuscated payload no longer wraps output in `exec()`; engine must correctly parse the 4-arg Conditional Jump format
  - Test: run `validation.bin` through this recipe, verify SHA256 matches expected hash

**Error handling:**
- [ ] Recipe with Fork but no Merge → descriptive error
- [ ] Recipe with Jump to undefined label → descriptive error
- [ ] Recipe that would run forever → hits MAX_STEPS, returns error
- [ ] Recipe with invalid operation name → error from cyberchef-node

---

## Phase 5: Documentation Updates

### 5.1 README.md
- [ ] Add "Flow Control Support" to features list
- [ ] Add flow control operations to supported operations table
- [ ] Update "How Validation Works" diagram if needed

### 5.2 Startup logging
- [ ] Verify startup logs accurately reflect capabilities

---

## Phase 6: Edge Cases & Hardening

- [ ] Delimiter escape sequences in Fork args: `\\n` → newline, `\\r` → carriage return, `\\t` → tab
- [ ] Unicode input handling in Fork/Register/Subsection regex
- [ ] Binary data through Fork (split may corrupt binary — document limitation or handle as hex)
- [ ] Empty recipe array → return input unchanged
- [ ] Recipe with only flow control ops (no regular ops) → correct behavior
- [ ] Register used before any Register op → `$Rn` replaced with empty string (not error)
- [ ] Merge without preceding Fork → no-op (graceful handling)
- [ ] Multiple Fork...Merge blocks in sequence (not nested)
- [ ] Fork with empty split result (trailing delimiter)
- [ ] Subsection regex with no capture group vs with capture group
- [ ] Conditional Jump regex flags handling

---

## Implementation Order

Recommended sequence to minimize risk:

1. **Phase 1.1–1.6** — Module scaffold, state, regular op execution, register substitution
2. **Phase 2.1–2.3** — Trivial ops: Comment, Return, Label
3. **Phase 2.4–2.6** — Register, Jump, Conditional Jump (no nesting complexity)
4. **Phase 4.2** — Unit tests for everything built so far
5. **Phase 2.7–2.8** — Fork + Merge (the hardest part: recursion, nesting, delimiter handling)
6. **Phase 2.9** — Subsection (similar to Fork but regex-based)
7. **Phase 4.2 continued** — Unit tests for Fork, Merge, Subsection
8. **Phase 3** — Wire into server.js
9. **Phase 4.3** — Integration tests (end-to-end validation)
10. **Phase 6** — Edge cases and hardening
11. **Phase 5** — Documentation updates

---

## Acceptance Criteria

The implementation is complete when:

1. All existing challenges (linear recipes) still validate correctly — **zero regressions**
2. Recipes containing Fork/Merge execute correctly (multi-line processing)
3. Recipes containing Register execute correctly (dynamic args via `$Rn`)
4. Recipes containing Label/Jump/Conditional Jump execute correctly (loops)
5. Recipes containing Subsection execute correctly (partial processing)
6. Nested Forks work (Fork within Fork)
7. Safety limits prevent resource exhaustion
8. All unit and integration tests pass
9. Error messages are descriptive enough for players to debug their recipes
