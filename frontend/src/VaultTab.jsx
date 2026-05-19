import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import {
  Database, Hash, Clock, RefreshCw, ShieldCheck, AlertCircle,
  FileText, Tag, ChevronDown, ChevronUp, CheckCircle2, XCircle,
  Lock, Search, Layers, ExternalLink, FolderOpen, Plus, ArrowRight, Cpu
} from 'lucide-react';

const API_BASE = 'http://localhost:8000';

// ── Helpers ───────────────────────────────────────────────────────────────────

const short = (hash, n = 12) =>
  hash ? `${hash.slice(0, n)}…${hash.slice(-6)}` : '—';

const copyHash = (text) => {
  navigator.clipboard.writeText(text).catch(() => {});
};

function TypeBadge({ type }) {
  const isTraining = type === 'TRAINING';
  return (
    <span className={`
      inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider border
      ${isTraining
        ? 'bg-amber-500/10 text-amber-400 border-amber-500/20'
        : 'bg-sky-500/10 text-sky-400 border-sky-500/20'
      }
    `}>
      <Tag size={10} />
      {type}
    </span>
  );
}

function StatusPill({ status }) {
  const styles = {
    PENDING: 'bg-violet-500/10 text-violet-400 border-violet-500/20',
    MINED:   'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
    FAILED:  'bg-red-500/10 text-red-400 border-red-500/20',
  };
  const icons = {
    PENDING: <Clock size={10} className="animate-pulse" />,
    MINED:   <CheckCircle2 size={10} />,
    FAILED:  <XCircle size={10} />,
  };
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider border ${styles[status] || styles.PENDING}`}>
      {icons[status] || icons.PENDING}
      {status || 'PENDING'}
    </span>
  );
}

function ChainStatusBadge({ txHash }) {
  const mined = !!txHash;
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-widest border ${
      mined
        ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
        : 'bg-violet-500/10 text-violet-400 border-violet-500/20'
    }`}>
      {mined ? <CheckCircle2 size={9} /> : <Clock size={9} className="animate-pulse" />}
      {mined ? 'MINED' : 'PENDING'}
    </span>
  );
}

function CopyableHash({ value, accent = 'amber' }) {
  const [copied, setCopied] = useState(false);
  const colorMap = {
    amber: 'text-amber-300 hover:text-amber-200',
    cyan:  'text-cyan-300 hover:text-cyan-200',
    slate: 'text-slate-400 hover:text-slate-300',
  };
  const handleCopy = () => {
    copyHash(value);
    setCopied(true);
    setTimeout(() => setCopied(false), 1200);
  };
  return (
    <button
      onClick={handleCopy}
      title={`Click to copy: ${value}`}
      className={`font-mono text-xs transition-colors cursor-pointer ${colorMap[accent]}`}
    >
      {copied ? '✓ copied' : short(value)}
    </button>
  );
}

// ── Dataset Card ──────────────────────────────────────────────────────────────

