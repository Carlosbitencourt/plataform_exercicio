import React, { useState, useEffect } from 'react';
import { Plus, Edit2, ShieldAlert, CheckCircle, Search, X, Camera, Upload, Link as LinkIcon, Copy, ExternalLink, Trash2, LogIn, RefreshCw, Wallet, PiggyBank, History, Calendar, Clock, Star } from 'lucide-react';
import { subscribeToUsers, addUser, updateUser, deleteUser, subscribeToCheckIns, subscribeToAbsences, deleteCheckIn, deleteAbsence, subscribeToSettings } from '../../services/db';
import { sendWelcomeMessage } from '../../services/whatsapp';
import { auth, functions } from '../../services/firebase';
import { httpsCallable } from 'firebase/functions';
import { useAuth } from '../../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { safeUploadFile } from '../../services/firebaseGuard';
import { User, UserStatus, CheckIn, Absence, SystemSettings } from '../../types';

const Users: React.FC = () => {
  const { impersonate } = useAuth();
  const navigate = useNavigate();
  const [users, setUsers] = useState<User[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploading, setUploading] = useState(false);
  const [isLinkModalOpen, setIsLinkModalOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [pixCopied, setPixCopied] = useState(false);
  const [idCopied, setIdCopied] = useState(false);
  const [isSyncingAll, setIsSyncingAll] = useState(false);
  const [isActivityModalOpen, setIsActivityModalOpen] = useState(false);
  const [selectedUserForActivity, setSelectedUserForActivity] = useState<User | null>(null);
  const [allCheckIns, setAllCheckIns] = useState<CheckIn[]>([]);
  const [allAbsences, setAllAbsences] = useState<Absence[]>([]);
  const [systemSettings, setSystemSettings] = useState<SystemSettings | null>(null);

  const [formData, setFormData] = useState({
    name: '',
    cpf: '',
    uniqueCode: '',
    phone: '',
    depositedValue: 0,
    pixKey: '',
    street: '',
    neighborhood: '',
    city: '',
    photoUrl: '',
    email: '',
    password: '',
    balance: 0,
    status: UserStatus.ACTIVE
  });

  const generateUniqueCode = () => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let result = '';
    for (let i = 0; i < 4; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  };

  useEffect(() => {
    const unsubscribeUsers = subscribeToUsers((data) => {
      setUsers(data);
    });
    const unsubscribeCheckIns = subscribeToCheckIns((data) => {
      setAllCheckIns(data);
    });
    const unsubscribeAbsences = subscribeToAbsences((data) => {
      setAllAbsences(data);
    });
    const unsubscribeSettings = subscribeToSettings((settings) => {
      setSystemSettings(settings);
    });
    return () => {
      unsubscribeUsers();
      unsubscribeCheckIns();
      unsubscribeAbsences();
      unsubscribeSettings();
    };
  }, []);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    setUploadProgress(0);

    try {
      const interval = setInterval(() => {
        setUploadProgress(prev => Math.min(prev + 10, 90));
      }, 200);

      const downloadURL = await safeUploadFile(file);

      clearInterval(interval);
      setUploadProgress(100);
      setFormData(prev => ({ ...prev, photoUrl: downloadURL }));

      setTimeout(() => setUploading(false), 500);

    } catch (error: any) {
      console.error("Error uploading:", error);
      setUploading(false);
      setUploadProgress(0);
      alert(`Erro no Upload: ${error.message}`);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      let userIdMatch = editingUser?.id;

      // Se houver senha, criar/atualizar no Auth via Cloud Function
      if (formData.password) {
        const setUserAuth = httpsCallable(functions, 'setUserAuth');
        const result: any = await setUserAuth({
          email: formData.email,
          password: formData.password,
          displayName: formData.name
        });
        userIdMatch = result.data.uid;
      }

      const { password, ...userDataToSave } = formData;

      if (editingUser) {
        await updateUser({ ...editingUser, ...userDataToSave });
      } else {
        // Se criar sem senha (só email), ainda não temos UID do Auth
        // Idealmente, pedir senha ou usar email como base
        const finalUniqueCode = userDataToSave.uniqueCode || generateUniqueCode();
        await addUser({ ...userDataToSave, uniqueCode: finalUniqueCode }, userIdMatch);

        // Enviar mensagem de boas-vindas via WhatsApp
        if (userDataToSave.phone) {
          console.log("ADMIN: Enviando mensagem de boas-vindas para", userDataToSave.phone);
          sendWelcomeMessage(userDataToSave.phone, userDataToSave.name, finalUniqueCode, systemSettings?.welcomeMessage)
            .then(res => console.log("ADMIN: Resultado envio WhatsApp:", res))
            .catch(err => console.error("ADMIN: Erro ao enviar boas-vindas WhatsApp:", err));
        }
      }
      setFormData({
        name: '',
        cpf: '',
        uniqueCode: '',
        phone: '',
        depositedValue: 0,
        pixKey: '',
        street: '',
        neighborhood: '',
        city: '',
        photoUrl: '',
        email: '',
        password: '',
        balance: 0,
        status: UserStatus.ACTIVE
      });
      setEditingUser(null);
      setIsModalOpen(false);
    } catch (error: any) {
      console.error("Error saving user:", error);
      alert(`Erro ao salvar usuário: ${error.message}`);
    }
  };

  const openEdit = (user: User) => {
    setEditingUser(user);
    setFormData({
      name: user.name,
      cpf: user.cpf,
      uniqueCode: user.uniqueCode,
      phone: user.phone,
      depositedValue: user.depositedValue,
      pixKey: user.pixKey || '',
      street: user.street || '',
      neighborhood: user.neighborhood || '',
      city: user.city || '',
      photoUrl: user.photoUrl || '',
      email: user.email || '',
      password: '',
      balance: user.balance || 0,
      status: user.status || UserStatus.ACTIVE
    });
    setIsModalOpen(true);
  };

  const toggleStatus = async (user: User) => {
    try {
      let newStatus: UserStatus;
      const currentStatus = user.status as string;

      if (currentStatus === UserStatus.PENDING || currentStatus === 'pending' || currentStatus === 'analise') {
        newStatus = UserStatus.ACTIVE;
      } else if (currentStatus === UserStatus.ACTIVE || currentStatus === 'active' || currentStatus === 'ativo' || currentStatus === 'competicao') {
        newStatus = UserStatus.ELIMINATED;
      } else {
        newStatus = UserStatus.ACTIVE;
      }
      await updateUser({ ...user, status: newStatus });
    } catch (error) {
      console.error("Error updating status:", error);
    }
  };

  const handleSyncAccount = async (user: User) => {
    if (!window.confirm(`SINCRONIZAR CONTA DE ${user.name.toUpperCase()}? ESTA AÇÃO RECALCULARÁ TODO O HISTÓRICO DE FALTAS DESDE O CADASTRO E CORRIGIRÁ O SALDO.`)) return;
    try {
      const { syncUserAbsences } = await import('../../services/rewardSystem');
      const wasAdjusted = await syncUserAbsences(user.id, true); // Pass true for fullSync
      if (wasAdjusted) {
        alert("SINCRONIZAÇÃO COMPLETA! O SALDO FOI CORRIGIDO COM BASE NO HISTÓRICO TOTAL.");
      } else {
        alert("SINCRONIZAÇÃO COMPLETA! NENHUM AJUSTE FOI NECESSÁRIO.");
      }
    } catch (error) {
      console.error("Error syncing:", error);
      alert("ERRO AO SINCRONIZAR CONTA.");
    }
  };

  const handleSyncAll = async () => {
    if (!window.confirm("ATUALIZAÇÃO GERAL: DESEJA RECALCULAR O SALDO DE TODOS OS ATLETAS DESDE O INÍCIO DO CADASTRO? ESTA AÇÃO CORRIGIRÁ TODO O HISTÓRICO DE FALTAS.")) return;

    setIsSyncingAll(true);
    try {
      const { syncAllUsersAbsences } = await import('../../services/rewardSystem');
      const result = await syncAllUsersAbsences(true); // Pass true for fullSync
      alert(`ATUALIZAÇÃO GERAL COMPLETA!\n${result.count} ATLETAS PROCESSADOS.\n${result.adjustedCount} SALDOS FORAM CORRIGIDOS DESDE O CADASTRO.`);
    } catch (error) {
      console.error("Error syncing all:", error);
      alert("ERRO NA ATUALIZAÇÃO GERAL.");
    } finally {
      setIsSyncingAll(false);
    }
  };

  const handleDelete = async (user: User) => {
    if (window.confirm(`TEM CERTEZA QUE DESEJA APAGAR O ATLETA ${user.name.toUpperCase()}? ESTA AÇÃO NÃO PODE SER DESFEITA.`)) {
      try {
        await deleteUser(user.id);
      } catch (error) {
        console.error("Error deleting user:", error);
        alert("Erro ao apagar atleta.");
      }
    }
  };

  const copyToClipboard = async (text: string, type: 'pix' | 'id') => {
    try {
      await navigator.clipboard.writeText(text);
      if (type === 'pix') {
        setPixCopied(true);
        setTimeout(() => setPixCopied(false), 2000);
      } else {
        setIdCopied(true);
        setTimeout(() => setIdCopied(false), 2000);
      }
    } catch (err) {
      console.error('Failed to copy!', err);
    }
  };

  const getStatusLabel = (status?: string) => {
    switch (status) {
      case UserStatus.ACTIVE:
      case 'active':
      case 'ativo':
      case 'competicao':
        return 'Em Competição';
      case UserStatus.PENDING:
      case 'pending':
      case 'analise':
        return 'Em Análise';
      case UserStatus.ELIMINATED:
      case 'eliminated':
      case 'eliminado':
        return 'Eliminado';
      default:
        return 'Em Competição'; // Default to active if unknown
    }
  };

  const getStatusClass = (status?: string) => {
    switch (status) {
      case UserStatus.ACTIVE:
      case 'active':
      case 'ativo':
      case 'competicao':
        return 'bg-lime-400 text-black border-lime-500';
      case UserStatus.PENDING:
      case 'pending':
      case 'analise':
        return 'bg-amber-100 text-amber-700 border-amber-200';
      case UserStatus.ELIMINATED:
      case 'eliminated':
      case 'eliminado':
        return 'bg-rose-50 text-rose-600 border-rose-200';
      default:
        return 'bg-lime-400 text-black border-lime-500';
    }
  };

  const filteredUsers = users.filter(u =>
    u.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    u.cpf.includes(searchTerm) ||
    u.uniqueCode.toLowerCase().includes(searchTerm.toLowerCase()) ||
    u.email?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const selectedUserActivities = [
    ...allCheckIns
      .filter(c => c.userId === selectedUserForActivity?.id)
      .map(c => ({ ...c, type: 'checkin' as const })),
    ...allAbsences
      .filter(a => a.userId === selectedUserForActivity?.id)
      .map(a => ({ ...a, type: 'absence' as const }))
  ].sort((a, b) => {
    const dateA = new Date(`${a.date}${'time' in a ? 'T' + a.time : ''}`);
    const dateB = new Date(`${b.date}${'time' in b ? 'T' + b.time : ''}`);
    return dateB.getTime() - dateA.getTime();
  });

  const handleDeleteActivity = async (activity: (CheckIn | Absence) & { type: 'checkin' | 'absence' }) => {
    const typeLabel = activity.type === 'checkin' ? 'CHECK-IN' : 'FALTA';
    if (!window.confirm(`TEM CERTEZA QUE DESEJA APAGAR ESTE ${typeLabel}? ESTA AÇÃO NÃO PODE SER DESFEITA.`)) return;

    try {
      if (activity.type === 'checkin') {
        await deleteCheckIn(activity.id);
      } else {
        await deleteAbsence(activity.id);
      }
    } catch (error) {
      console.error("Error deleting activity:", error);
      alert("Erro ao apagar atividade.");
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      {/* Search and Action Bar - Bordas mais escuras */}
      {/* Search and Action Bar - Bordas mais escuras */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="relative w-full md:w-[350px] group text-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within:text-lime-600 transition-colors w-3.5 h-3.5" />
          <input
            type="text"
            placeholder="PESQUISAR ATLETA..."
            className="w-full pl-10 pr-5 py-2.5 bg-white border-2 border-slate-300 rounded-xl text-slate-900 font-bold placeholder:text-slate-400 focus:ring-4 focus:ring-lime-400/10 focus:border-lime-500 outline-none transition-all shadow-md uppercase tracking-widest text-[10px]"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <div className="flex flex-col sm:flex-row items-center gap-3 w-full md:w-auto">
          <button
            onClick={handleSyncAll}
            disabled={isSyncingAll}
            className={`w-full sm:w-auto flex items-center justify-center px-4 py-2.5 bg-white text-amber-600 border-2 border-amber-100 rounded-xl font-black uppercase italic tracking-tighter hover:bg-amber-50 hover:border-amber-200 transition-all shadow-md active:scale-95 text-[10px] ${isSyncingAll ? 'opacity-50 cursor-not-allowed' : ''}`}
          >
            <RefreshCw className={`w-4 h-4 mr-2 ${isSyncingAll ? 'animate-spin' : ''}`} />
            {isSyncingAll ? 'Sincronizando...' : 'Sincronizar Todos'}
          </button>
          <button
            onClick={() => setIsLinkModalOpen(true)}
            className="w-full sm:w-auto flex items-center justify-center px-4 py-2.5 bg-white text-slate-600 border-2 border-slate-200 rounded-xl font-black uppercase italic tracking-tighter hover:bg-slate-50 hover:border-slate-300 transition-all shadow-md active:scale-95 text-[10px]"
          >
            <LinkIcon className="w-4 h-4 mr-2" />
            Link Externo
          </button>
          <button
            onClick={() => {
              setEditingUser(null);
              setFormData({
                name: '',
                cpf: '',
                uniqueCode: generateUniqueCode(),
                phone: '',
                depositedValue: 0,
                pixKey: '',
                street: '',
                neighborhood: '',
                city: '',
                photoUrl: '',
                email: '',
                password: '',
                balance: 0,
                status: UserStatus.ACTIVE
              });
              setIsModalOpen(true);
            }}
            className="w-full sm:w-auto flex items-center justify-center px-4 py-2.5 bg-black text-lime-400 rounded-xl font-black uppercase italic tracking-tighter hover:bg-zinc-900 hover:scale-[1.05] transition-all shadow-2xl active:scale-95 text-[10px]"
          >
            <Plus className="w-4 h-4 mr-2" />
            Cadastrar Atleta
          </button>
        </div>
      </div>

      {/* Athletes List - Bordas e Sombras Reforçadas */}
      <div className="bg-transparent md:bg-white rounded-[1.25rem] md:border-2 md:border-slate-300 overflow-x-auto md:shadow-[0_10px_30px_rgba(0,0,0,0.05)]">

        {/* Mobile View - Cards */}
        <div className="md:hidden space-y-4">
          {filteredUsers.map((user) => (
            <div key={user.id} className="bg-white rounded-2xl p-4 border-2 border-slate-200 shadow-sm relative overflow-hidden">
              <div className={`absolute top-0 right-0 px-3 py-1 text-[9px] font-black uppercase tracking-widest rounded-bl-xl border-b-2 border-l-2 ${getStatusClass(user.status)}`}>
                {getStatusLabel(user.status)}
              </div>

              <div className="flex items-center gap-4 mt-2">
                <div className="w-20 h-20 bg-slate-100 rounded-2xl flex items-center justify-center text-lime-600 font-black text-2xl border-2 border-slate-200 shadow-sm overflow-hidden shrink-0">
                  {user.photoUrl ? (
                    <img src={user.photoUrl} alt={user.name} className="w-full h-full object-cover" />
                  ) : (
                    <span>{user.name && user.name[0] ? user.name[0].toUpperCase() : '?'}</span>
                  )}
                </div>
                <div className="min-w-0">
                  <h3 className="font-black text-slate-900 uppercase tracking-tight text-sm truncate">{user.name}</h3>
                  <p className="text-[10px] text-slate-400 font-bold tracking-widest uppercase mb-1">{user.phone} {user.email && <span className="lowercase">| {user.email}</span>}</p>
                  <div className="text-xs text-black font-black font-sport bg-lime-400 inline-block px-2 py-0.5 rounded border border-lime-500 uppercase tracking-widest italic shadow-sm">
                    {user.uniqueCode}
                  </div>
                </div>
              </div>

              <div className="mt-4 flex flex-col gap-2">
                <div className="mt-4 grid grid-cols-2 gap-2">
                  <div className="flex flex-col p-3 bg-slate-50 rounded-2xl border-2 border-slate-100 group/fin transition-all">
                    <div className="flex items-center gap-1.5 mb-2 text-slate-400">
                      <PiggyBank className="w-3.5 h-3.5" />
                      <span className="text-[9px] font-black uppercase tracking-widest">Investido</span>
                    </div>
                    <span className="font-bold text-slate-900 text-sm">R$ {user.depositedValue?.toFixed(2)}</span>
                  </div>

                  <div className="flex flex-col p-3 bg-lime-400 rounded-2xl border-2 border-lime-500 shadow-sm transition-all group/fin">
                    <div className="flex items-center gap-1.5 mb-2 text-black/60">
                      <Wallet className="w-3.5 h-3.5" />
                      <span className="text-[9px] font-black uppercase tracking-widest text-black/80">Saldo Atual</span>
                    </div>
                    <span className="font-black text-black italic font-sport text-xl tracking-tighter leading-none">R$ {user.balance?.toFixed(2)}</span>
                  </div>
                </div>
              </div>

              <div className="mt-4 flex gap-2">
                <button onClick={() => openEdit(user)} className="flex-1 py-2 bg-slate-50 text-slate-500 font-bold uppercase tracking-widest text-[9px] rounded-lg border border-slate-200 hover:bg-slate-100 transition-colors">
                  Editar
                </button>
                <button onClick={() => handleSyncAccount(user)} className="p-2 bg-white text-amber-500 hover:bg-amber-50 rounded-lg border border-slate-200 transition-all shadow-sm" title="Sincronizar">
                  <RefreshCw className="w-4 h-4" />
                </button>
                <button
                  onClick={() => {
                    setSelectedUserForActivity(user);
                    setIsActivityModalOpen(true);
                  }}
                  className="p-2 bg-white text-indigo-500 hover:bg-indigo-50 rounded-lg border border-slate-200 transition-all shadow-sm"
                  title="Histórico de Atividades"
                >
                  <History className="w-4 h-4" />
                </button>
                <button
                  onClick={() => {
                    impersonate(user);
                    navigate('/checkin');
                  }}
                  className="flex-1 py-2 bg-black text-lime-400 font-bold uppercase tracking-widest text-[9px] rounded-lg border border-zinc-800 hover:bg-zinc-900 transition-colors flex items-center justify-center gap-1"
                >
                  <LogIn className="w-3 h-3" />
                  Acessar
                </button>
                <button
                  onClick={() => toggleStatus(user)}
                  className={`flex-1 py-2 font-bold uppercase tracking-widest text-[9px] rounded-lg border transition-colors ${user.status === UserStatus.ACTIVE
                    ? 'bg-rose-50 text-rose-600 border-rose-200'
                    : 'bg-lime-50 text-lime-600 border-lime-200'
                    }`}
                >
                  {user.status === UserStatus.ACTIVE ? 'Eliminar' : 'Ativar Competição'}
                </button>
                <button
                  onClick={() => handleDelete(user)}
                  className="w-10 flex items-center justify-center bg-slate-50 text-slate-400 hover:text-red-600 border border-slate-200 rounded-lg"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>

        {/* Desktop View - Table */}
        <table className="min-w-full divide-y-2 divide-slate-200 hidden md:table">
          <thead className="bg-slate-50">
            <tr>
              <th className="px-3 py-3 text-left text-[10px] font-black text-slate-500 uppercase tracking-widest whitespace-nowrap">Perfil do Atleta</th>
              <th className="px-3 py-3 text-left text-[10px] font-black text-slate-500 uppercase tracking-widest whitespace-nowrap">Identificação</th>
              <th className="px-3 py-3 text-left text-[10px] font-black text-slate-500 uppercase tracking-widest whitespace-nowrap">Métricas</th>
              <th className="px-3 py-3 text-left text-[10px] font-black text-slate-500 uppercase tracking-widest whitespace-nowrap text-center">Status</th>
              <th className="px-3 py-3 text-right text-[10px] font-black text-slate-500 uppercase tracking-widest whitespace-nowrap">Gestão</th>
            </tr>
          </thead>
          <tbody className="divide-y-2 divide-slate-100">
            {filteredUsers.map((user) => (
              <tr key={user.id} className="hover:bg-slate-50/80 transition-colors group">
                <td className="px-4 py-3 whitespace-nowrap">
                  <div className="flex items-center gap-4">
                    <div className="w-14 h-14 bg-slate-100 rounded-xl flex items-center justify-center text-lime-600 font-black text-2xl border-2 border-slate-200 shadow-sm overflow-hidden">
                      {user.photoUrl ? (
                        <img src={user.photoUrl} alt={user.name} className="w-full h-full object-cover" />
                      ) : (
                        <span>{user.name && user.name[0] ? user.name[0].toUpperCase() : '?'}</span>
                      )}
                    </div>
                    <div>
                      <div>
                        <div className="text-xs font-black text-slate-900 uppercase tracking-tight">{user.name}</div>
                        <div className="text-[9px] text-slate-400 font-bold tracking-widest uppercase">{user.phone} {user.email && <span className="lowercase">| {user.email}</span>}</div>
                      </div>
                    </div>
                  </div>
                </td>
                <td className="px-4 py-3 whitespace-nowrap">
                  <div className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">CPF: {user.cpf}</div>
                  <div className="text-sm text-black font-black font-sport bg-lime-400 inline-block px-3 py-1 rounded-lg border-2 border-lime-500 uppercase tracking-widest italic shadow-sm transform group-hover:scale-105 transition-transform">
                    {user.uniqueCode}
                  </div>
                </td>
                <td className="px-4 py-3 whitespace-nowrap">
                  <div className="flex flex-col gap-1.5 w-max">
                    <div className="flex items-center justify-between gap-4 px-3 py-1 bg-slate-100 rounded-lg border border-slate-200 group-hover:bg-slate-200 transition-colors">
                      <div className="flex items-center gap-1.5 opacity-60">
                        <PiggyBank className="w-3 h-3 text-slate-500" />
                        <span className="text-[8px] font-black uppercase tracking-tighter">Investido</span>
                      </div>
                      <span className="text-[10px] font-black text-slate-700">R$ {user.depositedValue?.toFixed(2)}</span>
                    </div>

                    <div className="flex items-center justify-between gap-4 px-3 py-1.5 bg-lime-400 rounded-lg border-2 border-lime-500 shadow-sm group-hover:shadow-md transition-all">
                      <div className="flex items-center gap-1.5">
                        <Wallet className="w-3.5 h-3.5 text-black" />
                        <span className="text-[9px] font-black uppercase tracking-tighter text-black/80">Disponível</span>
                      </div>
                      <span className="text-sm font-black text-black font-sport italic tracking-tighter leading-none">R$ {user.balance?.toFixed(2)}</span>
                    </div>
                  </div>
                </td>
                <td className="px-4 py-3 whitespace-nowrap">
                  <span className={`px-2 py-0.5 inline-flex text-[9px] font-black rounded-full uppercase tracking-widest italic border shadow-sm ${getStatusClass(user.status)}`}>
                    {getStatusLabel(user.status)}
                  </span>
                </td>
                <td className="px-3 py-3 whitespace-nowrap text-right min-w-[140px]">
                  <div className="flex justify-end gap-1.5">
                    <button onClick={() => openEdit(user)} className="p-1 bg-white text-slate-400 hover:text-black hover:border-black rounded-md transition-all border border-slate-200 shadow-sm" title="Editar Perfil">
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => {
                        impersonate(user);
                        navigate('/checkin');
                      }}
                      className="p-1 bg-black text-lime-400 hover:scale-[1.1] rounded-md transition-all border border-zinc-800 shadow-sm"
                      title="Acessar Conta do Atleta"
                    >
                      <LogIn className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => toggleStatus(user)}
                      className={`p-1 rounded-md transition-all border shadow-sm ${user.status === UserStatus.ACTIVE
                        ? 'bg-white text-slate-400 hover:text-rose-600 hover:border-rose-400 border-slate-200'
                        : user.status === UserStatus.PENDING
                          ? 'bg-white text-slate-400 hover:text-lime-600 hover:border-lime-400 border-slate-200'
                          : 'bg-white text-slate-400 hover:text-lime-600 hover:border-lime-400 border-slate-200'
                        }`}
                      title={user.status === UserStatus.PENDING ? "Aprovar Atleta" : user.status === UserStatus.ACTIVE ? "Eliminar Atleta" : "Reativar Atleta"}
                    >
                      {user.status === UserStatus.ACTIVE ? <ShieldAlert className="w-3.5 h-3.5" /> : <CheckCircle className="w-3.5 h-3.5" />}
                    </button>
                    <button
                      onClick={() => handleSyncAccount(user)}
                      className="p-1 bg-white text-slate-400 hover:text-amber-500 hover:border-amber-400 rounded-md transition-all border border-slate-200 shadow-sm"
                      title="Sincronizar e Corrigir Penalidades"
                    >
                      <RefreshCw className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => {
                        setSelectedUserForActivity(user);
                        setIsActivityModalOpen(true);
                      }}
                      className="p-1 bg-white text-slate-400 hover:text-indigo-500 hover:border-indigo-400 rounded-md transition-all border border-slate-200 shadow-sm"
                      title="Histórico de Atividades"
                    >
                      <History className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => handleDelete(user)}
                      className="p-1 bg-white text-slate-400 hover:text-red-600 hover:border-red-400 rounded-md transition-all border border-slate-200 shadow-sm"
                      title="Apagar Atleta"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {filteredUsers.length === 0 && (
          <div className="p-16 text-center text-slate-400 font-black uppercase tracking-[0.3em] italic bg-slate-50 text-xs">Nenhum Atleta Identificado</div>
        )}
      </div>

      {/* Modal - Otimizado para telas menores */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-[1.5rem] border-4 border-slate-200 shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in duration-300 flex flex-col max-h-[85vh]">
            <div className="p-4 bg-slate-50 flex justify-between items-center border-b-4 border-slate-100 shrink-0">
              <h3 className="text-xl font-black italic uppercase font-sport text-slate-900 tracking-widest">
                {editingUser ? 'Modificar Perfil' : 'Novo Recruta'}
              </h3>
              <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-900 p-2 bg-white rounded-lg border-2 border-slate-200 transition-all">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSave} className="flex flex-col flex-1 overflow-hidden">
              <div className="flex-1 overflow-y-auto p-5 space-y-3">
                {/* Foto Upload */}
                <div className="flex flex-col items-center justify-center gap-2 mb-1">
                  <div className="w-20 h-20 bg-slate-100 rounded-full border-4 border-slate-200 flex items-center justify-center overflow-hidden relative group">
                    {formData.photoUrl ? (
                      <img src={formData.photoUrl} alt="Preview" className="w-full h-full object-cover" />
                    ) : (
                      <Camera className="w-8 h-8 text-slate-400" />
                    )}

                    {uploading && (
                      <div className="absolute inset-0 bg-black/60 flex items-center justify-center flex-col">
                        <span className="text-white text-[10px] font-bold">{Math.round(uploadProgress)}%</span>
                        <div className="w-12 h-1 bg-slate-700 rounded-full mt-1 overflow-hidden">
                          <div
                            className="h-full bg-lime-400 transition-all duration-300"
                            style={{ width: `${uploadProgress}%` }}
                          />
                        </div>
                      </div>
                    )}

                    <label className="absolute inset-0 bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all cursor-pointer">
                      <Upload className="w-6 h-6 text-white" />
                      <input
                        type="file"
                        className="hidden"
                        accept="image/*"
                        onChange={handleFileUpload}
                        disabled={uploading}
                      />
                    </label>
                  </div>

                  {uploading ? (
                    <p className="text-[10px] font-bold text-slate-400 animate-pulse uppercase">Enviando...</p>
                  ) : (
                    <p className="text-[10px] font-bold text-slate-400 uppercase">Alterar Foto</p>
                  )}
                </div>

                <div className="grid grid-cols-1 gap-3">
                  <div>
                    <label className="block text-[9px] font-black text-slate-500 uppercase tracking-widest mb-1">Nome Completo</label>
                    <input
                      required
                      type="text"
                      className="w-full px-4 py-3 bg-slate-50 border-2 border-slate-200 rounded-xl text-slate-900 font-bold focus:ring-2 focus:ring-lime-400 transition-all outline-none uppercase placeholder:text-slate-300 text-xs"
                      placeholder="DIGITE O NOME"
                      value={formData.name}
                      onChange={e => setFormData({ ...formData, name: e.target.value })}
                    />
                  </div>

                  <div>
                    <label className="block text-[9px] font-black text-slate-500 uppercase tracking-widest mb-1">E-mail (Para Login Google/Sistema)</label>
                    <input
                      type="email"
                      className="w-full px-4 py-3 bg-slate-50 border-2 border-slate-200 rounded-xl text-slate-900 font-bold focus:ring-2 focus:ring-lime-400 transition-all outline-none placeholder:text-slate-300 text-xs lowercase"
                      placeholder="email@exemplo.com"
                      value={formData.email}
                      onChange={e => setFormData({ ...formData, email: e.target.value.toLowerCase() })}
                    />
                  </div>

                  <div>
                    <label className="block text-[9px] font-black text-slate-500 uppercase tracking-widest mb-1">Definir Senha (Mínimo 6 caracteres)</label>
                    <input
                      type="password"
                      className="w-full px-4 py-3 bg-slate-50 border-2 border-slate-200 rounded-xl text-slate-900 font-bold focus:ring-2 focus:ring-lime-400 transition-all outline-none placeholder:text-zinc-300 text-xs"
                      placeholder={editingUser ? "DEIXE EM BRANCO PARA MANTER" : "••••••••"}
                      value={formData.password}
                      onChange={e => setFormData({ ...formData, password: e.target.value })}
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[9px] font-black text-slate-500 uppercase tracking-widest mb-1">CPF Registro</label>
                      <input
                        required
                        type="text"
                        className="w-full px-4 py-3 bg-slate-50 border-2 border-slate-200 rounded-xl text-slate-900 font-bold focus:ring-2 focus:ring-lime-400 transition-all outline-none text-xs"
                        value={formData.cpf}
                        onChange={e => setFormData({ ...formData, cpf: e.target.value })}
                      />
                    </div>
                    <div>
                      <label className="block text-[9px] font-black text-slate-500 uppercase tracking-widest mb-1">Tag Única (ID)</label>
                      <div className="relative group/id">
                        <input
                          readOnly
                          type="text"
                          className="w-full pl-4 pr-10 py-3 bg-lime-50/50 border-2 border-lime-200 rounded-xl text-lime-600 font-black font-sport italic transition-all outline-none uppercase cursor-not-allowed text-xs"
                          value={formData.uniqueCode}
                        />
                        <button
                          type="button"
                          onClick={() => copyToClipboard(formData.uniqueCode, 'id')}
                          className={`absolute right-2 top-1/2 -translate-y-1/2 p-1.5 rounded-lg transition-all ${idCopied ? 'bg-lime-400 text-black shadow-sm' : 'text-slate-400 hover:text-lime-600 hover:bg-lime-50'
                            }`}
                        >
                          {idCopied ? <CheckCircle className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                        </button>
                      </div>
                    </div>
                  </div>

                  <div>
                    <label className="block text-[9px] font-black text-slate-500 uppercase tracking-widest mb-1">Status do Atleta</label>
                    <select
                      className={`w-full px-4 py-3 border-2 rounded-xl text-slate-900 font-bold focus:ring-2 transition-all outline-none text-xs appearance-none cursor-pointer ${formData.status === UserStatus.ACTIVE ? 'bg-lime-50 border-lime-200 focus:ring-lime-400' :
                        formData.status === UserStatus.PENDING ? 'bg-amber-50 border-amber-200 focus:ring-amber-400' :
                          'bg-rose-50 border-rose-200 focus:ring-rose-400'
                        }`}
                      value={formData.status}
                      onChange={e => setFormData({ ...formData, status: e.target.value as UserStatus })}
                    >
                      <option value={UserStatus.ACTIVE}>EM COMPETIÇÃO (ATIVO)</option>
                      <option value={UserStatus.PENDING}>EM ANÁLISE (PENDENTE)</option>
                      <option value={UserStatus.ELIMINATED}>ELIMINADO (INATIVO)</option>
                    </select>
                  </div>

                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <label className="block text-[9px] font-black text-slate-500 uppercase tracking-widest mb-1">Telefone</label>
                      <input
                        required
                        type="text"
                        className="w-full px-4 py-3 bg-slate-50 border-2 border-slate-200 rounded-xl text-slate-900 font-bold focus:ring-2 focus:ring-lime-400 transition-all outline-none text-xs"
                        value={formData.phone}
                        onChange={e => setFormData({ ...formData, phone: e.target.value })}
                      />
                    </div>
                    <div>
                      <label className="block text-[8px] font-black text-slate-500 uppercase tracking-widest mb-1">Contribuição (R$)</label>
                      <input
                        required
                        type="number"
                        className="w-full px-4 py-3 bg-white border-2 border-slate-900 rounded-xl text-slate-900 font-black text-lg focus:ring-2 focus:ring-lime-400 transition-all outline-none"
                        value={formData.depositedValue}
                        onChange={e => setFormData({ ...formData, depositedValue: Number(e.target.value) })}
                      />
                    </div>
                    <div>
                      <label className="block text-[9px] font-black text-slate-500 uppercase tracking-widest mb-1">Pix (Chave)</label>
                      <input
                        type="text"
                        className="w-full px-4 py-3 bg-slate-50 border-2 border-slate-200 rounded-xl text-slate-900 font-bold focus:ring-2 focus:ring-lime-400 transition-all outline-none text-xs"
                        placeholder="CHAVE"
                        value={formData.pixKey}
                        onChange={e => setFormData({ ...formData, pixKey: e.target.value })}
                      />
                    </div>
                  </div>

                  <div className="bg-lime-400/10 p-4 rounded-2xl border-2 border-dotted border-lime-400 group/balance transition-all hover:bg-lime-400/20">
                    <div className="flex items-center justify-between mb-2">
                      <label className="text-[10px] font-black text-lime-700 uppercase tracking-widest flex items-center gap-2">
                        <Wallet className="w-4 h-4" /> Saldo Atual do Atleta (R$)
                      </label>
                      <span className="text-[8px] bg-lime-400 text-black px-2 py-0.5 rounded-full font-black uppercase tracking-tighter shadow-sm animate-pulse">Manual Override</span>
                    </div>
                    <div className="relative">
                      <span className="absolute left-4 top-1/2 -translate-y-1/2 font-black text-lime-700 opacity-50 text-lg">R$</span>
                      <input
                        type="number"
                        step="0.01"
                        className="w-full pl-12 pr-4 py-3 bg-white border-2 border-lime-500 rounded-xl text-slate-900 font-black text-2xl focus:ring-4 focus:ring-lime-600/20 transition-all outline-none shadow-inner"
                        value={formData.balance}
                        onChange={e => setFormData({ ...formData, balance: Number(e.target.value) })}
                      />
                    </div>
                    <p className="text-[8px] font-bold text-lime-600/80 uppercase mt-2 leading-tight flex items-start gap-1.5">
                      <ShieldAlert className="w-3 h-3 shrink-0" />
                      Atenção: Este valor será o novo saldo total. O sistema continuará aplicando/revertendo faltas a partir deste número no próximo sincronismo.
                    </p>
                  </div>

                  <div>
                    <label className="block text-[9px] font-black text-slate-500 uppercase tracking-widest mb-1">Endereço (Rua)</label>
                    <input
                      type="text"
                      className="w-full px-4 py-3 bg-slate-50 border-2 border-slate-200 rounded-xl text-slate-900 font-bold focus:ring-2 focus:ring-lime-400 transition-all outline-none uppercase text-xs"
                      value={formData.street}
                      onChange={e => setFormData({ ...formData, street: e.target.value })}
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[9px] font-black text-slate-500 uppercase tracking-widest mb-1">Bairro</label>
                      <input
                        type="text"
                        className="w-full px-4 py-3 bg-slate-50 border-2 border-slate-200 rounded-xl text-slate-900 font-bold focus:ring-2 focus:ring-lime-400 transition-all outline-none uppercase text-xs"
                        value={formData.neighborhood}
                        onChange={e => setFormData({ ...formData, neighborhood: e.target.value })}
                      />
                    </div>
                    <div>
                      <label className="block text-[9px] font-black text-slate-500 uppercase tracking-widest mb-1">Cidade</label>
                      <input
                        type="text"
                        className="w-full px-4 py-3 bg-slate-50 border-2 border-slate-200 rounded-xl text-slate-900 font-bold focus:ring-2 focus:ring-lime-400 transition-all outline-none uppercase text-xs"
                        value={formData.city}
                        onChange={e => setFormData({ ...formData, city: e.target.value })}
                      />
                    </div>
                  </div>
                </div>

              </div>

              <div className="p-4 bg-slate-50 border-t-4 border-slate-100 flex justify-end gap-3 shrink-0">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-6 py-3 text-slate-400 font-black uppercase tracking-widest hover:text-slate-900 transition-colors text-[10px]"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-8 py-3 bg-black text-lime-400 rounded-xl font-black uppercase italic tracking-tighter shadow-xl hover:scale-[1.05] transition-all text-[10px]"
                >
                  Confirmar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* External Link Modal */}
      {isLinkModalOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-[2rem] border-4 border-slate-200 shadow-2xl w-full max-w-sm overflow-hidden animate-in zoom-in duration-300">
            <div className="p-6 bg-slate-50 border-b-2 border-slate-100 flex justify-between items-center">
              <h3 className="text-lg font-black italic uppercase font-sport text-slate-900">Link de Inscrição</h3>
              <button onClick={() => setIsLinkModalOpen(false)} className="text-slate-400 hover:text-slate-900">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-8 space-y-6">
              <div className="bg-slate-100 p-6 rounded-2xl border-2 border-slate-200 break-all text-center">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">URL Púbica</p>
                <code className="text-xs font-bold text-slate-600">
                  {window.location.origin}/#/inscrever
                </code>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(`${window.location.origin}/#/inscrever`);
                    setCopied(true);
                    setTimeout(() => setCopied(false), 2000);
                  }}
                  className="flex-1 flex items-center justify-center gap-2 py-4 bg-black text-lime-400 rounded-xl font-black uppercase italic tracking-tighter hover:scale-[1.02] transition-all"
                >
                  {copied ? <CheckCircle className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                  {copied ? 'Copiado!' : 'Copiar Link'}
                </button>
                <a
                  href={`${window.location.origin}/#/inscrever`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="p-4 bg-slate-100 text-slate-600 rounded-xl hover:bg-slate-200 transition-all border-2 border-slate-200"
                >
                  <ExternalLink className="w-4 h-4" />
                </a>
              </div>

              <p className="text-[9px] text-slate-400 font-bold uppercase tracking-widest text-center leading-relaxed">
                Envie este link para que os atletas possam se cadastrar diretamente no sistema.
              </p>
            </div>
          </div>
        </div>
      )}
      {/* Activity Log Modal */}
      {isActivityModalOpen && selectedUserForActivity && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-[2rem] border-4 border-slate-200 shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden animate-in zoom-in duration-300">
            <div className="p-6 bg-slate-50 border-b-2 border-slate-100 flex justify-between items-center shrink-0">
              <div>
                <h3 className="text-lg font-black italic uppercase font-sport text-slate-900 leading-tight">Histórico de Atividades</h3>
                <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">{selectedUserForActivity.name}</p>
              </div>
              <button onClick={() => {
                setIsActivityModalOpen(false);
                setSelectedUserForActivity(null);
              }} className="p-2 text-slate-400 hover:text-slate-900 bg-white border border-slate-200 rounded-lg transition-all">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              {selectedUserActivities.length === 0 ? (
                <div className="text-center py-12">
                  <History className="w-12 h-12 text-slate-200 mx-auto mb-4" />
                  <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Nenhuma atividade registrada.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {selectedUserActivities.map((activity) => (
                    <div
                      key={activity.id}
                      className={`flex items-center justify-between p-4 rounded-2xl border-2 transition-all ${activity.type === 'checkin'
                        ? 'bg-lime-50 border-lime-100 hover:border-lime-300'
                        : 'bg-rose-50 border-rose-100 hover:border-rose-300'
                        }`}
                    >
                      <div className="flex items-center gap-4">
                        <div className={`p-2.5 rounded-xl shadow-sm ${activity.type === 'checkin' ? 'bg-lime-400 text-black' : 'bg-rose-500 text-white'
                          }`}>
                          {activity.type === 'checkin' ? <CheckCircle className="w-4 h-4" /> : <X className="w-4 h-4" />}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] font-black uppercase tracking-tighter italic text-slate-900">
                              {activity.type === 'checkin' ? 'Check-In Concluído' : 'Falta Registrada'}
                            </span>
                            {'score' in activity && (
                              <span className="px-1.5 py-0.5 bg-white rounded-md border border-lime-200 text-[9px] font-black text-lime-600">
                                +{activity.score}
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-3 mt-1">
                            <div className="flex items-center gap-1 text-[10px] font-bold text-slate-500">
                              <Calendar className="w-3 h-3" />
                              {new Date(activity.date + 'T12:00:00').toLocaleDateString('pt-BR')}
                            </div>
                            {'time' in activity && (
                              <div className="flex items-center gap-1 text-[10px] font-bold text-slate-500">
                                <Clock className="w-3 h-3" />
                                {activity.time}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>

                      <button
                        onClick={() => handleDeleteActivity(activity)}
                        className="p-2 text-slate-400 hover:text-red-600 hover:bg-white rounded-lg transition-all border border-transparent hover:border-red-100"
                        title="Apagar Registro"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="p-4 bg-slate-50 border-t-2 border-slate-100 shrink-0">
              <button
                onClick={() => {
                  setIsActivityModalOpen(false);
                  setSelectedUserForActivity(null);
                }}
                className="w-full py-3 bg-white text-slate-600 border-2 border-slate-200 rounded-xl font-black uppercase italic tracking-tighter hover:bg-slate-50 transition-all text-[10px]"
              >
                Fechar Histórico
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Users;
