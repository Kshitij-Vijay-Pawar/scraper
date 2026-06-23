"use client";

import React, { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { useStore, Lead } from "../../../../store/useStore";
import {
  ArrowLeft,
  Mail,
  Phone,
  Globe,
  MapPin,
  Star,
  Search,
  Sparkles,
  Calendar,
  Compass,
  Copy,
  Check,
  ExternalLink,
  Loader2,
  AlertCircle
} from "lucide-react";
import ApiLogsConsole from "../../../../components/ApiLogsConsole";

export default function LeadDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  const { fetchLeadById, initialize } = useStore();
  const [lead, setLead] = useState<Lead | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copiedText, setCopiedText] = useState<string | null>(null);

  useEffect(() => {
    initialize();
    loadLead();
  }, [id, initialize]);

  const loadLead = async () => {
    if (!id) return;
    setIsLoading(true);
    setError(null);
    try {
      const data = await fetchLeadById(id);
      if (data) {
        setLead(data);
      } else {
        setError("Lead not found or access denied.");
      }
    } catch (err: any) {
      setError(err.message || "Failed to load lead details.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedText(text);
    setTimeout(() => setCopiedText(null), 1500);
  };

  const getStatusBadgeClass = (status: string | null) => {
    switch (status) {
      case "completed":
        return "bg-emerald-500/10 text-emerald-400 border-emerald-500/20";
      case "running":
        return "bg-violet-500/10 text-violet-400 border-violet-500/20 animate-pulse";
      case "pending":
        return "bg-amber-500/10 text-amber-400 border-amber-500/20";
      case "failed":
        return "bg-red-500/10 text-red-400 border-red-500/20";
      case "cancelled":
        return "bg-zinc-500/10 text-zinc-400 border-zinc-500/20";
      default:
        return "bg-zinc-500/10 text-zinc-400 border-zinc-500/20";
    }
  };

  const formatUrl = (url: string) => {
    return url.replace(/https?:\/\/(www\.)?/, "");
  };

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen text-zinc-400 gap-3">
        <Loader2 className="h-8 w-8 animate-spin text-violet-500" />
        <span className="text-sm">Loading lead information...</span>
      </div>
    );
  }

  if (error || !lead) {
    return (
      <div className="max-w-4xl mx-auto px-6 py-12">
        <button
          onClick={() => router.back()}
          className="flex items-center gap-2 text-zinc-400 hover:text-white transition-colors mb-6 text-sm group"
        >
          <ArrowLeft className="h-4 w-4 group-hover:-translate-x-1 transition-transform" />
          Back to leads
        </button>
        <div className="rounded-2xl border border-red-500/20 bg-red-500/5 p-6 text-center flex flex-col items-center gap-3">
          <AlertCircle className="h-10 w-10 text-red-400" />
          <h2 className="text-lg font-semibold text-zinc-200">Error Loading Lead</h2>
          <p className="text-zinc-400 text-sm">{error || "The requested lead could not be found."}</p>
        </div>
      </div>
    );
  }

  // Deduplicate and filter emails array
  const allEmails = Array.from(
    new Set(
      [lead.email, ...(lead.emails || [])].filter((email): email is string => !!email)
    )
  );

  return (
    <div className="max-w-7xl mx-auto px-6 py-8">
      {/* Header section */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
        <div>
          <button
            onClick={() => router.back()}
            className="flex items-center gap-2 text-zinc-455 hover:text-zinc-200 transition-colors mb-3 text-sm group"
          >
            <ArrowLeft className="h-4 w-4 group-hover:-translate-x-0.5 transition-transform" />
            Back
          </button>
          <h1 className="text-2xl md:text-3xl font-extrabold text-zinc-100 tracking-tight flex items-center gap-3">
            {lead.name}
            {lead.rating && (
              <span className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/20 font-mono">
                <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
                {lead.rating} ({lead.reviews || 0} reviews)
              </span>
            )}
          </h1>
          <p className="text-xs text-zinc-500 mt-1 flex items-center gap-1.5">
            <Calendar className="h-3 w-3" />
            Scraped on {new Date(lead.createdAt).toLocaleString()}
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <span className={`px-3 py-1 rounded-full text-xs font-semibold border ${getStatusBadgeClass(lead.enrichmentStatus)}`}>
            Enrichment: {lead.enrichmentStatus || "pending"}
          </span>
        </div>
      </div>

      {/* Grid Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-12">
        {/* Left Side: General Info & Emails */}
        <div className="lg:col-span-2 space-y-6">
          {/* Card 1: Core Contact Details */}
          <div className="rounded-2xl border border-zinc-800 bg-zinc-900/10 p-6 space-y-6">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-zinc-400 border-b border-zinc-800/60 pb-3">
              Contact & Location Details
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Website */}
              <div className="space-y-1.5">
                <span className="text-[10px] uppercase font-bold text-zinc-500">Website</span>
                {lead.website ? (
                  <a
                    href={lead.website}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center gap-1.5 text-violet-400 hover:text-violet-300 transition-colors text-sm font-semibold truncate"
                  >
                    <Globe className="h-4 w-4 shrink-0 text-zinc-400" />
                    <span className="truncate">{formatUrl(lead.website)}</span>
                    <ExternalLink className="h-3.5 w-3.5" />
                  </a>
                ) : (
                  <p className="text-sm text-zinc-500 italic">No website available</p>
                )}
              </div>

              {/* Phone */}
              <div className="space-y-1.5">
                <span className="text-[10px] uppercase font-bold text-zinc-500">Phone</span>
                {lead.phone ? (
                  <div className="flex items-center gap-1.5 text-zinc-200 text-sm font-mono font-semibold">
                    <Phone className="h-4 w-4 text-zinc-400 shrink-0" />
                    <span>{lead.phone}</span>
                    <button
                      onClick={() => handleCopy(lead.phone!)}
                      className="p-1 rounded hover:bg-zinc-800 text-zinc-500 hover:text-white transition-colors cursor-pointer"
                    >
                      {copiedText === lead.phone ? (
                        <Check className="h-3.5 w-3.5 text-emerald-450" />
                      ) : (
                        <Copy className="h-3.5 w-3.5" />
                      )}
                    </button>
                  </div>
                ) : (
                  <p className="text-sm text-zinc-500 italic">No phone number available</p>
                )}
              </div>

              {/* Address */}
              <div className="space-y-1.5 md:col-span-2">
                <span className="text-[10px] uppercase font-bold text-zinc-500">Address</span>
                {lead.address ? (
                  <div className="flex items-start gap-1.5 text-zinc-300 text-sm">
                    <MapPin className="h-4 w-4 text-zinc-450 shrink-0 mt-0.5" />
                    <p className="leading-relaxed">{lead.address}</p>
                    <button
                      onClick={() => handleCopy(lead.address!)}
                      className="p-1 rounded hover:bg-zinc-800 text-zinc-500 hover:text-white transition-colors cursor-pointer shrink-0 ml-1"
                    >
                      {copiedText === lead.address ? (
                        <Check className="h-3.5 w-3.5 text-emerald-455" />
                      ) : (
                        <Copy className="h-3.5 w-3.5" />
                      )}
                    </button>
                  </div>
                ) : (
                  <p className="text-sm text-zinc-500 italic">No address available</p>
                )}
              </div>

              {/* Coordinates */}
              {(lead.latitude || lead.longitude) && (
                <div className="space-y-1.5 md:col-span-2">
                  <span className="text-[10px] uppercase font-bold text-zinc-500">Coordinates</span>
                  <div className="flex items-center gap-2 text-zinc-400 text-xs font-mono">
                    <Compass className="h-4 w-4 text-zinc-550" />
                    <span>Lat: <strong className="text-zinc-300">{lead.latitude || "N/A"}</strong></span>
                    <span className="text-zinc-650">•</span>
                    <span>Lng: <strong className="text-zinc-300">{lead.longitude || "N/A"}</strong></span>
                    <a
                      href={`https://www.google.com/maps/search/?api=1&query=${lead.latitude},${lead.longitude}`}
                      target="_blank"
                      rel="noreferrer"
                      className="ml-2 flex items-center gap-0.5 text-violet-400 hover:text-violet-300 transition-colors"
                    >
                      View on Map
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Card 2: Emails & Contact Options */}
          <div className="rounded-2xl border border-zinc-800 bg-zinc-900/10 p-6 space-y-4">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-zinc-400 border-b border-zinc-800/60 pb-3">
              Enriched Emails
            </h2>

            {allEmails.length === 0 ? (
              <div className="p-6 text-center text-zinc-500 text-xs border border-dashed border-zinc-800 rounded-xl">
                No emails discovered yet. Try running Website Enrichment.
              </div>
            ) : (
              <div className="space-y-2">
                {allEmails.map((email, idx) => (
                  <div
                    key={email}
                    className={`flex items-center justify-between p-3.5 rounded-xl border transition-all ${
                      email === lead.email
                        ? "bg-violet-500/5 border-violet-500/20"
                        : "bg-zinc-950/20 border-zinc-900 hover:border-zinc-800"
                    }`}
                  >
                    <div className="flex items-center gap-3 truncate">
                      <div className="h-8 w-8 rounded-lg bg-zinc-900 border border-zinc-800 flex items-center justify-center shrink-0">
                        <Mail className={`h-4 w-4 ${email === lead.email ? "text-violet-400" : "text-zinc-500"}`} />
                      </div>
                      <div className="truncate">
                        <p className="text-sm font-semibold text-zinc-200 truncate">{email}</p>
                        {email === lead.email && (
                          <span className="text-[9px] font-bold text-violet-400 uppercase tracking-wide">
                            Primary Contact
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-1 shrink-0 ml-4">
                      <a
                        href={`mailto:${email}`}
                        className="p-1.5 rounded hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200 transition-colors"
                        title="Compose Email"
                      >
                        <ExternalLink className="h-4 w-4" />
                      </a>
                      <button
                        onClick={() => handleCopy(email)}
                        className="p-1.5 rounded hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200 transition-colors cursor-pointer"
                        title="Copy to Clipboard"
                      >
                        {copiedText === email ? (
                          <Check className="h-4 w-4 text-emerald-450" />
                        ) : (
                          <Copy className="h-4 w-4" />
                        )}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right Side: Socials, Enrichment Metadata, and Search Context */}
        <div className="space-y-6">
          {/* Card 3: Social Accounts */}
          <div className="rounded-2xl border border-zinc-800 bg-zinc-900/10 p-6 space-y-4">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-zinc-400 border-b border-zinc-800/60 pb-3">
              Social Profiles
            </h2>

            <div className="space-y-2.5">
              {/* Facebook */}
              <div className="flex items-center justify-between p-2 rounded-lg bg-zinc-950/20 border border-zinc-900">
                <div className="flex items-center gap-2">
                  <svg className={`h-4 w-4 ${lead.facebook ? "text-blue-500 fill-current" : "text-zinc-600 fill-current"}`} viewBox="0 0 24 24">
                    <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
                  </svg>
                  <span className="text-xs text-zinc-300 font-medium">Facebook</span>
                </div>
                {lead.facebook ? (
                  <a
                    href={lead.facebook}
                    target="_blank"
                    rel="noreferrer"
                    className="text-[10px] px-2 py-0.5 rounded bg-blue-500/10 text-blue-400 border border-blue-500/20 hover:bg-blue-500/20 transition-all font-semibold flex items-center gap-1"
                  >
                    Open
                    <ExternalLink className="h-2.5 w-2.5" />
                  </a>
                ) : (
                  <span className="text-[10px] text-zinc-600 font-medium">Not Found</span>
                )}
              </div>

              {/* Instagram */}
              <div className="flex items-center justify-between p-2 rounded-lg bg-zinc-950/20 border border-zinc-900">
                <div className="flex items-center gap-2">
                  <svg className={`h-4 w-4 ${lead.instagram ? "text-pink-500 fill-none stroke-current" : "text-zinc-650 fill-none stroke-current"}`} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
                    <rect x="2" y="2" width="20" height="20" rx="5" ry="5"></rect>
                    <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"></path>
                    <line x1="17.5" y1="6.5" x2="17.51" y2="6.5"></line>
                  </svg>
                  <span className="text-xs text-zinc-300 font-medium">Instagram</span>
                </div>
                {lead.instagram ? (
                  <a
                    href={lead.instagram}
                    target="_blank"
                    rel="noreferrer"
                    className="text-[10px] px-2 py-0.5 rounded bg-pink-500/10 text-pink-400 border border-pink-500/20 hover:bg-pink-500/20 transition-all font-semibold flex items-center gap-1"
                  >
                    Open
                    <ExternalLink className="h-2.5 w-2.5" />
                  </a>
                ) : (
                  <span className="text-[10px] text-zinc-600 font-medium">Not Found</span>
                )}
              </div>

              {/* LinkedIn */}
              <div className="flex items-center justify-between p-2 rounded-lg bg-zinc-950/20 border border-zinc-900">
                <div className="flex items-center gap-2">
                  <svg className={`h-4 w-4 ${lead.linkedin ? "text-blue-500 fill-current" : "text-zinc-600 fill-current"}`} viewBox="0 0 24 24">
                    <path d="M19 0h-14c-2.761 0-5 2.239-5 5v14c0 2.761 2.239 5 5 5h14c2.762 0 5-2.239 5-5v-14c0-2.761-2.238-5-5-5zm-11 19h-3v-11h3v11zm-1.5-12.268c-.966 0-1.75-.79-1.75-1.764s.784-1.764 1.75-1.764 1.75.79 1.75 1.764-.783 1.764-1.75 1.764zm13.5 12.268h-3v-5.604c0-3.368-4-3.113-4 0v5.604h-3v-11h3v1.765c1.396-2.586 7-2.777 7 2.476v6.759z"/>
                  </svg>
                  <span className="text-xs text-zinc-300 font-medium">LinkedIn</span>
                </div>
                {lead.linkedin ? (
                  <a
                    href={lead.linkedin}
                    target="_blank"
                    rel="noreferrer"
                    className="text-[10px] px-2 py-0.5 rounded bg-blue-500/10 text-blue-400 border border-blue-500/20 hover:bg-blue-500/20 transition-all font-semibold flex items-center gap-1"
                  >
                    Open
                    <ExternalLink className="h-2.5 w-2.5" />
                  </a>
                ) : (
                  <span className="text-[10px] text-zinc-600 font-medium">Not Found</span>
                )}
              </div>

              {/* Twitter */}
              <div className="flex items-center justify-between p-2 rounded-lg bg-zinc-950/20 border border-zinc-900">
                <div className="flex items-center gap-2">
                  <svg className={`h-4 w-4 ${lead.twitter ? "text-sky-400 fill-current" : "text-zinc-600 fill-current"}`} viewBox="0 0 24 24">
                    <path d="M23.953 4.57a10 10 0 01-2.825.775 4.958 4.958 0 002.163-2.723c-.951.555-2.005.959-3.127 1.184a4.92 4.92 0 00-8.384 4.482C7.69 8.095 4.067 6.13 1.64 3.162a4.822 4.822 0 00-.666 2.475c0 1.71.87 3.213 2.188 4.096a4.904 4.904 0 01-2.228-.616v.06a4.923 4.923 0 003.946 4.827 4.996 4.996 0 01-2.212.085 4.936 4.936 0 004.604 3.417 9.867 9.867 0 01-6.102 2.105c-.39 0-.779-.023-1.17-.067a13.995 13.995 0 007.557 2.209c9.053 0 13.998-7.496 13.998-13.985 0-.21 0-.42-.015-.63A9.935 9.935 0 0024 4.59z"/>
                  </svg>
                  <span className="text-xs text-zinc-300 font-medium">Twitter</span>
                </div>
                {lead.twitter ? (
                  <a
                    href={lead.twitter}
                    target="_blank"
                    rel="noreferrer"
                    className="text-[10px] px-2 py-0.5 rounded bg-sky-500/10 text-sky-400 border border-sky-500/20 hover:bg-sky-500/20 transition-all font-semibold flex items-center gap-1"
                  >
                    Open
                    <ExternalLink className="h-2.5 w-2.5" />
                  </a>
                ) : (
                  <span className="text-[10px] text-zinc-600 font-medium">Not Found</span>
                )}
              </div>
            </div>
          </div>

          {/* Card 4: Enrichment Metadata */}
          <div className="rounded-2xl border border-zinc-800 bg-zinc-900/10 p-6 space-y-4">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-zinc-400 border-b border-zinc-800/60 pb-3 flex items-center gap-1.5">
              <Sparkles className="h-4 w-4 text-violet-400" />
              Enrichment Details
            </h2>

            <div className="space-y-3.5 text-xs">
              <div className="flex justify-between py-1 border-b border-zinc-900">
                <span className="text-zinc-500">Status</span>
                <span className="font-semibold text-zinc-200 capitalize">{lead.enrichmentStatus || "pending"}</span>
              </div>

              <div className="flex justify-between py-1 border-b border-zinc-900">
                <span className="text-zinc-500">Email Source</span>
                <span className="font-semibold text-zinc-200">{lead.emailSource || <span className="text-zinc-650">—</span>}</span>
              </div>

              <div className="flex justify-between py-1 border-b border-zinc-900">
                <span className="text-zinc-500">Social Source</span>
                <span className="font-semibold text-zinc-200">{lead.socialSource || <span className="text-zinc-650">—</span>}</span>
              </div>

              <div className="flex justify-between py-1">
                <span className="text-zinc-500">Last Checked</span>
                <span className="font-semibold text-zinc-200">
                  {lead.websiteLastChecked ? new Date(lead.websiteLastChecked).toLocaleString() : <span className="text-zinc-650">—</span>}
                </span>
              </div>
            </div>
          </div>

          {/* Card 5: Search Context */}
          <div className="rounded-2xl border border-zinc-800 bg-zinc-900/10 p-6 space-y-4">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-zinc-400 border-b border-zinc-800/60 pb-3 flex items-center gap-1.5">
              <Search className="h-4 w-4 text-zinc-450" />
              Search Source
            </h2>

            <div className="space-y-3.5 text-xs">
              <div className="flex justify-between py-1 border-b border-zinc-900">
                <span className="text-zinc-500">Keyword</span>
                <span className="font-semibold text-zinc-200">{lead.searchKeyword || "Google Maps Search"}</span>
              </div>

              <div className="flex justify-between py-1 border-b border-zinc-900">
                <span className="text-zinc-500">Location</span>
                <span className="font-semibold text-zinc-200">{lead.searchLocation || "Unknown"}</span>
              </div>

              <div className="flex flex-col gap-1 py-1">
                <span className="text-zinc-500">Search ID</span>
                <div className="flex items-center justify-between bg-zinc-950/40 p-2 rounded border border-zinc-900 font-mono text-[10px] text-zinc-400 mt-1 select-all">
                  <span className="truncate max-w-[160px]" title={lead.searchId}>{lead.searchId}</span>
                  <button
                    onClick={() => handleCopy(lead.searchId)}
                    className="p-0.5 rounded hover:bg-zinc-800 text-zinc-500 hover:text-white transition-colors cursor-pointer"
                  >
                    {copiedText === lead.searchId ? (
                      <Check className="h-3 w-3 text-emerald-450" />
                    ) : (
                      <Copy className="h-3 w-3" />
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* API Logs Panel */}
      <div className="mt-8">
        <ApiLogsConsole />
      </div>
    </div>
  );
}
