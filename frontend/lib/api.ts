const BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export async function fetchAPI(endpoint: string, options: RequestInit = {}) {
  const token =
    typeof window !== "undefined" ? localStorage.getItem("token") : null;

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string>),
  };

  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const response = await fetch(`${BASE_URL}${endpoint}`, {
    ...options,
    headers,
  });

  if (!response.ok) {
    // Handle 401 Unauthorized - token expired or invalid
    if (response.status === 401) {
      if (typeof window !== "undefined") {
        // Clear authentication data
        localStorage.removeItem("token");
        localStorage.removeItem("username");
        localStorage.removeItem("user_id");

        // Redirect to login page
        window.location.href = "/login";
      }
    }

    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.detail || "API request failed");
  }

  return response.json();
}

// Axios-like wrapper around fetchAPI with generic type support
export const apiClient = {
  get: async <T = any>(url: string, options?: { params?: Record<string, any> }): Promise<{ data: T }> => {
    let finalUrl = url;
    if (options?.params) {
      const searchParams = new URLSearchParams();
      Object.entries(options.params).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          searchParams.append(key, String(value));
        }
      });
      const queryString = searchParams.toString();
      if (queryString) {
        finalUrl = `${url}?${queryString}`;
      }
    }
    const data = await fetchAPI(finalUrl, { method: "GET" });
    return { data };
  },
  post: async <T = any>(url: string, body: any): Promise<{ data: T }> => {
    const data = await fetchAPI(url, {
      method: "POST",
      body: JSON.stringify(body),
    });
    return { data };
  },
  put: async <T = any>(url: string, body: any): Promise<{ data: T }> => {
    const data = await fetchAPI(url, {
      method: "PUT",
      body: JSON.stringify(body),
    });
    return { data };
  },
  patch: async <T = any>(url: string, body: any): Promise<{ data: T }> => {
    const data = await fetchAPI(url, {
      method: "PATCH",
      body: JSON.stringify(body),
    });
    return { data };
  },
  delete: async <T = any>(url: string): Promise<{ data: T }> => {
    const data = await fetchAPI(url, { method: "DELETE" });
    return { data };
  },
};
