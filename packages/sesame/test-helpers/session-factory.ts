/**
 * Factory functions for creating test session data
 */

export interface SessionBuilder {
  withHeader(data?: {
    id?: string;
    cwd?: string;
    timestamp?: string;
  }): SessionBuilder;
  withName(name: string): SessionBuilder;
  withUserMessage(text: string): SessionBuilder;
  withAssistantMessage(text: string): SessionBuilder;
  withWriteToolCall(path: string, content: string): SessionBuilder;
  withBashToolCall(command: string): SessionBuilder;
  withToolResult(
    toolName: string,
    content: string,
    options?: { isError?: boolean },
  ): SessionBuilder;
  withBashExecution(command: string, output: string): SessionBuilder;
  withCompactionSummary(summary: string): SessionBuilder;
  build(): string;
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

    withName(name: string) {
      lines.push(JSON.stringify({ type: "session_info", name }));
      return this;
    },

    withUserMessage(text: string) {
      lines.push(
        JSON.stringify({
          type: "message",
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

    withCompactionSummary(summary: string) {
      lines.push(JSON.stringify({ type: "compaction", summary }));
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