function DatasetCard({ ds, index, onVerify, verifyState }) {
  const [expanded, setExpanded] = useState(false);
  const isVerifying = verifyState?.loading;
  const verifyResult = verifyState?.result;

  return (
    <div
      className="animate-fade-in-up bg-[#0c0c12] border border-white/[0.06] rounded-2xl overflow-hidden transition-all duration-300 hover:border-white/[0.12] hover:shadow-lg hover:shadow-amber-950/20 group"
      style={{ animationDelay: `${index * 50}ms` }}
    >
      {/* Top gradient accent */}
      <div className="h-[2px] bg-gradient-to-r from-amber-500/0 via-amber-500/40 to-amber-500/0" />

      <div className="p-5">
        {/* Header row */}
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-amber-500/8 border border-amber-500/15 flex items-center justify-center flex-shrink-0">
              <FileText size={16} className="text-amber-400" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <CopyableHash value={ds.hash} accent="amber" />
                <TypeBadge type={ds.datasetType || 'TRAINING'} />
              </div>
              <p className="text-[11px] text-slate-500 mt-0.5 flex items-center gap-1.5">
                <Clock size={10} />
                {ds.timestamp || 'N/A'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <ChainStatusBadge txHash={ds.txHash} />
            <span className="text-[10px] font-semibold text-slate-500 bg-white/[0.04] px-2 py-0.5 rounded-md border border-white/[0.06]">
              v{ds.version || 1}
            </span>
            <button
              onClick={() => setExpanded(!expanded)}
              className="w-7 h-7 rounded-lg bg-white/[0.03] hover:bg-white/[0.07] flex items-center justify-center transition-all"
            >
              {expanded
                ? <ChevronUp size={13} className="text-slate-500" />
                : <ChevronDown size={13} className="text-slate-500" />}
            </button>
          </div>
        </div>

        {/* Hash display */}
        <div className="bg-black/30 rounded-lg border border-white/[0.04] p-3 mb-3">
          <p className="text-[10px] text-slate-600 uppercase tracking-wider mb-1 font-semibold">SHA-256 File Hash</p>
          <p
            className="font-mono text-[11px] text-amber-300/80 break-all leading-relaxed cursor-pointer hover:text-amber-200 transition-colors"
            onClick={() => copyHash(ds.hash)}
            title="Click to copy full hash"
          >
            {ds.hash}
          </p>
        </div>

        {/* Actions */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-[11px] text-slate-600">
            {ds.lineageId && (
              <span className="flex items-center gap-1">
                <Layers size={10} />
                {ds.lineageId}
              </span>
            )}
            {ds.prevHash && (
              <span className="flex items-center gap-1 text-slate-600">
                ← prev: <CopyableHash value={ds.prevHash} accent="slate" />
              </span>
            )}
          </div>
          <button
            onClick={() => onVerify(ds.hash)}
            disabled={isVerifying}
            className={`
              flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all
              ${isVerifying
                ? 'bg-amber-500/5 text-amber-500/50 cursor-wait'
                : 'bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 hover:text-amber-300 border border-amber-500/15 hover:border-amber-500/30'
              }
            `}
          >
            {isVerifying ? (
              <><RefreshCw size={12} className="animate-spin" /> Verifying…</>
            ) : (
              <><ShieldCheck size={12} /> Verify File</>
            )}
          </button>
        </div>

        {/* Verify result */}
        {verifyResult && (
          <div className={`mt-3 p-3 rounded-lg border text-xs ${
            verifyResult.valid
              ? 'bg-emerald-500/5 border-emerald-500/15 text-emerald-400'
              : 'bg-red-500/5 border-red-500/15 text-red-400'
          }`}>
            <div className="flex items-center gap-1.5 font-semibold mb-1">
              {verifyResult.valid ? <CheckCircle2 size={12} /> : <AlertCircle size={12} />}
              {verifyResult.valid ? 'Hash Verified On-Chain' : 'Not Found On-Chain'}
            </div>
            <p className="text-[11px] opacity-70">{verifyResult.message}</p>
          </div>
        )}
      </div>

      {/* Expanded details */}
      {expanded && (
        <div className="border-t border-white/[0.05] bg-black/20 px-5 py-4 space-y-2">
          <div className="grid grid-cols-2 gap-4 text-[11px]">
            <div>
              <p className="text-slate-600 uppercase tracking-wider mb-0.5 font-semibold">Wallet</p>
              <p className="font-mono text-slate-400">{ds.wallet || '—'}</p>
            </div>
            <div>
              <p className="text-slate-600 uppercase tracking-wider mb-0.5 font-semibold">Tx Hash</p>
              <p className="font-mono text-slate-400">{ds.txHash ? short(ds.txHash) : 'Awaiting anchor'}</p>
            </div>
            <div>
              <p className="text-slate-600 uppercase tracking-wider mb-0.5 font-semibold">Block #</p>
              <p className="font-mono text-slate-400">{ds.blockNumber ?? '—'}</p>
            </div>
            <div>
              <p className="text-slate-600 uppercase tracking-wider mb-0.5 font-semibold">Lineage ID</p>
              <p className="font-mono text-slate-400">{ds.lineageId || '—'}</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────

export default function VaultTab({ account, onModelRegistered }) {
  const [datasets, setDatasets]       = useState([]);
  const [loading, setLoading]         = useState(true);
  const [error, setError]             = useState(null);
  const [search, setSearch]           = useState('');
  const [filterType, setFilterType]   = useState('ALL'); // ALL | TRAINING | TESTING
  const [verifyStates, setVerifyStates] = useState({}); // { [hash]: { loading, result } }

  // ── Registration form state ─────────────────────────────────────────────
  const [showForm, setShowForm]         = useState(false);
  const [regFilePath, setRegFilePath]   = useState('');
  const [regLineageId, setRegLineageId] = useState('');
  const [regType, setRegType]           = useState('TRAINING');
  const [regLoading, setRegLoading]     = useState(false);
  const [regResult, setRegResult]       = useState(null); // { success, data?, error? }

  // ── Model registration form state ──────────────────────────────────
  const [showModelForm, setShowModelForm]         = useState(false);
  const [mFilePath, setMFilePath]                 = useState('');
  const [mDatasetHash, setMDatasetHash]           = useState('');
  const [mLineageId, setMLineageId]               = useState('');
  const [mLoading, setMLoading]                   = useState(false);
  const [mResult, setMResult]                     = useState(null); // { success, data?, error? }

  const fetchDatasets = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await axios.get(`${API_BASE}/dataset/list`);
      setDatasets(Array.isArray(res.data) ? res.data : []);
    } catch {
      // Datasets endpoint might not return data yet — show empty state
      setDatasets([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchDatasets(); }, [fetchDatasets]);

  const registerDataset = async () => {
    if (!account) return alert('Connect your wallet first!');
    if (!regFilePath.trim()) return alert('Enter a file path on D: Drive');
    if (!regLineageId.trim()) return alert('Enter a Lineage ID');

    setRegLoading(true);
    setRegResult(null);
    try {
      const res = await axios.post(`${API_BASE}/dataset/register`, {
        filePath: regFilePath.trim(),
        wallet: account,
        lineageId: regLineageId.trim(),
        datasetType: regType,
      });
      setRegResult({ success: true, data: res.data });
      // Refresh the dataset list
      fetchDatasets();
      // Reset form after success
      setRegFilePath('');
      setRegLineageId('');
    } catch (err) {
      const msg = err.response?.data?.detail || err.message || 'Registration failed';
      setRegResult({ success: false, error: msg });
    } finally {
      setRegLoading(false);
    }
  };

  const registerModel = async () => {
    if (!account)         return alert('Connect your wallet first!');
    if (!mFilePath.trim())     return alert('Enter the path to your .pkl file on D: Drive');
    if (!mDatasetHash.trim())  return alert('Enter the Training Dataset Hash this model was trained on');
    if (!mLineageId.trim())    return alert('Enter a Lineage ID');

    setMLoading(true);
    setMResult(null);
    try {
      const res = await axios.post(`${API_BASE}/model/register`, {
        filePath:    mFilePath.trim(),
        datasetHash: mDatasetHash.trim(),
        wallet:      account,
        lineageId:   mLineageId.trim(),
      });
      setMResult({ success: true, data: res.data });
      setMFilePath('');
      setMDatasetHash('');
      setMLineageId('');
      // Notify parent so ModelManagement can refresh its list
      if (typeof onModelRegistered === 'function') onModelRegistered();
    } catch (err) {
      const msg = err.response?.data?.detail || err.message || 'Model registration failed';
      setMResult({ success: false, error: msg });
    } finally {
      setMLoading(false);
    }
  };

  const verifyFile = async (hash) => {
    setVerifyStates(prev => ({ ...prev, [hash]: { loading: true, result: null } }));
    try {
      const res = await axios.post(`${API_BASE}/dataset/verify`, { hash });
      setVerifyStates(prev => ({ ...prev, [hash]: { loading: false, result: res.data } }));
    } catch {
      setVerifyStates(prev => ({
        ...prev,
        [hash]: { loading: false, result: { valid: false, message: 'Verification service unreachable.' } }
      }));
    }
  };

  const filtered = datasets.filter(ds => {
    const q = search.toLowerCase();
    const matchesSearch = !q ||
      ds.hash?.toLowerCase().includes(q) ||
      ds.lineageId?.toLowerCase().includes(q) ||
      ds.wallet?.toLowerCase().includes(q);
    const matchesType = filterType === 'ALL' || ds.datasetType === filterType;
    return matchesSearch && matchesType;
  });

  const trainingCount = datasets.filter(d => d.datasetType === 'TRAINING').length;
  const testingCount  = datasets.filter(d => d.datasetType === 'TESTING').length;

  return (
    <div className="p-6 md:p-8 space-y-6">

      {/* ── Header ───────────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <Lock size={18} className="text-amber-400" />
            Dataset Registry
          </h2>
          <p className="text-slate-500 text-sm mt-0.5">
            Macro Track — File-level SHA-256 integrity verification
          </p>
        </div>
        <div className="flex items-center gap-3">
          {/* Stats */}
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-500/8 border border-amber-500/12 rounded-lg text-xs text-amber-400">
              <Database size={11} />
              <span className="font-semibold text-white">{trainingCount}</span> Training
            </div>
            <div className="flex items-center gap-1.5 px-3 py-1.5 bg-sky-500/8 border border-sky-500/12 rounded-lg text-xs text-sky-400">
              <Database size={11} />
              <span className="font-semibold text-white">{testingCount}</span> Testing
            </div>
          </div>
          <button
            onClick={fetchDatasets}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-white/[0.04] hover:bg-white/[0.07] border border-white/[0.07] rounded-lg text-xs text-slate-400 hover:text-white transition-all"
          >
            <RefreshCw size={12} className={loading ? 'animate-spin' : ''} />
            Refresh
          </button>
        </div>
      </div>

      {/* ── Register Dataset Panel ────────────────────────────────────── */}
      <div className="bg-[#0c0c12] border border-white/[0.06] rounded-2xl overflow-hidden">
        {/* Toggle header */}
        <button
          onClick={() => setShowForm(!showForm)}
          className="w-full flex items-center justify-between px-5 py-4 hover:bg-white/[0.02] transition-colors"
        >
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center">
              <Plus size={16} className="text-amber-400" />
            </div>
            <div className="text-left">
              <p className="text-sm font-semibold text-white">Register Training Data</p>
              <p className="text-[11px] text-slate-500">Point to a file on D: Drive — hashed in 8KB chunks, never loaded into RAM</p>
            </div>
          </div>
          {showForm
            ? <ChevronUp size={16} className="text-slate-500" />
            : <ChevronDown size={16} className="text-slate-500" />
          }
        </button>

        {/* Form body */}
        {showForm && (
          <div className="border-t border-white/[0.05] px-5 py-5 space-y-4">
            {/* File path */}
            <div>
              <label className="text-[10px] uppercase tracking-widest text-slate-500 font-semibold mb-1.5 block">
                File Path on D: Drive
              </label>
              <div className="relative">
                <FolderOpen size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-600 pointer-events-none" />
                <input
                  type="text"
                  placeholder="D:/datasets/training_data.csv"
                  value={regFilePath}
                  onChange={e => setRegFilePath(e.target.value)}
                  className="w-full bg-black/30 border border-white/[0.06] rounded-lg pl-9 pr-4 py-2.5 text-sm font-mono text-slate-200 placeholder-slate-700 focus:outline-none focus:border-amber-500/40 transition-colors"
                />
              </div>
            </div>

            {/* Lineage + Type row */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="text-[10px] uppercase tracking-widest text-slate-500 font-semibold mb-1.5 block">
                  Lineage ID
                </label>
                <div className="relative">
                  <Layers size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-600 pointer-events-none" />
                  <input
                    type="text"
                    placeholder="e.g. fraud-detection-v1"
                    value={regLineageId}
                    onChange={e => setRegLineageId(e.target.value)}
                    className="w-full bg-black/30 border border-white/[0.06] rounded-lg pl-9 pr-4 py-2.5 text-sm text-slate-200 placeholder-slate-700 focus:outline-none focus:border-amber-500/40 transition-colors"
                  />
                </div>
              </div>
              <div>
                <label className="text-[10px] uppercase tracking-widest text-slate-500 font-semibold mb-1.5 block">
                  Dataset Type
                </label>
                <div className="flex gap-2">
                  {['TRAINING', 'TESTING'].map(t => (
                    <button
                      key={t}
                      onClick={() => setRegType(t)}
                      className={`flex-1 py-2.5 rounded-lg text-xs font-semibold transition-all border ${
                        regType === t
                          ? t === 'TRAINING'
                            ? 'bg-amber-500/15 text-amber-400 border-amber-500/25'
                            : 'bg-sky-500/15 text-sky-400 border-sky-500/25'
                          : 'bg-black/20 text-slate-500 border-white/[0.06] hover:border-white/[0.12]'
                      }`}
                    >
                      {t}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Wallet display + Submit */}
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-2 text-[11px] text-slate-500">
                <ShieldCheck size={12} className="text-slate-600" />
                <span>Wallet:</span>
                <span className="font-mono text-slate-400">
                  {account ? `${account.substring(0, 8)}…${account.substring(38)}` : 'Not connected'}
                </span>
              </div>
              <button
                onClick={registerDataset}
                disabled={regLoading || !account}
                className={`
                  flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold transition-all
                  ${regLoading || !account
                    ? 'bg-amber-500/5 text-amber-500/40 cursor-not-allowed'
                    : 'bg-amber-500/15 hover:bg-amber-500/25 text-amber-400 hover:text-amber-300 border border-amber-500/20 hover:border-amber-500/40 shadow-lg shadow-amber-950/20'
                  }
                `}
              >
                {regLoading ? (
                  <><RefreshCw size={14} className="animate-spin" /> Hashing file…</>
                ) : (
                  <><ArrowRight size={14} /> Register Dataset</>
                )}
              </button>
            </div>

            {/* Result */}
            {regResult && (
              <div className={`p-4 rounded-xl border text-sm ${
                regResult.success
                  ? 'bg-emerald-500/5 border-emerald-500/15 text-emerald-400'
                  : 'bg-red-500/5 border-red-500/15 text-red-400'
              }`}>
                {regResult.success ? (
                  <div className="space-y-2">
                    <div className="flex items-center gap-1.5 font-semibold">
                      <CheckCircle2 size={14} /> Dataset Registered Successfully
                    </div>
                    <div className="bg-black/20 rounded-lg p-3 font-mono text-[11px] text-emerald-300/80 break-all">
                      {regResult.data?.hash}
                    </div>
                    <div className="flex items-center gap-4 text-[11px] text-emerald-400/60">
                      <span>Version: v{regResult.data?.version}</span>
                      <span>Type: {regResult.data?.datasetType}</span>
                      <span>Lineage: {regResult.data?.lineageId}</span>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <AlertCircle size={14} />
                    <span>{regResult.error}</span>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── Register Model (.pkl) Panel ─────────────────────────────────── */}
      <div className="bg-[#0c0c12] border border-white/[0.06] rounded-2xl overflow-hidden">
        {/* Toggle header */}
        <button
          onClick={() => setShowModelForm(!showModelForm)}
          className="w-full flex items-center justify-between px-5 py-4 hover:bg-white/[0.02] transition-colors"
        >
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-violet-500/10 border border-violet-500/20 flex items-center justify-center">
              <Cpu size={16} className="text-violet-400" />
            </div>
            <div className="text-left">
              <p className="text-sm font-semibold text-white">Register ML Model (.pkl)</p>
              <p className="text-[11px] text-slate-500">Point to a .pkl on D: Drive — stream-hashed and linked to its Training Dataset</p>
            </div>
          </div>
          {showModelForm
            ? <ChevronUp size={16} className="text-slate-500" />
            : <ChevronDown size={16} className="text-slate-500" />
          }
        </button>

        {showModelForm && (
          <div className="border-t border-white/[0.05] px-5 py-5 space-y-4">

            {/* .pkl file path */}
            <div>
              <label className="text-[10px] uppercase tracking-widest text-slate-500 font-semibold mb-1.5 block">
                .pkl File Path on D: Drive
              </label>
              <div className="relative">
                <Cpu size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-600 pointer-events-none" />
                <input
                  type="text"
                  placeholder="D:/models/fraud_classifier_v2.pkl"
                  value={mFilePath}
                  onChange={e => setMFilePath(e.target.value)}
                  className="w-full bg-black/30 border border-white/[0.06] rounded-lg pl-9 pr-4 py-2.5 text-sm font-mono text-slate-200 placeholder-slate-700 focus:outline-none focus:border-violet-500/40 transition-colors"
                />
              </div>
            </div>

            {/* Dataset hash + Lineage row */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="text-[10px] uppercase tracking-widest text-slate-500 font-semibold mb-1.5 block">
                  Training Dataset Hash
                </label>
                <div className="relative">
                  <Database size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-600 pointer-events-none" />
                  <input
                    type="text"
                    placeholder="0x… SHA-256 from Vault"
                    value={mDatasetHash}
                    onChange={e => setMDatasetHash(e.target.value)}
                    className="w-full bg-black/30 border border-white/[0.06] rounded-lg pl-9 pr-4 py-2.5 text-sm font-mono text-slate-200 placeholder-slate-700 focus:outline-none focus:border-violet-500/40 transition-colors"
                  />
                </div>
                <p className="text-[10px] text-slate-600 mt-1">Copy it from a registered dataset card above ↑</p>
              </div>
              <div>
                <label className="text-[10px] uppercase tracking-widest text-slate-500 font-semibold mb-1.5 block">
                  Lineage ID
                </label>
                <div className="relative">
                  <Layers size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-600 pointer-events-none" />
                  <input
                    type="text"
                    placeholder="e.g. fraud-detection-v1"
                    value={mLineageId}
                    onChange={e => setMLineageId(e.target.value)}
                    className="w-full bg-black/30 border border-white/[0.06] rounded-lg pl-9 pr-4 py-2.5 text-sm text-slate-200 placeholder-slate-700 focus:outline-none focus:border-violet-500/40 transition-colors"
                  />
                </div>
              </div>
            </div>

            {/* Info banner */}
            <div className="flex items-start gap-2 bg-violet-500/[0.04] border border-violet-500/[0.10] rounded-lg px-3 py-2.5 text-[11px] text-slate-500">
              <FolderOpen size={12} className="text-violet-400 mt-0.5 flex-shrink-0" />
              <span>
                The backend will stream-read the <code className="text-violet-400 font-mono text-[10px]">.pkl</code> in 8 KB chunks to produce a SHA-256 <strong className="text-slate-400">modelHash</strong>.
                During batch inference, the file is loaded once via <code className="text-violet-400 font-mono text-[10px]">joblib.load()</code> and reused for all 1 000 rows.
              </span>
            </div>

            {/* Wallet + Submit */}
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-2 text-[11px] text-slate-500">
                <ShieldCheck size={12} className="text-slate-600" />
                <span>Wallet:</span>
                <span className="font-mono text-slate-400">
                  {account ? `${account.substring(0, 8)}…${account.substring(38)}` : 'Not connected'}
                </span>
              </div>
              <button
                onClick={registerModel}
                disabled={mLoading || !account}
                className={`
                  flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold transition-all
                  ${mLoading || !account
                    ? 'bg-violet-500/5 text-violet-500/40 cursor-not-allowed'
                    : 'bg-violet-500/15 hover:bg-violet-500/25 text-violet-400 hover:text-violet-300 border border-violet-500/20 hover:border-violet-500/40 shadow-lg shadow-violet-950/20'
                  }
                `}
              >
                {mLoading ? (
                  <><RefreshCw size={14} className="animate-spin" /> Hashing .pkl…</>
                ) : (
                  <><ArrowRight size={14} /> Register Model</>
                )}
              </button>
            </div>

            {/* Result */}
            {mResult && (
              <div className={`p-4 rounded-xl border text-sm ${
                mResult.success
                  ? 'bg-emerald-500/5 border-emerald-500/15 text-emerald-400'
                  : 'bg-red-500/5 border-red-500/15 text-red-400'
              }`}>
                {mResult.success ? (
                  <div className="space-y-2">
                    <div className="flex items-center gap-1.5 font-semibold">
                      <CheckCircle2 size={14} /> Model Registered Successfully
                    </div>
                    <div className="bg-black/20 rounded-lg p-3 space-y-1">
                      <p className="text-[10px] text-emerald-400/60 uppercase tracking-wider">Model Hash (use this in batch predict)</p>
                      <p className="font-mono text-[11px] text-emerald-300/80 break-all">{mResult.data?.modelHash}</p>
                    </div>
                    <div className="flex flex-wrap gap-4 text-[11px] text-emerald-400/60">
                      <span>Lineage: {mResult.data?.lineageId}</span>
                      <span>Dataset: {mResult.data?.datasetHash?.slice(0, 16)}…</span>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <AlertCircle size={14} />
                    <span>{mResult.error}</span>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── Filters row ──────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row gap-3">
        {/* Search */}
        <div className="relative flex-1">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-600 pointer-events-none" />
          <input
            type="text"
            placeholder="Search by hash, lineage, or wallet…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full bg-[#0c0c12] border border-white/[0.06] rounded-xl pl-9 pr-4 py-2.5 text-sm text-slate-200 placeholder-slate-600 focus:outline-none focus:border-amber-500/30 transition-colors"
          />
        </div>
        {/* Type filter */}
        <div className="flex gap-1 p-1 bg-[#0c0c12] border border-white/[0.06] rounded-xl">
          {['ALL', 'TRAINING', 'TESTING'].map(type => (
            <button
              key={type}
              onClick={() => setFilterType(type)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                filterType === type
                  ? 'bg-amber-500/15 text-amber-400 shadow-sm'
                  : 'text-slate-500 hover:text-slate-300'
              }`}
            >
              {type === 'ALL' ? 'All' : type === 'TRAINING' ? 'Training' : 'Testing'}
            </button>
          ))}
        </div>
      </div>

      {/* ── Provenance explainer ─────────────────────────────────────────── */}
      <div className="flex items-center gap-3 text-[11px] text-slate-600 bg-amber-500/[0.03] border border-amber-500/[0.08] rounded-xl px-4 py-2.5">
        <FileText size={12} className="text-amber-500/60 flex-shrink-0" />
        <span>Every dataset file is hashed via</span>
        <code className="text-amber-400/80 bg-black/20 px-1.5 py-0.5 rounded text-[10px]">SHA-256</code>
        <span>and anchored on-chain for</span>
        <span className="text-amber-400/80 font-semibold">Tier-2 Macro Verification</span>
      </div>

      {/* ── Content ──────────────────────────────────────────────────────── */}
      {loading && (
        <div className="flex items-center justify-center py-20 gap-3">
          <RefreshCw size={16} className="animate-spin text-amber-500" />
          <span className="text-sm text-slate-500">Loading datasets…</span>
        </div>
      )}

      {error && !loading && (
        <div className="flex items-center gap-3 bg-red-500/8 border border-red-500/15 rounded-xl px-5 py-4 text-red-400 text-sm">
          <AlertCircle size={14} /> {error}
        </div>
      )}

      {!loading && !error && filtered.length === 0 && (
        <div className="flex flex-col items-center justify-center py-20 text-center space-y-4">
          <div className="w-14 h-14 rounded-2xl bg-white/[0.02] border border-white/[0.06] flex items-center justify-center">
            <Database size={24} className="text-slate-700" />
          </div>
          <p className="text-slate-400 font-medium text-sm">No datasets registered</p>
          <p className="text-slate-600 text-xs max-w-sm">
            Register a dataset file via <code className="text-amber-400 text-[10px]">POST /dataset/register</code> with a <code className="text-amber-400 text-[10px]">filePath</code> on D: Drive to see it here.
          </p>
        </div>
      )}

      {!loading && !error && filtered.length > 0 && (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
          {filtered.map((ds, i) => (
            <DatasetCard
              key={ds.hash}
              ds={ds}
              index={i}
              onVerify={verifyFile}
              verifyState={verifyStates[ds.hash]}
            />
          ))}
        </div>
      )}
    </div>
  );
}