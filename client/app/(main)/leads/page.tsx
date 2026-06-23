"use client";

import React, { useState, useEffect } from "react";
import { useStore, Lead, SearchJob } from "../../../store/useStore";
import {
  Users,
  Search,
  Download,
  ExternalLink,
  Mail,
  Phone,
  Globe,
  MapPin,
  Star,
  Copy,
  Check,
  ChevronLeft,
  ChevronRight,
  RefreshCw,
  FileSpreadsheet,
  Loader2,
} from "lucide-react";
import ApiLogsConsole from "../../../components/ApiLogsConsole";

export default function LeadsPage() {
  const {
    leads,
    searches,
    currentSearch,
    fetchAllLeads,
    fetchSearchLeads,
    initialize,
  } = useStore();

  const [searchTerm, setSearchTerm] = useState("");
  const [selectedSearchId, setSelectedSearchId] = useState<string>("all");
  const [copiedText, setCopiedText] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // Pagination states
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  const [isDownloading, setIsDownloading] = useState<string | null>(null);

  const handleDownload = async (type: "csv" | "excel") => {
    if (selectedSearchId === "all") return;
    setIsDownloading(type);
    try {
      const { token } = useStore.getState();
      const headers: Record<string, string> = {};
      if (token) headers["Authorization"] = `Bearer ${token}`;

      const res = await fetch(`/api/proxy/export/${type}/${selectedSearchId}`, { headers });
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

  useEffect(() => {
    initialize();
    loadLeads();
  }, [initialize]);

  const loadLeads = async () => {
    setIsLoading(true);
    if (selectedSearchId === "all") {
      await fetchAllLeads();
    } else {
      await fetchSearchLeads(selectedSearchId);
    }
    setIsLoading(false);
    setCurrentPage(1);
  };

  useEffect(() => {
    loadLeads();
  }, [selectedSearchId]);

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedText(text);
    setTimeout(() => setCopiedText(null), 1500);
  };

  // Filter leads based on search term
  const filteredLeads = leads.filter((lead) => {
    const term = searchTerm.toLowerCase();
    return (
      lead.name.toLowerCase().includes(term) ||
      (lead.email && lead.email.toLowerCase().includes(term)) ||
      (lead.phone && lead.phone.includes(term)) ||
      (lead.website && lead.website.toLowerCase().includes(term)) ||
      (lead.address && lead.address.toLowerCase().includes(term))
    );
  });

  // Pagination calculations
  const totalItems = filteredLeads.length;
  const totalPages = Math.ceil(totalItems / itemsPerPage) || 1;
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = Math.min(startIndex + itemsPerPage, totalItems);
  const paginatedLeads = filteredLeads.slice(startIndex, endIndex);

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Leads Database</h1>
          <p className="text-zinc-400 text-sm mt-1">
            Browse, search, and export all the Google Maps scraper lead results you have collected.
          </p>
        </div>

        {/* Export Buttons */}
        {selectedSearchId !== "all" && leads.length > 0 && (
          <div className="flex items-center gap-2">
            <button
              onClick={() => handleDownload("csv")}
              disabled={isDownloading !== null}
              className="flex items-center gap-1.5 px-3.5 py-2 bg-zinc-900 border border-zinc-800 hover:bg-zinc-800 text-xs font-semibold text-zinc-300 rounded-xl transition-all cursor-pointer disabled:opacity-50"
            >
              {isDownloading === "csv" ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Download className="h-3.5 w-3.5" />
              )}
              Export CSV
            </button>
            <button
              onClick={() => handleDownload("excel")}
              disabled={isDownloading !== null}
              className="flex items-center gap-1.5 px-3.5 py-2 bg-violet-600 hover:bg-violet-500 text-xs font-semibold text-white rounded-xl shadow-md shadow-violet-600/10 transition-all cursor-pointer disabled:opacity-50"
            >
              {isDownloading === "excel" ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin text-violet-400" />
              ) : (
                <FileSpreadsheet className="h-3.5 w-3.5" />
              )}
              Export Excel
            </button>
          </div>
        )}
      </div>

      {/* Filters Bar */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center justify-between bg-zinc-900/20 border border-zinc-800 p-4 rounded-2xl">
        <div className="flex-1 max-w-md relative">
          <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-zinc-500">
            <Search className="h-4 w-4" />
          </span>
          <input
            type="text"
            placeholder="Search by name, email, phone, website..."
            className="block w-full rounded-xl border border-zinc-800 bg-zinc-950 pl-10 pr-3 py-2 text-zinc-200 placeholder-zinc-600 focus:border-violet-500 focus:outline-none focus:ring-1 focus:ring-violet-500 text-xs transition-colors"
            value={searchTerm}
            onChange={(e) => {
              setSearchTerm(e.target.value);
              setCurrentPage(1);
            }}
          />
        </div>

        <div className="flex items-center gap-3">
          <label className="text-xs text-zinc-500 shrink-0">Filter by Scrape Run:</label>
          <select
            className="rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-2 text-xs text-zinc-300 focus:outline-none focus:ring-1 focus:ring-violet-500"
            value={selectedSearchId}
            onChange={(e) => setSelectedSearchId(e.target.value)}
          >
            <option value="all">All Scrapes ({leads.length})</option>
            {searches.map((s) => (
              <option key={s.id} value={s.id}>
                {s.keyword} in {s.location} ({new Date(s.createdAt).toLocaleDateString()})
              </option>
            ))}
          </select>

          <button
            onClick={loadLeads}
            disabled={isLoading}
            className="p-2 rounded-xl bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors disabled:opacity-50"
            title="Refresh database"
          >
            <RefreshCw className={`h-4 w-4 ${isLoading ? "animate-spin" : ""}`} />
          </button>
        </div>
      </div>

      {/* Main Grid table */}
      <div className="rounded-2xl border border-zinc-800 bg-zinc-900/10 overflow-hidden">
        {isLoading ? (
          <div className="p-12 text-center text-zinc-400 flex flex-col items-center justify-center gap-2">
            <Loader2 className="h-6 w-6 animate-spin text-violet-500" />
            <span className="text-xs">Fetching leads from proxy...</span>
          </div>
        ) : paginatedLeads.length === 0 ? (
          <div className="p-12 text-center text-zinc-500 text-xs">
            {searchTerm ? "No leads matched your search query." : "No leads found in database."}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-zinc-800 bg-zinc-900/20 text-zinc-400 font-semibold">
                  <th className="px-6 py-4">Business Name</th>
                  <th className="px-6 py-4">Rating</th>
                  <th className="px-6 py-4">Email</th>
                  <th className="px-6 py-4">Phone</th>
                  <th className="px-6 py-4">Website</th>
                  <th className="px-6 py-4">Social Status</th>
                  <th className="px-6 py-4">Location</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800 text-zinc-300">
                {paginatedLeads.map((lead) => (
                  <tr key={lead.id} className="hover:bg-zinc-900/10 transition-colors">
                    <td className="px-6 py-4 font-semibold text-zinc-200">
                      {lead.name}
                    </td>
                    <td className="px-6 py-4">
                      {lead.rating ? (
                        <div className="flex items-center gap-1 font-mono text-zinc-300">
                          <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
                          <span>{lead.rating}</span>
                          <span className="text-zinc-500 text-[10px]">({lead.reviews || 0})</span>
                        </div>
                      ) : (
                        <span className="text-zinc-650">—</span>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      {lead.email ? (
                        <div className="flex items-center gap-1.5">
                          <Mail className="h-3.5 w-3.5 text-zinc-500" />
                          <span className="truncate max-w-[150px]" title={lead.email}>{lead.email}</span>
                          <button
                            onClick={() => handleCopy(lead.email!)}
                            className="p-1 rounded hover:bg-zinc-800 text-zinc-500 hover:text-white transition-colors cursor-pointer"
                          >
                            {copiedText === lead.email ? (
                              <Check className="h-3 w-3 text-emerald-400" />
                            ) : (
                              <Copy className="h-3 w-3" />
                            )}
                          </button>
                        </div>
                      ) : (
                        <span className="text-zinc-600">None</span>
                      )}
                    </td>
                    <td className="px-6 py-4 font-mono">
                      {lead.phone ? (
                        <div className="flex items-center gap-1">
                          <Phone className="h-3.5 w-3.5 text-zinc-500" />
                          <span>{lead.phone}</span>
                        </div>
                      ) : (
                        <span className="text-zinc-600">—</span>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      {lead.website ? (
                        <a
                          href={lead.website}
                          target="_blank"
                          rel="noreferrer"
                          className="flex items-center gap-1 text-violet-400 hover:text-violet-300 transition-colors"
                        >
                          <Globe className="h-3.5 w-3.5" />
                          <span className="truncate max-w-[120px]">{lead.website.replace("https://", "").replace("http://", "").replace("www.", "")}</span>
                          <ExternalLink className="h-3 w-3" />
                        </a>
                      ) : (
                        <span className="text-zinc-600">—</span>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      {lead.facebook ? (
                        <a
                          href={lead.facebook}
                          target="_blank"
                          rel="noreferrer"
                          className="text-[10px] px-2 py-0.5 rounded bg-blue-500/10 text-blue-400 border border-blue-500/20 hover:bg-blue-500/20 transition-all font-semibold inline-flex items-center gap-1"
                        >
                          Facebook
                          <ExternalLink className="h-2.5 w-2.5" />
                        </a>
                      ) : lead.enrichmentStatus === "completed" ? (
                        <span className="text-[10px] text-zinc-500 bg-zinc-900 border border-zinc-800 px-2 py-0.5 rounded font-medium">
                          Checked
                        </span>
                      ) : (
                        <span className="text-zinc-600">None</span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-zinc-400">
                      {lead.address ? (
                        <div className="flex items-center gap-1 max-w-[180px] truncate" title={lead.address}>
                          <MapPin className="h-3.5 w-3.5 text-zinc-500 shrink-0" />
                          <span className="truncate">{lead.address}</span>
                        </div>
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

        {/* Pagination Footer */}
        {!isLoading && totalItems > 0 && (
          <div className="px-6 py-4 border-t border-zinc-800 bg-zinc-900/20 flex items-center justify-between text-xs text-zinc-400">
            <div>
              Showing <span className="font-semibold text-zinc-200">{startIndex + 1}</span> to{" "}
              <span className="font-semibold text-zinc-200">{endIndex}</span> of{" "}
              <span className="font-semibold text-zinc-200">{totalItems}</span> leads
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="p-1.5 rounded bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-white disabled:opacity-50 transition-colors"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <span className="font-mono text-zinc-200">
                Page {currentPage} of {totalPages}
              </span>
              <button
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className="p-1.5 rounded bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-white disabled:opacity-50 transition-colors"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      <ApiLogsConsole />
    </div>
  );
}
