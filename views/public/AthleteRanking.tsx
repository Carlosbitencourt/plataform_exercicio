import React, { useState, useEffect } from 'react';
import { Trophy, Clock, Timer, CheckCircle2, AlertCircle, Award, Star, Zap, TrendingUp } from 'lucide-react';
import { subscribeToUsers, subscribeToCheckIns } from '../../services/db';
import { getEffectiveMonday } from '../../services/rewardSystem';
import { User as UserType, CheckIn, UserStatus } from '../../types';

interface RankedUser {
    user: UserType;
    checkInTime: string;
    checkIn: CheckIn;
}

const AthleteRanking: React.FC = () => {
    const [view, setView] = useState<'daily' | 'weekly' | 'general'>('daily');
    const [users, setUsers] = useState<UserType[]>([]);
    const [checkIns, setCheckIns] = useState<CheckIn[]>([]);
    const [rankedUsers, setRankedUsers] = useState<RankedUser[]>([]);
    const [weeklyRanking, setWeeklyRanking] = useState<UserType[]>([]);
    const [generalRanking, setGeneralRanking] = useState<(UserType & { totalScore: number })[]>([]);

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
        const todaysCheckIns = checkIns.filter(c => c.date === todayStr);

        const ranking: RankedUser[] = [];
        todaysCheckIns.forEach(checkIn => {
            const user = users.find(u => u.id === checkIn.userId);
            if (user) {
                const existing = ranking.find(r => r.user.id === user.id);
                if (!existing) {
                    ranking.push({ user, checkInTime: checkIn.time, checkIn });
                } else if (checkIn.time < existing.checkInTime) {
                    existing.checkInTime = checkIn.time;
                    existing.checkIn = checkIn;
                }
            }
        });

        ranking.sort((a, b) => a.checkInTime.localeCompare(b.checkInTime));
        setRankedUsers(ranking);
    }, [users, checkIns]);

    useEffect(() => {
        if (users.length === 0) return;
        const startOfWeek = getEffectiveMonday();

        const weeklyUsers = users
            .map(user => ({
                ...user,
                weeklyScore: user.weeklyScore || 0
            }))
            .filter(u => u.weeklyScore > 0 || u.status === 'ativo' || u.status === UserStatus.ACTIVE || u.status === 'active' || u.status === 'competicao')
            .sort((a, b) => b.weeklyScore - a.weeklyScore);

        setWeeklyRanking(weeklyUsers);
    }, [users, checkIns]);

    useEffect(() => {
        if (users.length === 0) return;
        const usersWithScores = users
            .map(user => {
                let finalTotalScore = user.totalScore || 0;
                if (finalTotalScore === 0) {
                    const userCheckIns = checkIns.filter(c => c.userId === user.id);
                    finalTotalScore = userCheckIns.reduce((acc, c) => acc + (c.score || 0), 0);
                }
                return { ...user, totalScore: finalTotalScore };
            })
            .filter(u => (u.totalScore || 0) > 0 || u.status === 'ativo' || u.status === 'active' || u.status === 'competicao')
            .sort((a, b) => (b.totalScore || 0) - (a.totalScore || 0));

        setGeneralRanking(usersWithScores as (UserType & { totalScore: number })[]);
    }, [users, checkIns]);

    const getRankStyle = (index: number) => {
        switch (index) {
            case 0: return { border: 'border-amber-400', glow: 'shadow-[0_4px_20px_rgba(251,191,36,0.2)]', icon: 'text-amber-500', bg: 'bg-amber-400' };
            case 1: return { border: 'border-zinc-300', glow: 'shadow-[0_4px_20px_rgba(0,0,0,0.1)]', icon: 'text-zinc-500', bg: 'bg-zinc-100' };
            case 2: return { border: 'border-orange-500', glow: 'shadow-[0_4px_20px_rgba(249,115,22,0.2)]', icon: 'text-orange-500', bg: 'bg-orange-100' };
            default: return { border: 'border-zinc-100', glow: 'shadow-[0_4px_15px_rgba(0,0,0,0.05)]', icon: 'text-zinc-400', bg: 'bg-zinc-50' };
        }
    };

    return (
        <div className="p-6 space-y-8 animate-in slide-in-from-bottom-4 duration-500 pb-28">
            <header className="space-y-4">
                <div className="flex flex-col items-center text-center space-y-2">
                    <Trophy className="w-12 h-12 text-lime-400 animate-pulse" />
                    <h1 className="text-3xl font-black italic font-sport text-white uppercase tracking-tighter">Leaderboard</h1>
                    <p className="text-zinc-500 font-bold uppercase text-[9px] tracking-[0.3em]">Elite Performance Only</p>
                </div>

                <div className="bg-zinc-900/50 p-1.5 rounded-2xl border border-zinc-800 grid grid-cols-3 gap-1 relative overflow-hidden">
                    {/* Animated Slider Placeholder - simplified version */}
                    <button
                        onClick={() => setView('daily')}
                        className={`py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all relative z-10 ${view === 'daily' ? 'text-black bg-lime-400 font-sport italic' : 'text-zinc-500'}`}
                    >
                        Diário
                    </button>
                    <button
                        onClick={() => setView('weekly')}
                        className={`py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all relative z-10 ${view === 'weekly' ? 'text-black bg-lime-400 font-sport italic' : 'text-zinc-500'}`}
                    >
                        Semanal
                    </button>
                    <button
                        onClick={() => setView('general')}
                        className={`py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all relative z-10 ${view === 'general' ? 'text-black bg-lime-400 font-sport italic' : 'text-zinc-500'}`}
                    >
                        Geral
                    </button>
                </div>
            </header>

            <div className="space-y-4">
                {(view === 'daily' ? rankedUsers : view === 'weekly' ? weeklyRanking : generalRanking).map((item, index) => {
                    const user = 'user' in item ? item.user : item as UserType;
                    const score = 'checkIn' in item ? item.checkIn.score : (view === 'weekly' ? (item as UserType).weeklyScore : (item as any).totalScore);
                    const style = getRankStyle(index);
                    const isTop3 = index < 3;

                    return (
                        <div className={`bg-white border-2 ${style.border} ${style.glow} p-4 rounded-[1.5rem] flex items-center justify-between transition-all hover:scale-[1.02] group relative overflow-hidden`}
                            style={{ animationDelay: `${index * 50}ms` }}
                        >
                            {isTop3 && (
                                <div className={`absolute top-0 right-0 p-1.5 px-3 ${style.bg} border-b-2 border-l-2 ${style.border} rounded-bl-xl shadow-sm`}>
                                    <Star className={`w-3.5 h-3.5 fill-current ${index === 0 ? 'text-white' : style.icon}`} />
                                </div>
                            )}

                            <div className="flex items-center gap-4">
                                <div className="relative">
                                    <div className={`w-14 h-14 rounded-2xl overflow-hidden border-2 bg-black ${style.border} relative z-10`}>
                                        {user.photoUrl ? (
                                            <img
                                                src={user.photoUrl}
                                                alt={user.name}
                                                className="w-full h-full object-cover"
                                                loading={index < 3 ? "eager" : "lazy"}
                                                decoding="async"
                                                {...(index < 3 ? { fetchpriority: "high" } : {})}
                                            />
                                        ) : (
                                            <div className={`w-full h-full flex items-center justify-center font-black italic font-sport text-xl ${style.icon}`}>
                                                #{index + 1}
                                            </div>
                                        )}
                                    </div>
                                    {isTop3 && (
                                        <div className={`absolute -top-1.5 -left-1.5 w-6 h-6 rounded-lg ${style.bg} border-2 ${style.border} flex items-center justify-center z-20 shadow-lg`}>
                                            <span className={`text-[10px] font-black italic font-sport ${style.icon}`}>{index + 1}</span>
                                        </div>
                                    )}
                                </div>

                                <div>
                                    <h3 className="text-lg font-black italic font-sport text-zinc-900 uppercase tracking-tight group-hover:text-lime-600 transition-colors leading-none mb-1">
                                        {user.name.split(' ').slice(0, 2).join(' ')}
                                    </h3>
                                    <div className="flex items-center gap-3">
                                        <span className="text-[10px] font-extrabold text-zinc-400 uppercase tracking-widest flex items-center gap-1.5 bg-zinc-100 px-2 py-0.5 rounded-full">
                                            <Clock className="w-3 h-3" />
                                            {'checkInTime' in item ? item.checkInTime : 'ATIVO'}
                                        </span>
                                        <span className="text-sm font-black text-lime-600 italic font-sport">R$ {user.balance.toFixed(2)}</span>
                                    </div>
                                </div>
                            </div>

                            <div className="text-right">
                                <p className="text-[10px] font-black text-zinc-400 uppercase tracking-[0.2em] mb-0.5">Pontos</p>
                                <div className="flex items-center justify-end gap-1.5">
                                    <Zap className="w-4 h-4 text-lime-500 fill-lime-500" />
                                    <span className="text-2xl font-black text-zinc-900 font-sport italic tracking-tighter">
                                        {score.toFixed(0)}
                                    </span>
                                </div>
                            </div>
                        </div>
                    );
                })}

                {(view === 'daily' ? rankedUsers.length : view === 'weekly' ? weeklyRanking.length : generalRanking.length) === 0 && (
                    <div className="py-32 text-center space-y-4 border-2 border-dashed border-zinc-900 rounded-[3rem]">
                        <AlertCircle className="w-12 h-12 text-zinc-800 mx-auto" />
                        <p className="text-zinc-600 font-extrabold uppercase text-[10px] tracking-[0.4em]">Arena Vazia no Momento</p>
                    </div>
                )}
            </div>

            <footer className="pt-8 text-center space-y-4">
                <div className="inline-flex items-center gap-2 px-4 py-2 bg-zinc-900/50 border border-zinc-800 rounded-full">
                    <TrendingUp className="w-3.5 h-3.5 text-lime-400" />
                    <span className="text-[8px] font-black text-zinc-500 uppercase tracking-widest">Calculado em Tempo Real</span>
                </div>
            </footer>
        </div>
    );
};

export default AthleteRanking;
