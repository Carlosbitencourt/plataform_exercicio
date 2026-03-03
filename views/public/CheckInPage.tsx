import React, { useState, useEffect } from 'react';
import { User, UserStatus, TimeSlot, CheckIn } from '../../types';
import { subscribeToUsers, subscribeToTimeSlots, subscribeToCheckIns } from '../../services/db';
import { GYM_LOCATION } from '../../constants';
import { Clock, AlertCircle, CheckCircle, MapPin, Star, Camera, Loader2, Zap, ArrowRight, History, Award, Navigation } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import {
  ensureAuth,
  getUserLocation,
  safeAddDoc,
  safeUpdateDoc,
  safeUploadFile
} from '../../services/firebaseGuard';
import { LocationResult } from '../../services/geolocation';

const CheckInPage: React.FC = () => {
  const { currentUser } = useAuth();
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
  const [earnedPoints, setEarnedPoints] = useState<number>(0);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [debugInfo, setDebugInfo] = useState<any>(null);
  const [lastCheckInId, setLastCheckInId] = useState<string | null>(null);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [uploadedPhotoUrl, setUploadedPhotoUrl] = useState<string | null>(null);

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
        .catch(() => setPermissionStatus('prompt'));
    }

    return () => {
      clearInterval(timer);
      unsubUsers();
      unsubSlots();
      unsubCheckIns();
    };
  }, []);

  // Auto-identify user
  useEffect(() => {
    if (currentUser?.email && users.length > 0) {
      const foundUser = users.find(u => u.email?.toLowerCase() === currentUser.email?.toLowerCase());
      if (foundUser) {
        if (foundUser.status !== UserStatus.ELIMINATED && foundUser.status !== 'eliminado') {
          setUser(foundUser);
        }
      }
    }
  }, [currentUser, users]);

  const getNowStr = () => {
    const hh = currentTime.getHours().toString().padStart(2, '0');
    const mm = currentTime.getMinutes().toString().padStart(2, '0');
    return `${hh}:${mm}`;
  };

  const getTodayISO = () => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  };

  const handleRequestLocation = async () => {
    setLoading(true);
    setError(null);
    setCheckInAddress(null);
    setDebugInfo(null);

    try {
      await ensureAuth();
      const validationError = validatePreConditions();
      if (validationError) throw { message: validationError, isSystemError: false };
      const location = await getUserLocation();
      await processCheckIn(location);
    } catch (err: any) {
      console.error('Check-in Error:', err);
      let msg = err.message || 'Erro desconhecido ao realizar check-in.';
      if (err.code === 'PERMISSION_DENIED') {
        setPermissionStatus('denied');
        msg = isIOS ? 'ACESSO À LOCALIZAÇÃO NEGADO. VÁ EM AJUSTES > PRIVACIDADE.' : 'PERMISSÃO DE LOCALIZAÇÃO NEGADA.';
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

    const hasActiveSlot = timeSlots.some(slot => {
      if (slot.days && !slot.days.includes(dayOfWeek)) return false;
      const intervals = slot.intervals && slot.intervals.length > 0 ? slot.intervals : [{ startTime: slot.startTime, endTime: slot.endTime }];
      return intervals.some(interval => {
        const startMin = timeToMinutes(interval.startTime);
        let endMin = timeToMinutes(interval.endTime);
        if (endMin === 0) endMin = 1440;
        return endMin < startMin ? (currentMinutes >= startMin || currentMinutes < endMin) : (currentMinutes >= startMin && currentMinutes < endMin);
      });
    });

    if (!hasActiveSlot) return `JANELA FECHADA AGORA (${nowStr}).`;
    const today = getTodayISO();
    if (checkIns.some(c => c.userId === user?.id && c.date === today)) return 'CHECK-IN JÁ REALIZADO HOJE.';
    return null;
  };

  const processCheckIn = async (location: LocationResult) => {
    const { latitude, longitude, accuracy } = location;
    let addressStr = 'Localização Detectada';
    try {
      const response = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}&zoom=18`);
      const data = await response.json();
      if (data?.display_name) addressStr = data.display_name.split(',').slice(0, 3).join(',');
    } catch (e) {
      addressStr = `${latitude.toFixed(4)}, ${longitude.toFixed(4)}`;
    }
    setCheckInAddress(addressStr);

    const nowStr = getNowStr();
    const dayOfWeek = currentTime.getDay();
    const timeToMinutes = (t: string) => { const [h, m] = t.split(':').map(Number); return h * 60 + m; };
    const currentMinutes = timeToMinutes(nowStr);

    const activeSlots = timeSlots.filter(slot => {
      if (slot.days && !slot.days.includes(dayOfWeek)) return false;
      const intervals = slot.intervals && slot.intervals.length > 0 ? slot.intervals : [{ startTime: slot.startTime, endTime: slot.endTime }];
      return intervals.some(interval => {
        const startMin = timeToMinutes(interval.startTime);
        let endMin = timeToMinutes(interval.endTime);
        if (endMin === 0) endMin = 1440;
        return endMin < startMin ? (currentMinutes >= startMin || currentMinutes < endMin) : (currentMinutes >= startMin && currentMinutes < endMin);
      });
    });

    if (activeSlots.length === 0) throw { message: 'Erro interno: Horário não encontrado.' };

    let selectedSlot: TimeSlot | null = null;
    let minDistance = Infinity;
    let bestRadius = 0;

    activeSlots.forEach(slot => {
      const targetLat = slot.latitude || GYM_LOCATION.lat;
      const targetLng = slot.longitude || GYM_LOCATION.lng;
      const targetRadius = slot.radius || GYM_LOCATION.radius;

      const R = 6371e3;
      const φ1 = latitude * Math.PI / 180;
      const φ2 = targetLat * Math.PI / 180;
      const Δφ = (targetLat - latitude) * Math.PI / 180;
      const Δλ = (targetLng - longitude) * Math.PI / 180;
      const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) + Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
      const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
      const distance = R * c;

      if (distance <= targetRadius) {
        if (!selectedSlot || distance < minDistance) {
          selectedSlot = slot;
          minDistance = distance;
          bestRadius = targetRadius;
        }
      } else if (distance < minDistance) {
        minDistance = distance;
        bestRadius = targetRadius;
      }
    });

    if (!selectedSlot && window.location.hostname !== 'localhost') {
      setDebugInfo({ distance: minDistance, radius: bestRadius, accuracy });
      throw { code: 'DISTANCE_ERROR', message: 'Você está fora do raio permitido.' };
    }

    if (!selectedSlot) selectedSlot = activeSlots[0];

    const score = 10 * (selectedSlot.weight || 1);
    setEarnedPoints(score);
    const today = getTodayISO();

    const checkInRef = await safeAddDoc('checkIns', {
      userId: user!.id,
      date: today,
      time: nowStr,
      latitude,
      longitude,
      timeSlotId: selectedSlot.id,
      score,
      address: addressStr,
      accuracy: accuracy || 0,
      createdAt: new Date().toISOString()
    });

    setLastCheckInId(checkInRef.id);
    await safeUpdateDoc('users', user!.id, {
      weeklyScore: (user!.weeklyScore || 0) + score,
      totalScore: (user!.totalScore || 0) + score
    });
    setSuccess(true);
  };

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !lastCheckInId) return;
    setUploadingPhoto(true);
    try {
      const url = await safeUploadFile(file, `checkins/${lastCheckInId}/${Date.now()}_${file.name}`);
      await safeUpdateDoc('checkIns', lastCheckInId, { photoUrl: url });
      setUploadedPhotoUrl(url);
    } catch (err: any) {
      setError(err.message || 'Erro ao enviar foto.');
    } finally {
      setUploadingPhoto(false);
    }
  };

  const userCheckIns = checkIns.filter(c => c.userId === user?.id).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const todayChecked = checkIns.some(c => c.userId === user?.id && c.date === getTodayISO());

  if (success) {
    return (
      <div className="p-6 space-y-8 animate-in zoom-in-95 duration-500">
        <div className="bg-zinc-900 border border-zinc-800 p-8 rounded-[2.5rem] text-center space-y-6 shadow-[0_0_80px_rgba(163,230,53,0.1)]">
          <div className="inline-flex p-5 bg-lime-400 rounded-full shadow-[0_0_30px_rgba(163,230,53,0.3)] animate-bounce text-black">
            <CheckCircle className="w-10 h-10" />
          </div>
          <div className="space-y-1">
            <h2 className="text-3xl font-black italic font-sport text-white uppercase tracking-tighter">Concluído!</h2>
            <p className="text-zinc-500 font-black uppercase text-[9px] tracking-[0.4em]">Seu esforço foi recompensado</p>
          </div>

          <div className="bg-black/50 p-6 rounded-3xl border border-zinc-800 relative overflow-hidden group">
            <p className="text-zinc-500 text-[9px] font-black uppercase tracking-widest mb-4">Recompensa</p>
            <div className="text-5xl font-black text-white font-sport italic tracking-tighter drop-shadow-[0_0_15px_rgba(163,230,53,0.5)]">
              +{earnedPoints} <span className="text-lg text-zinc-500 not-italic">PTS</span>
            </div>
          </div>

          <div className="space-y-4">
            {!uploadedPhotoUrl ? (
              <label className="w-full py-5 bg-lime-400 text-black rounded-2xl font-black uppercase italic tracking-tighter flex items-center justify-center gap-2 cursor-pointer hover:bg-white transition-all">
                {uploadingPhoto ? <Loader2 className="w-5 h-5 animate-spin" /> : <Camera className="w-5 h-5" />}
                {uploadingPhoto ? 'ENVIANDO...' : 'REGISTRAR EXERCÍCIO'}
                <input type="file" accept="image/*" capture="environment" className="hidden" onChange={handlePhotoUpload} disabled={uploadingPhoto} />
              </label>
            ) : (
              <div className="aspect-square max-w-[180px] mx-auto rounded-2xl overflow-hidden border-2 border-lime-400/50 shadow-xl">
                <img src={uploadedPhotoUrl} className="w-full h-full object-cover" />
              </div>
            )}
            <button onClick={() => window.location.reload()} className="w-full py-5 bg-zinc-800 text-white rounded-2xl font-black uppercase italic tracking-tighter hover:bg-zinc-700 transition-all font-sport">
              Voltar ao Início
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-8 animate-in fade-in duration-500 pb-20">
      {/* Featured Balance Card */}
      <section className="relative overflow-hidden group">
        <div className="absolute inset-0 bg-gradient-to-br from-lime-500/20 via-transparent to-transparent rounded-[2.5rem] blur-3xl opacity-50 group-hover:opacity-80 transition-opacity"></div>
        <div className="relative bg-zinc-900/40 backdrop-blur-xl border border-zinc-800/50 p-6 rounded-[2.5rem] space-y-6 shadow-2xl">
          <div className="flex items-center justify-between">
            <div className="bg-lime-400/10 p-3 rounded-2xl border border-lime-400/20">
              <Zap className="w-6 h-6 text-lime-400" />
            </div>
            <div className="flex items-center gap-1.5 px-3 py-1 bg-black/40 rounded-full border border-zinc-800">
              <div className="w-1.5 h-1.5 bg-lime-500 rounded-full animate-pulse"></div>
              <span className="text-[8px] font-black text-zinc-400 uppercase tracking-widest">Saldo Atualizado</span>
            </div>
          </div>

          <div className="space-y-1">
            <p className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">Ganhos Acumulados</p>
            <div className="flex items-baseline gap-2">
              <span className="text-4xl font-black text-white font-sport italic tracking-tighter">
                R$ {user?.balance.toFixed(2) || '0.00'}
              </span>
              <span className="text-lime-400 text-xs font-black uppercase">V4.0</span>
            </div>
          </div>

          <div className="pt-4 border-t border-zinc-800/50 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-zinc-800 flex items-center justify-center">
                <Clock className="w-4 h-4 text-zinc-500" />
              </div>
              <div>
                <p className="text-[8px] font-black text-zinc-600 uppercase tracking-widest">Sessão</p>
                <p className="text-[10px] font-black text-zinc-300 uppercase italic font-sport tracking-tight">{currentTime.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <p className="text-[10px] font-black text-lime-400 uppercase italic font-sport tracking-tight">Level 12</p>
              <div className="w-16 h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                <div className="w-2/3 h-full bg-lime-400 rounded-full shadow-[0_0_10px_rgba(163,230,53,0.5)]"></div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Primary Action */}
      <section className="space-y-4">
        {error && (
          <div className="bg-rose-500/10 border border-rose-500/20 p-4 rounded-2xl flex items-center gap-3 animate-in slide-in-from-top-2">
            <AlertCircle className="w-5 h-5 text-rose-500 shrink-0" />
            <p className="text-[10px] font-bold text-rose-500 uppercase tracking-tight">{error}</p>
          </div>
        )}

        <button
          onClick={handleRequestLocation}
          disabled={loading || todayChecked}
          className={`w-full py-6 rounded-[2rem] font-black text-xl uppercase italic tracking-tighter transition-all flex flex-col items-center justify-center gap-1 font-sport shadow-2xl active:scale-95 group relative overflow-hidden ${todayChecked
              ? 'bg-zinc-900 border border-zinc-800 text-zinc-600 cursor-not-allowed'
              : 'bg-white text-black hover:bg-lime-400'
            }`}
        >
          {loading ? (
            <Loader2 className="w-8 h-8 animate-spin" />
          ) : todayChecked ? (
            <>
              <CheckCircle className="w-8 h-8 mb-1" />
              MISSÃO CONCLUÍDA
              <span className="text-[9px] font-black not-italic tracking-widest opacity-40">VOLTE AMANHÃ</span>
            </>
          ) : (
            <>
              {!todayChecked && (
                <div className="absolute inset-0 bg-lime-400 opacity-0 group-hover:opacity-100 transition-opacity"></div>
              )}
              <div className="relative z-10 flex flex-col items-center">
                <div className="flex items-center gap-3">
                  <MapPin className="w-6 h-6" />
                  REGISTRAR CHECK-IN
                </div>
                <span className="text-[9px] font-black not-italic tracking-widest opacity-60">PRESENÇA OBRIGATÓRIA</span>
              </div>
              <ArrowRight className="absolute right-6 w-6 h-6 opacity-0 group-hover:opacity-100 group-hover:translate-x-2 transition-all" />
            </>
          )}
        </button>
      </section>

      {/* Stats Quick Grid */}
      <section className="grid grid-cols-2 gap-4">
        <div className="bg-zinc-900/50 border border-zinc-800 p-5 rounded-3xl space-y-2 group hover:border-zinc-700 transition-colors">
          <div className="w-8 h-8 rounded-lg bg-orange-500/10 flex items-center justify-center group-hover:scale-110 transition-transform">
            <Star className="w-4 h-4 text-orange-500 fill-orange-500" />
          </div>
          <div>
            <p className="text-[8px] font-black text-zinc-500 uppercase tracking-widest">Check-ins</p>
            <p className="text-xl font-black text-white font-sport italic">{userCheckIns.length}</p>
          </div>
        </div>
        <div className="bg-zinc-900/50 border border-zinc-800 p-5 rounded-3xl space-y-2 group hover:border-zinc-700 transition-colors">
          <div className="w-8 h-8 rounded-lg bg-blue-500/10 flex items-center justify-center group-hover:scale-110 transition-transform">
            <Award className="w-4 h-4 text-blue-500" />
          </div>
          <div>
            <p className="text-[8px] font-black text-zinc-500 uppercase tracking-widest">Ranking</p>
            <p className="text-xl font-black text-white font-sport italic">#14</p>
          </div>
        </div>
      </section>

      {/* Recent Activity */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-black uppercase tracking-widest text-zinc-500 flex items-center gap-2">
            <History className="w-3.5 h-3.5" /> Atividade Recente
          </h3>
          <button className="text-[9px] font-black uppercase text-lime-400 tracking-tighter hover:underline">Ver Todos</button>
        </div>

        <div className="space-y-3">
          {userCheckIns.slice(0, 3).map((checkin, i) => (
            <div key={i} className="bg-zinc-900/30 border border-zinc-800/80 p-4 rounded-2xl flex items-center justify-between animate-in slide-in-from-right-4 transition-all hover:bg-zinc-900/50" style={{ animationDelay: `${i * 100}ms` }}>
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-xl bg-black border border-zinc-800 flex items-center justify-center">
                  <Navigation className="w-5 h-5 text-zinc-500" />
                </div>
                <div>
                  <p className="text-xs font-black text-white uppercase italic font-sport tracking-tight">{checkin.address.split(',')[0]}</p>
                  <p className="text-[8px] font-black text-zinc-600 uppercase tracking-widest">{new Date(checkin.date).toLocaleDateString('pt-BR', { weekday: 'long' })}</p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-sm font-black text-lime-400 font-sport italic tracking-tighter">+{checkin.score} <span className="text-[8px] not-italic text-zinc-600">PTS</span></p>
                <p className="text-[8px] font-black text-zinc-600 uppercase tracking-widest">{checkin.time}</p>
              </div>
            </div>
          ))}
          {userCheckIns.length === 0 && (
            <div className="py-12 text-center border-2 border-dashed border-zinc-900 rounded-3xl">
              <p className="text-[9px] font-black text-zinc-700 uppercase tracking-widest">Nenhuma atividade registrada</p>
            </div>
          )}
        </div>
      </section>
    </div>
  );
};

export default CheckInPage;
