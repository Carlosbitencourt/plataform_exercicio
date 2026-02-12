import React, { useState, useEffect } from 'react';
import {
    Users,
    TrendingUp,
    ClipboardList,
    Activity,
    Clock,
    Zap,
    ArrowUpRight,
    ShieldCheck,
    MoreHorizontal,
    MapPin
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { subscribeToUsers, subscribeToCheckIns, subscribeToDistributions } from '../../services/db';
import { User, CheckIn, Distribution, UserStatus } from '../../types';

const Dashboard: React.FC = () => {
    const [users, setUsers] = useState<User[]>([]);
    const [checkIns, setCheckIns] = useState<CheckIn[]>([]);
    const [distributions, setDistributions] = useState<Distribution[]>([]);

    useEffect(() => {
        const unsubUsers = subscribeToUsers(setUsers);
        const unsubCheckIns = subscribeToCheckIns(setCheckIns);
        const unsubDist = subscribeToDistributions(setDistributions);

        return () => {
            unsubUsers();
            unsubCheckIns();
            unsubDist();
        };
    }, []);

    // Metrics Calculation
    const activeUsers = users.filter(u => u.status === UserStatus.ACTIVE).length;
    const totalBalance = users.reduce((acc, curr) => acc + curr.balance, 0);
    const totalDistributed = distributions.reduce((acc, curr) => acc + (curr.amount > 0 ? curr.amount : 0), 0);

    const getTodayISO = () => {
        const d = new Date();
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    };
    const today = getTodayISO();
    const checkInsToday = checkIns.filter(c => c.date === today).length;

    // Recent Activity (Top 5 Check-ins)
    const recentCheckIns = [...checkIns].sort((a, b) => b.time.localeCompare(a.time)).slice(0, 5); // Simple sort by string time for "today", ideally meaningful timestamp sort if cross-day

    return (
        <div className="space-y-12 animate-in fade-in duration-700">
            {/* Welcome Section */}
            <div className="flex flex-col md:flex-row justify-between items-end gap-4 border-b-2 border-slate-200 pb-4">
                <div className="space-y-1">
                    <div className="inline-flex items-center gap-1.5 px-2 py-0.5 bg-black text-lime-400 rounded-full text-[10px] font-black uppercase tracking-wider shadow-md">
                        <Activity className="w-3 h-3" /> Live Dashboard
                    </div>
                    <h1 className="text-3xl font-black italic uppercase font-sport text-slate-900 tracking-tighter loading-none">
                        Visão Geral
                    </h1>
                    <p className="text-slate-400 font-bold uppercase text-[9px] tracking-[0.3em]">
                        Monitoramento em Tempo Real • Atletas e Performance
                    </p>
                </div>
                <div className="text-right hidden md:block">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Status do Sistema</p>
                    <div className="flex items-center gap-1.5 text-lime-600 font-black uppercase tracking-widest text-[10px] bg-lime-50 px-2.5 py-1 rounded-lg border border-lime-200">
                        <span className="w-1.5 h-1.5 bg-lime-500 rounded-full animate-pulse"></span> Operacional
                    </div>
                </div>
            </div>

            {/* KPI Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
                {/* KPI 1: Atletas Ativos */}
                <div className="bg-black text-white p-5 rounded-[1.5rem] relative overflow-hidden group shadow-xl">
                    <div className="absolute top-0 right-0 p-3 opacity-10 group-hover:scale-110 transition-transform">
                        <Users className="w-16 h-16" />
                    </div>
                    <div className="relative z-10 space-y-2">
                        <div className="p-2 bg-zinc-800 w-fit rounded-lg text-lime-400">
                            <Users className="w-4 h-4" />
                        </div>
                        <div>
                            <h3 className="text-3xl font-black font-sport italic tracking-tighter">{activeUsers}</h3>
                            <p className="text-[10px] font-black text-zinc-500 uppercase tracking-wider mt-0.5">Atletas Ativos</p>
                        </div>
                        <div className="w-full bg-zinc-800 h-1 rounded-full overflow-hidden mt-1">
                            <div className="bg-lime-400 h-full" style={{ width: `${(activeUsers / (users.length || 1)) * 100}%` }}></div>
                        </div>
                    </div>
                </div>

                {/* KPI 2: Check-ins Hoje */}
                <div className="bg-white p-5 rounded-[1.5rem] border-2 border-slate-200 relative overflow-hidden group hover:border-lime-400 transition-colors shadow-sm">
                    <div className="absolute top-0 right-0 p-3 opacity-5 group-hover:opacity-10 transition-opacity">
                        <ClipboardList className="w-16 h-16 text-slate-900" />
                    </div>
                    <div className="relative z-10 space-y-2">
                        <div className="p-2 bg-slate-50 border border-slate-100 w-fit rounded-lg text-slate-900">
                            <ShieldCheck className="w-4 h-4" />
                        </div>
                        <div>
                            <h3 className="text-3xl font-black font-sport italic tracking-tighter text-slate-900">{checkInsToday}</h3>
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider mt-0.5">Check-ins Hoje</p>
                        </div>
                    </div>
                </div>

                {/* KPI 3: Saldo em Custódia */}
                <div className="bg-white p-5 rounded-[1.5rem] border-2 border-slate-200 relative overflow-hidden group hover:border-lime-400 transition-colors shadow-sm">
                    <div className="absolute top-0 right-0 p-3 opacity-5 group-hover:opacity-10 transition-opacity">
                        <TrendingUp className="w-16 h-16 text-slate-900" />
                    </div>
                    <div className="relative z-10 space-y-2">
                        <div className="p-2 bg-slate-50 border border-slate-100 w-fit rounded-lg text-slate-900">
                            <TrendingUp className="w-4 h-4" />
                        </div>
                        <div>
                            <h3 className="text-2xl font-black font-sport italic tracking-tighter text-slate-900 truncate">R$ {totalBalance.toFixed(0)}</h3>
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider mt-0.5">Saldo dos Atletas</p>
                        </div>
                    </div>
                </div>

                {/* KPI 4: Total Distribuído */}
                <div className="bg-lime-400 text-black p-5 rounded-[1.5rem] relative overflow-hidden group shadow-lg">
                    <div className="absolute top-0 left-0 w-full h-full bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')] opacity-10 pointer-events-none"></div>
                    <div className="relative z-10 space-y-2">
                        <div className="p-2 bg-black/10 w-fit rounded-lg text-black">
                            <Zap className="w-4 h-4 fill-current" />
                        </div>
                        <div>
                            <h3 className="text-2xl font-black font-sport italic tracking-tighter truncate">R$ {totalDistributed.toFixed(0)}</h3>
                            <p className="text-[10px] font-black text-black/60 uppercase tracking-wider mt-0.5">Total Pago em Prêmios</p>
                        </div>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
                {/* Recent Activity Feed */}
                <div className="xl:col-span-2 bg-white rounded-[1.5rem] border-2 border-slate-200 shadow-sm overflow-hidden text-sm">
                    <div className="p-4 border-b-2 border-slate-100 flex justify-between items-center bg-slate-50/50">
                        <h3 className="text-base font-black italic uppercase font-sport text-slate-900 tracking-widest">Atividade Recente</h3>
                        <Link to="/admin/checkins" className="text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-lime-600 flex items-center gap-1 transition-colors">
                            Ver Tudo <ArrowUpRight className="w-3 h-3" />
                        </Link>
                    </div>
                    <div>
                        {recentCheckIns.length > 0 ? (
                            <div className="divide-y-2 divide-slate-100">
                                {recentCheckIns.map(ci => {
                                    const user = users.find(u => u.id === ci.userId);
                                    return (
                                        <div key={ci.id} className="p-3 flex items-center justify-between hover:bg-slate-50 transition-colors group">
                                            <div className="flex items-center gap-3">
                                                <div className="w-8 h-8 bg-slate-100 rounded-lg flex items-center justify-center text-slate-400 border border-slate-200 group-hover:bg-lime-400 group-hover:text-black group-hover:border-lime-500 transition-all">
                                                    <Activity className="w-3.5 h-3.5" />
                                                </div>
                                                <div>
                                                    <h4 className="font-black text-slate-900 uppercase tracking-tight text-xs">{user?.name || 'Desconhecido'}</h4>
                                                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wide flex items-center gap-2">
                                                        <Clock className="w-3 h-3" /> {ci.time} • {ci.date === today ? 'Hoje' : ci.date}
                                                        {ci.address && (
                                                            <> • <MapPin className="w-3 h-3" /> <span className="max-w-[120px] truncate">{ci.address}</span></>
                                                        )}
                                                    </p>
                                                </div>
                                            </div>
                                            <div className="px-2 py-0.5 bg-slate-100 rounded-md text-slate-600 text-[10px] font-black uppercase tracking-widest border border-slate-200">
                                                +{ci.score} PTS
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        ) : (
                            <div className="p-8 text-center text-slate-400 font-bold uppercase tracking-widest text-[10px]">
                                Nenhuma atividade recente registrada hoje.
                            </div>
                        )}
                    </div>
                </div>

                {/* Quick Actions */}
                <div className="bg-black rounded-[1.5rem] p-5 text-white space-y-4 relative overflow-hidden shadow-2xl">
                    <div className="absolute top-0 right-0 w-48 h-48 bg-lime-500/10 blur-[60px] rounded-full pointing-events-none"></div>

                    <div className="relative z-10">
                        <h3 className="text-sm font-black italic uppercase font-sport text-white tracking-widest mb-3 flex items-center gap-2">
                            <Zap className="w-4 h-4 text-lime-400 fill-current" /> Ações Rápidas
                        </h3>

                        <div className="space-y-2">
                            <Link to="/admin/qrcode" className="flex items-center p-2.5 bg-zinc-900 border border-zinc-800 rounded-xl hover:bg-lime-400 hover:text-black hover:border-lime-400 transition-all group">
                                <div className="w-8 h-8 bg-black rounded-lg flex items-center justify-center mr-3 group-hover:bg-white/20 group-hover:text-black">
                                    <Zap className="w-3.5 h-3.5" />
                                </div>
                                <div className="flex-1">
                                    <h4 className="font-black uppercase tracking-wider text-xs">Gerar Acesso</h4>
                                    <p className="text-[9px] text-zinc-500 font-bold uppercase tracking-widest group-hover:text-black/60">Criar Token Diário</p>
                                </div>
                                <ArrowUpRight className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                            </Link>

                            <Link to="/admin/usuarios" className="flex items-center p-2.5 bg-zinc-900 border border-zinc-800 rounded-xl hover:bg-white hover:text-black hover:border-white transition-all group">
                                <div className="w-8 h-8 bg-black rounded-lg flex items-center justify-center mr-3 group-hover:bg-slate-200">
                                    <Users className="w-3.5 h-3.5" />
                                </div>
                                <div className="flex-1">
                                    <h4 className="font-black uppercase tracking-wider text-xs">Novo Atleta</h4>
                                    <p className="text-[9px] text-zinc-500 font-bold uppercase tracking-widest group-hover:text-black/60">Cadastrar Competidor</p>
                                </div>
                                <ArrowUpRight className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                            </Link>

                            <Link to="/admin/distribuicoes" className="flex items-center p-2.5 bg-zinc-900 border border-zinc-800 rounded-xl hover:bg-rose-500 hover:text-white hover:border-rose-500 transition-all group">
                                <div className="w-8 h-8 bg-black rounded-lg flex items-center justify-center mr-3 group-hover:bg-white/20">
                                    <TrendingUp className="w-3.5 h-3.5" />
                                </div>
                                <div className="flex-1">
                                    <h4 className="font-black uppercase tracking-wider text-xs">Processar Payout</h4>
                                    <p className="text-[9px] text-zinc-500 font-bold uppercase tracking-widest group-hover:text-white/80">Rodar Distribuição Diária</p>
                                </div>
                                <ArrowUpRight className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                            </Link>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Dashboard;
