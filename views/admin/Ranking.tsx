import React, { useState, useEffect } from 'react';
import { Trophy, Clock, Search, Timer, CheckCircle2, AlertCircle } from 'lucide-react';
import { subscribeToUsers, subscribeToCheckIns } from '../../services/db';
import { User as UserType, CheckIn } from '../../types';

interface RankedUser {
  user: UserType;
  checkInTime: string;
  checkIn: CheckIn;
}

const Ranking: React.FC = () => {
  const [users, setUsers] = useState<UserType[]>([]);
  const [checkIns, setCheckIns] = useState<CheckIn[]>([]);
  const [rankedUsers, setRankedUsers] = useState<RankedUser[]>([]);

  useEffect(() => {
    const unsubUsers = subscribeToUsers(setUsers);
    const unsubCheckIns = subscribeToCheckIns(setCheckIns);
    return () => {
      unsubUsers();
      unsubCheckIns();
    };
  }, []);

  useEffect(() => {
    if (users.length === 0 || checkIns.length === 0) return;

    const today = new Date();
    const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

    // Filter check-ins for today
    const todaysCheckIns = checkIns.filter(c => c.date === todayStr);

    // Map check-ins to users
    const ranking: RankedUser[] = [];

    todaysCheckIns.forEach(checkIn => {
      const user = users.find(u => u.id === checkIn.userId);
      if (user) {
        // Correct check for duplicates if needed, but assuming one valid check-in per day per user logic elsewhere
        // If a user has multiple, we take the earliest one by sorting checkIns first or handling here.
        // Let's assume we want the *earliest* check-in to count for the ranking.
        const existing = ranking.find(r => r.user.id === user.id);
        if (!existing) {
          ranking.push({
            user,
            checkInTime: checkIn.time,
            checkIn
          });
        } else {
          // If existing time is later than this checkIn time, replace it (earlier is better)
          if (checkIn.time < existing.checkInTime) {
            existing.checkInTime = checkIn.time;
            existing.checkIn = checkIn;
          }
        }
      }
    });

    // Sort by time ASC (earlier is better)
    ranking.sort((a, b) => a.checkInTime.localeCompare(b.checkInTime));

    setRankedUsers(ranking);
  }, [users, checkIns]);

  const getMedalColor = (index: number) => {
    switch (index) {
      case 0: return 'bg-yellow-400 text-black border-yellow-500 shadow-yellow-400/50';
      case 1: return 'bg-zinc-300 text-black border-zinc-400 shadow-zinc-300/50';
      case 2: return 'bg-orange-400 text-black border-orange-500 shadow-orange-400/50';
      default: return 'bg-zinc-800 text-zinc-400 border-zinc-700';
    }
  };

  const getBorderColor = (index: number) => {
    switch (index) {
      case 0: return 'border-yellow-500 shadow-yellow-400/50';
      case 1: return 'border-zinc-400 shadow-zinc-300/50';
      case 2: return 'border-orange-500 shadow-orange-400/50';
      default: return 'border-slate-200';
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-8 duration-1000">
      <div className="text-center space-y-1.5">
        <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 bg-lime-400/10 text-lime-400 rounded-full text-[10px] font-black uppercase tracking-widest border border-lime-400/20">
          <Clock className="w-3 h-3" /> Ranking Diário
        </div>
        <h2 className="text-2xl font-black italic uppercase font-sport text-slate-900 tracking-tighter">
          Quem Chegou Primeiro?
        </h2>
        <p className="text-slate-400 font-bold uppercase text-[10px] tracking-widest">
          {new Date().toLocaleDateString('pt-BR', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
        </p>
      </div>

      <div className="max-w-4xl mx-auto">
        <div className="bg-white rounded-[2rem] border-2 border-slate-200 overflow-hidden shadow-xl">
          <div className="grid grid-cols-1 divide-y-2 divide-slate-100">
            {rankedUsers.length > 0 ? rankedUsers.map((item, index) => (
              <div key={item.user.id} className="flex items-center p-4 hover:bg-slate-50 transition-colors group">
                <div className="mr-5 relative">
                  {item.user.photoUrl ? (
                    <div className={`w-12 h-12 rounded-xl flex items-center justify-center border-4 shadow-lg transition-transform group-hover:scale-110 overflow-hidden relative bg-white ${getBorderColor(index)}`}>
                      <img
                        src={item.user.photoUrl}
                        alt={item.user.name}
                        className="w-full h-full object-cover"
                        onError={(e) => {
                          (e.target as HTMLImageElement).style.display = 'none';
                          const parent = (e.target as HTMLImageElement).parentElement;
                          if (parent) {
                            parent.classList.remove('rounded-xl', 'border-4', 'bg-white', 'w-12', 'h-12');
                            parent.classList.add('w-10', 'h-10', 'rounded-lg', 'font-black', 'text-lg', 'italic', 'font-sport', 'border-2');
                            // Apply fallback medal style manually or reset to render the "else" block (harder here, simple DOM manipulation is easier)
                            parent.className = `w-10 h-10 rounded-lg flex items-center justify-center font-black text-lg italic font-sport border-2 shadow-lg transition-transform group-hover:scale-110 ${getMedalColor(index)}`;
                            parent.innerHTML = `#${index + 1}`;
                          }
                        }}
                      />
                      <div className="absolute -bottom-1 -right-1 bg-slate-900 text-white text-[9px] font-black w-5 h-5 flex items-center justify-center rounded-full border-2 border-white shadow-sm z-10">
                        {index + 1}
                      </div>
                    </div>
                  ) : (
                    <div className={`w-10 h-10 rounded-lg flex items-center justify-center font-black text-lg italic font-sport border-2 shadow-lg transition-transform group-hover:scale-110 ${getMedalColor(index)}`}>
                      #{index + 1}
                    </div>
                  )}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <h3 className="text-lg font-black italic uppercase font-sport text-slate-900 truncate">
                      {item.user.name}
                    </h3>
                    {index === 0 && (
                      <span className="px-1.5 py-0.5 bg-yellow-100 text-yellow-700 text-[9px] font-black uppercase tracking-widest rounded border border-yellow-200 flex items-center gap-1">
                        <Trophy className="w-2.5 h-2.5" /> Líder
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-3 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                    <span className="flex items-center gap-1">
                      <CheckCircle2 className="w-3 h-3 text-lime-500" />
                      Check-in: <span className="text-slate-900 font-sport italic text-xs">{item.checkInTime}</span>
                    </span>
                    {item.checkIn.score > 0 && (
                      <span className="bg-slate-100 px-1.5 py-0.5 rounded text-slate-500">
                        +{item.checkIn.score.toFixed(0)} pts
                      </span>
                    )}
                  </div>
                </div>

                <div className="text-right pl-3">
                  <p className="text-[9px] font-black text-slate-300 uppercase tracking-widest mb-0.5">Saldo Total</p>
                  <p className="font-black font-sport italic text-slate-900 text-base">R$ {item.user.balance.toFixed(2)}</p>
                </div>
              </div>
            )) : (
              <div className="py-32 text-center space-y-6">
                <div className="w-24 h-24 bg-slate-50 rounded-full mx-auto flex items-center justify-center text-slate-300 border-4 border-dashed border-slate-200">
                  <Timer className="w-10 h-10" />
                </div>
                <div className="space-y-2">
                  <p className="text-slate-400 font-black uppercase tracking-[0.2em]">Sem registros hoje</p>
                  <p className="text-slate-300 text-[9px] font-black uppercase tracking-widest max-w-xs mx-auto">
                    O ranking será formado assim que os atletas começarem a fazer check-in.
                  </p>
                </div>
              </div>
            )}
          </div>

          <div className="bg-slate-50 px-8 py-4 border-t-2 border-slate-100 flex justify-center">
            <p className="text-[8px] text-slate-400 font-black uppercase tracking-widest flex items-center gap-2">
              <AlertCircle className="w-3 h-3" />
              Critério de Desempate: Horário do Check-in (Mais cedo = Melhor posição)
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Ranking;
