/**
 * Configuration loading and management
 */

import { join } from "node:path";
import { ensureDir, getXDGPaths } from "./xdg";

export interface SessionSource {
  parser: string;
  path: string;
}

export interface SesameConfig {
  sources: SessionSource[];
}

/**
 * Default configuration
 */
export const DEFAULT_CONFIG: SesameConfig = {
  sources: [
    {
      parser: "pi",
      path: "~/.pi/agent/sessions",
    },
  ],
};

/**
 * Parse JSONC (JSON with comments)
 */
function parseJSONC(text: string): unknown {
  // Remove single-line comments
  let cleaned = text.replace(/\/\/.*$/gm, "");
  // Remove multi-line comments
  cleaned = cleaned.replace(/\/\*[\s\S]*?\*\//g, "");
  return JSON.parse(cleaned);
}

/**
 * Load configuration from config.jsonc
 */
export async function loadConfig(): Promise<SesameConfig> {
  const paths = getXDGPaths();
  const configPath = join(paths.config, "config.jsonc");

  try {
    const file = Bun.file(configPath);
    const text = await file.text();
    const parsed = parseJSONC(text) as Partial<SesameConfig>;

    // Merge with defaults
    return {
      sources: parsed.sources ?? DEFAULT_CONFIG.sources,
    };
  } catch (error) {
    // Config doesn't exist, create it with defaults
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      await ensureDir(paths.config);
      const content = JSON.stringify(DEFAULT_CONFIG, null, 2);
      await Bun.write(configPath, content);
      return DEFAULT_CONFIG;
    }
    throw error;
  }
}

/**
 * Expand ~ in paths
 */
export function expandPath(path: string): string {
  if (path.startsWith("~/")) {
    const home = process.env.HOME || process.env.USERPROFILE;
    if (!home) {
      throw new Error("Could not determine home directory");
    }
    return join(home, path.slice(2));
  }
  return path;
}
