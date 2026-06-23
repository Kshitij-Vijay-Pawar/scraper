"use client";

import React, { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { useStore, SearchJob } from "../../../store/useStore";
import { Search, Loader2, Play, CheckCircle, AlertCircle, RefreshCcw, Database, ExternalLink, Download, FileSpreadsheet, Sparkles, Mail, Phone, Globe, Star, Copy, Check } from "lucide-react";
import ApiLogsConsole from "../../../components/ApiLogsConsole";

export default function ScraperPage() {
  const router = useRouter();
  const {
    currentSearch,
    searches,
    startSearch,
    fetchSearchStatus,
    fetchSearchLeads,
    fetchSearches,
    selectedApiKeyForTesting,
    initialize,
    leads,
    enrichLeads,
  } = useStore();

  const [keyword, setKeyword] = useState("");
  const [location, setLocation] = useState("");
  const [limit, setLimit] = useState(20);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [searchErr, setSearchErr] = useState("");
  const [isEnriching, setIsEnriching] = useState(false);
  const [copiedText, setCopiedText] = useState<string | null>(null);

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedText(text);
    setTimeout(() => setCopiedText(null), 1500);
  };

  const handleEnrich = async () => {
    if (!currentSearch) return;
    setIsEnriching(true);
    const success = await enrichLeads(currentSearch.id);
    setIsEnriching(false);
    if (success) {
      await fetchSearchLeads(currentSearch.id);
    }
  };

  const [isDownloading, setIsDownloading] = useState<string | null>(null);

  const handleDownload = async (type: "csv" | "excel") => {
    if (!currentSearch) return;
    setIsDownloading(type);
    try {
      const { token } = useStore.getState();
      const headers: Record<string, string> = {};
      if (token) headers["Authorization"] = `Bearer ${token}`;

      const res = await fetch(`/api/proxy/export/${type}/${currentSearch.id}`, { headers });
      if (!res.ok) {
        alert("Download failed. Make sure you are authenticated.");
        setIsDownloading(null);
        return;
      }
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `leads.${type === "csv" ? "csv" : "xlsx"}`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error("Download error:", err);
    } finally {
      setIsDownloading(null);
    }
  };

  // Polling ref/tracker
  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    const init = async () => {
      initialize();
      await fetchSearches();
    };
    init();
  }, [initialize, fetchSearches, selectedApiKeyForTesting]);

  // Auto-select latest search on mount if none is active
  useEffect(() => {
    if (searches.length > 0 && !currentSearch) {
      handleSelectSearch(searches[0]);
    }
  }, [searches, currentSearch]);

  // Clean up interval on unmount
  useEffect(() => {
    return () => {
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
      }
    };
  }, []);

  // Poll status if active search is pending or running
  useEffect(() => {
    const isJobActive = currentSearch && (currentSearch.status === "pending" || currentSearch.status === "running");
    if (isJobActive) {
      if (!pollingIntervalRef.current) {
        pollingIntervalRef.current = setInterval(async () => {
          const updated = await fetchSearchStatus(currentSearch.id);
          if (updated && updated.status !== "pending" && updated.status !== "running") {
            if (pollingIntervalRef.current) {
              clearInterval(pollingIntervalRef.current);
              pollingIntervalRef.current = null;
            }
            // Fetch leads when done
            await fetchSearchLeads(currentSearch.id);
            // Refresh history
            await fetchSearches();
          }
        }, 1500); // Poll every 1.5 seconds
      }
    } else {
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
        pollingIntervalRef.current = null;
      }
    }
  }, [currentSearch, fetchSearchStatus, fetchSearchLeads, fetchSearches]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSearchErr("");
    if (!keyword.trim() || !location.trim()) {
      setSearchErr("Please fill in both keyword and location");
      return;
    }

    setIsSubmitting(true);
    const searchId = await startSearch(keyword.trim(), location.trim(), limit);
    setIsSubmitting(false);

    if (searchId) {
      setKeyword("");
      setLocation("");
    } else {
      setSearchErr("Failed to start scraper search. Check API Logs below.");
    }
  };

  const handleSelectSearch = async (search: SearchJob) => {
    // Select this search as current and fetch status/leads
    useStore.setState({ currentSearch: search });
    await fetchSearchStatus(search.id);
    await fetchSearchLeads(search.id);
  };

  const activeTestMode = selectedApiKeyForTesting ? "x-api-key" : "JWT Token";

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Scraper Test Console</h1>
          <p className="text-zinc-400 text-sm mt-1">
            Trigger Google Maps lead generation scraper queries and monitor progress in real-time.
          </p>
        </div>
        <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-zinc-900 border border-zinc-800 text-xs text-zinc-400">
          <span>Auth Mode:</span>
          <span className="font-semibold text-violet-400 font-mono text-[10px]">
            {activeTestMode}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
        {/* Scraper Query Form */}
        <div className="lg:col-span-1 space-y-6">
          <div className="rounded-2xl border border-zinc-800 bg-zinc-900/20 p-6 space-y-4">
            <h3 className="font-bold text-zinc-200 text-sm flex items-center gap-2">
              <Search className="h-4.5 w-4.5 text-violet-400" />
              Configure Query
            </h3>

            <form onSubmit={handleSubmit} className="space-y-4">
              {searchErr && (
                <div className="rounded-lg bg-red-950/40 border border-red-900/50 p-2.5 text-xs text-red-400">
                  {searchErr}
                </div>
              )}

              <div>
                <label className="block text-[10px] font-semibold uppercase tracking-wider text-zinc-500 mb-1.5">
                  Business Keyword
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. dentist, restaurant, gym"
                  className="block w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-2 text-zinc-200 placeholder-zinc-600 focus:border-violet-500 focus:outline-none focus:ring-1 focus:ring-violet-500 text-xs transition-colors"
                  value={keyword}
                  onChange={(e) => setKeyword(e.target.value)}
                />
              </div>

              <div>
                <label className="block text-[10px] font-semibold uppercase tracking-wider text-zinc-500 mb-1.5">
                  Location / City
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Miami, New York, Seattle"
                  className="block w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-2 text-zinc-200 placeholder-zinc-600 focus:border-violet-500 focus:outline-none focus:ring-1 focus:ring-violet-500 text-xs transition-colors"
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                />
              </div>

              <div>
                <label className="block text-[10px] font-semibold uppercase tracking-wider text-zinc-500 mb-1.5">
                  Lead Count Limit
                </label>
                <select
                  className="block w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-2 text-zinc-300 focus:outline-none focus:ring-1 focus:ring-violet-500 text-xs transition-colors"
                  value={limit}
                  onChange={(e) => setLimit(parseInt(e.target.value))}
                >
                  <option value={5}>5 Leads</option>
                  <option value={10}>10 Leads</option>
                  <option value={20}>20 Leads</option>
                  <option value={50}>50 Leads</option>
                  <option value={100}>100 Leads</option>
                </select>
              </div>

              <button
                type="submit"
                disabled={isSubmitting || currentSearch?.status === "pending"}
                className="w-full justify-center flex items-center gap-1.5 rounded-xl bg-violet-600 hover:bg-violet-500 py-2.5 px-3 text-xs font-semibold text-white transition-all duration-200 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSubmitting ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <>
                    <Play className="h-3.5 w-3.5 fill-current" />
                    Start Google Map Scrape
                  </>
                )}
              </button>
            </form>
          </div>

          {/* Search History */}
          <div className="rounded-2xl border border-zinc-800 bg-zinc-900/10 overflow-hidden">
            <div className="px-6 py-4 border-b border-zinc-800 bg-zinc-900/30">
              <h3 className="font-bold text-xs text-zinc-200">Session Scrape History</h3>
            </div>

            {searches.length === 0 ? (
              <div className="p-8 text-center text-zinc-500 text-xs">
                No searches launched yet.
              </div>
            ) : (
              <div className="divide-y divide-zinc-900 max-h-[250px] overflow-y-auto">
                {searches.map((s) => {
                  const isCurrent = currentSearch?.id === s.id;
                  return (
                    <div
                      key={s.id}
                      onClick={() => handleSelectSearch(s)}
                      className={`p-4 flex items-center justify-between cursor-pointer transition-all ${isCurrent
                          ? "bg-violet-600/10 border-l-2 border-violet-500"
                          : "hover:bg-zinc-900/40 border-l-2 border-transparent"
                        }`}
                    >
                      <div className="min-w-0">
                        <p className="text-xs font-bold text-zinc-200 truncate">
                          {s.keyword} in {s.location}
                        </p>
                        <p className="text-[10px] text-zinc-500 mt-0.5">
                          {s.status === "completed"
                            ? `${s.totalLeads} leads found`
                            : s.status === "failed"
                              ? "Failed"
                              : `Running: ${s.progress}%`}
                        </p>
                      </div>
                      <div>
                        {s.status === "completed" && (
                          <CheckCircle className="h-4 w-4 text-emerald-400" />
                        )}
                        {s.status === "failed" && (
                          <AlertCircle className="h-4 w-4 text-red-400" />
                        )}
                        {s.status === "pending" && (
                          <Loader2 className="h-4 w-4 text-violet-400 animate-spin" />
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Live Search Status Tracker */}
        <div className="lg:col-span-2 space-y-6">
          {currentSearch ? (
            <>
              {/* Tracker card */}
              <div className="rounded-2xl border border-zinc-800 bg-zinc-900/10 p-6 space-y-6">
                {/* Job Header */}
                <div className="flex items-start justify-between">
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-violet-400">
                      Active Scraper Job status
                    </span>
                    <h2 className="text-xl font-bold text-white mt-1">
                      {currentSearch.keyword} — {currentSearch.location}
                    </h2>
                    <p className="text-[10px] text-zinc-500 font-mono mt-0.5">ID: {currentSearch.id}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span
                      className={`px-2.5 py-1 rounded-full text-xs font-semibold border ${currentSearch.status === "completed"
                          ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                          : currentSearch.status === "failed"
                            ? "bg-red-500/10 text-red-400 border-red-500/20"
                            : "bg-amber-500/10 text-amber-400 border-amber-500/20"
                        }`}
                    >
                      {currentSearch.status}
                    </span>
                  </div>
                </div>

                {/* Progress Tracker */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs font-semibold">
                    <span className="text-zinc-400">Scrape Progress</span>
                    <span className="text-white font-mono">{currentSearch.progress}%</span>
                  </div>
                  <div className="h-2 w-full rounded-full bg-zinc-850 overflow-hidden border border-zinc-800/40">
                    <div
                      className="h-full bg-gradient-to-r from-violet-600 to-indigo-600 transition-all duration-500 rounded-full"
                      style={{ width: `${currentSearch.progress}%` }}
                    />
                  </div>
                </div>

                {/* Scrape Metrics */}
                <div className="grid grid-cols-2 gap-4 sm:grid-cols-4 pt-2">
                  <div className="bg-zinc-950/60 border border-zinc-800 p-4 rounded-xl text-center space-y-1">
                    <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider">Total Found</span>
                    <p className="text-2xl font-bold text-white font-mono">{currentSearch.totalLeads}</p>
                  </div>
                  <div className="bg-zinc-950/60 border border-zinc-800 p-4 rounded-xl text-center space-y-1">
                    <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider">Scraped (API)</span>
                    <p className="text-2xl font-bold text-white font-mono">{currentSearch.scrapedCount}</p>
                  </div>
                  <div className="bg-zinc-950/60 border border-zinc-800 p-4 rounded-xl text-center space-y-1">
                    <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider">Inserted</span>
                    <p className="text-2xl font-bold text-white font-mono">{currentSearch.insertedCount}</p>
                  </div>
                  <div className="bg-zinc-950/60 border border-zinc-800 p-4 rounded-xl text-center space-y-1">
                    <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider">Duplicates</span>
                    <p className="text-2xl font-bold text-white font-mono">{currentSearch.duplicateCount}</p>
                  </div>
                </div>

                {/* Action buttons */}
                {currentSearch.status === "completed" && (
                  <div className="pt-4 border-t border-zinc-800 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleDownload("csv")}
                        disabled={isDownloading !== null}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-zinc-900 border border-zinc-800 hover:bg-zinc-800 text-[10px] font-semibold text-zinc-300 rounded-lg transition-all cursor-pointer disabled:opacity-50"
                      >
                        {isDownloading === "csv" ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <Download className="h-3.5 w-3.5" />
                        )}
                        CSV
                      </button>
                      <button
                        onClick={() => handleDownload("excel")}
                        disabled={isDownloading !== null}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-violet-600/20 hover:bg-violet-600/30 border border-violet-500/20 text-[10px] font-semibold text-violet-400 rounded-lg transition-all cursor-pointer disabled:opacity-50"
                      >
                        {isDownloading === "excel" ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin text-violet-400" />
                        ) : (
                          <FileSpreadsheet className="h-3.5 w-3.5" />
                        )}
                        Excel
                      </button>
                    </div>
                    <button
                      onClick={() => router.push("/leads")}
                      className="flex items-center gap-1.5 px-4 py-2 bg-violet-600 hover:bg-violet-500 text-xs font-semibold text-white rounded-xl shadow-md shadow-violet-600/10 transition-all cursor-pointer"
                    >
                      Explore Leads Grid
                      <ExternalLink className="h-3.5 w-3.5" />
                    </button>
                  </div>
                )}
              </div>

              {/* Leads List Table Card */}
              <div className="rounded-2xl border border-zinc-800 bg-zinc-900/10 p-6 space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-bold text-sm text-zinc-200">Leads Found ({leads.length})</h3>
                    <p className="text-[10px] text-zinc-500">
                      Real-time lead results for this scrape. Click enrich to query emails and social links.
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    {currentSearch.status === "completed" && (
                      <button
                        onClick={handleEnrich}
                        disabled={isEnriching || leads.length === 0}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-violet-600 hover:bg-violet-500 disabled:opacity-50 text-[10px] font-semibold text-white rounded-lg transition-all cursor-pointer"
                      >
                        {isEnriching ? (
                          <Loader2 className="h-3 w-3 animate-spin" />
                        ) : (
                          <Sparkles className="h-3 w-3" />
                        )}
                        Enrich Leads
                      </button>
                    )}
                    <button
                      onClick={() => fetchSearchLeads(currentSearch.id)}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-zinc-900 border border-zinc-800 hover:bg-zinc-800 text-[10px] font-semibold text-zinc-300 rounded-lg transition-all cursor-pointer"
                    >
                      <RefreshCcw className="h-3 w-3" />
                      Refresh Leads
                    </button>
                  </div>
                </div>

                {leads.length === 0 ? (
                  <div className="p-8 text-center text-zinc-500 text-xs border border-dashed border-zinc-800 rounded-xl">
                    No leads found for this search.
                  </div>
                ) : (
                  <div className="overflow-x-auto border border-zinc-800 rounded-xl bg-zinc-950/40">
                    <table className="w-full text-left text-[11px] border-collapse">
                      <thead>
                        <tr className="border-b border-zinc-800 bg-zinc-900/20 text-zinc-400 font-semibold">
                          <th className="px-4 py-2.5">Business Name</th>
                          <th className="px-4 py-2.5">Rating</th>
                          <th className="px-4 py-2.5">Email</th>
                          <th className="px-4 py-2.5">Phone</th>
                          <th className="px-4 py-2.5">Website</th>
                          <th className="px-4 py-2.5">Social Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-zinc-900 text-zinc-300">
                        {leads.map((lead) => (
                          <tr key={lead.id} className="hover:bg-zinc-900/10 transition-colors">
                            <td className="px-4 py-2.5 font-semibold text-zinc-200 truncate max-w-[150px]" title={lead.name}>
                              {lead.name}
                            </td>
                            <td className="px-4 py-2.5">
                              {lead.rating ? (
                                <div className="flex items-center gap-0.5 font-mono text-zinc-300">
                                  <Star className="h-3 w-3 fill-amber-400 text-amber-450" />
                                  <span>{lead.rating}</span>
                                </div>
                              ) : (
                                <span className="text-zinc-655">—</span>
                              )}
                            </td>
                            <td className="px-4 py-2.5">
                              {lead.email ? (
                                <div className="flex items-center gap-1">
                                  <Mail className="h-3 w-3 text-zinc-500" />
                                  <span className="truncate max-w-[100px]" title={lead.email}>{lead.email}</span>
                                  <button
                                    onClick={() => handleCopy(lead.email!)}
                                    className="p-0.5 rounded hover:bg-zinc-800 text-zinc-500 hover:text-white transition-colors cursor-pointer"
                                  >
                                    {copiedText === lead.email ? (
                                      <Check className="h-2.5 w-2.5 text-emerald-450" />
                                    ) : (
                                      <Copy className="h-2.5 w-2.5" />
                                    )}
                                  </button>
                                </div>
                              ) : lead.enrichmentStatus === "pending" ? (
                                <span className="text-amber-400 animate-pulse text-[10px]">enriching...</span>
                              ) : (
                                <span className="text-zinc-600">None</span>
                              )}
                            </td>
                            <td className="px-4 py-2.5 font-mono text-zinc-400">
                              {lead.phone || <span className="text-zinc-650">—</span>}
                            </td>
                            <td className="px-4 py-2.5">
                              {lead.website ? (
                                <a
                                  href={lead.website}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="flex items-center gap-0.5 text-violet-400 hover:text-violet-300 transition-colors"
                                >
                                  <Globe className="h-3 w-3" />
                                  <span className="truncate max-w-[100px]">{lead.website.replace(/https?:\/\/(www\.)?/, "")}</span>
                                  <ExternalLink className="h-2.5 w-2.5" />
                                </a>
                              ) : (
                                <span className="text-zinc-600">—</span>
                              )}
                            </td>
                            <td className="px-4 py-2.5">
                              {lead.facebook ? (
                                <a
                                  href={lead.facebook}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="text-[9px] px-1.5 py-0.5 rounded bg-blue-500/10 text-blue-400 border border-blue-500/20 hover:bg-blue-500/20 transition-all font-semibold inline-flex items-center gap-0.5"
                                >
                                  Facebook
                                  <ExternalLink className="h-2 w-2" />
                                </a>
                              ) : lead.enrichmentStatus === "completed" ? (
                                <span className="text-[9px] text-zinc-500 bg-zinc-900 border border-zinc-800 px-1.5 py-0.5 rounded font-medium">
                                  Checked
                                </span>
                              ) : (
                                <span className="text-zinc-600">—</span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </>
          ) : (
            <div className="rounded-2xl border border-dashed border-zinc-800 bg-zinc-900/5 p-12 text-center flex flex-col items-center justify-center h-full min-h-[300px]">
              <Search className="h-10 w-10 text-zinc-700 mb-3" />
              <h3 className="text-sm font-semibold text-zinc-400">No Job Selected</h3>
              <p className="text-xs text-zinc-500 max-w-sm mt-1">
                Configure a business keyword and location on the left panel and click start to run the lead scraper.
              </p>
            </div>
          )}
        </div>
      </div>

      <ApiLogsConsole />
    </div>
  );
}
