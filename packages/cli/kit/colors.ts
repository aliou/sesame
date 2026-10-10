// Adapted from @378labs/sbx-cli-kit 4.3.0 (homelab/sandbox libraries/cli-kit).
// Uses node:util styleText instead of yoctocolors.

import { styleText } from "node:util";
import { getNoColor } from "./context";

type Style = Parameters<typeof styleText>[0];

export function supportsColor(stream: NodeJS.WriteStream = process.stdout) {
  return (
    stream.isTTY === true &&
    (process.env.NO_COLOR === undefined || process.env.NO_COLOR === "") &&
    process.env.TERM !== "dumb" &&
    !getNoColor()
  );
}

function paint(style: Style, text: string, stream?: NodeJS.WriteStream) {
  if (!supportsColor(stream)) return text;
  return styleText(style, text, { validateStream: false });
}

export function label(text: string): string {
  return paint("dim", text);
}

export function bold(text: string): string {
  return paint("bold", text);
}

export function warn(text: string): string {
  return paint("yellow", text, process.stderr);
}
