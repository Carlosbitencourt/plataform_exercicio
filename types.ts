
export enum UserStatus {
  ACTIVE = 'ativo',
  ELIMINATED = 'eliminado'
}

export interface User {
  id: string;
  name: string;
  cpf: string;
  uniqueCode: string;
  phone: string;
  balance: number;
  depositedValue: number;
  status: UserStatus;
  createdAt: string;
  pixKey?: string;
  street?: string;
  neighborhood?: string;
  city?: string;
  photoUrl?: string;
}

export interface TimeSlot {
  id: string;
  name: string;
  startTime: string; // HH:mm
  endTime: string;   // HH:mm
  weight: number;
  days: number[];    // 0 = Sunday, 1 = Monday, etc.
  locationName: string;
  latitude: number;
  longitude: number;
  radius: number;
  categoryId?: string;
}

export interface Category {
  id: string;
  name: string;
  color?: string;
}

export interface QRCodeData {
  id: string;
  date: string;
  token: string;
  active: boolean;
  createdAt: string;
}

export interface CheckIn {
  id: string;
  userId: string;
  date: string;
  time: string;
  latitude: number;
  longitude: number;
  timeSlotId: string;
  score: number;
  address?: string;
}

export interface Distribution {
  id: string;
  userId: string;
  amount: number;
  date: string;
  reason: string;
}

export interface Database {
  users: User[];
  qrCodes: QRCodeData[];
  checkIns: CheckIn[];
  distributions: Distribution[];
  timeSlots: TimeSlot[];
}
