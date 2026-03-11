import React, { useState, useEffect } from 'react';
import { User, UserStatus, TimeSlot, CheckIn, Distribution, SystemSettings } from '../../types';
import { subscribeToUsers, subscribeToTimeSlots, subscribeToCheckIns, subscribeToDistributions, subscribeToSettings } from '../../services/db';
import { runWeeklyPenaltyCheck, syncUserAbsences, getEffectiveMonday } from '../../services/rewardSystem';
import { GYM_LOCATION } from '../../constants';
import { Clock, AlertCircle, CheckCircle, MapPin, Star, Camera, Loader2, Zap, ArrowRight, History, Award, Navigation, Trophy, Bell, Wallet, X, PlusCircle, Copy, ExternalLink } from 'lucide-react';
import { sendCheckInConfirmation } from '../../services/whatsapp';
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
  const [distributions, setDistributions] = useState<Distribution[]>([]);

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
  const [settings, setSettings] = useState<SystemSettings | null>(null);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [uploadedPhotoUrl, setUploadedPhotoUrl] = useState<string | null>(null);
  const [isWithdrawModalOpen, setIsWithdrawModalOpen] = useState(false);
  const [withdrawAmount, setWithdrawAmount] = useState('');
  const [isSubmittingWithdraw, setIsSubmittingWithdraw] = useState(false);
  const [isDepositModalOpen, setIsDepositModalOpen] = useState(() => localStorage.getItem('isDepositModalOpen') === 'true');
  const [depositAmount, setDepositAmount] = useState(() => localStorage.getItem('depositAmount') || '10.00');
  const [isGeneratingDeposit, setIsGeneratingDeposit] = useState(false);
  const [depositPaymentData, setDepositPaymentData] = useState(() => {
    const saved = localStorage.getItem('depositPaymentData');
    return saved ? JSON.parse(saved) : null;
  });
  const [prevBalance, setPrevBalance] = useState<number | null>(null);

  // Ranking Positions
  const [positions, setPositions] = useState({ daily: '-', weekly: '-', general: '-' });

  // iOS Detection for specific instructions
  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream;

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    const unsubUsers = subscribeToUsers(setUsers);
    const unsubSlots = subscribeToTimeSlots(setTimeSlots);
    const unsubCheckIns = subscribeToCheckIns(setCheckIns);
    const unsubDist = subscribeToDistributions(setDistributions);
    const unsubSettings = subscribeToSettings(setSettings);

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
      unsubDist();
      unsubSettings();
    };
  }, []);

  // Persist deposit state
  useEffect(() => {
    localStorage.setItem('isDepositModalOpen', String(isDepositModalOpen));
    localStorage.setItem('depositAmount', depositAmount);
    if (depositPaymentData) {
      localStorage.setItem('depositPaymentData', JSON.stringify(depositPaymentData));
    } else {
      localStorage.removeItem('depositPaymentData');
    }
  }, [isDepositModalOpen, depositAmount, depositPaymentData]);

  // Monitor payment status via balance updates
  useEffect(() => {
    if (user && prevBalance !== null && user.balance > prevBalance) {
      if (isDepositModalOpen && depositPaymentData) {
        alert("Pagamento confirmado! Seu saldo foi atualizado.");
        setIsDepositModalOpen(false);
        setDepositPaymentData(null);
        setDepositAmount('10.00');
      }
    }
    if (user) {
      setPrevBalance(user.balance);
    }
  }, [user?.balance, isDepositModalOpen, depositPaymentData]);

  useEffect(() => {
    if (currentUser?.email && users.length > 0) {
      const foundUser = users.find(u => u.email?.toLowerCase() === currentUser.email?.toLowerCase());
      if (foundUser) {
        if (foundUser.status !== UserStatus.ELIMINATED && foundUser.status !== 'eliminado') {
          setUser(foundUser);
          syncUserAbsences(foundUser.id);

          // Calculate Positions
          const today = getTodayISO();

          // 1. Daily Position (by check-in time)
          const todayCheckIns = checkIns
            .filter(c => c.date === today)
            .sort((a, b) => a.time.localeCompare(b.time));

          const uniqueDailyAtletes = Array.from(new Set(todayCheckIns.map(c => c.userId)));
          const dailyPos = uniqueDailyAtletes.indexOf(foundUser.id) + 1;

          // 2. Weekly Position
          const startOfWeek = getEffectiveMonday();

          const weeklyRank = users
            .map(u => {
              const uCheckIns = checkIns.filter(c => {
                const [y, m, d] = c.date.split('-').map(Number);
                const cDate = new Date(y, m - 1, d);
                return u.id === c.userId && cDate >= startOfWeek;
              });
              const score = uCheckIns.reduce((acc, c) => acc + (c.score || 0), 0);
              return { id: u.id, score };
            })
            .sort((a, b) => b.score - a.score);
          const weeklyPos = weeklyRank.findIndex(r => r.id === foundUser.id) + 1;

          // 3. General Position
          const generalRank = [...users].sort((a, b) => (b.totalScore || 0) - (a.totalScore || 0));
          const generalPos = generalRank.findIndex(r => r.id === foundUser.id) + 1;

          setPositions({
            daily: dailyPos > 0 ? `#${dailyPos}` : '-',
            weekly: weeklyPos > 0 ? `#${weeklyPos}` : '-',
            general: generalPos > 0 ? `#${generalPos}` : '-'
          });
        }
      } else {
        // If logged in but not an athlete, reset positions
        setPositions({ daily: '-', weekly: '-', general: '-' });
        setUser(null);
      }
    }
  }, [currentUser, users, checkIns]);

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

    if (!hasActiveSlot) return `JANELA FECHADA AGORA(${nowStr}).`;
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

    // Enviar confirmação via WhatsApp
    if (user && user.phone) {
      sendCheckInConfirmation(user.phone, user.name, nowStr, settings?.checkInMessage)
        .catch(err => console.error("Erro ao enviar confirmação WhatsApp:", err));
    }
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

  const handleWithdrawalRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    const amount = parseFloat(withdrawAmount);
    if (isNaN(amount) || amount <= 0) {
      alert("Por favor, insira um valor válido.");
      return;
    }
    if (amount > (user.balance || 0)) {
      alert("Saldo insuficiente.");
      return;
    }
    if (!user.pixKey) {
      alert("Por favor, cadastre sua chave PIX no seu perfil antes de solicitar o resgate.");
      setIsWithdrawModalOpen(false);
      return;
    }

    setIsSubmittingWithdraw(true);
    try {
      const { requestWithdrawal } = await import('../../services/db');
      await requestWithdrawal(user.id, user.name, amount, user.pixKey);
      alert("Solicitação de resgate enviada com sucesso! O valor foi reservado do seu saldo.");
      setIsWithdrawModalOpen(false);
      setWithdrawAmount('');
    } catch (error: any) {
      alert("Erro ao solicitar resgate: " + error.message);
    } finally {
      setIsSubmittingWithdraw(false);
    }
  };

  const handleDepositRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    const amount = parseFloat(depositAmount);
    if (isNaN(amount) || amount < 10) {
      alert("O valor mínimo para depósito é R$ 10,00.");
      return;
    }

    setIsGeneratingDeposit(true);
    setError(null);

    try {
      const { generateSignupPix } = await import('../../services/abacatePay');
      const data = await generateSignupPix({
        name: user.name,
        email: user.email || '',
        phone: user.phone || '',
        cpf: user.cpf || '',
        amount: amount
      });
      setDepositPaymentData(data);
    } catch (err: any) {
      console.error('Erro ao gerar depósito:', err);
      setError(err.message || "Erro ao gerar cobrança PIX.");
    } finally {
      setIsGeneratingDeposit(false);
    }
  };

  const handleCopyPix = async (payload: string) => {
    try {
      if (payload) {
        if (navigator.clipboard && window.isSecureContext) {
          await navigator.clipboard.writeText(payload);
        } else {
          const textArea = document.createElement("textarea");
          textArea.value = payload;
          document.body.appendChild(textArea);
          textArea.focus();
          textArea.select();
          document.execCommand('copy');
          document.body.removeChild(textArea);
        }
        alert("Código PIX copiado com sucesso!");
      }
    } catch (err) {
      console.error('Falha ao copiar:', err);
      alert("Erro ao copiar o código.");
    }
  };

  const userCheckIns = checkIns.filter(c => c.userId === user?.id).sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
  const todayChecked = user?.id ? checkIns.some(c => c.userId === user.id && c.date === getTodayISO()) : false;

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
    <div className="p-6 space-y-6 animate-in fade-in duration-500 pb-20">
      {/* Featured Balance Card */}
      <section className="relative overflow-hidden group">
        <div className="absolute inset-0 bg-gradient-to-br from-lime-500/20 via-transparent to-transparent rounded-[1.5rem] blur-3xl opacity-50 group-hover:opacity-80 transition-opacity"></div>
        <div className="relative bg-zinc-900/40 backdrop-blur-xl border border-zinc-800/50 p-5 rounded-[1.5rem] space-y-4 shadow-2xl">
          <div className="flex items-center justify-between">
            <div className="bg-lime-400/10 p-3 rounded-2xl border border-lime-400/20">
              <Zap className="w-6 h-6 text-lime-400" />
            </div>
            <div className="flex items-center gap-1.5 px-3 py-1 bg-black/40 rounded-full border border-zinc-800">
              <div className="w-1.5 h-1.5 bg-lime-500 rounded-full animate-pulse"></div>
              <span className="text-[8px] font-black text-zinc-400 uppercase tracking-widest">Saldo Atualizado</span>
            </div>
          </div>

          <div className="space-y-4">
            <div className="space-y-1">
              <p className="text-xs font-black text-zinc-500 uppercase tracking-[0.2em] mb-1">Saldo Total (Portfólio)</p>
              <div className="flex items-baseline gap-2">
                <span className="text-6xl font-black text-white font-sport italic tracking-tighter text-shadow-glow">
                  {`R$ ${user?.balance?.toFixed(2) || '0.00'}`}
                </span>
                <span className="text-lime-400 text-sm font-black uppercase tracking-tighter animate-pulse bg-lime-400/10 px-2 py-0.5 rounded-md border border-lime-400/20 shadow-[0_0_15px_rgba(163,230,53,0.1)]">LIVE</span>
              </div>
              <div className="flex gap-2 mt-2">
                <button
                  onClick={() => setIsWithdrawModalOpen(true)}
                  className="flex-1 py-2 px-4 bg-lime-400 text-black rounded-xl font-black uppercase tracking-widest text-[9px] hover:scale-[1.05] active:scale-95 transition-all shadow-lg shadow-lime-400/20 flex items-center justify-center gap-2 relative z-10"
                >
                  <Wallet className="w-3.5 h-3.5" />
                  Resgatar Saldo
                </button>
                <button
                  onClick={() => {
                    setDepositPaymentData(null);
                    setIsDepositModalOpen(true);
                  }}
                  className="flex-1 py-2 px-4 bg-zinc-800 text-white border border-zinc-700 rounded-xl font-black uppercase tracking-widest text-[9px] hover:scale-[1.05] active:scale-95 transition-all flex items-center justify-center gap-2 relative z-10"
                >
                  <PlusCircle className="w-3.5 h-3.5 text-lime-400" />
                  Adicionar Saldo
                </button>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 pt-2">
              <div className="bg-lime-400/5 border border-lime-400/20 p-4 rounded-2xl relative overflow-hidden group">
                <div className="absolute top-0 right-0 p-1 opacity-20">
                  <Award className="w-4 h-4 text-lime-400" />
                </div>
                <p className="text-[8px] font-black text-lime-600/60 uppercase tracking-widest mb-1">Lucro Gerado</p>
                <p className="text-xl font-black text-lime-400 font-sport italic leading-none">
                  {(() => {
                    const userDist = distributions.filter(d => d.userId === user?.id);
                    const positiveProfit = userDist.filter(d => d.amount > 0).reduce((acc, d) => acc + d.amount, 0);
                    return `R$ ${positiveProfit.toFixed(2)}`;
                  })()}
                </p>
              </div>

              <div className="bg-rose-500/5 border border-rose-500/20 p-4 rounded-2xl relative overflow-hidden group">
                <div className="absolute top-0 right-0 p-1 opacity-20">
                  <AlertCircle className="w-4 h-4 text-rose-500" />
                </div>
                <p className="text-[8px] font-black text-rose-500/60 uppercase tracking-widest mb-1">Penalidades (Faltas)</p>
                <p className="text-xl font-black text-rose-500 font-sport italic leading-none">
                  {(() => {
                    const userDist = distributions.filter(d => d.userId === user?.id);
                    const penalties = userDist.filter(d => d.amount < 0).reduce((acc, d) => acc + d.amount, 0);
                    return `R$ ${Math.abs(penalties).toFixed(2)}`;
                  })()}
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Weekly Progress Bar (Segunda a Sexta) */}
      <section className="bg-zinc-900 border border-zinc-800 p-5 rounded-[1.5rem] space-y-3 relative overflow-hidden">
        <div className="flex items-center justify-between relative z-10">
          <div>
            <p className="text-xs font-black text-white uppercase tracking-tighter italic font-sport">Frequência Semanal</p>
            <p className="text-[9px] font-black text-zinc-500 uppercase tracking-widest">Segunda a Sexta-feira</p>
          </div>
          <div className="text-right">
            <p className="text-lg font-black text-lime-400 font-sport italic leading-none">
              {(() => {
                const toLocalISO = (d: Date) => {
                  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
                };

                const now = new Date();
                const monday = getEffectiveMonday(now);

                let completedCount = 0;
                for (let i = 0; i < 5; i++) {
                  const target = new Date(monday);
                  target.setDate(monday.getDate() + i);
                  const targetStr = toLocalISO(target);
                  if (userCheckIns.some(ci => ci.date === targetStr)) {
                    completedCount++;
                  }
                }
                return completedCount;
              })()}/5
            </p>
            <p className="text-[8px] font-black text-zinc-600 uppercase tracking-widest leading-none mt-1">Treinos</p>
          </div>
        </div>

        <div className="flex gap-2 relative z-10">
          {[1, 2, 3, 4, 5].map((day) => {
            const now = new Date();
            const monday = getEffectiveMonday(now);

            const targetDate = new Date(monday);
            targetDate.setDate(monday.getDate() + day - 1);
            targetDate.setHours(0, 0, 0, 0);

            const todayStart = new Date(now);
            todayStart.setHours(0, 0, 0, 0);

            const toLocalISO = (d: Date) => {
              return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
            };
            const targetDateStr = toLocalISO(targetDate);

            const hasCheckIn = userCheckIns.some(ci => ci.date === targetDateStr);
            const isToday = targetDate.getTime() === todayStart.getTime();
            const isPast = targetDate.getTime() < todayStart.getTime();
            const isMissed = isPast && !hasCheckIn;

            return (
              <div key={day} className="flex-1 space-y-2">
                <div className={`h-2 rounded-full transition-all duration-500 shadow-sm ${hasCheckIn
                  ? 'bg-lime-400 shadow-[0_0_15px_rgba(163,230,53,0.4)]'
                  : isMissed
                    ? 'bg-rose-600 shadow-[0_0_15px_rgba(225,29,72,0.6)] animate-pulse'
                    : isToday
                      ? 'bg-zinc-800 border border-lime-400/30 ring-1 ring-lime-400/20'
                      : 'bg-zinc-900 border border-zinc-800'
                  }`} />
                <p className={`text-center text-[8px] font-black uppercase tracking-tighter ${isToday ? 'text-lime-400' : isMissed ? 'text-rose-500' : hasCheckIn ? 'text-zinc-400' : 'text-zinc-600'
                  }`}>
                  {['SEG', 'TER', 'QUA', 'QUI', 'SEX'][day - 1]}
                </p>
              </div>
            );
          })}
        </div>
      </section>

      {/* Real-time Ranking Positions */}
      <section className="grid grid-cols-3 gap-3">
        <div className="bg-zinc-900 border border-zinc-800 p-5 rounded-[1.5rem] text-center space-y-2 group hover:border-lime-500/30 transition-all">
          <p className="text-[9px] font-black text-zinc-500 uppercase tracking-widest group-hover:text-zinc-300 transition-colors">DIÁRIO</p>
          <div className="flex items-center justify-center gap-2">
            <Trophy className="w-4 h-4 text-amber-500" />
            <p className="text-2xl font-black text-white font-sport italic tracking-tighter">{positions.daily}</p>
          </div>
        </div>
        <div className="bg-zinc-900 border border-zinc-800 p-5 rounded-[1.5rem] text-center space-y-2 group hover:border-lime-500/30 transition-all">
          <p className="text-[9px] font-black text-zinc-500 uppercase tracking-widest group-hover:text-zinc-300 transition-colors">SEMANAL</p>
          <div className="flex items-center justify-center gap-2">
            <Award className="w-4 h-4 text-blue-500" />
            <p className="text-2xl font-black text-white font-sport italic tracking-tighter">{positions.weekly}</p>
          </div>
        </div>
        <div className="bg-zinc-900 border border-zinc-800 p-5 rounded-[1.5rem] text-center space-y-2 group hover:border-lime-500/30 transition-all">
          <p className="text-[9px] font-black text-zinc-500 uppercase tracking-widest group-hover:text-zinc-300 transition-colors">GERAL</p>
          <div className="flex items-center justify-center gap-2">
            <Star className="w-4 h-4 text-lime-500 fill-lime-500/20" />
            <p className="text-2xl font-black text-white font-sport italic tracking-tighter">{positions.general}</p>
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
          disabled={loading || todayChecked || user?.status === UserStatus.PENDING}
          className={`w-full py-8 rounded-[1.5rem] font-black text-2xl uppercase italic tracking-tighter transition-all flex flex-col items-center justify-center gap-1 font-sport shadow-[0_20px_50px_rgba(255,255,255,0.1)] active:scale-95 group relative overflow-hidden ${todayChecked || user?.status === UserStatus.PENDING
            ? 'bg-zinc-900 border border-zinc-800 text-zinc-600 cursor-not-allowed'
            : 'bg-white text-black hover:shadow-[0_20px_60px_rgba(163,230,53,0.3)]'
            }`}
        >
          {loading ? (
            <Loader2 className="w-10 h-10 animate-spin" />
          ) : todayChecked ? (
            <div className="flex flex-col items-center animate-in fade-in duration-700">
              <div className="bg-zinc-800 p-2 rounded-full mb-2">
                <CheckCircle className="w-8 h-8 text-zinc-500" />
              </div>
              <span className="text-zinc-500">MISSÃO CONCLUÍDA</span>
              <span className="text-[9px] font-black not-italic tracking-[0.3em] opacity-40">VOLTE AMANHÃ</span>
            </div>
          ) : user?.status === UserStatus.PENDING ? (
            <div className="flex flex-col items-center opacity-60">
              <Bell className="w-8 h-8 mb-2 text-amber-500 animate-pulse" />
              <span className="text-zinc-500">AGUARDANDO APROVAÇÃO</span>
              <span className="text-[9px] font-black not-italic tracking-[0.3em] opacity-40">REGISTRO BLOQUEADO</span>
            </div>
          ) : (
            <>
              <div className="absolute inset-0 bg-gradient-to-tr from-lime-400/0 via-white/40 to-lime-400/0 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-1000 ease-in-out"></div>
              <div className="relative z-10 flex flex-col items-center">
                <div className="flex items-center gap-5">
                  <div className="p-4 bg-black rounded-2xl group-hover:bg-lime-500 transition-colors duration-300 shadow-xl">
                    <MapPin className="w-8 h-8 text-white group-hover:text-black" />
                  </div>
                  <div className="text-left">
                    <p className="text-2xl font-black italic tracking-tighter leading-none mb-1">REGISTRAR CHECK-IN</p>
                    <p className="text-xs font-bold not-italic tracking-[0.2em] text-zinc-500 uppercase">PRESENÇA OBRIGATÓRIA</p>
                  </div>
                </div>
              </div>
              <ArrowRight className="absolute right-8 w-6 h-6 opacity-40 group-hover:opacity-100 group-hover:translate-x-2 transition-all" />
            </>
          )}
        </button>
      </section>

      {/* Stats Quick Grid */}
      <section className="grid grid-cols-1 gap-4">
        <div className="bg-zinc-900/50 border border-zinc-800 p-6 rounded-[1.5rem] flex items-center justify-between group hover:border-zinc-700 transition-colors">
          <div className="flex items-center gap-5">
            <div className="w-12 h-12 rounded-2xl bg-orange-500/10 flex items-center justify-center group-hover:scale-110 transition-transform">
              <Star className="w-6 h-6 text-orange-500 fill-orange-500" />
            </div>
            <div>
              <p className="text-xs font-black text-zinc-500 uppercase tracking-widest mb-1">Total de Check-ins</p>
              <p className="text-3xl font-black text-white font-sport italic tracking-tighter">
                {userCheckIns.length} <span className="text-sm text-zinc-500 not-italic uppercase tracking-widest ml-1">TREINOS</span>
              </p>
            </div>
          </div>
          <History className="w-5 h-5 text-zinc-800" />
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
                  <p className="text-xs font-black text-white uppercase italic font-sport tracking-tight">{(checkin.address || 'Localização').split(',')[0]}</p>
                  <p className="text-[8px] font-black text-zinc-600 uppercase tracking-widest">{new Date(checkin.date + 'T12:00:00').toLocaleDateString('pt-BR', { weekday: 'long' })}</p>
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

      {/* Withdrawal Modal */}
      {isWithdrawModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center animate-in fade-in duration-300 p-4">
          <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={() => setIsWithdrawModalOpen(false)}></div>
          <div className="relative w-full max-w-lg bg-zinc-900 border border-zinc-800 rounded-[2.5rem] p-8 space-y-8 animate-in zoom-in-95 duration-500 shadow-2xl overflow-y-auto max-h-[90vh]">
            <header className="flex items-center justify-between">
              <div>
                <h2 className="text-2xl font-black italic font-sport text-white uppercase tracking-tighter">Resgatar Saldo</h2>
                <p className="text-zinc-500 font-bold uppercase text-[10px] tracking-widest">Solicitar transferência PIX</p>
              </div>
              <button
                onClick={() => setIsWithdrawModalOpen(false)}
                className="p-3 bg-zinc-800 text-zinc-400 rounded-2xl hover:text-white transition-colors"
              >
                <X className="w-6 h-6" />
              </button>
            </header>

            <form onSubmit={handleWithdrawalRequest} className="space-y-6">
              <div className="bg-black/40 border border-zinc-800/50 p-6 rounded-3xl space-y-2">
                <p className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">Saldo Disponível</p>
                <p className="text-2xl font-black text-lime-400 font-sport italic tracking-tighter">
                  R$ {user?.balance?.toFixed(2) || '0.00'}
                </p>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest ml-1">Valor do Resgate</label>
                <div className="relative">
                  <span className="absolute left-6 top-1/2 -translate-y-1/2 text-zinc-500 font-bold">R$</span>
                  <input
                    required
                    type="number"
                    step="0.01"
                    min="0.01"
                    max={user?.balance || 0}
                    placeholder="0,00"
                    className="w-full pl-14 pr-6 py-4 bg-black border border-zinc-800 rounded-xl text-white font-bold focus:border-lime-400 outline-none transition-all"
                    value={withdrawAmount}
                    onChange={e => setWithdrawAmount(e.target.value)}
                  />
                </div>
              </div>

              <div className="p-4 bg-amber-500/10 border border-amber-500/20 rounded-2xl space-y-1">
                <p className="text-[10px] font-black text-amber-500 uppercase tracking-widest">Atenção</p>
                <p className="text-[10px] text-amber-200/60 font-medium">
                  O valor será enviado para sua chave PIX cadastrada: <span className="text-amber-400 font-bold">{user?.pixKey || 'NÃO CADASTRADA'}</span>
                </p>
              </div>

              <button
                type="submit"
                disabled={isSubmittingWithdraw || (user?.balance || 0) <= 0}
                className="w-full py-5 bg-lime-400 text-black rounded-2xl font-black uppercase tracking-widest text-sm hover:scale-[1.02] active:scale-95 transition-all shadow-xl shadow-lime-400/20 disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {isSubmittingWithdraw ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Confirmar Solicitação'}
              </button>
            </form>
          </div>
        </div>
      )}
      {/* Deposit Modal */}
      {isDepositModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center animate-in fade-in duration-300 p-4">
          <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={() => setIsDepositModalOpen(false)}></div>
          <div className="relative w-full max-w-lg bg-zinc-900 border border-zinc-800 rounded-[2.5rem] p-8 space-y-8 animate-in zoom-in-95 duration-500 shadow-2xl overflow-y-auto max-h-[90vh]">
            <header className="flex items-center justify-between">
              <div>
                <h2 className="text-2xl font-black italic font-sport text-white uppercase tracking-tighter">Adicionar Saldo</h2>
                <p className="text-zinc-500 font-bold uppercase text-[10px] tracking-widest">Depósito via PIX</p>
              </div>
              <button
                onClick={() => setIsDepositModalOpen(false)}
                className="p-3 bg-zinc-800 text-zinc-400 rounded-2xl hover:text-white transition-colors"
              >
                <X className="w-6 h-6" />
              </button>
            </header>

            {!depositPaymentData ? (
              <form onSubmit={handleDepositRequest} className="space-y-6">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest ml-1">Valor do Depósito (Mín. R$ 10)</label>
                  <div className="relative">
                    <span className="absolute left-6 top-1/2 -translate-y-1/2 text-zinc-500 font-bold">R$</span>
                    <input
                      required
                      type="number"
                      step="0.01"
                      min="10"
                      placeholder="10,00"
                      className="w-full pl-14 pr-6 py-4 bg-black border border-zinc-800 rounded-xl text-white font-bold focus:border-lime-400 outline-none transition-all"
                      value={depositAmount}
                      onChange={e => setDepositAmount(e.target.value)}
                    />
                  </div>
                </div>

                <div className="p-4 bg-lime-400/5 border border-lime-400/20 rounded-2xl space-y-1">
                  <p className="text-[10px] font-black text-lime-400 uppercase tracking-widest">Informação</p>
                  <p className="text-[10px] text-zinc-400 font-medium">
                    O saldo será creditado automaticamente após a confirmação do pagamento.
                  </p>
                </div>

                <button
                  type="submit"
                  disabled={isGeneratingDeposit}
                  className="w-full py-5 bg-lime-400 text-black rounded-2xl font-black uppercase tracking-widest text-sm hover:scale-[1.02] active:scale-95 transition-all shadow-xl shadow-lime-400/20 disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {isGeneratingDeposit ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Gerar QR Code PIX'}
                </button>
              </form>
            ) : (
              <div className="space-y-6 animate-in zoom-in-95 duration-300">
                <div className="bg-black border-2 border-zinc-800 p-6 rounded-[2rem] space-y-6">
                  {depositPaymentData?.pix?.qrcode ? (
                    <div className="bg-white p-4 rounded-2xl mx-auto w-48 h-48 shadow-xl">
                      <img src={depositPaymentData.pix.qrcode} alt="QR Code PIX" className="w-full h-full" />
                    </div>
                  ) : (
                    <div className="py-8 text-zinc-600 italic text-xs text-center flex items-center justify-center gap-2">
                      <Loader2 className="w-4 h-4 animate-spin" /> Gerando QR Code...
                    </div>
                  )}

                  <div className="space-y-3">
                    <button
                      type="button"
                      onClick={() => handleCopyPix(depositPaymentData.pix.payload)}
                      className="w-full py-5 bg-zinc-800 text-white rounded-2xl font-black uppercase tracking-widest text-[10px] hover:bg-zinc-700 transition-all flex items-center justify-center gap-2 border border-zinc-700"
                    >
                      <Copy className="w-4 h-4" /> Copiar Código PIX
                    </button>

                    {depositPaymentData?.url && (
                      <a
                        href={depositPaymentData.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="w-full py-5 bg-lime-400/5 text-lime-400 border border-lime-400/20 rounded-2xl font-black uppercase tracking-widest text-[10px] hover:bg-lime-400/10 transition-all flex items-center justify-center gap-2"
                      >
                        <ExternalLink className="w-4 h-4" /> Abrir no Navegador
                      </a>
                    )}
                  </div>
                </div>

                <div className="p-4 bg-zinc-800/50 border border-zinc-800 rounded-2xl text-center">
                  <p className="text-[10px] font-bold text-zinc-500 uppercase leading-relaxed">
                    Pagamento via PIX • R$ {parseFloat(depositAmount).toFixed(2)}
                  </p>
                </div>

                <button
                  onClick={() => setDepositPaymentData(null)}
                  className="w-full text-[10px] font-black text-zinc-600 uppercase tracking-widest hover:text-white transition-colors"
                >
                  Alterar Valor
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default CheckInPage;
