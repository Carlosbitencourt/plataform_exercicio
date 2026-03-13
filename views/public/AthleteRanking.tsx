import React, { useState, useEffect } from 'react';
import { Trophy, Clock, Timer, CheckCircle2, AlertCircle, Award, Star, Zap, TrendingUp, Dumbbell, Footprints, Activity as ActivityIcon, Bike } from 'lucide-react';
import { subscribeToUsers, subscribeToCheckIns, subscribeToModalities } from '../../services/db';
import { getEffectiveMonday } from '../../services/rewardSystem';
import { User as UserType, CheckIn, UserStatus, Modality } from '../../types';

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
    const [modalities, setModalities] = useState<Modality[]>([]);

    useEffect(() => {
        const unsubUsers = subscribeToUsers(setUsers);
        const unsubCheckIns = subscribeToCheckIns(setCheckIns);
        const unsubModalities = subscribeToModalities(setModalities);
        return () => {
            unsubUsers();
            unsubCheckIns();
            unsubModalities();
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
        // Neon Lime Theme for all ranks
        const neonLime = {
            accent: 'bg-lime-400',
            gradient: 'from-lime-300 via-lime-400 to-lime-500',
            glow: 'shadow-[0_0_20px_rgba(163,230,53,0.4)]',
            icon: 'text-lime-400',
            text: 'text-lime-400',
            outline: 'border-lime-400/50',
            bg: 'bg-lime-400'
        };

        switch (index) {
            case 0: return { ...neonLime, glow: 'shadow-[0_0_30px_rgba(163,230,53,0.6)]', gradient: 'from-lime-200 via-lime-400 to-lime-500' };
            case 1: return { ...neonLime, glow: 'shadow-[0_0_25px_rgba(163,230,53,0.4)]', gradient: 'from-lime-300 via-lime-400 to-lime-500' };
            case 2: return { ...neonLime, glow: 'shadow-[0_0_20px_rgba(163,230,53,0.3)]', gradient: 'from-lime-400 via-lime-500 to-lime-600' };
            default: return {
                accent: 'bg-zinc-800',
                gradient: 'from-zinc-700 to-zinc-900',
                glow: '',
                icon: 'text-zinc-500',
                text: 'text-zinc-500',
                outline: 'border-white/5',
                bg: 'bg-zinc-800'
            };
        }
    };

    const getIconComponent = (iconName: string) => {
        switch (iconName) {
            case 'Dumbbell': return <Dumbbell className="w-3.5 h-3.5" />;
            case 'Footprints': return <Footprints className="w-3.5 h-3.5" />;
            case 'Zap': return <Zap className="w-3.5 h-3.5" />;
            case 'Bike': return <Bike className="w-3.5 h-3.5" />;
            default: return <ActivityIcon className="w-3.5 h-3.5" />;
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
                        <div key={user.id} className={`bg-zinc-900/40 backdrop-blur-xl border border-white/10 ${style.glow} p-4 rounded-[1.25rem] flex items-center justify-between transition-all hover:scale-[1.01] hover:bg-zinc-900/60 group relative overflow-hidden`}
                            style={{ animationDelay: `${index * 50}ms` }}
                        >
                            {/* Slanted Accent Bar */}
                            <div className={`absolute top-0 left-0 bottom-0 w-1.5 ${style.accent} opacity-80`} />

                            <div className="flex items-center gap-4 relative z-10">
                                <div className="relative">
                                    <div className={`w-16 h-16 rounded-2xl overflow-hidden border-2 bg-zinc-950 ${style.outline} relative z-10 transform transition-transform group-hover:scale-105`}>
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
                                    
                                    {/* Rank Badge - Neon Lime Game Style */}
                                    <div className={`absolute -top-2.5 -left-2.5 w-8 h-8 bg-gradient-to-br ${style.gradient} ${style.glow} flex items-center justify-center z-20 transform -skew-x-12 rounded-lg border border-white/30 shadow-[0_0_15px_rgba(163,230,53,0.5)]`}>
                                        <div className="absolute inset-0 bg-white/20 opacity-40 rounded-lg pointer-events-none" />
                                        <span className={`text-[13px] font-black italic font-sport transform skew-x-12 ${index < 3 ? 'text-black' : 'text-white'}`}>
                                            {index + 1}
                                        </span>
                                    </div>
                                </div>

                                <div className="space-y-2">
                                    <h3 className="text-xl font-black italic font-sport text-white uppercase tracking-tight group-hover:text-lime-400 transition-colors leading-none">
                                        {user.name.split(' ').slice(0, 2).join(' ')}
                                    </h3>
                                    
                                    <div className="flex items-center gap-3">
                                        {/* Activity Icon */}
                                        {user.modalityId && (
                                            <div className="flex items-center justify-center bg-lime-400/10 w-7 h-7 rounded-lg border border-lime-400/20 text-lime-400 shadow-[0_0_10px_rgba(163,230,53,0.1)]" title={modalities.find(m => m.id === user.modalityId)?.name}>
                                                {getIconComponent(modalities.find(m => m.id === user.modalityId)?.icon || 'Activity')}
                                            </div>
                                        )}
                                        {/* Weekly Attendance Blocks - Hidden in General View */}
                                        {view !== 'general' && (
                                            <div className="flex flex-col gap-1">
                                                <div className="flex gap-1">
                                                    {['SEG', 'TER', 'QUA', 'QUI', 'SEX'].map((day, i) => {
                                                        const monday = getEffectiveMonday();
                                                        const d = new Date(monday);
                                                        d.setDate(monday.getDate() + i);
                                                        const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
                                                        const isPresent = checkIns.some(c => c.userId === user.id && c.date === dateStr);
                                                        const todayStr = new Date().toISOString().split('T')[0];
                                                        const isPast = dateStr < todayStr;

                                                        return (
                                                            <div key={day} className="flex flex-col items-center gap-1">
                                                                <div className={`w-6 h-1 rounded-full ${isPresent ? 'bg-lime-400 shadow-[0_0_8px_rgba(163,230,53,0.6)]' : isPast ? 'bg-red-500/50' : 'bg-zinc-800'} transition-all`} />
                                                                <span className={`text-[7px] font-black tracking-tighter ${isPresent ? 'text-lime-400' : isPast ? 'text-red-500/70' : 'text-zinc-600'}`}>
                                                                    {day}
                                                                </span>
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            </div>
                                        )}

                                    </div>

                                    <div className="flex items-center gap-2">
                                        <div className={`flex items-center gap-1.5 px-2.5 py-0.5 rounded-lg border ${user.status === 'eliminado' ? 'bg-red-500/10 border-red-500/20' : 'bg-white/5 border-white/5'}`}>
                                            <Clock className={`w-3 h-3 ${user.status === 'eliminado' ? 'text-red-500' : 'text-zinc-500'}`} />
                                            <span className={`text-[9px] font-black uppercase tracking-widest ${user.status === 'eliminado' ? 'text-red-500' : 'text-zinc-400'}`}>
                                                {'checkInTime' in item ? item.checkInTime : (user.status === 'eliminado' ? 'ELIMINADO' : 'ATIVO')}
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div className="text-right relative z-10">
                                <p className="text-[9px] font-black text-zinc-500 uppercase tracking-[0.2em] mb-1">Score</p>
                                <div className="flex items-center justify-end gap-2">
                                    <Zap className="w-4 h-4 text-lime-400 fill-lime-400 animate-pulse" />
                                    <span className="text-3xl font-black text-white font-sport italic tracking-tighter">
                                        {Math.floor(score)}
                                    </span>
                                </div>
                            </div>

                            {/* Decorative Background Element */}
                            <div className="absolute -bottom-4 -right-4 w-24 h-24 bg-white/[0.02] rounded-full blur-2xl" />
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
