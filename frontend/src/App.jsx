import React, { useState } from 'react';
import { ethers } from 'ethers';
import { ShieldCheck, Lock, Activity, Wallet, GitBranch, List } from 'lucide-react';
import VaultTab from './VaultTab';
import AuditTab from './AuditTab';
import LineageTab from './LineageTab';
import TransactionsTab from './TransactionsTab';
// App Shell — Two-Tab Dashboard
//   Tab 1  "The Vault"  →  Macro track  (Dataset Registry)
//   Tab 2  "The Audit"  →  Micro track  (Inference Logs)
// ══════════════════════════════════════════════════════════════════════════════

export default function App() {
  const [tab, setTab]         = useState('vault');   // 'vault' | 'audit' | 'lineage'
  const [account, setAccount] = useState(null);

  // ── Wallet ──────────────────────────────────────────────────────────────────
  const connectWallet = async () => {
    if (!window.ethereum) return alert('Please install MetaMask');
    const provider = new ethers.BrowserProvider(window.ethereum);
    const accounts = await provider.send('eth_requestAccounts', []);
    setAccount(accounts[0]);
  };

  // ── Tab config ──────────────────────────────────────────────────────────────
  const tabs = [
    {
      id: 'vault',
      label: 'The Vault',
      sublabel: 'Macro',
      icon: Lock,
      accent: 'amber',
      activeBg: 'bg-amber-500/15',
      activeText: 'text-amber-400',
      activeShadow: 'shadow-amber-900/20',
      activeBorder: 'border-amber-500/25',
      glowColor: 'rgba(245, 158, 11, 0.06)',
    },
    {
      id: 'audit',
      label: 'The Audit',
      sublabel: 'Micro',
      icon: Activity,
      accent: 'cyan',
      activeBg: 'bg-cyan-500/15',
      activeText: 'text-cyan-400',
      activeShadow: 'shadow-cyan-900/20',
      activeBorder: 'border-cyan-500/25',
      glowColor: 'rgba(34, 211, 238, 0.06)',
    },
    {
      id: 'lineage',
      label: 'Lineage',
      sublabel: 'Graph',
      icon: GitBranch,
      accent: 'violet',
      activeBg: 'bg-violet-500/15',
      activeText: 'text-violet-400',
      activeShadow: 'shadow-violet-900/20',
      activeBorder: 'border-violet-500/25',
      glowColor: 'rgba(139, 92, 246, 0.06)',
    },
    {
      id: 'transactions',
      label: 'Transactions',
      sublabel: 'Log',
      icon: List,
      accent: 'emerald',
      activeBg: 'bg-emerald-500/15',
      activeText: 'text-emerald-400',
      activeShadow: 'shadow-emerald-900/20',
      activeBorder: 'border-emerald-500/25',
      glowColor: 'rgba(16, 185, 129, 0.06)',
    },
  ];

  const activeTab = tabs.find(t => t.id === tab);

  return (
    <div className="min-h-screen bg-[#06060a] text-slate-200 font-sans flex flex-col">

      {/* ══ Header ═══════════════════════════════════════════════════════════ */}
      <header className="sticky top-0 z-50 backdrop-blur-xl bg-[#06060a]/80 border-b border-white/[0.05]">
        <div className="max-w-[1400px] mx-auto px-6 py-3 flex items-center justify-between gap-4">

          {/* Brand */}
          <div className="flex items-center gap-2.5 flex-shrink-0">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-cyan-500/20 to-amber-500/20 border border-white/[0.08] flex items-center justify-center">
              <ShieldCheck size={16} className="text-white" />
            </div>
            <div>
              <h1 className="text-[15px] font-bold tracking-tight text-white leading-none">
                PROVENANCE<span className="text-cyan-400">.AI</span>
              </h1>
              <p className="text-[10px] text-slate-600 tracking-wide">Dual-Track Audit Node</p>
            </div>
          </div>

          {/* Tab Switcher */}
          <nav className="flex gap-1 p-1 bg-white/[0.03] border border-white/[0.06] rounded-xl">
            {tabs.map(t => {
              const Icon = t.icon;
              const isActive = tab === t.id;
              return (
                <button
                  key={t.id}
                  onClick={() => setTab(t.id)}
                  className={`
                    relative flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200
                    ${isActive
                      ? `${t.activeBg} ${t.activeText} shadow-lg ${t.activeShadow} border ${t.activeBorder}`
                      : 'text-slate-500 hover:text-slate-300 border border-transparent'
                    }
                  `}
                >
                  <Icon size={14} />
                  <span className="hidden sm:inline">{t.label}</span>
                  <span className={`
                    text-[9px] uppercase tracking-widest font-bold px-1.5 py-0.5 rounded
                    ${isActive
                      ? 'bg-black/20 ' + t.activeText
                      : 'bg-white/[0.04] text-slate-600'
                    }
                  `}>
                    {t.sublabel}
                  </span>
                </button>
              );
            })}
          </nav>

          {/* Wallet */}
          <button
            onClick={connectWallet}
            className={`
              flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all flex-shrink-0
              ${account
                ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                : 'bg-white/[0.06] hover:bg-white/[0.10] text-slate-300 border border-white/[0.08] hover:border-white/[0.15]'
              }
            `}
          >
            <Wallet size={14} />
            {account
              ? `${account.substring(0, 6)}…${account.substring(38)}`
              : 'Connect'
            }
          </button>
        </div>

        {/* Active tab indicator bar */}
        <div className="relative h-[2px] max-w-[1400px] mx-auto">
          <div
            className="absolute inset-0 transition-all duration-500"
            style={{
              background: `linear-gradient(90deg, transparent 0%, ${activeTab.glowColor} 30%, ${activeTab.glowColor} 70%, transparent 100%)`,
            }}
          />
        </div>
      </header>

      {/* ══ Page Content ════════════════════════════════════════════════════ */}
      <main className="flex-1 max-w-[1400px] w-full mx-auto">
        {tab === 'vault'        && <VaultTab account={account} />}
        {tab === 'audit'        && <AuditTab account={account} />}
        {tab === 'lineage'      && <LineageTab />}
        {tab === 'transactions' && <TransactionsTab />}
      </main>

      {/* ══ Footer ══════════════════════════════════════════════════════════ */}
      <footer className="border-t border-white/[0.04] py-4 px-6">
        <div className="max-w-[1400px] mx-auto flex items-center justify-between text-[10px] text-slate-700">
          <span>Provenance.AI · Dual-Track Verification Engine</span>
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1">
              <Lock size={9} className="text-amber-500/40" /> Vault = Macro
            </span>
            <span className="flex items-center gap-1">
              <Activity size={9} className="text-cyan-500/40" /> Audit = Micro
            </span>
          </div>
        </div>
      </footer>
    </div>
  );
}