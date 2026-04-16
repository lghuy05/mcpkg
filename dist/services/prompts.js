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
                message: envVar.description ?? `Enter value for ${envVar.name}`,
                mask: envVar.isSecret ? "*" : undefined,
            }
        ]);
        env[envVar.name] = answer.value;
    }
    return env;
}
export async function promptForInstallQuestions(questions) {
    const answers = {};
    for (const question of questions) {
        const answer = await inquirer.prompt([
            {
                type: question.secret ? "password" : "input",
                name: "value",
                message: question.message,
                mask: question.secret ? "*" : undefined,
                default: question.defaultValue,
                validate: (value) => {
                    if (question.required !== false && !value?.trim()) {
                        return `${question.label} is required`;
                    }
                    return true;
                },
            }
        ]);
        answers[question.key] = answer.value;
    }
    return answers;
}
