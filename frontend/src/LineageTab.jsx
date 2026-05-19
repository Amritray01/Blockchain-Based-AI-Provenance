import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import {
  Database, Cpu, Layers, RefreshCw, CheckCircle2, Clock,
  XCircle, AlertCircle, ArrowRight, Hash, ChevronDown,
  ChevronUp, GitBranch, Zap, Box
} from 'lucide-react';

const API = 'http://localhost:8000';
const short = (h, n = 10) => h ? `${h.slice(0, n)}…${h.slice(-4)}` : '—';

/* ── Atoms ─────────────────────────────────────────────────────────────────── */

function StatusPill({ status }) {
  if (!status) status = 'PENDING';
  const cfg = {
    MINED:   { cls: 'bg-emerald-500/12 text-emerald-400 border-emerald-500/25', icon: <CheckCircle2 size={9} /> },
    PENDING: { cls: 'bg-violet-500/12 text-violet-400 border-violet-500/25',   icon: <Clock size={9} className="animate-pulse" /> },
    FAILED:  { cls: 'bg-red-500/12 text-red-400 border-red-500/25',            icon: <XCircle size={9} /> },
  };
  const s = cfg[status] || cfg.PENDING;
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-widest border ${s.cls}`}>
      {s.icon}{status}
    </span>
  );
}

function ChainPill({ txHash }) {
  const m = !!txHash;
  return (
    <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[8px] font-bold uppercase tracking-widest border ${
      m ? 'bg-emerald-500/12 text-emerald-400 border-emerald-500/25'
        : 'bg-violet-500/12 text-violet-400 border-violet-500/25'
    }`}>
      {m ? <CheckCircle2 size={8} /> : <Clock size={8} className="animate-pulse" />}
      {m ? 'MINED' : 'PENDING'}
    </span>
  );
}

/* ── Compact Node Cards (horizontal-friendly) ──────────────────────────────── */

function DatasetCard({ ds }) {
  const [open, setOpen] = useState(false);
  const isTesting = ds.datasetType === 'TESTING';
  const ac = isTesting
    ? { border: 'border-sky-500/25', bg: 'bg-sky-500/8', icon: 'text-sky-400', hashClr: 'text-sky-300/80', glow: 'shadow-sky-950/20', tag: 'TESTING' }
    : { border: 'border-amber-500/25', bg: 'bg-amber-500/8', icon: 'text-amber-400', hashClr: 'text-amber-300/80', glow: 'shadow-amber-950/20', tag: 'TRAINING' };

  return (
    <div className={`min-w-[240px] max-w-[300px] flex-shrink-0 rounded-xl border ${ac.border} bg-[#0a0a10] shadow-md ${ac.glow} overflow-hidden`}>
      <div className={`h-[2px] ${isTesting ? 'bg-gradient-to-r from-sky-500/40 via-sky-500/20 to-transparent' : 'bg-gradient-to-r from-amber-500/40 via-amber-500/20 to-transparent'}`} />
      <div className="p-3">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-1.5">
            <div className={`w-6 h-6 rounded-lg ${ac.bg} border ${ac.border} flex items-center justify-center`}>
              <Database size={11} className={ac.icon} />
            </div>
            <div>
              <p className="text-[9px] uppercase tracking-widest text-slate-500 font-bold">{ac.tag}</p>
              <p className="text-[9px] text-slate-600">{ds.lineageId} · v{ds.version || 1}</p>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <ChainPill txHash={ds.txHash} />
            <button onClick={() => setOpen(!open)} className="w-4 h-4 flex items-center justify-center rounded hover:bg-white/5">
              {open ? <ChevronUp size={9} className="text-slate-600" /> : <ChevronDown size={9} className="text-slate-600" />}
            </button>
          </div>
        </div>
        <p className={`font-mono text-[9px] ${ac.hashClr} bg-black/30 border border-white/[0.04] rounded px-2 py-1 break-all leading-relaxed`}>
          {ds.hash}
        </p>
        {open && (
          <div className="mt-2 grid grid-cols-2 gap-1 text-[9px]">
            <div><p className="text-slate-600">Block</p><p className="font-mono text-slate-400">{ds.blockNumber ?? '—'}</p></div>
            <div><p className="text-slate-600">Tx</p><p className="font-mono text-slate-400 truncate">{ds.txHash ? short(ds.txHash, 12) : '—'}</p></div>
          </div>
        )}
      </div>
    </div>
  );
}

