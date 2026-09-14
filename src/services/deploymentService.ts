import fs from "fs";
import path from "path";
import type { ProjectWorkspace } from "../utils/projectWorkspace.js";

export interface DeploymentArtifactsResult {
    k8sDir: string;
    manifests: string[];
}

export function generateDeploymentArtifacts(
    workspace: ProjectWorkspace
): DeploymentArtifactsResult {
    console.log("\nGenerating Kubernetes Deployment Manifests...");

    const k8sDir = path.join(workspace.root, "k8s");
    fs.mkdirSync(k8sDir, { recursive: true });

    const slug = workspace.projectSlug;
    const manifests: string[] = [];

    // 1. Namespace
    const namespaceYaml = `apiVersion: v1
kind: Namespace
metadata:
  name: ${slug}
  labels:
    app.kubernetes.io/name: ${slug}
`;
    const nsPath = path.join(k8sDir, "00-namespace.yaml");
    fs.writeFileSync(nsPath, namespaceYaml, "utf-8");
    manifests.push(nsPath);

    // 2. ConfigMap
    const configMapYaml = `apiVersion: v1
kind: ConfigMap
metadata:
  name: ${slug}-config
  namespace: ${slug}
data:
  PORT: "3000"
  NODE_ENV: "production"
  CORS_ORIGIN: "*"
`;
    const cmPath = path.join(k8sDir, "01-configmap.yaml");
    fs.writeFileSync(cmPath, configMapYaml, "utf-8");
    manifests.push(cmPath);

    // 3. Backend Deployment & Service
    const backendYaml = `apiVersion: apps/v1
kind: Deployment
metadata:
  name: ${slug}-backend
  namespace: ${slug}
  labels:
    app.kubernetes.io/name: ${slug}-backend
    app.kubernetes.io/component: backend
spec:
  replicas: 2
  selector:
    matchLabels:
      app.kubernetes.io/name: ${slug}-backend
  template:
    metadata:
      labels:
        app.kubernetes.io/name: ${slug}-backend
        app.kubernetes.io/component: backend
    spec:
      containers:
        - name: backend
          image: ${slug}-backend:latest
          imagePullPolicy: IfNotPresent
          ports:
            - containerPort: 3000
              name: http
          envFrom:
            - configMapRef:
                name: ${slug}-config
          resources:
            requests:
              cpu: "100m"
              memory: "128Mi"
            limits:
              cpu: "500m"
              memory: "512Mi"
          livenessProbe:
            httpGet:
              path: /health
              port: 3000
            initialDelaySeconds: 15
            periodSeconds: 20
          readinessProbe:
            httpGet:
              path: /health
              port: 3000
            initialDelaySeconds: 5
            periodSeconds: 10
---
apiVersion: v1
kind: Service
metadata:
  name: ${slug}-backend
  namespace: ${slug}
  labels:
    app.kubernetes.io/name: ${slug}-backend
spec:
  type: ClusterIP
  ports:
    - port: 3000
      targetPort: 3000
      name: http
  selector:
    app.kubernetes.io/name: ${slug}-backend
`;
    const backendPath = path.join(k8sDir, "02-backend.yaml");
    fs.writeFileSync(backendPath, backendYaml, "utf-8");
    manifests.push(backendPath);

    // 4. Frontend Deployment & Service
    const frontendYaml = `apiVersion: apps/v1
kind: Deployment
metadata:
  name: ${slug}-frontend
  namespace: ${slug}
  labels:
    app.kubernetes.io/name: ${slug}-frontend
    app.kubernetes.io/component: frontend
spec:
  replicas: 2
  selector:
    matchLabels:
      app.kubernetes.io/name: ${slug}-frontend
  template:
    metadata:
      labels:
        app.kubernetes.io/name: ${slug}-frontend
        app.kubernetes.io/component: frontend
    spec:
      containers:
        - name: frontend
          image: ${slug}-frontend:latest
          imagePullPolicy: IfNotPresent
          ports:
            - containerPort: 80
              name: http
          resources:
            requests:
              cpu: "50m"
              memory: "64Mi"
            limits:
              cpu: "250m"
              memory: "256Mi"
          livenessProbe:
            httpGet:
              path: /
              port: 80
            initialDelaySeconds: 10
            periodSeconds: 20
          readinessProbe:
            httpGet:
              path: /
              port: 80
            initialDelaySeconds: 5
            periodSeconds: 10
---
apiVersion: v1
kind: Service
metadata:
  name: ${slug}-frontend
  namespace: ${slug}
  labels:
    app.kubernetes.io/name: ${slug}-frontend
spec:
  type: ClusterIP
  ports:
    - port: 80
      targetPort: 80
      name: http
  selector:
    app.kubernetes.io/name: ${slug}-frontend
`;
    const frontendPath = path.join(k8sDir, "03-frontend.yaml");
    fs.writeFileSync(frontendPath, frontendYaml, "utf-8");
    manifests.push(frontendPath);

    // 5. Ingress
    const ingressYaml = `apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: ${slug}-ingress
  namespace: ${slug}
  annotations:
    nginx.ingress.kubernetes.io/rewrite-target: /
spec:
  rules:
    - http:
        paths:
          - path: /api
            pathType: Prefix
            backend:
              service:
                name: ${slug}-backend
                port:
                  number: 3000
          - path: /
            pathType: Prefix
            backend:
              service:
                name: ${slug}-frontend
                port:
                  number: 80
`;
    const ingressPath = path.join(k8sDir, "04-ingress.yaml");
    fs.writeFileSync(ingressPath, ingressYaml, "utf-8");
    manifests.push(ingressPath);

    // 6. Kustomization
    const kustomizationYaml = `apiVersion: kustomize.config.k8s.io/v1beta1
kind: Kustomization

namespace: ${slug}

resources:
  - 00-namespace.yaml
  - 01-configmap.yaml
  - 02-backend.yaml
  - 03-frontend.yaml
  - 04-ingress.yaml
`;
    const kustomizationPath = path.join(k8sDir, "kustomization.yaml");
    fs.writeFileSync(kustomizationPath, kustomizationYaml, "utf-8");
    manifests.push(kustomizationPath);

    console.log(`✅ Kubernetes Manifests Generated in ${k8sDir}:`);
    for (const manifest of manifests) {
        console.log(`  + ${manifest}`);
    }

    return {
        k8sDir,
        manifests
    };
}
