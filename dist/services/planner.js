function buildPackagePlan(pkg) {
    const registryType = pkg.registryType;
    const transportType = pkg.transport?.type;
    // Key idea:
    // package source (npm/docker/...) is NOT the same as transport/runtime
    // transport tells us HOW the client will talk to it.
    if (transportType === 'stdio') {
        if (registryType === 'npm') {
            if (pkg.environmentVariables) {
                return {
                    kind: 'local-config',
                    summary: `Run npm package "${pkg.identifier}" through npx`,
                    config: {
                        command: 'npx',
                        args: ['-y', pkg.identifier],
                    },
                    requiredEnvVars: pkg.environmentVariables,
                };
            }
            return {
                kind: 'local-config',
                summary: `Run npm package "${pkg.identifier}" through npx`, config: {
                    command: 'npx',
                    args: ['-y', pkg.identifier],
                },
            };
        }
        if (registryType === 'docker') {
            return {
                kind: 'local-config',
                summary: `Run Docker image "${pkg.identifier}" through docker`,
                config: {
                    command: 'docker',
                    args: ['run', '--rm', '-i', pkg.identifier],
                },
            };
        }
        if (registryType === 'pypi') {
            return {
                kind: 'manual',
                summary: `PyPI stdio server "${pkg.identifier}" needs a Python launcher decision`,
                steps: [
                    `Decide how to run "${pkg.identifier}" (for example uvx / pipx / virtualenv).`,
                    'Then generate MCP config with command + args for that launcher.',
                    'Do not assume plain "pip install" is enough.',
                ],
            };
        }
        if (registryType === 'github') {
            return {
                kind: 'manual',
                summary: `GitHub-backed stdio server "${pkg.identifier}" needs repo-specific setup`,
                steps: [
                    `Clone repository: git clone ${pkg.identifier}`,
                    'Read the repository README for build/run instructions.',
                    'Then generate MCP config with the final command + args.',
                ],
            };
        }
        return {
            kind: 'manual',
            summary: `Unsupported stdio package type "${registryType}"`,
            steps: [
                'Inspect registry metadata and repository instructions.',
                'Figure out the launch command for this server.',
                'Then map that launch command into MCP client config.',
            ],
        };
    }
    return {
        kind: 'manual',
        summary: `Package "${pkg.identifier}" uses unsupported or missing transport "${transportType ?? 'unknown'}"`,
        steps: [
            'Inspect registry metadata for supported launch method.',
            'Do not assume package installation alone is sufficient.',
        ],
    };
}
export function createInstallPlan(server) {
    if (server.remotes && server.remotes.length > 0) {
        const remote = server.remotes[0];
        return {
            kind: 'remote-config',
            summary: `Connect to remote ${remote.type.toUpperCase()} server`,
            config: {
                type: remote.type,
                url: remote.url,
            },
        };
    }
    if (server.packages && server.packages.length > 0) {
        return buildPackagePlan(server.packages[0]);
    }
    if (server.repository?.url) {
        return {
            kind: 'manual',
            summary: `Repository exists, but no package/remote shortcut was provided`,
            steps: [
                `Clone repository: git clone ${server.repository.url}`,
                'Read project setup instructions.',
                'Build a final MCP command or remote config from the repo docs.',
            ],
        };
    }
    return {
        kind: 'manual',
        summary: 'No usable install method found',
        steps: [
            'This registry entry does not expose packages, remotes, or repository setup clearly.',
            'Manual inspection is required.',
        ],
    };
}