function ModelCard({ model }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="min-w-[240px] max-w-[300px] flex-shrink-0 rounded-xl border border-violet-500/25 bg-[#0a0a10] shadow-md shadow-violet-950/20 overflow-hidden">
      <div className="h-[2px] bg-gradient-to-r from-violet-500/40 via-violet-500/20 to-transparent" />
      <div className="p-3">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-1.5">
            <div className="w-6 h-6 rounded-lg bg-violet-500/8 border border-violet-500/25 flex items-center justify-center">
              <Cpu size={11} className="text-violet-400" />
            </div>
            <div>
              <p className="text-[9px] uppercase tracking-widest text-slate-500 font-bold">AI MODEL</p>
              <p className="text-[9px] text-slate-600">{model.lineageId}</p>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <ChainPill txHash={model.txHash} />
            <button onClick={() => setOpen(!open)} className="w-4 h-4 flex items-center justify-center rounded hover:bg-white/5">
              {open ? <ChevronUp size={9} className="text-slate-600" /> : <ChevronDown size={9} className="text-slate-600" />}
            </button>
          </div>
        </div>
        <p className="font-mono text-[9px] text-violet-300/80 bg-black/30 border border-white/[0.04] rounded px-2 py-1 break-all leading-relaxed">
          {model.modelHash}
        </p>
        {open && (
          <div className="mt-2 grid grid-cols-2 gap-1 text-[9px]">
            <div><p className="text-slate-600">Block</p><p className="font-mono text-slate-400">{model.blockNumber ?? '—'}</p></div>
            <div><p className="text-slate-600">Tx</p><p className="font-mono text-slate-400 truncate">{model.txHash ? short(model.txHash, 12) : '—'}</p></div>
            <div className="col-span-2"><p className="text-slate-600">File</p><p className="text-slate-400 truncate">{model.filePath || '—'}</p></div>
          </div>
        )}
      </div>
    </div>
  );
}

function BatchCard({ batch }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="min-w-[200px] max-w-[260px] flex-shrink-0 rounded-xl border border-cyan-500/20 bg-[#0a0a10] shadow-md shadow-cyan-950/15 overflow-hidden">
      <div className="h-[2px] bg-gradient-to-r from-cyan-500/40 via-cyan-500/20 to-transparent" />
      <div className="p-3">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-1.5">
            <div className="w-5 h-5 rounded bg-cyan-500/8 border border-cyan-500/20 flex items-center justify-center">
              <Layers size={10} className="text-cyan-400" />
            </div>
            <span className="text-[9px] text-slate-400 font-bold">Batch #{batch.batchId}</span>
          </div>
          <div className="flex items-center gap-1">
            <StatusPill status={batch.status} />
            <button onClick={() => setOpen(!open)} className="w-4 h-4 flex items-center justify-center rounded hover:bg-white/5">
              {open ? <ChevronUp size={9} className="text-slate-600" /> : <ChevronDown size={9} className="text-slate-600" />}
            </button>
          </div>
        </div>
        <div className="flex items-center gap-2 text-[9px] text-slate-600">
          <span className="flex items-center gap-0.5"><Hash size={8} />{batch.rowCount ?? 0} rows</span>
          <span className="font-mono">{batch.timestamp?.split(' ')[0]}</span>
        </div>
        {open && (
          <div className="mt-2 text-[9px]">
            <p className="text-slate-600 mb-0.5">Merkle Root</p>
            <p className="font-mono text-cyan-400/60 break-all text-[8px]">{batch.merkleRoot || '—'}</p>
          </div>
        )}
      </div>
    </div>
  );
}

/* ── Horizontal Arrow ──────────────────────────────────────────────────────── */

function HArrow({ label }) {
  return (
    <div className="flex flex-col items-center justify-center flex-shrink-0 px-1 self-center">
      <div className="flex items-center gap-1 px-2 py-0.5 bg-white/[0.03] border border-white/[0.06] rounded-full">
        <ArrowRight size={9} className="text-slate-500" />
        <span className="text-[8px] text-slate-600 uppercase tracking-widest font-semibold whitespace-nowrap">{label}</span>
      </div>
    </div>
  );
}

/* ── Horizontal Chain ──────────────────────────────────────────────────────── */

function HorizontalChain({ dataset, model, batches }) {
  return (
    <div className="flex items-start gap-2 overflow-x-auto pb-2 scrollbar-thin">
      {dataset && <DatasetCard ds={dataset} />}

      {model && (
        <>
          <HArrow label="trained" />
          <ModelCard model={model} />

          {batches.length > 0 && (
            <>
              <HArrow label={`${batches.length} batch${batches.length > 1 ? 'es' : ''}`} />
              {batches.map(b => (
                <React.Fragment key={b.batchId}>
                  <BatchCard batch={b} />
                </React.Fragment>
              ))}
            </>
          )}
        </>
      )}

      {!model && dataset && (
        <div className="flex items-center gap-2 self-center px-3 py-2 bg-white/[0.02] border border-white/[0.05] rounded-lg text-[9px] text-slate-600 flex-shrink-0">
          <Cpu size={10} className="text-slate-700" />
          No model linked yet
        </div>
      )}
    </div>
  );
}

