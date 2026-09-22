const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:8000/api";

export type Role = "manufacturer" | "distributor" | "pharmacy";
export type ApiOptions = RequestInit & { token?: string };

async function request<T>(path: string, options: ApiOptions = {}): Promise<T> {
  const { token, headers, ...init } = options;
  const authToken = token || (typeof window !== "undefined" ? localStorage.getItem("pharma_token") : null);
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
      ...headers,
    },
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => null);
    const errorMsg = errorData?.detail || errorData?.message || `Request failed (${response.status})`;
    throw new Error(errorMsg);
  }

  return response.json();
}

export const api = {
  auth: {
    login: (email: string, password: string, requestedRole: Role) =>
      request<{ token: string; user: { name: string; email: string; role: Role | "hospital" } }>(
        "/auth/login",
        {
          method: "POST",
          body: JSON.stringify({ email, password, role: requestedRole }),
        }
      ),
  },
  batches: {
    mint: (
      payload: {
        batch_id: string;
        medicine_name: string;
        dosage: string;
        manufacture_date: string;
        expiry_date: string;
        price?: number;
      },
      token?: string
    ) =>
      request<{
        success: boolean;
        message: string;
        batchId: string;
        blockHeight: number;
        blockHash: string;
        previousHash: string;
        validator: string;
        timestamp: number;
        verification_code: string;
      }>("/batches/mint", {
        method: "POST",
        body: JSON.stringify(payload),
        token,
      }),
    addDistribution: (payload: { batch_id: string; verification_code: string; price?: number }, token?: string) =>
      request<{
        success: boolean;
        message: string;
        batchId: string;
        blockHeight: number;
        blockHash: string;
        hospital_verification_code: string;
      }>(
        "/batches/distribution",
        {
          method: "POST",
          body: JSON.stringify(payload),
          token,
        }
      ),
    addPurchase: (payload: { batch_id: string; verification_code: string; price?: number }, token?: string) =>
      request<{ success: boolean; message: string; batchId: string; blockHeight: number; blockHash: string }>(
        "/batches/purchase",
        {
          method: "POST",
          body: JSON.stringify(payload),
          token,
        }
      ),
    getVerificationCode: (batchId: string, token?: string) =>
      request<{ batch_id: string; code: string | null; target_stage: string; current_stage: string; is_final: boolean }>(
        `/batches/${encodeURIComponent(batchId)}/verification-code`,
        { token }
      ),
    history: (batchId: string, token?: string) =>
      request<any>(`/batches/${encodeURIComponent(batchId)}/history`, { token }),
    getAll: (token?: string) =>
      request<{ total: number; batches: any[] }>("/query/batches", { token }),
    getById: (batchId: string, token?: string) =>
      request<any>(`/query/batch/${encodeURIComponent(batchId)}`, { token }),
  },
  medicines: {
    search: (query: string, page = 1, limit = 8, token?: string) =>
      request<any>(`/medicines/search?q=${encodeURIComponent(query)}&page=${page}&limit=${limit}`, { token }),
  },
  blockchain: {
    getChain: () =>
      request<{ length: number; is_valid: boolean; chain: any[] }>("/query/chain"),
  },
};

export { API_BASE_URL };
