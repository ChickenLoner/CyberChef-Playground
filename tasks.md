# tasks.md — Flow Control Engine Implementation Plan

## Current State

**Phases 1–5 complete. Phase 6 ~95% done. 63/63 tests passing.**

| File | Status | Notes |
|---|---|---|
| `flow-control.js` | ✅ Done | ~280-line custom engine |
| `test/flow-control.test.js` | ✅ Done | 46 unit tests, all pass |
| `test/integration.test.js` | ✅ Done | 17 integration tests, all pass |
| `server.js` | ✅ Done | Wired up flow control engine |
| `package.json` | ✅ Done | `"test"` script added |
| `.gitignore` | ✅ Done | Test exclusions removed |

---

## Background

`cyberchef-node` excludes all flow control operations (Fork, Merge, Register, Jump, Label, Conditional Jump, Subsection, Return, Comment). They throw `ExcludedOperationError`. This file tracks the work to build a custom flow control engine so the platform can execute any recipe players build in the CyberChef web UI.

---

## Phase 1: Core Engine (`flow-control.js`) ✅

### 1.1 Module scaffold and exports
- [x] Create `flow-control.js` as ES module
- [x] Export main function: `executeRecipe(inputData, recipe, chefModule)` → `Promise<Buffer>`
- [x] Define `FLOW_CONTROL_OPS` set: `Fork`, `Merge`, `Subsection`, `Register`, `Label`, `Jump`, `Conditional_Jump` (and alias `Conditional Jump`), `Return`, `Comment`
- [x] Export `isFlowControlOp(opName)` helper for use by `resolveOpName()`

### 1.2 Pre-scan phase
- [x] Scan recipe array to build `labelMap`: `Map<string, number>` (label name → index)
- [x] Validate: error if duplicate label names found
- [x] Validate: error if Jump/Conditional Jump references a label not in `labelMap`

### 1.3 State initialization
- [x] `ip = 0` (instruction pointer)
- [x] `registers = new Map()` ($R0, $R1, ...)
- [x] `forkStack = []` (for nested Fork/Subsection tracking)
- [x] `jumpCounters = new Map()` (label → iteration count)
- [x] `stepCount = 0` (total ops executed)
- [x] `startTime = Date.now()` (for timeout enforcement)

### 1.4 Main execution loop
- [x] `while (ip < recipe.length)` loop
- [x] On each iteration: increment `stepCount`, check against `MAX_STEPS`
- [x] Check `Date.now() - startTime` against `EXECUTION_TIMEOUT`
- [x] Read `recipe[ip]`, determine if flow control or regular op
- [x] Flow control → dispatch to handler
- [x] Regular op → execute via `executeSingleOp()`

### 1.5 Regular operation execution
- [x] `executeSingleOp(data, step, registers, chefModule)`
- [x] Apply register substitution to `step.args` before execution
- [x] Resolve op name via `chefModule` lookup (same normalization as current `resolveOpName`)
- [x] Create `Dish` from data, call `chef.bake(dish, [normalizedStep])`, extract result
- [x] Return result as `Buffer`

### 1.6 Register substitution
- [x] `substituteRegisters(value, registers)` — recursive function
- [x] Handle `string`: replace all `$Rn` patterns with `registers.get(n)` (or empty string if unset)
- [x] Handle `object`: recurse into each value
- [x] Handle `array`: recurse into each element
- [x] Handle primitives (number, boolean, null): return unchanged
- [x] Pattern: `/\$R(\d+)/g` for matching register references

---

## Phase 2: Flow Control Operation Handlers ✅

### 2.1 Comment
- [x] Simplest handler: increment `ip`, do nothing else
- [x] Ignore `args[0]` (the comment text)

### 2.2 Return
- [x] Set a `returned = true` flag to break the main loop
- [x] Current data becomes the final result

### 2.3 Label
- [x] No-op at runtime (position already in `labelMap`)
- [x] Increment `ip`

### 2.4 Register
- [x] Extract args: `[regexStr, caseSensitive, multiline, dotAll]`
- [x] Build `RegExp` from args with appropriate flags
- [x] Apply regex to current data (converted to UTF-8 string)
- [x] Store capture groups: `match[1]` → `$R0`, `match[2]` → `$R1`, etc.
- [x] Enforce `MAX_REGISTERS` limit
- [x] Data passes through unchanged
- [x] Increment `ip`

### 2.5 Jump
- [x] Extract args: `[label, maxIterations]`
- [x] Look up label in `labelMap` (error if not found)
- [x] Check `jumpCounters.get(label)` vs `maxIterations`
- [x] If under limit: increment counter, set `ip = labelMap.get(label)`
- [x] If at limit: increment `ip` (fall through)

### 2.6 Conditional Jump
- [x] CyberChef arg order: `[matchRegex, invertCondition, labelName, maxIterations]`
- [x] Convert current data to string
- [x] Test string against regex; apply invert logic
- [x] If condition met AND under iteration limit: jump to label
- [x] Otherwise: fall through
- [x] Handle edge case: empty regex = always match

