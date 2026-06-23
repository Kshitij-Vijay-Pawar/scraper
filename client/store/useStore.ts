import { create } from "zustand";

export interface User {
  id: string;
  name: string;
  email: string;
}

export interface ApiKey {
  id: string;
  name: string;
  prefix: string;
  lastUsedAt: string | null;
  lastSearchAt: string | null;
  totalSearches: number;
  totalLeadsScraped: number;
  requestsToday: number;
  lastRequestAt: string | null;
  isActive: boolean;
  createdAt: string;
}

export interface SearchJob {
  id: string;
  userId: string;
  apiKeyId: string | null;
  keyword: string;
  location: string;
  status: "pending" | "running" | "completed" | "failed";
  totalLeads: number;
  scrapedCount: number;
  insertedCount: number;
  duplicateCount: number;
  progress: number;
  createdAt: string;
}

export interface Lead {
  id: string;
  searchId: string;
  name: string;
  phone: string | null;
  email: string | null;
  emails: string[] | null;
  website: string | null;
  address: string | null;
  rating: number | null;
  reviews: number | null;
  latitude: number | null;
  longitude: number | null;
  facebook: string | null;
  instagram: string | null;
  linkedin: string | null;
  twitter: string | null;
  enrichmentStatus: string | null;
  websiteLastChecked: string | null;
  emailSource: string | null;
  socialSource: string | null;
  createdAt: string;
  searchKeyword?: string;
  searchLocation?: string;
}

export interface EnrichmentJobStatus {
  id: string;
  status: "pending" | "running" | "completed" | "failed" | "cancelled";
  progress: number;
  totalLeads: number;
  completedLeads: number;
  failedLeads: number;
  remainingLeads: number;
  currentlyProcessing: number;
}

export interface ApiLog {
  id: string;
  timestamp: string;
  method: string;
  url: string;
  status: number;
  requestBody?: any;
  responseBody?: any;
}

interface AppState {
  token: string | null;
  user: User | null;
  apiKeys: ApiKey[];
  activeApiKey: string | null; // Full raw API key when first created
  selectedApiKeyForTesting: string | null; // Custom key string user wants to test with
  searches: SearchJob[];
  currentSearch: SearchJob | null;
  leads: Lead[];
  logs: ApiLog[];
  isLoading: boolean;
  error: string | null;

  // Actions
  initialize: () => void;
  register: (name: string, email: string, password: string) => Promise<boolean>;
  login: (email: string, password: string) => Promise<boolean>;
  logout: () => void;
  fetchUser: () => Promise<void>;
  fetchApiKeys: () => Promise<void>;
  createApiKey: (name: string) => Promise<string | null>;
  revokeApiKey: (id: string) => Promise<void>;
  fetchSearches: (apiKeyOverride?: string) => Promise<void>;
  startSearch: (keyword: string, location: string, limit: number, apiKeyOverride?: string) => Promise<string | null>;
  fetchSearchStatus: (id: string, apiKeyOverride?: string) => Promise<SearchJob | null>;
  fetchSearchLeads: (id: string, apiKeyOverride?: string) => Promise<void>;
  fetchLeadById: (id: string, apiKeyOverride?: string) => Promise<Lead | null>;
  fetchAllLeads: (apiKeyOverride?: string) => Promise<void>;
  enrichLeadsByIds: (leadIds: string[], force?: boolean) => Promise<string | null>;
  enrichSearch: (searchId: string, force?: boolean) => Promise<string | null>;
  fetchEnrichmentProgress: (jobId: string) => Promise<EnrichmentJobStatus | null>;
  cancelEnrichmentJob: (jobId: string) => Promise<boolean>;
  clearLogs: () => void;
  logRequest: (method: string, url: string, status: number, reqBody?: any, respBody?: any) => void;
}

