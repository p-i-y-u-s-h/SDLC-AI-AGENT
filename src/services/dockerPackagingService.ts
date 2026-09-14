import fs from "fs";
import path from "path";
import { readJSON } from "../utils/fileManager.js";
import { technologyManifestSchema } from "../schemas/technologyManifestSchema.js";
import type { ProjectWorkspace } from "../utils/projectWorkspace.js";


export interface DockerPackagingResult {
    backendDockerfile: string;
    frontendDockerfile: string;
    dockerCompose: string;
}


export function generateDockerPackaging(
    workspace: ProjectWorkspace
): DockerPackagingResult {
    console.log("\n26. Generating Production Docker Packaging...");

    const manifest = technologyManifestSchema.parse(readJSON(workspace.technologyManifest));
    const projectSlug = workspace.projectSlug;
    const dbEngine = manifest.database.engine.value.toLowerCase();
    const isPostgres = dbEngine.includes("postgres");

    // 1. Backend Dockerfile
    const backendDockerfileContent = `# Multi-stage production Dockerfile for Backend
FROM node:20-alpine AS builder

WORKDIR /app
COPY package*.json tsconfig*.json ./
RUN npm ci --silent
COPY . .
RUN npm run build || tsc

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY package*.json ./
RUN npm ci --only=production --silent
COPY --from=builder /app/dist ./dist

EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \\
  CMD wget --no-verbose --tries=1 --spider http://localhost:3000/health || exit 1

CMD ["node", "dist/server.js"]
`;

    const backendDockerfilePath = path.join(workspace.backendDir, "Dockerfile");
    fs.writeFileSync(backendDockerfilePath, backendDockerfileContent, "utf-8");

    // 2. Frontend Dockerfile
    const frontendDockerfileContent = `# Multi-stage production Dockerfile for Frontend
FROM node:20-alpine AS builder

WORKDIR /app
COPY package*.json ./
RUN npm ci --silent
COPY . .
RUN npm run build

FROM nginx:alpine AS runner
COPY --from=builder /app/dist /usr/share/nginx/html
EXPOSE 80
HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \\
  CMD wget --no-verbose --tries=1 --spider http://localhost:80/ || exit 1

CMD ["nginx", "-g", "daemon off;"]
`;

    const frontendDockerfilePath = path.join(workspace.frontendDir, "Dockerfile");
    fs.writeFileSync(frontendDockerfilePath, frontendDockerfileContent, "utf-8");

    // 3. Root docker-compose.yml
    const dbServiceYaml = isPostgres
        ? `  postgres:
    image: postgres:16-alpine
    container_name: ${projectSlug}-db
    environment:
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: \${DB_PASSWORD:-postgres}
      POSTGRES_DB: \${DB_NAME:-app_db}
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U postgres"]
      interval: 10s
      timeout: 5s
      retries: 5
`
        : "";

    const dockerComposeContent = `version: "3.8"

services:
${dbServiceYaml}
  backend:
    build:
      context: ./generated/backend
      dockerfile: Dockerfile
    container_name: ${projectSlug}-backend
    environment:
      PORT: 3000
      NODE_ENV: production
      DATABASE_URL: postgres://postgres:\${DB_PASSWORD:-postgres}@postgres:5432/\${DB_NAME:-app_db}
    ports:
      - "3000:3000"
    depends_on:
${isPostgres ? "      postgres:\n        condition: service_healthy" : ""}

  frontend:
    build:
      context: ./generated/frontend
      dockerfile: Dockerfile
    container_name: ${projectSlug}-frontend
    ports:
      - "80:80"
    depends_on:
      - backend

${isPostgres ? "volumes:\n  postgres_data:\n" : ""}
`;

    const dockerComposePath = path.join(workspace.root, "docker-compose.yml");
    fs.writeFileSync(dockerComposePath, dockerComposeContent, "utf-8");

    console.log(`✅ Docker Packaging Ready:`);
    console.log(`  + ${backendDockerfilePath}`);
    console.log(`  + ${frontendDockerfilePath}`);
    console.log(`  + ${dockerComposePath}`);

    return {
        backendDockerfile: backendDockerfilePath,
        frontendDockerfile: frontendDockerfilePath,
        dockerCompose: dockerComposePath
    };
}
