const BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export async function fetchAPI(endpoint: string, options: RequestInit = {}) {

    const token = localStorage.getItem("token");

    const headers: Record<string, string> = {
        "Content-Type": "application/json",
        ...(options.headers as Record<string, string>),
    };

    if (token) {
        headers["Authorization"] = `Bearer ${token}`;
    }

    
    const response = await fetch(`${BASE_URL}${endpoint}`,{
        ...options,
        headers,
    });

    if(!response.ok){
        const erroData = await response.json().catch(()=> ({}));
        throw new Error(erroData.detail || "API request failed");
    }

    return response.json();
}