/* ── Family Section ────────────────────────────────────────────────────────── */

function FamilySection({ lineageId, chains, familyIndex }) {
  const allMined = chains.every(c =>
    (!c.dataset || c.dataset.txHash) &&
    (!c.model   || c.model.txHash) &&
    c.batches.every(b => b.status === 'MINED')
  );
  const hasPending = chains.some(c =>
    (c.dataset && !c.dataset.txHash) || (c.model && !c.model.txHash) || c.batches.some(b => b.status === 'PENDING')
  );
  const totalBatches = chains.reduce((s, c) => s + c.batches.length, 0);
  const totalRows = chains.reduce((s, c) => s + c.batches.reduce((ss, b) => ss + (b.rowCount || 0), 0), 0);

  const accents = [
    { border: 'border-amber-500/15', headerBg: 'bg-amber-500/[0.04]', accent: 'text-amber-400', dot: 'bg-amber-400' },
    { border: 'border-cyan-500/15',  headerBg: 'bg-cyan-500/[0.04]',  accent: 'text-cyan-400',  dot: 'bg-cyan-400' },
    { border: 'border-violet-500/15',headerBg: 'bg-violet-500/[0.04]',accent: 'text-violet-400', dot: 'bg-violet-400' },
    { border: 'border-rose-500/15',  headerBg: 'bg-rose-500/[0.04]',  accent: 'text-rose-400',  dot: 'bg-rose-400' },
    { border: 'border-emerald-500/15',headerBg:'bg-emerald-500/[0.04]',accent:'text-emerald-400',dot: 'bg-emerald-400' },
  ];
  const ac = accents[familyIndex % accents.length];

  return (
    <div className={`rounded-2xl border ${ac.border} bg-[#08080c] overflow-hidden`}>
      {/* Header */}
      <div className={`px-5 py-3 ${ac.headerBg} border-b ${ac.border} flex items-center justify-between`}>
        <div className="flex items-center gap-3">
          <span className={`w-2.5 h-2.5 rounded-full ${ac.dot}`} />
          <div>
            <h3 className={`text-sm font-bold ${ac.accent} uppercase tracking-wide`}>{lineageId}</h3>
            <p className="text-[10px] text-slate-600 mt-0.5">
              {chains.length} chain{chains.length > 1 ? 's' : ''} · {totalBatches} batch{totalBatches !== 1 ? 'es' : ''} · {totalRows.toLocaleString()} rows
            </p>
          </div>
        </div>
        <StatusPill status={allMined ? 'MINED' : 'PENDING'} />
      </div>

      {/* Chains — each gets its own horizontal row */}
      <div className="p-4 space-y-4">
        {chains.map((c, i) => (
          <div key={c.id}>
            {chains.length > 1 && i > 0 && <div className="border-t border-white/[0.04] mb-4" />}
            <HorizontalChain dataset={c.dataset} model={c.model} batches={c.batches} />
          </div>
        ))}
      </div>
    </div>
  );
}

/* ── Stats ──────────────────────────────────────────────────────────────────── */

function StatCard({ icon: Icon, label, value, color }) {
  const c = {
    amber: 'text-amber-400 bg-amber-500/8 border-amber-500/15',
    violet: 'text-violet-400 bg-violet-500/8 border-violet-500/15',
    cyan: 'text-cyan-400 bg-cyan-500/8 border-cyan-500/15',
    emerald: 'text-emerald-400 bg-emerald-500/8 border-emerald-500/15',
  }[color];
  return (
    <div className={`flex items-center gap-3 px-4 py-3 rounded-xl border ${c} bg-[#0c0c12]`}>
      <Icon size={16} className={c.split(' ')[0]} />
      <div>
        <p className="text-lg font-bold text-white leading-none">{value}</p>
        <p className="text-[10px] text-slate-500 uppercase tracking-widest">{label}</p>
      </div>
    </div>
  );
}

/* ── Main ───────────────────────────────────────────────────────────────────── */

