import React from 'react';
import { User as UserIcon, Award, Zap, History, Settings, LogOut, ChevronRight, QrCode, CreditCard, X, MapPin, Calendar, Clock as ClockIcon, Loader2, Camera } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { subscribeToUsers, subscribeToCheckIns, subscribeToDistributions } from '../../services/db';
import { syncUserAbsences } from '../../services/rewardSystem';
import { User, UserStatus, CheckIn } from '../../types';
import { auth as firebaseAuth } from '../../services/firebase';
import { useNavigate } from 'react-router-dom';

const AthleteProfile: React.FC = () => {
    const { currentUser } = useAuth();
    const navigate = useNavigate();
    const [userData, setUserData] = React.useState<User | null>(null);
    const [checkIns, setCheckIns] = React.useState<CheckIn[]>([]);
    const [distributions, setDistributions] = React.useState<any[]>([]);
    const [isHistoryOpen, setIsHistoryOpen] = React.useState(false);
    const [isEditModalOpen, setIsEditModalOpen] = React.useState(false);
    const [isSaving, setIsSaving] = React.useState(false);
    const [uploadingPhoto, setUploadingPhoto] = React.useState(false);
    const [editForm, setEditForm] = React.useState({
        name: '',
        phone: '',
        street: '',
        neighborhood: '',
        city: '',
        cpf: '',
        pixKey: '',
        photoUrl: ''
    });

    const maskPhone = (value: string) => {
        return value
            .replace(/\D/g, '')
            .replace(/(\d{2})(\d)/, '($1) $2')
            .replace(/(\d{5})(\d)/, '$1-$2')
            .replace(/(-\d{4})\d+?$/, '$1');
    };

    const maskCPF = (value: string) => {
        return value
            .replace(/\D/g, '')
            .replace(/(\d{3})(\d)/, '$1.$2')
            .replace(/(\d{3})(\d)/, '$1.$2')
            .replace(/(\d{3})(\d{1,2})/, '$1-$2')
            .replace(/(-\d{2})\d+?$/, '$1');
    };

    React.useEffect(() => {
        if (!currentUser?.email) return;

        const unsubUsers = subscribeToUsers((users) => {
            const found = users.find(u => u.email?.toLowerCase() === currentUser.email?.toLowerCase());
            if (found) {
                setUserData(found);
                syncUserAbsences(found.id);
            }
        });

        const unsubCheckIns = subscribeToCheckIns((allChecks) => {
            if (userData?.id) {
                const userChecks = allChecks
                    .filter(c => c.userId === userData.id)
                    .sort((a, b) => b.date.localeCompare(a.date));
                setCheckIns(userChecks);
            }
        });

        const unsubDist = subscribeToDistributions((allDists) => {
            if (userData?.id) {
                const userDists = allDists.filter(d => d.userId === userData.id);
                setDistributions(userDists);
            }
        });

        return () => {
            unsubUsers();
            unsubCheckIns();
            unsubDist();
        };
    }, [currentUser, userData?.id]);

    React.useEffect(() => {
        if (userData && !isEditModalOpen) {
            setEditForm({
                name: userData.name || '',
                phone: userData.phone || '',
                street: userData.street || '',
                neighborhood: userData.neighborhood || '',
                city: userData.city || '',
                cpf: userData.cpf || '',
                pixKey: userData.pixKey || '',
                photoUrl: userData.photoUrl || ''
            });
        }
    }, [userData, isEditModalOpen]);

    const handleUpdateProfile = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!userData) return;

        setIsSaving(true);
        try {
            const { updateUser } = await import('../../services/db');
            await updateUser({
                ...userData,
                ...editForm
            });
            setIsEditModalOpen(false);
        } catch (error) {
            console.error("Error updating profile:", error);
            alert("Erro ao atualizar perfil.");
        } finally {
            setIsSaving(false);
        }
    };

    const handlePhotoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setUploadingPhoto(true);
        try {
            const { safeUploadFile } = await import('../../services/firebaseGuard');
            const url = await safeUploadFile(file, `profiles/athletes/${userData?.id || 'unknown'}_${Date.now()}`);
            setEditForm(prev => ({ ...prev, photoUrl: url }));
        } catch (error: any) {
            alert("Erro ao enviar foto: " + error.message);
        } finally {
            setUploadingPhoto(false);
        }
    };

    const handleLogout = async () => {
        try {
            await firebaseAuth.signOut();
            navigate('/admin/login');
        } catch (error) {
            console.error("Error signing out:", error);
        }
    };

    const menuItems = [
        {
            icon: History,
            label: 'Meu Histórico',
            color: 'text-blue-400',
            action: () => setIsHistoryOpen(true)
        },
        {
            icon: Settings,
            label: 'Editar Perfil',
            color: 'text-zinc-400',
            action: () => setIsEditModalOpen(true)
        },
        { icon: Award, label: 'Minhas Conquistas', color: 'text-amber-400' },
        { icon: CreditCard, label: 'Dados de Pagamento', color: 'text-emerald-400' },
    ];

    return (
        <div className="p-6 space-y-8 animate-in slide-in-from-bottom-4 duration-500">
            <header className="flex flex-col items-center text-center space-y-4 py-4">
                <div className="relative">
                    <div className="w-28 h-28 rounded-3xl bg-zinc-900 border-2 border-zinc-800 p-1 group overflow-hidden shadow-[0_20px_40px_rgba(0,0,0,0.5)]">
                        {userData?.photoUrl || currentUser?.photoURL ? (
                            <img
                                src={userData?.photoUrl || currentUser?.photoURL || ''}
                                alt="Profile"
                                className="w-full h-full object-cover rounded-2xl"
                                loading="eager"
                                decoding="async"
                            />
                        ) : (
                            <div className="w-full h-full flex items-center justify-center text-lime-400 font-bold text-4xl">
                                {userData?.name[0] || currentUser?.displayName?.[0] || 'A'}
                            </div>
                        )}
                    </div>
                    <button className="absolute -bottom-2 -right-2 p-3 bg-lime-400 text-black rounded-2xl shadow-xl hover:bg-white transition-all active:scale-90">
                        <QrCode className="w-5 h-5" />
                    </button>
                </div>

                <div className="space-y-1">
                    <h1 className="text-3xl font-black italic font-sport text-white uppercase tracking-tighter leading-none mb-1">
                        {userData?.name || currentUser?.displayName}
                    </h1>
                    <p className="text-zinc-500 font-black uppercase text-[10px] tracking-[0.3em]">
                        {userData?.uniqueCode || 'ATLETA TITULAR'}
                    </p>
                </div>
            </header>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-zinc-900 border border-zinc-800 p-6 rounded-3xl space-y-4 relative overflow-hidden group hover:border-lime-500/30 transition-all md:col-span-2">
                    <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-30 transition-opacity">
                        <Zap className="w-12 h-12 text-lime-400" />
                    </div>
                    <p className="text-[10px] font-black text-zinc-500 uppercase tracking-widest relative z-10">Saldo Total (Portfólio)</p>
                    <p className="text-4xl font-black text-white font-sport italic tracking-tighter relative z-10">
                        {`R$ ${userData?.balance?.toFixed(2) || '0.00'}`}
                    </p>

                    <div className="grid grid-cols-3 gap-2 pt-2 border-t border-zinc-800/50">
                        <div>
                            <p className="text-[7px] font-black text-zinc-600 uppercase tracking-widest mb-1">Depósito</p>
                            <p className="text-xs font-black text-zinc-300 font-sport italic">R$ {userData?.depositedValue?.toFixed(2) || '0.00'}</p>
                        </div>
                        <div>
                            <p className="text-[7px] font-black text-zinc-600 uppercase tracking-widest mb-1">Lucro</p>
                            <p className="text-xs font-black text-lime-400 font-sport italic">R$ {distributions.filter(d => d.amount > 0).reduce((acc, d) => acc + d.amount, 0).toFixed(2)}</p>
                        </div>
                        <div>
                            <p className="text-[7px] font-black text-zinc-600 uppercase tracking-widest mb-1">Faltas</p>
                            <p className="text-xs font-black text-rose-500 font-sport italic">R$ {Math.abs(distributions.filter(d => d.amount < 0).reduce((acc, d) => acc + d.amount, 0)).toFixed(2)}</p>
                        </div>
                    </div>
                </div>
                <div className="bg-zinc-900 border border-zinc-800 p-6 rounded-3xl space-y-2 relative overflow-hidden group hover:border-amber-500/30 transition-all">
                    <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-30 transition-opacity">
                        <Award className="w-12 h-12 text-amber-500" />
                    </div>
                    <p className="text-[10px] font-black text-zinc-500 uppercase tracking-widest relative z-10">Ranking</p>
                    <p className="text-3xl font-black text-white font-sport italic tracking-tighter relative z-10">
                        #12
                    </p>
                </div>
            </div>

            <div className="bg-zinc-900 border border-zinc-800 rounded-3xl overflow-hidden divide-y divide-zinc-800/50">
                {menuItems.map((item, i) => (
                    <button
                        key={i}
                        onClick={item.action}
                        className="w-full flex items-center justify-between p-6 hover:bg-zinc-800/80 transition-all group active:scale-[0.98]"
                    >
                        <div className="flex items-center gap-5">
                            <div className={`p-3 rounded-2xl bg-black border border-zinc-800 group-hover:border-lime-500/50 transition-colors ${item.color}`}>
                                <item.icon className="w-6 h-6" />
                            </div>
                            <span className="text-sm font-black uppercase tracking-[0.2em] text-zinc-300 group-hover:text-white transition-colors">{item.label}</span>
                        </div>
                        <ChevronRight className="w-5 h-5 text-zinc-800 group-hover:text-lime-400 group-hover:translate-x-1 transition-all" />
                    </button>
                ))}
            </div>

            {/* Edit Modal */}
            {isEditModalOpen && (
                <div className="fixed inset-0 z-[100] flex items-end justify-center animate-in fade-in duration-300">
                    <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={() => setIsEditModalOpen(false)}></div>
                    <div className="relative w-full max-w-lg bg-zinc-900 border-t border-zinc-800 rounded-t-[3rem] p-8 space-y-8 animate-in slide-in-from-bottom-full duration-500 max-h-[90vh] overflow-y-auto">
                        <header className="flex items-center justify-between sticky top-0 bg-zinc-900 pb-4 z-10 border-b border-zinc-800/50">
                            <div>
                                <h2 className="text-2xl font-black italic font-sport text-white uppercase tracking-tighter">Editar Perfil</h2>
                                <p className="text-zinc-500 font-bold uppercase text-[10px] tracking-widest">Atualize seus dados cadastrais</p>
                            </div>
                            <button
                                onClick={() => setIsEditModalOpen(false)}
                                className="p-3 bg-zinc-800 text-zinc-400 rounded-2xl hover:text-white transition-colors"
                            >
                                <X className="w-6 h-6" />
                            </button>
                        </header>

                        <form onSubmit={handleUpdateProfile} className="space-y-6 pb-12">
                            {/* Photo Upload */}
                            <div className="flex flex-col items-center space-y-4">
                                <div className="relative">
                                    <div
                                        onClick={() => document.getElementById('profile-photo-input')?.click()}
                                        className="w-24 h-24 rounded-[2rem] bg-zinc-800 border-2 border-dashed border-zinc-700 overflow-hidden cursor-pointer group hover:border-lime-400 transition-all"
                                    >
                                        {uploadingPhoto ? (
                                            <div className="w-full h-full flex items-center justify-center bg-black/50">
                                                <Loader2 className="w-6 h-6 text-lime-400 animate-spin" />
                                            </div>
                                        ) : editForm.photoUrl ? (
                                            <img src={editForm.photoUrl} alt="Preview" className="w-full h-full object-cover" />
                                        ) : (
                                            <div className="w-full h-full flex items-center justify-center text-zinc-600">
                                                <Camera className="w-8 h-8" />
                                            </div>
                                        )}
                                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                            <span className="text-[8px] font-black text-white uppercase tracking-widest">Trocar Foto</span>
                                        </div>
                                    </div>
                                    <input
                                        id="profile-photo-input"
                                        type="file"
                                        accept="image/*"
                                        className="hidden"
                                        onChange={handlePhotoChange}
                                    />
                                </div>
                            </div>

                            <div className="space-y-4">
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest ml-1">Nome Completo</label>
                                    <input
                                        required
                                        className="w-full px-6 py-4 bg-black border border-zinc-800 rounded-xl text-white font-bold focus:border-lime-400 outline-none transition-all uppercase"
                                        value={editForm.name}
                                        onChange={e => setEditForm(prev => ({ ...prev, name: e.target.value }))}
                                    />
                                </div>

                                <div className="space-y-2 opacity-50">
                                    <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest ml-1">E-mail (Não editável)</label>
                                    <input
                                        disabled
                                        className="w-full px-6 py-4 bg-zinc-900 border border-zinc-800 rounded-xl text-zinc-500 font-bold outline-none"
                                        value={userData?.email}
                                    />
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest ml-1">WhatsApp</label>
                                        <input
                                            required
                                            className="w-full px-6 py-4 bg-black border border-zinc-800 rounded-xl text-white font-bold focus:border-lime-400 outline-none transition-all"
                                            value={editForm.phone}
                                            onChange={e => setEditForm(prev => ({ ...prev, phone: maskPhone(e.target.value) }))}
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest ml-1">CPF</label>
                                        <input
                                            required
                                            className="w-full px-6 py-4 bg-black border border-zinc-800 rounded-xl text-white font-bold focus:border-lime-400 outline-none transition-all"
                                            value={editForm.cpf}
                                            onChange={e => setEditForm(prev => ({ ...prev, cpf: maskCPF(e.target.value) }))}
                                        />
                                    </div>
                                </div>

                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest ml-1">Endereço (Rua e Nº)</label>
                                    <input
                                        required
                                        className="w-full px-6 py-4 bg-black border border-zinc-800 rounded-xl text-white font-bold focus:border-lime-400 outline-none transition-all uppercase"
                                        value={editForm.street}
                                        onChange={e => setEditForm(prev => ({ ...prev, street: e.target.value }))}
                                    />
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest ml-1">Bairro</label>
                                        <input
                                            required
                                            className="w-full px-6 py-4 bg-black border border-zinc-800 rounded-xl text-white font-bold focus:border-lime-400 outline-none transition-all uppercase"
                                            value={editForm.neighborhood}
                                            onChange={e => setEditForm(prev => ({ ...prev, neighborhood: e.target.value }))}
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest ml-1">Cidade</label>
                                        <input
                                            required
                                            className="w-full px-6 py-4 bg-black border border-zinc-800 rounded-xl text-white font-bold focus:border-lime-400 outline-none transition-all uppercase"
                                            value={editForm.city}
                                            onChange={e => setEditForm(prev => ({ ...prev, city: e.target.value }))}
                                        />
                                    </div>
                                </div>

                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest ml-1">Chave PIX</label>
                                    <input
                                        required
                                        className="w-full px-6 py-4 bg-black border border-zinc-800 rounded-xl text-white font-bold focus:border-lime-400 outline-none transition-all uppercase"
                                        value={editForm.pixKey}
                                        onChange={e => setEditForm(prev => ({ ...prev, pixKey: e.target.value }))}
                                    />
                                </div>
                            </div>

                            <button
                                type="submit"
                                disabled={isSaving || uploadingPhoto}
                                className="w-full py-5 bg-lime-400 text-black rounded-2xl font-black uppercase tracking-widest text-sm hover:scale-[1.02] active:scale-95 transition-all shadow-xl shadow-lime-400/20 disabled:opacity-50 flex items-center justify-center gap-2"
                            >
                                {isSaving ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Salvar Alterações'}
                            </button>
                        </form>
                    </div>
                </div>
            )}

            {/* History Modal */}
            {isHistoryOpen && (
                <div className="fixed inset-0 z-[100] flex items-end justify-center animate-in fade-in duration-300">
                    <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={() => setIsHistoryOpen(false)}></div>
                    <div className="relative w-full max-w-lg bg-zinc-900 border-t border-zinc-800 rounded-t-[3rem] p-8 space-y-8 animate-in slide-in-from-bottom-full duration-500 max-h-[85vh] overflow-y-auto">
                        <header className="flex items-center justify-between sticky top-0 bg-zinc-900 pb-4 z-10 border-b border-zinc-800/50">
                            <div>
                                <h2 className="text-2xl font-black italic font-sport text-white uppercase tracking-tighter">Histórico</h2>
                                <p className="text-zinc-500 font-bold uppercase text-[10px] tracking-widest">Suas últimas atividades</p>
                            </div>
                            <button
                                onClick={() => setIsHistoryOpen(false)}
                                className="p-3 bg-zinc-800 text-zinc-400 rounded-2xl hover:text-white transition-colors"
                            >
                                <X className="w-6 h-6" />
                            </button>
                        </header>

                        <div className="space-y-4 pb-12">
                            {checkIns.length > 0 ? checkIns.map((ci) => (
                                <div key={ci.id} className="bg-black/40 border border-zinc-800/50 p-5 rounded-3xl flex items-center justify-between group">
                                    <div className="flex items-center gap-4">
                                        <div className="p-3 bg-zinc-900 rounded-2xl border border-zinc-800 text-lime-400">
                                            <MapPin className="w-5 h-5" />
                                        </div>
                                        <div>
                                            <p className="text-sm font-black text-white uppercase tracking-tight leading-none mb-1">{ci.locationName || 'Local Desconhecido'}</p>
                                            <div className="flex items-center gap-3 text-zinc-500">
                                                <span className="text-[10px] font-bold flex items-center gap-1">
                                                    <Calendar className="w-3 h-3" />
                                                    {ci.date.split('-').reverse().join('/')}
                                                </span>
                                                <span className="text-[10px] font-bold flex items-center gap-1">
                                                    <ClockIcon className="w-3 h-3" />
                                                    {ci.time}
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <p className="text-xs font-black text-lime-400 font-sport italic">+{ci.score?.toFixed(0) || 10}P</p>
                                        <p className="text-[8px] font-black text-zinc-600 uppercase tracking-widest">VALIDADO</p>
                                    </div>
                                </div>
                            )) : (
                                <div className="py-12 text-center space-y-4">
                                    <div className="w-16 h-16 bg-zinc-800 rounded-full mx-auto flex items-center justify-center text-zinc-600">
                                        <History className="w-8 h-8" />
                                    </div>
                                    <p className="text-zinc-500 font-black uppercase text-[10px] tracking-widest">Nenhuma atividade registrada</p>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}

            <button
                onClick={handleLogout}
                className="w-full py-5 bg-zinc-900/50 border border-zinc-800 text-rose-500 rounded-3xl font-black uppercase tracking-[0.2em] text-[10px] hover:bg-rose-500/10 transition-all flex items-center justify-center gap-2"
            >
                <LogOut className="w-4 h-4" />
                Sair da Conta
            </button>

            <p className="text-center text-[8px] text-zinc-700 font-black uppercase tracking-[0.5em] pb-8">
                Impulso Club Performance v4.2.0
            </p>
        </div>
    );
};

export default AthleteProfile;
