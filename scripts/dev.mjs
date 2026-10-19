/**
 * `npm run dev` from the repository root: starts the Express backend
 * (http://localhost:4000) and the Vite frontend (http://localhost:5173) in one
 * terminal. Press Ctrl+C to stop both.
 *
 * Same as running `npm run dev` in backend/ and frontend/ in two terminals.
 */
import { spawn } from 'node:child_process';

const children = ['backend', 'frontend'].map((dir) =>
  // shell: true so `npm` resolves to npm.cmd on Windows.
  spawn('npm', ['--prefix', dir, 'run', 'dev'], { stdio: 'inherit', shell: true }),
);

let stopping = false;
function stopAll(exitCode = 0) {
  if (stopping) return;
  stopping = true;
  for (const child of children) if (child.exitCode === null) child.kill();
  process.exitCode = exitCode;
}

process.on('SIGINT', () => stopAll(0));
process.on('SIGTERM', () => stopAll(0));

// If either server fails to start (e.g. the database is unreachable), stop the other one too.
for (const child of children) {
  child.on('exit', (code) => {
    if (code) stopAll(code);
  });
}
