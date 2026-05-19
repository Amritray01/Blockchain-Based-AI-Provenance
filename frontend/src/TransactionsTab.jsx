import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import {
  List, RefreshCw, AlertCircle, Database, Cpu, Layers,
  ExternalLink, Clock, Hash, CheckCircle2, Box
} from 'lucide-react';

const API = 'http://localhost:8000';
const short = (h, n = 10) => h ? `${h.slice(0, n)}…${h.slice(-4)}` : '—';
const maskWallet = (w) => w ? `${w.slice(0, 6)}…${w.slice(-4)}` : '—';

export default function TransactionsTab() {
  const [txs, setTxs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [spinning, setSpinning] = useState(false);

  const fetchTxs = useCallback(async () => {
    setLoading(true); setError(null); setSpinning(true);
    try {
      const res = await axios.get(`${API}/transactions`);
      setTxs(res.data);
    } catch {
      setError('Failed to load transaction log. Is the backend running?');
    } finally {
      setLoading(false);
      setTimeout(() => setSpinning(false), 600);
    }
  }, []);

  useEffect(() => { fetchTxs(); }, [fetchTxs]);

  const getTypeStyle = (type) => {
    switch (type) {
      case 'DATASET': return { color: 'text-amber-400', bg: 'bg-amber-500/10', border: 'border-amber-500/20', icon: Database };
      case 'MODEL':   return { color: 'text-violet-400', bg: 'bg-violet-500/10', border: 'border-violet-500/20', icon: Cpu };
      case 'BATCH':   return { color: 'text-cyan-400', bg: 'bg-cyan-500/10', border: 'border-cyan-500/20', icon: Layers };
      default:        return { color: 'text-slate-400', bg: 'bg-slate-500/10', border: 'border-slate-500/20', icon: Box };
    }
  };

  return (
    <div className="p-6 md:p-8 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <List size={18} className="text-emerald-400" />
            Transaction Flow
          </h2>
          <p className="text-slate-500 text-sm mt-0.5">
            Complete chronological log of all on-chain provenance anchors.
          </p>
        </div>
        <button onClick={fetchTxs} className="flex items-center gap-2 px-4 py-2 bg-white/[0.04] hover:bg-white/[0.07] border border-white/[0.07] rounded-xl text-xs text-slate-400 hover:text-white transition-all self-start">
          <RefreshCw size={12} className={spinning ? 'animate-spin' : ''} /> Refresh
        </button>
      </div>

      {loading && (
        <div className="flex items-center justify-center py-24 gap-3 text-slate-500">
          <RefreshCw size={18} className="animate-spin text-emerald-500" /><span className="text-sm">Loading transactions…</span>
        </div>
      )}

      {error && !loading && (
        <div className="flex items-center gap-3 bg-red-500/8 border border-red-500/15 rounded-xl px-5 py-4 text-red-400 text-sm">
          <AlertCircle size={14} /> {error}
        </div>
      )}

      {!loading && !error && txs.length === 0 && (
        <div className="flex flex-col items-center justify-center py-24 text-center space-y-4">
          <div className="w-16 h-16 rounded-2xl bg-white/[0.02] border border-white/[0.06] flex items-center justify-center">
            <List size={28} className="text-slate-700" />
          </div>
          <p className="text-slate-400 font-medium">No transactions found</p>
          <p className="text-slate-600 text-xs max-w-sm">No on-chain anchors have been mined yet.</p>
        </div>
      )}

      {!loading && !error && txs.length > 0 && (
        <div className="bg-[#08080c] border border-white/[0.05] rounded-2xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-white/[0.02] border-b border-white/[0.05] text-[10px] uppercase tracking-widest text-slate-500">
                  <th className="p-4 font-semibold">Block</th>
                  <th className="p-4 font-semibold">Type</th>
                  <th className="p-4 font-semibold">Lineage</th>
                  <th className="p-4 font-semibold">Tx Hash</th>
                  <th className="p-4 font-semibold">Hash / Root</th>
                  <th className="p-4 font-semibold">Fee (ETH)</th>
                  <th className="p-4 font-semibold">Wallet</th>
                  <th className="p-4 font-semibold">Time</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.03]">
                {txs.map((tx, idx) => {
                  const style = getTypeStyle(tx.type);
                  const Icon = style.icon;
                  return (
                    <tr key={`${tx.txHash}-${idx}`} className="hover:bg-white/[0.01] transition-colors">
                      <td className="p-4 align-middle">
                        <div className="flex items-center gap-1.5 text-slate-300 font-mono text-xs">
                          <Box size={12} className="text-slate-600" />
                          {tx.blockNumber}
                        </div>
                      </td>
                      <td className="p-4 align-middle">
                        <span className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider border ${style.bg} ${style.color} ${style.border}`}>
                          <Icon size={10} /> {tx.subtype}
                        </span>
                      </td>
                      <td className="p-4 align-middle">
                        <span className="text-xs text-slate-400 font-medium">{tx.lineageId || '—'}</span>
                      </td>
                      <td className="p-4 align-middle">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-xs text-emerald-400/80 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded">
                            {short(tx.txHash, 12)}
                          </span>
                        </div>
                      </td>
                      <td className="p-4 align-middle">
                        <span className="font-mono text-[10px] text-slate-500 bg-black/30 px-2 py-1 rounded border border-white/[0.04]">
                          {short(tx.hash, 16)}
                        </span>
                      </td>
                      <td className="p-4 align-middle">
                        <span className="font-mono text-xs text-amber-400/80">
                          {tx.feeEth ? Number(tx.feeEth).toFixed(5) : '0.00000'}
                        </span>
                      </td>
                      <td className="p-4 align-middle">
                        <span className="font-mono text-xs text-slate-400 bg-white/[0.03] px-2 py-0.5 rounded border border-white/[0.05]">
                          {maskWallet(tx.wallet)}
                        </span>
                      </td>
                      <td className="p-4 align-middle text-[11px] text-slate-500 flex items-center gap-1.5">
                        <Clock size={10} /> {tx.timestamp}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
