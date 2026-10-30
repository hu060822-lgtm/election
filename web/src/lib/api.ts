export class ApiError extends Error {
  constructor(public status: number, public code: string, message: string) { super(message); }
}

async function request<T>(method: string, url: string, body?: unknown, isForm = false): Promise<T> {
  let res: Response;
  try {
    res = await fetch(url, {
      method,
      credentials: 'same-origin',
      headers: { 'X-TEW-Client': '1', ...(body && !isForm ? { 'Content-Type': 'application/json' } : {}) },
      body: body ? (isForm ? (body as FormData) : JSON.stringify(body)) : undefined,
    });
  } catch {
    throw new ApiError(0, 'network', '無法連線到伺服器，請檢查網路後重試');
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(res.status, data.error ?? 'error', data.message ?? `請求失敗（${res.status}）`);
  return data as T;
}

export const api = {
  get: <T,>(url: string) => request<T>('GET', url),
  post: <T,>(url: string, body?: unknown) => request<T>('POST', url, body ?? {}),
  put: <T,>(url: string, body?: unknown) => request<T>('PUT', url, body ?? {}),
  patch: <T,>(url: string, body?: unknown) => request<T>('PATCH', url, body ?? {}),
  del: <T,>(url: string) => request<T>('DELETE', url),
  upload: <T,>(url: string, form: FormData) => request<T>('POST', url, form, true),
};
