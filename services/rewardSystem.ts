
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
  // Regra 1: Valor investido dividido por metas da semana
  const penaltyPerMiss = user.depositedValue / WEEKLY_GOAL;

  // Regra 5: Se faltar 4 vezes (cumprir apenas 1 ou 0), perde tudo.
  // weeklyMisses é incrementado ANTES de chamar esta função no check diário
  if ((user.weeklyMisses || 0) >= 4) {
    return user.balance; // Perde o que restou (Kill Switch)
  }

  // Regra 2: Desconto proporcional
  return penaltyPerMiss;
};

export const runDailyPenaltyCheck = () => {
  const db = getDB();
  const today = getLocalDate();

  const activeUsers = db.users.filter(u => u.status === UserStatus.ACTIVE);
  const checkInsToday = db.checkIns.filter(c => c.date === today);
  const presentUserIds = new Set(checkInsToday.map(c => c.userId));

  const absentUsers = activeUsers.filter(u => !presentUserIds.has(u.id));

  if (absentUsers.length === 0) return { message: "Ninguém faltou hoje. Nenhuma penalidade aplicada." };

  let totalPenalized = 0;

  absentUsers.forEach(user => {
    // Inicializa contador se não existir
    if (user.weeklyMisses === undefined) user.weeklyMisses = 0;

    user.weeklyMisses += 1;

    const penaltyAmount = calculatePenalty(user);
    // Garante que não negative além do zero (embora calculatePenalty cuide do Kill Switch, no proporcional precisa cuidar)
    const actualPenalty = Math.min(user.balance, penaltyAmount);

    if (actualPenalty > 0) {
      user.balance -= actualPenalty;
      totalPenalized += actualPenalty;

      // Registra a perda (mas não redistribui ainda - vai pro "Pool da Semana")
      addDistribution({
        userId: user.id,
        amount: -actualPenalty,
        date: today,
        reason: `FALTA DIÁRIA (${user.weeklyMisses}/${WEEKLY_GOAL} não cumpridas)`
      });
    }
  });

  saveDB(db);

  return {
    message: "Verificação diária concluída.",
    absentCount: absentUsers.length,
    totalPenalized,
    penalizedUsers: absentUsers.map(u => u.name)
  };
};

export const runWeeklyDistribution = () => {
  const db = getDB();
  const today = getLocalDate();

  const activeUsers = db.users.filter(u => u.status === UserStatus.ACTIVE);

  // Calcular o Pool da Semana
  // Pool = Soma(Depositos) - Soma(Saldos Atuais)
  // Isso assume que o balance só diminui por penalidade.
  // Se houver outras transações, essa lógica precisa ser mais robusta somando as penalidades da semana.
  // Para simplificar e ser robusto: O Pool é a soma de tudo que foi perdido.
  // Mas como não temos histórico fácil de "perdas da semana", vamos pelo diferencial.

  const totalDeposited = activeUsers.reduce((acc, u) => acc + u.depositedValue, 0);
  const currentTotalBalance = activeUsers.reduce((acc, u) => acc + u.balance, 0);

  const weeklyPool = totalDeposited - currentTotalBalance;

  if (weeklyPool <= 0.01) { // Margem de erro float
    // Resetar misses para nova semana mesmo sem pool
    activeUsers.forEach(u => u.weeklyMisses = 0);
    saveDB(db);
    return { message: "Sem valor no pool para distribuir. Semana reiniciada." };
  }

  // Quem recebe? "Proporcional ao desempenho"
  // Vamos usar o checkIns count da semana se tivessemos, ou weeklyScore (se implementado).
  // Como não estamos trackeando weeklyScore dia a dia no DB ainda (só no CheckIn avulso), 
  // vamos usar a regra: Quem tem saldo > 0 (não foi eliminado pelo Kill Switch) e tem pelo menos 1 checkin?
  // Ou melhor: Todos os ativos que não zeraram?
  // User Prompt: "Continua elegível para receber parte do pool, proporcionalmente ao desempenho"
  // Vamos simplificar: Distribuição igual para quem não zerou saldo? Ou baseado no saldo restante (investidor maior ganha mais)?
  // Vamos assumir "Proporcional ao Saldo Restante" (Skin in the game) é uma métrica justa de desempenho financeiro + presença.

  const eligibleUsers = activeUsers.filter(u => u.balance > 0);

  if (eligibleUsers.length === 0) {
    return { message: "Ninguém elegível para receber o pool. A Casa venceu." };
  }

  const totalEligibleBalance = eligibleUsers.reduce((acc, u) => acc + u.balance, 0);

  eligibleUsers.forEach(user => {
    const share = (user.balance / totalEligibleBalance) * weeklyPool;
    user.balance += share;

    addDistribution({
      userId: user.id,
      amount: share,
      date: today,
      reason: `DISTRIBUIÇÃO SEMANAL (Pool: R$ ${weeklyPool.toFixed(2)})`
    });

    // Reset para nova semana
    user.weeklyMisses = 0;
  });

  // Resetar misses dos que zeraram também (para recomeçar? Ou eles estão eliminados?)
  // Se "Perde 100%", normalmente é Game Over. Mas o prompt não diz "Eliminado do jogo", só perde o valor.
  // Se ele depositar de novo, volta. Se não, balance 0.
  const zeroedUsers = activeUsers.filter(u => u.balance === 0);
  zeroedUsers.forEach(u => u.weeklyMisses = 0);

  saveDB(db);

  return {
    message: "Distribuição Semanal Concluída!",
    poolDistributed: weeklyPool,
    recipientsCount: eligibleUsers.length
  };
};
