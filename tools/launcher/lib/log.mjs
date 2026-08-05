// Minimal, dependency-free console formatting — no chalk/ora, matching this repo's existing
// tooling convention (see scripts/verify-production-env.mjs). Colors degrade harmlessly to plain
// text on terminals that don't support ANSI (the codes just print as no-ops on most, and Windows
// Terminal/PowerShell 7/Git Bash all support them anyway).
import { AsyncLocalStorage } from 'node:async_hooks';

const isColorEnabled = process.env['NO_COLOR'] === undefined && process.env['FORCE_COLOR'] !== '0';

function color(code, text) {
  return isColorEnabled ? `[${code}m${text}[0m` : text;
}

const green = (text) => color('32', text);
const red = (text) => color('31', text);
const yellow = (text) => color('33', text);
const cyan = (text) => color('36', text);
const magenta = (text) => color('35', text);
const dim = (text) => color('2', text);
const bold = (text) => color('1', text);

// --- Log levels (Task 11) ---------------------------------------------------------------------
// SUCCESS/ERROR/WARN/INFO always print; DEBUG/TRACE only print once setVerbose(true) has been
// called (wired to --verbose in cli.mjs/doctor.mjs). There's no logger *object* to construct/pass
// around — every launcher module already imports this file as a namespace, so level-gating lives
// here as module state instead of threading a logger instance through every function signature.
let verboseEnabled = false;

export function setVerbose(value) {
  verboseEnabled = value;
}

export function isVerbose() {
  return verboseEnabled;
}

// --- Output capture (Task 4 support) ------------------------------------------------------------
// Running independent stages concurrently (Task 4) means their log output would otherwise
// interleave line-by-line and become unreadable — two stages' console.log calls racing against
// each other mid-execution. AsyncLocalStorage (not a naive global console.log swap, which breaks
// under real concurrency: a second stage starting before the first finishes would silently steal
// the redirect) tracks a per-stage buffer through the actual async call chain, so each stage's
// output can be collected in isolation and flushed together, in stage order, once the whole
// parallel group finishes. Sequential (non-parallel) stages are unaffected — write() only buffers
// when a buffer has actually been established for the current async context.
const bufferStorage = new AsyncLocalStorage();

function write(stream, text) {
  const buffer = bufferStorage.getStore();
  if (buffer) {
    buffer.push({ stream, text });
    return;
  }
  (stream === 'error' ? console.error : console.log)(text);
}

/** Runs `fn` with its log output buffered instead of printed immediately. Returns
 *  `{result, lines}` — the caller decides when/whether to flush() `lines`. */
export async function runCaptured(fn) {
  const buffer = [];
  const result = await bufferStorage.run(buffer, fn);
  return { result, lines: buffer };
}

/** Prints a previously-captured buffer's lines, in the order they were originally written. */
export function flush(lines) {
  for (const { stream, text } of lines) {
    (stream === 'error' ? console.error : console.log)(text);
  }
}

export function ok(message) {
  write('log', `${green('✔')} ${message}`);
}

export function fail(message) {
  write('error', `${red('✖')} ${message}`);
}

export function warn(message) {
  write('error', `${yellow('⚠')} ${message}`);
}

export function info(message) {
  write('log', `${cyan('ℹ')} ${message}`);
}

/** DEBUG — only visible with --verbose. For "here's what the launcher is doing internally", not
 *  user-facing status. */
export function debug(message) {
  if (verboseEnabled) {
    write('log', `${dim('debug')} ${message}`);
  }
}

/** TRACE — only visible with --verbose. For the noisiest detail (raw command lines, full
 *  parsed output) — one level below debug(), still gated the same way since this tool has no
 *  finer-grained verbosity flag than the one --verbose switch the CLI already exposes. */
export function trace(message) {
  if (verboseEnabled) {
    write('log', `${dim('trace')} ${dim(message)}`);
  }
}

export function section(title) {
  write('log', `\n${bold(title)}`);
}

export function detail(message) {
  write('log', `  ${dim(message)}`);
}

