import React, { useState, useEffect } from 'react';
import { Calendar, Clock, MapPin, User, Trophy, Search, Filter, ClipboardList, Activity, Trash2, X, Image as ImageIcon, Maximize2, Loader2, CheckCircle2 } from 'lucide-react';
import { subscribeToCheckIns, subscribeToUsers, subscribeToTimeSlots, deleteCheckIn, addCheckIn } from '../../services/db';
import { Plus } from 'lucide-react';
import { CheckIn, User as UserType, TimeSlot } from '../../types';

const CheckIns: React.FC = () => {
  const [checkIns, setCheckIns] = useState<CheckIn[]>([]);
  const [users, setUsers] = useState<UserType[]>([]);
  const [timeSlots, setTimeSlots] = useState<TimeSlot[]>([]);
  const [selectedPhoto, setSelectedPhoto] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Form State
  const [formData, setFormData] = useState({
    userId: '',
    timeSlotId: '',
    date: new Date().toISOString().split('T')[0],
    time: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
    score: 10
  });

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

  const handleClearToday = async () => {
    const today = getTodayStart();
    const todayCheckIns = checkIns.filter(c => c.date === today);

    if (todayCheckIns.length === 0) {
      alert("Nenhum check-in encontrado para hoje.");
      return;
    }

    if (confirm(`TEM CERTEZA? ISSO APAGARÁ ${todayCheckIns.length} CHECK-INS DE HOJE (${today})\nE DESCONTARÁ OS PONTOS DOS ATLETAS.\n\nESTA AÇÃO NÃO PODE SER DESFEITA.`)) {
      try {
        // Delete sequentially to avoid potential race conditions on updating same user? 
        // Actually Promise.all is fine usually, but let's be safe if multiple checkins for same user exist (unlikely but possible).
        // Since deleteCheckIn updates user doc, concurrent updates to same user doc might conflict without transactions.
        // For safety, we can process them.
        const deletionPromises = todayCheckIns.map(c => deleteCheckIn(c.id));
        await Promise.all(deletionPromises);
      } catch (error) {
        console.error("Error clearing today:", error);
        alert("Erro ao limpar dados de hoje.");
      }
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.userId || !formData.timeSlotId) {
      alert("Por favor, selecione o atleta e o bloco.");
      return;
    }

    setIsSaving(true);
    try {
      await addCheckIn({
        ...formData,
        latitude: 0,
        longitude: 0,
        accuracy: 0,
        address: 'Registro Manual (Admin)',
        createdAt: new Date().toISOString()
      });
      setIsModalOpen(false);
      // Reset form
      setFormData({
        userId: '',
        timeSlotId: '',
        date: getTodayStart(),
        time: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
        score: 10
      });
    } catch (error) {
      console.error("Error saving manual check-in:", error);
      alert("Erro ao salvar registro.");
    } finally {
      setIsSaving(false);
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

        <button
          onClick={handleClearToday}
          className="px-5 py-2.5 bg-rose-100 text-rose-600 rounded-xl font-black uppercase tracking-[0.2em] text-[8px] hover:bg-rose-500 hover:text-white border border-rose-200 transition-all flex items-center shadow-sm"
        >
          <Trash2 className="w-3 h-3 mr-1.5" />
          LIMPAR HOJE
        </button>

        <button
          onClick={() => setIsModalOpen(true)}
          className="px-5 py-2.5 bg-lime-400 text-black rounded-xl font-black uppercase tracking-[0.2em] text-[8px] hover:bg-white border-2 border-lime-500 transition-all flex items-center shadow-lg transform hover:scale-105 active:scale-95"
        >
          <Plus className="w-3.5 h-3.5 mr-1.5" />
          NOVO REGISTRO
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

                    {ci.photoUrl && (
                      <div className="pt-2">
                        <div className="relative group/photo rounded-xl overflow-hidden border border-slate-200 bg-slate-50 aspect-video">
                          <img
                            src={ci.photoUrl}
                            alt="Evidência do exercício"
                            className="w-full h-full object-cover transition-transform duration-500 group-hover/photo:scale-110"
                          />
                          <div className="absolute inset-0 bg-black/40 opacity-0 group-hover/photo:opacity-100 transition-opacity flex items-center justify-center backdrop-blur-[2px]">
                            <button
                              onClick={() => setSelectedPhoto(ci.photoUrl!)}
                              className="bg-white text-black px-4 py-2 rounded-lg font-black uppercase text-[10px] tracking-widest flex items-center gap-2 shadow-xl transform translate-y-4 group-hover/photo:translate-y-0 transition-all duration-300"
                            >
                              <Maximize2 className="w-3.5 h-3.5" />
                              VER FOTO
                            </button>
                          </div>
                          <div className="absolute top-2 left-2 px-2 py-1 bg-black/60 backdrop-blur-md rounded-md text-white text-[8px] font-black uppercase tracking-widest flex items-center gap-1.5 border border-white/10">
                            <ImageIcon className="w-2.5 h-2.5 text-lime-400" />
                            EVIDÊNCIA ANEXADA
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Modal de Registro Manual */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-[2rem] border-4 border-slate-200 shadow-2xl w-full max-w-lg overflow-hidden animate-in zoom-in duration-300">
            <div className="p-6 bg-slate-50 border-b-4 border-slate-100 flex justify-between items-center">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-lime-400 rounded-xl shadow-lg shadow-lime-400/20">
                  <ClipboardList className="w-6 h-6 text-black" />
                </div>
                <div>
                  <h3 className="text-xl font-black italic uppercase font-sport text-slate-900 tracking-widest leading-none">Novo Registro Manual</h3>
                  <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mt-1">Atribuir check-in a um atleta</p>
                </div>
              </div>
              <button onClick={() => setIsModalOpen(false)} className="p-2 hover:bg-slate-200 rounded-full transition-colors">
                <X className="w-6 h-6 text-slate-400" />
              </button>
            </div>

            <form onSubmit={handleSave} className="p-6 space-y-5">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                {/* Atleta Selection */}
                <div className="col-span-1 md:col-span-2">
                  <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2 ml-1">Selecionar Atleta</label>
                  <select
                    className="w-full px-4 py-3 bg-slate-100 border-2 border-slate-200 rounded-xl text-slate-900 font-bold focus:ring-2 focus:ring-lime-400 transition-all outline-none text-xs"
                    value={formData.userId}
                    onChange={e => setFormData({ ...formData, userId: e.target.value })}
                  >
                    <option value="">Escolha um atleta...</option>
                    {users
                      .filter(u => u.status !== 'eliminado')
                      .sort((a, b) => a.name.localeCompare(b.name))
                      .map(u => (
                        <option key={u.id} value={u.id}>{u.name.toUpperCase()}</option>
                      ))
                    }
                  </select>
                </div>

                {/* Bloco Selection */}
                <div className="col-span-1 md:col-span-2">
                  <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2 ml-1">Bloco de Horário</label>
                  <select
                    className="w-full px-4 py-3 bg-slate-100 border-2 border-slate-200 rounded-xl text-slate-900 font-bold focus:ring-2 focus:ring-lime-400 transition-all outline-none text-xs"
                    value={formData.timeSlotId}
                    onChange={e => {
                      const slot = timeSlots.find(s => s.id === e.target.value);
                      setFormData({
                        ...formData,
                        timeSlotId: e.target.value,
                        score: slot ? 10 * (slot.weight || 1) : 10
                      });
                    }}
                  >
                    <option value="">Escolha o bloco...</option>
                    {timeSlots.map(s => (
                      <option key={s.id} value={s.id}>{s.name.toUpperCase()} (Peso: {s.weight || 1})</option>
                    ))}
                  </select>
                </div>

                {/* Data */}
                <div>
                  <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2 ml-1">Data</label>
                  <input
                    type="date"
                    className="w-full px-4 py-3 bg-slate-100 border-2 border-slate-200 rounded-xl text-slate-900 font-bold focus:ring-2 focus:ring-lime-400 transition-all outline-none text-xs"
                    value={formData.date}
                    onChange={e => setFormData({ ...formData, date: e.target.value })}
                  />
                </div>

                {/* Hora */}
                <div>
                  <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2 ml-1">Hora</label>
                  <input
                    type="time"
                    className="w-full px-4 py-3 bg-slate-100 border-2 border-slate-200 rounded-xl text-slate-900 font-bold focus:ring-2 focus:ring-lime-400 transition-all outline-none text-xs"
                    value={formData.time}
                    onChange={e => setFormData({ ...formData, time: e.target.value })}
                  />
                </div>

                {/* Pontuação */}
                <div className="col-span-1 md:col-span-2">
                  <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2 ml-1">Pontuação Gerada</label>
                  <div className="flex items-center gap-4">
                    <input
                      type="number"
                      className="flex-1 px-4 py-3 bg-slate-100 border-2 border-slate-200 rounded-xl text-slate-900 font-bold focus:ring-2 focus:ring-lime-400 transition-all outline-none text-xs"
                      value={formData.score}
                      onChange={e => setFormData({ ...formData, score: Number(e.target.value) })}
                    />
                    <div className="bg-black text-lime-400 px-4 py-3 rounded-xl flex items-center text-xs font-black italic font-sport border border-lime-400/30">
                      <Trophy className="w-4 h-4 mr-2" />
                      PTS
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="flex-1 py-4 bg-slate-100 text-slate-500 rounded-[1.25rem] font-bold uppercase tracking-widest text-[10px] hover:bg-slate-200 transition-all"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="flex-[2] py-4 bg-lime-400 text-black rounded-[1.25rem] font-black uppercase tracking-widest text-[10px] italic font-sport hover:bg-black hover:text-lime-400 transition-all shadow-lg flex items-center justify-center gap-2 group"
                >
                  {isSaving ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <>
                      <CheckCircle2 className="w-4 h-4 group-hover:scale-110 transition-transform" />
                      Confirmar Registro
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal de Foto em Tela Cheia */}
      {selectedPhoto && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/95 backdrop-blur-md p-4 sm:p-10 animate-in fade-in duration-300"
          onClick={() => setSelectedPhoto(null)}
        >
          <button
            className="absolute top-6 right-6 p-3 bg-white/10 hover:bg-white/20 rounded-full text-white transition-all z-[60]"
            onClick={() => setSelectedPhoto(null)}
          >
            <X className="w-6 h-6" />
          </button>

          <div className="relative max-w-5xl w-full h-full flex items-center justify-center animate-in zoom-in-95 duration-300">
            <img
              src={selectedPhoto}
              alt="Foto em tamanho real"
              className="max-w-full max-h-full object-contain rounded-2xl shadow-2xl border border-white/10"
              onClick={(e) => e.stopPropagation()}
            />
          </div>
        </div>
      )}
    </div >
  );
};

export default CheckIns;
