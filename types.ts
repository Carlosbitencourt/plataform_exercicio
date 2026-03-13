
export enum UserStatus {
  ACTIVE = 'competicao',
  ELIMINATED = 'eliminado',
  PENDING = 'analise'
}

export enum WithdrawalStatus {
  PENDING = 'pendente',
  APPROVED = 'aprovado',
  REJECTED = 'rejeitado'
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
  email?: string;
  weeklyMisses?: number;
  weeklyScore?: number;
  totalScore?: number;
  modalityId?: string;
}

export interface TimeSlot {
  id: string;
  name: string;
  startTime: string; // HH:mm (Legacy/Primary)
  endTime: string;   // HH:mm (Legacy/Primary)
  intervals?: { startTime: string; endTime: string }[];
  weight: number;
  days: number[];    // 0 = Sunday, 1 = Monday, etc.
  locationName: string;
  latitude: number;
  longitude: number;
  radius: number;
  categoryId?: string;
  photoUrl?: string;
  city?: string;
  isExclusive?: boolean;
  allowedUserIds?: string[];
}


export interface Category {
  id: string;
  name: string;
  icon?: string;
  color?: string;
  order?: number;
  parentId?: string;
}

export interface Modality {
  id: string;
  name: string;
  icon?: string;
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
  photoUrl?: string;
}

export interface Distribution {
  id: string;
  userId: string;
  amount: number;
  date: string;
  reason: string;
}

export interface Withdrawal {
  id: string;
  userId: string;
  userName: string;
  amount: number;
  status: WithdrawalStatus;
  pixKey: string;
  requestedAt: string;
  createdAt: string; // added to match AthleteProfile usage
  processedAt?: string;
  rejectionReason?: string;
}

export interface DepositRequest {
  id: string;
  userId: string;
  userName: string;
  userPhone?: string;
  amount: number;
  status: 'pendente' | 'aprovado' | 'rejeitado';
  pixKey: string;
  requestedAt: string;
  processedAt?: string;
  rejectionReason?: string;
  source?: 'signup' | 'deposit'; // where the request came from
}

export interface Absence {
  id: string;
  userId: string;
  date: string;
  reason?: string;
}

export interface Penalty {
  id: string;
  userId: string;
  date: string;
  amount: number;
}

export interface Notification {
  id: string;
  userId: string;
  title: string;
  message: string;
  type: 'SUCCESS' | 'ERROR';
  createdAt: string;
  read: boolean;
}

export interface SystemSettings {
  id: string;
  dailyLossAmount: number;
  minDepositValue?: number;
  welcomeMessage?: string;
  absenceMessage?: string;
  checkInMessage?: string;
  lastUpdated?: string;
  manualPixEnabled?: boolean;
  manualPixKey?: string;
  manualPixName?: string;
}

export interface Database {
  users: User[];
  qrCodes: QRCodeData[];
  checkIns: CheckIn[];
  distributions: Distribution[];
  timeSlots: TimeSlot[];
  settings: SystemSettings[];
}
