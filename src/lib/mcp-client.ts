import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { SSEClientTransport } from "@modelcontextprotocol/sdk/client/sse.js";

export interface McpServerConfig {
  name: string;
  url: string;
}

export interface McpTool {
  serverName: string;
  name: string;
  originalName: string;
  description: string;
  inputSchema: any;
}

export class McpClientManager {
  private static instance: McpClientManager | null = null;
  private clients: Record<string, Client> = {};
  private transports: Record<string, SSEClientTransport> = {};
  private toolsCache: McpTool[] = [];
  private isConnected = false;

  private constructor() {}

  public static getInstance(): McpClientManager {
    if (!McpClientManager.instance) {
      McpClientManager.instance = new McpClientManager();
    }
    return McpClientManager.instance;
  }

  /**
   * Parse configuration from MCP_SERVERS env variable.
   * Format: Jira=http://localhost:3010/mcp,Slack=http://localhost:3011/mcp
   */
  private getServersConfig(): McpServerConfig[] {
    const raw = process.env.MCP_SERVERS || "";
    if (!raw) return [];
    return raw.split(",").map((part) => {
      const idx = part.indexOf("=");
      if (idx === -1) return { name: "", url: "" };
      const name = part.substring(0, idx).trim();
      const url = part.substring(idx + 1).trim();
      return { name, url };
    }).filter(s => s.name && s.url);
  }

  public async connectAll(): Promise<void> {
    if (this.isConnected) return;
    const configs = this.getServersConfig();
    console.log(`[MCP Manager] Connecting to ${configs.length} servers:`, configs);

    const connectionPromises = configs.map(async (cfg) => {
      try {
        console.log(`[MCP Manager] Connecting to ${cfg.name} at ${cfg.url}`);
        const transport = new SSEClientTransport(new URL(cfg.url));
        const client = new Client(
          { name: `conversaai-dashboard-${cfg.name}`, version: "1.0.0" },
          { capabilities: {} }
        );

        await client.connect(transport);
        this.clients[cfg.name] = client;
        this.transports[cfg.name] = transport;
        console.log(`[MCP Manager] Connected to ${cfg.name} successfully!`);
      } catch (err) {
        console.error(`[MCP Manager] Failed to connect to ${cfg.name}:`, err);
      }
    });

    await Promise.all(connectionPromises);
    this.isConnected = true;
    await this.refreshToolsCache();
  }

  public async refreshToolsCache(): Promise<void> {
    const cached: McpTool[] = [];
    for (const [serverName, client] of Object.entries(this.clients)) {
      try {
        const response = await client.listTools();
        if (response && response.tools) {
          response.tools.forEach((tool: any) => {
            const cleanServerName = serverName.toLowerCase();
            const namespacedName = tool.name.startsWith(cleanServerName) 
              ? tool.name 
              : `${cleanServerName}_${tool.name}`;

            cached.push({
              serverName,
              name: namespacedName,
              originalName: tool.name,
              description: tool.description || "",
              inputSchema: tool.inputSchema || { type: "object", properties: {} }
            });
          });
        }
      } catch (err) {
        console.error(`[MCP Manager] Error listing tools for ${serverName}:`, err);
      }
    }
    this.toolsCache = cached;
    console.log(`[MCP Manager] Registered ${this.toolsCache.length} tools:`, this.toolsCache.map(t => t.name));
  }

  public getTools(): McpTool[] {
    return this.toolsCache;
  }

  public async callTool(namespacedToolName: string, args: any): Promise<any> {
    const tool = this.toolsCache.find(t => t.name === namespacedToolName);
    if (!tool) {
      throw new Error(`Tool ${namespacedToolName} not found in MCP client cache.`);
    }

    const client = this.clients[tool.serverName];
    if (!client) {
      throw new Error(`MCP Client for server ${tool.serverName} not connected.`);
    }

    console.log(`[MCP Manager] Calling tool ${tool.originalName} on server ${tool.serverName} with args:`, args);
    const result = await client.callTool({
      name: tool.originalName,
      arguments: args
    });

    return result;
  }

  public async disconnectAll(): Promise<void> {
    for (const [name, transport] of Object.entries(this.transports)) {
      try {
        await transport.close();
        console.log(`[MCP Manager] Disconnected from ${name}`);
      } catch (err) {
        console.error(`[MCP Manager] Error closing transport for ${name}:`, err);
      }
    }
    this.clients = {};
    this.transports = {};
    this.toolsCache = [];
    this.isConnected = false;
  }
}
