export type RegistryType = 'npm' | 'pypi' | 'docker' | 'github' | string;
export type TransportType = 'stdio' | 'sse' | string;

export interface McpTransport {
  type: TransportType;
}

export interface McpPackage {
  registryType: RegistryType;
  identifier: string;
  version?: string;
  transport?: McpTransport;
}

export interface McpRemote {
  type: string;
  url: string;
}

export interface McpRepository {
  url: string;
  source?: string;
}

export interface McpServer {
  id?: string;
  name: string;
  description?: string;
  version?: string;
  packages?: McpPackage[];
  remotes?: McpRemote[];
  repository?: McpRepository;
}

export interface RegistryServerEntry {
  server: McpServer;
  _meta?: Record<string, unknown>;
}

export interface RegistrySearchResponse {
  servers: RegistryServerEntry[];
}

export interface LocalCommandConfig {
  command: string;
  args: string[];
}

export interface ProjectMcpConfig {
  mcpServers: Record<string, LocalCommandConfig>;
}

export interface RemoteConfig {
  type: string;
  url: string;
}

export type InstallPlan =
  | {
    kind: 'local-config';
    summary: string;
    config: LocalCommandConfig;
  }
  | {
    kind: 'remote-config';
    summary: string;
    config: RemoteConfig;
  }
  | {
    kind: 'manual';
    summary: string;
    steps: string[];
  };
