/**
 * XDG Base Directory Specification utilities
 * https://specifications.freedesktop.org/basedir-spec/latest/
 */

import { homedir } from "node:os";
import { join } from "node:path";

export interface XDGPaths {
  data: string;
  config: string;
  cache: string;
  runtime: string;
}

function expandHome(path: string): string {
  if (path.startsWith("~/")) {
    return join(homedir(), path.slice(2));
  }
  return path;
}

/**
 * Get XDG-compliant directories for Sesame.
 * Respects both XDG_* and SESAME_* environment variables.
 */
export function getXDGPaths(): XDGPaths {
  const home = homedir();
  const isMacOS = process.platform === "darwin";
  const isLinux = process.platform === "linux";

  // Data directory: ~/.local/share/sesame
  const defaultData =
    isMacOS || isLinux ? join(home, ".local", "share") : join(home, ".sesame");
  const dataHome = process.env.SESAME_DATA_DIR
    ? expandHome(process.env.SESAME_DATA_DIR)
    : join(process.env.XDG_DATA_HOME || defaultData, "sesame");

  // Config directory: ~/.config/sesame
  const defaultConfig =
    isMacOS || isLinux ? join(home, ".config") : join(home, ".sesame");
  const configHome = process.env.SESAME_CONFIG_DIR
    ? expandHome(process.env.SESAME_CONFIG_DIR)
    : join(process.env.XDG_CONFIG_HOME || defaultConfig, "sesame");

  // Cache directory: ~/.cache/sesame
  const defaultCache = isMacOS
    ? join(home, "Library", "Caches")
    : isLinux
      ? join(home, ".cache")
      : join(home, ".sesame", "cache");
  const cacheHome = process.env.SESAME_CACHE_DIR
    ? expandHome(process.env.SESAME_CACHE_DIR)
    : join(process.env.XDG_CACHE_HOME || defaultCache, "sesame");

  // Runtime directory: /run/user/$UID (Linux) or /tmp (macOS)
  const defaultRuntime = isLinux
    ? `/run/user/${process.getuid?.() ?? 1000}`
    : "/tmp";
  const runtimeDir = process.env.SESAME_RUNTIME_DIR
    ? expandHome(process.env.SESAME_RUNTIME_DIR)
    : join(process.env.XDG_RUNTIME_DIR || defaultRuntime, "sesame");

  return {
    data: dataHome,
    config: configHome,
    cache: cacheHome,
    runtime: runtimeDir,
  };
}

/**
 * Ensure a directory exists, creating it if necessary.
 */
export async function ensureDir(path: string): Promise<void> {
  try {
    await Bun.write(join(path, ".keep"), "");
  } catch (_error) {
    // Directory might already exist, which is fine
  }
}
