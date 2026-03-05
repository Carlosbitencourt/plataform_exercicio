import { collection, getDocs, query, where, Timestamp, doc, getDoc } from 'firebase/firestore';
import { db } from './firebase';
import { safeUpdateDoc } from './firebaseGuard';
import { addDistribution } from './db';
import { UserStatus, User, CheckIn, Distribution } from '../types';
import { sendAbsenceNotification } from './whatsapp';

// Helper to get Mon-Fri dates of current week
const getWeekDays = () => {
  const curr = new Date();
  const day = curr.getDay(); // Sun=0, Mon=1...
  // Shift to start from Monday
  const diff = curr.getDate() - day + (day === 0 ? -6 : 1);
  const mon = new Date(curr.setDate(diff));

  const days = [];
  for (let i = 0; i < 5; i++) {
    const d = new Date(mon);
    d.setDate(mon.getDate() + i);
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

export const runWeeklyPenaltyCheck = async () => {
  const today = getLocalDate();
  const weekDays = getWeekDays();

  // Filter only days up to today (inclusive) to avoid future penalties if run mid-week
  const daysToCheck = weekDays.filter(d => d <= today);

  if (daysToCheck.length === 0) return { message: "Sem dias válidos para verificar na semana (Seg-Sex).", absentCount: 0, totalPenalized: 0, penalizedUsers: [] };

  let totalPenalized = 0;
  const penalizedUsers: string[] = [];

  try {
    // 1. Fetch active users
    const usersSnap = await getDocs(query(collection(db, 'users'), where('status', '==', UserStatus.ACTIVE)));
    const activeUsers: User[] = usersSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as User));

    // 2. Fetch all check-ins for the relevant days
    const checkInsSnap = await getDocs(query(collection(db, 'checkIns'), where('date', 'in', daysToCheck)));
    const allCheckIns: CheckIn[] = checkInsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as CheckIn));

    for (const user of activeUsers) {
      // Get user check-ins for the days we are checking
      const userCheckIns = allCheckIns.filter(c => c.userId === user.id);
      const presentDays = new Set(userCheckIns.map(c => c.date));

      // Misses = Expected - Present
      const misses = daysToCheck.length - presentDays.size;

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

export const runWeeklyDistribution = async () => {
  const today = getLocalDate();

  try {
    // 1. Fetch active users
    const usersSnap = await getDocs(query(collection(db, 'users'), where('status', '==', UserStatus.ACTIVE)));
    const activeUsers: User[] = usersSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as User));

    // Calcular o Pool (Soma das penalidades da semana)
    // O Pool é a diferença entre o que foi depositado e o saldo atual dos ativos
    // Alternativa: Somar da colecao distributions. Mas A matemática básica Deposited - Balance já compõe o pool perfeitamente nessa regra.
    const totalDeposited = activeUsers.reduce((acc, u) => acc + u.depositedValue, 0);
    const currentTotalBalance = activeUsers.reduce((acc, u) => acc + u.balance, 0);

    const weeklyPool = totalDeposited - currentTotalBalance;

    if (weeklyPool <= 0.01) {
      // Ninguem perdeu pontos/dinheiro. Reset geral
      const resetPromises = activeUsers.map(user =>
        safeUpdateDoc('users', user.id, { weeklyMisses: 0, weeklyScore: 0 })
      );
      await Promise.all(resetPromises);
      return { message: "Nenhum valor no pool para distribuir. Semana reiniciada." };
    }

    // Distribuição baseada em WEEKLY SCORE (Pontos > 0)
    const eligibleUsers = activeUsers.filter(u => (u.weeklyScore || 0) > 0);

    if (eligibleUsers.length === 0) {
      // Pool retido (Casa ganha ou Acumula)
      const resetPromises = activeUsers.map(user =>
        safeUpdateDoc('users', user.id, { weeklyMisses: 0, weeklyScore: 0 })
      );
      await Promise.all(resetPromises);
      return { message: "Nenhum atleta pontuou na semana. Pool retido e semana reiniciada." };
    }

    const totalWeeklyScore = eligibleUsers.reduce((acc, u) => acc + (u.weeklyScore || 0), 0);
    const valuePerPoint = weeklyPool / totalWeeklyScore;

    for (const user of eligibleUsers) {
      const userScore = user.weeklyScore || 0;
      const share = userScore * valuePerPoint;

      await safeUpdateDoc('users', user.id, {
        balance: user.balance + share,
        weeklyScore: 0, // Reset for next week
        weeklyMisses: 0
      });

      await addDistribution({
        userId: user.id,
        amount: share,
        date: today,
        reason: `DISTRIBUIÇÃO SEMANAL (${userScore} pts)`,
        createdAt: new Date().toISOString()
      } as any);
    }

    // Reset the non-eligible users
    const zeroScoreUsers = activeUsers.filter(u => (u.weeklyScore || 0) === 0);
    for (const user of zeroScoreUsers) {
      await safeUpdateDoc('users', user.id, { weeklyScore: 0, weeklyMisses: 0 });
    }

    return {
      message: "Distribuição Semanal Concluída!",
      poolDistributed: weeklyPool,
      recipientsCount: eligibleUsers.length
    };

  } catch (error) {
    console.error("Error distributing pool:", error);
    throw error;
  }
};
export const syncUserAbsences = async (userId: string) => {
  const today = getLocalDate();
  const weekDays = getWeekDays();
  const daysToCheck = weekDays.filter(d => d < today); // Strictly past days of current week

  if (daysToCheck.length === 0) return;

  try {
    // 1. Fetch user
    // 1. Fetch user directly by ID
    const userRef = doc(db, 'users', userId);
    const userDoc = await getDoc(userRef);
    if (!userDoc.exists()) return;
    const user = { id: userDoc.id, ...userDoc.data() } as User;

    if (user.status !== UserStatus.ACTIVE) return;

    // 2. Fetch check-ins for the user this week
    const checkInsSnap = await getDocs(query(
      collection(db, 'checkIns'),
      where('userId', '==', userId),
      where('date', 'in', daysToCheck)
    ));
    const userCheckIns = checkInsSnap.docs.map(doc => doc.data() as CheckIn);
    const presentDays = new Set(userCheckIns.map(c => c.date));

    // 3. Fetch existing absence distributions for this week
    const distSnap = await getDocs(query(
      collection(db, 'distributions'),
      where('userId', '==', userId),
      where('date', 'in', daysToCheck)
    ));
    const existingPenaltyDates = new Set(
      distSnap.docs
        .map(doc => doc.data() as Distribution)
        .filter(d => d.reason.startsWith('FALTA:'))
        .map(d => d.reason.split(':')[1])
    );

    let newPenalties = 0;
    for (const day of daysToCheck) {
      if (!presentDays.has(day) && !existingPenaltyDates.has(day)) {
        // Apply penalty for this specific day
        const penalty = Math.min(user.balance - newPenalties, 10.0);
        if (penalty > 0) {
          newPenalties += penalty;
          await addDistribution({
            userId: userId,
            amount: -penalty,
            date: day, // Set specifically to the missed day
            reason: `FALTA:${day}`,
            createdAt: new Date().toISOString()
          } as any);

          // Enviar notificação de falta via WhatsApp
          if (user.phone) {
            sendAbsenceNotification(user.phone, user.name, day)
              .catch(err => console.error(`Erro ao enviar notificação de falta para ${user.name}:`, err));
          }
        }
      }
    }

    if (newPenalties > 0) {
      // Only reduce balance if it hasn't been reduced already for these specific penalties
      // To be safe, we calculate what the balance should be: current balance - newly added penalties
      const currentBalance = user.balance || 0;
      await safeUpdateDoc('users', userId, {
        balance: currentBalance - newPenalties
      });
    }

  } catch (error) {
    console.error(`Error syncing absences for user ${userId}:`, error);
  }
};

export const syncAllUsersAbsences = async () => {
  try {
    const usersSnap = await getDocs(query(collection(db, 'users'), where('status', '==', UserStatus.ACTIVE)));
    const activeUsers = usersSnap.docs.map(doc => doc.id);

    console.log(`Syncing absences for ${activeUsers.length} users...`);
    for (const userId of activeUsers) {
      await syncUserAbsences(userId);
    }
    return { success: true, count: activeUsers.length };
  } catch (error) {
    console.error("Error syncing all users absences:", error);
    throw error;
  }
};
