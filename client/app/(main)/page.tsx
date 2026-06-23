"use client";

import React, { useEffect } from "react";
import Link from "next/link";
import { useStore } from "../../store/useStore";
import { Key, Search, Users, Shield, Terminal, ArrowRight, Activity } from "lucide-react";
import ApiLogsConsole from "../../components/ApiLogsConsole";

export default function OverviewPage() {
  const {
    user,
    apiKeys,
    searches,
    leads,
    fetchApiKeys,
    fetchAllLeads,
    selectedApiKeyForTesting,
  } = useStore();

  useEffect(() => {
    fetchApiKeys();
    fetchAllLeads();
  }, [fetchApiKeys, fetchAllLeads]);

  // Compute stats
  const totalKeys = apiKeys.length;
  const activeSearches = searches.filter((s) => s.status === "pending").length;
  const totalLeads = leads.length;

  const stats = [
    {
      name: "API Keys",
      value: totalKeys,
      icon: Key,
      color: "from-violet-600/20 to-indigo-600/20 text-violet-400 border-violet-500/20",
      href: "/keys",
    },
    {
      name: "Active Scrapes",
      value: activeSearches,
      icon: Activity,
      color: activeSearches > 0 
        ? "from-emerald-600/20 to-teal-600/20 text-emerald-400 border-emerald-500/20 animate-pulse"
        : "from-zinc-800/20 to-zinc-900/20 text-zinc-400 border-zinc-700/20",
      href: "/scraper",
    },
    {
      name: "Leads Scraped",
      value: totalLeads,
      icon: Users,
      color: "from-amber-600/20 to-orange-600/20 text-amber-400 border-amber-500/20",
      href: "/leads",
    },
  ];

  return (
    <div className="space-y-8">
      {/* Welcome Card */}
      <div className="rounded-2xl border border-zinc-800 bg-gradient-to-r from-zinc-900 to-zinc-900/40 p-8 relative overflow-hidden">
        <div className="absolute top-0 right-0 h-40 w-40 rounded-full bg-violet-600/5 blur-[80px] pointer-events-none" />
        <div className="relative z-10 space-y-2">
          <span className="text-xs font-semibold uppercase tracking-wider text-violet-400">
            Developer Sandbox
          </span>
          <h1 className="text-3xl font-extrabold tracking-tight text-white">
            Hello, {user?.name || "Developer"}
          </h1>
          <p className="text-zinc-400 max-w-2xl text-sm leading-relaxed">
            Welcome to your Lead Generation Scraper control center. Here you can generate authentication API keys, test the search crawler endpoints, monitor real-time background jobs, and view or export your collected leads database.
          </p>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-3">
        {stats.map((stat) => (
          <Link
            key={stat.name}
            href={stat.href}
            className={`group rounded-2xl border bg-gradient-to-b p-6 transition-all duration-300 hover:scale-[1.02] cursor-pointer flex items-center justify-between ${stat.color}`}
          >
            <div className="space-y-1">
              <p className="text-sm font-medium text-zinc-400">{stat.name}</p>
              <p className="text-3xl font-bold tracking-tight text-white">
                {stat.value}
              </p>
            </div>
            <div className="p-3 rounded-xl bg-zinc-950/40 border border-zinc-800 group-hover:border-zinc-700 transition-colors">
              <stat.icon className="h-6 w-6" />
            </div>
          </Link>
        ))}
      </div>

      {/* Info & Test Environment */}
      <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
        {/* Testing Info */}
        <div className="rounded-2xl border border-zinc-800 bg-zinc-900/10 p-6 space-y-4">
          <div className="flex items-center gap-2 text-zinc-200">
            <Shield className="h-5 w-5 text-violet-400" />
            <h3 className="font-bold text-base">API Authentication Settings</h3>
          </div>
          <p className="text-xs text-zinc-400 leading-relaxed">
            By default, all dashboard calls are routed through the proxy using your session JWT token. To simulate direct HTTP API integration, you can generate an API key on the <strong>API Keys</strong> tab and select it. When selected, searches and lead queries will be sent with the `x-api-key` header instead of the JWT.
          </p>
          <div className="pt-4 border-t border-zinc-800 flex items-center justify-between">
            <span className="text-xs font-medium text-zinc-400">
              Active Testing Key Prefix:
            </span>
            <span className="text-xs font-mono px-2 py-1 rounded bg-zinc-900 border border-zinc-800 text-zinc-200">
              {selectedApiKeyForTesting 
                ? selectedApiKeyForTesting.substring(0, 12) + "..." 
                : "None (Using JWT Auth)"}
            </span>
          </div>
        </div>

        {/* Quick Links */}
        <div className="rounded-2xl border border-zinc-800 bg-zinc-900/10 p-6 space-y-4">
          <div className="flex items-center gap-2 text-zinc-200">
            <Terminal className="h-5 w-5 text-violet-400" />
            <h3 className="font-bold text-base">Quick API Actions</h3>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 pt-2">
            <Link
              href="/keys"
              className="flex items-center justify-between p-3.5 rounded-xl bg-zinc-900/40 border border-zinc-800 hover:border-zinc-700 text-xs font-semibold text-zinc-300 hover:text-white transition-all group"
            >
              <span>Manage API Keys</span>
              <ArrowRight className="h-4 w-4 text-zinc-500 group-hover:translate-x-0.5 transition-transform" />
            </Link>
            <Link
              href="/scraper"
              className="flex items-center justify-between p-3.5 rounded-xl bg-zinc-900/40 border border-zinc-800 hover:border-zinc-700 text-xs font-semibold text-zinc-300 hover:text-white transition-all group"
            >
              <span>Launch Scraper</span>
              <ArrowRight className="h-4 w-4 text-zinc-500 group-hover:translate-x-0.5 transition-transform" />
            </Link>
          </div>
        </div>
      </div>

      {/* Network Logger Console */}
      <ApiLogsConsole />
    </div>
  );
}
