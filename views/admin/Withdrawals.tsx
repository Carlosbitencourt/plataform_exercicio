import React, { useState, useEffect } from 'react';
import { Clock, CheckCircle2, XCircle, DollarSign, User, CreditCard, Calendar, Filter, Search } from 'lucide-react';
import { subscribeToWithdrawals, updateWithdrawalStatus, subscribeToUsers } from '../../services/db';
import { Withdrawal, WithdrawalStatus, User as AppUser } from '../../types';

const Withdrawals: React.FC = () => {
    const [withdrawals, setWithdrawals] = useState<Withdrawal[]>([]);
    const [users, setUsers] = useState<AppUser[]>([]);
    const [filter, setFilter] = useState<WithdrawalStatus | 'ALL'>('ALL');
    const [searchTerm, setSearchTerm] = useState('');
    const [isProcessing, setIsProcessing] = useState<string | null>(null);

    useEffect(() => {
        const unsubWithdrawals = subscribeToWithdrawals((data) => {
            setWithdrawals(data);
        });

        const unsubUsers = subscribeToUsers((data) => {
            setUsers(data);
        });

        return () => {
            unsubWithdrawals();
            unsubUsers();
        };
    }, []);

    const handleStatusUpdate = async (withdrawal: Withdrawal, status: WithdrawalStatus) => {
        const action = status === WithdrawalStatus.APPROVED ? 'aprovar' : 'rejeitar';
        if (!window.confirm(`Tem certeza que deseja ${action} este saque?`)) return;

        setIsProcessing(withdrawal.id);
        try {
            await updateWithdrawalStatus(withdrawal, status);
        } catch (error) {
            console.error("Error updating withdrawal status:", error);
            alert("Erro ao atualizar status do saque.");
        } finally {
            setIsProcessing(null);
        }
    };

    const getUserName = (userId: string) => {
        return users.find(u => u.id === userId)?.name || 'Usuário Desconhecido';
    };

    const filteredWithdrawals = withdrawals.filter(w => {
        const matchesFilter = filter === 'ALL' || w.status === filter;
        const userName = getUserName(w.userId).toLowerCase();
        const matchesSearch = userName.includes(searchTerm.toLowerCase()) || w.pixKey.toLowerCase().includes(searchTerm.toLowerCase());
        return matchesFilter && matchesSearch;
    });

    const stats = {
        pending: withdrawals.filter(w => w.status === WithdrawalStatus.PENDING).reduce((acc, w) => acc + w.amount, 0),
        pendingCount: withdrawals.filter(w => w.status === WithdrawalStatus.PENDING).length,
        totalApproved: withdrawals.filter(w => w.status === WithdrawalStatus.APPROVED).reduce((acc, w) => acc + w.amount, 0)
    };

    const getStatusBadge = (status: WithdrawalStatus) => {
        switch (status) {
            case WithdrawalStatus.PENDING:
                return (
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-50 text-amber-600 border border-amber-200 text-[10px] font-black uppercase tracking-widest">
                        <Clock className="w-3 h-3" /> Pendente
                    </span>
                );
            case WithdrawalStatus.APPROVED:
                return (
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-lime-50 text-lime-600 border border-lime-200 text-[10px] font-black uppercase tracking-widest">
                        <CheckCircle2 className="w-3 h-3" /> Aprovado
                    </span>
                );
            case WithdrawalStatus.REJECTED:
                return (
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-rose-50 text-rose-600 border border-rose-200 text-[10px] font-black uppercase tracking-widest">
                        <XCircle className="w-3 h-3" /> Rejeitado
                    </span>
                );
        }
    };

    return (
        <div className="space-y-8 animate-in fade-in duration-700">
            {/* Header & Stats */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-white p-5 rounded-[1.25rem] border-2 border-slate-300 shadow-md relative overflow-hidden group">
                    <div className="absolute top-0 right-0 p-3 opacity-10 group-hover:opacity-20 transition-opacity">
                        <Clock className="w-16 h-16 text-slate-900" />
                    </div>
                    <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-3">Pendentes ({stats.pendingCount})</p>
                    <h3 className="text-3xl font-black text-slate-900 italic font-sport tracking-tight">R$ {stats.pending.toFixed(2)}</h3>
                    <div className="mt-3 h-1.5 w-10 bg-amber-400 rounded-full border border-amber-500"></div>
                </div>

                <div className="bg-white p-5 rounded-[1.25rem] border-2 border-slate-300 shadow-md relative overflow-hidden group">
                    <div className="absolute top-0 right-0 p-3 opacity-10 group-hover:opacity-20 transition-opacity">
                        <CheckCircle2 className="w-16 h-16 text-slate-900" />
                    </div>
                    <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-3">Total Pago (Aprovado)</p>
                    <h3 className="text-3xl font-black text-slate-900 italic font-sport tracking-tight">R$ {stats.totalApproved.toFixed(2)}</h3>
                    <div className="mt-3 h-1.5 w-10 bg-lime-400 rounded-full border border-lime-500"></div>
                </div>

                <div className="bg-white p-5 rounded-[1.25rem] border-2 border-slate-300 shadow-md relative overflow-hidden group">
                    <div className="absolute top-0 right-0 p-3 opacity-10 group-hover:opacity-20 transition-opacity">
                        <DollarSign className="w-16 h-16 text-slate-900" />
                    </div>
                    <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-3">Saldo Disponível Admin</p>
                    <h3 className="text-3xl font-black text-slate-900 italic font-sport tracking-tight">R$ 0.00</h3>
                    <div className="mt-3 h-1.5 w-10 bg-black rounded-full border border-zinc-800"></div>
                </div>
            </div>

            {/* Filters */}
            <div className="bg-white p-6 rounded-[2rem] border-2 border-slate-300 shadow-xl">
                <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
                    <div className="relative w-full md:w-96">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
                        <input
                            type="text"
                            placeholder="Buscar por atleta ou PIX..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full pl-11 pr-4 py-3 bg-slate-50 border-2 border-slate-200 rounded-2xl text-sm font-bold focus:border-black transition-all outline-none"
                        />
                    </div>

                    <div className="flex items-center gap-2 p-1 bg-slate-100 rounded-2xl w-full md:w-auto">
                        <button
                            onClick={() => setFilter('ALL')}
                            className={`flex-1 md:flex-none px-6 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${filter === 'ALL' ? 'bg-black text-white shadow-lg' : 'text-slate-500 hover:bg-white'}`}
                        >
                            Todos
                        </button>
                        <button
                            onClick={() => setFilter(WithdrawalStatus.PENDING)}
                            className={`flex-1 md:flex-none px-6 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${filter === WithdrawalStatus.PENDING ? 'bg-amber-400 text-black shadow-lg' : 'text-slate-500 hover:bg-white'}`}
                        >
                            Pendentes
                        </button>
                        <button
                            onClick={() => setFilter(WithdrawalStatus.APPROVED)}
                            className={`flex-1 md:flex-none px-6 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${filter === WithdrawalStatus.APPROVED ? 'bg-lime-400 text-black shadow-lg' : 'text-slate-500 hover:bg-white'}`}
                        >
                            Pagos
                        </button>
                    </div>
                </div>
            </div>

            {/* List */}
            <div className="bg-white rounded-[2rem] border-2 border-slate-300 shadow-2xl overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full border-collapse">
                        <thead>
                            <tr className="bg-slate-50/80 border-b-2 border-slate-200">
                                <th className="px-6 py-4 text-left text-[10px] font-black text-slate-400 uppercase tracking-widest">Atleta</th>
                                <th className="px-6 py-4 text-left text-[10px] font-black text-slate-400 uppercase tracking-widest">Chave PIX</th>
                                <th className="px-6 py-4 text-left text-[10px] font-black text-slate-400 uppercase tracking-widest">Valor</th>
                                <th className="px-6 py-4 text-left text-[10px] font-black text-slate-400 uppercase tracking-widest">Status</th>
                                <th className="px-6 py-4 text-left text-[10px] font-black text-slate-400 uppercase tracking-widest">Data</th>
                                <th className="px-6 py-4 text-right text-[10px] font-black text-slate-400 uppercase tracking-widest">Ações</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y-2 divide-slate-100">
                            {filteredWithdrawals.length === 0 ? (
                                <tr>
                                    <td colSpan={6} className="px-6 py-20 text-center">
                                        <div className="flex flex-col items-center gap-3">
                                            <div className="p-4 bg-slate-50 rounded-full">
                                                <DollarSign className="w-8 h-8 text-slate-300" />
                                            </div>
                                            <p className="text-slate-400 font-bold uppercase tracking-widest text-[10px]">Nenhuma solicitação encontrada</p>
                                        </div>
                                    </td>
                                </tr>
                            ) : (
                                filteredWithdrawals.map((w) => (
                                    <tr key={w.id} className="hover:bg-slate-50/50 transition-colors">
                                        <td className="px-6 py-4">
                                            <div className="flex items-center gap-3">
                                                <div className="w-8 h-8 bg-black rounded-lg flex items-center justify-center text-white text-xs font-black italic">
                                                    {getUserName(w.userId).charAt(0).toUpperCase()}
                                                </div>
                                                <div className="text-xs font-black text-slate-900 uppercase tracking-tight">
                                                    {getUserName(w.userId)}
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="flex items-center gap-2 group">
                                                <CreditCard className="w-3.5 h-3.5 text-slate-400" />
                                                <span className="text-[10px] font-bold text-slate-600 font-mono tracking-wider bg-slate-50 px-2 py-1 rounded border border-slate-100">
                                                    {w.pixKey}
                                                </span>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <span className="text-sm font-black font-sport italic tracking-tighter text-slate-900">
                                                R$ {w.amount.toFixed(2)}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4">
                                            {getStatusBadge(w.status)}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <div className="flex items-center gap-2 text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                                                <Calendar className="w-3 h-3" />
                                                {new Date(w.createdAt).toLocaleDateString('pt-BR')}
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            {w.status === WithdrawalStatus.PENDING && (
                                                <div className="flex justify-end gap-2">
                                                    <button
                                                        onClick={() => handleStatusUpdate(w, WithdrawalStatus.REJECTED)}
                                                        disabled={isProcessing === w.id}
                                                        className="p-2 text-rose-500 hover:bg-rose-50 rounded-xl transition-all border border-transparent hover:border-rose-200"
                                                        title="Rejeitar e Estornar"
                                                    >
                                                        <XCircle className="w-5 h-5" />
                                                    </button>
                                                    <button
                                                        onClick={() => handleStatusUpdate(w, WithdrawalStatus.APPROVED)}
                                                        disabled={isProcessing === w.id}
                                                        className="p-2 text-lime-600 hover:bg-lime-50 rounded-xl transition-all border border-transparent hover:border-lime-200"
                                                        title="Marcar como Pago"
                                                    >
                                                        <CheckCircle2 className="w-5 h-5" />
                                                    </button>
                                                </div>
                                            )}
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};

export default Withdrawals;
