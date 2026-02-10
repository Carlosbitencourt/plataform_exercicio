
import { getDB, saveDB, addDistribution, getLocalDate } from './storage';
import { DAILY_LOSS_AMOUNT } from '../constants';
import { UserStatus } from '../types';

export const calculateCheckInScore = (timeSlotId: string, depositedValue: number): number => {
  const db = getDB();
  const slot = db.timeSlots.find(s => s.id === timeSlotId);
  if (!slot) return 0;
  
  const weight = slot.weight;
  const bonus = depositedValue / 10;
  return weight + bonus;
};

export const runDailyDistribution = () => {
  const db = getDB();
  const today = getLocalDate();
  
  const activeUsers = db.users.filter(u => u.status === UserStatus.ACTIVE);
  
  const checkInsToday = db.checkIns.filter(c => c.date === today);
  const presentUserIds = new Set(checkInsToday.map(c => c.userId));
  
  const absentUsers = activeUsers.filter(u => !presentUserIds.has(u.id));
  const presentUsers = activeUsers.filter(u => presentUserIds.has(u.id));
  
  if (absentUsers.length === 0) return { message: "Ninguém faltou hoje." };

  let totalPot = 0;
  absentUsers.forEach(user => {
    const penalty = Math.min(user.balance, DAILY_LOSS_AMOUNT);
    user.balance -= penalty;
    totalPot += penalty;
  });

  if (totalPot <= 0) return { message: "Nenhum valor arrecadado dos faltantes." };

  const scores = presentUsers.map(user => {
    const checkIn = checkInsToday.find(c => c.userId === user.id);
    return { userId: user.id, score: checkIn?.score || 0 };
  });
  
  const totalScore = scores.reduce((acc, curr) => acc + curr.score, 0);

  if (totalScore === 0) return { message: "Nenhum presente para receber a distribuição." };

  presentUsers.forEach(user => {
    const userScore = scores.find(s => s.userId === user.id)?.score || 0;
    const share = (userScore / totalScore) * totalPot;
    user.balance += share;
    
    addDistribution({
      userId: user.id,
      amount: share,
      date: today,
      reason: `Distribuição diária - Faltantes: ${absentUsers.length}`
    });
  });

  saveDB(db);
  return { 
    message: "Distribuição concluída com sucesso!",
    absentCount: absentUsers.length,
    presentCount: presentUsers.length,
    totalPot
  };
};
