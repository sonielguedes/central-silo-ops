"use client";

import React from 'react';
import { Sidebar } from '@/components/layout/sidebar';
import { Header } from '@/components/layout/header';
import { PageHeader } from '@/components/shared/page-header';
import { Shield, Database, Globe, Palette, Save, CheckCircle2 } from 'lucide-react';

export default function ConfiguracoesPage() {
  return (
    <div className="flex h-screen bg-[#050812] text-white overflow-hidden font-sans">
      <Sidebar className="hidden lg:flex shrink-0" />
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden relative">
        <Header />
        <main className="flex-1 overflow-y-auto custom-scrollbar p-6">
          <PageHeader title="Configurações" description="Parâmetros Globais do Sistema e Personalização de Interface" />

          <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
            <div className="xl:col-span-2 space-y-6">
              <ConfigSection title="Segurança e Acesso" icon={<Shield size={18} />}>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <ConfigItem label="Autenticação Multi-fator" description="Exigir 2FA para administradores" />
                  <ConfigItem label="Política de Senhas" description="Mínimo 8 caracteres e símbolos" />
                  <div className="md:col-span-2 pt-4">
                    <button className="flex items-center gap-2 px-4 py-2 bg-[#1a1f3a] border border-[#2d3647] rounded-xl text-[10px] font-black uppercase tracking-tighter hover:bg-[#252d4a] transition-all">
                      <CheckCircle2 size={14} className="text-primary" /> Rodar Testes de Integridade
                    </button>
                  </div>
                </div>
              </ConfigSection>

              <ConfigSection title="Dados e Armazenamento" icon={<Database size={18} />}>
                <div className="space-y-4">
                  <div className="flex items-center justify-between p-4 bg-[#050812]/50 rounded-2xl border border-[#2d3647]">
                     <div>
                        <p className="text-xs font-bold text-white uppercase">Backup Automático</p>
                        <p className="text-[10px] text-muted-foreground">Executado diariamente às 03:00</p>
                     </div>
                     <span className="text-[10px] font-black text-emerald-500 uppercase">Ativo</span>
                  </div>
                  <div className="flex items-center justify-between p-4 bg-[#050812]/50 rounded-2xl border border-[#2d3647]">
                     <div>
                        <p className="text-xs font-bold text-white uppercase">Retenção de Logs</p>
                        <p className="text-[10px] text-muted-foreground">Período de 12 meses</p>
                     </div>
                     <span className="text-[10px] font-black text-white/40 uppercase">Padrão</span>
                  </div>
                </div>
              </ConfigSection>
            </div>

            <div className="space-y-6">
              <ConfigSection title="Personalização" icon={<Palette size={18} />}>
                <div className="space-y-4">
                  <FormField label="Idioma Principal"><select className="w-full bg-[#1a1f3a] border border-[#2d3647] rounded-xl p-3 text-sm focus:border-primary outline-none"><option>Português (Brasil)</option><option>English (US)</option><option>Español</option></select></FormField>
                  <FormField label="Fuso Horário"><select className="w-full bg-[#1a1f3a] border border-[#2d3647] rounded-xl p-3 text-sm focus:border-primary outline-none"><option>(UTC-03:00) Brasília</option><option>(UTC-04:00) Manaus</option></select></FormField>
                  <button className="w-full py-3 bg-primary text-[#0a0e27] rounded-xl text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-2 shadow-lg shadow-primary/20"><Save size={16} /> Salvar Preferências</button>
                </div>
              </ConfigSection>

              <div className="bg-gradient-to-br from-[#1a1f3a] to-[#0a0e27] border border-[#2d3647] p-6 rounded-3xl relative overflow-hidden">
                 <Globe size={120} className="absolute -bottom-10 -right-10 text-white/5" />
                 <h4 className="text-sm font-black italic text-primary uppercase">SILO OPS Central</h4>
                 <p className="text-[10px] text-muted-foreground mt-2 leading-relaxed uppercase font-bold tracking-tight">Infraestrutura dedicada e segura para operações de missão crítica.</p>
                 <button className="mt-6 text-[10px] font-black uppercase text-white hover:text-primary transition-colors flex items-center gap-2">Ver Status dos Servidores <CheckCircle2 size={12} /></button>
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}

function ConfigSection({ title, icon, children }: { title: string, icon: any, children: React.ReactNode }) {
  return (
    <div className="bg-[#0a0e27]/60 border border-[#2d3647] rounded-3xl overflow-hidden">
      <div className="p-4 border-b border-[#2d3647] bg-[#1a1f3a]/10 flex items-center gap-3">
        <div className="text-primary">{icon}</div>
        <h3 className="text-xs font-black uppercase tracking-widest text-white">{title}</h3>
      </div>
      <div className="p-6">{children}</div>
    </div>
  );
}

function ConfigItem({ label, description }: { label: string, description: string }) {
  return (
    <div className="p-4 bg-[#050812]/50 rounded-2xl border border-[#2d3647] flex items-center justify-between group hover:border-primary/30 transition-all cursor-pointer">
      <div>
        <p className="text-xs font-bold text-white uppercase group-hover:text-primary transition-colors">{label}</p>
        <p className="text-[10px] text-muted-foreground mt-0.5">{description}</p>
      </div>
      <div className="w-4 h-4 rounded border border-[#2d3647] bg-[#1a1f3a] flex items-center justify-center">
         <div className="w-2 h-2 rounded-sm bg-primary opacity-0 group-hover:opacity-100 transition-opacity"></div>
      </div>
    </div>
  );
}

function FormField({ label, children }: { label: string, children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">{label}</label>
      {children}
    </div>
  );
}
