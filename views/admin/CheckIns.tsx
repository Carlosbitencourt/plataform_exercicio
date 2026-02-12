import React, { useState, useEffect } from 'react';
import { Calendar, Clock, MapPin, User, Trophy, Search, Filter, ClipboardList, Activity, Trash2, X } from 'lucide-react';
import { subscribeToCheckIns, subscribeToUsers, subscribeToTimeSlots, deleteCheckIn } from '../../services/db';
import { CheckIn, User as UserType, TimeSlot } from '../../types';

const CheckIns: React.FC = () => {
  const [checkIns, setCheckIns] = useState<CheckIn[]>([]);
  const [users, setUsers] = useState<UserType[]>([]);
  const [timeSlots, setTimeSlots] = useState<TimeSlot[]>([]);

  // Default to today in YYYY-MM-DD format
  const getTodayStart = () => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  };

  const [dateFilter, setDateFilter] = useState(getTodayStart());
  const [userFilter, setUserFilter] = useState('');

  useEffect(() => {
    const unsubscribeCheckIns = subscribeToCheckIns((data) => setCheckIns(data));
    const unsubscribeUsers = subscribeToUsers((data) => setUsers(data));
    const unsubscribeSlots = subscribeToTimeSlots((data) => setTimeSlots(data));

    return () => {
      unsubscribeCheckIns();
      unsubscribeUsers();
      unsubscribeSlots();
    };
  }, []);

  const filteredCheckIns = checkIns.filter(c => {
    const user = users.find(u => u.id === c.userId);
    const matchesUser = user?.name.toLowerCase().includes(userFilter.toLowerCase()) ||
      user?.cpf.includes(userFilter);
    const matchesDate = dateFilter ? c.date === dateFilter : true;
    return matchesUser && matchesDate;
  });

  // Group check-ins by date
  const groupedCheckIns = filteredCheckIns.reduce((acc, checkIn) => {
    const date = checkIn.date;
    if (!acc[date]) {
      acc[date] = [];
    }
    acc[date].push(checkIn);
    return acc;
  }, {} as Record<string, CheckIn[]>);

  // Sort dates descending
  const sortedDates = Object.keys(groupedCheckIns).sort((a, b) => b.localeCompare(a));

  const formatDateHeader = (dateStr: string) => {
    // dateStr is YYYY-MM-DD
    const [year, month, day] = dateStr.split('-').map(Number);
    const date = new Date(year, month - 1, day);

    return new Intl.DateTimeFormat('pt-BR', {
      weekday: 'long',
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    }).format(date).toUpperCase();
  };

  const getSlotName = (slotId: string) => {
    return timeSlots.find(s => s.id === slotId)?.name || 'N/A';
  };

  const getUserName = (userId: string) => {
    return users.find(u => u.id === userId)?.name || 'Desconhecido';
  };

  const handleDelete = async (id: string) => {
    if (confirm('TEM CERTEZA QUE DESEJA EXCLUIR ESTE REGISTRO? ISSO PERMITIRÁ QUE O USUÁRIO FAÇA CHECK-IN NOVAMENTE HOJE.')) {
      try {
        await deleteCheckIn(id);
      } catch (error) {
        console.error("Error deleting check-in:", error);
        alert("Erro ao excluir registro.");
      }
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      {/* Filtros de Comando - Tema Claro */}
      {/* Filtros de Comando - Tema Claro */}
      <div className="bg-white p-4 rounded-[1.25rem] border border-slate-200 flex flex-col md:flex-row gap-4 items-end shadow-sm">
        <div className="flex-1 w-full group">
          <label className="block text-[8px] font-black text-slate-400 uppercase tracking-[0.4em] mb-1.5 ml-1">Atleta em Campo</label>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-lime-500 transition-colors w-3.5 h-3.5" />
            <input
              type="text"
              className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 font-bold placeholder:text-slate-200 focus:ring-4 focus:ring-lime-400/5 focus:border-lime-400 outline-none transition-all uppercase tracking-widest text-[10px]"
              placeholder="NOME OU DOCUMENTO..."
              value={userFilter}
              onChange={e => setUserFilter(e.target.value)}
            />
          </div>
        </div>
        <div className="w-full md:w-48 group">
          <label className="block text-[8px] font-black text-slate-400 uppercase tracking-[0.4em] mb-1.5 ml-1">Linha do Tempo</label>
          <div className="relative">
            <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-lime-500 transition-colors w-3.5 h-3.5" />
            <input
              type="date"
              className="w-full pl-10 pr-8 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 font-black focus:ring-4 focus:ring-lime-400/5 focus:border-lime-400 outline-none transition-all text-[11px]"
              value={dateFilter}
              onChange={e => setDateFilter(e.target.value)}
            />
            {dateFilter && (
              <button
                onClick={() => setDateFilter('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-rose-500 transition-colors"
                title="Limpar filtro de data"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>
        <button
          onClick={() => { setUserFilter(''); setDateFilter(getTodayStart()); }}
          className="px-5 py-2.5 bg-slate-100 text-slate-500 rounded-xl font-black uppercase tracking-[0.2em] text-[8px] hover:text-slate-900 border border-slate-200 transition-all flex items-center"
        >
          <Filter className="w-3 h-3 mr-1.5" />
          Resetar
        </button>
      </div>

      {/* Grid de Registros - Agrupados por Data */}
      <div className="space-y-8">
        {sortedDates.map(date => (
          <div key={date} className="space-y-3">
            <h3 className="flex items-center gap-2 text-base font-black italic uppercase font-sport text-slate-900 tracking-wider">
              <Calendar className="w-4 h-4 text-lime-500" />
              {formatDateHeader(date)}
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {groupedCheckIns[date].map((ci) => (
                <div key={ci.id} className="bg-white rounded-[1.25rem] border border-slate-200 overflow-hidden hover:border-lime-400 hover:-translate-y-1 transition-all shadow-md group">
                  <div className="p-3 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                    <div className="flex items-center gap-2">
                      <div className="p-1.5 bg-white border border-slate-200 rounded-lg text-lime-600 shadow-sm group-hover:scale-105 transition-transform">
                        <User className="w-4 h-4" />
                      </div>
                      <div>
                        <h4 className="font-black text-slate-900 italic uppercase font-sport tracking-widest leading-tight text-sm">{getUserName(ci.userId)}</h4>
                        {/* Assuming User ID format or just showing ID if logic to split is not robust */}
                        <p className="text-[9px] text-slate-400 font-black uppercase tracking-widest mt-0.5">ID: {ci.userId.substring(0, 8).toUpperCase()}</p>
                      </div>
                    </div>
                    <div className="bg-black text-lime-400 px-2 py-1 rounded-md flex items-center text-[9px] font-black shadow-lg italic font-sport ml-auto">
                      <Trophy className="w-3 h-3 mr-1" />
                      {ci.score.toFixed(1)} PTS
                    </div>
                    <button
                      onClick={() => handleDelete(ci.id)}
                      className="ml-2 p-1.5 text-slate-300 hover:text-rose-500 hover:bg-rose-50 rounded-lg transition-all"
                      title="Excluir Registro"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  <div className="p-4 space-y-3 text-slate-900">
                    <div className="grid grid-cols-2 gap-3">
                      <div className="flex items-center text-[9px] font-black uppercase tracking-widest text-slate-500">
                        <Calendar className="w-3 h-3 mr-1.5 text-lime-500/50" />
                        {ci.date}
                      </div>
                      <div className="flex items-center text-[9px] font-black uppercase tracking-widest text-slate-500">
                        <Clock className="w-3 h-3 mr-1.5 text-lime-500/50" />
                        {ci.time}
                      </div>
                    </div>

                    <div className="flex items-center text-[9px] font-black uppercase tracking-widest text-lime-700 bg-lime-50 p-2.5 rounded-lg border border-lime-100">
                      <Activity className="w-3 h-3 mr-2" />
                      BLOCO: {getSlotName(ci.timeSlotId)}
                    </div>

                    <div className="flex items-start p-2.5 bg-slate-50 rounded-lg border border-slate-100 relative group/map">
                      <MapPin className="w-3.5 h-3.5 mr-2 text-slate-400 mt-0.5" />
                      <div className="space-y-0.5 flex-1">
                        <div className="flex justify-between items-start">
                          <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Localização de Registro</p>
                          <a
                            href={`https://www.google.com/maps?q=${ci.latitude},${ci.longitude}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-[8px] font-black text-lime-600 hover:text-lime-700 uppercase tracking-widest border border-lime-200 bg-lime-50 px-1.5 py-0.5 rounded hover:bg-lime-100 transition-colors flex items-center gap-1"
                          >
                            Ver no Mapa
                            <MapPin className="w-2.5 h-2.5" />
                          </a>
                        </div>
                        {ci.address && (
                          <p className="text-[9px] text-slate-600 font-bold uppercase tracking-tight leading-tight mb-0.5">{ci.address}</p>
                        )}
                        <div className="flex gap-2 text-slate-400">
                          <p className="text-[8px] font-mono tracking-tighter">LAT: {ci.latitude.toFixed(6)}</p>
                          <p className="text-[8px] font-mono tracking-tighter">LNG: {ci.longitude.toFixed(6)}</p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {filteredCheckIns.length === 0 && (
        <div className="text-center py-32 bg-white rounded-[3rem] border-2 border-dashed border-slate-200">
          <ClipboardList className="w-20 h-20 text-slate-100 mx-auto mb-6" />
          <p className="text-slate-300 font-black uppercase tracking-[0.5em] italic">Zero Atletas Registrados no Período</p>
        </div>
      )}
    </div>
  );
};

export default CheckIns;