export default function LineageTab() {
  const [data, setData]       = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState(null);
  const [spinning, setSpinning] = useState(false);

  const fetchGraph = useCallback(async () => {
    setLoading(true); setError(null); setSpinning(true);
    try { setData((await axios.get(`${API}/lineage/graph`)).data); }
    catch { setError('Failed to load provenance graph.'); }
    finally { setLoading(false); setTimeout(() => setSpinning(false), 600); }
  }, []);

  useEffect(() => { fetchGraph(); }, [fetchGraph]);

  const families = {};
  if (data) {
    const { datasets = [], models = [], batches = [] } = data;
    const batchByModel = {};
    batches.forEach(b => { (batchByModel[b.modelHash] = batchByModel[b.modelHash] || []).push(b); });
    const usedDs = new Set();
    models.forEach(m => {
      const lid = m.lineageId || '_unlinked';
      const ds = datasets.find(d => d.hash === m.datasetHash);
      if (ds) usedDs.add(ds.hash);
      if (!families[lid]) families[lid] = [];
      families[lid].push({ id: m.modelHash, dataset: ds || null, model: m, batches: batchByModel[m.modelHash] || [] });
    });
    datasets.forEach(ds => {
      if (!usedDs.has(ds.hash)) {
        const lid = ds.lineageId || '_orphan';
        if (!families[lid]) families[lid] = [];
        families[lid].push({ id: ds.hash, dataset: ds, model: null, batches: [] });
      }
    });
  }

  const familyEntries = Object.entries(families);
  const minedAll = (data?.datasets.filter(d => d.txHash).length ?? 0) +
                   (data?.models.filter(m => m.txHash).length ?? 0) +
                   (data?.batches.filter(b => b.status === 'MINED').length ?? 0);

  return (
    <div className="p-6 md:p-8 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <GitBranch size={18} className="text-violet-400" />
            Provenance Graph
          </h2>
          <p className="text-slate-500 text-sm mt-0.5">Horizontal lineage — Dataset → Model → Batches</p>
        </div>
        <button onClick={fetchGraph} className="flex items-center gap-2 px-4 py-2 bg-white/[0.04] hover:bg-white/[0.07] border border-white/[0.07] rounded-xl text-xs text-slate-400 hover:text-white transition-all self-start">
          <RefreshCw size={12} className={spinning ? 'animate-spin' : ''} /> Refresh
        </button>
      </div>

      {/* Stats */}
      {data && (
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
          <StatCard icon={Box}          label="Families"  value={familyEntries.length} color="amber" />
          <StatCard icon={Database}     label="Datasets"  value={data.datasets.length} color="amber" />
          <StatCard icon={Cpu}          label="Models"    value={data.models.length}   color="violet" />
          <StatCard icon={Layers}       label="Batches"   value={data.batches.length}  color="cyan" />
          <StatCard icon={CheckCircle2} label="Mined"     value={minedAll}             color="emerald" />
        </div>
      )}

      {/* Legend */}
      <div className="flex flex-wrap items-center gap-4 text-[10px] bg-white/[0.02] border border-white/[0.05] rounded-xl px-4 py-2.5">
        {[
          { color: 'bg-amber-400', label: 'Training' }, { color: 'bg-sky-400', label: 'Testing' },
          { color: 'bg-violet-400', label: 'Model' }, { color: 'bg-cyan-400', label: 'Batch' },
          { color: 'bg-emerald-400', label: 'MINED' }, { color: 'bg-violet-400 animate-pulse', label: 'PENDING' },
        ].map(({ color, label }) => (
          <div key={label} className="flex items-center gap-1.5 text-slate-500"><span className={`w-2 h-2 rounded-full ${color}`} />{label}</div>
        ))}
      </div>

      {loading && (
        <div className="flex items-center justify-center py-24 gap-3 text-slate-500">
          <RefreshCw size={18} className="animate-spin text-violet-500" /><span className="text-sm">Building graph…</span>
        </div>
      )}

      {error && !loading && (
        <div className="flex items-center gap-3 bg-red-500/8 border border-red-500/15 rounded-xl px-5 py-4 text-red-400 text-sm">
          <AlertCircle size={14} /> {error}
        </div>
      )}

      {!loading && !error && familyEntries.length === 0 && (
        <div className="flex flex-col items-center justify-center py-24 text-center space-y-4">
          <div className="w-16 h-16 rounded-2xl bg-white/[0.02] border border-white/[0.06] flex items-center justify-center">
            <GitBranch size={28} className="text-slate-700" />
          </div>
          <p className="text-slate-400 font-medium">No provenance records yet</p>
          <p className="text-slate-600 text-xs max-w-sm">Register a dataset in <span className="text-amber-400 font-semibold">Vault</span>, link a model, run inference in <span className="text-cyan-400 font-semibold">Audit</span>.</p>
        </div>
      )}

      {!loading && !error && familyEntries.length > 0 && (
        <div className="space-y-5">
          {familyEntries.map(([lid, chains], idx) => (
            <FamilySection key={lid} lineageId={lid} chains={chains} familyIndex={idx} />
          ))}
        </div>
      )}
    </div>
  );
}
