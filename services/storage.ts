
import { Database, User, QRCodeData, CheckIn, Distribution, UserStatus, TimeSlot } from '../types';

const STORAGE_KEY = 'fitreward_db';

// Função vital para garantir que a data YYYY-MM-DD seja sempre a local exata do dispositivo
export const getLocalDate = () => {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const defaultTimeSlots: TimeSlot[] = [
  { id: 't1', name: 'Madrugada 1', startTime: '04:30', endTime: '05:30', weight: 5 },
  { id: 't2', name: 'Madrugada 2', startTime: '05:30', endTime: '06:30', weight: 4 },
  { id: 't3', name: 'Manhã', startTime: '06:30', endTime: '07:30', weight: 3 },
  { id: 't4', name: 'Tarde', startTime: '17:00', endTime: '18:00', weight: 2 },
  { id: 't5', name: 'Noite', startTime: '18:00', endTime: '19:00', weight: 1 },
];

const initialData: Database = {
  users: [
    {
      id: '1',
      name: 'João Silva',
      cpf: '12345678901',
      uniqueCode: 'JOAO123',
      phone: '11999999999',
      balance: 100,
      depositedValue: 500,
      status: UserStatus.ACTIVE,
      createdAt: new Date().toISOString()
    }
  ],
  qrCodes: [],
  checkIns: [],
  distributions: [],
  timeSlots: defaultTimeSlots
};

export const getDB = (): Database => {
  const data = localStorage.getItem(STORAGE_KEY);
  if (!data) return initialData;
  const parsed = JSON.parse(data);
  if (!parsed.timeSlots) parsed.timeSlots = defaultTimeSlots;
  return parsed;
};

export const saveDB = (db: Database) => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(db));
};

export const addUser = (user: Omit<User, 'id' | 'createdAt' | 'balance' | 'status'>) => {
  const db = getDB();
  const newUser: User = {
    ...user,
    id: crypto.randomUUID(),
    balance: user.depositedValue,
    status: UserStatus.ACTIVE,
    createdAt: new Date().toISOString()
  };
  db.users.push(newUser);
  saveDB(db);
  return newUser;
};

export const updateUser = (updatedUser: User) => {
  const db = getDB();
  db.users = db.users.map(u => u.id === updatedUser.id ? updatedUser : u);
  saveDB(db);
};

export const addQRCode = () => {
  const db = getDB();
  const today = getLocalDate();
  
  // Desativa QRs antigos do mesmo dia para manter apenas um único token válido
  db.qrCodes = db.qrCodes.map(qr => qr.date === today ? { ...qr, active: false } : qr);

  const newQR: QRCodeData = {
    id: crypto.randomUUID(),
    date: today,
    token: Math.random().toString(36).substring(2, 10).toUpperCase(),
    active: true,
    createdAt: new Date().toISOString()
  };
  db.qrCodes.push(newQR);
  saveDB(db);
  return newQR;
};

export const addCheckIn = (checkIn: Omit<CheckIn, 'id'>) => {
  const db = getDB();
  const newCheckIn: CheckIn = {
    ...checkIn,
    id: crypto.randomUUID()
  };
  db.checkIns.push(newCheckIn);
  saveDB(db);
  return newCheckIn;
};

export const addDistribution = (dist: Omit<Distribution, 'id'>) => {
  const db = getDB();
  const newDist: Distribution = {
    ...dist,
    id: crypto.randomUUID()
  };
  db.distributions.push(newDist);
  saveDB(db);
};

export const addTimeSlot = (slot: Omit<TimeSlot, 'id'>) => {
  const db = getDB();
  const newSlot: TimeSlot = {
    ...slot,
    id: crypto.randomUUID()
  };
  db.timeSlots.push(newSlot);
  saveDB(db);
  return newSlot;
};

export const deleteTimeSlot = (id: string) => {
  const db = getDB();
  db.timeSlots = db.timeSlots.filter(s => s.id !== id);
  saveDB(db);
};
