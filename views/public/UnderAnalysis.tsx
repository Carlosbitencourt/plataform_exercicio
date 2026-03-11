import React from 'react';
import { Clock, CheckCircle2, MessageCircle, ArrowRight, ShieldCheck, Activity } from 'lucide-react';

const UnderAnalysis: React.FC = () => {
    return (
        <div className="min-h-screen bg-black text-white flex items-center justify-center p-6 font-sans relative overflow-hidden">
            {/* Background decorative elements */}
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-2xl aspect-square bg-lime-500/5 blur-[150px] rounded-full"></div>
            <div className="absolute -top-24 -left-24 w-96 h-96 bg-lime-500/10 blur-[100px] rounded-full"></div>

            <div className="w-full max-w-lg bg-zinc-900 border border-zinc-800 rounded-[3rem] p-8 md:p-12 text-center space-y-10 relative z-10 shadow-2xl">
                {/* Icon Section */}
                <div className="relative mx-auto w-32 h-32">
                    <div className="absolute inset-0 bg-lime-400 rounded-[2.5rem] rotate-6 animate-pulse opacity-20"></div>
                    <div className="relative w-full h-full bg-zinc-800 rounded-[2.5rem] flex items-center justify-center border-2 border-zinc-700 shadow-2xl overflow-hidden group">
                        <Clock className="w-14 h-14 text-lime-400 animate-bounce-slow" />
                        <div className="absolute inset-0 bg-lime-400/5 opacity-0 group-hover:opacity-100 transition-opacity"></div>
                    </div>
                    {/* Floating status badge */}
                    <div className="absolute -bottom-2 -right-2 bg-lime-400 text-black px-4 py-1 rounded-full text-[10px] font-black uppercase tracking-widest border-4 border-zinc-900 shadow-xl">
                        Em Análise
                    </div>
                </div>

                {/* Content Section */}
                <div className="space-y-4">
                    <div className="space-y-1">
                        <h2 className="text-3xl font-black italic uppercase font-sport tracking-tighter text-white">Recebemos seu Cadastro!</h2>
                        <p className="text-lime-400 text-[10px] font-black uppercase tracking-[0.4em]">Impulso Club • Atleta em Verificação</p>
                    </div>

                    <div className="h-1 w-20 bg-lime-400 mx-auto rounded-full"></div>

                    <p className="text-zinc-400 text-sm font-bold leading-relaxed max-w-sm mx-auto">
                        Seu investimento inicial foi processado com sucesso. Nossa equipe está validando agora o seu perfil e sua foto para liberação do seu acesso.
                    </p>
                </div>

                {/* Feature List */}
                <div className="grid grid-cols-1 gap-3 py-2">
                    <div className="flex items-center gap-4 bg-black/40 border border-zinc-800 p-4 rounded-2xl hover:border-lime-400/30 transition-all group">
                        <div className="w-10 h-10 bg-zinc-900 rounded-xl flex items-center justify-center text-lime-400 group-hover:bg-lime-400 group-hover:text-black transition-all">
                            <ShieldCheck className="w-5 h-5" />
                        </div>
                        <div className="text-left">
                            <p className="text-[10px] font-black uppercase tracking-widest text-white">Segurança Total</p>
                            <p className="text-[9px] font-bold text-zinc-500 uppercase">Seus dados e foto estão protegidos</p>
                        </div>
                    </div>

                    <div className="flex items-center gap-4 bg-black/40 border border-zinc-800 p-4 rounded-2xl hover:border-lime-400/30 transition-all group">
                        <div className="w-10 h-10 bg-zinc-900 rounded-xl flex items-center justify-center text-lime-400 group-hover:bg-lime-400 group-hover:text-black transition-all">
                            <MessageCircle className="w-5 h-5" />
                        </div>
                        <div className="text-left">
                            <p className="text-[10px] font-black uppercase tracking-widest text-white">Aviso via WhatsApp</p>
                            <p className="text-[9px] font-bold text-zinc-500 uppercase">Você receberá uma notificação em instantes</p>
                        </div>
                    </div>
                </div>

                {/* Footer/Action Section */}
                <div className="space-y-6 pt-4">
                    <div className="flex items-center justify-center gap-3">
                        <span className="w-2 h-2 bg-lime-400 rounded-full animate-pulse"></span>
                        <p className="text-[9px] font-black text-zinc-500 uppercase tracking-widest">Tempo estimado: 15 - 60 minutos</p>
                    </div>

                    <button
                        onClick={() => window.location.href = '#/checkin'}
                        className="w-full py-5 bg-zinc-800 text-white rounded-2xl font-black uppercase tracking-widest text-xs hover:bg-zinc-700 active:scale-95 transition-all flex items-center justify-center gap-3 border-b-4 border-zinc-950"
                    >
                        Página Inicial <ArrowRight className="w-4 h-4" />
                    </button>
                </div>
            </div>

            {/* Footer Branding */}
            <div className="absolute bottom-10 flex flex-col items-center gap-2">
                <div className="flex items-center gap-2 text-[10px] font-black text-zinc-700 uppercase tracking-[0.5em]">
                    <Activity className="w-4 h-4 text-lime-500" />
                    Impulso Club
                </div>
            </div>
        </div>
    );
};

export default UnderAnalysis;
