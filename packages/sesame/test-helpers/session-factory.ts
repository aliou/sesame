/**
 * Factory functions for creating test session data
 */

export interface SessionBuilder {
  withHeader(data?: {
    id?: string;
    cwd?: string;
    timestamp?: string;
  }): SessionBuilder;
  withName(name: string, entry?: EntryOptions): SessionBuilder;
  withUserMessage(text: string, entry?: EntryOptions): SessionBuilder;
  withAssistantMessage(text: string): SessionBuilder;
  withWriteToolCall(path: string, content: string): SessionBuilder;
  withBashToolCall(command: string): SessionBuilder;
  withToolCall(name: string, args: Record<string, unknown>): SessionBuilder;
  withToolResult(
    toolName: string,
    content: string,
    options?: { isError?: boolean },
  ): SessionBuilder;
  withBashExecution(command: string, output: string): SessionBuilder;
  withSkillInvocation(
    name: string,
    path: string,
    options?: { body?: string; details?: Record<string, unknown> | null },
  ): SessionBuilder;
  withCustomMessage(
    customType: string,
    content: string,
    details?: unknown,
  ): SessionBuilder;
  withCompactionSummary(summary: string): SessionBuilder;
  withLabel(targetId: string, label?: string): SessionBuilder;
  build(): string;
}

interface EntryOptions {
  id?: string;
  parentId?: string | null;
  timestamp?: string;
}

export function createSessionBuilder(): SessionBuilder {
  const lines: string[] = [];

  let hasHeader = false;

  const builder: SessionBuilder = {
    withHeader(data = {}) {
      const header = {
        type: "session",
        version: 3,
        id: data.id ?? "test-session",
        timestamp: data.timestamp ?? new Date().toISOString(),
        cwd: data.cwd,
      };
      lines.push(JSON.stringify(header));
      hasHeader = true;
      return this;
    },

    withName(name: string, entry = {}) {
      lines.push(JSON.stringify({ type: "session_info", name, ...entry }));
      return this;
    },

    withUserMessage(text: string, entry = {}) {
      lines.push(
        JSON.stringify({
          type: "message",
          ...entry,
          message: {
            role: "user",
            content: [{ type: "text", text }],
          },
        }),
      );
      return this;
    },

    withAssistantMessage(text: string) {
      lines.push(
        JSON.stringify({
          type: "message",
          message: {
            role: "assistant",
            content: [{ type: "text", text }],
          },
        }),
      );
      return this;
    },

    withWriteToolCall(path: string, content: string) {
      lines.push(
        JSON.stringify({
          type: "message",
          message: {
            role: "assistant",
            content: [
              {
                type: "toolCall",
                id: "tc_1",
                name: "Write",
                arguments: { path, content },
              },
            ],
          },
        }),
      );
      return this;
    },

    withBashToolCall(command: string) {
      lines.push(
        JSON.stringify({
          type: "message",
          message: {
            role: "assistant",
            content: [
              {
                type: "toolCall",
                id: "tc_1",
                name: "Bash",
                arguments: { command },
              },
            ],
          },
        }),
      );
      return this;
    },

    withToolCall(name: string, args: Record<string, unknown>) {
      lines.push(
        JSON.stringify({
          type: "message",
          message: {
            role: "assistant",
            content: [
              {
                type: "toolCall",
                id: "tc_1",
                name,
                arguments: args,
              },
            ],
          },
        }),
      );
      return this;
    },

    withToolResult(
      toolName: string,
      content: string,
      options?: { isError?: boolean },
    ) {
      lines.push(
        JSON.stringify({
          type: "message",
          message: {
            role: "toolResult",
            toolCallId: "tc_1",
            toolName,
            isError: options?.isError ?? false,
            content: [{ type: "text", text: content }],
          },
        }),
      );
      return this;
    },

    withBashExecution(command: string, output: string) {
      lines.push(
        JSON.stringify({
          type: "message",
          message: {
            role: "bashExecution",
            command,
            output,
            exitCode: 0,
          },
        }),
      );
      return this;
    },

    withSkillInvocation(name, path, options = {}) {
      const body = options.body ?? `# ${name}\n\nSkill body.`;
      const content = `<skill name="${name}" location="${path}">\nReferences are relative to ${path.replace(/\/SKILL\.md$/, "")}.\n\n${body}\n</skill>`;
      const details =
        options.details === undefined ? { name, path } : options.details;
      return builder.withCustomMessage(
        "skill-invocation",
        content,
        details ?? undefined,
      );
    },

    withCustomMessage(customType, content, details) {
      lines.push(
        JSON.stringify({
          type: "custom_message",
          customType,
          content,
          display: true,
          details,
        }),
      );
      return this;
    },

    withCompactionSummary(summary: string) {
      lines.push(JSON.stringify({ type: "compaction", summary }));
      return this;
    },

    withLabel(targetId: string, label?: string) {
      lines.push(JSON.stringify({ type: "label", targetId, label }));
      return this;
    },

    build() {
      if (!hasHeader) {
        // Auto-add header if not explicitly set
        builder.withHeader();
      }
      return lines.join("\n");
    },
  };

  return builder;
}
