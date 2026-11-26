#!/usr/bin/env node
// Runs a Python command with whichever interpreter exists (python3, python,
// or the Windows "py -3" launcher). If none is installed the step is skipped
// with a warning instead of failing, so `npm test` works on machines without
// Python; CI (ubuntu-latest) always has python3.
import { spawnSync } from "node:child_process";

const args = process.argv.slice(2);
const candidates = [["python3"], ["python"], ["py", "-3"]];

for (const [cmd, ...pre] of candidates) {
  const probe = spawnSync(cmd, [...pre, "-c", "import sys; sys.exit(0 if sys.version_info >= (3, 9) else 1)"], {
    stdio: "ignore",
    shell: false,
  });
  if (probe.status !== 0) continue;
  const run = spawnSync(cmd, [...pre, "-X", "utf8", ...args], { stdio: "inherit", shell: false });
  process.exit(run.status ?? 1);
}
console.warn("[run-python] No Python 3.9+ interpreter found; skipping: python " + args.join(" "));
process.exit(process.env.CI ? 1 : 0);
