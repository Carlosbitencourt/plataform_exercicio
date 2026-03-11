import React, { useState, useEffect } from 'react';
import { TrendingUp, Users, DollarSign, Calendar, Play, CheckCircle2, Zap, AlertTriangle, Trash2 } from 'lucide-react';
import { subscribeToDistributions, subscribeToUsers, subscribeToCheckIns, deleteDistribution, addDistribution } from '../../services/db';
import {
  closeWeeklySession,
  syncAllUsersAbsences
} from '../../services/rewardSystem';
import { Distribution, User, CheckIn, UserStatus } from '../../types';

const Distributions: React.FC = () => {
  const [distributions, setDistributions] = useState<Distribution[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [lastResult, setLastResult] = useState<any>(null);

  useEffect(() => {
    const unsubDist = subscribeToDistributions((data) => setDistributions(data.reverse()));
    const unsubUsers = subscribeToUsers((data) => setUsers(data));

    return () => {
      unsubDist();
      unsubUsers();
    };
  }, []);

  const handleDelete = async (id: string, userName: string) => {
    if (!window.confirm(`Tem certeza que deseja apagar esta transação de ${userName}? O saldo do atleta será ajustado automaticamente.`)) return;
    try {
      await deleteDistribution(id);
    } catch (error) {
      console.error("Error deleting distribution:", error);
      alert("Erro ao apagar distribuição.");
    }
  };

  const handleWeeklyClose = async () => {
    if (!window.confirm("ATENÇÃO: Este é o fechamento FINAL da semana.\n\nO sistema irá:\n1. Aplicar penalidades de faltas (Seg-Sex)\n2. Calcular o Pool de lucro\n3. Distribuir proporcionalmente aos pontos\n4. ZERAR pontos e faltas para a nova semana.\n\nDeseja continuar?")) return;

    setIsProcessing(true);
    setLastResult(null);
    try {
      const result = await closeWeeklySession();
      setLastResult({ type: 'distribution', ...result });
    } catch (error: any) {
      console.error("Weekly close failed:", error);
      alert(`Erro: ${error.message}`);
    } finally {
      setIsProcessing(false);
    }
  };

  const activeUsers = users.filter(u => u.status === UserStatus.ACTIVE);
  const totalAbsences = activeUsers.reduce((acc, u) => acc + (u.weeklyMisses || 0), 0);
  const currentPool = totalAbsences * 5; // Fixed at 5 per absence as requested

  const totalDistributed = distributions
    .filter(d => d.amount > 0)
    .reduce((acc, curr) => acc + curr.amount, 0);

  return (
    <div className="space-y-10 animate-in fade-in duration-700">
      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white p-5 rounded-[1.25rem] border-2 border-slate-300 shadow-md relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-3 opacity-10 group-hover:opacity-20 transition-opacity">
            <DollarSign className="w-16 h-16 text-slate-900" />
          </div>
          <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-3">Pool Estimado (Semana)</p>
          <h3 className="text-3xl font-black text-slate-900 italic font-sport tracking-tight">R$ {currentPool.toFixed(2)}</h3>
          <div className="mt-3 h-1.5 w-10 bg-lime-400 rounded-full border border-lime-500"></div>
        </div>

        <div className="bg-white p-5 rounded-[1.25rem] border-2 border-slate-300 shadow-md relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-3 opacity-10 group-hover:opacity-20 transition-opacity">
            <Zap className="w-16 h-16 text-slate-900" />
          </div>
          <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-3">Total Distribuído</p>
          <h3 className="text-3xl font-black text-slate-900 italic font-sport tracking-tight">R$ {totalDistributed.toFixed(2)}</h3>
          <div className="mt-3 h-1.5 w-10 bg-zinc-900 rounded-full border border-zinc-800"></div>
        </div>

        <div className="bg-white p-5 rounded-[1.25rem] border-2 border-slate-300 shadow-md relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-3 opacity-10 group-hover:opacity-20 transition-opacity">
            <Users className="w-16 h-16 text-slate-900" />
          </div>
          <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-3">Em Risco (3+ Faltas)</p>
          <h3 className="text-3xl font-black text-slate-900 italic font-sport tracking-tight">
            {activeUsers.filter(u => (u.weeklyMisses || 0) >= 3).length}
            <span className="text-[10px] uppercase font-sans text-slate-400 tracking-widest ml-1">Atletas</span>
          </h3>
          <div className="mt-3 h-1.5 w-10 bg-rose-500 rounded-full border border-rose-600"></div>
        </div>
      </div>

      {/* Unified Weekly Action */}
      <div className="max-w-3xl mx-auto">
        <div className="bg-black rounded-[2rem] p-8 flex flex-col items-center text-center shadow-[0_20px_60px_rgba(132,204,22,0.3)] relative overflow-hidden group">
          <div className="absolute top-0 left-0 w-full h-full bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')] opacity-20 pointer-events-none"></div>

          <div className="z-10 relative space-y-6">
            <div className="inline-flex items-center gap-2 px-4 py-1.5 bg-lime-400 text-black text-[10px] font-black uppercase tracking-widest rounded-full italic shadow-xl animate-pulse">
              <Zap className="w-3 h-3 fill-current" /> Altamente Recomendado
            </div>

            <div className="space-y-2">
              <h3 className="text-4xl font-black text-white italic uppercase font-sport tracking-widest leading-none">Processar e Fechar Semana</h3>
              <p className="text-zinc-400 text-sm font-medium max-w-lg mx-auto">
                Execução completa: aplica multas de faltas, calcula o lucro proporcional aos pontos de cada atleta e reseta o ranking para a próxima semana.
              </p>
            </div>

            <div className="flex flex-col sm:flex-row gap-4 w-full justify-center pt-4">
              <button
                onClick={handleWeeklyClose}
                disabled={isProcessing}
                className="px-12 py-5 bg-lime-400 text-black rounded-2xl font-black text-lg uppercase italic tracking-tighter hover:bg-white hover:scale-[1.05] active:scale-95 transition-all shadow-2xl flex items-center justify-center gap-3 group/btn"
              >
                {isProcessing ? (
                  <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-black"></div>
                ) : (
                  <>
                    <Play className="w-6 h-6 fill-current group-hover/btn:scale-110 transition-transform" />
                    <span>Iniciar Fechamento</span>
                  </>
                )}
              </button>
            </div>

            <div className="pt-2 flex items-center justify-center gap-6 text-[10px] font-black uppercase tracking-widest text-zinc-500">
              <div className="flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-lime-500" /> Penalidades
              </div>
              <div className="flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-lime-500" /> Distribuição
              </div>
              <div className="flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-lime-500" /> Reset Geral
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Result Notification */}
      {lastResult && (
        <div className={`border-4 p-8 rounded-[2rem] flex items-start gap-6 animate-in slide-in-from-top-4 duration-500 shadow-xl ${lastResult.type === 'penalty' ? 'bg-rose-50 border-rose-200' : 'bg-lime-50 border-lime-400'
          }`}>
          <div className={`p-3 rounded-2xl shadow-lg ${lastResult.type === 'penalty' ? 'bg-rose-500 text-white' : 'bg-black text-lime-400'
            }`}>
            {lastResult.type === 'penalty' ? <AlertTriangle className="w-8 h-8" /> : <CheckCircle2 className="w-8 h-8" />}
          </div>
          <div className="flex-1">
            <h4 className="text-xl font-black text-slate-900 uppercase italic font-sport tracking-widest">{lastResult.message}</h4>

            <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-4 text-[10px] font-black uppercase tracking-widest text-slate-500">
              {lastResult.absentCount !== undefined && (
                <div className="bg-white/50 p-3 rounded-xl border border-rose-200">
                  Faltantes: <span className="text-rose-600 block text-lg">{lastResult.absentCount}</span>
                </div>
              )}
              {lastResult.totalPenalized !== undefined && (
                <div className="bg-white/50 p-3 rounded-xl border border-rose-200">
                  Penalizado: <span className="text-rose-600 block text-lg">R$ {lastResult.totalPenalized.toFixed(2)}</span>
                </div>
              )}
              {lastResult.poolDistributed !== undefined && (
                <div className="bg-white/50 p-3 rounded-xl border border-lime-200">
                  Distribuído: <span className="text-lime-600 block text-lg">R$ {lastResult.poolDistributed.toFixed(2)}</span>
                </div>
              )}
              {lastResult.recipientsCount !== undefined && (
                <div className="bg-white/50 p-3 rounded-xl border border-lime-200">
                  Beneficiários: <span className="text-lime-600 block text-lg">{lastResult.recipientsCount}</span>
                </div>
              )}
            </div>

            {lastResult.penalizedUsers && lastResult.penalizedUsers.length > 0 && (
              <div className="mt-4 text-[10px] text-slate-400">
                <span className="font-bold uppercase tracking-widest text-slate-500">Atletas Afetados:</span> {lastResult.penalizedUsers.join(', ')}
              </div>
            )}
          </div>
        </div>
      )}

      {/* History Table */}
      <div className="bg-transparent md:bg-white rounded-[1.5rem] md:border-2 md:border-slate-300 overflow-hidden md:shadow-lg">
        <div className="px-5 py-3.5 border-b-2 border-slate-200 flex justify-between items-center bg-white md:bg-slate-50 rounded-t-[1.5rem] md:rounded-t-none border-2 md:border-0 md:border-b-2 mb-4 md:mb-0 shadow-sm md:shadow-none">
          <h3 className="text-sm font-black text-slate-900 uppercase italic tracking-widest font-sport">Log de Transações</h3>
          <div className="p-1.5 bg-white border border-slate-100 rounded-lg text-slate-400">
            <TrendingUp className="w-3.5 h-3.5" />
          </div>
        </div>

        {/* Mobile View - Cards */}
        <div className="md:hidden space-y-3 mb-4">
          {distributions.map((dist) => (
            <div key={dist.id} className="bg-white p-4 rounded-2xl border-2 border-slate-200 shadow-sm">
              <div className="flex justify-between items-start mb-2">
                <div className="flex items-center font-bold tracking-tighter text-[10px] text-slate-500 bg-slate-50 px-2 py-1 rounded-lg border border-slate-100">
                  <Calendar className="w-3 h-3 mr-1.5 text-lime-500" />
                  {dist.date}
                </div>
                <span className={`text-sm font-black font-sport italic tracking-tighter px-2.5 py-0.5 rounded-lg border shadow-sm ${dist.amount >= 0
                  ? 'text-lime-600 bg-lime-50 border-lime-200'
                  : 'text-rose-600 bg-rose-50 border-rose-200'
                  }`}>
                  {dist.amount > 0 ? '+' : ''} R$ {dist.amount.toFixed(2)}
                </span>
                <button onClick={() => handleDelete(dist.id, users.find(u => u.id === dist.userId)?.name || 'Atleta')} className="p-2 text-rose-500 hover:bg-rose-50 rounded-lg transition-colors">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
              <div className="mb-2">
                <div className="text-xs font-black text-slate-900 uppercase tracking-tight">
                  {users.find(u => u.id === dist.userId)?.name || 'DESCONHECIDO'}
                </div>
              </div>
              <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest bg-slate-50 p-2 rounded-lg border border-slate-100">
                {dist.reason}
              </div>
            </div>
          ))}
        </div>

        {/* Desktop View - Table */}
        <div className="overflow-x-auto hidden md:block">
          <table className="min-w-full divide-y-2 divide-slate-200">
            <thead className="bg-slate-50/50">
              <tr>
                <th className="px-5 py-3 text-left text-[10px] font-black text-slate-400 uppercase tracking-widest">Timeline</th>
                <th className="px-5 py-3 text-left text-[10px] font-black text-slate-400 uppercase tracking-widest">Atleta</th>
                <th className="px-5 py-3 text-left text-[10px] font-black text-slate-400 uppercase tracking-widest">Motivo</th>
                <th className="px-5 py-3 text-right text-[10px] font-black text-slate-400 uppercase tracking-widest">Crédito / Débito</th>
                <th className="px-5 py-3 text-right text-[10px] font-black text-slate-400 uppercase tracking-widest">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y-2 divide-slate-100">
              {distributions.map((dist) => (
                <tr key={dist.id} className="hover:bg-slate-50/80 transition-colors">
                  <td className="px-5 py-3 whitespace-nowrap text-[10px] text-slate-500">
                    <div className="flex items-center font-bold tracking-tighter">
                      <Calendar className="w-3 h-3 mr-1.5 text-lime-500" />
                      {dist.date}
                    </div>
                  </td>
                  <td className="px-5 py-3 whitespace-nowrap">
                    <div className="text-xs font-black text-slate-900 uppercase tracking-tight">
                      {users.find(u => u.id === dist.userId)?.name || 'DESCONHECIDO'}
                    </div>
                  </td>
                  <td className="px-5 py-3 whitespace-nowrap text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                    {dist.reason}
                  </td>
                  <td className="px-5 py-3 whitespace-nowrap text-right">
                    <span className={`text-base font-black font-sport italic tracking-tighter px-2.5 py-0.5 rounded-lg border shadow-sm ${dist.amount >= 0
                      ? 'text-lime-600 bg-lime-50 border-lime-200'
                      : 'text-rose-600 bg-rose-50 border-rose-200'
                      }`}>
                      {dist.amount > 0 ? '+' : ''} R$ {dist.amount.toFixed(2)}
                    </span>
                  </td>
                  <td className="px-5 py-3 whitespace-nowrap text-right">
                    <button onClick={() => handleDelete(dist.id, users.find(u => u.id === dist.userId)?.name || 'Atleta')} className="p-2 text-slate-400 hover:text-rose-500 hover:bg-rose-50 rounded-lg transition-colors group">
                      <Trash2 className="w-4 h-4" />
                    </button>
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
