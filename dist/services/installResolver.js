export function resolveInstallPlan(server, plan, answers = {}, requirements = []) {
    if (plan.kind === 'manual') {
        return {
            kind: 'manual',
            summary: plan.summary,
            questions: [],
            unresolvedReasons: ['This server still needs repo-specific setup logic.'],
            manualSteps: plan.steps,
        };
    }
    const inferredQuestions = requirements.length > 0
        ? requirements.map(toRequirementQuestion)
        : inferQuestions(server, plan);
    const unanswered = inferredQuestions.filter((question) => {
        const value = answers[question.key];
        return question.required !== false && !value?.trim();
    });
    if (unanswered.length > 0) {
        return {
            kind: plan.kind,
            summary: plan.summary,
            questions: unanswered,
            unresolvedReasons: unanswered.map((question) => `${question.label} is required`),
        };
    }
    const config = applyAnswers(plan, answers, requirements);
    return {
        kind: plan.kind,
        summary: plan.summary,
        questions: [],
        unresolvedReasons: [],
        config,
    };
}
function inferQuestions(server, plan) {
    const questions = [];
    const remote = server.remotes?.[0];
    if (plan.kind === 'local-config' && plan.requiredEnvVars) {
        for (const envVar of plan.requiredEnvVars) {
            if (!envVar.isRequired) {
                continue;
            }
            questions.push({
                key: `env:${envVar.name}`,
                label: envVar.name,
                message: envVar.description || `Enter ${envVar.name}`,
                secret: envVar.isSecret,
                required: true,
            });
        }
    }
    if (plan.kind === 'local-config' && plan.packageArguments) {
        plan.packageArguments.forEach((arg, index) => {
            if (!arg.isRequired) {
                return;
            }
            questions.push(toPackageArgumentQuestion(arg, index));
        });
    }
    if (plan.kind === 'remote-config' && remote?.variables) {
        for (const [name, variable] of Object.entries(remote.variables)) {
            if (!variable.isRequired) {
                continue;
            }
            questions.push({
                key: `variable:${name}`,
                label: name,
                message: variable.description || `Enter ${name}`,
                required: true,
                secret: variable.isSecret,
                defaultValue: variable.default,
            });
        }
    }
    if (plan.kind === 'remote-config' && remote?.headers) {
        for (const header of remote.headers) {
            if (!header.isRequired) {
                continue;
            }
            questions.push({
                key: `header:${header.name}`,
                label: header.name,
                message: header.description || `Enter ${header.name}`,
                required: true,
                secret: header.isSecret,
                defaultValue: header.default,
            });
        }
    }
    return dedupeQuestions(questions);
}
function applyAnswers(plan, answers, requirements) {
    if (plan.kind === 'local-config') {
        const config = plan.config;
        const envEntries = Object.entries(answers)
            .filter(([key, value]) => key.startsWith('env:') && value.trim())
            .map(([key, value]) => [key.replace(/^env:/, ''), value]);
        const argEntries = requirements.length > 0
            ? buildRequirementArgs(requirements, answers)
            : buildPackageArgs(plan.packageArguments ?? [], answers);
        return {
            ...config,
            args: [...config.args, ...argEntries],
            env: envEntries.length > 0 ? Object.fromEntries(envEntries) : config.env,
        };
    }
    const config = plan.config;
    const headerEntries = Object.entries(answers)
        .filter(([key, value]) => key.startsWith('header:') && value.trim())
        .map(([key, value]) => [key.replace(/^header:/, ''), value]);
    const url = Object.entries(answers)
        .filter(([key, value]) => key.startsWith('variable:') && value.trim())
        .reduce((currentUrl, [key, value]) => {
        const variableName = key.replace(/^variable:/, '');
        return currentUrl.replaceAll(`{${variableName}}`, value);
    }, config.url);
    return {
        ...config,
        url,
        headers: headerEntries.length > 0 ? Object.fromEntries(headerEntries) : config.headers,
    };
}
function dedupeQuestions(questions) {
    const seen = new Set();
    return questions.filter((question) => {
        if (seen.has(question.key)) {
            return false;
        }
        seen.add(question.key);
        return true;
    });
}
function toPackageArgumentQuestion(arg, index) {
    return {
        key: `pkgarg:${index}:${arg.name}`,
        label: arg.name,
        message: arg.description || `Enter ${arg.name}`,
        required: true,
        secret: arg.isSecret,
        defaultValue: arg.default,
    };
}
function toRequirementQuestion(requirement) {
    const sourceText = requirement.source === 'registry'
        ? ''
        : ` [${requirement.source}/${requirement.confidence}]`;
    return {
        key: requirement.key,
        label: requirement.label,
        message: `${compactPrompt(requirement)}${sourceText}`,
        required: requirement.required,
        secret: requirement.secret,
        defaultValue: requirement.defaultValue,
    };
}
function compactPrompt(requirement) {
    const prompt = requirement.prompt.trim().replace(/\s+/g, ' ');
    if (prompt.length <= 48) {
        return prompt;
    }
    return `Enter ${requirement.label}`;
}
function buildPackageArgs(packageArguments, answers) {
    return packageArguments.flatMap((arg, index) => {
        const value = answers[`pkgarg:${index}:${arg.name}`]?.trim();
        if (!value) {
            return [];
        }
        if (arg.type === 'named') {
            return [`--${arg.name}`, value];
        }
        return [value];
    });
}
function buildRequirementArgs(requirements, answers) {
    const requirementArgs = requirements
        .filter((requirement) => requirement.kind === 'arg')
        .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
        .flatMap((requirement) => {
        const value = answers[requirement.key]?.trim();
        if (!value) {
            return [];
        }
        if (requirement.argType === 'named') {
            return [requirement.flag || `--${requirement.label}`, value];
        }
        return [value];
    });
    const knownArgKeys = new Set(requirements
        .filter((requirement) => requirement.kind === 'arg')
        .map((requirement) => requirement.key));
    const retryArgs = Object.entries(answers)
        .filter(([key, value]) => key.startsWith('arg:') && !knownArgKeys.has(key) && value.trim())
        .map(([, value]) => value.trim());
    return [...requirementArgs, ...retryArgs];
}
