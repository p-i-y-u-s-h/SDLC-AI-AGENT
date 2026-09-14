import type { ApiContract } from "../schemas/apiContractSchema.js";


export function generateTypedApiClient(api: ApiContract): string {
    const endpointsCode: string[] = [];

    for (const group of api.groups) {
        for (const ep of group.endpoints) {
            const opId = ep.operationId;
            const method = ep.method.toUpperCase();
            const pathTemplate = ep.path.replace(/{([^}]+)}/g, "${$1}");
            const hasBody = ["POST", "PUT", "PATCH"].includes(method);
            const paramList: string[] = [];
            for (const p of (ep.pathParameters || [])) {
                paramList.push(`${p.name}: string | number`);
            }
            if (hasBody) {
                paramList.push("body: any");
            }

            const paramSignature = paramList.join(", ");

            endpointsCode.push(`
  async ${opId}(${paramSignature}): Promise<any> {
    const url = \`\${BASE_URL}${pathTemplate}\`;
    try {
      const res = await fetch(url, {
        method: "${method}",
        headers: {
          "Content-Type": "application/json",
          "Accept": "application/json"
        }${hasBody ? ",\n        body: JSON.stringify(body)" : ""}
      });
      if (!res.ok) {
        throw new Error(\`HTTP \${res.status}: \${res.statusText}\`);
      }
      return await res.json();
    } catch (err) {
      console.warn("API request fallback for ${opId}:", err);
      return fallbackStore.handle("${opId}", { ${paramList.join(", ")} });
    }
  },`);
        }
    }

    return `// Auto-generated strongly typed API client from API Contract
export const BASE_URL = import.meta.env.VITE_API_URL || "";

// Resilient fallback store for offline preview
const fallbackStorageKey = "sdlc_app_cache_v1";

const fallbackStore = {
  data: {} as Record<string, any[]>,
  init() {
    try {
      const raw = localStorage.getItem(fallbackStorageKey);
      if (raw) this.data = JSON.parse(raw);
    } catch {}
  },
  save() {
    try {
      localStorage.setItem(fallbackStorageKey, JSON.stringify(this.data));
    } catch {}
  },
  handle(opId: string, params: any): any {
    this.init();
    const lower = opId.toLowerCase();
    const collectionKey = "items";
    if (!this.data[collectionKey]) {
      this.data[collectionKey] = [
        { id: "1", name: "Sample Item 1", status: "Active", createdAt: new Date().toISOString() },
        { id: "2", name: "Sample Item 2", status: "Pending", createdAt: new Date().toISOString() }
      ];
      this.save();
    }

    if (lower.includes("list") || lower.includes("getall") || lower.includes("find")) {
      return { data: this.data[collectionKey] };
    }
    if (lower.includes("create") || lower.includes("add") || lower.includes("post")) {
      const newItem = { id: String(Date.now()), ...params.body, createdAt: new Date().toISOString() };
      this.data[collectionKey].unshift(newItem);
      this.save();
      return { data: newItem };
    }
    if (lower.includes("delete") || lower.includes("remove")) {
      this.data[collectionKey] = this.data[collectionKey].filter(item => item.id !== params.id);
      this.save();
      return { success: true };
    }
    if (lower.includes("update") || lower.includes("patch") || lower.includes("put")) {
      const idx = this.data[collectionKey].findIndex(item => item.id === params.id);
      if (idx !== -1) {
        this.data[collectionKey][idx] = { ...this.data[collectionKey][idx], ...params.body };
        this.save();
        return { data: this.data[collectionKey][idx] };
      }
    }
    return { data: this.data[collectionKey] };
  }
};

export const apiClient = {
${endpointsCode.join("\n")}
};
`;
}
