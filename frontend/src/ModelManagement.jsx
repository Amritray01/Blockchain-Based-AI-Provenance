import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import {
  Cpu, Database, Hash, Clock, Link2, RefreshCw,
  ChevronDown, ChevronUp, ShieldCheck, AlertCircle, Layers
} from 'lucide-react';

const API_BASE = 'http://localhost:8000';

// ── helpers ──────────────────────────────────────────────────────────────────
const short = (hash, n = 10) =>
  hash ? `${hash.slice(0, n)}…${hash.slice(-6)}` : '—';

const copyToClipboard = (text) => {
  navigator.clipboard.writeText(text).catch(() => {});
};

function HashBadge({ value, label, accent = 'cyan' }) {
  const [copied, setCopied] = useState(false);

  const colors = {
    cyan:   'bg-cyan-500/10  text-cyan-300  border-cyan-500/20  hover:bg-cyan-500/20',
    violet: 'bg-violet-500/10 text-violet-300 border-violet-500/20 hover:bg-violet-500/20',
    emerald:'bg-emerald-500/10 text-emerald-300 border-emerald-500/20 hover:bg-emerald-500/20',
  };

  const handleCopy = () => {
    copyToClipboard(value);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div className="flex flex-col gap-1">
      <span className="text-[10px] uppercase tracking-widest text-slate-500 font-semibold">{label}</span>
      <button
        onClick={handleCopy}
        title={value}
        className={`font-mono text-xs px-3 py-1.5 rounded-lg border transition-all text-left ${colors[accent]}`}
      >
        {copied ? '✓ Copied!' : short(value)}
      </button>
    </div>
  );
}

