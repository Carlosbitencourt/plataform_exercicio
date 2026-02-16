import React, { useState, useEffect } from 'react';
import { TrendingUp, Users, DollarSign, Calendar, Play, CheckCircle2, Zap, AlertTriangle } from 'lucide-react';
import { subscribeToDistributions, subscribeToUsers, subscribeToCheckIns } from '../../services/db';
import { runDailyPenaltyCheck, runWeeklyDistribution } from '../../services/rewardSystem';
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

  const handleDailyCheck = async () => {
    if (!window.confirm("Confirmar verificação diária de penalidades? Isso irá descontar saldo dos faltantes.")) return;

    setIsProcessing(true);
    setLastResult(null);
    try {
      const result = runDailyPenaltyCheck();
      setLastResult({ type: 'penalty', ...result });
    } catch (error: any) {
      console.error("Daily check failed:", error);
      alert(`Erro: ${error.message}`);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleWeeklyDistribution = async () => {
    if (!window.confirm("ATENÇÃO: Confirmar distribuição SEMANAL? Isso irá distribuir o pool acumulado e ZERAR as faltas da semana.")) return;

    setIsProcessing(true);
    setLastResult(null);
    try {
      const result = runWeeklyDistribution();
      setLastResult({ type: 'distribution', ...result });
    } catch (error: any) {
      console.error("Weekly distribution failed:", error);
      alert(`Erro: ${error.message}`);
    } finally {
      setIsProcessing(false);
    }
  };

  const activeUsers = users.filter(u => u.status === UserStatus.ACTIVE);
  const totalDeposited = activeUsers.reduce((acc, u) => acc + u.depositedValue, 0);
  const currentTotalBalance = activeUsers.reduce((acc, u) => acc + u.balance, 0);
  const currentPool = totalDeposited - currentTotalBalance;

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
          <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-3">Pool Acumulado (Semana)</p>
          <h3 className="text-3xl font-black text-slate-900 italic font-sport tracking-tight">R$ {Math.max(0, currentPool).toFixed(2)}</h3>
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

      {/* Control Actions */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Daily Penalty Action */}
        <div className="bg-white rounded-[1.5rem] border-2 border-slate-200 p-6 flex flex-col justify-between shadow-lg relative overflow-hidden">
          <div className="z-10 relative">
            <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 bg-rose-100 text-rose-700 text-[8px] font-black uppercase tracking-widest rounded-full italic mb-3">
              <AlertTriangle className="w-2 h-2 fill-current" /> Ação Diária
            </div>
            <h3 className="text-2xl font-black text-slate-900 italic uppercase font-sport tracking-widest leading-none mb-2">Processar Faltas</h3>
            <p className="text-slate-500 text-xs font-medium mb-6">Verifica quem não fez check-in hoje e aplica a penalidade proporcional. O valor descontado vai para o Pool.</p>
            <button
              onClick={handleDailyCheck}
              disabled={isProcessing}
              className="w-full py-3.5 bg-slate-900 text-white rounded-xl font-black text-sm uppercase italic tracking-tighter hover:bg-black hover:scale-[1.02] active:scale-95 transition-all shadow-md flex items-center justify-center gap-2"
            >
              {isProcessing ? <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div> : <AlertTriangle className="w-4 h-4" />}
              Aplicar Penalidades
            </button>
          </div>
        </div>

        {/* Weekly Distribution Action */}
        <div className="bg-black rounded-[1.5rem] p-6 flex flex-col justify-between shadow-[0_10px_40px_rgba(132,204,22,0.2)] relative overflow-hidden group">
          <div className="absolute top-0 left-0 w-full h-full bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')] opacity-20 pointer-events-none"></div>
          <div className="z-10 relative">
            <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 bg-lime-400 text-black text-[8px] font-black uppercase tracking-widest rounded-full italic mb-3 shadow-lg">
              <Zap className="w-2 h-2 fill-current" /> Fim da Semana
            </div>
            <h3 className="text-2xl font-black text-white italic uppercase font-sport tracking-widest leading-none mb-2">Distribuir Pool</h3>
            <p className="text-zinc-400 text-xs font-medium mb-6">Redistribui todo o valor acumulado no Pool para os atletas elegíveis e reinicia a contagem de faltas da semana.</p>
            <button
              onClick={handleWeeklyDistribution}
              disabled={isProcessing}
              className="w-full py-3.5 bg-lime-400 text-black rounded-xl font-black text-sm uppercase italic tracking-tighter hover:bg-white hover:scale-[1.02] active:scale-95 transition-all shadow-xl flex items-center justify-center gap-2"
            >
              {isProcessing ? <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-black"></div> : <Play className="w-4 h-4 fill-current" />}
              Finalizar Semana
            </button>
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
      <div className="bg-white rounded-[1.5rem] border-2 border-slate-300 overflow-hidden shadow-lg">
        <div className="px-5 py-3.5 border-b-2 border-slate-200 flex justify-between items-center bg-slate-50">
          <h3 className="text-sm font-black text-slate-900 uppercase italic tracking-widest font-sport">Log de Transações</h3>
          <div className="p-1.5 bg-white border border-slate-100 rounded-lg text-slate-400">
            <TrendingUp className="w-3.5 h-3.5" />
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y-2 divide-slate-200">
            <thead className="bg-slate-50/50">
              <tr>
                <th className="px-5 py-3 text-left text-[10px] font-black text-slate-400 uppercase tracking-widest">Timeline</th>
                <th className="px-5 py-3 text-left text-[10px] font-black text-slate-400 uppercase tracking-widest">Atleta</th>
                <th className="px-5 py-3 text-left text-[10px] font-black text-slate-400 uppercase tracking-widest">Motivo</th>
                <th className="px-5 py-3 text-right text-[10px] font-black text-slate-400 uppercase tracking-widest">Crédito / Débito</th>
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
