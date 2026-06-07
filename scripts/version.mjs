import { execSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";

execSync("pnpm exec changeset version", { stdio: "inherit" });

const cliPackage = JSON.parse(readFileSync("packages/cli/package.json", "utf8"));
const version = cliPackage.version;

let flake = readFileSync("flake.nix", "utf8");
flake = flake.replace(/version = "[^"]*";/, `version = "${version}";`);
writeFileSync("flake.nix", flake);

console.log(`Updated flake.nix to sesame CLI v${version}`);
