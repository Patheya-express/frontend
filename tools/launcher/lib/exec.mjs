import spawn from 'cross-spawn';

// cross-spawn (the same library npm/yarn use internally) instead of raw child_process.spawn with
// shell:true — Node's own shell:true + array-args combination is unreliable on Windows (args
// aren't properly escaped; DEP0190 was added specifically to warn about this). cross-spawn
// resolves the real .cmd/.exe shim and quotes arguments correctly without needing a shell at all.

/**
 * Runs a command with output captured (not streamed to the user) — for short, informational
 * commands (`node --version`, `adb devices`, a health-check curl-equivalent). Never rejects on a
 * non-zero exit code; the caller decides what that means (e.g. "tool not installed" vs "no
 * devices connected" are both non-zero exits that aren't this function's failures).
 */
export function runCapture(command, args = [], options = {}) {
  return new Promise((resolve) => {
    const child = spawn(command, args, { cwd: options.cwd, env: options.env ?? process.env });

    let stdout = '';
    let stderr = '';
    child.stdout?.on('data', (chunk) => (stdout += chunk));
    child.stderr?.on('data', (chunk) => (stderr += chunk));

    child.on('error', (error) => {
      // ENOENT etc. — the binary itself doesn't exist. Distinct from "ran and exited non-zero".
      resolve({ code: null, stdout, stderr, error });
    });

    child.on('close', (code) => {
      resolve({ code, stdout, stderr, error: null });
    });
  });
}

/**
 * Runs a command with stdio inherited (the user sees its real-time output) — for long-running or
 * interactive commands (`nx serve`, `cap open android`, `gradlew`). Resolves with the exit code;
 * never rejects, so a failed launch step can be reported with the same guidance-first formatting
 * as every other step instead of an unhandled-rejection stack trace.
 */
export function runInherit(command, args = [], options = {}) {
  return new Promise((resolve) => {
    const child = spawn(command, args, {
      cwd: options.cwd,
      env: options.env ?? process.env,
      stdio: 'inherit',
    });

    child.on('error', (error) => {
      resolve({ code: null, error });
    });

    child.on('close', (code) => {
      resolve({ code, error: null });
    });
  });
}

/**
 * Like runInherit, but also tees stdout/stderr into a buffer the caller can inspect afterwards
 * (e.g. to detect Nx's own "existing outputs match the cache" text for the dashboard's Build
 * Cache row) — the user still sees real-time output exactly as with runInherit; this only adds
 * post-hoc inspection on top, it doesn't change what's streamed or when.
 */
export function runInheritCapture(command, args = [], options = {}) {
  return new Promise((resolve) => {
    const child = spawn(command, args, {
      cwd: options.cwd,
      env: options.env ?? process.env,
      stdio: ['inherit', 'pipe', 'pipe'],
    });

    let combined = '';
    child.stdout?.on('data', (chunk) => {
      combined += chunk;
      process.stdout.write(chunk);
    });
    child.stderr?.on('data', (chunk) => {
      combined += chunk;
      process.stderr.write(chunk);
    });

    child.on('error', (error) => {
      resolve({ code: null, output: combined, error });
    });

    child.on('close', (code) => {
      resolve({ code, output: combined, error: null });
    });
  });
}

/** True if `command` exists on PATH and can actually be invoked (not just "a file with this name
 *  exists somewhere") — spawns it with a harmless flag and checks for ENOENT specifically, rather
 *  than trusting `which`/`where`, which behave differently enough across shells to be unreliable
 *  here. */
export async function commandExists(command, versionFlag = '--version') {
  const result = await runCapture(command, [versionFlag]);
  return result.error === null || result.error.code !== 'ENOENT';
}
