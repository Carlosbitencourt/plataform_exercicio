import React, { useState, useEffect } from 'react';
import { Calendar, Clock, MapPin, User, Trophy, Search, Filter, ClipboardList, Activity } from 'lucide-react';
import { subscribeToCheckIns, subscribeToUsers, subscribeToTimeSlots } from '../../services/db';
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
    const matchesDate = c.date === dateFilter;
    return matchesUser && matchesDate;
  });

  const getSlotName = (slotId: string) => {
    return timeSlots.find(s => s.id === slotId)?.name || 'N/A';
  };

  const getUserName = (userId: string) => {
    return users.find(u => u.id === userId)?.name || 'Desconhecido';
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      {/* Filtros de Comando - Tema Claro */}
      <div className="bg-white p-8 rounded-[2.5rem] border border-slate-200 flex flex-col md:flex-row gap-6 items-end shadow-sm">
        <div className="flex-1 w-full group">
          <label className="block text-[9px] font-black text-slate-400 uppercase tracking-[0.4em] mb-3 ml-1">Atleta em Campo</label>
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-lime-500 transition-colors w-5 h-5" />
            <input
              type="text"
              className="w-full pl-14 pr-6 py-4 bg-slate-50 border border-slate-200 rounded-2xl text-slate-900 font-bold placeholder:text-slate-200 focus:ring-4 focus:ring-lime-400/5 focus:border-lime-400 outline-none transition-all uppercase tracking-widest text-xs"
              placeholder="NOME OU DOCUMENTO..."
              value={userFilter}
              onChange={e => setUserFilter(e.target.value)}
            />
          </div>
        </div>
        <div className="w-full md:w-64 group">
          <label className="block text-[9px] font-black text-slate-400 uppercase tracking-[0.4em] mb-3 ml-1">Linha do Tempo</label>
          <div className="relative">
            <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-lime-500 transition-colors w-5 h-5" />
            <input
              type="date"
              className="w-full pl-14 pr-6 py-4 bg-slate-50 border border-slate-200 rounded-2xl text-slate-900 font-black focus:ring-4 focus:ring-lime-400/5 focus:border-lime-400 outline-none transition-all"
              value={dateFilter}
              onChange={e => setDateFilter(e.target.value)}
            />
          </div>
        </div>
        <button
          onClick={() => { setUserFilter(''); setDateFilter(getTodayStart()); }}
          className="px-8 py-4 bg-slate-100 text-slate-500 rounded-2xl font-black uppercase tracking-[0.2em] text-[10px] hover:text-slate-900 border border-slate-200 transition-all flex items-center"
        >
          <Filter className="w-4 h-4 mr-2" />
          Resetar
        </button>
      </div>

      {/* Grid de Registros - Cards Brancos */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-8">
        {filteredCheckIns.map((ci) => (
          <div key={ci.id} className="bg-white rounded-[2.5rem] border border-slate-200 overflow-hidden hover:border-lime-400 hover:-translate-y-2 transition-all shadow-md group">
            <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-white border border-slate-200 rounded-2xl text-lime-600 shadow-sm group-hover:scale-110 transition-transform">
                  <User className="w-6 h-6" />
                </div>
                <div>
                  <h4 className="font-black text-slate-900 italic uppercase font-sport tracking-widest leading-tight">{getUserName(ci.userId)}</h4>
                  {/* Assuming User ID format or just showing ID if logic to split is not robust */}
                  <p className="text-[9px] text-slate-400 font-black uppercase tracking-[0.3em] mt-1">ID: {ci.userId.substring(0, 8).toUpperCase()}</p>
                </div>
              </div>
              <div className="bg-black text-lime-400 px-4 py-2 rounded-xl flex items-center text-xs font-black shadow-lg italic font-sport">
                <Trophy className="w-4 h-4 mr-1.5" />
                {ci.score.toFixed(1)} PTS
              </div>
            </div>

            <div className="p-8 space-y-6 text-slate-900">
              <div className="grid grid-cols-2 gap-6">
                <div className="flex items-center text-[10px] font-black uppercase tracking-widest text-slate-500">
                  <Calendar className="w-4 h-4 mr-3 text-lime-500/50" />
                  {ci.date}
                </div>
                <div className="flex items-center text-[10px] font-black uppercase tracking-widest text-slate-500">
                  <Clock className="w-4 h-4 mr-3 text-lime-500/50" />
                  {ci.time}
                </div>
              </div>

              <div className="flex items-center text-[10px] font-black uppercase tracking-[0.2em] text-lime-700 bg-lime-50 p-4 rounded-2xl border border-lime-100">
                <Activity className="w-4 h-4 mr-3" />
                BLOCO: {getSlotName(ci.timeSlotId)}
              </div>

              <div className="flex items-start p-4 bg-slate-50 rounded-2xl border border-slate-100">
                <MapPin className="w-5 h-5 mr-4 text-slate-400 mt-1" />
                <div className="space-y-1">
                  <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Coordenadas de Registro</p>
                  <p className="text-[10px] text-slate-900 font-mono tracking-tighter">LAT: {ci.latitude.toFixed(6)}</p>
                  <p className="text-[10px] text-slate-900 font-mono tracking-tighter">LNG: {ci.longitude.toFixed(6)}</p>
                </div>
              </div>
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
