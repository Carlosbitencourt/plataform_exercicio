
import React from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Users, ClipboardList, TrendingUp, CheckSquare, LogOut, Activity, Clock, Trophy, User, Menu, X } from 'lucide-react';

const Layout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const isAdminPath = location.pathname.startsWith('/admin') && location.pathname !== '/admin/login';
  const [isMobileMenuOpen, setIsMobileMenuOpen] = React.useState(false);

  // Fecha o menu ao mudar de rota
  React.useEffect(() => {
    setIsMobileMenuOpen(false);
  }, [location.pathname]);

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
      {/* Overlay para Mobile */}
      {isMobileMenuOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-20 md:hidden backdrop-blur-sm"
          onClick={() => setIsMobileMenuOpen(false)}
        />
      )}

      {/* Sidebar - Fixa no Desktop, Gaveta no Mobile */}
      <aside className={`
        fixed inset-y-0 left-0 z-30 w-64 bg-black flex flex-col shadow-[10px_0_30px_rgba(0,0,0,0.2)] transition-transform duration-300 ease-in-out
        md:translate-x-0 md:static md:shrink-0
        ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full'}
      `}>
        <div className="p-6 flex justify-between items-center">
          <div className="flex items-center gap-2 group cursor-pointer justify-center w-full">
            <img src="/logo.png" alt="Impulso Club" className="h-12 w-auto object-contain" />
          </div>
          <button
            onClick={() => setIsMobileMenuOpen(false)}
            className="md:hidden text-zinc-400 hover:text-white"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        <nav className="mt-2 flex-1 px-3 space-y-1 overflow-y-auto">
          {menuItems.map((item) => {
            const Icon = item.icon;
            const isActive = location.pathname === item.path;
            return (
              <Link
                key={item.path}
                to={item.path}
                className={`flex items-center px-3 py-3 md:py-2 text-xs md:text-[10px] font-black uppercase tracking-wider rounded-xl transition-all ${isActive
                  ? 'bg-lime-400 text-black shadow-[0_8px_16px_rgba(163,230,53,0.2)]'
                  : 'text-zinc-500 hover:bg-zinc-900 hover:text-white border border-transparent hover:border-zinc-800'
                  }`}
              >
                <Icon className={`w-4 h-4 md:w-3.5 md:h-3.5 mr-3 ${isActive ? 'text-black' : 'text-zinc-700'}`} />
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="p-5 border-t border-zinc-900">
          <button
            onClick={handleLogout}
            className="w-full flex items-center px-4 py-3 md:py-2 text-xs font-black uppercase tracking-wider text-zinc-600 hover:text-red-500 transition-all"
          >
            <LogOut className="w-4 h-4 mr-3" />
            Logout
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col min-w-0 h-screen overflow-hidden">
        <header className="bg-white border-b-2 border-slate-300 py-3 px-4 md:px-6 flex justify-between items-center sticky top-0 z-10 shadow-sm shrink-0">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setIsMobileMenuOpen(true)}
              className="md:hidden p-2 -ml-2 text-slate-900 hover:bg-slate-100 rounded-lg"
            >
              <Menu className="w-6 h-6" />
            </button>
            <h2 className="text-sm font-black italic text-slate-900 font-sport uppercase tracking-[0.2em] truncate">
              {menuItems.find(i => i.path === location.pathname)?.label || 'Performance Area'}
            </h2>
          </div>

          <Link
            to="/checkin"
            className="group flex items-center px-3 py-2 md:px-4 md:py-2 bg-black rounded-lg text-lime-400 text-[9px] md:text-[10px] font-black uppercase tracking-wider hover:bg-lime-400 hover:text-black transition-all shadow-xl active:scale-95 whitespace-nowrap"
          >
            <CheckSquare className="w-3.5 h-3.5 mr-2" />
            <span className="hidden md:inline">Terminal de Check-in</span>
            <span className="md:hidden">Check-in</span>
          </Link>
        </header>

        <div className="flex-1 overflow-y-auto p-4 md:p-6 w-full">
          <div className="max-w-[1600px] mx-auto w-full pb-20 md:pb-0">
            {children}
          </div>
        </div>
      </main>
    </div>
  );
};

export default Layout;
