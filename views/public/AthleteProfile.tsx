import React from 'react';
import { User as UserIcon, Award, Zap, History, Settings, LogOut, ChevronRight, QrCode, CreditCard } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { subscribeToUsers } from '../../services/db';
import { User, UserStatus } from '../../types';
import { auth as firebaseAuth } from '../../services/firebase';
import { useNavigate } from 'react-router-dom';

const AthleteProfile: React.FC = () => {
    const { currentUser } = useAuth();
    const navigate = useNavigate();
    const [userData, setUserData] = React.useState<User | null>(null);

    React.useEffect(() => {
        if (!currentUser?.email) return;

        return subscribeToUsers((users) => {
            const found = users.find(u => u.email?.toLowerCase() === currentUser.email?.toLowerCase());
            if (found) setUserData(found);
        });
    }, [currentUser]);

    const handleLogout = async () => {
        try {
            await firebaseAuth.signOut();
            navigate('/admin/login');
        } catch (error) {
            console.error("Error signing out:", error);
        }
    };

    const menuItems = [
        { icon: History, label: 'Meu Histórico', color: 'text-blue-400' },
        { icon: Award, label: 'Minhas Conquistas', color: 'text-amber-400' },
        { icon: CreditCard, label: 'Dados de Pagamento', color: 'text-emerald-400' },
        { icon: Settings, label: 'Configurações', color: 'text-zinc-400' },
    ];

    return (
        <div className="p-6 space-y-8 animate-in slide-in-from-bottom-4 duration-500">
            <header className="flex flex-col items-center text-center space-y-4 py-4">
                <div className="relative">
                    <div className="w-28 h-28 rounded-[2.5rem] bg-zinc-900 border-2 border-zinc-800 p-1 group overflow-hidden shadow-[0_20px_40px_rgba(0,0,0,0.5)]">
                        {userData?.photoUrl || currentUser?.photoURL ? (
                            <img src={userData?.photoUrl || currentUser?.photoURL || ''} alt="Profile" className="w-full h-full object-cover rounded-[2rem]" />
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
                    <h1 className="text-2xl font-black italic font-sport text-white uppercase tracking-tighter">{userData?.name || currentUser?.displayName}</h1>
                    <p className="text-zinc-500 font-black uppercase text-[9px] tracking-[0.3em]">{userData?.uniqueCode || 'ATLETA TITULAR'}</p>
                </div>
            </header>

            {/* Stats Grid */}
            <div className="grid grid-cols-2 gap-4">
                <div className="bg-zinc-900/50 border border-zinc-800 p-5 rounded-3xl space-y-1 relative overflow-hidden group">
                    <div className="absolute top-0 right-0 p-3 opacity-20 group-hover:opacity-40 transition-opacity">
                        <Zap className="w-10 h-10 text-lime-400" />
                    </div>
                    <p className="text-[8px] font-black text-zinc-500 uppercase tracking-widest relative z-10">Saldo Total</p>
                    <p className="text-2xl font-black text-white font-sport italic tracking-tighter relative z-10">
                        R$ {userData?.balance.toFixed(2) || '0.00'}
                    </p>
                </div>
                <div className="bg-zinc-900/50 border border-zinc-800 p-5 rounded-3xl space-y-1 relative overflow-hidden group">
                    <div className="absolute top-0 right-0 p-3 opacity-20 group-hover:opacity-40 transition-opacity">
                        <Award className="w-10 h-10 text-amber-500" />
                    </div>
                    <p className="text-[8px] font-black text-zinc-500 uppercase tracking-widest relative z-10">Ranking</p>
                    <p className="text-2xl font-black text-white font-sport italic tracking-tighter relative z-10">
                        #12
                    </p>
                </div>
            </div>

            {/* Menu List */}
            <div className="bg-zinc-900/50 border border-zinc-800 rounded-[2rem] overflow-hidden divide-y divide-zinc-800/50">
                {menuItems.map((item, i) => (
                    <button key={i} className="w-full flex items-center justify-between p-5 hover:bg-zinc-800/50 transition-colors group">
                        <div className="flex items-center gap-4">
                            <div className={`p-2.5 rounded-xl bg-zinc-950 border border-zinc-800 ${item.color}`}>
                                <item.icon className="w-5 h-5" />
                            </div>
                            <span className="text-xs font-black uppercase tracking-widest text-zinc-300 group-hover:text-white transition-colors">{item.label}</span>
                        </div>
                        <ChevronRight className="w-4 h-4 text-zinc-700 group-hover:text-lime-400 transition-colors" />
                    </button>
                ))}
            </div>

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
