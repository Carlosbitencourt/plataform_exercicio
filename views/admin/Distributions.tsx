import React, { useState, useEffect } from 'react';
import { TrendingUp, Users, DollarSign, Calendar, Play, CheckCircle2, Zap } from 'lucide-react';
import { subscribeToDistributions, subscribeToUsers, subscribeToCheckIns, updateUser, addDistribution, addCheckIn } from '../../services/db';
import { Distribution, User, CheckIn, UserStatus } from '../../types';

// We need to implement the logic for distribution within this component or a service that uses the db service.
// Since runDailyDistribution was imported from 'rewardSystem' which was local storage based, we need to adapt it.

const Distributions: React.FC = () => {
  const [distributions, setDistributions] = useState<Distribution[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [checkIns, setCheckIns] = useState<CheckIn[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [lastResult, setLastResult] = useState<any>(null);

  useEffect(() => {
    const unsubDist = subscribeToDistributions((data) => setDistributions(data.reverse())); // Reverse for display order
    const unsubUsers = subscribeToUsers((data) => setUsers(data));
    // We need check-ins to determine presence for distribution logic
    const unsubCheckIns = subscribeToCheckIns((data) => setCheckIns(data));

    return () => {
      unsubDist();
      unsubUsers();
      unsubCheckIns();
    };
  }, []);

  const runDistribution = async () => {
    const today = new Date().toLocaleDateString('pt-BR'); // Or YYYY-MM-DD depending on format usage
    // Actually our DB service uses ISO YYYY-MM-DD for QR, let's stick to consistent date format.
    // The previous code used LocaleString. Let's start standardizing on ISO YYYY-MM-DD for logic.
    const getISODate = () => {
      const d = new Date();
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    };
    const todayISO = getISODate();

    const activeUsers = users.filter(u => u.status === UserStatus.ACTIVE);

    // Calculate Pot from absentees
    let totalPot = 0;
    let absentCount = 0;
    let presentCount = 0;

    // This logic assumes checkIns for TODAY exist. 
    // If running distribution for "yesterday", logic needs adjustment. 
    // Assuming running for "today".

    // Note: checkIns date format in existing system was YYYY-MM-DD.

    const todaysCheckIns = checkIns.filter(c => c.date === todayISO);
    const presentUserIds = new Set(todaysCheckIns.map(c => c.userId));

    // 1. Penalize Absentees
    for (const user of activeUsers) {
      if (!presentUserIds.has(user.id)) {
        absentCount++;
        const penalty = 10;
        const newBalance = Math.max(0, user.balance - penalty); // Prevent negative balance? Or allow debt?
        // Existing logic likely deducted from balance.

        // Create a negative distribution record or just update balance?
        // Let's look at previous types. Distribution has amount.

        await updateUser({ ...user, balance: newBalance });
        await addDistribution({
          userId: user.id,
          amount: -penalty,
          date: todayISO,
          reason: 'FALTA - Penalidade Diária'
        });
        totalPot += penalty;
      } else {
        presentCount++;
      }
    }

    // 2. Distribute Pot to Present
    if (presentCount > 0 && totalPot > 0) {
      // Calculate shares based on score (weight)
      // We need the scores from the check-ins
      let totalScore = 0;
      todaysCheckIns.forEach(c => totalScore += c.score);

      if (totalScore > 0) {
        for (const checkIn of todaysCheckIns) {
          const share = (checkIn.score / totalScore) * totalPot;
          const user = users.find(u => u.id === checkIn.userId);
          if (user) {
            await updateUser({ ...user, balance: user.balance + share });
            await addDistribution({
              userId: user.id,
              amount: share,
              date: todayISO,
              reason: 'RECOMPENSA - Distribuição Diária'
            });
          }
        }
      }
    }

    return {
      message: 'DISTRIBUIÇÃO COMPUTADA COM SUCESSO',
      totalPot,
      absentCount,
      presentCount
    };
  };

  const handleProcess = async () => {
    setIsProcessing(true);
    try {
      const result = await runDistribution();
      setLastResult(result);
    } catch (error) {
      console.error("Distribution failed:", error);
      alert("Erro ao processar distribuição.");
    } finally {
      setIsProcessing(false);
    }
  };

  const totalDistributed = distributions.reduce((acc, curr) => acc + (curr.amount > 0 ? curr.amount : 0), 0); // Only sum positive payouts for "Total Distributed" visuals? Or net? visual says "Payout Total"

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
          <h3 className="text-4xl font-black text-slate-900 italic font-sport tracking-tight">{users.filter(u => u.status === UserStatus.ACTIVE).length} <span className="text-sm uppercase font-sans text-slate-400 tracking-widest ml-2">Competidores</span></h3>
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
              {lastResult.totalPot !== undefined && <div>Arrecadação: <span className="text-black ml-2 font-bold">R$ {lastResult.totalPot.toFixed(2)}</span></div>}
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
                    <span className={`text-xl font-black font-sport italic tracking-tighter px-4 py-1 rounded-lg border-2 shadow-sm ${dist.amount >= 0
                        ? 'text-lime-600 bg-lime-50 border-lime-200'
                        : 'text-rose-600 bg-rose-50 border-rose-200'
                      }`}>
                      {dist.amount >= 0 ? '+' : ''} R$ {dist.amount.toFixed(2)}
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
