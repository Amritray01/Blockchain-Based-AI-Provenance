import React, { useState, useEffect } from 'react';
import axios from 'axios';
import {
  Activity, Upload, CheckCircle2, XCircle, Clock, RefreshCw,
  ShieldCheck, Database, AlertCircle, Hash, Zap, Layers, Cpu, ChevronDown
} from 'lucide-react';

const API_BASE = 'http://localhost:8000';

const short = (hash, n = 14) =>
  hash ? `${hash.slice(0, n)}…${hash.slice(-6)}` : '—';

// ── Main Component ────────────────────────────────────────────────────────────

export default function AuditTab({ account }) {
  const [loading, setLoading]   = useState(false);
  const [status, setStatus]     = useState('Idle');
  const [results, setResults]   = useState([]);
  const [batchMeta, setBatchMeta] = useState(null);
  const [verifyStates, setVerifyStates] = useState({});

  // Model selector
  const [models, setModels]         = useState([]);
  const [selectedModel, setSelectedModel] = useState('');

  useEffect(() => {
    axios.get(`${API_BASE}/model/models`)
      .then(r => {
        const list = Array.isArray(r.data) ? r.data : [];
        setModels(list);
        if (list.length > 0) setSelectedModel(list[0].modelHash);
      })
      .catch(() => {});
  }, []);

  const parseCsv = (text) => {
    const lines = text.trim().split('\n').filter(Boolean);
    if (lines.length < 2) throw new Error('CSV must have a header row and at least one data row');
    const headers = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, ''));
    return lines.slice(1).map(line => {
      // Handle quoted fields that may contain commas
      const values = [];
      let current = '';
      let inQuotes = false;
      for (const ch of line) {
        if (ch === '"') { inQuotes = !inQuotes; }
        else if (ch === ',' && !inQuotes) { values.push(current.trim()); current = ''; }
        else { current += ch; }
      }
      values.push(current.trim());
      return Object.fromEntries(headers.map((h, i) => [h, values[i] ?? '']));
    });
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    // Reset so the same file can be re-uploaded if needed
    e.target.value = '';

    const isCsv  = file.name.toLowerCase().endsWith('.csv');
    const isJson = file.name.toLowerCase().endsWith('.json');
    if (!isCsv && !isJson) {
      setStatus('Unsupported file type — use .json or .csv');
      return;
    }

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const text = event.target.result;
        const data = isCsv ? parseCsv(text) : JSON.parse(text);
        await runBatchProcessing(data);
      } catch (err) {
        setStatus(`Parse error: ${err.message || 'Invalid file'}`);
      }
    };
    reader.readAsText(file);
  };

  const runBatchProcessing = async (data) => {
    if (!account) return alert('Connect wallet first!');
    setLoading(true);
    setStatus('Processing 25% segments…');
    setResults([]);
    setBatchMeta(null);

    try {
      if (!selectedModel) {
        setStatus('No model selected — register a model first');
        setLoading(false);
        return;
      }
      const response = await axios.post(`${API_BASE}/batch/predict`, {
        dataset: data,
        modelHash: selectedModel,
        wallet: account
      });
      const resData = response.data;

      // Handle both old batch_service response format and new format
      if (resData.segments) {
        setBatchMeta({
          batchId: resData.batchId,
          merkleRoot: resData.aggregateMerkleRoot,
          totalRows: resData.totalRows,
          segments: resData.segments,
        });
      }

      // results array from old format, or sample from new
      setResults(resData.results || resData.sample || []);
      setStatus('Batch Anchored');
    } catch (err) {
      console.error('Batch error:', err);
      setStatus('Processing Error');
    } finally {
      setLoading(false);
    }
  };

  const verifyProof = async (inputHash, outputHash) => {
    const key = inputHash + outputHash;
    setVerifyStates(prev => ({ ...prev, [key]: { loading: true, result: null } }));
    try {
      const res = await axios.post(`${API_BASE}/verify_prediction`, {
        inputHash,
        outputHash
      });
      setVerifyStates(prev => ({ ...prev, [key]: { loading: false, result: res.data } }));
    } catch {
      setVerifyStates(prev => ({
        ...prev,
        [key]: { loading: false, result: { valid: false, message: 'Verification service unreachable.' } }
      }));
    }
  };

  return (
    <div className="p-6 md:p-8 space-y-6">

      {/* ── Header ───────────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <Activity size={18} className="text-cyan-400" />
            Inference Audit Log
          </h2>
          <p className="text-slate-500 text-sm mt-0.5">
            Micro Track — Row-level Merkle Root verification
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 px-3 py-1.5 bg-cyan-500/8 border border-cyan-500/12 rounded-lg text-xs text-cyan-400">
            <Hash size={11} />
            <span className="font-semibold text-white">{results.length}</span> rows
          </div>
          <div className={`
            flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-mono border transition-all
            ${status === 'Idle'
              ? 'bg-white/[0.03] border-white/[0.06] text-slate-500'
              : status.includes('Error')
                ? 'bg-red-500/8 border-red-500/15 text-red-400'
                : 'bg-cyan-500/8 border-cyan-500/15 text-cyan-400'
            }
          `}>
            {loading && <RefreshCw size={10} className="animate-spin" />}
            {status}
          </div>
        </div>
      </div>

      {/* ── Model selector ────────────────────────────────────────────────── */}
      <div className="bg-[#0c0c12] border border-white/[0.06] rounded-2xl p-4">
        <div className="flex items-center gap-2 mb-2">
          <Cpu size={13} className="text-violet-400" />
          <span className="text-[10px] uppercase tracking-widest text-slate-500 font-semibold">Active Model</span>
        </div>
        {models.length === 0 ? (
          <p className="text-xs text-slate-600 py-1">No models registered — go to Vault tab first</p>
        ) : (
          <div className="relative">
            <select
              value={selectedModel}
              onChange={e => setSelectedModel(e.target.value)}
              className="w-full appearance-none bg-black/30 border border-white/[0.06] rounded-lg px-3 py-2 text-xs font-mono text-slate-200 focus:outline-none focus:border-violet-500/40 transition-colors cursor-pointer"
            >
              {models.map(m => (
                <option key={m.modelHash} value={m.modelHash}>
                  {m.lineageId ? `${m.lineageId} · ` : ''}{m.modelHash.slice(0, 18)}…{m.modelHash.slice(-6)}
                </option>
              ))}
            </select>
            <ChevronDown size={12} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
          </div>
        )}
      </div>

      {/* ── Controller panel ─────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Upload */}
        <label className="group flex flex-col items-center justify-center gap-3 p-6 bg-[#0c0c12] border-2 border-dashed border-white/[0.06] rounded-2xl cursor-pointer hover:border-cyan-500/30 transition-all">
          <div className="w-10 h-10 rounded-xl bg-cyan-500/8 border border-cyan-500/15 flex items-center justify-center group-hover:bg-cyan-500/15 transition-all">
            <Upload size={18} className="text-cyan-400" />
          </div>
          <div className="text-center">
            <p className="text-sm text-slate-300 font-medium">Upload Inference Data</p>
            <p className="text-[11px] text-slate-600 mt-0.5">JSON or CSV · Max 1000 rows · 4 × 25% segments</p>
          </div>
          <input type="file" accept=".json,.csv" className="hidden" onChange={handleFileUpload} />
        </label>

        {/* Batch meta card */}
        <div className="lg:col-span-2 bg-[#0c0c12] border border-white/[0.06] rounded-2xl p-5">
          <div className="flex items-center gap-2 mb-3">
            <Zap size={13} className="text-cyan-500" />
            <span className="text-[10px] uppercase tracking-widest text-slate-500 font-semibold">Batch Summary</span>
          </div>
          {batchMeta ? (
            <div className="space-y-3">
              {/* Aggregate root */}
              <div className="bg-black/30 rounded-lg border border-white/[0.04] p-3">
                <p className="text-[10px] text-slate-600 uppercase tracking-wider mb-1 font-semibold">Aggregate Merkle Root</p>
                <p className="font-mono text-[11px] text-cyan-300/80 break-all">{batchMeta.merkleRoot}</p>
              </div>
              {/* Segment roots */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {batchMeta.segments.map((seg, i) => (
                  <div key={i} className="bg-black/20 rounded-lg border border-white/[0.04] p-2">
                    <p className="text-[9px] text-slate-600 uppercase tracking-wider font-semibold">Seg {i} · {seg.rows} rows</p>
                    <p className="font-mono text-[10px] text-cyan-400/60 mt-0.5 truncate" title={seg.segMerkleRoot}>
                      {seg.segMerkleRoot ? short(seg.segMerkleRoot, 10) : '—'}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-6 text-center">
              <Layers size={20} className="text-slate-700 mb-2" />
              <p className="text-xs text-slate-600">Upload inference data to see Merkle Tree details</p>
            </div>
          )}
        </div>
      </div>

      {/* ── Provenance explainer ─────────────────────────────────────────── */}
      <div className="flex items-center gap-3 text-[11px] text-slate-600 bg-cyan-500/[0.03] border border-cyan-500/[0.08] rounded-xl px-4 py-2.5">
        <Layers size={12} className="text-cyan-500/60 flex-shrink-0" />
        <span>Each 250-row segment produces a</span>
        <code className="text-cyan-400/80 bg-black/20 px-1.5 py-0.5 rounded text-[10px]">Merkle Root</code>
        <span>for</span>
        <span className="text-cyan-400/80 font-semibold">Tier-2 Micro Verification</span>
        <span className="hidden sm:inline">via on-chain proof path</span>
      </div>

      {/* ── Loading shimmer ──────────────────────────────────────────────── */}
      {loading && (
        <div className="space-y-2">
          {[0,1,2,3].map(i => (
            <div key={i} className="h-14 rounded-xl bg-[#0c0c12] border border-white/[0.04] animate-shimmer" />
          ))}
        </div>
      )}

      {/* ── Inference table ──────────────────────────────────────────────── */}
      {!loading && results.length > 0 && (
        <div className="bg-[#0c0c12] border border-white/[0.06] rounded-2xl overflow-hidden">
          {/* Table header */}
          <div className="px-5 py-3 border-b border-white/[0.05] flex items-center justify-between bg-white/[0.01]">
            <div className="flex items-center gap-2">
              <Activity size={14} className="text-cyan-400" />
              <span className="text-sm font-semibold text-white">Live Stream</span>
            </div>
            <div className="flex gap-3 text-[10px] font-bold uppercase tracking-widest text-slate-600">
              <span className="flex items-center gap-1"><Database size={10}/> SQLite</span>
              <span className="flex items-center gap-1"><ShieldCheck size={10}/> Hardhat</span>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead className="bg-white/[0.015]">
                <tr className="text-[10px] text-slate-600 uppercase tracking-widest font-bold">
                  <th className="px-5 py-3 w-8">#</th>
                  <th className="px-5 py-3">Input Hash</th>
                  <th className="px-5 py-3">Prediction</th>
                  <th className="px-5 py-3">Score</th>
                  <th className="px-5 py-3 text-right">Proof</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.03]">
                {results.map((res, i) => {
                  const key = (res.inputHash || '') + (res.outputHash || '');
                  const vs = verifyStates[key];
                  return (
                    <tr
                      key={i}
                      className="hover:bg-white/[0.02] transition-colors group animate-fade-in-up"
                      style={{ animationDelay: `${i * 20}ms` }}
                    >
                      <td className="px-5 py-3 text-[10px] text-slate-700 font-mono">{i + 1}</td>
                      <td className="px-5 py-3">
                        <span
                          className="font-mono text-xs text-slate-400 cursor-pointer hover:text-cyan-400 transition-colors"
                          onClick={() => navigator.clipboard.writeText(res.inputHash)}
                          title={res.inputHash}
                        >
                          {short(res.inputHash, 16)}
                        </span>
                      </td>
                      <td className="px-5 py-3">
                        {res.result ? (
                          <span className={`
                            inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider border
                            ${res.result.label === 'High Risk'
                              ? 'bg-red-500/10 text-red-400 border-red-500/20'
                              : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                            }
                          `}>
                            {res.result.label}
                          </span>
                        ) : (
                          <span className="text-xs text-slate-600">—</span>
                        )}
                      </td>
                      <td className="px-5 py-3 text-sm font-medium text-slate-300 tabular-nums">
                        {res.result ? `${(res.result.score * 100).toFixed(1)}%` : '—'}
                      </td>
                      <td className="px-5 py-3 text-right">
                        {vs?.result ? (
                          <span className={`inline-flex items-center gap-1 text-[10px] font-bold ${
                            vs.result.valid ? 'text-emerald-400' : 'text-red-400'
                          }`}>
                            {vs.result.valid ? <CheckCircle2 size={11} /> : <XCircle size={11} />}
                            {vs.result.valid ? 'Verified' : 'Unverified'}
                          </span>
                        ) : (
                          <button
                            onClick={() => verifyProof(res.inputHash, res.outputHash)}
                            disabled={vs?.loading}
                            className="opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1.5 ml-auto px-3 py-1.5 rounded-lg text-xs font-semibold bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-400 hover:text-cyan-300 border border-cyan-500/15 hover:border-cyan-500/30"
                          >
                            {vs?.loading ? (
                              <><RefreshCw size={11} className="animate-spin" /> …</>
                            ) : (
                              <><ShieldCheck size={11} /> Verify Proof</>
                            )}
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Empty state ──────────────────────────────────────────────────── */}
      {!loading && results.length === 0 && (
        <div className="flex flex-col items-center justify-center py-20 text-center space-y-4">
          <div className="w-14 h-14 rounded-2xl bg-white/[0.02] border border-white/[0.06] flex items-center justify-center">
            <Activity size={24} className="text-slate-700" />
          </div>
          <p className="text-slate-400 font-medium text-sm">No active inference stream</p>
          <p className="text-slate-600 text-xs max-w-sm">
            Upload a 1000-row JSON dataset above. The system processes it in 4 serial 25% segments, builds Merkle Roots, and shows each row's hash here.
          </p>
        </div>
      )}
    </div>
  );
}