import type { Command } from "@drizzle-team/brocli";
import { completionCommand } from "./completion-cmd";
import { indexCommand } from "./index-cmd";
import { searchCommand } from "./search-cmd";
import { skillsCommand } from "./skills-cmd";
import { statusCommand } from "./status-cmd";
import { watchCommand } from "./watch-cmd";

export const commands: Command[] = [
  searchCommand,
  skillsCommand,
  indexCommand,
  statusCommand,
  watchCommand,
  completionCommand,
];
