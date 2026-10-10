// Adapted from sbxctl's global help renderer (homelab/sandbox packages/cli).

import type { GlobalHelpEvent } from "@drizzle-team/brocli";
import { TOPICS } from "./help-topics";

type ProcessedOption = {
  config: {
    name: string;
    aliases: string[];
    type: string;
    description?: string;
    default?: unknown;
    enumVals?: string[];
    isHidden?: boolean;
  };
};

const SECTION_GAP = 3;

/** Render the top-level help for bare `sesame`, `sesame --help`, `sesame help`. */
export function renderGlobalHelp(event: GlobalHelpEvent): string {
  const cliName = event.name;
  const desc = event.description;
  const commands = event.commands.filter((command) => !command.hidden);

  const lines: string[] = [];
  if (desc !== undefined) {
    lines.push(desc);
    lines.push("");
  }
  lines.push("Usage:");
  lines.push(`  ${cliName ? `${cliName} ` : ""}[command]`);
  lines.push(`  ${cliName ? `${cliName} ` : ""}help [command|topic]`);

  if (commands.length > 0) {
    lines.push("");
    lines.push("Available Commands:");
    lines.push(renderCommandList(commands));
  }

  lines.push("");
  lines.push("Examples:");
  lines.push('  sesame search "publish workflow" --after 2w');
  lines.push('  sesame search "*" --cwd ~/code/project --limit 20');
  lines.push("  sesame skills --actor user");
  lines.push('  sesame search "deploy" -o json');
  lines.push("");
  lines.push("Help Topics:");
  lines.push(`  sesame help ${Object.keys(TOPICS).join(" | ")}`);
  lines.push("");
  lines.push("Configuration:");
  lines.push(
    "  ~/.config/sesame/config.jsonc lists session roots. Index: ~/.local/share/sesame/index.sqlite.",
  );
  lines.push("  Details: sesame help config");
  lines.push("");
  lines.push("Streams:");
  lines.push(
    "  Success JSON is stdout. Errors, warnings, prompts, progress, and debug output are stderr.",
  );

  const globals = collectGlobals(event);
  if (globals.length > 0) {
    lines.push("");
    lines.push("Flags:");
    lines.push(renderFlags(globals));
  }

  return lines.join("\n");
}

function renderCommandList(
  commands: {
    name: string;
    aliases?: string[];
    desc?: string;
    shortDesc?: string;
  }[],
): string {
  const padding = SECTION_GAP;
  const maxLength = commands.reduce((max, command) => {
    return Math.max(max, commandName(command).length);
  }, 0);
  const paddedLength = maxLength + padding;
  return commands
    .map((command) => {
      const label = commandName(command).padEnd(paddedLength);
      const text = command.shortDesc ?? command.desc;
      if (!text?.length) return `  ${label}`;
      const [first, ...rest] = text.split("\n");
      const continuation = rest
        .map((line) => `${"".padEnd(paddedLength + 2)}${line}`)
        .join("\n");
      return `  ${label}${first}${continuation ? `\n${continuation}` : ""}`;
    })
    .join("\n");
}

function commandName(command: { name: string; aliases?: string[] }): string {
  if (command.aliases?.length) {
    return [command.name, ...command.aliases].join(", ");
  }
  return command.name;
}

function collectGlobals(event: GlobalHelpEvent): ProcessedOption[] {
  const defaults: ProcessedOption[] = [
    {
      config: {
        name: "--help",
        aliases: ["-h"],
        type: "boolean",
        description: `help${event.name ? ` for ${event.name}` : ""}`,
      },
    },
    {
      config: {
        name: "--version",
        aliases: ["-v"],
        type: "boolean",
        description: `version${event.name ? ` for ${event.name}` : ""}`,
      },
    },
  ];
  const provided = event.globals
    ? (Object.values(event.globals) as ProcessedOption[]).filter(
        (option) => !option.config.isHidden,
      )
    : [];
  return [...defaults, ...provided];
}

function renderFlags(globals: ProcessedOption[]): string {
  const aliasLength = globals.reduce((max, option) => {
    const current =
      option.config.aliases.reduce((sum, alias) => sum + alias.length, 0) +
      (option.config.aliases.length - 1) * 2 +
      1;
    return Math.max(max, current);
  }, 0);
  const paddedAliasLength = aliasLength > 0 ? aliasLength + 1 : 0;
  const nameLength =
    globals.reduce((max, option) => {
      const typeText = optionTypeText(option.config);
      const length =
        typeText.length > 0
          ? option.config.name.length + 1 + typeText.length
          : option.config.name.length;
      return Math.max(max, length);
    }, 0) + SECTION_GAP;
  const preDescPad = paddedAliasLength + nameLength + 2;

  return globals
    .map(({ config: opt }) => {
      const aliasPart = opt.aliases.length ? `${opt.aliases.join(", ")},` : "";
      const typeText = optionTypeText(opt);
      const namePart = `${opt.name}${typeText.length ? ` ${typeText}` : ""}`;
      const descPart = renderOptionDescription(opt, preDescPad);
      return `  ${aliasPart.padEnd(paddedAliasLength)}${namePart.padEnd(nameLength)}${descPart}`;
    })
    .join("\n");
}

function renderOptionDescription(
  opt: ProcessedOption["config"],
  preDescPad: number,
): string {
  if (!opt.description?.length) {
    return opt.default !== undefined
      ? `default: ${JSON.stringify(opt.default)}`
      : "";
  }
  const [first, ...rest] = opt.description.split("\n");
  const def =
    opt.default !== undefined
      ? ` (default: ${JSON.stringify(opt.default)})`
      : "";
  const continuation = rest
    .map((line) => `${"".padEnd(preDescPad)}${line}`)
    .join("\n");
  return [first, continuation].filter(Boolean).join("\n") + def;
}

function optionTypeText(opt: ProcessedOption["config"]): string {
  switch (opt.type) {
    case "boolean":
      return "";
    case "number":
      return "number";
    case "string":
      return opt.enumVals?.length
        ? `[ ${opt.enumVals.join(" | ")} ]`
        : "string";
    default:
      return "";
  }
}
