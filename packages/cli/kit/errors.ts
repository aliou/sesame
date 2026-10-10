// Copied from @378labs/sbx-cli-kit 4.3.0 (homelab/sandbox libraries/cli-kit).

export class CliError extends Error {
  readonly code: string;
  readonly exitCode: number;

  constructor(message: string, code = "CLI_ERROR", exitCode = 1) {
    super(message);
    this.name = "CliError";
    this.code = code;
    this.exitCode = exitCode;
  }
}

export function usageError(message: string, code = "USAGE_ERROR"): CliError {
  return new CliError(message, code, 2);
}

export type NormalizedError = {
  code: string;
  message: string;
  exitCode: number;
};

export type ErrorNormalizer = (error: unknown) => NormalizedError | undefined;

export function printCliError(
  error: unknown,
  options: {
    json: boolean;
    pretty: boolean;
    compact?: boolean;
    defaultCode?: string;
    normalize?: ErrorNormalizer;
  },
): number {
  const normalized = normalizeError(error, options);
  if (options.json) {
    const spacing = options.pretty ? 2 : 0;
    const { exitCode: _exitCode, ...payload } = normalized;
    process.stderr.write(
      `${JSON.stringify({ error: payload }, null, spacing)}\n`,
    );
  } else {
    process.stderr.write(`${normalized.code}: ${normalized.message}\n`);
  }
  return normalized.exitCode;
}

export function normalizeError(
  error: unknown,
  options: { defaultCode?: string; normalize?: ErrorNormalizer } = {},
): NormalizedError {
  const custom = options.normalize?.(error);
  if (custom) return custom;
  if (error instanceof CliError) {
    return {
      code: error.code,
      message: error.message,
      exitCode: error.exitCode,
    };
  }
  if (error instanceof Error) {
    return {
      code: options.defaultCode ?? "CLI_ERROR",
      message: error.message,
      exitCode: 1,
    };
  }
  return {
    code: options.defaultCode ?? "CLI_ERROR",
    message: String(error),
    exitCode: 1,
  };
}
