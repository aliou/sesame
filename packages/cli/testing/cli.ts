import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { vi } from "vitest";

export function cliArgv(...args: string[]): string[] {
  return ["node", "sesame", ...args];
}

/**
 * Capture stdout and stderr. Brocli and tab print through console.log, the
 * CLI through process.stdout.write, so both are captured.
 */
export function captureOutput() {
  const out: string[] = [];
  const err: string[] = [];
  const spies = [
    vi.spyOn(process.stdout, "write").mockImplementation((chunk) => {
      out.push(chunk.toString());
      return true;
    }),
    vi.spyOn(process.stderr, "write").mockImplementation((chunk) => {
      err.push(chunk.toString());
      return true;
    }),
    vi.spyOn(console, "log").mockImplementation((...args) => {
      out.push(`${args.join(" ")}\n`);
    }),
    vi.spyOn(console, "error").mockImplementation((...args) => {
      err.push(`${args.join(" ")}\n`);
    }),
  ];
  return {
    stdout: () => out.join(""),
    stderr: () => err.join(""),
    restore: () => {
      for (const spy of spies) spy.mockRestore();
    },
  };
}

export interface SesameSandbox {
  root: string;
  sessionsDir: string;
  writeSession: (name: string, content: string) => void;
  cleanup: () => void;
}

/** Point Sesame's data and config at a temp directory. */
export function createSesameSandbox(): SesameSandbox {
  const root = mkdtempSync(join(tmpdir(), "sesame-cli-test-"));
  const sessionsDir = join(root, "sessions");
  const configDir = join(root, "config");
  mkdirSync(join(sessionsDir, "project"), { recursive: true });
  mkdirSync(configDir, { recursive: true });
  writeFileSync(
    join(configDir, "config.jsonc"),
    JSON.stringify({ piSessionPaths: [sessionsDir] }),
  );
  const previous = {
    data: process.env.SESAME_DATA_DIR,
    config: process.env.SESAME_CONFIG_DIR,
  };
  process.env.SESAME_DATA_DIR = join(root, "data");
  process.env.SESAME_CONFIG_DIR = configDir;

  return {
    root,
    sessionsDir,
    writeSession: (name, content) =>
      writeFileSync(join(sessionsDir, "project", name), content),
    cleanup: () => {
      restoreEnv("SESAME_DATA_DIR", previous.data);
      restoreEnv("SESAME_CONFIG_DIR", previous.config);
      rmSync(root, { recursive: true, force: true });
    },
  };
}

function restoreEnv(name: string, value: string | undefined): void {
  if (value === undefined) delete process.env[name];
  else process.env[name] = value;
}
