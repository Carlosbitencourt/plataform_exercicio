
import React, { useState, useEffect } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { User, UserStatus } from '../../types';
import { getDB, addCheckIn, getLocalDate, updateUser } from '../../services/storage';
import { calculateCheckInScore } from '../../services/rewardSystem';
import { GYM_LOCATION } from '../../constants';
import { Search, Clock, ShieldCheck, AlertCircle, CheckCircle, Lock, ArrowLeft, Activity, MapPin, ChevronRight, Settings } from 'lucide-react';

const CheckInPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const tokenFromUrl = searchParams.get('token');
  const [step, setStep] = useState(1);
  const [identifier, setIdentifier] = useState('');
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [currentTime, setCurrentTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const dayOfWeek = currentTime.getDay();
  const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;

  const getNowStr = () => {
    const hh = currentTime.getHours().toString().padStart(2, '0');
    const mm = currentTime.getMinutes().toString().padStart(2, '0');
    return `${hh}:${mm}`;
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    
    setLoading(true);
    setError(null);

    const db = getDB();
    const cleanId = identifier.trim();
    const foundUser = db.users.find(u => u.cpf === cleanId || u.uniqueCode.toUpperCase() === cleanId.toUpperCase());

    setTimeout(() => {
      if (foundUser) {
        if (foundUser.status === UserStatus.ELIMINATED) {
          setError('CONTA BLOQUEADA. PROCURE O ADMINISTRADOR.');
        } else {
          setUser(foundUser);
          setStep(2);
        }
      } else {
        setError('ATLETA NÃO IDENTIFICADO.');
      }
      setLoading(false);
    }, 600);
  };

  const validateCheckIn = async () => {
    setLoading(true);
    setError(null);

    if (isWeekend) {
        setError('O PORTAL ABRE APENAS DE SEGUNDA A SEXTA.');
        setLoading(false);
        return;
    }

    const db = getDB();
    const today = getLocalDate();
    const nowStr = getNowStr();
    
    const activeSlot = db.timeSlots.find(slot => nowStr >= slot.startTime && nowStr <= slot.endTime);
    if (!activeSlot) {
      setError(`JANELA FECHADA AGORA (${nowStr}).`);
      setLoading(false);
      return;
    }

    const activeQR = db.qrCodes.find(q => q.date === today && q.active);
    const isLocalBypass = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';

    if (!activeQR && !isLocalBypass) {
       setError('SISTEMA INDISPONÍVEL: QR CODE NÃO FOI ATIVADO HOJE.');
       setLoading(false);
       return;
    }

    if (tokenFromUrl && activeQR && activeQR.token !== tokenFromUrl && !isLocalBypass) {
       setError('QR CODE INVÁLIDO OU EXPIRADO PARA ESTE ACESSO.');
       setLoading(false);
       return;
    }

    const alreadyDidToday = db.checkIns.some(c => c.userId === user?.id && c.date === today);
    if (alreadyDidToday) {
      setError('CHECK-IN JÁ REALIZADO HOJE.');
      setLoading(false);
      return;
    }

    try {
      const position = await new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 0
        });
      });

      const { latitude, longitude } = position.coords;
      
      const R = 6371e3;
      const φ1 = latitude * Math.PI/180;
      const φ2 = GYM_LOCATION.lat * Math.PI/180;
      const Δφ = (GYM_LOCATION.lat - latitude) * Math.PI/180;
      const Δλ = (GYM_LOCATION.lng - longitude) * Math.PI/180;

      const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
                Math.cos(φ1) * Math.cos(φ2) *
                Math.sin(Δλ/2) * Math.sin(Δλ/2);
      const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
      const distance = R * c;

      if (distance > GYM_LOCATION.radius && !isLocalBypass) {
        setError('VOCÊ ESTÁ FORA DO RAIO DA ACADEMIA.');
        setLoading(false);
        return;
      }

      const score = calculateCheckInScore(activeSlot.id, user!.depositedValue);
      
      addCheckIn({
        userId: user!.id,
        date: today,
        time: nowStr,
        latitude,
        longitude,
        timeSlotId: activeSlot.id,
        score
      });

      const updatedUser = { ...user!, balance: user!.balance + score };
      updateUser(updatedUser);
      setSuccess(true);
    } catch (err) {
      setError('GPS OBRIGATÓRIO. ATIVE A LOCALIZAÇÃO E TENTE NOVAMENTE.');
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center p-6 font-sans">
        <div className="bg-zinc-900 border border-zinc-800 p-12 rounded-[3rem] text-center space-y-8 max-w-md w-full shadow-[0_0_100px_rgba(163,230,53,0.1)]">
          <div className="inline-flex p-6 bg-lime-400 rounded-full shadow-[0_0_40px_rgba(163,230,53,0.3)] animate-bounce">
            <CheckCircle className="w-12 h-12 text-black" />
          </div>
          <div className="space-y-2">
            <h2 className="text-4xl font-black italic font-sport text-white uppercase tracking-tighter">Missão Cumprida!</h2>
            <p className="text-zinc-500 font-black uppercase text-[10px] tracking-[0.4em]">Check-in Validado com Sucesso</p>
          </div>
          <div className="bg-black p-6 rounded-2xl border border-zinc-800 space-y-1">
            <p className="text-zinc-500 text-[10px] font-black uppercase tracking-widest">Atleta: {user?.name}</p>
            <p className="text-lime-400 text-2xl font-black font-sport italic tracking-tighter">RECOMPENSA CREDITADA</p>
          </div>
          <button onClick={() => window.location.reload()} className="w-full py-5 bg-white text-black rounded-2xl font-black uppercase italic tracking-tighter hover:bg-lime-400 transition-all">
            Novo Registro
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-white p-6 flex flex-col items-center justify-center relative overflow-hidden font-sans">
      <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-lime-500/50 to-transparent"></div>
      
      <div className="w-full max-w-md space-y-10 relative z-10">
        <div className="text-center space-y-4">
          <div className="inline-flex p-4 bg-lime-400 rounded-2xl shadow-lg mb-2">
            <Activity className="w-8 h-8 text-black" />
          </div>
          <h1 className="text-5xl font-black italic font-sport uppercase tracking-tighter leading-none">
            Fit<span className="text-lime-400">Reward</span>
          </h1>
          <div className="flex items-center justify-center gap-4 text-zinc-500 font-black uppercase text-[10px] tracking-[0.4em]">
            <Clock className="w-3 h-3 text-lime-500" />
            {currentTime.toLocaleTimeString('pt-BR')}
          </div>
        </div>

        {error && (
          <div className="bg-rose-500/10 border border-rose-500/20 p-5 rounded-2xl flex items-start gap-4 animate-in slide-in-from-top-2">
            <AlertCircle className="w-5 h-5 text-rose-500 shrink-0 mt-1" />
            <div className="space-y-1">
              <p className="text-rose-500 font-black text-[10px] uppercase tracking-widest text-left">Aviso de Bloqueio</p>
              <p className="text-white text-xs font-bold uppercase tracking-tight leading-snug text-left">{error}</p>
            </div>
          </div>
        )}

        {step === 1 ? (
          <form onSubmit={handleSearch} className="space-y-8">
            <div className="space-y-4">
              <label className="block text-[9px] font-black text-zinc-500 uppercase tracking-[0.3em] ml-1">Identificação do Atleta</label>
              <div className="relative group">
                <Search className="absolute left-5 top-1/2 -translate-y-1/2 text-zinc-600 group-focus-within:text-lime-400 transition-colors w-5 h-5" />
                <input
                  required
                  type="text"
                  placeholder="CPF OU TAG ÚNICA"
                  className="w-full pl-14 pr-6 py-7 bg-zinc-900/50 border border-zinc-800 rounded-3xl text-white font-bold placeholder:text-zinc-700 focus:ring-2 focus:ring-lime-400/20 focus:border-lime-400 transition-all outline-none uppercase font-sport tracking-widest text-xl"
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                />
              </div>
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full py-7 bg-white text-black rounded-3xl font-black text-2xl uppercase italic tracking-tighter hover:bg-lime-400 transition-all flex items-center justify-center gap-3 font-sport shadow-2xl active:scale-95"
            >
              {loading ? <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-black"></div> : (
                <>PRÓXIMO <ChevronRight className="w-8 h-8" /></>
              )}
            </button>
          </form>
        ) : (
          <div className="space-y-8 animate-in slide-in-from-right-4">
            <div className="bg-zinc-900/50 border border-zinc-800 p-8 rounded-[2.5rem] space-y-6">
              <div className="flex items-center gap-5">
                <div className="w-20 h-20 bg-lime-400 rounded-3xl flex items-center justify-center text-black font-black text-3xl font-sport italic shadow-lg">
                  {user?.name[0].toUpperCase() || '?'}
                </div>
                <div>
                  <h3 className="text-2xl font-black text-white uppercase italic font-sport tracking-tight leading-none mb-2">{user?.name}</h3>
                  <div className="inline-flex items-center px-3 py-1 bg-black rounded-lg border border-zinc-800">
                    <span className="text-[10px] text-zinc-500 font-black uppercase tracking-widest mr-2">ID:</span>
                    <span className="text-[10px] text-lime-400 font-black font-sport italic">{user?.uniqueCode}</span>
                  </div>
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-4 pt-2">
                <div className="bg-black/40 p-5 rounded-2xl border border-zinc-800/50">
                  <p className="text-[8px] font-black text-zinc-600 uppercase tracking-widest mb-1">Saldo Atual</p>
                  <p className="text-lg font-black text-white font-sport italic">R$ {user?.balance.toFixed(2)}</p>
                </div>
                <div className="bg-black/40 p-5 rounded-2xl border border-zinc-800/50">
                  <p className="text-[8px] font-black text-zinc-600 uppercase tracking-widest mb-1">Aposta Diária</p>
                  <p className="text-lg font-black text-white font-sport italic">R$ {user?.depositedValue.toFixed(2)}</p>
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <div className="grid grid-cols-[80px_1fr] gap-4">
                <button
                  onClick={() => setStep(1)}
                  className="py-6 bg-zinc-900 border border-zinc-800 text-zinc-500 rounded-3xl flex items-center justify-center hover:text-white transition-all active:scale-90"
                >
                  <ArrowLeft className="w-7 h-7" />
                </button>
                <button
                  onClick={validateCheckIn}
                  disabled={loading}
                  className="py-6 bg-lime-400 text-black rounded-3xl font-black text-2xl uppercase italic tracking-tighter hover:bg-white transition-all flex items-center justify-center gap-3 font-sport shadow-[0_25px_50px_rgba(163,230,53,0.2)] active:scale-95"
                >
                  {loading ? <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-black"></div> : (
                    <>CHECK-IN</>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}

        <div className="pt-12 flex flex-col items-center gap-4">
          <Link to="/admin/login" className="group flex items-center gap-3 px-6 py-3 bg-zinc-900/30 border border-zinc-800/50 rounded-full transition-all hover:bg-lime-400/10 hover:border-lime-400/30">
            <Lock className="w-3 h-3 text-zinc-600 group-hover:text-lime-400 transition-colors" />
            <span className="text-[9px] font-black uppercase tracking-[0.4em] text-zinc-500 group-hover:text-white transition-colors">ACESSO RESTRITO AO COMANDO</span>
          </Link>
          <p className="text-[8px] text-zinc-800 font-black uppercase tracking-[0.6em]">FitReward Performance V4</p>
        </div>
      </div>
    </div>
  );
};

export default CheckInPage;
