import { readFileSync } from "node:fs";
import type { Command } from "@drizzle-team/brocli";
import { afterEach, describe, expect, test, vi } from "vitest";
import { commands } from "./commands/index";
import { handleCompletion, setSkillChoices } from "./completion";
import { globalOptions } from "./context";

type OptionConfig = { name: string; type: string };

/** Processed command options expose `config`; raw builders expose `_.config`. */
function optionNames(options: Record<string, unknown> | undefined): string[] {
  return Object.values(options ?? {})
    .map((option) => {
      const value = option as { config: unknown; _?: { config: OptionConfig } };
      return value._?.config ?? (value.config as OptionConfig);
    })
    .filter((option) => option.type !== "positional")
    .map((option) => option.name);
}

async function complete(...args: string[]): Promise<string> {
  return captureLog(["complete", "--", ...args]);
}

async function captureLog(args: string[]): Promise<string> {
  const log = vi.spyOn(console, "log").mockImplementation(() => undefined);
  await handleCompletion(["node", "sesame", ...args]);
  const output = log.mock.calls.map(([value]) => String(value)).join("\n");
  log.mockRestore();
  return output;
}

afterEach(() => {
  setSkillChoices([]);
});

describe("completion parity", () => {
  const leaves = (commands as Command[]).flatMap((command) =>
    [command.name, ...(command.aliases ?? [])].map((name) => ({
      name,
      options: [...optionNames(command.options), ...optionNames(globalOptions)],
    })),
  );

  test.each(leaves)("offers every $name option", async ({ name, options }) => {
    const output = await complete(name, "--");
    for (const option of options) expect(output, name).toContain(option);
  });

  test("offers every command", async () => {
    const output = await complete("");
    for (const command of commands) expect(output).toContain(command.name);
  });

  test("value options do not fall back to flag completion", async () => {
    const output = await complete("skills", "--actor", "");
    expect(output).toContain("user");
    expect(output).toContain("agent");
    expect(output).not.toContain("--limit");
  });

  test("offers --arg prefixes from the allowlist", async () => {
    const output = await complete("search", "--arg", "ba");
    expect(output).toContain("bash:command=");
  });

  test("zsh escapes colons in values (patched @bomb.sh/tab)", async () => {
    // Without the patch, `bash:command=` completes to `bash` in zsh.
    const script = await captureLog(["completion", "zsh"]);
    expect(script).toContain("comp=$" + "{comp//:/\\\\:}");
  });

  test.each([
    ["bash", "sesame.bash"],
    ["zsh", "_sesame"],
    ["fish", "sesame.fish"],
  ])("completions/%s matches the generator", async (shell, file) => {
    const committed = readFileSync(
      new URL(`../../completions/${file}`, import.meta.url),
      "utf8",
    );
    const generated = await captureLog(["completion", shell]);
    expect(
      committed,
      "run: pnpm --filter @aliou/sesame-cli run build && pnpm --filter @aliou/sesame-cli run completions",
    ).toBe(`${generated}\n`);
  });

  test("does not bypass unknown leading options", async () => {
    const handled = await handleCompletion([
      "node",
      "sesame",
      "--typo",
      "complete",
      "bash",
    ]);
    expect(handled).toBe(false);
  });
});
