import React, { useState, useEffect } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { User, UserStatus, TimeSlot, CheckIn } from '../../types';
import { subscribeToUsers, subscribeToTimeSlots, subscribeToCheckIns, addCheckIn, updateUser } from '../../services/db';
import { calculateCheckInScore } from '../../services/rewardSystem';
import { GYM_LOCATION } from '../../constants';
import { Search, Clock, AlertCircle, CheckCircle, Lock, ArrowLeft, Activity, ChevronRight, MapPin, Map, X, ExternalLink, Calendar, Star, Navigation } from 'lucide-react';
import {
  ensureAuth,
  getUserLocation,
  safeAddDoc,
  safeUpdateDoc
} from '../../services/firebaseGuard';
import { LocationResult } from '../../services/geolocation';

const CheckInPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const tokenFromUrl = searchParams.get('token');
  const [step, setStep] = useState(1);
  const [identifier, setIdentifier] = useState('');
  const [user, setUser] = useState<User | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [timeSlots, setTimeSlots] = useState<TimeSlot[]>([]);
  const [checkIns, setCheckIns] = useState<CheckIn[]>([]);

  // Geolocation & UI States
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [permissionStatus, setPermissionStatus] = useState<'prompt' | 'granted' | 'denied'>('prompt');
  const [checkInAddress, setCheckInAddress] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [debugInfo, setDebugInfo] = useState<any>(null);
  const [showLocationsModal, setShowLocationsModal] = useState(false);
  const [selectedLocation, setSelectedLocation] = useState<TimeSlot | null>(null);

  // iOS Detection for specific instructions
  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream;

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);

    const unsubUsers = subscribeToUsers(setUsers);
    const unsubSlots = subscribeToTimeSlots(setTimeSlots);
    const unsubCheckIns = subscribeToCheckIns(setCheckIns);

    // Initial Permission Check
    if (navigator.permissions && navigator.permissions.query) {
      navigator.permissions.query({ name: 'geolocation' as PermissionName })
        .then(result => {
          setPermissionStatus(result.state as any);
          result.onchange = () => setPermissionStatus(result.state as any);
        })
        .catch(() => {
          // Fallback if query fails, assume prompt
          setPermissionStatus('prompt');
        });
    }

    // Initial Permission Check
    if (navigator.permissions && navigator.permissions.query) {
      navigator.permissions.query({ name: 'geolocation' as PermissionName })
        .then(result => {
          setPermissionStatus(result.state as any);
          result.onchange = () => setPermissionStatus(result.state as any);
        })
        .catch(() => {
          setPermissionStatus('prompt');
        });
    }

    return () => {
      clearInterval(timer);
      unsubUsers();
      unsubSlots();
      unsubCheckIns();
    };
  }, []);

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
    const foundUser = users.find(u => u.cpf === cleanId || u.uniqueCode.toUpperCase() === cleanId.toUpperCase());

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

  const handleRequestLocation = async () => {
    setLoading(true);
    setError(null);
    setCheckInAddress(null);
    setDebugInfo(null);

    try {
      // 0. PRE-FLIGHT AUTH CHECK (Invisible)
      await ensureAuth();

      // 1. Validate Time/QR first
      const validationError = validatePreConditions();
      if (validationError) {
        throw { message: validationError, isSystemError: false };
      }

      // 2. Get Location (Guard handles permissions internally/robustly)
      // Note: getUserLocation from guard calls the robust geolocation service
      const location = await getUserLocation();

      // 3. Process Check-in with location
      await processCheckIn(location);


    } catch (err: any) {
      console.error('Check-in Error:', err);
      let msg = err.message || 'Erro desconhecido ao realizar check-in.';

      if (err.code === 'PERMISSION_DENIED') {
        setPermissionStatus('denied');
        if (isIOS) {
          msg = 'ACESSO À LOCALIZAÇÃO NEGADO. VÁ EM AJUSTES > PRIVACIDADE > SERVIÇOS DE LOCALIZAÇÃO E HABILITE PARA O SAFARI.';
        } else {
          msg = 'PERMISSÃO DE LOCALIZAÇÃO NEGADA. POR FAVOR, HABILITE NAS CONFIGURAÇÕES DO SITE.';
        }
      } else if (err.code === 'POSITION_UNAVAILABLE') {
        msg = 'SINAL DE GPS NÃO ENCONTRADO. TENTE EM ÁREA ABERTA.';
      } else if (err.code === 'TIMEOUT') {
        msg = 'DEMORA AO OBTER LOCALIZAÇÃO. TENTE NOVAMENTE.';
      }

      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  const validatePreConditions = (): string | null => {
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
      if (endMin === 0) endMin = 1440;
      if (endMin < startMin) {
        return currentMinutes >= startMin || currentMinutes < endMin;
      }
      return currentMinutes >= startMin && currentMinutes < endMin;
    });

    if (!activeSlot) {
      return `JANELA FECHADA AGORA (${nowStr}).`;
    }

    const isLocalBypass = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';

    const today = getTodayISO();
    const alreadyDidToday = checkIns.some(c => c.userId === user?.id && c.date === today);
    if (alreadyDidToday) {
      return 'CHECK-IN JÁ REALIZADO HOJE.';
    }

    return null;
  };

  const processCheckIn = async (location: LocationResult) => {
    const { latitude, longitude, accuracy } = location;

    // Reverse Geocoding
    let addressStr = '';
    try {
      const response = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}&zoom=18&addressdetails=1`);
      const data = await response.json();
      if (data && data.address) {
        // Simplificado para display_name ou componentes principais
        addressStr = data.display_name ? data.display_name.split(',').slice(0, 3).join(',') : 'Localização Detectada';
      }
    } catch (e) {
      console.warn('Geocoding failed', e);
      addressStr = `${latitude.toFixed(5)}, ${longitude.toFixed(5)}`;
    }
    setCheckInAddress(addressStr);

    // Validate Radius
    const nowStr = getNowStr();
    const dayOfWeek = currentTime.getDay();
    const timeToMinutes = (t: string) => { const [h, m] = t.split(':').map(Number); return h * 60 + m; };
    const currentMinutes = timeToMinutes(nowStr);

    const activeSlot = timeSlots.find(slot => {
      // Re-find active slot (safe to assume exists as verified in preCheck)
      if (slot.days && !slot.days.includes(dayOfWeek)) return false;
      const startMin = timeToMinutes(slot.startTime);
      let endMin = timeToMinutes(slot.endTime);
      if (endMin === 0) endMin = 1440;
      if (endMin < startMin) return currentMinutes >= startMin || currentMinutes < endMin;
      return currentMinutes >= startMin && currentMinutes < endMin;
    });

    if (!activeSlot) throw { message: 'Erro interno: Horário não encontrado.' };

    const targetLat = activeSlot.latitude || GYM_LOCATION.lat;
    const targetLng = activeSlot.longitude || GYM_LOCATION.lng;
    const targetRadius = activeSlot.radius || GYM_LOCATION.radius;

    const R = 6371e3;
    const φ1 = latitude * Math.PI / 180;
    const φ2 = targetLat * Math.PI / 180;
    const Δφ = (targetLat - latitude) * Math.PI / 180;
    const Δλ = (targetLng - longitude) * Math.PI / 180;
    const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) + Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const distance = R * c;

    const isLocalBypass = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';

    if (distance > targetRadius && !isLocalBypass) {
      setDebugInfo({
        distance, radius: targetRadius, accuracy
      });
      throw { code: 'DISTANCE_ERROR', message: 'Você está longe da academia.' };
    }

    const activeSlotWeight = activeSlot.weight || 1;
    const basePoints = 10;
    const score = basePoints * activeSlotWeight;
    const today = getTodayISO();

    // Use Safe Guard for Firestore Writes
    await safeAddDoc('checkIns', {
      userId: user!.id,
      date: today,
      time: nowStr,
      latitude,
      longitude,
      timeSlotId: activeSlot.id,
      score,
      address: addressStr,
      // Ensure strict structure
      accuracy: accuracy || 0,
      createdAt: new Date().toISOString()
    });

    const updatedUser = { ...user!, balance: user!.balance + score };
    // We update the user stats using safeUpdateDoc
    await safeUpdateDoc('users', user!.id, updatedUser);
    setSuccess(true);
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
        <div className="text-center space-y-3 flex flex-col items-center">
          <img src="/logo.png" alt="Impulso Club" className="h-24 w-auto object-contain mb-2" />
          <div className="flex items-center justify-center gap-3 text-zinc-500 font-black uppercase text-[9px] tracking-[0.4em]">
            <Clock className="w-2.5 h-2.5 text-lime-500" />
            {currentTime.toLocaleTimeString('pt-BR')}
          </div>
        </div>

        {error && (
          <div className="bg-zinc-900/80 border border-zinc-800 p-6 rounded-2xl animate-in slide-in-from-top-2 backdrop-blur-sm">
            {debugInfo && error.includes('longe') ? (
              <div className="space-y-4 text-center">
                <div className="mx-auto w-12 h-12 bg-amber-500/20 text-amber-500 rounded-full flex items-center justify-center animate-pulse">
                  <MapPin className="w-6 h-6" />
                </div>
                <div className="space-y-1">
                  <h3 className="text-white font-black italic uppercase font-sport text-lg tracking-wide">Você está fora do local de check-in</h3>
                  <p className="text-zinc-400 text-[10px] font-bold uppercase tracking-widest">Aproxime-se para realizar o check-in</p>
                </div>

                <div className="py-4 relative">
                  {/* Visual Distance Bar */}
                  <div className="h-1.5 w-full bg-zinc-800 rounded-full overflow-hidden flex items-center relative">
                    <div className="w-1/2 h-full bg-transparent border-r-2 border-dashed border-zinc-600 absolute left-0 top-0"></div>
                    {/* Marker for allowed radius */}
                    <div className="absolute left-[20%] top-1/2 -translate-y-1/2 w-3 h-3 bg-lime-500 rounded-full shadow-[0_0_10px_rgba(163,230,53,0.5)] z-10"></div>

                    {/* Marker for user position (clamped) */}
                    <div className="absolute right-[20%] top-1/2 -translate-y-1/2 w-3 h-3 bg-rose-500 rounded-full shadow-[0_0_10px_rgba(244,63,94,0.5)] animate-ping opacity-75"></div>
                    <div className="absolute right-[20%] top-1/2 -translate-y-1/2 w-3 h-3 bg-rose-500 rounded-full z-10"></div>

                    <div className="absolute left-[22%] top-[-10px] text-[8px] font-black text-lime-500">RAIO {debugInfo.radius}m</div>
                    <div className="absolute right-[22%] top-[-10px] text-[8px] font-black text-rose-500">VOCÊ</div>
                  </div>
                </div>

                <div className="flex items-center justify-center gap-8 border-t border-zinc-800 pt-4">
                  <div className="text-center">
                    <p className="text-[9px] font-black text-zinc-600 uppercase tracking-widest">Sua Distância</p>
                    <p className="text-2xl font-black text-rose-500 font-sport italic tracking-tighter">{Math.round(debugInfo.distance)}<span className="text-sm text-zinc-600 not-italic">m</span></p>
                  </div>
                  <div className="w-px h-8 bg-zinc-800"></div>
                  <div className="text-center">
                    <p className="text-[9px] font-black text-zinc-600 uppercase tracking-widest">Raio Permitido</p>
                    <p className="text-2xl font-black text-lime-500 font-sport italic tracking-tighter">{debugInfo.radius}<span className="text-sm text-zinc-600 not-italic">m</span></p>
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex items-start gap-4">
                <AlertCircle className="w-5 h-5 text-rose-500 shrink-0 mt-1" />
                <div className="space-y-1">
                  <p className="text-rose-500 font-black text-[10px] uppercase tracking-widest text-left">Aviso de Sistema</p>
                  <p className="text-white text-xs font-bold uppercase tracking-tight leading-snug text-left">{error}</p>
                </div>
              </div>
            )}
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
                <div className="w-16 h-16 bg-lime-400 rounded-2xl flex items-center justify-center text-black font-black text-2xl font-sport italic shadow-lg overflow-hidden">
                  {user?.photoUrl ? (
                    <img src={user.photoUrl} alt={user.name} className="w-full h-full object-cover" />
                  ) : (
                    user?.name[0].toUpperCase() || '?'
                  )}
                </div>
                <div>
                  <h3 className="text-xl font-black text-white uppercase italic font-sport tracking-tight leading-none mb-1.5">{user?.name}</h3>
                  <div className="inline-flex items-center px-2 py-0.5 bg-black rounded-lg border border-zinc-800">
                    <span className="text-[9px] text-zinc-500 font-black uppercase tracking-widest mr-2">ID:</span>
                    <span className="text-[9px] text-lime-400 font-black font-sport italic">{user?.uniqueCode}</span>
                  </div>
                </div>
              </div>

              <div className="pt-1">
                <div className="bg-black/40 p-4 rounded-xl border border-zinc-800/50 w-full text-center">
                  <p className="text-[7.5px] font-black text-zinc-600 uppercase tracking-widest mb-1">Saldo Atual</p>
                  <p className="text-2xl font-black text-white font-sport italic">R$ {user?.balance.toFixed(2)}</p>
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

                {(!permissionStatus || permissionStatus === 'prompt' || permissionStatus === 'granted') && (
                  <button
                    onClick={handleRequestLocation}
                    disabled={loading}
                    className="py-5 bg-lime-400 text-black rounded-2xl font-black text-xl uppercase italic tracking-tighter hover:bg-white transition-all flex items-center justify-center gap-3 font-sport shadow-[0_20px_40px_rgba(163,230,53,0.15)] active:scale-95"
                  >
                    {loading ? <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-black"></div> : (
                      <>
                        <MapPin className="w-6 h-6" />
                        CHECK-IN
                      </>
                    )}
                  </button>
                )}

                {permissionStatus === 'denied' && (
                  <button
                    onClick={handleRequestLocation}
                    className="py-5 bg-rose-500 text-white rounded-2xl font-black text-sm uppercase italic tracking-tighter hover:bg-rose-400 transition-all flex items-center justify-center gap-2 font-sport shadow-[0_20px_40px_rgba(244,63,94,0.15)] active:scale-95 px-4"
                  >
                    <AlertCircle className="w-5 h-5 mx-auto mb-1" />
                    {isIOS ? 'HABILITAR NO SAFARI' : 'TENTAR NOVAMENTE'}
                  </button>
                )}

              </div>

              {permissionStatus === 'denied' && (
                <p className="text-[9px] text-zinc-500 text-center font-black uppercase tracking-widest max-w-[280px] mx-auto">
                  Localização obrigatória para validar presença na academia.
                </p>
              )}
              <div className="pt-4 flex flex-col items-center gap-4 border-t border-zinc-800/50 mt-4">
                <button
                  onClick={() => setShowLocationsModal(true)}
                  className="flex items-center gap-2 px-6 py-3 bg-zinc-900 border border-zinc-800 rounded-xl hover:bg-zinc-800 transition-all group w-full max-w-xs justify-center"
                >
                  <Map className="w-4 h-4 text-lime-400" />
                  <span className="text-xs font-black uppercase tracking-widest text-zinc-300 group-hover:text-white">Locais de Check-in</span>
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
          <p className="text-[8px] text-zinc-800 font-black uppercase tracking-[0.6em]">Impulso Club Performance V4</p>
        </div>
      </div>

      {/* Locations Modal */}
      {showLocationsModal && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/90 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-zinc-900 border border-zinc-800 w-full max-w-md rounded-3xl overflow-hidden shadow-2xl flex flex-col max-h-[85vh] animate-in slide-in-from-bottom-10 sm:slide-in-from-bottom-0 sm:zoom-in-95 duration-300">

            {/* Header */}
            <div className="p-5 border-b border-zinc-800 flex items-center justify-between bg-zinc-950">
              <h3 className="text-lg font-black italic uppercase font-sport text-white tracking-wider flex items-center gap-2">
                <Map className="w-5 h-5 text-lime-400" />
                Locais Disponíveis
              </h3>
              <button
                onClick={() => { setShowLocationsModal(false); setSelectedLocation(null); }}
                className="p-2 hover:bg-zinc-800 rounded-full transition-colors text-zinc-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-0">
              {selectedLocation ? (
                <div className="animate-in slide-in-from-right-4 duration-300">
                  {/* Location Photo */}
                  <div className="h-48 bg-zinc-800 relative group overflow-hidden">
                    {selectedLocation.photoUrl ? (
                      <img
                        src={selectedLocation.photoUrl}
                        alt={selectedLocation.locationName}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="absolute inset-0 flex items-center justify-center bg-zinc-900">
                        <MapPin className="w-12 h-12 text-zinc-700" />
                      </div>
                    )}

                    {/* Map Overlay Gradient */}
                    <div className="absolute inset-0 bg-gradient-to-t from-zinc-900 via-transparent to-transparent"></div>

                    <div className="absolute bottom-4 left-4 right-4">
                      <h2 className="text-2xl font-black italic font-sport text-white uppercase tracking-tighter leading-none mb-1 shadow-black drop-shadow-lg">
                        {selectedLocation.locationName}
                      </h2>
                      <div className="flex items-center gap-2 mt-2">
                        <span className="bg-lime-400 text-black text-xs font-black px-3 py-1 rounded shadow-[0_0_20px_rgba(163,230,53,0.4)] whitespace-nowrap font-sport italic tracking-tighter flex items-center gap-1">
                          <Star className="w-3 h-3 fill-black text-black" />
                          {selectedLocation.weight * 10} PONTOS
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="p-6 space-y-6">
                    <div className="space-y-4">
                      <div className="flex items-start gap-4 p-4 bg-black/40 rounded-xl border border-zinc-800">
                        <MapPin className="w-5 h-5 text-zinc-400 mt-1" />
                        <div>
                          <p className="text-[9px] font-black text-zinc-500 uppercase tracking-widest mb-1">Endereço</p>
                          <p className="text-sm font-bold text-white uppercase leading-snug">
                            {/* Address fallback since we don't have exact address field yet */}
                            {selectedLocation.locationName}, Latitude: {selectedLocation.latitude.toFixed(4)}, Longitude: {selectedLocation.longitude.toFixed(4)}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-start gap-4 p-4 bg-black/40 rounded-xl border border-zinc-800">
                        <Clock className="w-5 h-5 text-zinc-400 mt-1" />
                        <div>
                          <p className="text-[9px] font-black text-zinc-500 uppercase tracking-widest mb-1">Horário de Check-in</p>
                          <p className="text-xl font-black text-white font-sport italic">
                            {selectedLocation.startTime} <span className="text-zinc-600 not-italic mx-1">-</span> {selectedLocation.endTime}
                          </p>
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <a
                        href={`https://www.google.com/maps/search/?api=1&query=${selectedLocation.latitude},${selectedLocation.longitude}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="py-4 bg-blue-600 hover:bg-blue-500 text-white rounded-xl flex flex-col items-center justify-center gap-1 transition-all active:scale-95"
                      >
                        <ExternalLink className="w-5 h-5 mb-1" />
                        <span className="text-[10px] font-black uppercase tracking-widest">Google Maps</span>
                      </a>
                      <a
                        href={`https://waze.com/ul?ll=${selectedLocation.latitude},${selectedLocation.longitude}&navigate=yes`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="py-4 bg-cyan-500 hover:bg-cyan-400 text-white rounded-xl flex flex-col items-center justify-center gap-1 transition-all active:scale-95"
                      >
                        <Navigation className="w-5 h-5 mb-1" />
                        <span className="text-[10px] font-black uppercase tracking-widest">Waze</span>
                      </a>
                    </div>

                    <button
                      onClick={() => setSelectedLocation(null)}
                      className="w-full py-4 text-zinc-500 hover:text-white font-black uppercase text-xs tracking-widest transition-colors flex items-center justify-center gap-2"
                    >
                      <ArrowLeft className="w-4 h-4" />
                      Voltar para lista
                    </button>
                  </div>
                </div>
              ) : (
                <div className="p-4 space-y-6">
                  {[1, 2, 3, 4, 5, 6, 0].map(dayIdx => { // Start with Monday(1) ends with Sunday(0)
                    const daySlots = timeSlots.filter(s => {
                      // 1. Filter by Day
                      if (!s.days.includes(dayIdx)) return false;

                      // 2. Strict City Filter
                      if (!user?.city) return false; // User without city sees nothing (or only global? Assume strict for now based on request)
                      if (!s.city) return false; // Slot without city does not match user with city

                      const normalize = (str: string) => str.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
                      const userCity = normalize(user.city);
                      const slotCity = normalize(s.city);

                      return userCity === slotCity;
                    }).sort((a, b) => a.startTime.localeCompare(b.startTime));
                    if (daySlots.length === 0) return null;

                    const dayNames = ['Domingo', 'Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado'];

                    return (
                      <div key={dayIdx} className="space-y-3">
                        <div className="flex items-center gap-3 px-2">
                          <Calendar className="w-4 h-4 text-lime-400" />
                          <h4 className="text-sm font-black text-white uppercase tracking-widest">{dayNames[dayIdx]}</h4>
                          <div className="h-px bg-zinc-800 flex-1"></div>
                        </div>

                        <div className="grid gap-2">
                          {daySlots.map(slot => (
                            <button
                              key={slot.id}
                              onClick={() => setSelectedLocation(slot)}
                              className="bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 hover:border-lime-400/30 p-4 rounded-xl text-left transition-all active:scale-[0.98] group"
                            >
                              <div className="flex items-center justify-between mb-2">
                                <span className="text-white font-bold uppercase text-sm truncate pr-2 group-hover:text-lime-400 transition-colors">{slot.locationName}</span>
                                <span className="bg-lime-400 text-black text-[10px] font-black px-2.5 py-1 rounded shadow-[0_0_15px_rgba(163,230,53,0.3)] whitespace-nowrap font-sport italic tracking-tighter transform hover:scale-110 transition-transform duration-300">
                                  {slot.weight * 10} PTS
                                </span>
                              </div>
                              <div className="flex items-center gap-2 text-zinc-500 text-xs">
                                <Clock className="w-3 h-3" />
                                <span className="font-mono">{slot.startTime} - {slot.endTime}</span>
                              </div>
                            </button>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CheckInPage;