export const useStore = create<AppState>((set, get) => {
  // Helper to log requests to the dashboard logger
  const logApiCall = (method: string, url: string, status: number, reqBody?: any, respBody?: any) => {
    const newLog: ApiLog = {
      id: Math.random().toString(36).substring(2, 9),
      timestamp: new Date().toLocaleTimeString(),
      method,
      url,
      status,
      requestBody: reqBody,
      responseBody: respBody,
    };
    set((state) => ({ logs: [newLog, ...state.logs].slice(0, 50) })); // keep last 50
  };

  return {
    token: null,
    user: null,
    apiKeys: [],
    activeApiKey: null,
    selectedApiKeyForTesting: null,
    searches: [],
    currentSearch: null,
    leads: [],
    logs: [],
    isLoading: false,
    error: null,

    initialize: () => {
      if (typeof window !== "undefined") {
        const storedToken = localStorage.getItem("token");
        const storedUser = localStorage.getItem("user");
        const storedSelectedKey = localStorage.getItem("selectedApiKeyForTesting");
        set({
          token: storedToken,
          user: storedUser ? JSON.parse(storedUser) : null,
          selectedApiKeyForTesting: storedSelectedKey,
        });
      }
    },

    register: async (name, email, password) => {
      set({ isLoading: true, error: null });
      const reqBody = { name, email, password };
      try {
        const res = await fetch("/api/auth/register", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(reqBody),
        });
        const data = await res.json();
        logApiCall("POST", "/auth/register", res.status, reqBody, data);
        if (res.ok && data.success) {
          set({ isLoading: false });
          return true;
        } else {
          set({ error: data.message || "Registration failed", isLoading: false });
          return false;
        }
      } catch (err: any) {
        logApiCall("POST", "/auth/register", 500, reqBody, { error: err.message });
        set({ error: err.message || "Registration failed", isLoading: false });
        return false;
      }
    },

    login: async (email, password) => {
      set({ isLoading: true, error: null });
      const reqBody = { email, password };
      try {
        const res = await fetch("/api/auth/login", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(reqBody),
        });
        const data = await res.json();
        logApiCall("POST", "/auth/login", res.status, reqBody, data);
        if (res.ok && data.success) {
          const token = data.token;
          if (typeof window !== "undefined") {
            localStorage.setItem("token", token);
          }
          set({ token, isLoading: false });
          await get().fetchUser();
          return true;
        } else {
          set({ error: data.message || "Login failed", isLoading: false });
          return false;
        }
      } catch (err: any) {
        logApiCall("POST", "/auth/login", 500, reqBody, { error: err.message });
        set({ error: err.message || "Login failed", isLoading: false });
        return false;
      }
    },

    logout: () => {
      if (typeof window !== "undefined") {
        localStorage.removeItem("token");
        localStorage.removeItem("user");
        localStorage.removeItem("selectedApiKeyForTesting");
      }
      set({
        token: null,
        user: null,
        apiKeys: [],
        activeApiKey: null,
        selectedApiKeyForTesting: null,
        searches: [],
        currentSearch: null,
        leads: [],
        logs: [],
        error: null,
      });
    },

    fetchUser: async () => {
      const { token } = get();
      if (!token) return;
      try {
        const res = await fetch("/api/auth/me", {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await res.json();
        logApiCall("GET", "/auth/me", res.status, undefined, data);
        if (res.ok) {
          if (typeof window !== "undefined") {
            localStorage.setItem("user", JSON.stringify(data));
          }
          set({ user: data });
        } else {
          if (res.status === 401) {
            get().logout();
          }
        }
      } catch (err: any) {
        logApiCall("GET", "/auth/me", 500, undefined, { error: err.message });
      }
    },

    fetchApiKeys: async () => {
      const { token } = get();
      if (!token) return;
      try {
        const res = await fetch("/api/api-keys", {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await res.json();
        logApiCall("GET", "/api-keys", res.status, undefined, data);
        if (res.ok && Array.isArray(data)) {
          set({ apiKeys: data });
        } else {
          set({ apiKeys: [] });
        }
      } catch (err: any) {
        logApiCall("GET", "/api-keys", 500, undefined, { error: err.message });
        set({ apiKeys: [] });
      }
    },

    createApiKey: async (name) => {
      const { token } = get();
      if (!token) return null;
      const reqBody = { name };
      try {
        const res = await fetch("/api/api-keys", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(reqBody),
        });
        const data = await res.json();
        logApiCall("POST", "/api-keys", res.status, reqBody, data);
        if (res.ok && data.success) {
          set({ activeApiKey: data.apiKey });
          if (typeof window !== "undefined") {
            localStorage.setItem("selectedApiKeyForTesting", data.apiKey);
            set({ selectedApiKeyForTesting: data.apiKey });
          }
          await get().fetchApiKeys();
          return data.apiKey;
        }
        return null;
      } catch (err: any) {
        logApiCall("POST", "/api-keys", 500, reqBody, { error: err.message });
        return null;
      }
    },

    revokeApiKey: async (id) => {
      const { token } = get();
      if (!token) return;
      try {
        const res = await fetch(`/api/api-keys/${id}`, {
          method: "DELETE",
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await res.json();
        logApiCall("DELETE", `/api-keys/${id}`, res.status, undefined, data);
        if (res.ok && data.success) {
          await get().fetchApiKeys();
        }
      } catch (err: any) {
        logApiCall("DELETE", `/api-keys/${id}`, 500, undefined, { error: err.message });
      }
    },

    fetchSearches: async (apiKeyOverride) => {
      const { token, selectedApiKeyForTesting } = get();
      const apiKey = apiKeyOverride || selectedApiKeyForTesting;
      const headers: Record<string, string> = {};

      if (apiKey) {
        headers["x-api-key"] = apiKey;
      } else if (token) {
        headers["Authorization"] = `Bearer ${token}`;
      } else {
        return;
      }

      try {
        const res = await fetch("/api/searches", { headers });
        const data = await res.json();
        logApiCall("GET", "/searches", res.status, undefined, data);
        if (res.ok && data.success) {
          set({ searches: data.searches || [] });
        }
      } catch (err: any) {
        logApiCall("GET", "/searches", 500, undefined, { error: err.message });
      }
    },

    startSearch: async (keyword, location, limit, apiKeyOverride) => {
      const { token, selectedApiKeyForTesting } = get();
      const apiKey = apiKeyOverride || selectedApiKeyForTesting;
      const headers: Record<string, string> = { "Content-Type": "application/json" };

      if (apiKey) {
        headers["x-api-key"] = apiKey;
      } else if (token) {
        headers["Authorization"] = `Bearer ${token}`;
      }

      const reqBody = { keyword, location, limit };
      try {
        const res = await fetch("/api/search", {
          method: "POST",
          headers,
          body: JSON.stringify(reqBody),
        });
        const data = await res.json();
        logApiCall("POST", "/search", res.status, reqBody, data);
        if (res.ok && data.success) {
          const newSearch: SearchJob = {
            id: data.searchId,
            userId: get().user?.id || "",
            apiKeyId: null,
            keyword,
            location,
            status: "pending",
            totalLeads: 0,
            scrapedCount: 0,
            insertedCount: 0,
            duplicateCount: 0,
            progress: 0,
            createdAt: new Date().toISOString(),
          };
          set((state) => ({
            searches: [newSearch, ...state.searches],
            currentSearch: newSearch,
          }));
          return data.searchId;
        }
        return null;
      } catch (err: any) {
        logApiCall("POST", "/search", 500, reqBody, { error: err.message });
        return null;
      }
    },

    fetchSearchStatus: async (id, apiKeyOverride) => {
      const { token, selectedApiKeyForTesting } = get();
      const apiKey = apiKeyOverride || selectedApiKeyForTesting;
      const headers: Record<string, string> = {};

      if (apiKey) {
        headers["x-api-key"] = apiKey;
      } else if (token) {
        headers["Authorization"] = `Bearer ${token}`;
      }

      try {
        const res = await fetch(`/api/search/${id}`, { headers });
        const data = await res.json();
        logApiCall("GET", `/search/${id}`, res.status, undefined, data);
        if (res.ok && data.success) {
          const searchJob = data.search;
          set((state) => ({
            searches: state.searches.map((s) => (s.id === id ? searchJob : s)),
            currentSearch: state.currentSearch?.id === id ? searchJob : state.currentSearch,
          }));
          return searchJob;
        }
        return null;
      } catch (err: any) {
        logApiCall("GET", `/search/${id}`, 500, undefined, { error: err.message });
        return null;
      }
    },

    fetchSearchLeads: async (id, apiKeyOverride) => {
      const { token, selectedApiKeyForTesting } = get();
      const apiKey = apiKeyOverride || selectedApiKeyForTesting;
      const headers: Record<string, string> = {};

      if (apiKey) {
        headers["x-api-key"] = apiKey;
      } else if (token) {
        headers["Authorization"] = `Bearer ${token}`;
      }

      try {
        const res = await fetch(`/api/search/${id}/results`, { headers });
        const data = await res.json();
        logApiCall("GET", `/search/${id}/results`, res.status, undefined, data);
        if (res.ok && data.success) {
          set({ leads: data.leads || [] });
        }
      } catch (err: any) {
        logApiCall("GET", `/search/${id}/results`, 500, undefined, { error: err.message });
      }
    },

    fetchAllLeads: async (apiKeyOverride) => {
      const { token, selectedApiKeyForTesting } = get();
      const apiKey = apiKeyOverride || selectedApiKeyForTesting;
      const headers: Record<string, string> = {};

      if (apiKey) {
        headers["x-api-key"] = apiKey;
      } else if (token) {
        headers["Authorization"] = `Bearer ${token}`;
      }

      try {
        const res = await fetch("/api/leads", { headers });
        const data = await res.json();
        logApiCall("GET", "/leads", res.status, undefined, data);
        if (res.ok && data.success) {
          set({ leads: data.leads || [] });
        }
      } catch (err: any) {
        logApiCall("GET", "/leads", 500, undefined, { error: err.message });
      }
    },

    fetchLeadById: async (id, apiKeyOverride) => {
      const { token, selectedApiKeyForTesting } = get();
      const apiKey = apiKeyOverride || selectedApiKeyForTesting;
      const headers: Record<string, string> = {};

      if (apiKey) {
        headers["x-api-key"] = apiKey;
      } else if (token) {
        headers["Authorization"] = `Bearer ${token}`;
      }

      try {
        const res = await fetch(`/api/proxy/leads/${id}`, { headers });
        const data = await res.json();
        logApiCall("GET", `/leads/${id}`, res.status, undefined, data);
        if (res.ok && data.success) {
          const currentLeads = get().leads;
          const exists = currentLeads.some(l => l.id === id);
          if (exists) {
            set({
              leads: currentLeads.map(l => l.id === id ? data.lead : l)
            });
          } else {
            set({ leads: [...currentLeads, data.lead] });
          }
          return data.lead;
        }
        return null;
      } catch (err: any) {
        logApiCall("GET", `/leads/${id}`, 500, undefined, { error: err.message });
        return null;
      }
    },

    enrichLeadsByIds: async (leadIds, force = false) => {
      const { token, selectedApiKeyForTesting } = get();
      const apiKey = selectedApiKeyForTesting;
      const headers: Record<string, string> = { "Content-Type": "application/json" };

      if (apiKey) {
        headers["x-api-key"] = apiKey;
      } else if (token) {
        headers["Authorization"] = `Bearer ${token}`;
      }

      const reqBody = { leadIds, force };
      try {
        const res = await fetch("/api/proxy/enrich/leads", {
          method: "POST",
          headers,
          body: JSON.stringify(reqBody),
        });
        const data = await res.json();
        logApiCall("POST", "/enrich/leads", res.status, reqBody, data);
        if (res.ok && data.success) {
          return data.jobId;
        }
        return null;
      } catch (err: any) {
        logApiCall("POST", "/enrich/leads", 500, reqBody, { error: err.message });
        return null;
      }
    },

    enrichSearch: async (searchId, force = false) => {
      const { token, selectedApiKeyForTesting } = get();
      const apiKey = selectedApiKeyForTesting;
      const headers: Record<string, string> = { "Content-Type": "application/json" };

      if (apiKey) {
        headers["x-api-key"] = apiKey;
      } else if (token) {
        headers["Authorization"] = `Bearer ${token}`;
      }

      const reqBody = { force };
      try {
        const res = await fetch(`/api/proxy/enrich/search/${searchId}`, {
          method: "POST",
          headers,
          body: JSON.stringify(reqBody),
        });
        const data = await res.json();
        logApiCall("POST", `/enrich/search/${searchId}`, res.status, reqBody, data);
        if (res.ok && data.success) {
          return data.jobId;
        }
        return null;
      } catch (err: any) {
        logApiCall("POST", `/enrich/search/${searchId}`, 500, reqBody, { error: err.message });
        return null;
      }
    },

    fetchEnrichmentProgress: async (jobId) => {
      const { token, selectedApiKeyForTesting } = get();
      const apiKey = selectedApiKeyForTesting;
      const headers: Record<string, string> = {};

      if (apiKey) {
        headers["x-api-key"] = apiKey;
      } else if (token) {
        headers["Authorization"] = `Bearer ${token}`;
      }

      try {
        const res = await fetch(`/api/proxy/enrich/${jobId}`, { headers });
        const data = await res.json();
        logApiCall("GET", `/enrich/${jobId}`, res.status, undefined, data);
        if (res.ok && data.success) {
          return data as EnrichmentJobStatus;
        }
        return null;
      } catch (err: any) {
        logApiCall("GET", `/enrich/${jobId}`, 500, undefined, { error: err.message });
        return null;
      }
    },

    cancelEnrichmentJob: async (jobId) => {
      const { token, selectedApiKeyForTesting } = get();
      const apiKey = selectedApiKeyForTesting;
      const headers: Record<string, string> = {};

      if (apiKey) {
        headers["x-api-key"] = apiKey;
      } else if (token) {
        headers["Authorization"] = `Bearer ${token}`;
      }

      try {
        const res = await fetch(`/api/proxy/enrich/${jobId}`, {
          method: "DELETE",
          headers,
        });
        const data = await res.json();
        logApiCall("DELETE", `/enrich/${jobId}`, res.status, undefined, data);
        return res.ok && data.success;
      } catch (err: any) {
        logApiCall("DELETE", `/enrich/${jobId}`, 500, undefined, { error: err.message });
        return false;
      }
    },

    clearLogs: () => set({ logs: [] }),
    logRequest: (method, url, status, reqBody, respBody) => logApiCall(method, url, status, reqBody, respBody),
  };
});
