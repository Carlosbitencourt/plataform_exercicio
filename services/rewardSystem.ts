
import { getDB, saveDB, addDistribution, getLocalDate } from './storage';
import { WEEKLY_GOAL } from '../constants';
import { UserStatus, User } from '../types';

export const calculateCheckInScore = (timeSlotId: string, depositedValue: number): number => {
  const db = getDB();
  const slot = db.timeSlots.find(s => s.id === timeSlotId);
  if (!slot) return 0;

  const weight = slot.weight;
  const bonus = depositedValue / 10;
  return weight + bonus;
};

// --- New Progressive Penalty System ---

export const calculatePenalty = (user: User): number => {
  // Regra 1: Valor fixo de R$ 10,00 por falta
  const fixedPenalty = 10.0;

  // Kill Switch: Se faltar 4 vezes, perde tudo (mantido da regra original se desejado, ou simplificado?)
  // O prompt diz: "Toda vez que o usuário não fazer check in em um dia ele perde R$ 10,00 d valor dele"
  // Não mencionou explicitamente o Kill Switch de 4 faltas aqui, mas é feature existente.
  // Vou MANTER o Kill Switch por segurança/regra anterior, mas a penalidade base é 10.

  if ((user.weeklyMisses || 0) >= 4) {
    return user.balance; // Perde o que restou (Kill Switch)
  }

  return fixedPenalty;
};

// Helper to get Mon-Fri dates of current week
const getWeekDays = () => {
  const curr = new Date();
  const day = curr.getDay() || 7; // Sun=7, Mon=1...
  const mon = new Date(curr);
  mon.setDate(curr.getDate() - day + 1);

  const days = [];
  for (let i = 0; i < 5; i++) {
    const d = new Date(mon);
    d.setDate(mon.getDate() + i);
    days.push(d.toISOString().split('T')[0]);
  }
  return days;
};

export const runWeeklyPenaltyCheck = () => {
  const db = getDB();
  const today = getLocalDate();

  const activeUsers = db.users.filter(u => u.status === UserStatus.ACTIVE);
  const weekDays = getWeekDays();

  // Filter only days up to today (inclusive) to avoid future penalties if run mid-week
  // User asked for "Weekly", usually run on Sunday, but safe to check range.
  const daysToCheck = weekDays.filter(d => d <= today);

  if (daysToCheck.length === 0) return { message: "Sem dias para verificar na semana.", absentCount: 0, totalPenalized: 0, penalizedUsers: [] };

  let totalPenalized = 0;
  const penalizedUsers: string[] = [];

  activeUsers.forEach(user => {
    // Get user check-ins for the week
    const userCheckIns = db.checkIns.filter(c => c.userId === user.id && daysToCheck.includes(c.date));
    const presentDays = new Set(userCheckIns.map(c => c.date));

    // Misses = Expected - Present
    const misses = daysToCheck.length - presentDays.size;

    // Update weeklyMisses for record
    user.weeklyMisses = misses;

    if (misses > 0) {
      const penalty = misses * 10.0;
      // Kill Switch Logic from previous: If misses >= 4, lose everything?
      // Prompt says: "Toda vez... perde R$ 10,00".
      // Example found in code: "If misses >= 4, return user.balance".
      // User didn't revoke Kill Switch, but explicitly asked for R$ 10 logic.
      // I will apply R$ 10 per miss.
      // AND Keep Kill Switch if 4 misses?
      // Let's stick to the EXPLICIT request: R$ 10 per miss. 
      // If misses >= 4, penalty is 40.0. User might have 50. Total loss?
      // I'll stick to 10 * misses. simple.

      const actualPenalty = Math.min(user.balance, penalty);

      if (actualPenalty > 0) {
        user.balance -= actualPenalty;
        totalPenalized += actualPenalty;
        penalizedUsers.push(user.name);

        addDistribution({
          userId: user.id,
          amount: -actualPenalty,
          date: today,
          reason: `FALTAS SEMANA (${misses} dias)`
        });
      }
    }
  });

  saveDB(db);

  return {
    message: "Verificação Semanal Concluída.",
    absentCount: penalizedUsers.length,
    totalPenalized,
    penalizedUsers
  };
};

export const runWeeklyDistribution = () => {
  const db = getDB();
  const today = getLocalDate();

  const activeUsers = db.users.filter(u => u.status === UserStatus.ACTIVE);

  // Calcular o Pool da Semana
  // Pool = Soma(Depositos) - Soma(Saldos Atuais)
  // Isso assume que o balance só diminui por penalidade.
  const totalDeposited = activeUsers.reduce((acc, u) => acc + u.depositedValue, 0);
  const currentTotalBalance = activeUsers.reduce((acc, u) => acc + u.balance, 0);

  const weeklyPool = totalDeposited - currentTotalBalance;

  if (weeklyPool <= 0.01) { // Margem de erro float
    // Resetar misses e scores para nova semana
    activeUsers.forEach(u => {
      u.weeklyMisses = 0;
      u.weeklyScore = 0;
    });
    saveDB(db);
    return { message: "Sem valor no pool para distribuir. Semana reiniciada." };
  }

  // Distribuição baseada em WEEKLY SCORE
  // Quem tem mais pontos recebe mais.
  const eligibleUsers = activeUsers.filter(u => (u.weeklyScore || 0) > 0 && u.balance > 0);

  if (eligibleUsers.length === 0) {
    // Ninguém pontuou? Pool acumula ou casa vence?
    // Vamos deixar acumular (não distribuir) ou zerar score?
    // Se ninguém pontuou, ninguém treinou. Pool fica lá (balance reduzido).
    activeUsers.forEach(u => {
      u.weeklyMisses = 0;
      u.weeklyScore = 0;
    });
    saveDB(db);
    return { message: "Ninguém pontuou na semana. Pool retido." };
  }

  const totalWeeklyScore = eligibleUsers.reduce((acc, u) => acc + (u.weeklyScore || 0), 0);

  eligibleUsers.forEach(user => {
    const userScore = user.weeklyScore || 0;
    const share = (userScore / totalWeeklyScore) * weeklyPool;

    user.balance += share;

    addDistribution({
      userId: user.id,
      amount: share,
      date: today,
      reason: `DISTRIBUIÇÃO SEMANAL (Sua Pontuação: ${userScore}pts)`
    });
  });

  // Reset Geral para nova semana
  activeUsers.forEach(u => {
    u.weeklyMisses = 0;
    u.weeklyScore = 0; // Resetar pontuação semanal
  });

  saveDB(db);

  return {
    message: "Distribuição Semanal Concluída!",
    poolDistributed: weeklyPool,
    recipientsCount: eligibleUsers.length
  };
};
