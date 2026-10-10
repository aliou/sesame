import pkg from "./package.json" with { type: "json" };

/** CLI version, sourced from packages/cli/package.json. */
export const VERSION: string = pkg.version;
