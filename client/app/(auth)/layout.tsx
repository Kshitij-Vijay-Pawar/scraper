import React from "react";

export default function AuthLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-zinc-950 px-4 py-12 text-zinc-50 sm:px-6 lg:px-8 relative overflow-hidden">
      {/* Decorative background grid/shapes */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#0f0f15_1px,transparent_1px),linear-gradient(to_bottom,#0f0f15_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_50%,#000_70%,transparent_100%)] opacity-60" />
      <div className="absolute -top-40 -left-40 h-80 w-80 rounded-full bg-violet-600/10 blur-[120px] pointer-events-none" />
      <div className="absolute -bottom-40 -right-40 h-80 w-80 rounded-full bg-emerald-600/10 blur-[120px] pointer-events-none" />
      
      <div className="relative z-10 w-full max-w-md space-y-8 bg-zinc-900/60 backdrop-blur-xl border border-zinc-800 p-8 rounded-2xl shadow-2xl">
        {children}
      </div>
    </div>
  );
}