function ModelCard({ model, index }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div
      className="bg-[#111114] border border-white/[0.07] rounded-2xl overflow-hidden transition-all duration-300 hover:border-white/[0.14] hover:shadow-xl hover:shadow-black/40"
      style={{ animationDelay: `${index * 60}ms` }}
    >
      {/* Card Header */}
      <div className="p-5 flex items-start justify-between gap-4">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-10 h-10 rounded-xl bg-violet-500/10 border border-violet-500/20 flex items-center justify-center flex-shrink-0">
            <Cpu size={18} className="text-violet-400" />
          </div>
          <div className="min-w-0">
            <p className="text-slate-200 font-semibold text-sm truncate">
              Model <span className="font-mono text-violet-400">{short(model.modelHash, 8)}</span>
            </p>
            <p className="text-slate-500 text-xs mt-0.5 flex items-center gap-1.5">
              <Clock size={11} />
              {model.timestamp ?? 'Unknown'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-shrink-0">
          <span
            className={`text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full border ${
              model.datasetHash
                ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                : 'bg-amber-500/10 text-amber-400 border-amber-500/20'
            }`}
          >
            {model.datasetHash ? 'Linked' : 'Unlinked'}
          </span>
          <button
            onClick={() => setExpanded(!expanded)}
            className="w-7 h-7 rounded-lg bg-white/[0.04] hover:bg-white/[0.08] flex items-center justify-center transition-all"
          >
            {expanded ? <ChevronUp size={14} className="text-slate-400" /> : <ChevronDown size={14} className="text-slate-400" />}
          </button>
        </div>
      </div>

      {/* Hash Row */}
      <div className="px-5 pb-4 grid grid-cols-2 gap-3">
        <HashBadge label="Model Hash" value={model.modelHash} accent="violet" />
        <HashBadge label="Training Dataset Hash" value={model.datasetHash} accent="cyan" />
      </div>

      {/* Lineage pill */}
      {model.lineageId && (
        <div className="px-5 pb-4">
          <div className="flex items-center gap-2 text-xs text-slate-500">
            <Layers size={12} className="text-slate-600" />
            <span>Lineage:</span>
            <span className="font-mono text-slate-400">{model.lineageId}</span>
          </div>
        </div>
      )}

      {/* Expanded Detail */}
      {expanded && (
        <div className="border-t border-white/[0.06] bg-black/20 px-5 py-4 space-y-4">
          {/* Dataset provenance block */}
          <div className="rounded-xl bg-cyan-500/5 border border-cyan-500/10 p-4 space-y-3">
            <p className="text-xs font-semibold uppercase tracking-widest text-cyan-500 flex items-center gap-1.5">
              <Database size={12} /> Training Dataset Provenance
            </p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-1">Full Hash (SHA-256)</p>
                <p
                  className="font-mono text-[11px] text-cyan-300 break-all bg-black/30 rounded-lg p-2.5 border border-white/5 cursor-pointer hover:border-cyan-500/30 transition-all"
                  onClick={() => copyToClipboard(model.datasetHash)}
                  title="Click to copy"
                >
                  {model.datasetHash ?? 'No dataset linked'}
                </p>
              </div>
              <div className="space-y-2">
                <div>
                  <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-1">Dataset Version</p>
                  <p className="text-sm font-semibold text-slate-200">
                    v{model.datasetVersion ?? '—'}
                  </p>
                </div>
                <div>
                  <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-1">Registered At</p>
                  <p className="text-xs text-slate-400">{model.datasetTimestamp ?? '—'}</p>
                </div>
              </div>
            </div>
          </div>

          {/* Ancestry */}
          {model.prevModelHash && (
            <div className="flex items-center gap-2 text-xs text-slate-500">
              <Link2 size={12} className="text-slate-600 flex-shrink-0" />
              <span>Previous model version:</span>
              <button
                onClick={() => copyToClipboard(model.prevModelHash)}
                className="font-mono text-slate-400 hover:text-slate-200 transition-colors"
                title={model.prevModelHash}
              >
                {short(model.prevModelHash)}
              </button>
            </div>
          )}

          {/* Wallet */}
          <div className="flex items-center gap-2 text-xs text-slate-500">
            <ShieldCheck size={12} className="text-slate-600 flex-shrink-0" />
            <span>Registered by:</span>
            <span className="font-mono text-slate-400">{model.wallet}</span>
          </div>
        </div>
      )}
    </div>
  );
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-24 text-center space-y-4">
      <div className="w-16 h-16 rounded-2xl bg-white/[0.03] border border-white/[0.07] flex items-center justify-center">
        <Cpu size={28} className="text-slate-600" />
      </div>
      <p className="text-slate-400 font-medium">No models registered yet</p>
      <p className="text-slate-600 text-sm max-w-xs">
        Register a dataset and model via <code className="text-cyan-500 font-mono text-xs">POST /dataset/register</code> or <code className="text-cyan-500 font-mono text-xs">POST /model/register</code> to see them here.
      </p>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function ModelManagement({ refreshTrigger }) {
  const [models, setModels]     = useState([]);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState(null);
  const [search, setSearch]     = useState('');
  const [spinning, setSpinning] = useState(false);

  const fetchModels = useCallback(async () => {
    setLoading(true);
    setError(null);
    setSpinning(true);
    try {
      const res = await axios.get(`${API_BASE}/model/models`);
      setModels(res.data);
    } catch (err) {
      setError('Failed to load models. Is the backend running?');
    } finally {
      setLoading(false);
      setTimeout(() => setSpinning(false), 600);
    }
  }, []);

  useEffect(() => { fetchModels(); }, [fetchModels]);

  // Re-fetch automatically whenever the parent signals a new model was registered
  useEffect(() => {
    if (refreshTrigger > 0) fetchModels();
  }, [refreshTrigger, fetchModels]);

  const filtered = models.filter((m) => {
    const q = search.toLowerCase();
    return (
      m.modelHash?.toLowerCase().includes(q) ||
      m.datasetHash?.toLowerCase().includes(q) ||
      m.lineageId?.toLowerCase().includes(q) ||
      m.wallet?.toLowerCase().includes(q)
    );
  });

  return (
    <div className="min-h-screen bg-[#0a0a0c] text-slate-200 p-6 md:p-10 font-sans">

      {/* ── Page Header ───────────────────────────────────────────────────── */}
      <div className="mb-8 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2.5">
            <Cpu className="text-violet-400" size={22} />
            Model Management
          </h1>
          <p className="text-slate-500 text-sm mt-1">
            View registered models and their linked Training Dataset hashes
          </p>
        </div>

        <div className="flex items-center gap-3">
          {/* Stats pill */}
          <div className="px-4 py-2 bg-white/[0.04] border border-white/[0.07] rounded-xl text-xs text-slate-400 flex items-center gap-1.5">
            <Hash size={12} className="text-violet-400" />
            <span className="font-semibold text-white">{models.length}</span> registered
          </div>
          <button
            onClick={fetchModels}
            className="flex items-center gap-2 px-4 py-2 bg-violet-600/80 hover:bg-violet-500 text-white text-sm font-medium rounded-xl transition-all shadow-lg shadow-violet-900/30"
          >
            <RefreshCw size={14} className={spinning ? 'animate-spin' : ''} />
            Refresh
          </button>
        </div>
      </div>

      {/* ── Search bar ────────────────────────────────────────────────────── */}
      <div className="relative mb-6">
        <Hash size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-600 pointer-events-none" />
        <input
          type="text"
          placeholder="Search by model hash, dataset hash, lineage ID, or wallet…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full bg-[#111114] border border-white/[0.07] rounded-xl pl-9 pr-4 py-2.5 text-sm text-slate-200 placeholder-slate-600 focus:outline-none focus:border-violet-500/50 transition-all"
        />
      </div>

      {/* ── Dataset → Model linkage explainer ─────────────────────────────── */}
      <div className="mb-6 flex items-center gap-3 text-xs text-slate-500 bg-white/[0.02] border border-white/[0.05] rounded-xl px-4 py-3">
        <Database size={13} className="text-cyan-500 flex-shrink-0" />
        <span className="text-cyan-400 font-semibold">Training Dataset Hash</span>
        <div className="flex-1 border-t border-dashed border-white/10" />
        <Link2 size={12} className="text-violet-500 flex-shrink-0" />
        <span className="text-violet-400 font-semibold">Model Hash</span>
        <div className="flex-1 border-t border-dashed border-white/10" />
        <ShieldCheck size={13} className="text-slate-600 flex-shrink-0" />
        <span>Provenance chain recorded in SQLite + Hardhat</span>
      </div>

      {/* ── Content ───────────────────────────────────────────────────────── */}
      {loading && (
        <div className="flex items-center justify-center py-24 gap-3 text-slate-500">
          <RefreshCw size={18} className="animate-spin text-violet-500" />
          <span className="text-sm">Fetching models…</span>
        </div>
      )}

      {error && !loading && (
        <div className="flex items-center gap-3 bg-red-500/10 border border-red-500/20 rounded-xl px-5 py-4 text-red-400 text-sm">
          <AlertCircle size={16} className="flex-shrink-0" />
          {error}
        </div>
      )}

      {!loading && !error && (
        <>
          {filtered.length === 0 ? (
            <EmptyState />
          ) : (
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
              {filtered.map((model, i) => (
                <ModelCard key={model.modelHash} model={model} index={i} />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}