### 2.7 Fork
- [x] Extract args: `[splitDelimiter, mergeDelimiter]`
- [x] Convert current data to string
- [x] Handle delimiter escape sequences (e.g., `\\n` → `\n`, `\\t` → `\t`)
- [x] Split data by `splitDelimiter`
- [x] Find matching Merge: scan forward from `ip+1`, track Fork/Subsection/Merge nesting depth
- [x] Fork without Merge: valid — uses `recipe.length` as block end
- [x] Extract the "inner recipe" (ops between Fork and Merge)
- [x] Check fork depth against `MAX_FORK_DEPTH`
- [x] For each split piece: recursively execute the inner recipe, collect result
- [x] Join all results with `mergeDelimiter` (Buffer-safe via `Buffer.concat`)
- [x] Set `ip` to instruction after the matching Merge
- [x] Each branch gets a Map copy of parent registers (branch isolation)

### 2.8 Merge
- [x] If encountered at top level (not inside Fork/Subsection recursive call): no-op
- [x] All args ignored (arithmetic-obfuscation uses `[true]`, must not error)
- [x] Increment `ip`

### 2.9 Subsection
- [x] Extract args: `[regexStr, caseSensitive, sectionDelimiter]`
- [x] Build `RegExp` with global flag
- [x] Find all matches in current data (as string)
- [x] Find matching Merge (same depth-tracking logic as Fork)
- [x] Extract inner recipe
- [x] For each match: execute inner recipe on matched text, replace match with result
- [x] Non-matched portions preserved in place
- [x] Set `ip` to after Merge

---

## Phase 3: Integrate with `server.js` ✅

### 3.1 Import and wire up
- [x] `import { executeRecipe, isFlowControlOp } from './flow-control.js'`
- [x] Replaced `executeCyberChefRecipe()` body to call `executeRecipe(inputData, recipe, chef)`

### 3.2 Update `resolveOpName()`
- [x] Before lookup, check `isFlowControlOp(displayName)`
- [x] If flow control: return the canonical name unchanged

### 3.3 Update startup banner
- [x] Added: `✓ Flow control operations supported (Fork, Merge, Jump, Register, etc.)`

---

## Phase 4: Testing ✅

### 4.1 Setup
- [x] Add `"test": "node --test test/flow-control.test.js test/integration.test.js"` to `package.json` scripts
  - Note: `node --test test/` does NOT work on Windows (treats dir as module); explicit paths required
- [x] Create `test/` directory
- [x] Update `.gitignore`: remove the `test/` and `*.test.js` exclusions

### 4.2 Unit tests — `test/flow-control.test.js` (38 tests, all pass)

**Register substitution:** ✅
- [x] String with single `$R0` → replaced
- [x] String with multiple registers `$R0...$R1` → both replaced
- [x] Object with `$Rn` in values → replaced recursively
- [x] Array with `$Rn` elements → replaced recursively
- [x] Nested object/array combinations
- [x] `$Rn` with no matching register → replaced with empty string
- [x] Non-string primitives (number, boolean, null) → unchanged

**Comment:** ✅
- [x] Recipe with Comment op → data passes through unchanged

**Return:** ✅
- [x] Recipe with Return mid-way → only ops before Return execute
- [x] Return as first op → returns input unchanged

**Label + Jump:** ✅
- [x] Jump with maxIterations=3 → inner ops execute 3 times
- [x] Jump with maxIterations=0 → falls through immediately
- [x] Jump to nonexistent label → throws descriptive error
- [x] Duplicate label names → throws error during pre-scan

**Conditional Jump:** ✅
- [x] Data matches regex → jumps
- [x] Data does not match → falls through
- [x] Iteration limit respected
- [x] Empty regex → always matches

**Register:** ✅
- [x] Single capture group → `$R0` set correctly
- [x] Multiple capture groups → `$R0`, `$R1`, ... set
- [x] No match → registers unchanged
- [x] Data passes through unchanged (not consumed)
- [x] Subsequent ops can use `$Rn` in their args

**Fork + Merge:** ✅
- [x] Split by `\n`, process each line, merge with `\n`
- [x] Split by comma, merge with semicolon
- [x] Empty branches (consecutive delimiters) → empty results
- [x] Single branch (no delimiter found) → behaves like no fork
- [x] Nested Fork: outer splits by `\n`, inner splits by `,`

**Subsection + Merge:** ✅
- [x] Regex matches portions → only matched text processed
- [x] Non-matched text preserved in place
- [x] Multiple matches → all processed independently
- [x] No match → data unchanged

**Safety limits:** ✅
- [x] Exceeding `MAX_STEPS` → throws error with step count
- [x] Exceeding `MAX_FORK_DEPTH` → throws error mentioning nesting
- [x] Exceeding `EXECUTION_TIMEOUT` → throws error with time elapsed
- [x] `MAX_REGISTERS` exceeded → throws error

