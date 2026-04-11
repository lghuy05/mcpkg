import inquirer from "inquirer";
import { getKind } from "./select.js";
export async function promptUserSelection(entries) {
    const choices = entries.slice(0, 5).map((entry) => {
        const server = entry.server;
        return {
            name: `${server.name} (${getKind(entry)})\n ${server.description ?? 'No description'}`,
            value: entry,
        };
    });
    const answer = await inquirer.prompt([
        {
            type: 'select',
            name: 'selected',
            message: 'Multiple MCP servers found. Choose one:',
            choices,
        },
    ]);
    return answer.selected;
}
export async function promptForEnvVars(requiredEnvVars) {
    const env = {};
    for (const envVar of requiredEnvVars) {
        if (!envVar.isRequired) {
            continue;
        }
        const answer = await inquirer.prompt([
            {
                type: envVar.isSecret ? "password" : "input",
                name: "value",
                message: envVar.description ?? `Enter value for ${envVar.name}`
            }
        ]);
        env[envVar.name] = answer.value;
    }
    return env;
}
