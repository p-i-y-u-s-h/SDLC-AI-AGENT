import fs from "fs";
import path from "path";
import { repairAgent } from "../agent/repairAgent.js";
import { runValidationCommand } from "./validationCommandRunnerService.js";
import { extractJSON, getMessageText } from "../utils/fileManager.js";
import { withProviderRetry } from "../utils/providerRetry.js";
import { recordTokenUsage } from "../utils/tokenTracker.js";
import type { ProjectWorkspace } from "../utils/projectWorkspace.js";
import type { CommandSpec } from "../schemas/backendExecutionProfileSchema.js";


export interface RepairResult {
    success: boolean;
    attempts: number;
    repairedFiles: string[];
}


const MAX_REPAIR_ATTEMPTS = 3;


export async function attemptAutomatedRepair(
    workspace: ProjectWorkspace,
    command: CommandSpec,
    failingOutput: { stdout: string; stderr: string },
    cwd: string,
    allowedExecutables: string[] = []
): Promise<RepairResult> {
    console.log(`\n🔧 Initiating Automated Repair for [${command.name}]...`);

    let currentStderr = failingOutput.stderr;
    let currentStdout = failingOutput.stdout;
    const allRepairedFiles: string[] = [];

    for (let attempt = 1; attempt <= MAX_REPAIR_ATTEMPTS; attempt++) {
        console.log(`  Repair Attempt ${attempt}/${MAX_REPAIR_ATTEMPTS}...`);

        const promptContext = {
            failingCommand: `${command.executable} ${command.args.join(" ")}`,
            stderr: currentStderr.slice(-4000),
            stdout: currentStdout.slice(-2000)
        };

        try {
            const agentResult = await withProviderRetry(
                () => repairAgent.invoke({
                    messages: [
                        {
                            role: "user",
                            content: `Fix the following code errors so the command succeeds.\nDiagnostics:\n${JSON.stringify(promptContext, null, 2)}`
                        }
                    ]
                }),
                { operationName: `Automated Repair Agent (Attempt ${attempt})`, maxAttempts: 2 }
            );

            recordTokenUsage(
                workspace,
                `Automated Repair - Attempt ${attempt}`,
                agentResult,
                process.env.GEMINI_MODEL || "gemini-flash-latest"
            );

            const lastMessage = agentResult.messages[agentResult.messages.length - 1];
            const content = getMessageText(lastMessage.content);
            const parsed = extractJSON(content);

            if (parsed && Array.isArray(parsed.repairedFiles) && parsed.repairedFiles.length > 0) {
                for (const file of parsed.repairedFiles) {
                    const filePath = String(file.path).replace(/^[\\/]+/, "");
                    // Guard against modifying protected files
                    if (filePath.includes("package.json") || filePath.includes(".env")) {
                        continue;
                    }

                    const fullPath = path.join(cwd, filePath);
                    fs.mkdirSync(path.dirname(fullPath), { recursive: true });
                    fs.writeFileSync(fullPath, String(file.content), "utf-8");
                    if (!allRepairedFiles.includes(filePath)) {
                        allRepairedFiles.push(filePath);
                    }
                    console.log(`    Fixed: ${filePath}`);
                }
            }
        } catch (err) {
            console.warn(`    ⚠️ Repair agent failed during attempt ${attempt}: ${err instanceof Error ? err.message : String(err)}`);
        }

        // Re-run the validation command to verify fix
        const retryResult = await runValidationCommand(command, cwd, allowedExecutables);

        if (retryResult.success) {
            console.log(`  ✅ Successfully repaired [${command.name}] on attempt ${attempt}!`);
            return {
                success: true,
                attempts: attempt,
                repairedFiles: allRepairedFiles
            };
        }

        currentStderr = retryResult.stderr;
        currentStdout = retryResult.stdout;
    }

    console.warn(`❌ BACKEND_REPAIR_EXHAUSTED: Could not automatically fix [${command.name}] after ${MAX_REPAIR_ATTEMPTS} attempts.`);
    return {
        success: false,
        attempts: MAX_REPAIR_ATTEMPTS,
        repairedFiles: allRepairedFiles
    };
}
