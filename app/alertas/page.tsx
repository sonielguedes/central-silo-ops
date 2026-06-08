"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { Sidebar } from '@/components/layout/sidebar';
import { Header } from '@/components/layout/header';
import {
  AlertCircle,
  AlertTriangle,
  Info,
  CheckCircle2,
  Loader2,
  Bell,
  Filter,
  RefreshCw,
  Shield,
  Clock,
  XCircle,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { withAuth } from '@/components/shared/with-auth';

interface AlertRecord {
  id: string;
  severity: 'CRITICO' | 'ATENCAO' | 'INFORMATIVO';
  title: string;
  description: string;
  fleetCode: string;
  equipmentId: string;
  source: string;
  createdAt: string;
  acknowledgedAt: string | null;
  resolvedAt: string | null;
  status: 'ABERTO' | 'RECONHECIDO' | 'RESOLVIDO';
}

interface AlertSummary {
  total: number;
  critico: number;
  atencao: number;
  informativo: number;
  abertos: number;
  reconhecidos: number;
  resolvidos: number;
}

function timeAgo(isoStr: string): string {
  const diff = Date.now() - new Date(isoStr).getTime();
  if (diff < 0) return 'agora';
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'agora';
  if (mins < 60) return mins + ' min';
  const hours = Math.floor(mins / 60);
  if (hours < 24) return hours + 'h ' + (mins % 60) + 'min';
  const days = Math.floor(hours / 24);
  return days + 'd ' + (hours % 24) + 'h';
}

const SEV_CFG: Record<string, { icon: React.ElementType; label: string; bg: string; text: string; border: string }> = {
  CRITICO: { icon: AlertCircle, label: 'Critico', bg: 'bg-red-500/10', text: 'text-red-500', border: 'border-red-500/30' },
  ATENCAO: { icon: AlertTriangle, label: 'Atencao', bg: 'bg-amber-500/10', text: 'text-amber-500', border: 'border-amber-500/30' },
  INFORMATIVO: { icon: Info, label: 'Informativo', bg: 'bg-blue-500/10', text: 'text-blue-400', border: 'border-blue-500/30' },
};

const STS_CFG: Record<string, { label: string; bg: string; text: string; border: string }> = {
  ABERTO: { label: 'Aberto', bg: 'bg-red-500/10', text: 'text-red-400', border: 'border-red-500/20' },
  RECONHECIDO: { label: 'Reconhecido', bg: 'bg-amber-500/10', text: 'text-amber-400', border: 'border-amber-500/20' },
  RESOLVIDO: { label: 'Resolvido', bg: 'bg-emerald-500/10', text: 'text-emerald-400', border: 'border-emerald-500/20' },
};

function AlertasPage() {
  const [alerts, setAlerts] = useState<AlertRecord[]>([]);
  const [summary, setSummary] = useState<AlertSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filterSev, setFilterSev] = useState('');
  const [filterSts, setFilterSts] = useState('');
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const p = new URLSearchParams();
      if (filterSev) p.set('severity', filterSev);
      if (filterSts) p.set('status', filterSts);
      const qs = p.toString();
      const url = '/api/alertas' + (qs ? '?' + qs : '');
      const res = await fetch(url);
      if (!res.ok) throw new Error('HTTP ' + res.status);
      const d = await res.json();
      setAlerts(Array.isArray(d.alerts) ? d.alerts : []);
      setSummary(d.summary || null);
    } catch (err) {
      console.error('[alertas] load', err);
      setError('Erro ao carregar alertas.');
    } finally {
      setLoading(false);
    }
  }, [filterSev, filterSts]);

  useEffect(() => { load(); }, [load]);

  const doAck = async (id: string) => {
    setBusy(id);
    try {
      await fetch('/api/alertas/' + id + '/acknowledge', { method: 'POST' });
      await load();
    } catch { /* ignore */ } finally { setBusy(null); }
  };

  const doResolve = async (id: string) => {
    setBusy(id);
    try {
      await fetch('/api/alertas/' + id + '/resolve', { method: 'POST' });
      await load();
    } catch { /* ignore */ } finally { setBusy(null); }
  };

  const doResolveAll = async () => {
    if (!confirm('Resolver todos os alertas abertos? O historico sera mantido.')) return;
    setBusy('all');
    try {
      await fetch('/api/alertas/resolve-all', { method: 'POST' });
      await load();
    } catch { /* ignore */ } finally { setBusy(null); }
  };

  const activeCount = alerts.filter(a => a.status !== 'RESOLVIDO').length;

  return (
    <div className="flex h-screen bg-[#050812] text-white overflow-hidden font-sans">
      <Sidebar className="hidden lg:flex shrink-0" />
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden relative">
        <Header />
        <main className="flex-1 overflow-y-auto custom-scrollbar p-6">

          <div className="flex items-center justify-between mb-8">
            <div>
              <h1 className="text-2xl font-black italic tracking-tighter uppercase text-white">Alertas do Sistema</h1>
              <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-widest mt-1">Monitoramento de Excecoes e Eventos Criticos</p>
            </div>
            <div className="flex gap-2">
              <button onClick={load} disabled={loading} className="p-2.5 bg-[#1a1f3a] border border-[#2d3647] rounded-xl text-muted-foreground hover:text-white transition-all disabled:opacity-50">
                <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
              </button>
              <button onClick={doResolveAll} disabled={busy === 'all' || activeCount === 0} className="px-4 py-2 bg-[#1a1f3a] border border-[#2d3647] rounded-xl text-[10px] font-black uppercase hover:bg-[#252d4a] transition-all disabled:opacity-50">
                {busy === 'all' ? 'Resolvendo...' : 'Resolver Tudo'}
              </button>
            </div>
          </div>

          {summary && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
              <KpiCard icon={AlertCircle} label="Criticos" value={summary.critico} cls="text-red-500 bg-red-500/10 border-red-500/20" />
              <KpiCard icon={AlertTriangle} label="Atencao" value={summary.atencao} cls="text-amber-500 bg-amber-500/10 border-amber-500/20" />
              <KpiCard icon={Info} label="Informativos" value={summary.informativo} cls="text-blue-400 bg-blue-500/10 border-blue-500/20" />
              <KpiCard icon={Bell} label="Total Abertos" value={summary.abertos} cls="text-primary bg-primary/10 border-primary/20" />
            </div>
          )}

          <div className="flex flex-wrap gap-3 mb-6">
            <div className="flex items-center gap-2">
              <Filter size={14} className="text-muted-foreground" />
              <span className="text-[9px] font-black uppercase text-muted-foreground tracking-widest">Filtros:</span>
            </div>
            <select value={filterSev} onChange={e => setFilterSev(e.target.value)} className="bg-[#1a1f3a] border border-[#2d3647] rounded-xl px-3 py-1.5 text-xs font-bold focus:border-primary outline-none">
              <option value="">Todas Severidades</option>
              <option value="CRITICO">Critico</option>
              <option value="ATENCAO">Atencao</option>
              <option value="INFORMATIVO">Informativo</option>
            </select>
            <select value={filterSts} onChange={e => setFilterSts(e.target.value)} className="bg-[#1a1f3a] border border-[#2d3647] rounded-xl px-3 py-1.5 text-xs font-bold focus:border-primary outline-none">
              <option value="">Todos Status</option>
              <option value="ABERTO">Aberto</option>
              <option value="RECONHECIDO">Reconhecido</option>
              <option value="RESOLVIDO">Resolvido</option>
            </select>
          </div>

          {loading ? (
            <div className="flex flex-col items-center justify-center h-64 gap-4">
              <Loader2 size={40} className="text-primary animate-spin" />
              <p className="text-xs text-muted-foreground font-black uppercase tracking-[0.2em]">Analisando estado operacional...</p>
            </div>
          ) : error ? (
            <div className="flex flex-col items-center justify-center h-64 gap-4">
              <XCircle size={40} className="text-red-500" />
              <p className="text-sm text-red-400 font-bold">{error}</p>
              <button onClick={load} className="px-4 py-2 bg-primary/20 text-primary rounded-xl text-xs font-black uppercase hover:bg-primary/30 transition-colors">Tentar Novamente</button>
            </div>
          ) : alerts.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-64 gap-4 opacity-40">
              <Shield size={48} />
              <p className="text-xs font-black uppercase tracking-widest text-muted-foreground">
                {filterSev || filterSts ? 'Nenhum alerta para os filtros selecionados' : 'Sistema operando normalmente'}
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {alerts.map(al => <AlertRow key={al.id} al={al} busy={busy} onAck={doAck} onResolve={doResolve} />)}
            </div>
          )}

        </main>
      </div>
    </div>
  );
}

