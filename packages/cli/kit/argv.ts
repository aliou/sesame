// Copied from @378labs/sbx-cli-kit 4.3.0 (homelab/sandbox libraries/cli-kit).

export interface RootCommandIndexOptions {
  valueOptions?: Iterable<string>;
  valueOptionPrefixes?: Iterable<string>;
  booleanOptions?: Iterable<string>;
  booleanValueOptions?: Iterable<string>;
  skipUnknownFlags?: boolean;
}

/** Locate the root command while skipping configured global options. */
export function rootCommandIndex(
  argv: string[],
  options: RootCommandIndexOptions = {},
): number | undefined {
  const valueOptions = new Set(options.valueOptions ?? ["--output", "-o"]);
  const valueOptionPrefixes = [
    ...(options.valueOptionPrefixes ?? ["--output=", "-o="]),
  ];
  const booleanOptions = new Set(options.booleanOptions ?? []);
  const booleanValueOptions = new Set(options.booleanValueOptions ?? []);
  for (let index = 2; index < argv.length; index++) {
    const arg = argv[index];
    if (arg === "--") return index + 1 < argv.length ? index + 1 : undefined;
    if (valueOptions.has(arg)) {
      index += 1;
      continue;
    }
    if (valueOptionPrefixes.some((prefix) => arg.startsWith(prefix))) {
      continue;
    }
    if (booleanOptions.has(arg)) continue;
    if (booleanValueOptions.has(arg)) continue;
    if (arg.startsWith("-") && options.skipUnknownFlags !== false) continue;
    return index;
  }
  return undefined;
}
