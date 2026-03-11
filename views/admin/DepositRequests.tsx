import React, { useState, useEffect } from 'react';
import { Clock, Check, X, User, DollarSign, Loader2, RefreshCw, AlertCircle, CheckCircle2 } from 'lucide-react';
import { subscribeToDepositRequests, approveDepositRequest, rejectDepositRequest } from '../../services/manualPix';
import { DepositRequest } from '../../types';

const DepositRequests: React.FC = () => {
    const [requests, setRequests] = useState<DepositRequest[]>([]);
    const [loading, setLoading] = useState(true);
    const [processingId, setProcessingId] = useState<string | null>(null);
    const [filter, setFilter] = useState<'pendente' | 'aprovado' | 'rejeitado' | 'all'>('pendente');

    useEffect(() => {
        const unsub = subscribeToDepositRequests((data) => {
            setRequests(data);
            setLoading(false);
        });
        return () => unsub();
    }, []);

    const handleApprove = async (req: DepositRequest) => {
        if (!window.confirm(`Aprovar depósito de R$ ${req.amount.toFixed(2)} para ${req.userName}?`)) return;
        setProcessingId(req.id);
        try {
            await approveDepositRequest(req.id);
        } catch (err: any) {
            alert('Erro ao aprovar: ' + err.message);
        } finally {
            setProcessingId(null);
        }
    };

    const handleReject = async (req: DepositRequest) => {
        const reason = window.prompt('Motivo da rejeição (opcional):') ?? undefined;
        if (reason === null) return; // user pressed cancel
        setProcessingId(req.id);
        try {
            await rejectDepositRequest(req.id, reason || undefined);
        } catch (err: any) {
            alert('Erro ao rejeitar: ' + err.message);
        } finally {
            setProcessingId(null);
        }
    };

    const filtered = filter === 'all' ? requests : requests.filter(r => r.status === filter);
    const pendingCount = requests.filter(r => r.status === 'pendente').length;

    const statusColors = {
        pendente: 'bg-amber-100 text-amber-700 border-amber-200',
        aprovado: 'bg-lime-100 text-lime-700 border-lime-200',
        rejeitado: 'bg-rose-100 text-rose-700 border-rose-200',
    };

    return (
        <div className="space-y-6 animate-in fade-in duration-300">
            {/* Header */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                    <h2 className="text-xl font-black italic uppercase font-sport text-slate-900 flex items-center gap-2">
                        <DollarSign className="w-6 h-6 text-lime-500" />
                        Depósitos Pendentes (PIX Manual)
                    </h2>
                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-1">
                        Aprove ou rejeite as solicitações de depósito via PIX Manual
                    </p>
                </div>
                {pendingCount > 0 && (
                    <div className="flex items-center gap-2 bg-amber-100 border border-amber-200 px-4 py-2 rounded-xl">
                        <AlertCircle className="w-4 h-4 text-amber-600" />
                        <span className="text-xs font-black text-amber-700">{pendingCount} aguardando aprovação</span>
                    </div>
                )}
            </div>

            {/* Filter tabs */}
            <div className="flex gap-2 flex-wrap">
                {(['pendente', 'aprovado', 'rejeitado', 'all'] as const).map(f => (
                    <button
                        key={f}
                        onClick={() => setFilter(f)}
                        className={`px-4 py-2 rounded-xl font-black uppercase text-[10px] tracking-widest transition-all border ${filter === f
                                ? 'bg-black text-lime-400 border-black'
                                : 'bg-white text-slate-500 border-slate-200 hover:border-slate-300'
                            }`}
                    >
                        {f === 'all' ? 'Todos' : f}
                        {f === 'pendente' && pendingCount > 0 && (
                            <span className="ml-1.5 bg-amber-500 text-white text-[8px] px-1.5 py-0.5 rounded-full">{pendingCount}</span>
                        )}
                    </button>
                ))}
            </div>

            {/* List */}
            {loading ? (
                <div className="flex items-center justify-center py-16 gap-3 text-slate-400">
                    <Loader2 className="w-6 h-6 animate-spin" />
                    <span className="text-xs font-bold uppercase">Carregando...</span>
                </div>
            ) : filtered.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 gap-3 text-slate-300">
                    <CheckCircle2 className="w-12 h-12" />
                    <span className="text-xs font-bold uppercase">Nenhuma solicitação</span>
                </div>
            ) : (
                <div className="space-y-3">
                    {filtered.map(req => (
                        <div key={req.id} className="bg-white border-2 border-slate-100 rounded-2xl p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 hover:border-slate-200 transition-all">
                            <div className="flex items-center gap-4">
                                <div className="w-10 h-10 bg-slate-100 rounded-xl flex items-center justify-center">
                                    <User className="w-5 h-5 text-slate-400" />
                                </div>
                                <div>
                                    <p className="font-black text-slate-900 text-sm">{req.userName}</p>
                                    <p className="text-[10px] text-slate-400 font-bold uppercase">
                                        {new Date(req.requestedAt).toLocaleString('pt-BR')} •{' '}
                                        {req.source === 'signup' ? 'Cadastro' : 'Depósito'}
                                    </p>
                                    {req.userPhone && (
                                        <p className="text-[10px] text-slate-400">{req.userPhone}</p>
                                    )}
                                </div>
                            </div>

                            <div className="flex items-center gap-4 ml-auto">
                                <div className="text-right">
                                    <p className="text-2xl font-black text-slate-900">R$ {req.amount.toFixed(2)}</p>
                                    <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-full border ${statusColors[req.status]}`}>
                                        {req.status}
                                    </span>
                                </div>

                                {req.status === 'pendente' && (
                                    <div className="flex gap-2">
                                        <button
                                            onClick={() => handleReject(req)}
                                            disabled={processingId === req.id}
                                            className="w-10 h-10 bg-rose-50 text-rose-500 border border-rose-200 rounded-xl hover:bg-rose-100 flex items-center justify-center transition-all disabled:opacity-50"
                                            title="Rejeitar"
                                        >
                                            {processingId === req.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <X className="w-4 h-4" />}
                                        </button>
                                        <button
                                            onClick={() => handleApprove(req)}
                                            disabled={processingId === req.id}
                                            className="w-10 h-10 bg-lime-400 text-black border border-lime-500 rounded-xl hover:bg-lime-300 flex items-center justify-center transition-all disabled:opacity-50"
                                            title="Aprovar"
                                        >
                                            {processingId === req.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                                        </button>
                                    </div>
                                )}

                                {req.status === 'rejeitado' && req.rejectionReason && (
                                    <p className="text-[9px] text-rose-500 font-bold max-w-[120px] text-right">{req.rejectionReason}</p>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

export default DepositRequests;
