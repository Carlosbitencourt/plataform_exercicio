
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
  // New individual wallet fields
  freeBalance: number;    // Saldo Livre: can be withdrawn or used in marketplace
  lockedBalance: number;  // Saldo Travado: only usable in marketplace, from absence penalties
  coins: number;          // Moedas: earned from check-ins, used in marketplace
  depositedValue: number; // Total amount ever deposited (for reference)
  status: UserStatus;
  createdAt: string;
  pixKey?: string;
  street?: string;
  neighborhood?: string;
  city?: string;
  photoUrl?: string;
  email?: string;
  weeklyMisses?: number;
  totalScore?: number;
  weeklyScore?: number;   // Accumulated score in the current week
  modalityId?: string;
}

export interface TimeSlot {
  id: string;
  name: string;
  startTime: string; // HH:mm (Legacy/Primary)
  endTime: string;   // HH:mm (Legacy/Primary)
  intervals?: { startTime: string; endTime: string }[];
  weight: number;
  scoreReward?: number; // Score points awarded per check-in
  coinsReward?: number; // Coins awarded per check-in
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

// Distribution is kept for backwards-compatibility with history records
// New code should NOT create Distribution records for pool rewards
export interface Distribution {
  id: string;
  userId: string;
  amount: number;
  date: string;
  reason: string;
}

export interface MarketplacePartner {
  id: string;
  name: string;
  logoUrl?: string;
  description?: string;
  active: boolean;
  createdAt: string;
}

export interface MarketplaceProduct {
  id: string;
  name: string;
  description?: string;
  imageUrl?: string;
  category?: string;       // ex: 'produto', 'servico', 'desconto'
  partnerId?: string;      // Vincula o produto a uma loja parceira
  costCoins?: number;             // Moedas necessárias
  costFreeBalance?: number;       // Saldo livre necessário (R$)
  costLockedBalance?: number;     // Saldo travado necessário (R$)
  stock?: number;                 // undefined = unlimited
  active: boolean;
  createdAt: string;
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
  timeSlots: TimeSlot[];
  settings: SystemSettings[];
  products: MarketplaceProduct[];
}
