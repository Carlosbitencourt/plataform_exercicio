
import React, { useState, useEffect } from 'react';
import { Trophy, Medal, Crown, Star, TrendingUp, Target, ChevronRight, Award } from 'lucide-react';
import { getDB } from '../../services/storage';
import { User as UserType } from '../../types';

const Ranking: React.FC = () => {
  const [users, setUsers] = useState<UserType[]>([]);

  useEffect(() => {
    const db = getDB();
    // Ordena por saldo (mérito total acumulado)
    const sortedUsers = [...db.users].sort((a, b) => b.balance - a.balance);
    setUsers(sortedUsers);
  }, []);

  const topThree = users.slice(0, 3);
  const theRest = users.slice(3);

  return (
    <div className="space-y-16 animate-in fade-in slide-in-from-bottom-8 duration-1000">
      {/* SEÇÃO: PÓDIO ELITE */}
      <section className="relative">
        <div className="absolute inset-0 bg-lime-500/5 blur-[120px] rounded-full -z-10"></div>
        
        <div className="text-center mb-12 space-y-2">
          <div className="inline-flex items-center gap-2 px-4 py-1 bg-black text-lime-400 rounded-full text-[10px] font-black uppercase tracking-[0.3em] italic shadow-xl">
            <Award className="w-3 h-3" /> Hall da Fama
          </div>
          <h2 className="text-5xl font-black italic uppercase font-sport text-slate-900 tracking-tighter">Top 3 Competidores</h2>
          <p className="text-slate-400 font-bold uppercase text-[10px] tracking-[0.4em]">A elite da performance financeira e física</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 items-end max-w-5xl mx-auto px-4">
          {/* 2º LUGAR (PRATA) */}
          {topThree[1] ? (
            <div className="order-2 md:order-1 space-y-4 text-center group">
              <div className="relative inline-block">
                <div className="w-28 h-28 bg-white border-4 border-slate-300 rounded-full flex items-center justify-center text-slate-300 shadow-2xl group-hover:scale-110 group-hover:-translate-y-2 transition-all duration-500">
                  <span className="text-4xl font-black italic font-sport">2</span>
                </div>
                <div className="absolute -top-4 -right-2 text-slate-400 animate-bounce">
                  <Medal className="w-12 h-12 fill-current drop-shadow-lg" />
                </div>
              </div>
              <div className="bg-white p-6 rounded-[2.5rem] border-2 border-slate-200 shadow-xl relative overflow-hidden">
                <div className="absolute top-0 left-0 w-full h-1 bg-slate-300"></div>
                <h4 className="font-black italic uppercase font-sport text-slate-900 truncate text-lg">{topThree[1].name}</h4>
                <p className="text-2xl font-black text-slate-500 font-sport">R$ {topThree[1].balance.toFixed(2)}</p>
                <div className="mt-3 text-[9px] font-black text-slate-300 uppercase tracking-widest italic">Silver Tier</div>
              </div>
            </div>
          ) : <div className="order-2 md:order-1 hidden md:block"></div>}

          {/* 1º LUGAR (OURO) */}
          {topThree[0] ? (
            <div className="order-1 md:order-2 space-y-6 text-center group pb-12 scale-110 z-10">
              <div className="relative inline-block">
                <div className="absolute inset-0 bg-yellow-400/30 blur-3xl rounded-full scale-150 animate-pulse"></div>
                <div className="relative w-36 h-36 bg-black border-4 border-yellow-500 rounded-full flex items-center justify-center text-yellow-500 shadow-[0_0_60px_rgba(234,179,8,0.4)] group-hover:scale-110 transition-all duration-700">
                  <Crown className="w-20 h-20 fill-current drop-shadow-[0_0_10px_rgba(234,179,8,0.8)]" />
                </div>
                <div className="absolute -top-8 left-1/2 -translate-x-1/2 bg-yellow-500 text-black px-6 py-2 rounded-full font-black text-[11px] uppercase tracking-widest shadow-[0_10px_25px_rgba(234,179,8,0.5)] whitespace-nowrap italic">
                  CAMPEÃO ATUAL
                </div>
              </div>
              <div className="bg-white p-10 rounded-[3rem] border-4 border-yellow-500 shadow-[0_30px_70px_rgba(0,0,0,0.15)] relative">
                <div className="absolute inset-0 bg-gradient-to-b from-yellow-50/50 to-transparent pointer-events-none"></div>
                <h4 className="text-3xl font-black italic uppercase font-sport text-slate-900 tracking-tight">{topThree[0].name}</h4>
                <p className="text-4xl font-black text-yellow-600 font-sport mt-1">R$ {topThree[0].balance.toFixed(2)}</p>
                <div className="mt-4 inline-flex items-center gap-2 px-4 py-1 bg-yellow-500 text-black rounded-lg text-[9px] font-black uppercase tracking-widest italic">
                   <Star className="w-3 h-3 fill-current" /> MVP da Temporada
                </div>
              </div>
            </div>
          ) : (
            <div className="order-1 md:order-2 py-20 text-center">
              <div className="w-20 h-20 bg-slate-100 rounded-full mx-auto flex items-center justify-center text-slate-200">
                <Trophy className="w-10 h-10" />
              </div>
              <p className="mt-4 text-slate-300 font-black uppercase text-[10px] tracking-widest">Sem Líderes</p>
            </div>
          )}

          {/* 3º LUGAR (BRONZE) */}
          {topThree[2] ? (
            <div className="order-3 md:order-3 space-y-4 text-center group">
              <div className="relative inline-block">
                <div className="w-24 h-24 bg-white border-4 border-orange-700/30 rounded-full flex items-center justify-center text-orange-700/50 shadow-xl group-hover:scale-110 group-hover:-translate-y-2 transition-all duration-500">
                  <span className="text-3xl font-black italic font-sport">3</span>
                </div>
                <div className="absolute -top-3 -right-1 text-orange-700">
                  <Medal className="w-10 h-10 fill-current drop-shadow-md" />
                </div>
              </div>
              <div className="bg-white p-6 rounded-[2.5rem] border-2 border-slate-200 shadow-xl relative overflow-hidden">
                <div className="absolute top-0 left-0 w-full h-1 bg-orange-700/40"></div>
                <h4 className="font-black italic uppercase font-sport text-slate-900 truncate text-lg">{topThree[2].name}</h4>
                <p className="text-2xl font-black text-orange-800/60 font-sport">R$ {topThree[2].balance.toFixed(2)}</p>
                <div className="mt-3 text-[9px] font-black text-slate-300 uppercase tracking-widest italic">Bronze Tier</div>
              </div>
            </div>
          ) : <div className="order-3 md:order-3 hidden md:block"></div>}
        </div>
      </section>

      {/* SEÇÃO: O RESTANTE DA LISTA */}
      <section className="max-w-5xl mx-auto space-y-8">
        <div className="flex items-center justify-between px-10">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-black rounded-2xl flex items-center justify-center text-lime-400 shadow-lg">
              <TrendingUp className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-2xl font-black italic uppercase font-sport text-slate-900 tracking-widest">Classificação Geral</h3>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Abaixo do Top 3 Elite</p>
            </div>
          </div>
          <div className="hidden md:flex items-center gap-2 px-6 py-2 bg-white border-2 border-slate-200 rounded-full shadow-sm">
             <span className="w-2 h-2 bg-lime-500 rounded-full animate-pulse"></span>
             <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">Live Ranking Update</span>
          </div>
        </div>

        <div className="bg-white rounded-[3rem] border-2 border-slate-300 overflow-hidden shadow-[0_40px_100px_rgba(0,0,0,0.05)]">
          <div className="grid grid-cols-1 divide-y-2 divide-slate-100">
            {theRest.length > 0 ? theRest.map((user, index) => (
              <div key={user.id} className="flex items-center px-10 py-8 hover:bg-slate-50/80 transition-all group cursor-default">
                <div className="w-16 text-3xl font-black italic font-sport text-slate-400 group-hover:text-black transition-colors">
                  #{index + 4}
                </div>
                
                <div className="flex-1 flex items-center gap-6">
                  <div className="w-14 h-14 bg-zinc-900 rounded-2xl flex items-center justify-center text-white font-black text-xl border-2 border-zinc-800 shadow-md group-hover:scale-110 transition-transform">
                    {user.name[0].toUpperCase()}
                  </div>
                  <div>
                    <div className="text-base font-black text-slate-900 uppercase tracking-tight flex items-center gap-3">
                      {user.name}
                      {index + 4 <= 10 && (
                        <span className="px-2 py-0.5 bg-slate-100 text-slate-500 rounded border border-slate-200 text-[8px] font-black uppercase tracking-widest">
                          Top 10
                        </span>
                      )}
                    </div>
                    <div className="text-[10px] text-slate-400 font-bold tracking-[0.2em] uppercase mt-1">
                      Protocolo: <span className="text-slate-600 font-sport italic">{user.uniqueCode}</span>
                    </div>
                  </div>
                </div>

                <div className="text-right flex items-center gap-8">
                  <div>
                    <div className="text-[9px] font-black text-slate-300 uppercase tracking-widest mb-1">Performance</div>
                    <div className="text-xl font-black font-sport italic text-slate-900 tracking-tighter">
                      R$ {user.balance.toFixed(2)}
                    </div>
                  </div>
                  <ChevronRight className="w-5 h-5 text-slate-200 group-hover:text-lime-500 transition-colors" />
                </div>
              </div>
            )) : (
              <div className="p-32 text-center space-y-6">
                <div className="w-20 h-20 bg-slate-50 rounded-full mx-auto flex items-center justify-center text-slate-200 border-2 border-dashed border-slate-200">
                  <Target className="w-10 h-10" />
                </div>
                <div className="space-y-1">
                  <p className="text-slate-300 font-black uppercase tracking-[0.5em] italic text-sm">Sem outros competidores</p>
                  <p className="text-slate-200 text-[9px] font-black uppercase tracking-widest">Cadastre mais atletas para preencher o ranking</p>
                </div>
              </div>
            )}
          </div>

          {/* Footer do Ranking */}
          <div className="bg-slate-50 px-10 py-6 border-t-2 border-slate-100 flex justify-between items-center">
            <p className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em]">
              Sincronizado: {new Date().toLocaleTimeString()}
            </p>
            <div className="flex gap-4">
               <div className="flex items-center gap-1">
                 <div className="w-2 h-2 bg-yellow-500 rounded-full"></div>
                 <span className="text-[8px] font-black uppercase text-slate-400 tracking-widest">Elite</span>
               </div>
               <div className="flex items-center gap-1">
                 <div className="w-2 h-2 bg-slate-300 rounded-full"></div>
                 <span className="text-[8px] font-black uppercase text-slate-400 tracking-widest">Challenger</span>
               </div>
            </div>
          </div>
        </div>
      </section>

      <div className="text-center pb-12">
        <p className="text-[9px] font-black text-slate-300 uppercase tracking-[0.7em] animate-pulse">Push your limits • Reward your effort • FitReward System</p>
      </div>
    </div>
  );
};

export default Ranking;
