
import React, { useState, useEffect } from 'react';
import { TrendingUp, Users, DollarSign, Calendar, Play, CheckCircle2, Zap } from 'lucide-react';
import { getDB } from '../../services/storage';
import { Distribution, User } from '../../types';
import { runDailyDistribution } from '../../services/rewardSystem';

const Distributions: React.FC = () => {
  const [distributions, setDistributions] = useState<Distribution[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [lastResult, setLastResult] = useState<any>(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = () => {
    const db = getDB();
    setDistributions([...db.distributions].reverse());
    setUsers(db.users);
  };

  const handleProcess = () => {
    setIsProcessing(true);
    setTimeout(() => {
      const result = runDailyDistribution();
      setLastResult(result);
      setIsProcessing(false);
      loadData();
    }, 1500);
  };

  const totalDistributed = distributions.reduce((acc, curr) => acc + curr.amount, 0);

  return (
    <div className="space-y-10 animate-in fade-in duration-700">
      {/* Performance Stats Dashboard - Bordas Reforçadas */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        <div className="bg-white p-8 rounded-[2.5rem] border-2 border-slate-300 shadow-md relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
            <DollarSign className="w-24 h-24 text-slate-900" />
          </div>
          <p className="text-[11px] font-black text-slate-500 uppercase tracking-[0.3em] mb-4">Payout Total</p>
          <h3 className="text-4xl font-black text-slate-900 italic font-sport tracking-tight">R$ {totalDistributed.toFixed(2)}</h3>
          <div className="mt-4 h-2 w-16 bg-lime-400 rounded-full border border-lime-500"></div>
        </div>
        
        <div className="bg-white p-8 rounded-[2.5rem] border-2 border-slate-300 shadow-md relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
            <Zap className="w-24 h-24 text-slate-900" />
          </div>
          <p className="text-[11px] font-black text-slate-500 uppercase tracking-[0.3em] mb-4">Eventos de Caixa</p>
          <h3 className="text-4xl font-black text-slate-900 italic font-sport tracking-tight">{distributions.length} <span className="text-sm uppercase font-sans text-slate-400 tracking-widest ml-2">Transações</span></h3>
          <div className="mt-4 h-2 w-16 bg-zinc-900 rounded-full border border-zinc-800"></div>
        </div>

        <div className="bg-white p-8 rounded-[2.5rem] border-2 border-slate-300 shadow-md relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
            <Users className="w-24 h-24 text-slate-900" />
          </div>
          <p className="text-[11px] font-black text-slate-500 uppercase tracking-[0.3em] mb-4">Atletas Ativos</p>
          <h3 className="text-4xl font-black text-slate-900 italic font-sport tracking-tight">{users.filter(u => u.status === 'ativo').length} <span className="text-sm uppercase font-sans text-slate-400 tracking-widest ml-2">Competidores</span></h3>
          <div className="mt-4 h-2 w-16 bg-lime-500 rounded-full border border-lime-600"></div>
        </div>
      </div>

      {/* Trigger Distribution - Forte Contraste */}
      <div className="bg-black rounded-[3rem] p-10 flex flex-col md:flex-row items-center justify-between gap-8 relative overflow-hidden group shadow-[0_30px_60px_rgba(0,0,0,0.3)]">
        <div className="absolute top-0 left-0 w-full h-full bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')] opacity-10 pointer-events-none"></div>
        <div className="space-y-3 relative z-10 text-center md:text-left">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 bg-lime-400 text-black text-[10px] font-black uppercase tracking-widest rounded-full italic shadow-lg">
            <Zap className="w-3 h-3 fill-current" /> Manual Payout Override
          </div>
          <h3 className="text-4xl font-black text-white italic uppercase font-sport tracking-widest leading-none">Rodar Distribuição</h3>
          <p className="text-zinc-400 text-sm font-semibold max-w-xl">Dispara o cálculo diário: penaliza faltantes em R$ 10,00 e redistribui para os presentes com base na performance.</p>
        </div>
        <button 
          onClick={handleProcess}
          disabled={isProcessing}
          className={`relative z-10 px-10 py-6 bg-lime-400 text-black rounded-[1.5rem] font-black text-lg uppercase italic tracking-tighter flex items-center shadow-2xl transition-all ${isProcessing ? 'opacity-50' : 'hover:bg-white hover:scale-[1.05] active:scale-95'}`}
        >
          {isProcessing ? (
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-black mr-3"></div>
          ) : (
            <Play className="w-7 h-7 mr-3 fill-current" />
          )}
          {isProcessing ? 'Calculando...' : 'Rodar Agora'}
        </button>
      </div>

      {lastResult && (
        <div className="bg-white border-4 border-lime-400 p-8 rounded-[2rem] flex items-start gap-6 animate-in slide-in-from-top-4 duration-500 shadow-xl">
          <div className="p-3 bg-black rounded-2xl text-lime-400 shadow-lg">
            <CheckCircle2 className="w-8 h-8" />
          </div>
          <div>
            <h4 className="text-xl font-black text-slate-900 uppercase italic font-sport tracking-widest">{lastResult.message}</h4>
            <div className="mt-4 grid grid-cols-2 md:grid-cols-3 gap-8 text-[11px] font-black uppercase tracking-widest text-slate-500">
              {lastResult.totalPot && <div>Arrecadação: <span className="text-black ml-2 font-bold">R$ {lastResult.totalPot.toFixed(2)}</span></div>}
              {lastResult.absentCount !== undefined && <div>Faltas: <span className="text-rose-600 ml-2 font-bold">{lastResult.absentCount}</span></div>}
              {lastResult.presentCount !== undefined && <div>Premiados: <span className="text-lime-600 ml-2 font-bold">{lastResult.presentCount}</span></div>}
            </div>
          </div>
        </div>
      )}

      {/* History Table - Bordas e divisores destacados */}
      <div className="bg-white rounded-[2.5rem] border-2 border-slate-300 overflow-hidden shadow-xl">
        <div className="px-10 py-6 border-b-2 border-slate-200 flex justify-between items-center bg-slate-50">
          <h3 className="text-lg font-black text-slate-900 uppercase italic tracking-widest font-sport">Log de Transações</h3>
          <div className="p-2 bg-white border-2 border-slate-100 rounded-xl text-slate-400">
            <TrendingUp className="w-5 h-5" />
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y-2 divide-slate-200">
            <thead className="bg-slate-50/50">
              <tr>
                <th className="px-10 py-5 text-left text-[10px] font-black text-slate-400 uppercase tracking-[0.3em]">Timeline</th>
                <th className="px-10 py-5 text-left text-[10px] font-black text-slate-400 uppercase tracking-[0.3em]">Atleta</th>
                <th className="px-10 py-5 text-left text-[10px] font-black text-slate-400 uppercase tracking-[0.3em]">Motivo</th>
                <th className="px-10 py-5 text-right text-[10px] font-black text-slate-400 uppercase tracking-[0.3em]">Crédito</th>
              </tr>
            </thead>
            <tbody className="divide-y-2 divide-slate-100">
              {distributions.map((dist) => (
                <tr key={dist.id} className="hover:bg-slate-50/80 transition-colors">
                  <td className="px-10 py-6 whitespace-nowrap text-sm text-slate-500">
                    <div className="flex items-center font-bold tracking-tighter">
                      <Calendar className="w-4 h-4 mr-2 text-lime-500" />
                      {dist.date}
                    </div>
                  </td>
                  <td className="px-10 py-6 whitespace-nowrap">
                    <div className="text-sm font-black text-slate-900 uppercase tracking-tight">
                      {users.find(u => u.id === dist.userId)?.name || 'DESCONHECIDO'}
                    </div>
                  </td>
                  <td className="px-10 py-6 whitespace-nowrap text-[11px] font-bold text-slate-400 uppercase tracking-widest">
                    {dist.reason}
                  </td>
                  <td className="px-10 py-6 whitespace-nowrap text-right">
                    <span className="text-xl font-black text-lime-600 font-sport italic tracking-tighter bg-black px-4 py-1 rounded-lg border-2 border-zinc-800 shadow-md">
                      + R$ {dist.amount.toFixed(2)}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default Distributions;
