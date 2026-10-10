/**
 * sesame completion <shell>. The script itself is printed by
 * handleCompletion before Brocli dispatch; this command exists for help
 * output and argument validation.
 */

import { command, positional } from "@drizzle-team/brocli";
import { printHelpTopic } from "../help-topics";

export const completionCommand = command({
  name: "completion",
  aliases: ["complete"],
  desc: "Print a shell completion script",
  options: {
    shell: positional("shell")
      .enum("bash", "zsh", "fish", "powershell")
      .desc("Shell to configure")
      .required(),
  },
  handler: async () => printHelpTopic("completion"),
});