function AlertRow({ al, busy, onAck, onResolve }: { al: AlertRecord; busy: string | null; onAck: (id: string) => void; onResolve: (id: string) => void }) {
  const sev = SEV_CFG[al.severity] || SEV_CFG.INFORMATIVO;
  const sts = STS_CFG[al.status] || STS_CFG.ABERTO;
  const SevIcon = sev.icon;
  const isBusy = busy === al.id;

  return (
    <div className={cn(
      'bg-[#0a0e27]/60 border rounded-2xl p-5 transition-all group',
      al.status === 'RESOLVIDO' ? 'border-[#2d3647]/50 opacity-60' : 'border-[#2d3647] hover:border-primary/30',
    )}>
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-4 flex-1 min-w-0">
          <div className={cn('w-12 h-12 rounded-xl flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform', sev.bg, sev.text)}>
            <SevIcon size={24} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-1">
              <h3 className="text-sm font-black uppercase tracking-wide text-white group-hover:text-primary transition-colors">{al.title}</h3>
              <span className={cn('px-2 py-0.5 rounded text-[8px] font-black uppercase border', sev.bg, sev.text, sev.border)}>{sev.label}</span>
              <span className={cn('px-2 py-0.5 rounded text-[8px] font-black uppercase border', sts.bg, sts.text, sts.border)}>{sts.label}</span>
            </div>
            <p className="text-xs text-muted-foreground font-medium mt-1">{al.description}</p>
            <div className="flex items-center gap-4 mt-2 text-[9px] text-white/40 font-bold uppercase flex-wrap">
              <span className="flex items-center gap-1"><Clock size={10} /> {timeAgo(al.createdAt)}</span>
              <span>Frota: {al.fleetCode || '-'}</span>
              <span>Fonte: {al.source}</span>
              {al.acknowledgedAt && <span className="text-amber-400">Reconhecido: {timeAgo(al.acknowledgedAt)}</span>}
              {al.resolvedAt && <span className="text-emerald-400">Resolvido: {timeAgo(al.resolvedAt)}</span>}
            </div>
          </div>
        </div>
        {al.status !== 'RESOLVIDO' && (
          <div className="flex gap-2 shrink-0">
            {al.status === 'ABERTO' && (
              <button onClick={() => onAck(al.id)} disabled={isBusy} title="Reconhecer" className="p-2.5 bg-amber-500/10 border border-amber-500/20 rounded-xl text-amber-500 hover:bg-amber-500/20 transition-all disabled:opacity-50">
                {isBusy ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle2 size={16} />}
              </button>
            )}
            <button onClick={() => onResolve(al.id)} disabled={isBusy} title="Resolver" className="p-2.5 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-emerald-500 hover:bg-emerald-500/20 transition-all disabled:opacity-50">
              {isBusy ? <Loader2 size={16} className="animate-spin" /> : <Shield size={16} />}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function KpiCard({ icon: Icon, label, value, cls }: { icon: React.ElementType; label: string; value: number; cls: string }) {
  return (
    <div className={cn('border rounded-2xl p-4 flex items-center gap-4', cls)}>
      <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-black/20"><Icon size={20} /></div>
      <div>
        <p className="text-2xl font-black italic tracking-tighter">{value}</p>
        <p className="text-[9px] font-black uppercase tracking-widest opacity-70">{label}</p>
      </div>
    </div>
  );
}

export default withAuth(AlertasPage, { module: 'ALERTAS' });