/**
 * Problem / Cause / Suggested Fix / Documentation / Retry Hint / verbose-only stack trace — the
 * shape every launcher error is reported in (Task 9). Every field but `rootCause` is optional;
 * callers pass only what's relevant. `error` (the raw exception/stack) is never shown unless
 * `verbose` is true — no raw exception should reach the user by default.
 */
export function failWithGuidance({ rootCause, suggestedFix, nextAction, docs, retryHint, error, verbose }) {
  fail(rootCause);
  if (suggestedFix) {
    write('error', `  ${bold('Fix:')} ${suggestedFix}`);
  }
  if (nextAction) {
    write('error', `  ${bold('Next:')} ${nextAction}`);
  }
  if (retryHint) {
    write('error', `  ${bold('Retry:')} ${retryHint}`);
  }
  if (docs) {
    write('error', `  ${bold('Docs:')} ${dim(docs)}`);
  }
  if ((verbose ?? verboseEnabled) && error) {
    write('error', `\n${dim(error.stack || String(error))}`);
  }
}

export function formatDuration(ms) {
  if (ms < 1000) {
    return `${Math.round(ms)}ms`;
  }
  return `${(ms / 1000).toFixed(1)}s`;
}

export class StepTimer {
  constructor() {
    this.start = performance.now();
  }

  elapsed() {
    return formatDuration(performance.now() - this.start);
  }

  elapsedMs() {
    return performance.now() - this.start;
  }
}

// --- Dashboard rendering (Task 7 / Task 10) ---------------------------------------------------

const POSITIVE_VALUES = new Set(['healthy', 'connected', 'ready', 'hit', 'ok', 'passed']);
const NEGATIVE_VALUES = new Set(['failed', 'unhealthy', 'disconnected', 'not_ready', 'error']);
const NEUTRAL_VALUES = new Set(['skipped', 'degraded', 'miss', 'not_applicable', 'unknown']);

function colorizeValue(value) {
  const key = String(value).toLowerCase();
  if (POSITIVE_VALUES.has(key)) {
    return green(String(value));
  }
  if (NEGATIVE_VALUES.has(key)) {
    return red(String(value));
  }
  if (NEUTRAL_VALUES.has(key)) {
    return yellow(String(value));
  }
  return String(value);
}

function rule(width) {
  return dim('─'.repeat(width));
}

/**
 * The enterprise launch-ready dashboard (Task 7). `rows` is an array of [label, value] pairs;
 * width auto-fits the longest label/value pair (with a floor so short reports don't look cramped).
 * Semantic values (healthy/connected/skipped/failed/...) are colorized automatically via
 * colorizeValue — callers don't need to color their own strings.
 */
export function printDashboard({ title, rows, footer }) {
  const labelWidth = Math.max(...rows.map(([label]) => label.length), 10);
  const valueWidth = Math.max(...rows.map(([, value]) => String(value).length), 10);
  const width = Math.max(labelWidth + valueWidth + 4, title.length + 2, (footer ?? '').length + 2, 50);

  write('log', `\n${rule(width)}`);
  write('log', bold(title));
  write('log', rule(width));
  for (const [label, value] of rows) {
    write('log', `${label.padEnd(labelWidth)}  ${colorizeValue(value)}`);
  }
  write('log', rule(width));
  if (footer) {
    write('log', bold(footer));
    write('log', rule(width));
  }
}

/** Per-stage timing breakdown (Task 10) — `stages` is an array of {name, elapsed} (elapsed is
 *  either a formatted duration string or "Skipped"). */
export function printTimingBreakdown(stages, totalElapsed) {
  write('log', `\n${bold('Timing')}`);
  const nameWidth = Math.max(...stages.map((s) => s.name.length), 8);
  for (const stage of stages) {
    const value = stage.elapsed === 'Skipped' ? yellow('Skipped') : cyan(stage.elapsed);
    write('log', `  ${stage.name.padEnd(nameWidth)}  ${value}`);
  }
  write('log', `  ${'Total'.padEnd(nameWidth)}  ${bold(magenta(totalElapsed))}`);
}
