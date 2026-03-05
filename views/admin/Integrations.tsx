import React, { useState, useEffect } from 'react';
import { Puzzle, MessageCircle, CreditCard, ChevronRight, Save, ShieldCheck, Zap, Info, Bell, CheckCircle2, Activity, Globe, Send, Loader2 } from 'lucide-react';
import { db } from '../../services/firebase';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { sendWhatsAppMessage } from '../../services/whatsapp';

const Integrations: React.FC = () => {
    const [saving, setSaving] = useState(false);
    const [success, setSuccess] = useState(false);

    // Estados locais para simular a configuração (em produção isso viria do Firestore)
    const [abacateConfig, setAbacateConfig] = useState({
        apiKey: '••••••••••••••••••••••••••••••••',
        apiSecret: '••••••••••••••••••••••••••••••••',
        environment: 'production',
        webhookUrl: 'https://seusite.com/api/webhooks/abacate'
    });

    const [whatsappConfig, setWhatsappConfig] = useState({
        provider: 'Conativa Desk',
        apiUrl: 'https://appback.conativadesk.com.br/api/messages/whatsmeow/sendTextPRO',
        apiKey: 'cFpUHoKRhfWU8ZcsdVVqwOXTa76F9jSfixCbBLtqRSjG6rKTd0bIfk5',
        phoneNumber: '5571993231592',
        queueId: '45',
        notifyAbsence: true,
        notifyCheckIn: true
    });

    const [asaasConfig, setAsaasConfig] = useState({
        apiKey: '••••••••••••••••••••••••••••••••',
        environment: 'sandbox',
        webhookToken: '••••••••••••••••'
    });

    // Estados para o teste de WhatsApp
    const [testPhone, setTestPhone] = useState('');
    const [testMessage, setTestMessage] = useState('🚀 Teste de conectividade do Impulso Club! Se você recebeu esta mensagem, sua integração com WhatsApp está funcionando corretamente.');
    const [testing, setTesting] = useState(false);
    const [testResult, setTestResult] = useState<{ success: boolean, message: string } | null>(null);

    // Carregar configurações do Firestore ao montar
    React.useEffect(() => {
        const loadSettings = async () => {
            try {
                const docSnap = await getDoc(doc(db, 'settings', 'integrations'));
                if (docSnap.exists()) {
                    const data = docSnap.data();
                    if (data.whatsapp) setWhatsappConfig(prev => ({ ...prev, ...data.whatsapp }));
                    if (data.abacate) setAbacateConfig(prev => ({ ...prev, ...data.abacate }));
                    if (data.asaas) setAsaasConfig(prev => ({ ...prev, ...data.asaas }));
                }
            } catch (error) {
                console.error("Erro ao carregar configurações:", error);
            }
        };
        loadSettings();
    }, []);

    const handleSave = async () => {
        setSaving(true);
        try {
            await setDoc(doc(db, 'settings', 'integrations'), {
                whatsapp: whatsappConfig,
                abacate: abacateConfig,
                asaas: asaasConfig,
                updatedAt: new Date().toISOString()
            });
            setSuccess(true);
            setTimeout(() => setSuccess(false), 3000);
        } catch (error) {
            console.error("Erro ao salvar configurações:", error);
            alert("Erro ao salvar as configurações. Verifique o console.");
        } finally {
            setSaving(false);
        }
    };

    const handleTestWhatsApp = async () => {
        if (!testPhone) {
            alert("Por favor, insira um número para o teste.");
            return;
        }
        setTesting(true);
        setTestResult(null);
        try {
            // Trim inputs to avoid common "Failed to fetch" caused by trailing spaces
            const cleanPhone = testPhone.trim();
            const cleanMessage = testMessage.trim();

            const result = await sendWhatsAppMessage(cleanPhone, cleanMessage, {
                apiUrl: whatsappConfig.apiUrl,
                apiKey: whatsappConfig.apiKey,
                queueId: whatsappConfig.queueId
            });
            if (result.success) {
                setTestResult({ success: true, message: "Mensagem enviada com sucesso!" });
            } else {
                // Se result.error existir, pode ser um erro da API (401, 404, etc)
                // Se não, pode ser um erro de rede/CORS que retornamos no catch do service
                const errorMsg = result.error?.message || result.error || result.status || 'Erro desconhecido';
                setTestResult({ success: false, message: `Erro ao enviar: ${errorMsg}` });
            }
        } catch (error: any) {
            console.error("Erro no componente de teste:", error);
            setTestResult({ success: false, message: `Erro de Conexão: ${error.message}` });
        } finally {
            setTesting(false);
        }
    };

    // Determinar cor do status com base no resultado do teste
    const getWppStatusColor = () => {
        if (!testResult) return 'bg-lime-400 animate-pulse'; // Padrão/Aguardando
        return testResult.success ? 'bg-lime-400 shadow-[0_0_10px_rgba(163,230,53,0.5)]' : 'bg-rose-500 shadow-[0_0_10px_rgba(244,63,94,0.5)]';
    };

    return (
        <div className="space-y-8 animate-in fade-in duration-500 max-w-5xl mx-auto pb-12">
            {/* Header Estilizado */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h1 className="text-2xl font-black italic uppercase font-sport text-slate-900 tracking-widest flex items-center gap-3">
                        <Puzzle className="w-8 h-8 text-lime-500" />
                        Ecossistema de Integrações
                    </h1>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Conecte sua plataforma com provedores externos de pagamento e comunicação</p>
                </div>

                <button
                    onClick={handleSave}
                    disabled={saving}
                    className={`flex items-center gap-2 px-6 py-3 rounded-xl font-black uppercase italic tracking-tighter transition-all shadow-xl active:scale-95 text-xs ${success
                        ? 'bg-lime-400 text-black'
                        : 'bg-black text-lime-400 hover:bg-zinc-900'
                        }`}
                >
                    {saving ? (
                        <Zap className="w-4 h-4 animate-spin" />
                    ) : success ? (
                        <CheckCircle2 className="w-4 h-4" />
                    ) : (
                        <Save className="w-4 h-4" />
                    )}
                    {saving ? 'PROCESSANDO...' : success ? 'SALVO COM SUCESSO!' : 'SALVAR CONFIGURAÇÕES'}
                </button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">

                {/* Card Abacate Pay */}
                <div className="bg-white rounded-[2rem] border-4 border-slate-200 shadow-2xl overflow-hidden group">
                    <div className="p-6 bg-slate-50 border-b-4 border-slate-100 flex items-center gap-4">
                        <div className="w-12 h-12 bg-black rounded-2xl flex items-center justify-center border-2 border-zinc-800 shadow-lg group-hover:rotate-6 transition-transform">
                            <CreditCard className="w-6 h-6 text-lime-400" />
                        </div>
                        <div>
                            <h3 className="text-lg font-black italic uppercase font-sport text-slate-900 tracking-wider">Abacate Pay</h3>
                            <p className="text-[8px] font-black text-lime-600 uppercase tracking-widest bg-lime-100 px-2 py-0.5 rounded-full inline-block">Processamento de Pagamentos</p>
                        </div>
                    </div>

                    <div className="p-8 space-y-6">
                        <div className="space-y-4">
                            <div>
                                <label className="block text-[9px] font-black text-slate-500 uppercase tracking-widest mb-1.5 ml-1">Ambiente</label>
                                <select
                                    className="w-full px-4 py-3 bg-slate-50 border-2 border-slate-200 rounded-xl text-slate-900 font-bold focus:ring-2 focus:ring-lime-400 transition-all outline-none text-xs appearance-none cursor-pointer"
                                    value={abacateConfig.environment}
                                    onChange={e => setAbacateConfig({ ...abacateConfig, environment: e.target.value })}
                                >
                                    <option value="sandbox">SANDBOX (TESTES)</option>
                                    <option value="production">PRODUCTION (REAL)</option>
                                </select>
                            </div>

                            <div>
                                <label className="block text-[9px] font-black text-slate-500 uppercase tracking-widest mb-1.5 ml-1">API Key</label>
                                <div className="relative">
                                    <input
                                        type="password"
                                        className="w-full px-4 py-3 bg-slate-50 border-2 border-slate-200 rounded-xl text-slate-900 font-bold focus:ring-2 focus:ring-lime-400 transition-all outline-none text-xs font-mono"
                                        value={abacateConfig.apiKey}
                                        onChange={e => setAbacateConfig({ ...abacateConfig, apiKey: e.target.value })}
                                    />
                                    <ShieldCheck className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-300" />
                                </div>
                            </div>

                            <div>
                                <label className="block text-[9px] font-black text-slate-500 uppercase tracking-widest mb-1.5 ml-1">API Secret</label>
                                <input
                                    type="password"
                                    className="w-full px-4 py-3 bg-slate-50 border-2 border-slate-200 rounded-xl text-slate-900 font-bold focus:ring-2 focus:ring-lime-400 transition-all outline-none text-xs font-mono"
                                    value={abacateConfig.apiSecret}
                                    onChange={e => setAbacateConfig({ ...abacateConfig, apiSecret: e.target.value })}
                                />
                            </div>

                            <div className="bg-amber-50 rounded-2xl p-4 border border-amber-100 flex items-start gap-3">
                                <Info className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
                                <p className="text-[9px] text-amber-700 font-bold leading-relaxed uppercase tracking-tight">
                                    Sincronização automática de depósitos via Pix e cartão de crédito habilitada.
                                </p>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Card WhatsApp */}
                <div className="bg-white rounded-[2rem] border-4 border-slate-200 shadow-2xl overflow-hidden group">
                    <div className="p-6 bg-slate-50 border-b-4 border-slate-100 flex items-center gap-4">
                        <div className="w-12 h-12 bg-lime-400 rounded-2xl flex items-center justify-center border-2 border-lime-500 shadow-lg group-hover:-rotate-6 transition-transform">
                            <MessageCircle className="w-6 h-6 text-black" />
                        </div>
                        <div>
                            <h3 className="text-lg font-black italic uppercase font-sport text-slate-900 tracking-wider">WhatsApp Portal</h3>
                            <p className="text-[8px] font-black text-black uppercase tracking-widest bg-lime-400 px-2 py-0.5 rounded-full inline-block">Comunicação e Alertas</p>
                        </div>
                    </div>

                    <div className="p-8 space-y-6">
                        <div className="space-y-4">
                            <div>
                                <label className="block text-[9px] font-black text-slate-500 uppercase tracking-widest mb-1.5 ml-1">Provedor de API</label>
                                <input
                                    type="text"
                                    className="w-full px-4 py-3 bg-slate-50 border-2 border-slate-200 rounded-xl text-slate-900 font-bold focus:ring-2 focus:ring-lime-400 transition-all outline-none text-xs"
                                    value={whatsappConfig.provider}
                                    onChange={e => setWhatsappConfig({ ...whatsappConfig, provider: e.target.value })}
                                />
                            </div>

                            <div className="grid grid-cols-1 gap-4">
                                <div>
                                    <label className="block text-[9px] font-black text-slate-500 uppercase tracking-widest mb-1.5 ml-1">URL de Backend</label>
                                    <div className="relative">
                                        <input
                                            type="text"
                                            className="w-full px-4 py-3 bg-slate-50 border-2 border-slate-200 rounded-xl text-slate-900 font-bold focus:ring-2 focus:ring-lime-400 transition-all outline-none text-xs"
                                            value={whatsappConfig.apiUrl}
                                            onChange={e => setWhatsappConfig({ ...whatsappConfig, apiUrl: e.target.value })}
                                        />
                                        <Globe className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-300" />
                                    </div>
                                </div>
                                <div className="grid grid-cols-2 gap-3">
                                    <div className="col-span-2 sm:col-span-1">
                                        <label className="block text-[9px] font-black text-slate-500 uppercase tracking-widest mb-1.5 ml-1">Número de Transmissão</label>
                                        <input
                                            type="text"
                                            placeholder="Ex: 55719..."
                                            className="w-full px-4 py-3 bg-slate-50 border-2 border-slate-200 rounded-xl text-slate-900 font-bold focus:ring-2 focus:ring-lime-400 transition-all outline-none text-xs"
                                            value={whatsappConfig.phoneNumber}
                                            onChange={e => setWhatsappConfig({ ...whatsappConfig, phoneNumber: e.target.value })}
                                        />
                                    </div>
                                    <div className="col-span-2 sm:col-span-1">
                                        <label className="block text-[9px] font-black text-slate-500 uppercase tracking-widest mb-1.5 ml-1">Instância API Key</label>
                                        <input
                                            type="password"
                                            className="w-full px-4 py-3 bg-slate-50 border-2 border-slate-200 rounded-xl text-slate-900 font-bold focus:ring-2 focus:ring-lime-400 transition-all outline-none text-xs font-mono"
                                            value={whatsappConfig.apiKey}
                                            onChange={e => setWhatsappConfig({ ...whatsappConfig, apiKey: e.target.value })}
                                        />
                                    </div>
                                    <div className="col-span-2 sm:col-span-1">
                                        <label className="block text-[9px] font-black text-slate-500 uppercase tracking-widest mb-1.5 ml-1">ID da Fila (Queue ID)</label>
                                        <input
                                            type="text"
                                            className="w-full px-4 py-3 bg-slate-50 border-2 border-slate-200 rounded-xl text-slate-900 font-bold focus:ring-2 focus:ring-lime-400 transition-all outline-none text-xs"
                                            value={whatsappConfig.queueId}
                                            onChange={e => setWhatsappConfig({ ...whatsappConfig, queueId: e.target.value })}
                                        />
                                    </div>
                                </div>
                            </div>

                            {/* Seção de Teste */}
                            <div className="pt-4 mt-4 border-t-2 border-slate-100">
                                <label className="block text-[9px] font-black text-slate-500 uppercase tracking-widest mb-3 ml-1">Teste de Conectividade</label>
                                <div className="flex flex-col gap-3">
                                    <div className="space-y-3">
                                        <div>
                                            <label className="block text-[8px] font-bold text-slate-400 uppercase mb-1 ml-1">Destinatário (Enviar para)</label>
                                            <div className="flex gap-2">
                                                <input
                                                    type="text"
                                                    placeholder="ex: 55719..."
                                                    className="flex-1 px-4 py-3 bg-slate-50 border-2 border-slate-200 rounded-xl text-slate-900 font-bold focus:ring-2 focus:ring-lime-400 transition-all outline-none text-xs"
                                                    value={testPhone}
                                                    onChange={e => setTestPhone(e.target.value)}
                                                />
                                            </div>
                                        </div>
                                        <div>
                                            <label className="block text-[8px] font-bold text-slate-400 uppercase mb-1 ml-1">Mensagem de Teste</label>
                                            <div className="flex gap-2">
                                                <textarea
                                                    rows={2}
                                                    className="flex-1 px-4 py-3 bg-slate-50 border-2 border-slate-200 rounded-xl text-slate-900 font-bold focus:ring-2 focus:ring-lime-400 transition-all outline-none text-xs resize-none"
                                                    value={testMessage}
                                                    onChange={e => setTestMessage(e.target.value)}
                                                    placeholder="Digite a mensagem de teste..."
                                                />
                                                <button
                                                    onClick={handleTestWhatsApp}
                                                    disabled={testing}
                                                    className="flex items-center justify-center p-4 bg-black text-lime-400 rounded-xl font-black uppercase italic tracking-tighter hover:bg-zinc-900 transition-all active:scale-95 disabled:opacity-50 h-auto self-end"
                                                    title="Enviar Mensagem de Teste"
                                                >
                                                    {testing ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                    {testResult && (
                                        <div className={`p-3 rounded-xl border flex items-center gap-3 animate-in slide-in-from-top-2 ${testResult.success ? 'bg-lime-50 border-lime-200 text-lime-700' : 'bg-rose-50 border-rose-200 text-rose-700'
                                            }`}>
                                            {testResult.success ? <CheckCircle2 className="w-4 h-4" /> : <Info className="w-4 h-4" />}
                                            <p className="text-[9px] font-bold uppercase tracking-tight">{testResult.message}</p>
                                        </div>
                                    )}
                                </div>
                            </div>

                            <div className="space-y-3 pt-2">
                                <div className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl border border-slate-100 group/item">
                                    <div className="flex items-center gap-3">
                                        <Bell className="w-4 h-4 text-slate-400 group-hover/item:text-lime-500 transition-colors" />
                                        <span className="text-[10px] font-black text-slate-700 uppercase tracking-widest">Notificar Ausências</span>
                                    </div>
                                    <label className="relative inline-flex items-center cursor-pointer">
                                        <input
                                            type="checkbox"
                                            className="sr-only peer"
                                            checked={whatsappConfig.notifyAbsence}
                                            onChange={e => setWhatsappConfig({ ...whatsappConfig, notifyAbsence: e.target.checked })}
                                        />
                                        <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-lime-500 shadow-inner"></div>
                                    </label>
                                </div>

                                <div className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl border border-slate-100 group/item">
                                    <div className="flex items-center gap-3">
                                        <CheckCircle2 className="w-4 h-4 text-slate-400 group-hover/item:text-lime-500 transition-colors" />
                                        <span className="text-[10px] font-black text-slate-700 uppercase tracking-widest">Confirmação de Check-in</span>
                                    </div>
                                    <label className="relative inline-flex items-center cursor-pointer">
                                        <input
                                            type="checkbox"
                                            className="sr-only peer"
                                            checked={whatsappConfig.notifyCheckIn}
                                            onChange={e => setWhatsappConfig({ ...whatsappConfig, notifyCheckIn: e.target.checked })}
                                        />
                                        <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-lime-500 shadow-inner"></div>
                                    </label>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Card Asaas */}
                <div className="bg-white rounded-[2rem] border-4 border-slate-200 shadow-2xl overflow-hidden group">
                    <div className="p-6 bg-slate-50 border-b-4 border-slate-100 flex items-center gap-4">
                        <div className="w-12 h-12 bg-blue-600 rounded-2xl flex items-center justify-center border-2 border-blue-700 shadow-lg group-hover:rotate-6 transition-transform">
                            <ShieldCheck className="w-6 h-6 text-white" />
                        </div>
                        <div>
                            <h3 className="text-lg font-black italic uppercase font-sport text-slate-900 tracking-wider">Asaas Gateway</h3>
                            <p className="text-[8px] font-black text-blue-600 uppercase tracking-widest bg-blue-50 px-2 py-0.5 rounded-full inline-block">ERP & Cobranças</p>
                        </div>
                    </div>

                    <div className="p-8 space-y-6">
                        <div className="space-y-4">
                            <div>
                                <label className="block text-[9px] font-black text-slate-500 uppercase tracking-widest mb-1.5 ml-1">Ambiente de Operação</label>
                                <select
                                    className="w-full px-4 py-3 bg-slate-50 border-2 border-slate-200 rounded-xl text-slate-900 font-bold focus:ring-2 focus:ring-blue-400 transition-all outline-none text-xs appearance-none cursor-pointer"
                                    value={asaasConfig.environment}
                                    onChange={e => setAsaasConfig({ ...asaasConfig, environment: e.target.value })}
                                >
                                    <option value="sandbox">HOMOLOGAÇÃO (SANDBOX)</option>
                                    <option value="production">PRODUÇÃO (LIVE)</option>
                                </select>
                            </div>

                            <div>
                                <label className="block text-[9px] font-black text-slate-500 uppercase tracking-widest mb-1.5 ml-1">API Access Token</label>
                                <div className="relative">
                                    <input
                                        type="password"
                                        className="w-full px-4 py-3 bg-slate-50 border-2 border-slate-200 rounded-xl text-slate-900 font-bold focus:ring-2 focus:ring-blue-400 transition-all outline-none text-xs font-mono"
                                        value={asaasConfig.apiKey}
                                        onChange={e => setAsaasConfig({ ...asaasConfig, apiKey: e.target.value })}
                                    />
                                    <Zap className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-300" />
                                </div>
                            </div>

                            <div>
                                <label className="block text-[9px] font-black text-slate-500 uppercase tracking-widest mb-1.5 ml-1">Token do Webhook</label>
                                <input
                                    type="password"
                                    className="w-full px-4 py-3 bg-slate-50 border-2 border-slate-200 rounded-xl text-slate-900 font-bold focus:ring-2 focus:ring-blue-400 transition-all outline-none text-xs font-mono"
                                    value={asaasConfig.webhookToken}
                                    onChange={e => setAsaasConfig({ ...asaasConfig, webhookToken: e.target.value })}
                                />
                            </div>

                            <div className="p-4 bg-blue-50 rounded-2xl border border-blue-100 flex items-start gap-3">
                                <Info className="w-5 h-5 text-blue-500 shrink-0 mt-0.5" />
                                <p className="text-[9px] text-blue-700 font-bold leading-relaxed uppercase tracking-tight">
                                    Utilize o Asaas para emissão de boletos registrados e automação de cobranças recorrentes.
                                </p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Seção Informativa de Status de Conectividade */}
            <div className="bg-black text-white p-6 md:p-10 rounded-[2.5rem] border-4 border-zinc-900 shadow-2xl relative overflow-hidden">
                <div className="absolute top-0 right-0 p-8 transform rotate-12 opacity-10">
                    <Zap className="w-32 h-32 text-lime-400" />
                </div>

                <div className="relative z-10 flex flex-col md:flex-row items-center justify-between gap-6">
                    <div className="text-center md:text-left">
                        <h4 className="text-xl font-black italic uppercase font-sport tracking-widest mb-2 flex items-center justify-center md:justify-start gap-3">
                            <Activity className="w-6 h-6 text-lime-400" />
                            Status dos Serviços
                        </h4>
                        <div className="flex flex-wrap justify-center md:justify-start gap-4 mt-4">
                            <div className="flex items-center gap-2 bg-zinc-900 px-4 py-2 rounded-xl border border-zinc-800">
                                <div className="w-2 h-2 bg-lime-400 rounded-full animate-pulse shadow-[0_0_10px_rgba(163,230,53,0.5)]"></div>
                                <span className="text-[9px] font-black tracking-widest uppercase">Pagamentos Online</span>
                            </div>
                            <div className="flex items-center gap-2 bg-zinc-900 px-4 py-2 rounded-xl border border-zinc-800">
                                <div className={`w-2 h-2 ${getWppStatusColor()} rounded-full`}></div>
                                <span className="text-[9px] font-black tracking-widest uppercase">Mensageria Wpp</span>
                            </div>
                            <div className="flex items-center gap-2 bg-zinc-900 px-4 py-2 rounded-xl border border-zinc-800">
                                <div className="w-2 h-2 bg-lime-400 rounded-full shadow-[0_0_10px_rgba(163,230,53,0.5)]"></div>
                                <span className="text-[9px] font-black tracking-widest uppercase">Sincronização Cloud</span>
                            </div>
                        </div>
                    </div>

                    <div className="flex flex-col items-center gap-3">
                        <p className="text-[8px] font-black text-zinc-500 uppercase tracking-[0.3em] text-center italic">Documentação Técnica</p>
                        <button className="px-6 py-2 bg-zinc-800 text-white rounded-lg border border-zinc-700 text-[10px] font-black uppercase tracking-widest hover:bg-zinc-700 transition-all">
                            Abrir Wiki
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Integrations;
