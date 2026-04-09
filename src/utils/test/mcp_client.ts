import { spawn } from "child_process";

export class MCPClient {
  private proc;

  constructor(command: string, args: string[]) {
    this.proc = spawn(command, args);
  }

  send(req: any): Promise<any> {
    return new Promise((resolve, reject) => {
      let buffer = "";

      const onData = (data: Buffer) => {
        buffer += data.toString();

        try {
          const json = JSON.parse(buffer);
          this.proc.stdout.off("data", onData);
          resolve(json);
        } catch {
          // wait for full JSON
        }
      };

      this.proc.stdout.on("data", onData);

      this.proc.stdin.write(JSON.stringify(req) + "\n");
    });
  }

  async initialize() {
    const response = await this.send({
      jsonrpc: "2.0",
      id: 0,
      method: "initialize",
      params: {
        protocolVersion: "2025-11-25",
        capabilities: {},
        clientInfo: {
          name: "mcpkgp-test-client",
          version: "0.1.0"
        }
      }
    });

    this.notify({
      jsonrpc: "2.0",
      method: "notifications/initialized"
    });

    return response;
  }

  notify(message: any): void {
    this.proc.stdin.write(JSON.stringify(message) + "\n");
  }

  async listTools() {
    return this.send({
      jsonrpc: "2.0",
      id: 1,
      method: "tools/list",
    });
  }

  async callTool(name: string, args: any) {
    return this.send({
      jsonrpc: "2.0",
      id: 2,
      method: "tools/call",
      params: {
        name,
        arguments: args,
      },
    });
  }
}
