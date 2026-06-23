"use client";

import React, { useState } from "react";
import { useStore } from "../store/useStore";
import { Terminal, Trash2, ChevronDown, ChevronUp, CheckCircle, AlertTriangle } from "lucide-react";

export default function ApiLogsConsole() {
  const { logs, clearLogs } = useStore();
  const [expandedLogId, setExpandedLogId] = useState<string | null>(null);

  const toggleExpand = (id: string) => {
    setExpandedLogId(expandedLogId === id ? null : id);
  };

  if (logs.length === 0) {
    return (
      <div className="mt-8 rounded-2xl border border-zinc-800 bg-zinc-900/30 p-6 text-center">
        <Terminal className="mx-auto h-8 w-8 text-zinc-600 mb-2" />
        <h3 className="text-sm font-semibold text-zinc-400">No API Logs Yet</h3>
        <p className="text-xs text-zinc-500 mt-1">
          Perform auth actions, manage keys, or run scrapes to see live API request/response logs.
        </p>
      </div>
    );
  }

  return (
    <div className="mt-8 rounded-2xl border border-zinc-800 bg-zinc-900/30 overflow-hidden">
      <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-800 bg-zinc-900/50">
        <div className="flex items-center gap-2">
          <Terminal className="h-5 w-5 text-violet-400" />
          <h3 className="font-bold text-sm text-zinc-200">Interactive API Network Console</h3>
          <span className="text-[10px] px-2 py-0.5 rounded-full bg-violet-500/10 text-violet-400 border border-violet-500/20 font-mono">
            Live
          </span>
        </div>
        <button
          onClick={clearLogs}
          className="text-xs text-zinc-500 hover:text-red-400 flex items-center gap-1.5 transition-colors cursor-pointer"
        >
          <Trash2 className="h-3.5 w-3.5" />
          Clear Console
        </button>
      </div>

      <div className="divide-y divide-zinc-800 max-h-[380px] overflow-y-auto font-mono text-xs">
        {logs.map((log) => {
          const isExpanded = expandedLogId === log.id;
          const isSuccess = log.status >= 200 && log.status < 300;

          return (
            <div key={log.id} className="transition-colors hover:bg-zinc-900/20">
              {/* Row Header */}
              <div
                onClick={() => toggleExpand(log.id)}
                className="flex items-center justify-between px-6 py-3 cursor-pointer select-none"
              >
                <div className="flex items-center gap-4 min-w-0">
                  <span className="text-zinc-500 text-[10px]">{log.timestamp}</span>
                  <span
                    className={`font-bold px-1.5 py-0.5 rounded text-[10px] ${
                      log.method === "POST"
                        ? "bg-emerald-500/10 text-emerald-400"
                        : log.method === "DELETE"
                        ? "bg-red-500/10 text-red-400"
                        : "bg-blue-500/10 text-blue-400"
                    }`}
                  >
                    {log.method}
                  </span>
                  <span className="text-zinc-300 truncate font-semibold">{log.url}</span>
                </div>
                <div className="flex items-center gap-3">
                  <span
                    className={`flex items-center gap-1 font-semibold ${
                      isSuccess ? "text-emerald-400" : "text-red-400"
                    }`}
                  >
                    {isSuccess ? (
                      <CheckCircle className="h-3.5 w-3.5" />
                    ) : (
                      <AlertTriangle className="h-3.5 w-3.5" />
                    )}
                    {log.status}
                  </span>
                  {isExpanded ? (
                    <ChevronUp className="h-4 w-4 text-zinc-500" />
                  ) : (
                    <ChevronDown className="h-4 w-4 text-zinc-500" />
                  )}
                </div>
              </div>

              {/* Expanded details */}
              {isExpanded && (
                <div className="px-6 pb-4 pt-2 bg-zinc-950/80 border-t border-zinc-900 space-y-3">
                  {log.requestBody && (
                    <div>
                      <div className="text-[10px] text-zinc-500 uppercase tracking-wider mb-1 font-bold">
                        Request Body
                      </div>
                      <pre className="p-3 rounded-lg bg-zinc-900 border border-zinc-800 text-zinc-300 overflow-x-auto text-[11px]">
                        {JSON.stringify(log.requestBody, null, 2)}
                      </pre>
                    </div>
                  )}
                  <div>
                    <div className="text-[10px] text-zinc-500 uppercase tracking-wider mb-1 font-bold">
                      Response Data
                    </div>
                    <pre className="p-3 rounded-lg bg-zinc-900 border border-zinc-800 text-zinc-300 overflow-x-auto text-[11px]">
                      {JSON.stringify(log.responseBody, null, 2)}
                    </pre>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
