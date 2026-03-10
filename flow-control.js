// flow-control.js — Custom flow control engine for CyberChef-Playground
//
// cyberchef-node excludes all flow control operations (Fork, Merge, Subsection,
// Register, Label, Jump, Conditional Jump, Return, Comment). This engine sits on
// top of cyberchef-node and handles them with custom logic, executing regular ops
// one at a time via chef.bake().

// ---------------------------------------------------------------------------
// Safety limits
// ---------------------------------------------------------------------------
const MAX_STEPS = 10000;
const MAX_FORK_DEPTH = 10;
const MAX_REGISTERS = 100;
const EXECUTION_TIMEOUT = 30000; // ms

// ---------------------------------------------------------------------------
// Flow control op identification
// ---------------------------------------------------------------------------
const FLOW_CONTROL_OPS = new Set([
  'Fork', 'Merge', 'Subsection', 'Register',
  'Label', 'Jump', 'Conditional Jump', 'Conditional_Jump',
  'Return', 'Comment',
]);

export function isFlowControlOp(opName) {
  return FLOW_CONTROL_OPS.has(opName);
}

// ---------------------------------------------------------------------------
// Op name lookup (same normalisation as server.js resolveOpName)
// ---------------------------------------------------------------------------
let _opLookupCache = null;

function buildOpLookup(chefModule) {
  if (_opLookupCache) return _opLookupCache;
  const keys = Object.keys(chefModule).filter(k => !['Dish', 'bake', 'bakeWithOptions'].includes(k));
  _opLookupCache = Object.fromEntries(
    keys.map(k => [k.replace(/[^a-zA-Z0-9]/g, '').toLowerCase(), k])
  );
  return _opLookupCache;
}

function resolveOpName(displayName, opLookup) {
  if (isFlowControlOp(displayName)) return displayName;
  const normalised = displayName.replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
  return opLookup[normalised] || displayName;
}

// ---------------------------------------------------------------------------
// Register substitution — replace $Rn tokens recursively in args
// ---------------------------------------------------------------------------
export function substituteRegisters(value, registers) {
  if (typeof value === 'string') {
    return value.replace(/\$R(\d+)/g, (_, n) => {
      const val = registers.get(parseInt(n, 10));
      return val !== undefined ? val : '';
    });
  }
  if (Array.isArray(value)) {
    return value.map(v => substituteRegisters(v, registers));
  }
  if (value !== null && typeof value === 'object') {
    const result = {};
    for (const [k, v] of Object.entries(value)) {
      result[k] = substituteRegisters(v, registers);
    }
    return result;
  }
  // number, boolean, null — unchanged
  return value;
}

// ---------------------------------------------------------------------------
// Delimiter escape sequences: \\n → \n, \\r → \r, \\t → \t, \\0 → \0
// ---------------------------------------------------------------------------
function unescapeDelimiter(s) {
  if (typeof s !== 'string') return s;
  return s
    .replace(/\\n/g, '\n')
    .replace(/\\r/g, '\r')
    .replace(/\\t/g, '\t')
    .replace(/\\0/g, '\0');
}

// ---------------------------------------------------------------------------
// Find matching Merge for a Fork/Subsection starting a scan at startIp.
// Returns the recipe index of the matching Merge, or -1 if not found.
// (Not found is NOT an error for Fork — it means the block ends at recipe end.)
// ---------------------------------------------------------------------------
function findMatchingMerge(recipe, startIp) {
  let depth = 1;
  for (let i = startIp; i < recipe.length; i++) {
    const op = recipe[i].op;
    if (op === 'Fork' || op === 'Subsection') {
      depth++;
    } else if (op === 'Merge') {
      depth--;
      if (depth === 0) return i;
    }
  }
  return -1; // no explicit Merge
}

// ---------------------------------------------------------------------------
// Execute a single regular (non-flow-control) operation via chef.bake()
// ---------------------------------------------------------------------------
async function executeSingleOp(data, step, registers, chefModule, opLookup) {
  const resolvedOp = resolveOpName(step.op, opLookup);
  const resolvedArgs = substituteRegisters(step.args, registers);
  const normalizedStep = { op: resolvedOp, args: resolvedArgs };

  const dish = new chefModule.Dish(data, chefModule.Dish.ARRAY_BUFFER);
  const result = await chefModule.bake(dish, [normalizedStep]);
  const output = await result.get(chefModule.Dish.ARRAY_BUFFER);
  return Buffer.from(output);
}

