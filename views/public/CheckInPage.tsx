import React, { useState, useEffect } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { User, UserStatus, TimeSlot, QRCodeData, CheckIn } from '../../types';
import { subscribeToUsers, subscribeToTimeSlots, subscribeToCheckIns, getTodayActiveQRCode, addCheckIn, updateUser } from '../../services/db';
import { calculateCheckInScore } from '../../services/rewardSystem';
import { GYM_LOCATION } from '../../constants';
import { Search, Clock, AlertCircle, CheckCircle, Lock, ArrowLeft, Activity, ChevronRight } from 'lucide-react';

const CheckInPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const tokenFromUrl = searchParams.get('token');
  const [step, setStep] = useState(1);
  const [identifier, setIdentifier] = useState('');
  const [user, setUser] = useState<User | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [timeSlots, setTimeSlots] = useState<TimeSlot[]>([]);
  const [activeQR, setActiveQR] = useState<QRCodeData | null>(null);
  const [checkIns, setCheckIns] = useState<CheckIn[]>([]);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [checkInAddress, setCheckInAddress] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [debugInfo, setDebugInfo] = useState<any>(null);

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);

    const unsubUsers = subscribeToUsers(setUsers);
    const unsubSlots = subscribeToTimeSlots(setTimeSlots);
    const unsubCheckIns = subscribeToCheckIns(setCheckIns);
    const unsubQR = getTodayActiveQRCode(setActiveQR);

    return () => {
      clearInterval(timer);
      unsubUsers();
      unsubSlots();
      unsubCheckIns();
      unsubQR();
    };
  }, []);

  const dayOfWeek = currentTime.getDay();
  const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;

  const getNowStr = () => {
    const hh = currentTime.getHours().toString().padStart(2, '0');
    const mm = currentTime.getMinutes().toString().padStart(2, '0');
    return `${hh}:${mm}`;
  };

  const getTodayISO = () => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();

    setLoading(true);
    setError(null);

    const cleanId = identifier.trim();
    // Using locally cached users from subscription for responsiveness
    // In a large app, we would use a direct query to Firestore here.
    const foundUser = users.find(u => u.cpf === cleanId || u.uniqueCode.toUpperCase() === cleanId.toUpperCase());

    setTimeout(() => {
      if (foundUser) {
        if (foundUser.status === UserStatus.ELIMINATED) {
          setError('CONTA BLOQUEADA. PROCURE O ADMINISTRADOR.');
        } else {
          setUser(foundUser);
          setStep(2);

          // "Warm up" GPS functionality and request permissions immediately
          if (navigator.geolocation) {
            console.log('Iniciando Warmup do GPS...');
            navigator.geolocation.getCurrentPosition(
              (pos) => console.log('GPS Warmup OK', pos),
              (err) => console.warn('GPS Warmup Failed', err),
              { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
            );
          }
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

    const today = getTodayISO();
    const nowStr = getNowStr();
    const dayOfWeek = currentTime.getDay();

    const timeToMinutes = (timeStr: string) => {
      const [h, m] = timeStr.split(':').map(Number);
      return h * 60 + m;
    };

    const currentMinutes = timeToMinutes(nowStr);

    const activeSlot = timeSlots.find(slot => {
      if (slot.days && !slot.days.includes(dayOfWeek)) return false;

      const startMin = timeToMinutes(slot.startTime);
      let endMin = timeToMinutes(slot.endTime);

      // Handle midnight (00:00 as 1440)
      if (endMin === 0) endMin = 1440;

      if (endMin < startMin) {
        // Cross-midnight slot (e.g., 23:00 - 01:00)
        return currentMinutes >= startMin || currentMinutes < endMin;
      }

      return currentMinutes >= startMin && currentMinutes < endMin;
    });

    if (!activeSlot) {
      setError(`JANELA FECHADA AGORA (${nowStr}).`);
      setLoading(false);
      return;
    }

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

    const alreadyDidToday = checkIns.some(c => c.userId === user?.id && c.date === today);
    if (alreadyDidToday) {
      setError('CHECK-IN JÁ REALIZADO HOJE.');
      setLoading(false);
      return;
    }

    try {
      const getPos = (opts: PositionOptions) => new Promise<GeolocationPosition>((resolve, reject) => {
        if (!navigator.geolocation) {
          reject(new Error('Geolocalização não suportada pelo navegador.'));
          return;
        }
        navigator.geolocation.getCurrentPosition(resolve, reject, opts);
      });

      let position: GeolocationPosition;

      try {
        // Tentativa 1: Alta precisão, timeout médio (10s), aceita cache recente do warmup (10s)
        position = await getPos({
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 10000
        });
      } catch (err) {
        console.warn('GPS Alta precisão falhou, tentando fallback...', err);
        // Tentativa 2: Baixa precisão, timeout longo (20s), aceita cache de 5 minutos
        position = await getPos({
          enableHighAccuracy: false,
          timeout: 20000,
          maximumAge: 300000 // 5 minutos
        });
      }

      const { latitude, longitude, accuracy } = position.coords;

      // Reverse Geocoding - Prioritize Nominatim for Street Level details
      let addressStr = '';

      try {
        // Try Nominatim first for detailed street/neighborhood data
        const response = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}&zoom=18&addressdetails=1`);
        const data = await response.json();

        if (data && data.address) {
          const { road, pedestrian, path, footway, suburb, neighbourhood, city_district, city, town, village, municipality, state } = data.address;

          const parts = [];

          // Rua/Logradouro - Tentativa expandida
          const rua = road || pedestrian || path || footway;
          if (rua) parts.push(rua);

          // Cidade - Normalização
          // Muitas vezes "city_district" ou "municipality" vem igual a cidade
          const cidade = city || town || village || municipality;

          // Bairro - Deduplicação
          // Se o bairro for igual a cidade, ignoramos para não ficar "Catu, Catu"
          const bairroRaw = suburb || neighbourhood || city_district;
          let bairro = null;

          if (bairroRaw && (!cidade || !bairroRaw.includes(cidade))) {
            bairro = bairroRaw;
          }

          if (bairro) parts.push(bairro);

          // Cidade/Estado
          if (cidade) {
            if (state) parts.push(`${cidade} - ${state}`);
            else parts.push(cidade);
          } else if (state) {
            parts.push(state);
          }

          if (parts.length > 0) {
            addressStr = parts.join(', ');
          } else if (data.display_name) {
            // Fallback para display_name se falhar a montagem manual
            const displayParts = data.display_name.split(',');
            // Pega os 3 primeiros componentes para não ficar gigante
            addressStr = displayParts.slice(0, 3).join(',');
          }
        }
      } catch (nomErr) {
        console.error("Erro Nominatim, tentando fallback...", nomErr);

        // Fallback to BigDataCloud (City/State level)
        try {
          const response = await fetch(
            `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${latitude}&longitude=${longitude}&localityLanguage=pt`
          );
          const data = await response.json();

          if (data) {
            const parts = [];
            if (data.locality) parts.push(data.locality);
            if (data.principalSubdivision) parts.push(data.principalSubdivision);
            if (data.countryName) parts.push(data.countryName);

            if (parts.length > 0) {
              addressStr = parts.join(', ');
            }
          }
        } catch (bdcErr) {
          console.error("Erro BigDataCloud", bdcErr);
        }
      }

      setCheckInAddress(addressStr);

      // Use slot-specific coordinates if available, otherwise fallback to global
      const targetLat = activeSlot.latitude || GYM_LOCATION.lat;
      const targetLng = activeSlot.longitude || GYM_LOCATION.lng;
      const targetRadius = activeSlot.radius || GYM_LOCATION.radius;
      const locationName = activeSlot.locationName || 'ACADEMIA';

      const R = 6371e3;
      const φ1 = latitude * Math.PI / 180;
      const φ2 = targetLat * Math.PI / 180;
      const Δφ = (targetLat - latitude) * Math.PI / 180;
      const Δλ = (targetLng - longitude) * Math.PI / 180;

      const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
        Math.cos(φ1) * Math.cos(φ2) *
        Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
      const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
      const distance = R * c;

      if (distance > targetRadius && !isLocalBypass) {
        setDebugInfo({
          userLat: latitude,
          userLng: longitude,
          targetLat,
          targetLng,
          distance,
          radius: targetRadius,
          accuracy
        });
        setError(`VOCÊ ESTÁ FORA DO RAIO PERMITIDO PARA: ${locationName.toUpperCase()}.`);
        setLoading(false);
        return;
      }

      const activeSlotWeight = activeSlot.weight || 1;
      const basePoints = 10;
      const score = basePoints * activeSlotWeight;

      await addCheckIn({
        userId: user!.id,
        date: today,
        time: nowStr,
        latitude,
        longitude,
        timeSlotId: activeSlot.id,
        score,
        address: addressStr
      });

      const updatedUser = { ...user!, balance: user!.balance + score };
      await updateUser(updatedUser);
      setSuccess(true);
    } catch (err: any) {
      console.error('Erro no Check-in:', err);

      let msg = 'GPS OBRIGATÓRIO. ATIVE A LOCALIZAÇÃO E TENTE NOVAMENTE.';

      if (err.code === 1) { // PERMISSION_DENIED
        msg = 'PERMISSÃO DE LOCALIZAÇÃO NEGADA. HABILITE NAS CONFIGURAÇÕES DO NAVEGADOR.';
      } else if (err.code === 2) { // POSITION_UNAVAILABLE
        msg = 'SINAL DE GPS NÃO ENCONTRADO. TENTE EM ÁREA ABERTA.';
      } else if (err.code === 3) { // TIMEOUT
        msg = 'TIMEOUT: DEMORA AO OBTER LOCALIZAÇÃO. TENTE NOVAMENTE.';
      } else if (err.message && typeof err.message === 'string' && !err.code) {
        // Erros manuais (ex: "Geolocalização não suportada")
        msg = err.message;
      }

      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center p-6 font-sans">
        <div className="bg-zinc-900 border border-zinc-800 p-8 rounded-[2rem] text-center space-y-6 max-w-sm w-full shadow-[0_0_80px_rgba(163,230,53,0.1)]">
          <div className="inline-flex p-5 bg-lime-400 rounded-full shadow-[0_0_30px_rgba(163,230,53,0.3)] animate-bounce">
            <CheckCircle className="w-10 h-10 text-black" />
          </div>
          <div className="space-y-1.5">
            <h2 className="text-3xl font-black italic font-sport text-white uppercase tracking-tighter">Missão Cumprida!</h2>
            <p className="text-zinc-500 font-black uppercase text-[9px] tracking-[0.4em]">Check-in Validado com Sucesso</p>
            {checkInAddress && (
              <div className="flex items-center justify-center gap-2 mt-2 text-zinc-600">
                <div className="w-1 h-1 bg-lime-500 rounded-full"></div>
                <p className="text-[9px] font-bold uppercase tracking-wider max-w-[200px] truncate">{checkInAddress}</p>
              </div>
            )}
          </div>
          <div className="bg-black p-5 rounded-xl border border-zinc-800 space-y-1">
            <p className="text-zinc-500 text-[9px] font-black uppercase tracking-widest">Atleta: {user?.name}</p>
            <p className="text-lime-400 text-xl font-black font-sport italic tracking-tighter">RECOMPENSA CREDITADA</p>
          </div>
          <button onClick={() => window.location.reload()} className="w-full py-4 bg-white text-black rounded-xl font-black uppercase italic tracking-tighter hover:bg-lime-400 transition-all text-lg">
            Novo Registro
          </button>

          <Link to="/ranking" className="block w-full py-4 bg-transparent border-2 border-zinc-700 text-zinc-400 rounded-xl font-black uppercase italic tracking-tighter hover:border-lime-400 hover:text-lime-400 transition-all text-lg pt-3">
            Ver Ranking do Dia
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-white p-6 flex flex-col items-center justify-center relative overflow-hidden font-sans">
      <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-lime-500/50 to-transparent"></div>

      <div className="w-full max-w-md space-y-10 relative z-10">
        <div className="text-center space-y-3">
          <div className="inline-flex p-3 bg-lime-400 rounded-xl shadow-lg mb-1">
            <Activity className="w-6 h-6 text-black" />
          </div>
          <h1 className="text-4xl font-black italic font-sport uppercase tracking-tighter leading-none">
            Fit<span className="text-lime-400">Reward</span>
          </h1>
          <div className="flex items-center justify-center gap-3 text-zinc-500 font-black uppercase text-[9px] tracking-[0.4em]">
            <Clock className="w-2.5 h-2.5 text-lime-500" />
            {currentTime.toLocaleTimeString('pt-BR')}
          </div>
        </div>

        {error && (
          <div className="bg-rose-500/10 border border-rose-500/20 p-5 rounded-2xl flex items-start gap-4 animate-in slide-in-from-top-2">
            <AlertCircle className="w-5 h-5 text-rose-500 shrink-0 mt-1" />
            <div className="space-y-1">
              <p className="text-rose-500 font-black text-[10px] uppercase tracking-widest text-left">Aviso de Bloqueio</p>
              <p className="text-white text-xs font-bold uppercase tracking-tight leading-snug text-left">{error}</p>
              {debugInfo && (
                <div className="mt-2 p-2 bg-black/40 rounded border border-rose-500/30 text-[9px] font-mono text-left space-y-1">
                  <p className="text-rose-200">DISTÂNCIA: <span className="text-white font-bold">{Math.round(debugInfo.distance)}m</span> / {debugInfo.radius}m</p>
                  <p className="text-rose-200">SUA: <span className="text-white">{debugInfo.userLat.toFixed(5)}, {debugInfo.userLng.toFixed(5)}</span></p>
                  <p className="text-rose-200">ALVO: <span className="text-white">{debugInfo.targetLat.toFixed(5)}, {debugInfo.targetLng.toFixed(5)}</span></p>
                  <p className="text-rose-200">PRECISÃO GPS: <span className="text-white">{Math.round(debugInfo.accuracy)}m</span></p>
                </div>
              )}
            </div>
          </div>
        )}

        {step === 1 ? (
          <form onSubmit={handleSearch} className="space-y-8">
            <div className="space-y-3">
              <label className="block text-[8px] font-black text-zinc-500 uppercase tracking-[0.3em] ml-1">Identificação do Atleta</label>
              <div className="relative group">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-600 group-focus-within:text-lime-400 transition-colors w-4 h-4" />
                <input
                  required
                  type="text"
                  placeholder="CPF OU TAG ÚNICA"
                  className="w-full pl-12 pr-5 py-5 bg-zinc-900/50 border border-zinc-800 rounded-2xl text-white font-bold placeholder:text-zinc-700 focus:ring-2 focus:ring-lime-400/20 focus:border-lime-400 transition-all outline-none uppercase font-sport tracking-widest text-lg"
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                />
              </div>
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full py-5 bg-white text-black rounded-2xl font-black text-xl uppercase italic tracking-tighter hover:bg-lime-400 transition-all flex items-center justify-center gap-2 font-sport shadow-2xl active:scale-95"
            >
              {loading ? <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-black"></div> : (
                <>PRÓXIMO <ChevronRight className="w-6 h-6" /></>
              )}
            </button>
          </form>
        ) : (
          <div className="space-y-8 animate-in slide-in-from-right-4">
            <div className="bg-zinc-900/50 border border-zinc-800 p-6 rounded-[1.5rem] space-y-5">
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 bg-lime-400 rounded-2xl flex items-center justify-center text-black font-black text-2xl font-sport italic shadow-lg">
                  {user?.name[0].toUpperCase() || '?'}
                </div>
                <div>
                  <h3 className="text-xl font-black text-white uppercase italic font-sport tracking-tight leading-none mb-1.5">{user?.name}</h3>
                  <div className="inline-flex items-center px-2 py-0.5 bg-black rounded-lg border border-zinc-800">
                    <span className="text-[9px] text-zinc-500 font-black uppercase tracking-widest mr-2">ID:</span>
                    <span className="text-[9px] text-lime-400 font-black font-sport italic">{user?.uniqueCode}</span>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 pt-1">
                <div className="bg-black/40 p-4 rounded-xl border border-zinc-800/50">
                  <p className="text-[7.5px] font-black text-zinc-600 uppercase tracking-widest mb-1">Saldo Atual</p>
                  <p className="text-base font-black text-white font-sport italic">R$ {user?.balance.toFixed(2)}</p>
                </div>
                <div className="bg-black/40 p-4 rounded-xl border border-zinc-800/50">
                  <p className="text-[7.5px] font-black text-zinc-600 uppercase tracking-widest mb-1">Aposta Diária</p>
                  <p className="text-base font-black text-white font-sport italic">R$ {user?.depositedValue.toFixed(2)}</p>
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <div className="grid grid-cols-[70px_1fr] gap-3">
                <button
                  onClick={() => setStep(1)}
                  className="py-5 bg-zinc-900 border border-zinc-800 text-zinc-500 rounded-2xl flex items-center justify-center hover:text-white transition-all active:scale-90"
                >
                  <ArrowLeft className="w-6 h-6" />
                </button>
                <button
                  onClick={validateCheckIn}
                  disabled={loading}
                  className="py-5 bg-lime-400 text-black rounded-2xl font-black text-xl uppercase italic tracking-tighter hover:bg-white transition-all flex items-center justify-center gap-3 font-sport shadow-[0_20px_40px_rgba(163,230,53,0.15)] active:scale-95"
                >
                  {loading ? <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-black"></div> : (
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
