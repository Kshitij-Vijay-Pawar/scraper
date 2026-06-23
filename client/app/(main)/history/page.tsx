"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  Clock3,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Search,
  RefreshCw,
  Database,
  Play,
  BarChart3,
  ArrowRight,
  Eye,
} from "lucide-react";
import { useStore, SearchJob } from "../../../store/useStore";

function formatDate(value: string) {
  return new Date(value).toLocaleString();
}

function statusTone(status: SearchJob["status"]) {
  switch (status) {
    case "completed":
      return "bg-emerald-500/10 text-emerald-300 border-emerald-500/20";
    case "running":
      return "bg-sky-500/10 text-sky-300 border-sky-500/20";
    case "pending":
      return "bg-amber-500/10 text-amber-300 border-amber-500/20";
    case "failed":
      return "bg-red-500/10 text-red-300 border-red-500/20";
    default:
      return "bg-zinc-500/10 text-zinc-300 border-zinc-500/20";
  }
}

export default function HistoryPage() {
  const { searches, fetchSearches, initialize, currentSearch, fetchSearchStatus, fetchSearchLeads } = useStore();
  const [isLoading, setIsLoading] = useState(false);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | SearchJob["status"]>("all");

  useEffect(() => {
    initialize();
    void loadHistory();
  }, [initialize]);

  const loadHistory = async () => {
    setIsLoading(true);
    await fetchSearches();
    setIsLoading(false);
  };

  const filteredSearches = useMemo(() => {
    const term = query.trim().toLowerCase();
    return searches.filter((job) => {
      const matchesQuery =
        !term ||
        job.keyword.toLowerCase().includes(term) ||
        job.location.toLowerCase().includes(term) ||
        job.id.toLowerCase().includes(term);
      const matchesStatus = statusFilter === "all" || job.status === statusFilter;
      return matchesQuery && matchesStatus;
    });
  }, [searches, query, statusFilter]);

  const stats = useMemo(() => {
    const total = searches.length;
    const completed = searches.filter((s) => s.status === "completed").length;
    const running = searches.filter((s) => s.status === "running" || s.status === "pending").length;
    const failed = searches.filter((s) => s.status === "failed").length;
    return { total, completed, running, failed };
  }, [searches]);

  const handleOpenSearch = async (job: SearchJob) => {
    useStore.setState({ currentSearch: job });
    await fetchSearchStatus(job.id);
    await fetchSearchLeads(job.id);
  };

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="space-y-2">
          <div className="inline-flex items-center gap-2 rounded-full border border-zinc-800 bg-zinc-900/50 px-3 py-1 text-[11px] uppercase tracking-[0.24em] text-zinc-400">
            <Clock3 className="h-3.5 w-3.5" />
            Scrape History
          </div>
          <div>
            <h1 className="text-3xl font-bold text-white">Complete scrape timeline</h1>
            <p className="mt-2 max-w-2xl text-sm text-zinc-400">
              Every scrape job launched from your account appears here. Open any job to inspect its status and results.
            </p>
          </div>
        </div>

        <button
          onClick={loadHistory}
          disabled={isLoading}
          className="inline-flex items-center gap-2 rounded-xl border border-zinc-800 bg-zinc-900 px-4 py-2 text-sm font-medium text-zinc-300 transition-colors hover:bg-zinc-800 hover:text-white disabled:opacity-50"
        >
          <RefreshCw className={`h-4 w-4 ${isLoading ? "animate-spin" : ""}`} />
          Refresh history
        </button>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <div className="rounded-2xl border border-zinc-800 bg-zinc-900/20 p-4">
          <div className="flex items-center gap-2 text-zinc-400 text-xs uppercase tracking-wide">
            <Database className="h-4 w-4" />
            Total jobs
          </div>
          <div className="mt-3 text-3xl font-bold text-white">{stats.total}</div>
        </div>
        <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/5 p-4">
          <div className="flex items-center gap-2 text-emerald-300 text-xs uppercase tracking-wide">
            <CheckCircle2 className="h-4 w-4" />
            Completed
          </div>
          <div className="mt-3 text-3xl font-bold text-emerald-100">{stats.completed}</div>
        </div>
        <div className="rounded-2xl border border-sky-500/20 bg-sky-500/5 p-4">
          <div className="flex items-center gap-2 text-sky-300 text-xs uppercase tracking-wide">
            <Play className="h-4 w-4" />
            Active
          </div>
          <div className="mt-3 text-3xl font-bold text-sky-100">{stats.running}</div>
        </div>
        <div className="rounded-2xl border border-red-500/20 bg-red-500/5 p-4">
          <div className="flex items-center gap-2 text-red-300 text-xs uppercase tracking-wide">
            <AlertCircle className="h-4 w-4" />
            Failed
          </div>
          <div className="mt-3 text-3xl font-bold text-red-100">{stats.failed}</div>
        </div>
      </div>

      <div className="flex flex-col gap-4 rounded-2xl border border-zinc-800 bg-zinc-900/20 p-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="relative w-full max-w-xl">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by keyword, location, or job id..."
            className="w-full rounded-xl border border-zinc-800 bg-zinc-950 pl-10 pr-4 py-2.5 text-sm text-zinc-200 placeholder-zinc-600 focus:border-violet-500 focus:outline-none focus:ring-1 focus:ring-violet-500"
          />
        </div>

        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as typeof statusFilter)}
          className="rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-2.5 text-sm text-zinc-300 focus:outline-none focus:ring-1 focus:ring-violet-500"
        >
          <option value="all">All statuses</option>
          <option value="pending">Pending</option>
          <option value="running">Running</option>
          <option value="completed">Completed</option>
          <option value="failed">Failed</option>
        </select>
      </div>

      <div className="overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-900/10">
        {isLoading ? (
          <div className="flex items-center justify-center gap-3 p-12 text-zinc-400">
            <Loader2 className="h-5 w-5 animate-spin text-violet-400" />
            Loading full scrape history...
          </div>
        ) : filteredSearches.length === 0 ? (
          <div className="p-12 text-center text-zinc-500">
            No scrape jobs match your filters yet.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-zinc-800 bg-zinc-900/30 text-zinc-400">
                <tr>
                  <th className="px-6 py-4 font-medium">Job</th>
                  <th className="px-6 py-4 font-medium">Location</th>
                  <th className="px-6 py-4 font-medium">Status</th>
                  <th className="px-6 py-4 font-medium">Progress</th>
                  <th className="px-6 py-4 font-medium">Leads</th>
                  <th className="px-6 py-4 font-medium">Created</th>
                  <th className="px-6 py-4 font-medium">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800">
                {filteredSearches.map((job) => (
                  <tr key={job.id} className="text-zinc-300 hover:bg-zinc-900/20">
                    <td className="px-6 py-4">
                      <div className="font-semibold text-zinc-100">{job.keyword}</div>
                      <div className="mt-1 text-xs text-zinc-500 break-all">{job.id}</div>
                    </td>
                    <td className="px-6 py-4 text-zinc-400">{job.location}</td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-medium ${statusTone(job.status)}`}>
                        {job.status}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="w-40">
                        <div className="mb-1 flex items-center justify-between text-xs text-zinc-500">
                          <span>{job.progress}%</span>
                          <span>{job.scrapedCount ?? 0} scraped</span>
                        </div>
                        <div className="h-2 overflow-hidden rounded-full bg-zinc-900">
                          <div
                            className="h-full rounded-full bg-gradient-to-r from-violet-500 via-indigo-500 to-sky-500"
                            style={{ width: `${Math.min(job.progress || 0, 100)}%` }}
                          />
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-zinc-100 font-semibold">{job.totalLeads ?? 0}</div>
                      <div className="text-xs text-zinc-500">
                        {job.insertedCount ?? 0} inserted, {job.duplicateCount ?? 0} duplicates
                      </div>
                    </td>
                    <td className="px-6 py-4 text-zinc-400">{formatDate(job.createdAt)}</td>
                    <td className="px-6 py-4">
                      <button
                        onClick={() => void handleOpenSearch(job)}
                        className="inline-flex items-center gap-2 rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-2 text-xs font-medium text-zinc-300 transition-colors hover:bg-zinc-800 hover:text-white"
                      >
                        <Eye className="h-3.5 w-3.5" />
                        Open run
                        <ArrowRight className="h-3.5 w-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {currentSearch && (
        <div className="rounded-2xl border border-zinc-800 bg-gradient-to-br from-zinc-900/40 to-zinc-950 p-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <div className="text-xs uppercase tracking-[0.24em] text-zinc-500">Current selection</div>
              <h2 className="mt-2 text-xl font-semibold text-white">
                {currentSearch.keyword} in {currentSearch.location}
              </h2>
              <p className="mt-2 text-sm text-zinc-400">
                This is the active job currently loaded in the dashboard.
              </p>
            </div>

            <Link
              href="/scraper"
              className="inline-flex items-center gap-2 rounded-xl bg-violet-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-violet-500"
            >
              Go to scraper console
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>

          <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-xl border border-zinc-800 bg-zinc-950/60 p-4">
              <div className="text-xs text-zinc-500">Status</div>
              <div className="mt-1 text-sm font-semibold text-zinc-100">{currentSearch.status}</div>
            </div>
            <div className="rounded-xl border border-zinc-800 bg-zinc-950/60 p-4">
              <div className="text-xs text-zinc-500">Progress</div>
              <div className="mt-1 text-sm font-semibold text-zinc-100">{currentSearch.progress}%</div>
            </div>
            <div className="rounded-xl border border-zinc-800 bg-zinc-950/60 p-4">
              <div className="text-xs text-zinc-500">Scraped</div>
              <div className="mt-1 text-sm font-semibold text-zinc-100">{currentSearch.scrapedCount ?? 0}</div>
            </div>
            <div className="rounded-xl border border-zinc-800 bg-zinc-950/60 p-4">
              <div className="text-xs text-zinc-500">Inserted</div>
              <div className="mt-1 text-sm font-semibold text-zinc-100">{currentSearch.insertedCount ?? 0}</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