// ---------------------------------------------------------------------------
// Join an array of Buffers with a delimiter Buffer between each
// ---------------------------------------------------------------------------
function joinBuffers(buffers, delimBuf) {
  if (buffers.length === 0) return Buffer.alloc(0);
  if (delimBuf.length === 0) return Buffer.concat(buffers);
  const parts = [];
  for (let i = 0; i < buffers.length; i++) {
    parts.push(buffers[i]);
    if (i < buffers.length - 1) parts.push(delimBuf);
  }
  return Buffer.concat(parts);
}

// ---------------------------------------------------------------------------
// Pre-scan: build label → index map; throw on duplicates
// ---------------------------------------------------------------------------
function buildLabelMap(recipe) {
  const labelMap = new Map();
  for (let i = 0; i < recipe.length; i++) {
    const step = recipe[i];
    if (step.op === 'Label') {
      const name = step.args[0];
      if (labelMap.has(name)) {
        throw new Error(`Duplicate label: "${name}"`);
      }
      labelMap.set(name, i);
    }
  }
  return labelMap;
}

// ---------------------------------------------------------------------------
// Validate that all Jump/Conditional Jump targets exist in labelMap
// ---------------------------------------------------------------------------
function validateJumps(recipe, labelMap) {
  for (const step of recipe) {
    if (step.op === 'Jump') {
      const label = step.args[0];
      if (!labelMap.has(label)) {
        throw new Error(`Jump references undefined label: "${label}"`);
      }
    } else if (step.op === 'Conditional Jump' || step.op === 'Conditional_Jump') {
      const label = step.args[2];
      if (label !== undefined && !labelMap.has(label)) {
        throw new Error(`Conditional Jump references undefined label: "${label}"`);
      }
    }
  }
}

