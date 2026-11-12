'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import type { SystemStatusReport, DiagnosticItem } from '@/lib/admin/system-status';

// Lightweight, accessible SVG Icons (zero external dependencies)
const CheckIcon = ({ className = 'w-4 h-4' }: { className?: string }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
  </svg>
);

const WarnIcon = ({ className = 'w-4 h-4' }: { className?: string }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
  </svg>
);

const FailIcon = ({ className = 'w-4 h-4' }: { className?: string }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
  </svg>
);

const RefreshIcon = ({ className = 'w-4 h-4' }: { className?: string }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
  </svg>
);

const ArrowLeftIcon = ({ className = 'w-4 h-4' }: { className?: string }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
  </svg>
);

const ExternalLinkIcon = ({ className = 'w-3 h-3' }: { className?: string }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
  </svg>
);

export default function SystemStatusPage() {
  const [report, setReport] = useState<SystemStatusReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const handleRefresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/admin/system-status');
      if (!res.ok) {
        throw new Error(`HTTP Error ${res.status}: Failed to fetch status`);
      }
      const data: SystemStatusReport = await res.json();
      setReport(data);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let isCancelled = false;

    async function initialLoad() {
      try {
        const res = await fetch('/api/admin/system-status');
        if (!res.ok) {
          throw new Error(`HTTP Error ${res.status}: Failed to fetch status`);
        }
        const data: SystemStatusReport = await res.json();
        if (!isCancelled) {
          setReport(data);
          setLoading(false);
        }
      } catch (err) {
        if (!isCancelled) {
          setError((err as Error).message);
          setLoading(false);
        }
      }
    }

    initialLoad();

    return () => {
      isCancelled = true;
    };
  }, []);

  const renderStatusBadge = (status: 'pass' | 'fail' | 'warn') => {
    switch (status) {
      case 'pass':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 border border-emerald-300">
            <CheckIcon className="w-3.5 h-3.5 text-emerald-700" />
            OPERATIONAL
          </span>
        );
      case 'warn':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-100 text-amber-800 border border-amber-300">
            <WarnIcon className="w-3.5 h-3.5 text-amber-700" />
            ATTENTION
          </span>
        );
      case 'fail':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-rose-100 text-rose-800 border border-rose-300">
            <FailIcon className="w-3.5 h-3.5 text-rose-700" />
            ACTION REQUIRED
          </span>
        );
    }
  };

  const getServiceEmoji = (name: string) => {
    if (name.includes('Supabase')) return '🗄️';
    if (name.includes('Meta Graph')) return '🔑';
    if (name.includes('App Secret')) return '🔒';
    if (name.includes('Webhook')) return '⚡';
    if (name.includes('AES-256')) return '🛡️';
    return '✨';
  };

  const renderDiagnosticCard = (item: DiagnosticItem) => (
    <div 
      key={item.name} 
      className="p-5 rounded-xl border border-black/15 bg-[#f7f4e3] shadow-xs transition-all hover:border-[#3139fb] float-card"
    >
      <div className="flex items-start justify-between gap-4 mb-2">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-[var(--canvas-warm)] border border-[var(--border-subtle)] flex items-center justify-center text-lg">
            {getServiceEmoji(item.name)}
          </div>
          <div>
            <h3 className="font-semibold text-sm text-[var(--ink-primary)]">{item.name}</h3>
            <p className="text-xs text-[var(--ink-muted)]">{item.summary}</p>
          </div>
        </div>
        {renderStatusBadge(item.status)}
      </div>

      {item.fixHint && (
        <div className="mt-4 p-3 rounded-lg bg-amber-50 border border-amber-200 text-xs text-amber-900 leading-relaxed">
          <span className="font-semibold block mb-0.5">Recommended Resolution:</span>
          {item.fixHint}
        </div>
      )}
    </div>
  );

  return (
    <div className="min-h-screen w-full overflow-y-auto bg-[#fffcec] text-black p-6 lg:p-10 pb-16">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-black/15 pb-6">
          <div className="space-y-1">
            <Link 
              href="/"
              className="inline-flex items-center gap-1.5 text-xs text-[#696969] hover:text-[#3139fb] transition-colors mb-1 font-medium"
            >
              <ArrowLeftIcon className="w-3.5 h-3.5" /> Back to Inbox
            </Link>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-serif font-bold tracking-tight text-black">
                System Diagnostics & Infrastructure Health
              </h1>
            </div>
            <p className="text-xs text-[#696969]">
              Admin-only verification of cloud database, Meta Cloud API connectivity, and cryptographic secrets.
            </p>
          </div>

          <button
            type="button"
            onClick={handleRefresh}
            disabled={loading}
            className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold bg-black hover:bg-[#000354] text-[#fffcec] transition-all disabled:opacity-50 shadow-xs cursor-pointer btn-press focus-visible:ring-2 focus-visible:ring-[#3139fb]"
            aria-label="Refresh system status diagnostics"
          >
            <RefreshIcon className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            Run Diagnostics
          </button>
        </div>

        {error && (
          <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-sm">
            Failed to load diagnostic results: {error}
          </div>
        )}

        {/* Overall Status Banner */}
        {report && (
          <div className={`p-5 rounded-xl border flex items-center justify-between gap-4 ${
            report.overall === 'healthy' 
              ? 'bg-emerald-50/70 border-emerald-200 text-emerald-950'
              : report.overall === 'degraded'
              ? 'bg-amber-50/70 border-amber-200 text-amber-950'
              : 'bg-rose-50/70 border-rose-200 text-rose-950'
          }`}>
            <div className="space-y-1">
              <span className="text-xs font-semibold uppercase tracking-wider text-[var(--ink-muted)]">
                Overall Operational State
              </span>
              <h2 className="text-lg font-bold">
                {report.overall === 'healthy' && 'All Systems Fully Operational'}
                {report.overall === 'degraded' && 'System Operational with Non-Critical Notices'}
                {report.overall === 'failing' && 'Configuration Required Before Production Launch'}
              </h2>
              <p className="text-xs opacity-80">
                Last checked: {new Date(report.checkedAt).toLocaleTimeString()} • Zero secrets exposed in telemetry.
              </p>
            </div>
            <div className="hidden sm:block">
              {report.overall === 'healthy' && <CheckIcon className="w-10 h-10 text-emerald-600" />}
              {report.overall === 'degraded' && <WarnIcon className="w-10 h-10 text-amber-600" />}
              {report.overall === 'failing' && <FailIcon className="w-10 h-10 text-rose-600" />}
            </div>
          </div>
        )}

        {/* Diagnostic Items Grid */}
        {report && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {renderDiagnosticCard(report.supabase)}
            {renderDiagnosticCard(report.metaToken)}
            {renderDiagnosticCard(report.appSecret)}
            {renderDiagnosticCard(report.webhook)}
            {renderDiagnosticCard(report.encryptionKey)}
            {renderDiagnosticCard(report.geminiKey)}
          </div>
        )}

        {/* Documentation Guidance Footer */}
        <div className="p-4 rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-primary)] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs text-[var(--ink-muted)]">
          <div className="space-y-0.5">
            <span className="font-semibold text-[var(--ink-primary)]">Need help resolving a failed check?</span>
            <p>Consult our official setup and troubleshooting documentation guides.</p>
          </div>
          <div className="flex items-center gap-3">
            <a 
              href="/docs/INSTALL.md" 
              target="_blank" 
              rel="noreferrer"
              className="inline-flex items-center gap-1 text-[var(--accent-blue)] hover:underline font-medium"
            >
              Install Guide <ExternalLinkIcon className="w-3 h-3" />
            </a>
            <span>•</span>
            <a 
              href="/docs/TROUBLESHOOTING.md" 
              target="_blank" 
              rel="noreferrer"
              className="inline-flex items-center gap-1 text-[var(--accent-blue)] hover:underline font-medium"
            >
              Troubleshooting <ExternalLinkIcon className="w-3 h-3" />
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
