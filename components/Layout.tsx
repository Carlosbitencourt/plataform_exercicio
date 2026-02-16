
import React from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Users, ClipboardList, TrendingUp, CheckSquare, LogOut, Activity, Clock, Trophy, User } from 'lucide-react';

const Layout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const isAdminPath = location.pathname.startsWith('/admin') && location.pathname !== '/admin/login';

  const handleLogout = () => {
    sessionStorage.removeItem('isAdminAuthenticated');
    navigate('/admin/login');
  };

  if (!isAdminPath) return <div className="min-h-screen bg-slate-100 text-slate-900">{children}</div>;

  const menuItems = [
    { path: '/admin', icon: Activity, label: 'Visão Geral' },
    { path: '/admin/usuarios', icon: Users, label: 'Atletas' },
    { path: '/admin/horarios', icon: Clock, label: 'Horários' },
    { path: '/admin/checkins', icon: ClipboardList, label: 'Registros' },
    { path: '/admin/ranking', icon: Trophy, label: 'Ranking' },
    { path: '/admin/distribuicoes', icon: TrendingUp, label: 'Recompensas' },
    { path: '/admin/perfil', icon: User, label: 'Meu Perfil' },
  ];

  return (
    <div className="flex min-h-screen bg-slate-100 text-slate-900 font-sans text-sm">
      {/* Sidebar - Preta com contraste Neon */}
      <aside className="w-56 bg-black flex-shrink-0 flex flex-col z-20 shadow-[10px_0_30px_rgba(0,0,0,0.2)]">
        <div className="p-6">
          <div className="flex items-center gap-2 group cursor-pointer justify-center w-full">
            <img src="/logo.png" alt="Impulso Club" className="h-12 w-auto object-contain" />
          </div>
        </div>

        <nav className="mt-2 flex-1 px-3 space-y-1">
          {menuItems.map((item) => {
            const Icon = item.icon;
            const isActive = location.pathname === item.path;
            return (
              <Link
                key={item.path}
                to={item.path}
                className={`flex items-center px-3 py-2 text-[10px] font-black uppercase tracking-wider rounded-xl transition-all ${isActive
                  ? 'bg-lime-400 text-black shadow-[0_8px_16px_rgba(163,230,53,0.2)]'
                  : 'text-zinc-500 hover:bg-zinc-900 hover:text-white border border-transparent hover:border-zinc-800'
                  }`}
              >
                <Icon className={`w-3.5 h-3.5 mr-3 ${isActive ? 'text-black' : 'text-zinc-700'}`} />
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="p-5 border-t border-zinc-900">
          <button
            onClick={handleLogout}
            className="w-full flex items-center px-4 py-2 text-xs font-black uppercase tracking-wider text-zinc-600 hover:text-red-500 transition-all"
          >
            <LogOut className="w-4 h-4 mr-3" />
            Logout
          </button>
        </div>
      </aside>

      {/* Main Content Area - Bordas mais destacadas no Header */}
      <main className="flex-1 overflow-y-auto flex flex-col">
        <header className="bg-white border-b-2 border-slate-300 py-3 px-6 flex justify-between items-center sticky top-0 z-10 shadow-sm">
          <h2 className="text-sm font-black italic text-slate-900 font-sport uppercase tracking-[0.2em]">
            {menuItems.find(i => i.path === location.pathname)?.label || 'Performance Area'}
          </h2>
          <Link
            to="/checkin"
            className="group flex items-center px-4 py-2 bg-black rounded-lg text-lime-400 text-[10px] font-black uppercase tracking-wider hover:bg-lime-400 hover:text-black transition-all shadow-xl active:scale-95"
          >
            <CheckSquare className="w-3.5 h-3.5 mr-2" />
            Terminal de Check-in
          </Link>
        </header>
        <div className="p-6 max-w-[1600px] mx-auto w-full">
          {children}
        </div>
      </main>
    </div>
  );
};

export default Layout;
