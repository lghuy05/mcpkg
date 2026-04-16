export type RegistryType = 'npm' | 'pypi' | 'docker' | 'github' | string;
export type TransportType = 'stdio' | 'sse' | string;

export interface McpTransport {
  type: TransportType;
}

export interface MetadataPromptOption {
  description?: string;
  isRequired: boolean;
  isSecret?: boolean;
  default?: string;
}

export interface PackageArgument extends MetadataPromptOption {
  format?: string;
  type?: 'named' | 'positional' | string;
  name: string;
}

export interface McpPackage {
  registryType: RegistryType;
  identifier: string;
  version?: string;
  transport?: McpTransport;
  environmentVariables?: EnvironmentVariable[];
  packageArguments?: PackageArgument[];
}

export interface EnvironmentVariable {
  description: string;
  isRequired: boolean;
  format?: string;
  isSecret: boolean;
  name: string;
}

export interface McpRemote {
  type: string;
  url: string;
  variables?: Record<string, MetadataPromptOption & { choices?: string[] }>;
  headers?: Array<MetadataPromptOption & { name: string }>;
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
  env?: Record<string, string>;
}

export interface RemoteConfig {
  type: string;
  url: string;
  headers?: Record<string, string>;
}

export type ClientMcpConfig = LocalCommandConfig | RemoteConfig;

export interface ProjectMcpConfig {
  mcpServers: Record<string, ClientMcpConfig>;
}


export interface ClaudeMcpConfig {
  //other existed component that not even mcpServer
  mcpServers: Record<string, ClientMcpConfig>;
}

export type InstallPlan =
  | {
    kind: 'local-config';
    summary: string;
    config: LocalCommandConfig;
    requiredEnvVars?: EnvironmentVariable[];
    packageArguments?: PackageArgument[];
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

export interface InstallQuestion {
  key: string;
  label: string;
  message: string;
  secret?: boolean;
  required?: boolean;
  defaultValue?: string;
}

export type InstallRequirementKind = 'env' | 'arg' | 'header' | 'variable';
export type InstallRequirementSource = 'registry' | 'readme' | 'agent' | 'log';
export type InstallRequirementConfidence = 'high' | 'medium' | 'low';

export interface InstallRequirement {
  kind: InstallRequirementKind;
  key: string;
  label: string;
  prompt: string;
  source: InstallRequirementSource;
  confidence: InstallRequirementConfidence;
  required: boolean;
  secret?: boolean;
  defaultValue?: string;
  argType?: 'named' | 'positional';
  flag?: string;
  order?: number;
  evidence?: string;
}

export interface InstallResolution {
  kind: 'local-config' | 'remote-config' | 'manual';
  summary: string;
  questions: InstallQuestion[];
  unresolvedReasons: string[];
  config?: ClientMcpConfig;
  manualSteps?: string[];
}

export interface VerificationResult {
  ok: boolean;
  message: string;
  details?: string[];
  exitCode?: number | null;
  stdout?: string;
  stderr?: string;
  failureKind?: InstallFailureKind;
}

export type InstallFailureKind =
  | 'missing_input'
  | 'too_many_arguments'
  | 'invalid_stdio_output'
  | 'invalid_launcher'
  | 'process_not_found'
  | 'timeout'
  | 'remote_unreachable'
  | 'process_exited'
  | 'unknown';
