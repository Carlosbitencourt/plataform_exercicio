import React, { useState, useEffect } from 'react';
import { Settings as SettingsIcon, Save, RefreshCw, AlertCircle, CheckCircle, DollarSign, Clock } from 'lucide-react';
import { subscribeToSettings, updateSettings } from '../../services/db';
import { SystemSettings } from '../../types';

const Settings: React.FC = () => {
    const [settings, setSettings] = useState<SystemSettings | null>(null);
    const [formData, setFormData] = useState({
        dailyLossAmount: 5,
        minDepositValue: 30,
        welcomeMessage: '',
        absenceMessage: '',
        checkInMessage: ''
    });
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);

    useEffect(() => {
        const unsubscribe = subscribeToSettings((data) => {
            if (data) {
                setSettings(data);
                setFormData({
                    dailyLossAmount: data.dailyLossAmount,
                    minDepositValue: data.minDepositValue || 30,
                    welcomeMessage: data.welcomeMessage || '',
                    absenceMessage: data.absenceMessage || '',
                    checkInMessage: data.checkInMessage || ''
                });
            }
            setLoading(false);
        });
        return () => unsubscribe();
    }, []);

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        setSaving(true);
        setMessage(null);

        try {
            await updateSettings({
                dailyLossAmount: formData.dailyLossAmount,
                minDepositValue: formData.minDepositValue,
                welcomeMessage: formData.welcomeMessage,
                absenceMessage: formData.absenceMessage,
                checkInMessage: formData.checkInMessage
            });
            setMessage({ type: 'success', text: 'Configurações salvas com sucesso!' });
            setTimeout(() => setMessage(null), 3000);
        } catch (error: any) {
            console.error("Error saving settings:", error);
            const errorMsg = error.code === 'permission-denied'
                ? 'Permissão negada (Regras do Firestore).'
                : (error.message || 'Erro desconhecido ao salvar.');
            setMessage({ type: 'error', text: `Erro: ${errorMsg}` });
        } finally {
            setSaving(false);
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center p-12">
                <RefreshCw className="w-8 h-8 text-lime-400 animate-spin" />
            </div>
        );
    }

    return (
        <div className="space-y-8 animate-in fade-in duration-500 max-w-4xl mx-auto">
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-3xl font-black italic uppercase font-sport text-slate-900 leading-tight tracking-tighter">
                        Configurações <span className="text-lime-500">do Sistema</span>
                    </h1>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em] mt-1">Gerencie os parâmetros globais da plataforma</p>
                </div>
                <div className="p-3 bg-white rounded-2xl border-2 border-slate-200 shadow-sm">
                    <SettingsIcon className="w-6 h-6 text-slate-400" />
                </div>
            </div>

            <form onSubmit={handleSave} className="space-y-6">
                {/* Penalties Section */}
                <div className="bg-white rounded-[2.5rem] border-4 border-slate-200 shadow-2xl overflow-hidden">
                    <div className="p-6 bg-slate-50 border-b-2 border-slate-100 flex items-center gap-3">
                        <div className="p-2 bg-rose-500 text-white rounded-xl shadow-lg shadow-rose-500/20">
                            <DollarSign className="w-5 h-5" />
                        </div>
                        <div>
                            <h3 className="font-black italic uppercase font-sport text-slate-900 tracking-tight">Regras Financeiras</h3>
                            <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Defina valores de penalidades e depósitos</p>
                        </div>
                    </div>

                    <div className="p-8 space-y-8">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-center">
                            <div className="space-y-2">
                                <label className="block text-[10px] font-black text-slate-500 uppercase tracking-[0.2em]">Valor da Penalidade por Falta</label>
                                <div className="relative group">
                                    <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 font-bold">R$</div>
                                    <input
                                        type="number"
                                        step="0.01"
                                        className="w-full pl-12 pr-6 py-4 bg-slate-50 border-2 border-slate-200 rounded-2xl text-xl font-black text-slate-900 focus:ring-4 focus:ring-lime-400/10 focus:border-lime-500 outline-none transition-all shadow-inner"
                                        value={formData.dailyLossAmount}
                                        onChange={(e) => setFormData({ ...formData, dailyLossAmount: parseFloat(e.target.value) || 0 })}
                                    />
                                </div>
                                <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest leading-relaxed">
                                    Este valor será descontado do saldo do atleta para cada dia de falta não justificada.
                                </p>
                            </div>

                            <div className="space-y-2">
                                <label className="block text-[10px] font-black text-slate-500 uppercase tracking-[0.2em]">Valor Mínimo para Depósito</label>
                                <div className="relative group">
                                    <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 font-bold">R$</div>
                                    <input
                                        type="number"
                                        step="0.01"
                                        className="w-full pl-12 pr-6 py-4 bg-slate-50 border-2 border-slate-200 rounded-2xl text-xl font-black text-slate-900 focus:ring-4 focus:ring-lime-400/10 focus:border-lime-500 outline-none transition-all shadow-inner"
                                        value={formData.minDepositValue}
                                        onChange={(e) => setFormData({ ...formData, minDepositValue: parseFloat(e.target.value) || 0 })}
                                    />
                                </div>
                                <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest leading-relaxed">
                                    Valor mínimo permitido para depósitos via PIX (Cadastro e Área do Atleta).
                                </p>
                            </div>

                            <div className="bg-slate-50 rounded-3xl border-2 border-dashed border-slate-200 p-6 space-y-4">
                                <div className="flex items-start gap-3">
                                    <div className="p-1.5 bg-amber-100 text-amber-600 rounded-lg shrink-0">
                                        <AlertCircle className="w-4 h-4" />
                                    </div>
                                    <p className="text-[10px] font-bold text-slate-600 uppercase tracking-tight leading-relaxed">
                                        Mudanças neste valor afetarão apenas as <span className="text-black underline underline-offset-2">próximas penalidades</span> geradas. Penalidades já aplicadas não retroagem.
                                    </p>
                                </div>
                                <div className="flex items-center gap-2 text-[9px] font-black text-slate-400 uppercase tracking-widest bg-white p-3 rounded-xl border border-slate-100">
                                    <Clock className="w-3 h-3" />
                                    Última atualização: {settings?.lastUpdated ? new Date(settings.lastUpdated).toLocaleString('pt-BR') : 'Nunca'}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Welcome Message Section */}
                <div className="bg-white rounded-[2.5rem] border-4 border-slate-200 shadow-2xl overflow-hidden mt-8">
                    <div className="p-6 bg-slate-50 border-b-2 border-slate-100 flex items-center gap-3">
                        <div className="p-2 bg-lime-500 text-white rounded-xl shadow-lg shadow-lime-500/20">
                            <Clock className="w-5 h-5" />
                        </div>
                        <div>
                            <h3 className="font-black italic uppercase font-sport text-slate-900 tracking-tight">Mensagens Automáticas</h3>
                            <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Configure os templates de WhatsApp</p>
                        </div>
                    </div>

                    <div className="p-8 space-y-10">
                        {/* Welcome */}
                        <div className="space-y-4">
                            <div className="flex items-center justify-between">
                                <label className="block text-[10px] font-black text-slate-500 uppercase tracking-[0.2em]">Boas-vindas (Cadastro)</label>
                                <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest px-2 py-1 bg-slate-100 rounded-md">Variáveis: {'{name}, {athleteId}'}</span>
                            </div>
                            <textarea
                                className="w-full px-6 py-4 bg-slate-50 border-2 border-slate-200 rounded-2xl text-base font-bold text-slate-900 focus:ring-4 focus:ring-lime-400/10 focus:border-lime-500 outline-none transition-all shadow-inner min-h-[120px]"
                                value={formData.welcomeMessage}
                                onChange={(e) => setFormData({ ...formData, welcomeMessage: e.target.value })}
                                placeholder="Olá {name}! Seja bem-vindo..."
                            />
                        </div>

                        {/* Absence */}
                        <div className="space-y-4">
                            <div className="flex items-center justify-between">
                                <label className="block text-[10px] font-black text-slate-500 uppercase tracking-[0.2em]">Notificação de Falta</label>
                                <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest px-2 py-1 bg-slate-100 rounded-md">Variáveis: {'{name}, {date}, {penaltyAmount}'}</span>
                            </div>
                            <textarea
                                className="w-full px-6 py-4 bg-slate-50 border-2 border-slate-200 rounded-2xl text-base font-bold text-slate-900 focus:ring-4 focus:ring-lime-400/10 focus:border-lime-500 outline-none transition-all shadow-inner min-h-[120px]"
                                value={formData.absenceMessage}
                                onChange={(e) => setFormData({ ...formData, absenceMessage: e.target.value })}
                                placeholder="Olá {name}! Notamos que você faltou..."
                            />
                        </div>

                        {/* Check-in */}
                        <div className="space-y-4">
                            <div className="flex items-center justify-between">
                                <label className="block text-[10px] font-black text-slate-500 uppercase tracking-[0.2em]">Confirmação de Check-in</label>
                                <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest px-2 py-1 bg-slate-100 rounded-md">Variáveis: {'{name}, {time}'}</span>
                            </div>
                            <textarea
                                className="w-full px-6 py-4 bg-slate-50 border-2 border-slate-200 rounded-2xl text-base font-bold text-slate-900 focus:ring-4 focus:ring-lime-400/10 focus:border-lime-500 outline-none transition-all shadow-inner min-h-[120px]"
                                value={formData.checkInMessage}
                                onChange={(e) => setFormData({ ...formData, checkInMessage: e.target.value })}
                                placeholder="Check-in realizado com sucesso, {name}!"
                            />
                        </div>
                    </div>
                </div>

                {/* Action Bar */}
                <div className="flex flex-col sm:flex-row items-center justify-between gap-4 p-6 bg-slate-900 rounded-[2rem] border-4 border-slate-800 shadow-2xl">
                    <div className="flex items-center gap-3">
                        {message && (
                            <div className={`flex items-center gap-2 px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest animate-in slide-in-from-left duration-300 ${message.type === 'success' ? 'bg-lime-400/10 text-lime-400' : 'bg-rose-400/10 text-rose-400'
                                }`}>
                                {message.type === 'success' ? <CheckCircle className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
                                {message.text}
                            </div>
                        )}
                    </div>

                    <button
                        type="submit"
                        disabled={saving}
                        className="w-full sm:w-auto px-10 py-4 bg-lime-400 text-black rounded-xl font-black uppercase italic tracking-tighter shadow-xl shadow-lime-400/20 hover:scale-[1.02] active:scale-95 transition-all text-xs flex items-center justify-center gap-3 disabled:opacity-50"
                    >
                        {saving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                        Salvar Configurações
                    </button>
                </div>
            </form>
        </div>
    );
};

export default Settings;
