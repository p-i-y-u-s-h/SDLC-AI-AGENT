import { spawn } from "child_process";
import type { CommandSpec, CommandPurpose } from "../schemas/backendExecutionProfileSchema.js";


export interface CommandExecutionResult {
    name: string;
    purpose: CommandPurpose;
    executable: string;
    args: string[];
    exitCode: number;
    stdout: string;
    stderr: string;
    durationMs: number;
    timedOut: boolean;
    success: boolean;
}


const DEFAULT_ALLOWED_EXECUTABLES = new Set([
    "node",
    "npm",
    "npx",
    "pnpm",
    "yarn",
    "tsc",
    "tsx",
    "vitest",
    "jest",
    "drizzle-kit"
]);


export async function runValidationCommand(
    command: CommandSpec,
    cwd: string,
    extraAllowedExecutables: string[] = []
): Promise<CommandExecutionResult> {
    const allowed = new Set([...DEFAULT_ALLOWED_EXECUTABLES, ...extraAllowedExecutables]);
    const executable = command.executable.trim().toLowerCase();

    // Security check: executable must be in allowed list
    if (!allowed.has(executable)) {
        throw new Error(
            `COMMAND_EXECUTION_DISALLOWED: Executable "${command.executable}" is not in the allowed list.`
        );
    }

    // Security check: arguments must not contain raw shell chaining
    for (const arg of command.args) {
        if (/[;&|><`$()]/.test(arg)) {
            throw new Error(
                `COMMAND_EXECUTION_UNSAFE_ARGUMENT: Argument "${arg}" contains dangerous shell characters.`
            );
        }
    }

    const timeoutMs = command.timeoutMs || 120000;
    const startTime = Date.now();

    return new Promise((resolve) => {
        let stdout = "";
        let stderr = "";
        let timedOut = false;

        const child = spawn(command.executable, command.args, {
            cwd,
            shell: process.platform === "win32",
            env: {
                ...process.env,
                CI: "true",
                NODE_ENV: "test"
            }
        });

        const timer = setTimeout(() => {
            timedOut = true;
            child.kill("SIGTERM");
        }, timeoutMs);

        if (child.stdout) {
            child.stdout.on("data", (data) => {
                stdout += data.toString();
            });
        }

        if (child.stderr) {
            child.stderr.on("data", (data) => {
                stderr += data.toString();
            });
        }

        child.on("error", (err) => {
            clearTimeout(timer);
            const durationMs = Date.now() - startTime;
            resolve({
                name: command.name,
                purpose: command.purpose,
                executable: command.executable,
                args: command.args,
                exitCode: 1,
                stdout,
                stderr: stderr + `\nProcess error: ${err.message}`,
                durationMs,
                timedOut,
                success: false
            });
        });

        child.on("close", (code) => {
            clearTimeout(timer);
            const durationMs = Date.now() - startTime;
            const exitCode = code === null ? (timedOut ? 124 : 1) : code;
            resolve({
                name: command.name,
                purpose: command.purpose,
                executable: command.executable,
                args: command.args,
                exitCode,
                stdout,
                stderr,
                durationMs,
                timedOut,
                success: exitCode === 0
            });
        });
    });
}


export async function runValidationSuite(
    commands: CommandSpec[],
    cwd: string,
    allowedExecutables: string[] = []
): Promise<{
    allPassed: boolean;
    results: CommandExecutionResult[];
}> {
    const results: CommandExecutionResult[] = [];

    for (const cmd of commands) {
        console.log(`  ▶ Running validation: ${cmd.name}...`);
        const res = await runValidationCommand(cmd, cwd, allowedExecutables);
        results.push(res);

        if (res.success) {
            console.log(`  ✅ ${cmd.name} passed (${res.durationMs}ms)`);
        } else {
            console.warn(`  ❌ ${cmd.name} failed (exit code: ${res.exitCode})`);
            if (!cmd.optional) {
                return { allPassed: false, results };
            }
        }
    }

    return {
        allPassed: results.every(r => r.success || commands.find(c => c.name === r.name)?.optional),
        results
    };
}
