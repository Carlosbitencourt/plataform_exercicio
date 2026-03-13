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
    Calendar,
    MapPin,
    X,
    UserMinus,
    Trash2
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { subscribeToUsers, subscribeToCheckIns, subscribeToDistributions, addCheckIn, subscribeToSettings } from '../../services/db';
import { User, CheckIn, Distribution, UserStatus, SystemSettings } from '../../types';
import { runWeeklyPenaltyCheck, getWeekDays, syncUserAbsences } from '../../services/rewardSystem';

type FilterType = 'week' | 'month' | 'custom';

const Dashboard: React.FC = () => {
    const [users, setUsers] = useState<User[]>([]);
    const [checkIns, setCheckIns] = useState<CheckIn[]>([]);
    const [distributions, setDistributions] = useState<Distribution[]>([]);
    const [settings, setSettings] = useState<SystemSettings | null>(null);
    const [filterType, setFilterType] = useState<FilterType>('week');
    const [customRange, setCustomRange] = useState({ start: '', end: '' });
    const [showAbsenceModal, setShowAbsenceModal] = useState(false);
    const [absenceDetails, setAbsenceDetails] = useState<{ userName: string, userId: string, date: string }[]>([]);
    const [isExcusing, setIsExcusing] = useState<string | null>(null);

    useEffect(() => {
        const unsubUsers = subscribeToUsers(setUsers);
        const unsubCheckIns = subscribeToCheckIns(setCheckIns);
        const unsubDist = subscribeToDistributions(setDistributions);
        const unsubSettings = subscribeToSettings(setSettings);

        return () => {
            unsubUsers();
            unsubCheckIns();
            unsubDist();
            unsubSettings();
        };
    }, []);

    // Helper functions for date ranges
    const getRangeDates = () => {
        const now = new Date();
        let start = new Date();
        let end = new Date();

        if (filterType === 'week') {
            const day = now.getDay();
            const diff = now.getDate() - day + (day === 0 ? -6 : 1); // Monday
            start = new Date(now.setDate(diff));
            start.setHours(0, 0, 0, 0);
            end = new Date(); // Up to now
        } else if (filterType === 'month') {
            start = new Date(now.getFullYear(), now.getMonth(), 1);
            start.setHours(0, 0, 0, 0);
            end = new Date();
        } else if (filterType === 'custom' && customRange.start && customRange.end) {
            start = new Date(customRange.start);
            start.setHours(0, 0, 0, 0);
            end = new Date(customRange.end);
            end.setHours(23, 59, 59, 999);
        }

        return { start, end };
    };

    const { start: startDate, end: endDate } = getRangeDates();

    const isDateInRange = (dateStr: string) => {
        const d = new Date(dateStr + 'T12:00:00'); // Midday to avoid TZ issues
        return d >= startDate && d <= endDate;
    };

    // Metrics Calculation
    const activeUsersList = users.filter(u =>
        u.status === UserStatus.ACTIVE ||
        u.status === 'ativo' ||
        u.status === 'competicao' ||
        u.status === 'active'
    );
    const activeUsersCount = activeUsersList.length;

    const totalBalance = users
        .filter(u => u.status === UserStatus.ACTIVE || u.status === UserStatus.PENDING || u.status === 'ativo' || u.status === 'active')
        .reduce((acc, curr) => acc + (curr.balance ?? 0), 0);

    // Filtered Check-ins
    const filteredCheckIns = checkIns.filter(c => isDateInRange(c.date));
    const checkInsInPeriod = filteredCheckIns.length;

    // Filtered Distributions (Positive only)
    const filteredDistributions = distributions.filter(d =>
        d.amount > 0 && isDateInRange(d.date.split('T')[0])
    );
    const totalDistributed = filteredDistributions.reduce((acc, curr) => acc + curr.amount, 0);

    // Helper for local date string (YYYY-MM-DD)
    const toLocalISO = (d: Date) => {
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    };

    // Calculate Absences (Faltas) for the period
    const getAbsencesDetails = () => {
        const weekdaysInRange: string[] = [];
        const details: { userName: string, userId: string, date: string }[] = [];

        const current = new Date(startDate);
        const todayAtStart = new Date();
        todayAtStart.setHours(0, 0, 0, 0);

        const limit = endDate < todayAtStart ? endDate : new Date(todayAtStart.getTime() - 86400000);

        while (current <= limit) {
            const dayOfWeek = current.getDay();
            if (dayOfWeek >= 1 && dayOfWeek <= 5) { // Mon-Fri
                weekdaysInRange.push(toLocalISO(current));
            }
            current.setDate(current.getDate() + 1);
        }

        let totalMisses = 0;
        activeUsersList.forEach(user => {
            const userCheckInDates = new Set(
                checkIns
                    .filter(c => c.userId === user.id)
                    .map(c => c.date)
            );

            const registrationDate = user.createdAt ? new Date(user.createdAt) : null;
            if (registrationDate) {
                registrationDate.setHours(0, 0, 0, 0);
            }

            weekdaysInRange.forEach(date => {
                // Restoration of registration date filter to ensure simulation is accurate
                if (registrationDate) {
                    const regDateISO = registrationDate.toISOString().split('T')[0];
                    if (date < regDateISO) return;
                }

                if (!userCheckInDates.has(date)) {
                    totalMisses++;
                    details.push({ userName: user.name, userId: user.id, date });
                }
            });
        });

        return { count: totalMisses, details };
    };

    const absencesResult = getAbsencesDetails();
    
    // Switch to transaction-based calculation for primary metrics
    const penaltyDistributions = distributions.filter(d => 
        d.amount < 0 && 
        d.reason?.includes('FALTA') && 
        isDateInRange(d.date.split('T')[0])
    );
    
    const totalAbsences = penaltyDistributions.length;
    const estimatedPool = Math.abs(penaltyDistributions.reduce((acc, curr) => acc + curr.amount, 0));
    
    // For the modal details, we now use the actual penalty distributions
    const actualAbsenceDetails = penaltyDistributions.map(d => {
        const user = users.find(u => u.id === d.userId);
        return {
            userName: user?.name || 'Desconhecido',
            userId: d.userId,
            date: d.date.split('T')[0]
        };
    });

    const getTodayISO = () => {
        const d = new Date();
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    };
    const todayStr = getTodayISO();

    const checkInsToday = checkIns.filter(c =>
        c.date === todayStr ||
        c.date.startsWith(todayStr) ||
        c.date.split('T')[0] === todayStr
    ).length;

    // Recent Activity (Top 5 Check-ins)
    const recentCheckIns = [...checkIns].sort((a, b) => b.time.localeCompare(a.time)).slice(0, 5);

    const handleExcuseAbsence = async (userId: string, date: string, userName: string) => {
        if (!window.confirm(`DESEJA JUSTIFICAR A FALTA DE ${userName.toUpperCase()} NO DIA ${new Date(date + 'T12:00:00').toLocaleDateString('pt-BR')}?\n\nISSO IRÁ CRIAR UM CHECK-IN MANUAL E CORRIGIR O SALDO CASO TENHA SIDO PENALIZADO.`)) return;

        setIsExcusing(`${userId}-${date}`);
        try {
            // 1. Criar Check-in manual (justificativa)
            await addCheckIn({
                userId,
                date,
                time: '08:00', // Horário padrão para justificativa
                score: 0,      // Justificativa não dá pontos
                latitude: 0,
                longitude: 0,
                timeSlotId: 'JUSTIFICATIVA',
                address: 'JUSTIFICATIVA MANUAL (ADMIN)'
            });

            // 2. Sincronizar faltas para este usuário (isso remove a penalidade se existir)
            await syncUserAbsences(userId, true); // Full sync to be safe

            alert(`FALTA DE ${userName.toUpperCase()} JUSTIFICADA COM SUCESSO!`);
        } catch (error) {
            console.error("Error excusing absence:", error);
            alert("ERRO AO JUSTIFICAR FALTA.");
        } finally {
            setIsExcusing(null);
        }
    };

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

                <div className="flex flex-col items-end gap-3">
                    <div className="flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200 shadow-sm">
                        <button
                            onClick={() => setFilterType('week')}
                            className={`px-3 py-1.5 text-[9px] font-black uppercase tracking-widest rounded-lg transition-all ${filterType === 'week' ? 'bg-black text-white' : 'text-slate-500 hover:text-black'}`}
                        >
                            Semana
                        </button>
                        <button
                            onClick={() => setFilterType('month')}
                            className={`px-3 py-1.5 text-[9px] font-black uppercase tracking-widest rounded-lg transition-all ${filterType === 'month' ? 'bg-black text-white' : 'text-slate-500 hover:text-black'}`}
                        >
                            Mês
                        </button>
                        <button
                            onClick={() => setFilterType('custom')}
                            className={`px-3 py-1.5 text-[9px] font-black uppercase tracking-widest rounded-lg transition-all ${filterType === 'custom' ? 'bg-black text-white' : 'text-slate-500 hover:text-black'}`}
                        >
                            Personalizado
                        </button>
                    </div>

                    {filterType === 'custom' && (
                        <div className="flex items-center gap-2 animate-in slide-in-from-top-2 duration-300">
                            <input
                                type="date"
                                value={customRange.start}
                                onChange={(e) => setCustomRange(prev => ({ ...prev, start: e.target.value }))}
                                className="bg-white border-2 border-slate-200 rounded-lg px-2 py-1 text-[10px] font-bold focus:border-lime-400 outline-none"
                            />
                            <span className="text-[10px] font-black text-slate-400">ATÉ</span>
                            <input
                                type="date"
                                value={customRange.end}
                                onChange={(e) => setCustomRange(prev => ({ ...prev, end: e.target.value }))}
                                className="bg-white border-2 border-slate-200 rounded-lg px-2 py-1 text-[10px] font-bold focus:border-lime-400 outline-none"
                            />
                        </div>
                    )}
                </div>

                <div className="text-right hidden md:block">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Status do Sistema</p>
                    <div className="flex items-center gap-1.5 text-lime-600 font-black uppercase tracking-widest text-[10px] bg-lime-50 px-2.5 py-1 rounded-lg border border-lime-200">
                        <span className="w-1.5 h-1.5 bg-lime-500 rounded-full animate-pulse"></span> Operacional
                    </div>
                </div>
            </div>

            {/* KPI Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
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
                            <h3 className="text-3xl font-black font-sport italic tracking-tighter">{activeUsersCount}</h3>
                            <p className="text-[10px] font-black text-zinc-500 uppercase tracking-wider mt-0.5">Atletas Ativos</p>
                        </div>
                        <div className="w-full bg-zinc-800 h-1 rounded-full overflow-hidden mt-1">
                            <div className="bg-lime-400 h-full" style={{ width: `${(activeUsersCount / (users.length || 1)) * 100}%` }}></div>
                        </div>
                    </div>
                </div>

                {/* KPI 2: Check-ins no Período */}
                <div className="bg-white p-5 rounded-[1.5rem] border-2 border-slate-200 relative overflow-hidden group hover:border-lime-400 transition-colors shadow-sm">
                    <div className="absolute top-0 right-0 p-3 opacity-5 group-hover:opacity-10 transition-opacity">
                        <ClipboardList className="w-16 h-16 text-slate-900" />
                    </div>
                    <div className="relative z-10 space-y-2">
                        <div className="p-2 bg-slate-50 border border-slate-100 w-fit rounded-lg text-slate-900">
                            <ShieldCheck className="w-4 h-4" />
                        </div>
                        <div>
                            <div className="flex items-baseline gap-2">
                                <h3 className="text-3xl font-black font-sport italic tracking-tighter text-slate-900">{checkInsInPeriod}</h3>
                                {checkInsToday > 0 && (
                                    <span className="text-[9px] font-black text-lime-600 bg-lime-50 px-1.5 py-0.5 rounded-md border border-lime-100">+{checkInsToday} HOJE</span>
                                )}
                            </div>
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider mt-0.5">Check-ins no Período</p>
                        </div>
                    </div>
                </div>

                {/* KPI 3: Faltas Acumuladas */}
                {/* Absences Card (Clickable) */}
                <div
                    onClick={() => {
                        setAbsenceDetails(actualAbsenceDetails);
                        setShowAbsenceModal(true);
                    }}
                    className="group bg-white border border-slate-100 p-8 rounded-[2.5rem] space-y-4 hover:shadow-2xl hover:shadow-rose-100 hover:border-rose-200 transition-all cursor-pointer relative overflow-hidden"
                >
                    <div className="absolute top-0 right-0 p-6 opacity-[0.03] group-hover:opacity-[0.08] transition-opacity">
                        <Clock className="w-24 h-24" />
                    </div>
                    <div className="flex items-center gap-3">
                        <div className="p-2.5 bg-rose-50 rounded-xl border border-rose-100 text-rose-500 group-hover:bg-rose-500 group-hover:text-white transition-all">
                            <Clock className="w-5 h-5" />
                        </div>
                        <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest group-hover:text-rose-500 transition-colors">Faltas no Período</p>
                    </div>
                    <div>
                        <h2 className="text-5xl font-black italic uppercase font-sport text-slate-900 group-hover:scale-105 transition-transform origin-left">{totalAbsences}</h2>
                        <div className="flex items-center gap-2 mt-2">
                            <span className="px-2 py-0.5 bg-rose-50 text-rose-500 rounded text-[9px] font-black uppercase tracking-wider">Ver Detalhes</span>
                        </div>
                    </div>
                </div>

                {/* KPI 4: Pool Estimado */}
                <div className="bg-white p-5 rounded-[1.5rem] border-2 border-slate-200 relative overflow-hidden group hover:border-lime-400 transition-colors shadow-sm">
                    <div className="absolute top-0 right-0 p-3 opacity-5 group-hover:opacity-10 transition-opacity">
                        <TrendingUp className="w-16 h-16 text-slate-900" />
                    </div>
                    <div className="relative z-10 space-y-2">
                        <div className="p-2 bg-slate-50 border border-slate-100 w-fit rounded-lg text-slate-900">
                            <TrendingUp className="w-4 h-4" />
                        </div>
                        <div>
                            <h3 className="text-2xl font-black font-sport italic tracking-tighter text-slate-900 truncate">R$ {estimatedPool}</h3>
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider mt-0.5">Prêmio para Distribuição</p>
                        </div>
                    </div>
                </div>

                {/* KPI 5: Saldo em Custódia */}
                <div className="bg-white p-5 rounded-[1.5rem] border-2 border-slate-200 relative overflow-hidden group hover:border-zinc-400 transition-colors shadow-sm">
                    <div className="absolute top-0 right-0 p-3 opacity-5 group-hover:opacity-10 transition-opacity">
                        < ShieldCheck className="w-16 h-16 text-slate-900" />
                    </div>
                    <div className="relative z-10 space-y-2">
                        <div className="p-2 bg-slate-50 border border-slate-100 w-fit rounded-lg text-slate-900">
                            <Activity className="w-4 h-4" />
                        </div>
                        <div>
                            <h3 className="text-2xl font-black font-sport italic tracking-tighter text-slate-900 truncate">R$ {totalBalance.toFixed(0)}</h3>
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider mt-0.5">Saldo dos Atletas</p>
                        </div>
                    </div>
                </div>

                {/* KPI 6: Total Pago em Prêmios */}
                <div className="bg-lime-400 text-black p-5 rounded-[1.5rem] relative overflow-hidden group shadow-lg">
                    <div className="absolute top-0 left-0 w-full h-full bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')] opacity-10 pointer-events-none"></div>
                    <div className="relative z-10 space-y-2">
                        <div className="p-2 bg-black/10 w-fit rounded-lg text-black">
                            <Zap className="w-4 h-4 fill-current" />
                        </div>
                        <div>
                            <h3 className="text-2xl font-black font-sport italic tracking-tighter truncate">R$ {totalDistributed.toFixed(0)}</h3>
                            <p className="text-[10px] font-black text-black/60 uppercase tracking-wider mt-0.5">Prêmios Pagos no Período</p>
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
                                                        <Clock className="w-3 h-3" /> {ci.time} • {ci.date === todayStr ? 'Hoje' : ci.date}
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
            {/* Absences Detailed Modal */}
            {showAbsenceModal && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 animate-in fade-in duration-300">
                    <div className="absolute inset-0 bg-slate-950/40 backdrop-blur-sm" onClick={() => setShowAbsenceModal(false)}></div>
                    <div className="relative bg-white w-full max-w-md rounded-[2.5rem] shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[80vh] animate-in zoom-in-95 duration-300">
                        {/* Header */}
                        <div className="p-8 border-b border-slate-100 flex items-center justify-between bg-white sticky top-0 z-10">
                            <div className="flex items-center gap-4">
                                <div className="p-3 bg-rose-50 rounded-2xl border border-rose-100 text-rose-500">
                                    <UserMinus className="w-6 h-6" />
                                </div>
                                <div>
                                    <h3 className="text-xl font-black italic uppercase font-sport text-slate-900 tracking-tighter">Detalhes das Faltas</h3>
                                    <p className="text-slate-400 font-bold uppercase text-[9px] tracking-[0.2em]">{absenceDetails.length} faltas identificadas</p>
                                </div>
                            </div>
                            <button
                                onClick={() => setShowAbsenceModal(false)}
                                className="p-2 hover:bg-slate-100 rounded-full transition-colors"
                            >
                                <X className="w-6 h-6 text-slate-400" />
                            </button>
                        </div>

                        {/* List */}
                        <div className="flex-1 overflow-y-auto p-4 space-y-2">
                            {absenceDetails.length > 0 ? (
                                [...absenceDetails].sort((a, b) => b.date.localeCompare(a.date)).map((absence, i) => (
                                    <div key={i} className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl border border-slate-100 hover:bg-slate-100 transition-colors group">
                                        <div className="flex items-center gap-4">
                                            <div className="w-10 h-10 bg-white border border-slate-200 rounded-xl flex items-center justify-center text-slate-400 font-sport italic font-black text-xs">
                                                {i + 1}
                                            </div>
                                            <div>
                                                <p className="text-xs font-black text-slate-900 uppercase tracking-tight">{absence.userName}</p>
                                                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
                                                    <Calendar className="w-3 h-3" />
                                                    {new Date(absence.date + 'T12:00:00').toLocaleDateString('pt-BR', {
                                                        weekday: 'long',
                                                        day: 'numeric',
                                                        month: 'long'
                                                    })}
                                                </p>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <div className="px-2 py-0.5 bg-rose-50 text-rose-500 rounded text-[8px] font-black uppercase tracking-wider opacity-0 group-hover:opacity-100 transition-opacity">
                                                FALTA
                                            </div>
                                            <button
                                                onClick={() => handleExcuseAbsence(absence.userId, absence.date, absence.userName)}
                                                disabled={isExcusing === `${absence.userId}-${absence.date}`}
                                                className="p-2 text-slate-400 hover:text-rose-500 hover:bg-rose-50 rounded-lg transition-all opacity-0 group-hover:opacity-100"
                                                title="Apagar Falta / Justificar"
                                            >
                                                {isExcusing === `${absence.userId}-${absence.date}` ? (
                                                    <div className="w-4 h-4 border-2 border-rose-500 border-t-transparent rounded-full animate-spin" />
                                                ) : (
                                                    <Trash2 className="w-4 h-4" />
                                                )}
                                            </button>
                                        </div>
                                    </div>
                                ))
                            ) : (
                                <div className="py-20 text-center space-y-3 opacity-30">
                                    <ShieldCheck className="w-12 h-12 mx-auto" />
                                    <p className="font-sport italic font-black uppercase text-xs tracking-widest text-slate-900">
                                        Nenhuma falta no período
                                    </p>
                                </div>
                            )}
                        </div>

                        {/* Footer */}
                        <div className="p-6 bg-slate-50 border-t border-slate-100 sticky bottom-0">
                            <button
                                onClick={() => setShowAbsenceModal(false)}
                                className="w-full py-4 bg-black text-white rounded-2xl font-black uppercase italic tracking-tighter hover:bg-slate-800 transition-all font-sport"
                            >
                                Fechar Detalhes
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Dashboard;
