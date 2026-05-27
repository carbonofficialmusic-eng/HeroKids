import { QueryClient, QueryFunction } from "@tanstack/react-query";

export class ApiError extends Error {
  status: number;
  data: any;

  constructor(status: number, data: any) {
    const message = typeof data === 'string' ? data : (data?.message || `HTTP ${status}`);
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.data = data;
  }
}

const DEV_TOKEN_KEY = "__hk_dev_token";

function getDevHeaders(): Record<string, string> {
  if (import.meta.env.DEV) {
    const token = localStorage.getItem(DEV_TOKEN_KEY);
    if (token) return { "X-Dev-Token": token };
  }
  return {};
}

export function storeDevToken(token: string): void {
  localStorage.setItem(DEV_TOKEN_KEY, token);
}

export function clearDevToken(): void {
  localStorage.removeItem(DEV_TOKEN_KEY);
}

async function throwIfResNotOk(res: Response) {
  if (!res.ok) {
    let data: any;
    const contentType = res.headers.get('content-type');
    
    if (contentType?.includes('application/json')) {
      try {
        data = await res.json();
      } catch {
        data = await res.text() || res.statusText;
      }
    } else {
      data = await res.text() || res.statusText;
    }
    
    throw new ApiError(res.status, data);
  }
}

export async function apiRequest(
  method: string,
  url: string,
  data?: unknown | undefined,
): Promise<Response> {
  const res = await fetch(url, {
    method,
    headers: { ...(data ? { "Content-Type": "application/json" } : {}), ...getDevHeaders() },
    body: data ? JSON.stringify(data) : undefined,
    credentials: "include",
  });

  await throwIfResNotOk(res);
  return res;
}

type UnauthorizedBehavior = "returnNull" | "throw";
export const getQueryFn: <T>(options: {
  on401: UnauthorizedBehavior;
}) => QueryFunction<T> =
  ({ on401: unauthorizedBehavior }) =>
  async ({ queryKey }) => {
    const res = await fetch(queryKey.join("/") as string, {
      credentials: "include",
      headers: getDevHeaders(),
    });

    if (unauthorizedBehavior === "returnNull" && res.status === 401) {
      return null;
    }

    await throwIfResNotOk(res);
    return await res.json();
  };

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryFn: getQueryFn({ on401: "throw" }),
      refetchInterval: false,
      refetchOnWindowFocus: false,
      staleTime: 5 * 60 * 1000,
      retry: false,
    },
    mutations: {
      retry: false,
    },
  },
});
