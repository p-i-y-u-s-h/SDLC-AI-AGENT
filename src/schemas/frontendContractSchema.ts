import { z } from "zod";


export const frontendComponentSchema = z.object({
    name: z.string().min(1),
    role: z.enum(["PAGE", "LAYOUT", "FORM", "DISPLAY", "NAVIGATION", "MODAL"]),
    description: z.string().default(""),
    apiOperationsUsed: z.array(z.string()).default([])
});


export const frontendModuleContractSchema = z.object({
    name: z.string().min(1),
    routePath: z.string().min(1),
    responsibility: z.string().default(""),
    components: z.array(frontendComponentSchema).default([]),
    apiGroups: z.array(z.string()).default([])
});


export const frontendContractSchema = z.object({
    projectName: z.string().min(1),
    framework: z.string().min(1),
    language: z.string().min(1),
    styling: z.string().min(1),
    baseUrlEnvVar: z.string().default("VITE_API_URL"),
    modules: z.array(frontendModuleContractSchema).min(1)
});


export type FrontendContract = z.infer<typeof frontendContractSchema>;
export type FrontendModuleContract = z.infer<typeof frontendModuleContractSchema>;
export type FrontendComponent = z.infer<typeof frontendComponentSchema>;
