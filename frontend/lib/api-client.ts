export function getApiBaseUrl(): string {
  if (typeof window !== "undefined") {
    const isLocal =
      window.location.hostname === "localhost" ||
      window.location.hostname === "127.0.0.1";
    if (isLocal) {
      return process.env.NEXT_PUBLIC_API_BASE_URL?.trim() || "http://localhost:8000";
    }
    const envUrl = process.env.NEXT_PUBLIC_API_BASE_URL?.trim();
    if (envUrl && envUrl.startsWith("https://") && !envUrl.includes("localhost") && !envUrl.includes("ai-study-assistant-backend")) {
      return envUrl.replace(/\/$/, "");
    }
    return "https://ai-study-assistant-api-jlfj.onrender.com";
  }
  return "https://ai-study-assistant-api-jlfj.onrender.com";
}

interface RequestOptions {
  token?: string;
}

export async function apiGet<T>(path: string, options?: RequestOptions): Promise<T> {
  const baseUrl = getApiBaseUrl();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (options?.token) {
    headers["Authorization"] = `Bearer ${options.token}`;
  }

  const response = await fetch(`${baseUrl}${path}`, { headers });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    const message = errorData.detail ?? `Request failed with status ${response.status}`;
    throw new Error(message);
  }

  return response.json() as Promise<T>;
}

export async function apiPost<T, B = unknown>(
  path: string,
  body: B,
  options?: RequestOptions
): Promise<T> {
  const baseUrl = getApiBaseUrl();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (options?.token) {
    headers["Authorization"] = `Bearer ${options.token}`;
  }

  const response = await fetch(`${baseUrl}${path}`, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    const message = errorData.detail ?? `Request failed with status ${response.status}`;
    throw new Error(message);
  }

  return response.json() as Promise<T>;
}

export async function apiUpload<T>(
  path: string,
  formData: FormData,
  options?: RequestOptions
): Promise<T> {
  const baseUrl = getApiBaseUrl();
  const headers: Record<string, string> = {};
  if (options?.token) {
    headers["Authorization"] = `Bearer ${options.token}`;
  }

  const response = await fetch(`${baseUrl}${path}`, {
    method: "POST",
    headers,
    body: formData,
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    const message = errorData.detail ?? `Upload failed with status ${response.status}`;
    throw new Error(message);
  }

  return response.json() as Promise<T>;
}

export async function apiDelete(path: string, options?: RequestOptions): Promise<void> {
  const baseUrl = getApiBaseUrl();
  const headers: Record<string, string> = {};
  if (options?.token) {
    headers["Authorization"] = `Bearer ${options.token}`;
  }

  const response = await fetch(`${baseUrl}${path}`, {
    method: "DELETE",
    headers,
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    const message = errorData.detail ?? `Delete failed with status ${response.status}`;
    throw new Error(message);
  }
}
