"use client";

import React, { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import { useStore } from "../../store/useStore";
import {
  LayoutDashboard,
  Key,
  Search,
  Users,
  Clock3,
  LogOut,
  Terminal,
  User,
  ExternalLink,
} from "lucide-react";

export default function MainLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const router = useRouter();
  const pathname = usePathname();
  const { token, user, initialize, fetchUser, logout } = useStore();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    initialize();
    setMounted(true);
  }, [initialize]);

  useEffect(() => {
    if (mounted) {
      if (!token) {
        router.push("/login");
      } else if (!user) {
        fetchUser();
      }
    }
  }, [token, user, mounted, router, fetchUser]);

  if (!mounted || !token) {
    return (
      <div className="flex h-screen items-center justify-center bg-zinc-950 text-zinc-400">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-violet-500 border-t-transparent" />
      </div>
    );
  }

  const navItems = [
    { name: "Overview", href: "/", icon: LayoutDashboard },
    { name: "API Keys", href: "/keys", icon: Key },
    { name: "Scraper Console", href: "/scraper", icon: Search },
    { name: "Scrape History", href: "/history", icon: Clock3 },
    { name: "Leads Database", href: "/leads", icon: Users },
  ];

  return (
    <div className="flex min-h-screen bg-zinc-950 text-zinc-100 font-sans">
      {/* Sidebar */}
      <aside className="w-64 border-r border-zinc-800 bg-zinc-900/40 backdrop-blur-md flex flex-col justify-between shrink-0">
        <div>
          {/* Logo / Title */}
          <div className="p-6 border-b border-zinc-800">
            <Link href="/" className="flex items-center gap-2.5">
              <div className="h-8 w-8 rounded-lg bg-gradient-to-tr from-violet-600 to-indigo-600 flex items-center justify-center shadow-lg shadow-violet-500/20">
                <Terminal className="h-4.5 w-4.5 text-white" />
              </div>
              <span className="font-bold text-lg bg-clip-text text-transparent bg-gradient-to-r from-white to-zinc-400">
                LeadScrape API
              </span>
            </Link>
          </div>

          {/* Navigation Links */}
          <nav className="p-4 space-y-1.5">
            {navItems.map((item) => {
              const isActive = pathname === item.href;
              return (
                <Link
                  key={item.name}
                  href={item.href}
                  className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all duration-200 ${
                    isActive
                      ? "bg-violet-600 text-white shadow-lg shadow-violet-600/10"
                      : "text-zinc-400 hover:bg-zinc-800/50 hover:text-zinc-200"
                  }`}
                >
                  <item.icon className="h-5 w-5" />
                  {item.name}
                </Link>
              );
            })}
          </nav>
        </div>

        {/* User Info / Logout */}
        <div className="p-4 border-t border-zinc-800 space-y-3">
          {user && (
            <div className="flex items-center gap-3 px-3 py-2">
              <div className="h-9 w-9 rounded-full bg-zinc-800 flex items-center justify-center border border-zinc-700 text-zinc-300">
                <User className="h-4.5 w-4.5" />
              </div>
              <div className="overflow-hidden">
                <p className="text-sm font-semibold truncate text-zinc-200">
                  {user.name}
                </p>
                <p className="text-xs text-zinc-500 truncate">{user.email}</p>
              </div>
            </div>
          )}

          <button
            onClick={() => {
              logout();
              router.push("/login");
            }}
            className="flex w-full items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-medium text-red-400 hover:bg-red-950/20 hover:text-red-300 transition-colors cursor-pointer"
          >
            <LogOut className="h-5 w-5" />
            Sign Out
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 overflow-y-auto">
        <header className="h-16 border-b border-zinc-800 bg-zinc-900/20 flex items-center justify-between px-8">
          <h2 className="text-sm font-medium text-zinc-400">
            Developer Sandbox Console
          </h2>
          <div className="flex items-center gap-4">
            <a
              href="http://localhost:3000/public/health"
              target="_blank"
              rel="noreferrer"
              className="text-xs flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 transition-all"
            >
              <span>API Health Status</span>
              <ExternalLink className="h-3 w-3" />
            </a>
          </div>
        </header>

        <main className="flex-1 p-8 bg-zinc-950/50">{children}</main>
      </div>
    </div>
  );
}
