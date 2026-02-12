import React, { useState, useEffect } from 'react';
import { QrCode, Copy, MessageCircle, Send, Calendar, RefreshCw, ShieldCheck } from 'lucide-react';
import { getTodayActiveQRCode, createDailyQRCode } from '../../services/db';
import { QRCodeData } from '../../types';

const QRCodeManager: React.FC = () => {
  const [activeQR, setActiveQR] = useState<QRCodeData | null>(null);

  useEffect(() => {
    const unsubscribe = getTodayActiveQRCode((qr) => {
      setActiveQR(qr);
    });
    return () => unsubscribe();
  }, []);

  const handleGenerate = async () => {
    try {
      await createDailyQRCode();
    } catch (error: any) {
      console.error("Error creating QR Code:", error);
      alert(`Erro ao gerar QR Code: ${error.message}`);
    }
  };

  const checkinUrl = activeQR ? `${window.location.origin}/#/checkin?token=${activeQR.token}` : '';

  const copyToClipboard = () => {
    navigator.clipboard.writeText(checkinUrl);
    alert('LINK DE ACESSO COPIADO COM SUCESSO!');
  };

  const shareWhatsApp = () => {
    const text = encodeURIComponent(`🚀 *FitReward - Portal de Check-in*\n\nAtleta, seu portal de acesso para o treino de hoje já está disponível!\n\nAcesse aqui: ${checkinUrl}`);
    window.open(`https://wa.me/?text=${text}`, '_blank');
  };

  const shareTelegram = () => {
    const text = encodeURIComponent(`FitReward - Portal de Check-in\n\nAtleta, seu portal de acesso para o treino de hoje já está disponível!`);
    window.open(`https://t.me/share/url?url=${encodeURIComponent(checkinUrl)}&text=${text}`, '_blank');
  };

  return (
    <div className="max-w-3xl mx-auto space-y-12 animate-in fade-in duration-700">
      {/* CARD PRINCIPAL - ESTILO PORTAL DE ACESSO */}
      <div className="bg-white p-10 md:p-14 rounded-[2rem] text-center space-y-10 shadow-[0_30px_70px_-15px_rgba(0,0,0,0.1)] border-2 border-slate-100 relative overflow-hidden group">

        {/* Ícone Superior com Soft Shadow */}
        <div className="relative inline-block">
          <div className="absolute inset-0 bg-slate-200/20 blur-2xl rounded-full scale-150"></div>
          <div className="relative p-6 bg-white border-2 border-slate-50 text-slate-900 rounded-[1.5rem] shadow-[0_15px_35px_rgba(0,0,0,0.05)]">
            <QrCode className="w-10 h-10 stroke-[1.5px]" />
          </div>
        </div>

        <div className="space-y-3">
          <h3 className="text-3xl md:text-4xl font-black italic uppercase font-sport text-slate-900 tracking-tighter">
            Portal de Acesso
          </h3>
          <p className="text-slate-400 flex items-center justify-center font-black uppercase text-[9px] tracking-[0.4em] gap-2">
            <Calendar className="w-2.5 h-2.5 text-lime-500" />
            Data Local: {new Date().toLocaleDateString('pt-BR')}
          </p>
        </div>

        {activeQR ? (
          <div className="space-y-10 animate-in zoom-in duration-500">
            {/* Visualização do QR (Simulada) */}
            <div className="relative inline-block bg-white p-8 rounded-[2rem] border-2 border-slate-100 shadow-xl">
              <div className="w-48 h-48 bg-white p-3 rounded-2xl flex items-center justify-center border-4 border-slate-50 shadow-inner overflow-hidden">
                <div className="grid grid-cols-8 gap-1.5 w-full h-full opacity-90">
                  {Array.from({ length: 64 }).map((_, i) => (
                    <div key={i} className={`rounded-[2px] ${Math.random() > 0.4 ? 'bg-black' : 'bg-transparent'}`}></div>
                  ))}
                </div>
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="bg-white px-4 py-2 border-[5px] border-black rounded-xl font-sport italic font-black text-black text-2xl tracking-widest shadow-2xl">
                    {activeQR.token.substring(0, 4).toUpperCase()}
                  </div>
                </div>
              </div>
            </div>

            {/* Opções de Compartilhamento */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 max-w-xl mx-auto pt-2">
              <button
                onClick={shareWhatsApp}
                className="flex items-center justify-center gap-2 px-5 py-4 bg-[#25D366] text-white rounded-2xl font-black uppercase text-[9px] tracking-widest shadow-lg hover:scale-105 active:scale-95 transition-all"
              >
                <MessageCircle className="w-4 h-4 fill-current" />
                WhatsApp
              </button>

              <button
                onClick={shareTelegram}
                className="flex items-center justify-center gap-2 px-5 py-4 bg-[#0088cc] text-white rounded-2xl font-black uppercase text-[9px] tracking-widest shadow-lg hover:scale-105 active:scale-95 transition-all"
              >
                <Send className="w-4 h-4 fill-current" />
                Telegram
              </button>

              <button
                onClick={copyToClipboard}
                className="flex items-center justify-center gap-2 px-5 py-4 bg-slate-900 text-white rounded-2xl font-black uppercase text-[9px] tracking-widest shadow-lg hover:scale-105 active:scale-95 transition-all"
              >
                <Copy className="w-4 h-4" />
                Copiar Link
              </button>
            </div>

            <div className="pt-6">
              <button
                onClick={handleGenerate}
                className="text-[10px] font-black text-slate-300 uppercase tracking-[0.4em] hover:text-rose-500 transition-colors flex items-center justify-center mx-auto gap-2"
              >
                <RefreshCw className="w-3 h-3" /> Regenerar Acesso de Hoje
              </button>
            </div>
          </div>
        ) : (
          <div className="py-12 animate-in fade-in duration-500">
            {/* BOTÃO EXATAMENTE COMO NA IMAGEM */}
            <button
              onClick={handleGenerate}
              className="px-12 py-8 bg-black text-lime-400 rounded-[2rem] font-black text-2xl uppercase italic font-sport tracking-tighter shadow-[0_25px_60px_-15px_rgba(0,0,0,0.5)] hover:scale-[1.05] active:scale-95 transition-all border-b-4 border-zinc-800"
            >
              Ativar Check-in Hoje
            </button>
          </div>
        )}
      </div>

      {/* FOOTER INFORMATIVO */}
      <div className="bg-white border-2 border-slate-100 p-8 rounded-[2rem] shadow-sm flex items-center gap-6 group">
        <div className="p-4 bg-slate-50 border-2 border-slate-100 rounded-[1.2rem] text-lime-500 shadow-inner group-hover:scale-110 transition-transform">
          <ShieldCheck className="w-7 h-7" />
        </div>
        <div className="space-y-1">
          <h4 className="font-black italic uppercase font-sport text-slate-900 tracking-widest text-lg leading-tight">Protocolo de Segurança Ativo</h4>
          <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest leading-relaxed">
            O sistema gera um <span className="text-slate-900">Token Único Diário</span>. Links antigos tornam-se inválidos às 00:00, prevenindo check-ins fora do período de competição.
          </p>
        </div>
      </div>

      <div className="text-center">
        <p className="text-[9px] font-black text-slate-300 uppercase tracking-[0.8em] italic">FitReward Management System • Secure Portal V4</p>
      </div>
    </div>
  );
};

export default QRCodeManager;
