import { MCPClient } from "./mcp_client.js";

const client = new MCPClient("npx", [
  "-y",
  "@ai-capabilities-suite/mcp-filesystem"
]);

await client.initialize();
const tools = await client.listTools();
console.log(JSON.stringify(tools, null, 2));