// ---------------------------------------------------------------------------
// Main execution loop
// state: { ip, registers, jumpCounters, forkDepth, stepCount, startTime, labelMap }
// Returns: { data: Buffer, done: boolean }
// ---------------------------------------------------------------------------
async function executeBlock(recipe, inputData, chefModule, opLookup, state) {
  let data = Buffer.isBuffer(inputData) ? inputData : Buffer.from(inputData);

  while (state.ip < recipe.length) {
    // Safety: step limit
    state.stepCount++;
    if (state.stepCount > MAX_STEPS) {
      throw new Error(
        `Execution limit reached: exceeded ${MAX_STEPS} operations. ` +
        `Your recipe may contain an infinite loop.`
      );
    }

    // Safety: timeout
    if (Date.now() - state.startTime > EXECUTION_TIMEOUT) {
      throw new Error(
        `Execution timeout: recipe took longer than ${EXECUTION_TIMEOUT / 1000} seconds.`
      );
    }

    const step = recipe[state.ip];
    const op = step.op;

    // Regular operation — delegate to cyberchef-node
    if (!isFlowControlOp(op)) {
      data = await executeSingleOp(data, step, state.registers, chefModule, opLookup);
      state.ip++;
      continue;
    }

    // Flow control dispatch
    switch (op) {

      // ── Comment ────────────────────────────────────────────────────────────
      case 'Comment': {
        state.ip++;
        break;
      }

      // ── Return ─────────────────────────────────────────────────────────────
      case 'Return': {
        return { data, done: true };
      }

      // ── Label ──────────────────────────────────────────────────────────────
      case 'Label': {
        // Position was recorded during pre-scan; no-op at runtime
        state.ip++;
        break;
      }

      // ── Register ───────────────────────────────────────────────────────────
      case 'Register': {
        // args: [regexStr, caseSensitive, multiline, dotAll]
        const [regexStr, caseSensitive, multiline, dotAll] = step.args;
        let flags = '';
        if (!caseSensitive) flags += 'i';
        if (multiline) flags += 'm';
        if (dotAll) flags += 's';

        const regex = new RegExp(regexStr, flags);
        const str = data.toString('utf8');
        const match = regex.exec(str);

        if (match) {
          for (let i = 1; i < match.length; i++) {
            if (state.registers.size >= MAX_REGISTERS) {
              throw new Error(
                `Register limit exceeded: maximum ${MAX_REGISTERS} registers allowed.`
              );
            }
            state.registers.set(i - 1, match[i] !== undefined ? match[i] : '');
          }
        }

        // Data passes through unchanged
        state.ip++;
        break;
      }

      // ── Jump ───────────────────────────────────────────────────────────────
      case 'Jump': {
        // args: [label, maxIterations]
        const [label, maxIterations] = step.args;
        if (!state.labelMap.has(label)) {
          throw new Error(`Jump to undefined label: "${label}"`);
        }
        const count = state.jumpCounters.get(label) || 0;
        if (count < maxIterations) {
          state.jumpCounters.set(label, count + 1);
          state.ip = state.labelMap.get(label);
        } else {
          state.ip++; // iteration limit reached — fall through
        }
        break;
      }

      // ── Conditional Jump ───────────────────────────────────────────────────
      case 'Conditional Jump':
      case 'Conditional_Jump': {
        // args: [matchRegex, invertCondition, labelName, maxIterations]
        const [matchRegex, invertCondition, labelName, maxIterations] = step.args;
        if (!state.labelMap.has(labelName)) {
          throw new Error(`Conditional Jump to undefined label: "${labelName}"`);
        }

        const str = data.toString('utf8');
        let matches;
        if (!matchRegex || matchRegex === '') {
          matches = true; // empty regex always matches
        } else {
          try {
            matches = new RegExp(matchRegex).test(str);
          } catch {
            matches = false;
          }
        }
        if (invertCondition) matches = !matches;

        const count = state.jumpCounters.get(labelName) || 0;
        if (matches && count < maxIterations) {
          state.jumpCounters.set(labelName, count + 1);
          state.ip = state.labelMap.get(labelName);
        } else {
          state.ip++; // condition not met or limit reached — fall through
        }
        break;
      }

      // ── Fork ───────────────────────────────────────────────────────────────
      case 'Fork': {
        if (state.forkDepth >= MAX_FORK_DEPTH) {
          throw new Error(
            `Fork nesting limit exceeded: maximum ${MAX_FORK_DEPTH} levels.`
          );
        }

        // args: [splitDelimiter, mergeDelimiter, ignoreErrors?]
        // (3rd arg is a bool flag in CyberChef, we ignore it)
        const [splitDelimRaw, mergeDelimRaw] = step.args;
        const splitDelim = unescapeDelimiter(splitDelimRaw ?? '\n');
        const mergeDelim = unescapeDelimiter(mergeDelimRaw ?? '\n');

        const mergeIdx = findMatchingMerge(recipe, state.ip + 1);
        // -1 means no explicit Merge — entire rest of recipe is the inner block
        const blockEnd = mergeIdx === -1 ? recipe.length : mergeIdx;
        const innerRecipe = recipe.slice(state.ip + 1, blockEnd);

        const str = data.toString('utf8');
        const pieces = splitDelim === '' ? [str] : str.split(splitDelim);

        const results = [];
        for (const piece of pieces) {
          const branchState = {
            ip: 0,
            registers: new Map(state.registers), // copy — branch isolation
            jumpCounters: new Map(state.jumpCounters),
            forkDepth: state.forkDepth + 1,
            stepCount: state.stepCount,
            startTime: state.startTime,
            labelMap: buildLabelMap(innerRecipe),
          };

          const { data: branchResult } = await executeBlock(
            innerRecipe,
            Buffer.from(piece, 'utf8'),
            chefModule,
            opLookup,
            branchState
          );
          // Propagate stepCount back to enforce global limit
          state.stepCount = branchState.stepCount;
          results.push(branchResult);
        }

        // Join results (as Buffers) with merge delimiter
        const mergeDelimBuf = Buffer.from(mergeDelim, 'utf8');
        data = joinBuffers(results, mergeDelimBuf);

        // Advance ip to after the matching Merge (or to end of recipe if none)
        state.ip = mergeIdx === -1 ? recipe.length : mergeIdx + 1;
        break;
      }

      // ── Merge ──────────────────────────────────────────────────────────────
      case 'Merge': {
        // Encountered at top level (not inside a Fork/Subsection block).
        // This is a no-op — Fork/Subsection find their own matching Merge and
        // skip past it; a bare Merge in the outer recipe is simply ignored.
        state.ip++;
        break;
      }

      // ── Subsection ─────────────────────────────────────────────────────────
      case 'Subsection': {
        if (state.forkDepth >= MAX_FORK_DEPTH) {
          throw new Error(
            `Subsection nesting limit exceeded: maximum ${MAX_FORK_DEPTH} levels.`
          );
        }

        // args: [regexStr, caseSensitive, multiline, dotAll]
        const [regexStr, caseSensitive, multiline, dotAll] = step.args;
        let flags = 'g';
        if (!caseSensitive) flags += 'i';
        if (multiline) flags += 'm';
        if (dotAll) flags += 's';

        const mergeIdx = findMatchingMerge(recipe, state.ip + 1);
        if (mergeIdx === -1) {
          throw new Error(
            `Subsection at step ${state.ip} has no matching Merge.`
          );
        }
        const innerRecipe = recipe.slice(state.ip + 1, mergeIdx);

        const str = data.toString('utf8');
        let regex;
        try {
          regex = new RegExp(regexStr, flags);
        } catch (e) {
          throw new Error(`Invalid Subsection regex "${regexStr}": ${e.message}`);
        }

        const matches = [...str.matchAll(regex)];

        if (matches.length === 0) {
          // No matches — data passes through unchanged
          state.ip = mergeIdx + 1;
          break;
        }

        // Replace each match with its processed result; preserve non-matched text
        let result = '';
        let lastIndex = 0;

        for (const match of matches) {
          // Preserve text before this match
          result += str.slice(lastIndex, match.index);

          // Determine what to process:
          // If the regex has a capture group (match[1] exists), process only the
          // captured portion and preserve the rest of the full match around it.
          const hasCaptureGroup = match.length > 1 && match[1] !== undefined;
          const textToProcess = hasCaptureGroup ? match[1] : match[0];

          let prefixInMatch = '';
          let suffixInMatch = '';
          if (hasCaptureGroup) {
            const fullMatch = match[0];
            const captureIdx = fullMatch.indexOf(match[1]);
            if (captureIdx !== -1) {
              prefixInMatch = fullMatch.slice(0, captureIdx);
              suffixInMatch = fullMatch.slice(captureIdx + match[1].length);
            }
          }

          const branchState = {
            ip: 0,
            registers: new Map(state.registers),
            jumpCounters: new Map(state.jumpCounters),
            forkDepth: state.forkDepth + 1,
            stepCount: state.stepCount,
            startTime: state.startTime,
            labelMap: buildLabelMap(innerRecipe),
          };

          const { data: branchResult } = await executeBlock(
            innerRecipe,
            Buffer.from(textToProcess, 'utf8'),
            chefModule,
            opLookup,
            branchState
          );
          state.stepCount = branchState.stepCount;

          result += prefixInMatch + branchResult.toString('utf8') + suffixInMatch;
          lastIndex = match.index + match[0].length;
        }

        // Append remaining text after last match
        result += str.slice(lastIndex);

        data = Buffer.from(result, 'utf8');
        state.ip = mergeIdx + 1;
        break;
      }

      // ── Unknown flow control op ────────────────────────────────────────────
      default: {
        // Shouldn't happen if FLOW_CONTROL_OPS is accurate; skip gracefully
        state.ip++;
        break;
      }
    }
  }

  return { data, done: false };
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Execute a CyberChef recipe (including flow control operations) on inputData.
 *
 * @param {Buffer|ArrayBuffer|Uint8Array} inputData  Raw input bytes
 * @param {Array<{op: string, args: any[]}>} recipe  Parsed recipe steps
 * @param {object} chefModule  The cyberchef-node module (passed in for testability)
 * @returns {Promise<Buffer>}
 */
export async function executeRecipe(inputData, recipe, chefModule) {
  if (!Array.isArray(recipe) || recipe.length === 0) {
    return Buffer.isBuffer(inputData) ? inputData : Buffer.from(inputData);
  }

  const opLookup = buildOpLookup(chefModule);
  const labelMap = buildLabelMap(recipe);
  validateJumps(recipe, labelMap);

  const state = {
    ip: 0,
    registers: new Map(),
    jumpCounters: new Map(),
    forkDepth: 0,
    stepCount: 0,
    startTime: Date.now(),
    labelMap,
  };

  const { data } = await executeBlock(recipe, inputData, chefModule, opLookup, state);
  return data;
}
