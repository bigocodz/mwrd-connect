import { API_BASE_URL } from "@mwrd/api";

export class ApiError extends Error {
  status: number;
  detail: string;
  constructor(status: number, detail: string) {
    super(detail);
    this.status = status;
    this.detail = detail;
  }
}

let refreshInFlight: Promise<boolean> | null = null;

async function refreshOnce(): Promise<boolean> {
  refreshInFlight ??= (async () => {
    const r = await fetch(`${API_BASE_URL}/api/auth/refresh`, {
      method: "POST",
      credentials: "include",
    });
    return r.ok;
  })();
  try {
    return await refreshInFlight;
  } finally {
    refreshInFlight = null;
  }
}

export async function api<T>(
  path: string,
  init: Omit<RequestInit, "body"> & { body?: unknown } = {},
  retry = true
): Promise<T> {
  const headers = new Headers(init.headers);
  let body: BodyInit | undefined;
  if (init.body !== undefined) {
    headers.set("Content-Type", "application/json");
    body = JSON.stringify(init.body);
  }

  const res = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    body,
    headers,
    credentials: "include",
  });

  if (res.status === 401 && retry && path !== "/api/auth/refresh") {
    const ok = await refreshOnce();
    if (ok) return api<T>(path, init, false);
  }

  if (!res.ok) {
    let detail = res.statusText;
    try {
      const json = await res.json();
      detail = json.detail ?? detail;
    } catch {
      // not JSON
    }
    throw new ApiError(res.status, detail);
  }

  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}
