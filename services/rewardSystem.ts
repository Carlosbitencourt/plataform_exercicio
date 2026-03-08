import { collection, getDocs, query, where, Timestamp, doc, getDoc, updateDoc, deleteDoc } from 'firebase/firestore';
import { db } from './firebase';
import { safeUpdateDoc } from './firebaseGuard';
import { addDistribution } from './db';
import { UserStatus, User, CheckIn, Distribution } from '../types';
import { sendAbsenceNotification } from './whatsapp';

// Helper to get Mon-Fri dates of current week (Monday to Friday)
export const getWeekDays = () => {
  const now = new Date();
  const day = now.getDay(); // Sun=0, Mon=1...

  // Calculate Monday of current week
  // If today is Sunday (0), we go back 6 days to Monday
  const diffToMonday = day === 0 ? -6 : 1 - day;

  const monday = new Date(now);
  monday.setDate(now.getDate() + diffToMonday);
  monday.setHours(0, 0, 0, 0);

  const days = [];
  for (let i = 0; i < 5; i++) {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    days.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`);
  }
  return days;
};

// Helper for today
const getLocalDate = () => {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

// Helper to get all Mon-Fri dates between two ISO strings
export const getBusinessDays = (start: string, end: string) => {
  const days = [];
  let current = new Date(start);
  const finish = new Date(end);

  // Ensure we don't go into an infinite loop or check future
  const now = new Date();
  const actualEnd = finish > now ? now : finish;

  while (current <= actualEnd) {
    const dayOfWeek = current.getDay();
    if (dayOfWeek !== 0 && dayOfWeek !== 6) { // Not Sat or Sun
      days.push(current.toISOString().split('T')[0]);
    }
    current.setDate(current.getDate() + 1);
  }
  return days;
};

export const runWeeklyPenaltyCheck = async () => {
  const today = getLocalDate();
  const weekDays = getWeekDays();

  // Filter only days up to today (inclusive) to avoid future penalties if run mid-week
  const daysToCheck = weekDays.filter(d => d <= today);

  if (daysToCheck.length === 0) return { message: "Sem dias válidos para verificar na semana (Seg-Sex).", absentCount: 0, totalPenalized: 0, penalizedUsers: [] };

  let totalPenalized = 0;
  const penalizedUsers: string[] = [];

  try {
    // 1. Fetch active users (handle multiple possible "active" status strings)
    const usersSnapForPenalty = await getDocs(collection(db, 'users'));
    const activeUsers: User[] = usersSnapForPenalty.docs
      .map(doc => ({ id: doc.id, ...doc.data() } as User))
      .filter(u => (u.status as string) === UserStatus.ACTIVE || (u.status as string) === 'ativo' || (u.status as string) === 'active');

    // 2. Fetch all check-ins for the relevant days
    const checkInsSnap = await getDocs(query(collection(db, 'checkIns'), where('date', 'in', daysToCheck)));
    const allCheckIns: CheckIn[] = checkInsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as CheckIn));

    for (const user of activeUsers) {
      const registrationDate = user.createdAt ? new Date(user.createdAt) : null;
      if (registrationDate) {
        registrationDate.setHours(0, 0, 0, 0);
      }

      const activeDaysToCheck = daysToCheck.filter(day => {
        // Removido o filtro de data de cadastro para que o pool da semana seja completo para todos os ativos
        /*
        if (!registrationDate) return true;
        const [y, m, d] = day.split('-').map(Number);
        const dayDate = new Date(y, m - 1, d);
        dayDate.setHours(0, 0, 0, 0);
        return dayDate >= registrationDate;
        */
        return true;
      });

      if (activeDaysToCheck.length === 0) continue;

      // Get user check-ins for the days we are checking
      const userCheckIns = allCheckIns.filter(c => c.userId === user.id);
      const presentDays = new Set(userCheckIns.map(c => c.date));

      // Misses = Expected - Present
      const misses = activeDaysToCheck.length - activeDaysToCheck.filter(d => presentDays.has(d)).length;

      let actualPenalty = 0;
      if (misses > 0) {
        const penaltyValue = misses * 10.0; // Fixed penalty R$ 10.00 per missing day
        actualPenalty = Math.min(user.balance, penaltyValue);

        if (actualPenalty > 0) {
          totalPenalized += actualPenalty;
          penalizedUsers.push(user.name);

          // Deduct from balance
          const newBalance = user.balance - actualPenalty;

          await safeUpdateDoc('users', user.id, {
            balance: newBalance,
            weeklyMisses: misses
          });

          // Log distribution as penalty (negative)
          await addDistribution({
            userId: user.id,
            amount: -actualPenalty,
            date: today,
            reason: `FALTAS SEMANA (${misses} dias)`,
            createdAt: new Date().toISOString()
          } as any);
        } else {
          await safeUpdateDoc('users', user.id, { weeklyMisses: misses });
        }
      } else {
        // Zero misses
        await safeUpdateDoc('users', user.id, { weeklyMisses: 0 });
      }
    }

    return {
      message: "Verificação Semanal Concluída.",
      absentCount: penalizedUsers.length,
      totalPenalized,
      penalizedUsers
    };
  } catch (error) {
    console.error("Error running weekly penalty check:", error);
    throw error;
  }
};

export const closeWeeklySession = async () => {
  const today = getLocalDate();

  try {
    // 1. First, sync all absences to ensure all penalties are applied before we calculate the pool
    // This uses the existing logic that checks business days up to yesterday
    console.log("[CLOSE_WEEKLY] Syncing all absences...");
    await syncAllUsersAbsences(false);

    // 2. Fetch fresh user data after penalties
    const weekDays = getWeekDays();
    const usersSnapForPool = await getDocs(collection(db, 'users'));
    const activeUsers: User[] = usersSnapForPool.docs
      .map(doc => ({ id: doc.id, ...doc.data() } as User))
      .filter(u => (u.status as string) === UserStatus.ACTIVE || (u.status as string) === 'ativo' || (u.status as string) === 'active');

    // 3. Calculate Pool based on penalties applied this week
    // We get all distributions from this week that are negative (penalties)
    const weekStart = weekDays[0];
    const distQuery = query(
      collection(db, 'distributions'),
      where('date', '>=', weekStart),
      where('date', '<=', today)
    );
    const distSnapForPool = await getDocs(distQuery);
    const weeklyPool = distSnapForPool.docs
      .map(doc => doc.data() as Distribution)
      .filter(d => d.amount < 0)
      .reduce((acc, d) => acc + Math.abs(d.amount), 0);

    console.log(`[CLOSE_WEEKLY] Pool calculated from penalties: R$ ${weeklyPool.toFixed(2)}`);

    if (weeklyPool <= 0.01) {
      // No money to distribute. Just reset.
      console.log("[CLOSE_WEEKLY] Empty pool. Resetting scores only.");
      for (const user of activeUsers) {
        await safeUpdateDoc('users', user.id, { weeklyMisses: 0, weeklyScore: 0 });
      }
      return { message: "Sem saldo no pool para distribuir. Semana reiniciada.", poolDistributed: 0 };
    }

    // 4. Identify eligible users (those who scored points)
    const eligibleUsers = activeUsers.filter(u => (u.weeklyScore || 0) > 0);

    if (eligibleUsers.length === 0) {
      console.log("[CLOSE_WEEKLY] No eligible users. Resetting scores.");
      for (const user of activeUsers) {
        await safeUpdateDoc('users', user.id, { weeklyMisses: 0, weeklyScore: 0 });
      }
      return { message: "Nenhum atleta pontuou. Pool retido e semana reiniciada.", poolDistributed: 0 };
    }

    // 5. Calculate proportional distribution
    const totalWeeklyScore = eligibleUsers.reduce((acc, u) => acc + (u.weeklyScore || 0), 0);
    const valuePerPoint = weeklyPool / totalWeeklyScore;

    console.log(`[CLOSE_WEEKLY] Distributing to ${eligibleUsers.length} users. Value per point: R$ ${valuePerPoint.toFixed(4)}`);
    for (const user of activeUsers) {
      const isEligible = (user.weeklyScore || 0) > 0;
      const userScore = user.weeklyScore || 0;
      const share = isEligible ? userScore * valuePerPoint : 0;

      if (share > 0) {
        // Update balance (points are reset for everyone below)
        await safeUpdateDoc('users', user.id, {
          balance: (user.balance || 0) + share
        });

        await addDistribution({
          userId: user.id,
          amount: share,
          date: today,
          reason: `DISTRIBUIÇÃO PROPORCIONAL (${userScore} pts)`,
          createdAt: new Date().toISOString()
        } as any);
      }
    }

    // 6. Final Reset for ALL users (regardless of status, points, etc.)
    // This ensures next week starts fresh for everyone.
    const usersSnapForReset = await getDocs(collection(db, 'users'));
    for (const uDoc of usersSnapForReset.docs) {
      await safeUpdateDoc('users', uDoc.id, {
        weeklyScore: 0,
        weeklyMisses: 0
      });
    }

    return {
      message: "Fechamento de semana concluído com sucesso!",
      poolDistributed: weeklyPool,
      recipientsCount: eligibleUsers.length
    };
  } catch (error) {
    console.error("Error closing weekly session:", error);
    throw error;
  }
};

// Helper to parse dates from various formats (String, Timestamp, Date)
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

export const syncUserAbsences = async (userId: string, fullSync: boolean = false): Promise<boolean> => {
  const today = getLocalDate();
  let daysToCheck: string[] = [];

  if (fullSync) {
    // 1. Fetch user first to get registration date
    const userRef = doc(db, 'users', userId);
    const userDoc = await getDoc(userRef);
    if (!userDoc.exists()) return false;
    const user = { id: userDoc.id, ...userDoc.data() } as User;

    const registrationDate = parseDate(user.createdAt);
    if (registrationDate) {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const yesterdayStr = yesterday.toISOString().split('T')[0];
      const registrationStr = registrationDate.toISOString().split('T')[0];
      daysToCheck = getBusinessDays(registrationStr, yesterdayStr);
    } else {
      // Fallback to current week if no registration date
      const weekDays = getWeekDays();
      daysToCheck = weekDays.filter(d => d < today);
    }
  } else {
    const weekDays = getWeekDays();
    daysToCheck = weekDays.filter(d => d < today); // Strictly past days of current week
  }

  if (daysToCheck.length === 0) return false;

  try {
    // 1. Fetch user directly by ID
    const userRef = doc(db, 'users', userId);
    const userDoc = await getDoc(userRef);
    if (!userDoc.exists()) return false;
    const user = { id: userDoc.id, ...userDoc.data() } as User;

    if ((user.status as string) !== UserStatus.ACTIVE && (user.status as string) !== 'ativo' && (user.status as string) !== 'active') return false;

    // 2. Fetch ALL check-ins and distributions for the user
    // We use a broader query to ensure we have all history for consistency checks
    const [checkInsSnap, distSnap] = await Promise.all([
      getDocs(query(collection(db, 'checkIns'), where('userId', '==', userId))),
      getDocs(query(collection(db, 'distributions'), where('userId', '==', userId)))
    ]);

    const userCheckIns = checkInsSnap.docs.map(doc => doc.data() as CheckIn);
    const presentDays = new Set(userCheckIns.map(c => c.date));

    // Map of distributions to their IDs for deletion if invalid
    const distributions = distSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Distribution));

    const penaltyDaysMap = new Map<string, string>(); // date -> distributionId
    let hasLegacyBulkPenalty = false;
    let legacyBulkPenaltyId = "";

    distributions.forEach(d => {
      if (d.reason.startsWith('FALTA:')) {
        const datePart = d.reason.split(':')[1];
        if (datePart) penaltyDaysMap.set(datePart, d.id);
      }
      if (d.reason.includes('FALTAS SEMANA')) {
        hasLegacyBulkPenalty = true;
        legacyBulkPenaltyId = d.id;
      }
    });

    const registrationDate = parseDate(user.createdAt);
    if (registrationDate) {
      registrationDate.setHours(0, 0, 0, 0);
    }

    console.log(`[SYNC] Atleta: ${user.name} | Cadastro: ${registrationDate?.toISOString()}`);

    let balanceAdjustment = 0;
    const itemsToDelete: string[] = [];

    // --- SELF-CORRECTION: Identify and Remove Invalid Penalties ---

    // If a legacy bulk penalty exists, it's safer to remove it and let the daily sync rebuild correctly
    // or if the user joined mid-week, the bulk penalty is almost certainly wrong.
    if (hasLegacyBulkPenalty) {
      const dist = distributions.find(d => d.id === legacyBulkPenaltyId);
      if (dist) {
        console.log(`[SYNC] Removendo penalidade em massa legada (${dist.amount}) para correção diária.`);
        balanceAdjustment -= dist.amount; // dist.amount is negative, so this adds it back
        itemsToDelete.push(legacyBulkPenaltyId);
      }
    }

    // Check individual daily penalties
    for (const [pDate, distId] of penaltyDaysMap.entries()) {
      let isInvalid = false;

      // 1. Check if user was actually present
      if (presentDays.has(pDate)) {
        console.log(`[SYNC] Penalidade INVÁLIDA para ${pDate}: Atleta compareceu.`);
        isInvalid = true;
      }

      // 2. Check if penalty is for a day before registration
      if (registrationDate) {
        const [y, m, d] = pDate.split('-').map(Number);
        const dayDate = new Date(y, m - 1, d);
        dayDate.setHours(0, 0, 0, 0);
        if (dayDate < registrationDate) {
          console.log(`[SYNC] Penalidade INVÁLIDA para ${pDate}: Antes do cadastro.`);
          isInvalid = true;
        }
      }

      if (isInvalid) {
        const dist = distributions.find(d => d.id === distId);
        if (dist) {
          balanceAdjustment -= dist.amount; // dist.amount is negative, adds it back
          itemsToDelete.push(distId);
        }
      }
    }

    // --- APPLY MISSING PENALTIES ---
    const missingPenaltyDays: string[] = [];
    for (const day of daysToCheck) {
      // Skip if penalty already exists (and wasn't marked for deletion)
      if (penaltyDaysMap.has(day) && !itemsToDelete.includes(penaltyDaysMap.get(day)!)) continue;

      // Skip if present
      if (presentDays.has(day)) continue;

      // Removido filtro de data de cadastro para sincronização semanal completa
      /*
      if (registrationDate) {
        const [y, m, d] = day.split('-').map(Number);
        const dayDate = new Date(y, m - 1, d);
        dayDate.setHours(0, 0, 0, 0);
        if (dayDate < registrationDate) continue;
      }
      */

      missingPenaltyDays.push(day);
    }

    // Process deletions
    for (const id of itemsToDelete) {
      // Import deleteDoc dynamically or use local reference if possible
      // Since we already have the ID, we can use the ref
      const { deleteDoc: firestoreDelete } = await import('firebase/firestore');
      await firestoreDelete(doc(db, 'distributions', id));
    }

    // Process additions
    for (const day of missingPenaltyDays) {
      const penalty = 10.0;
      balanceAdjustment -= penalty;
      await addDistribution({
        userId: userId,
        amount: -penalty,
        date: day,
        reason: `FALTA:${day}`,
        createdAt: new Date().toISOString()
      } as any);

      if (user.phone) {
        sendAbsenceNotification(user.phone, user.name, day)
          .catch(err => console.error(`Erro notificação ${user.name}:`, err));
      }
    }

    // Final balance update
    if (balanceAdjustment !== 0 || itemsToDelete.length > 0 || missingPenaltyDays.length > 0) {
      const freshSnap = await getDoc(userRef);
      const freshBalance = freshSnap.data()?.balance || 0;
      const newBalance = Math.max(0, freshBalance + balanceAdjustment);
      console.log(`[SYNC] Corrigindo saldo de ${user.name}: ${freshBalance} -> ${newBalance}`);

      await safeUpdateDoc('users', userId, {
        balance: newBalance,
        weeklyMisses: Math.max(0, Array.from(penaltyDaysMap.keys()).filter(d => !itemsToDelete.includes(penaltyDaysMap.get(d)!)).length + missingPenaltyDays.length)
      });
      return true;
    }

    return false;
  } catch (error) {
    console.error(`Error syncing absences for user ${userId}:`, error);
    return false;
  }
};

export const syncAllUsersAbsences = async (fullSync: boolean = false) => {
  try {
    const usersSnapForSyncAll = await getDocs(collection(db, 'users'));
    const activeUsers = usersSnapForSyncAll.docs
      .map(doc => ({ id: doc.id, ...doc.data() } as User))
      .filter(u => (u.status as string) === UserStatus.ACTIVE || (u.status as string) === 'ativo' || (u.status as string) === 'active')
      .map(u => u.id);

    console.log(`Syncing absences for ${activeUsers.length} users (FullSync: ${fullSync})...`);
    let adjustedCount = 0;
    for (const userId of activeUsers) {
      const wasAdjusted = await syncUserAbsences(userId, fullSync);
      if (wasAdjusted) adjustedCount++;
    }
    return { success: true, count: activeUsers.length, adjustedCount };
  } catch (error) {
    console.error("Error syncing all users absences:", error);
    throw error;
  }
};

export const fixWeeklyDistribution = async (
  participants: { id: string, score: number, name: string }[],
  oldPool: number,
  newPool: number
) => {
  const totalScore = participants.reduce((sum, p) => sum + p.score, 0);
  const today = new Date().toISOString().split('T')[0];

  console.log(`[FIX] Starting correction: ${oldPool} -> ${newPool} (Total Score: ${totalScore})`);

  for (const p of participants) {
    const oldShare = parseFloat((p.score * (oldPool / totalScore)).toFixed(2));
    const newShare = parseFloat((p.score * (newPool / totalScore)).toFixed(2));
    const diff = parseFloat((newShare - oldShare).toFixed(2));

    const { doc, getDoc, updateDoc, collection, query, where, getDocs } = await import('firebase/firestore');
    const { db } = await import('./firebase');
    
    const userRef = doc(db, 'users', p.id);
    const userSnap = await getDoc(userRef);
    if (!userSnap.exists()) continue;

    const currentBalance = userSnap.data().balance || 0;
    
    // 1. Update Distribution Records for today
    const distQuery = query(
      collection(db, 'distributions'),
      where('userId', '==', p.id),
      where('date', '==', today),
      where('amount', '==', oldShare)
    );
    const distSnap = await getDocs(distQuery);
    
    let distUpdated = false;
    for (const dDoc of distSnap.docs) {
      await updateDoc(doc(db, 'distributions', dDoc.id), {
        amount: newShare,
        reason: `DISTRIBUIÇÃO PROPORCIONAL (${p.score} pts) - CORRIGIDA`
      });
      distUpdated = true;
    }

    // 2. Update User Balance if needed
    if (distUpdated || Math.abs(currentBalance - (oldShare + 10)) < 1) {
       const newBalance = Math.max(0, currentBalance + diff);
       await updateDoc(userRef, { balance: newBalance });
       console.log(`[FIX] Updated ${p.name}: Balance ${currentBalance} -> ${newBalance}`);
    }
  }
  return true;
};
