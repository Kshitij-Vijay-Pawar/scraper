"use client";

import React, { useState, useEffect } from "react";
import { useStore, ApiKey } from "../../../store/useStore";
import { Key, Plus, Trash2, CheckCircle2, Copy, AlertTriangle, Play, HelpCircle } from "lucide-react";
import ApiLogsConsole from "../../../components/ApiLogsConsole";

export default function ApiKeysPage() {
  const {
    apiKeys,
    activeApiKey,
    selectedApiKeyForTesting,
    fetchApiKeys,
    createApiKey,
    revokeApiKey,
    initialize,
  } = useStore();

  const [newKeyName, setNewKeyName] = useState("");
  const [copiedKey, setCopiedKey] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    initialize();
    fetchApiKeys();
  }, [initialize, fetchApiKeys]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newKeyName.trim()) return;
    setIsSubmitting(true);
    await createApiKey(newKeyName);
    setNewKeyName("");
    setIsSubmitting(false);
  };

  const handleCopy = () => {
    if (activeApiKey) {
      navigator.clipboard.writeText(activeApiKey);
      setCopiedKey(true);
      setTimeout(() => setCopiedKey(false), 2000);
    }
  };

  const handleSelectKeyForTesting = (keyString: string | null) => {
    if (typeof window !== "undefined") {
      if (keyString) {
        localStorage.setItem("selectedApiKeyForTesting", keyString);
      } else {
        localStorage.removeItem("selectedApiKeyForTesting");
      }
    }
    useStore.setState({ selectedApiKeyForTesting: keyString });
  };

  const safeApiKeys = Array.isArray(apiKeys) ? apiKeys : [];

  return (
    <div className="space-y-8">
      {/* Page Header */}
      <div>
        <h1 className="text-2xl font-bold text-white">Developer API Keys</h1>
        <p className="text-zinc-400 text-sm mt-1">
          Manage your API secret keys to authenticate direct requests to the Lead Scraper service.
        </p>
      </div>

      {/* Main Grid */}
      <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
        {/* Create Key Card */}
        <div className="lg:col-span-1 space-y-6">
          <div className="rounded-2xl border border-zinc-800 bg-zinc-900/20 p-6 space-y-4">
            <h3 className="font-bold text-zinc-200 text-sm flex items-center gap-2">
              <Plus className="h-4.5 w-4.5 text-violet-400" />
              Generate API Key
            </h3>
            <form onSubmit={handleCreate} className="space-y-4">
              <div>
                <label className="block text-[10px] font-semibold uppercase tracking-wider text-zinc-500 mb-1.5">
                  Key Name / Description
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Production server app"
                  className="block w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-2 text-zinc-200 placeholder-zinc-600 focus:border-violet-500 focus:outline-none focus:ring-1 focus:ring-violet-500 text-xs transition-colors"
                  value={newKeyName}
                  onChange={(e) => setNewKeyName(e.target.value)}
                />
              </div>
              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full justify-center flex items-center gap-1.5 rounded-xl bg-violet-600 hover:bg-violet-500 py-2.5 px-3 text-xs font-semibold text-white transition-all duration-200 cursor-pointer disabled:opacity-50"
              >
                Create API Key
              </button>
            </form>
          </div>

          {/* Testing Context Selector */}
          <div className="rounded-2xl border border-zinc-800 bg-zinc-900/20 p-6 space-y-4">
            <h3 className="font-bold text-zinc-200 text-sm flex items-center gap-2">
              <Key className="h-4.5 w-4.5 text-violet-400" />
              API Test Context
            </h3>
            <p className="text-xs text-zinc-400 leading-relaxed">
              Toggle authentication context. Set an API key as active to perform searches and query results using the key instead of your user session.
            </p>
            <div className="pt-2">
              {selectedApiKeyForTesting ? (
                <button
                  onClick={() => handleSelectKeyForTesting(null)}
                  className="w-full py-2.5 rounded-xl border border-zinc-800 bg-zinc-950 text-zinc-300 hover:bg-zinc-900 hover:text-white transition-all text-xs font-semibold flex items-center justify-center gap-2 cursor-pointer"
                >
                  <Trash2 className="h-4 w-4 text-red-400" />
                  Deactivate Active Testing Key
                </button>
              ) : (
                <div className="text-xs text-center py-2 bg-violet-500/5 border border-violet-500/10 rounded-xl text-violet-400 font-medium">
                  Currently Using Session JWT Auth
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Display New API Key Banner */}
        <div className="lg:col-span-2 space-y-6">
          {activeApiKey && (
            <div className="rounded-2xl border border-emerald-500/20 bg-emerald-950/10 p-6 space-y-4">
              <div className="flex items-center gap-2 text-emerald-400">
                <AlertTriangle className="h-5 w-5" />
                <h3 className="font-bold text-sm">Save your secret API key</h3>
              </div>
              <p className="text-xs text-zinc-400 leading-relaxed">
                For security reasons, this key will only be shown once. Copy it now and save it in a safe place.
              </p>
              <div className="flex items-center gap-2 bg-zinc-950 border border-zinc-800 rounded-xl p-3 font-mono text-xs text-zinc-200">
                <span className="flex-1 select-all break-all">{activeApiKey}</span>
                <button
                  onClick={handleCopy}
                  className="p-2 rounded-lg bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-white transition-colors cursor-pointer"
                >
                  {copiedKey ? (
                    <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                  ) : (
                    <Copy className="h-4 w-4" />
                  )}
                </button>
              </div>
            </div>
          )}

          {/* API Keys Table */}
          <div className="rounded-2xl border border-zinc-800 bg-zinc-900/10 overflow-hidden">
            <div className="px-6 py-4 border-b border-zinc-800 bg-zinc-900/30">
              <h3 className="font-bold text-sm text-zinc-200">Active Access Tokens</h3>
            </div>
            
            {safeApiKeys.length === 0 ? (
              <div className="p-8 text-center text-zinc-500 text-xs">
                No API keys created yet. Generate one on the left panel.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-zinc-800 bg-zinc-900/20 text-zinc-400 font-semibold">
                      <th className="px-6 py-3.5">Name</th>
                      <th className="px-6 py-3.5">Key Prefix</th>
                      <th className="px-6 py-3.5 text-center">Searches</th>
                      <th className="px-6 py-3.5 text-center">Leads</th>
                      <th className="px-6 py-3.5">Last Active</th>
                      <th className="px-6 py-3.5 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-800 text-zinc-300">
                    {safeApiKeys.map((key) => {
                      const isCurrentTestKey = selectedApiKeyForTesting?.startsWith(key.prefix);
                      return (
                        <tr key={key.id} className={`hover:bg-zinc-900/10 transition-colors ${!key.isActive ? "opacity-50" : ""}`}>
                          <td className="px-6 py-4 font-semibold text-zinc-200">
                            <div className="flex items-center gap-2">
                              {key.name}
                              {isCurrentTestKey && (
                                <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-violet-500/10 text-violet-400 border border-violet-500/20">
                                  Selected
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="px-6 py-4 font-mono text-zinc-400">{key.prefix}••••••••</td>
                          <td className="px-6 py-4 text-center font-mono">{key.totalSearches}</td>
                          <td className="px-6 py-4 text-center font-mono">{key.totalLeadsScraped}</td>
                          <td className="px-6 py-4 text-zinc-500">
                            {key.lastRequestAt ? new Date(key.lastRequestAt).toLocaleDateString() : "Never"}
                          </td>
                          <td className="px-6 py-4 text-right">
                            <div className="flex items-center justify-end gap-2">
                              {key.isActive && activeApiKey && activeApiKey.startsWith(key.prefix) && (
                                <button
                                  onClick={() => handleSelectKeyForTesting(activeApiKey)}
                                  className="text-[10px] font-semibold text-violet-400 hover:text-violet-300 bg-violet-500/5 hover:bg-violet-500/10 border border-violet-500/10 hover:border-violet-500/20 px-2 py-1 rounded-lg transition-colors cursor-pointer"
                                >
                                  Select for Testing
                                </button>
                              )}
                              <button
                                onClick={() => revokeApiKey(key.id)}
                                className="text-zinc-500 hover:text-red-400 p-1.5 rounded-lg hover:bg-red-950/20 border border-transparent hover:border-red-900/20 transition-all cursor-pointer"
                                title="Revoke Key"
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>

      <ApiLogsConsole />
    </div>
  );
}
