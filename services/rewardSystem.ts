import { collection, getDocs, query, where, doc, getDoc, addDoc, deleteDoc, serverTimestamp } from 'firebase/firestore';
import { db } from './firebase';
import { safeUpdateDoc } from './firebaseGuard';
import { UserStatus, User, CheckIn } from '../types';
import { sendAbsenceNotification } from './whatsapp';

// ---------------------------------------------------------------------------
// Date helpers
// ---------------------------------------------------------------------------

/** Get the "Effective Monday" of the current week.
 *  Adjusts to the NEXT week if it's Sunday after 22:00. */
export const getEffectiveMonday = (now: Date = new Date()): Date => {
  const day = now.getDay();
  const hours = now.getHours();
  const isAfterReset = day === 0 && hours >= 22;

  let diffToMonday: number;
  if (day === 0) {
    diffToMonday = isAfterReset ? 1 : -6;
  } else {
    diffToMonday = 1 - day;
  }

  const monday = new Date(now);
  monday.setDate(now.getDate() + diffToMonday);
  monday.setHours(0, 0, 0, 0);
  return monday;
};

/** Returns Mon-Fri ISO date strings of the current effective week. */
export const getWeekDays = (): string[] => {
  const monday = getEffectiveMonday();
  const days: string[] = [];
  for (let i = 0; i < 5; i++) {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    days.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`);
  }
  return days;
};

/** Returns today's ISO date string (local). */
const getLocalDate = (): string => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

/** Returns all Mon-Fri ISO date strings between two ISO strings (inclusive, up to now). */
export const getBusinessDays = (start: string, end: string): string[] => {
  const days: string[] = [];
  let current = new Date(start);
  const finish = new Date(end);
  const now = new Date();
  const actualEnd = finish > now ? now : finish;

  while (current <= actualEnd) {
    const dayOfWeek = current.getDay();
    if (dayOfWeek !== 0 && dayOfWeek !== 6) {
      days.push(current.toISOString().split('T')[0]);
    }
    current.setDate(current.getDate() + 1);
  }
  return days;
};

/** Parse a date from Firestore Timestamp, ISO string, or Date object. */
const parseDate = (dateVal: any): Date | null => {
  if (!dateVal) return null;
  if (dateVal instanceof Date) return dateVal;
  if (typeof dateVal === 'string') {
    const d = new Date(dateVal);
    return isNaN(d.getTime()) ? null : d;
  }
  if (typeof dateVal === 'object') {
    if (typeof dateVal.toDate === 'function') return dateVal.toDate();
    if (typeof dateVal.seconds === 'number') return new Date(dateVal.seconds * 1000);
  }
  const d = new Date(dateVal);
  return isNaN(d.getTime()) ? null : d;
};

// ---------------------------------------------------------------------------
// Wallet helpers
// ---------------------------------------------------------------------------

/**
 * Returns the current user wallet data from Firestore.
 */
const getUserWallet = async (userId: string): Promise<{ freeBalance: number; lockedBalance: number; coins: number } | null> => {
  const userRef = doc(db, 'users', userId);
  const snap = await getDoc(userRef);
  if (!snap.exists()) return null;
  const data = snap.data();
  return {
    freeBalance: data.freeBalance ?? data.balance ?? 0,
    lockedBalance: data.lockedBalance ?? 0,
    coins: data.coins ?? 0,
  };
};

// ---------------------------------------------------------------------------
// ABSENCE PENALTY – transfer R$5 per absence from freeBalance → lockedBalance
// ---------------------------------------------------------------------------

/**
 * Apply a single-day absence penalty to a user wallet.
 * Deducts `penaltyAmount` from freeBalance and adds it to lockedBalance.
 * Also logs a record in the `absences` collection for audit.
 */
const applyAbsencePenalty = async (
  user: User,
  day: string,
  penaltyAmount: number,
  absenceMessage?: string,
): Promise<void> => {
  const wallet = await getUserWallet(user.id);
  if (!wallet) return;

  const deductible = Math.min(wallet.freeBalance, penaltyAmount);

  await safeUpdateDoc('users', user.id, {
    freeBalance: wallet.freeBalance - deductible,
    lockedBalance: wallet.lockedBalance + deductible,
  });

  // Record the penalty in absences collection
  await addDoc(collection(db, 'absences'), {
    userId: user.id,
    date: day,
    penaltyAmount: deductible,
    reason: 'FALTA_DIA',
    createdAt: serverTimestamp(),
  });

  // WhatsApp notification
  if (user.phone) {
    sendAbsenceNotification(user.phone, user.name, day, penaltyAmount, absenceMessage)
      .catch(err => console.error(`Erro notificação ${user.name}:`, err));
  }
};

// ---------------------------------------------------------------------------
// COIN REWARDS – grant coins for daily check-in and full week bonus
// ---------------------------------------------------------------------------

const COINS_PER_CHECKIN = 10;
const COINS_FULL_WEEK_BONUS = 50;

/**
 * Grant coins to a user. Used after a successful check-in.
 */
export const grantCheckInCoins = async (userId: string, coins: number = COINS_PER_CHECKIN): Promise<void> => {
  const wallet = await getUserWallet(userId);
  if (!wallet) return;
  await safeUpdateDoc('users', userId, {
    coins: wallet.coins + coins,
  });
};

/**
 * Grant full-week bonus coins if user attended all 5 days.
 * Should be called at end of week (e.g., Friday evening or Sunday reset).
 */
export const grantFullWeekBonus = async (userId: string): Promise<void> => {
  const wallet = await getUserWallet(userId);
  if (!wallet) return;
  await safeUpdateDoc('users', userId, {
    coins: wallet.coins + COINS_FULL_WEEK_BONUS,
  });
};

// ---------------------------------------------------------------------------
// WEEKLY ABSENCE CHECK
// ---------------------------------------------------------------------------

/**
 * For each active user, verifies which business days (Mon-Fri) were missed this week
 * and applies the configured daily penalty amount by transferring it from
 * freeBalance → lockedBalance.
 *
 * This replaces the old pool distribution logic.
 */
export const runWeeklyPenaltyCheck = async () => {
  const today = getLocalDate();
  const weekDays = getWeekDays();
  const daysToCheck = weekDays.filter(d => d < today); // only past days

  if (daysToCheck.length === 0) {
    return { message: 'Sem dias passados para verificar nesta semana.', penalizedUsers: [] };
  }

  // Fetch penalty amount from settings
  const settingsRef = doc(db, 'settings', 'system');
  const settingsSnap = await getDoc(settingsRef);
  const settings = settingsSnap.exists() ? settingsSnap.data() : {};
  const dailyPenalty: number = settings.dailyLossAmount ?? 5.0;
  const absenceMessage: string | undefined = settings.absenceMessage;

  // Fetch active users
  const usersSnap = await getDocs(collection(db, 'users'));
  const activeUsers: User[] = usersSnap.docs
    .map(d => ({ id: d.id, ...d.data() } as User))
    .filter(u => (u.status as string) === UserStatus.ACTIVE || (u.status as string) === 'ativo' || (u.status as string) === 'active');

  // Fetch check-ins for the days we are checking
  const checkInsSnap = await getDocs(query(collection(db, 'checkIns'), where('date', 'in', daysToCheck)));
  const allCheckIns: CheckIn[] = checkInsSnap.docs.map(d => ({ id: d.id, ...d.data() } as CheckIn));

  // Fetch already-logged absences for this week to avoid double-penalizing
  const absencesSnap = await getDocs(query(collection(db, 'absences'), where('date', 'in', daysToCheck)));
  const loggedAbsences = new Set(
    absencesSnap.docs.map(d => `${d.data().userId}__${d.data().date}`)
  );

  const penalizedUsers: string[] = [];

  for (const user of activeUsers) {
    const registrationDate = parseDate(user.createdAt);
    if (registrationDate) registrationDate.setHours(0, 0, 0, 0);

    const activeDays = daysToCheck.filter(day => {
      if (!registrationDate) return true;
      const [y, m, d] = day.split('-').map(Number);
      const dayDate = new Date(y, m - 1, d);
      dayDate.setHours(0, 0, 0, 0);
      return dayDate > registrationDate; // only after registration
    });

    if (activeDays.length === 0) continue;

    const userCheckIns = allCheckIns.filter(c => c.userId === user.id);
    const presentDays = new Set(userCheckIns.map(c => c.date));

    for (const day of activeDays) {
      if (presentDays.has(day)) continue; // attended – no penalty
      if (loggedAbsences.has(`${user.id}__${day}`)) continue; // already penalized

      await applyAbsencePenalty(user, day, dailyPenalty, absenceMessage);
      penalizedUsers.push(`${user.name} (${day})`);
    }

    // Update weeklyMisses count
    const misses = activeDays.filter(d => !presentDays.has(d)).length;
    await safeUpdateDoc('users', user.id, { weeklyMisses: misses });
  }

  return { message: 'Verificação semanal concluída.', penalizedUsers };
};

// ---------------------------------------------------------------------------
// FULL WEEK BONUS CHECK (run at end of week)
// ---------------------------------------------------------------------------

/**
 * For each active user, checks if they completed all 5 days of the week.
 * If so, grants COINS_FULL_WEEK_BONUS extra coins.
 * Should be called once per week (e.g., Sunday reset or Friday night cron).
 */
export const runWeeklyBonusCheck = async () => {
  const weekDays = getWeekDays();
  const today = getLocalDate();
  // Only evaluate completed weeks (all 5 days must be in the past)
  const allPast = weekDays.every(d => d < today);
  if (!allPast) {
    return { message: 'Semana ainda não concluída. Bônus não aplicado.' };
  }

  const usersSnap = await getDocs(collection(db, 'users'));
  const activeUsers: User[] = usersSnap.docs
    .map(d => ({ id: d.id, ...d.data() } as User))
    .filter(u => (u.status as string) === UserStatus.ACTIVE || (u.status as string) === 'ativo' || (u.status as string) === 'active');

  const checkInsSnap = await getDocs(query(collection(db, 'checkIns'), where('date', 'in', weekDays)));
  const allCheckIns: CheckIn[] = checkInsSnap.docs.map(d => ({ id: d.id, ...d.data() } as CheckIn));

  const bonusRecipients: string[] = [];

  for (const user of activeUsers) {
    const registrationDate = parseDate(user.createdAt);
    if (registrationDate) registrationDate.setHours(0, 0, 0, 0);

    // User must have been active for all 5 days to be eligible
    const eligibleDays = weekDays.filter(day => {
      if (!registrationDate) return true;
      const [y, m, d] = day.split('-').map(Number);
      return new Date(y, m - 1, d) > registrationDate;
    });

    if (eligibleDays.length < 5) continue; // registered mid-week – not eligible

    const presentDays = new Set(
      allCheckIns.filter(c => c.userId === user.id).map(c => c.date)
    );
    const attended = eligibleDays.filter(d => presentDays.has(d)).length;

    if (attended === 5) {
      await grantFullWeekBonus(user.id);
      bonusRecipients.push(user.name);
    }
  }

  return { message: 'Bônus de semana completa aplicado.', bonusRecipients };
};

// ---------------------------------------------------------------------------
// SYNC USER ABSENCES (used on profile load for self-correction)
// ---------------------------------------------------------------------------

/**
 * Syncs absence penalties for a single user.
 * Checks all business days since registration up to yesterday and applies
 * any missing penalties without double-counting.
 */
export const syncUserAbsences = async (userId: string, fullSync: boolean = false): Promise<boolean> => {
  const today = getLocalDate();
  let daysToCheck: string[] = [];

  const userRef = doc(db, 'users', userId);
  const userDoc = await getDoc(userRef);
  if (!userDoc.exists()) return false;
  const user = { id: userDoc.id, ...userDoc.data() } as User;

  if ((user.status as string) !== UserStatus.ACTIVE && (user.status as string) !== 'ativo' && (user.status as string) !== 'active') return false;

  if (fullSync) {
    const registrationDate = parseDate(user.createdAt);
    if (registrationDate) {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      daysToCheck = getBusinessDays(registrationDate.toISOString().split('T')[0], yesterday.toISOString().split('T')[0]);
    } else {
      const weekDays = getWeekDays();
      daysToCheck = weekDays.filter(d => d < today);
    }
  } else {
    const weekDays = getWeekDays();
    daysToCheck = weekDays.filter(d => d < today);
  }

  if (daysToCheck.length === 0) return false;

  try {
    // Fetch check-ins
    const checkInsSnap = await getDocs(query(collection(db, 'checkIns'), where('userId', '==', userId)));
    const presentDays = new Set(checkInsSnap.docs.map(d => d.data().date as string));

    // Fetch already-logged absences to avoid double-penalizing
    const absencesSnap = await getDocs(query(collection(db, 'absences'), where('userId', '==', userId)));
    const loggedAbsenceDates = new Set(absencesSnap.docs.map(d => d.data().date as string));

    const settingsRef = doc(db, 'settings', 'system');
    const settingsSnap = await getDoc(settingsRef);
    const settings = settingsSnap.exists() ? settingsSnap.data() : {};
    const dailyPenalty: number = settings.dailyLossAmount ?? 5.0;
    const absenceMessage: string | undefined = settings.absenceMessage;

    const registrationDate = parseDate(user.createdAt);
    if (registrationDate) registrationDate.setHours(0, 0, 0, 0);

    let applied = false;

    for (const day of daysToCheck) {
      if (presentDays.has(day)) continue;
      if (loggedAbsenceDates.has(day)) continue;

      // Skip day of registration or before
      if (registrationDate) {
        const [y, m, d] = day.split('-').map(Number);
        const dayDate = new Date(y, m - 1, d);
        dayDate.setHours(0, 0, 0, 0);
        if (dayDate <= registrationDate) continue;
      }

      await applyAbsencePenalty(user, day, dailyPenalty, absenceMessage);
      applied = true;
    }

    return applied;
  } catch (error) {
    console.error(`Error syncing absences for user ${userId}:`, error);
    return false;
  }
};

/** Syncs absences for ALL active users. */
export const syncAllUsersAbsences = async (fullSync: boolean = false) => {
  const usersSnap = await getDocs(collection(db, 'users'));
  const activeUsers = usersSnap.docs
    .map(d => ({ id: d.id, ...d.data() } as User))
    .filter(u => (u.status as string) === UserStatus.ACTIVE || (u.status as string) === 'ativo' || (u.status as string) === 'active');

  let adjustedCount = 0;
  for (const user of activeUsers) {
    const wasAdjusted = await syncUserAbsences(user.id, fullSync);
    if (wasAdjusted) adjustedCount++;
  }
  return { success: true, count: activeUsers.length, adjustedCount };
};