### 4.3 Integration tests — `test/integration.test.js` (19 tests, all pass)

**Backwards compatibility (CRITICAL):** ✅
- [x] Linear recipe (no flow control) produces same output as old `chef.bake()` path
- [x] Single-op recipe: `[{op: "To Base64", args: [...]}]`
- [x] Multi-op recipe: Base64 → From Base64 round-trip
- [x] Verify byte-exact match (SHA256 comparison)

**Real-world flow control recipes:** ✅
- [x] **Multi-line Base64 decode**: `Fork(\n,\n) → From_Base64 → Merge`
- [x] **Loop decode**: `Label("start") → From_Base64 → Jump("start", 2)` (triple-encoded)
- [x] **Register + dynamic key**: `Register("(.{8})") → Drop_bytes(0,8) → XOR({string:"$R0"})`
- [x] **Subsection**: `Subsection("[0-9a-f]+") → From_Hex → Merge`
- [x] **Conditional Jump loop**: process data until pattern no longer matches

**Advanced challenge validation:** ✅ (all 3 challenges validated)
- [x] `dns-exfil-aes` — Fork + Register, determinism verified (1.1s)
- [x] `arithmetic-obfuscation` — Fork + Subsection×3, determinism verified (176ms)
- [x] `free-python-obfuscator` — Label + Conditional Jump loop, determinism verified (138ms)

**Error handling:** ✅
- [x] Recipe with Jump to undefined label → descriptive error
- [x] Subsection without matching Merge → descriptive error
- [x] Recipe that would run forever → hits MAX_STEPS

---

## Phase 5: Documentation Updates ✅

### 5.1 README.md
- [x] Add "Flow Control Support" to features list
- [x] Add flow control engine to Technical Details table
- [x] Update "How Validation Works" diagram to show flow control engine step
- [x] Add `flow-control.js` to Project Structure file tree

### 5.2 Startup logging
- [x] Startup logs already include: `✓ Flow control operations supported (Fork, Merge, Jump, Register, etc.)`

---

## Phase 6: Edge Cases & Hardening ✅

- [x] Delimiter escape sequences in Fork args: `\\n` → newline, `\\r` → carriage return, `\\t` → tab
- [x] Unicode input handling in Fork/Register/Subsection regex — 4 tests added (emoji Fork split, multi-byte Register capture, Subsection on multi-byte text, emoji delimiter)
- [x] Binary data through Fork — documented as known limitation in code comments (matches CyberChef web UI behavior)
- [x] Empty recipe array → return input unchanged
- [x] Recipe with only flow control ops (no regular ops) → correct behavior
- [x] Register used before any Register op → `$Rn` replaced with empty string (not error)
- [x] Merge without preceding Fork → no-op (graceful handling)
- [x] Multiple Fork...Merge blocks in sequence (not nested)
- [x] Fork with empty split result (trailing delimiter)
- [x] Subsection regex with no capture group vs with capture group
- [x] Conditional Jump regex flags handling
- [x] Preventing looping many times and find a way to prevent DoS — core limits exist (MAX_STEPS=10000, MAX_FORK_DEPTH=10, TIMEOUT=30s); stress tests added (nested fork depth=9, loop near MAX_STEPS)

---

## Implementation Order

Recommended sequence to minimize risk:

1. **Phase 1.1–1.6** — Module scaffold, state, regular op execution, register substitution ✅
2. **Phase 2.1–2.3** — Trivial ops: Comment, Return, Label ✅
3. **Phase 2.4–2.6** — Register, Jump, Conditional Jump (no nesting complexity) ✅
4. **Phase 4.2** — Unit tests for everything built so far ✅
5. **Phase 2.7–2.8** — Fork + Merge (the hardest part: recursion, nesting, delimiter handling) ✅
6. **Phase 2.9** — Subsection (similar to Fork but regex-based) ✅
7. **Phase 4.2 continued** — Unit tests for Fork, Merge, Subsection ✅
8. **Phase 3** — Wire into server.js ✅
9. **Phase 4.3** — Integration tests (end-to-end validation) ✅
10. **Phase 6** — Edge cases and hardening ✅
11. **Phase 5** — Documentation updates ✅

---

## Acceptance Criteria

The implementation is complete when:

1. ✅ All existing challenges (linear recipes) still validate correctly — **zero regressions**
2. ✅ Recipes containing Fork/Merge execute correctly (multi-line processing)
3. ✅ Recipes containing Register execute correctly (dynamic args via `$Rn`)
4. ✅ Recipes containing Label/Jump/Conditional Jump execute correctly (loops)
5. ✅ Recipes containing Subsection execute correctly (partial processing)
6. ✅ Nested Forks work (Fork within Fork)
7. ✅ Safety limits prevent resource exhaustion
8. ✅ All unit and integration tests pass
9. ✅ Error messages are descriptive enough for players to debug their recipes
