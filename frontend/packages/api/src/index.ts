export type { paths, components, operations } from "./schema";

export const API_BASE_URL =
  (typeof import.meta !== "undefined" &&
    (import.meta as { env?: Record<string, string> }).env?.VITE_API_URL) ||
  "http://localhost:8000";
