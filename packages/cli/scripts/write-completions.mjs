// Regenerate the committed shell completion scripts in <repo>/completions
// from the built CLI. Run `pnpm run build` first.
import { execFileSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const bin = resolve("dist/sesame.cjs");
const outDir = resolve("../../completions");
const files = { bash: "sesame.bash", zsh: "_sesame", fish: "sesame.fish" };

mkdirSync(outDir, { recursive: true });
for (const [shell, name] of Object.entries(files)) {
  const script = execFileSync(process.execPath, [bin, "completion", shell], {
    encoding: "utf8",
  });
  writeFileSync(resolve(outDir, name), script);
}
