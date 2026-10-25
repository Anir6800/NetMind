import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

const apiPaths = ["/health", "/networks", "/ai"];
const apiProxy = Object.fromEntries(apiPaths.map((path) => [path, { target: "http://127.0.0.1:8000", changeOrigin: true, bypass: (request: { headers: Record<string, string | string[] | undefined>; url?: string }) => request.headers.accept?.includes("text/html") ? request.url : undefined }]));

export default defineConfig({ plugins: [react()], server: { host: "127.0.0.1", proxy: apiProxy } });
