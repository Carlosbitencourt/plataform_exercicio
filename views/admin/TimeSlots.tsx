import React, { useState, useEffect } from 'react';
import { Clock, Plus, Trash2, Shield, Zap, X, Pencil } from 'lucide-react';
import { subscribeToTimeSlots, addTimeSlot, deleteTimeSlot, updateTimeSlot } from '../../services/db';
import { TimeSlot } from '../../types';
import { GYM_LOCATION } from '../../constants';

const DAYS = [
  { id: 0, label: 'DOM' },
  { id: 1, label: 'SEG' },
  { id: 2, label: 'TER' },
  { id: 3, label: 'QUA' },
  { id: 4, label: 'QUI' },
  { id: 5, label: 'SEX' },
  { id: 6, label: 'SÁB' },
];

const TimeSlots: React.FC = () => {
  const [slots, setSlots] = useState<TimeSlot[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingSlotId, setEditingSlotId] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    startTime: '',
    endTime: '',
    weight: 1,
    days: [1, 2, 3, 4, 5], // Default SEG-SEX
    locationName: 'ACADEMIA SEDE',
    latitude: GYM_LOCATION.lat,
    longitude: GYM_LOCATION.lng,
    radius: GYM_LOCATION.radius
  });

  useEffect(() => {
    const unsubscribe = subscribeToTimeSlots((data) => {
      setSlots(data);
    });
    return () => unsubscribe();
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (formData.days.length === 0) {
      alert("Selecione pelo menos um dia da semana.");
      return;
    }
    try {
      if (editingSlotId) {
        await updateTimeSlot({ id: editingSlotId, ...formData });
      } else {
        await addTimeSlot(formData);
      }

      setFormData({
        name: '',
        startTime: '',
        endTime: '',
        weight: 1,
        days: [1, 2, 3, 4, 5],
        locationName: 'ACADEMIA SEDE',
        latitude: GYM_LOCATION.lat,
        longitude: GYM_LOCATION.lng,
        radius: GYM_LOCATION.radius
      });
      setEditingSlotId(null);
      setIsModalOpen(false);
    } catch (error: any) {
      console.error("Error saving time slot:", error);
      if (error.code === 'permission-denied') {
        alert("Erro: Permissão negada. Verifique se você está logado como administrador.");
      } else {
        alert(`Erro ao salvar horário: ${error.message || 'Erro desconhecido'}`);
      }
    }
  };

  const handleEdit = (slot: TimeSlot) => {
    setEditingSlotId(slot.id);
    setFormData({
      name: slot.name,
      startTime: slot.startTime,
      endTime: slot.endTime,
      weight: slot.weight,
      days: slot.days,
      locationName: slot.locationName,
      latitude: slot.latitude,
      longitude: slot.longitude,
      radius: slot.radius
    });
    setIsModalOpen(true);
  };


  const handleDelete = async (id: string) => {
    if (confirm('REMOVER ESTE BLOCO DE HORÁRIO?')) {
      try {
        await deleteTimeSlot(id);
      } catch (error) {
        console.error("Error deleting time slot:", error);
        alert("Erro ao remover horário.");
      }
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="space-y-0.5">
          <h3 className="text-2xl font-black italic uppercase font-sport text-slate-900 tracking-widest leading-none">Células de Treino</h3>
          <p className="text-slate-400 font-black uppercase text-[10px] tracking-widest">Configuração de Janelas de Check-in</p>
        </div>
        <button
          onClick={() => {
            setEditingSlotId(null);
            setFormData({
              name: '',
              startTime: '',
              endTime: '',
              weight: 1,
              days: [1, 2, 3, 4, 5],
              locationName: 'ACADEMIA SEDE',
              latitude: GYM_LOCATION.lat,
              longitude: GYM_LOCATION.lng,
              radius: GYM_LOCATION.radius
            });
            setIsModalOpen(true);
          }}
          className="flex items-center px-4 py-2.5 bg-black text-lime-400 rounded-xl font-black uppercase italic tracking-tighter hover:bg-zinc-900 hover:scale-[1.05] transition-all shadow-xl active:scale-95 text-[10px]"
        >
          <Plus className="w-4 h-4 mr-1.5" />
          Novo Horário
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {slots.map((slot) => (
          <div key={slot.id} className="bg-white rounded-xl border-2 border-slate-300 overflow-hidden shadow-md group relative transition-all hover:border-lime-500 hover:-translate-y-1">
            <div className="p-5 space-y-3">
              <div className="flex justify-between items-start">
                <div className="p-2 bg-slate-50 border-2 border-slate-100 rounded-lg text-slate-900 shadow-inner group-hover:border-lime-200 transition-colors">
                  <Clock className="w-5 h-5" />
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => handleEdit(slot)}
                    className="p-1.5 bg-white text-slate-300 hover:text-blue-500 border border-slate-100 rounded-md transition-all hover:border-blue-200"
                  >
                    <Pencil className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => handleDelete(slot.id)}
                    className="p-1.5 bg-white text-slate-300 hover:text-rose-600 border border-slate-100 rounded-md transition-all hover:border-rose-200"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              <div>
                <h4 className="text-lg font-black text-slate-900 uppercase italic font-sport tracking-widest">{slot.name}</h4>
                <div className="flex flex-wrap items-center gap-2 mt-1.5">
                  <span className="px-2.5 py-0.5 bg-black text-white text-[10px] font-black rounded-md uppercase tracking-widest">
                    {slot.startTime} - {slot.endTime}
                  </span>
                  <div className="flex gap-1">
                    {DAYS.filter(d => slot.days?.includes(d.id)).map(d => (
                      <span key={d.id} className="text-[8px] font-black text-lime-600 bg-lime-50 px-1.5 py-0.5 rounded border border-lime-100 uppercase">
                        {d.label}
                      </span>
                    ))}
                  </div>
                </div>
                <div className="mt-2.5 flex items-center gap-1.5 text-slate-400 group-hover:text-slate-600 transition-colors">
                  <Shield className="w-3 h-3" />
                  <span className="text-[9px] font-black uppercase tracking-widest">{slot.locationName || 'LOCAL PADRÃO'}</span>
                </div>
              </div>

              <div className="flex items-center justify-between p-2.5 bg-slate-50 rounded-lg border border-slate-100">
                <div className="flex items-center gap-2">
                  <div className="p-1 bg-lime-400 rounded-md shadow-sm">
                    <Zap className="w-3 h-3 text-black fill-current" />
                  </div>
                  <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Peso Recompensa</span>
                </div>
                <span className="text-2xl font-black text-slate-900 font-sport italic tracking-tighter">
                  x{slot.weight}
                </span>
              </div>
            </div>

            <div className="h-1.5 bg-slate-100 group-hover:bg-lime-400 transition-colors"></div>
          </div>
        ))}
      </div>

      <div className="bg-white border-2 border-slate-300 p-4 rounded-[1.25rem] relative overflow-hidden group shadow-sm flex items-center gap-4">
        <div className="absolute top-0 left-0 w-1 h-full bg-slate-900"></div>
        <div className="p-2.5 bg-slate-50 border border-slate-100 rounded-lg text-slate-400">
          <Shield className="w-5 h-5" />
        </div>
        <div>
          <h4 className="font-black italic uppercase font-sport text-slate-900 tracking-widest text-base">Regras do Sistema</h4>
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-0.5">
            Check-ins realizados fora destas janelas serão invalidados automaticamente pelo servidor.
          </p>
        </div>
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-[1.5rem] border-4 border-slate-200 shadow-2xl w-full max-w-sm overflow-hidden animate-in zoom-in duration-300">
            <div className="p-4 bg-slate-50 flex justify-between items-center border-b border-slate-100">
              <h3 className="text-base font-black italic uppercase font-sport text-slate-900 tracking-widest leading-none">
                {editingSlotId ? 'Editar Bloco' : 'Novo Bloco'}
              </h3>
              <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-900 p-1 bg-white rounded-md border border-slate-200">
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
            <form onSubmit={handleSave} className="p-5 overflow-hidden flex flex-col">
              <div className="space-y-3 overflow-y-auto max-h-[65vh] pr-1 custom-scrollbar pb-2">
                <div>
                  <label className="block text-[8px] font-black text-slate-500 uppercase tracking-widest mb-1">Identificação do Bloco</label>
                  <input
                    required
                    type="text"
                    placeholder="EX: MANHÃ ELITE"
                    className="w-full px-3 py-2.5 bg-slate-50 border-2 border-slate-200 rounded-lg text-slate-900 font-bold focus:ring-2 focus:ring-lime-400 transition-all outline-none uppercase text-[13px]"
                    value={formData.name}
                    onChange={e => setFormData({ ...formData, name: e.target.value })}
                  />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[8px] font-black text-slate-500 uppercase tracking-widest mb-1">Abertura</label>
                    <input
                      required
                      type="time"
                      className="w-full px-3 py-2 bg-slate-50 border-2 border-slate-200 rounded-lg text-slate-900 font-bold text-xs"
                      value={formData.startTime}
                      onChange={e => setFormData({ ...formData, startTime: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className="block text-[8px] font-black text-slate-500 uppercase tracking-widest mb-1">Fechamento</label>
                    <input
                      required
                      type="time"
                      className="w-full px-3 py-2 bg-slate-50 border-2 border-slate-200 rounded-lg text-slate-900 font-bold text-xs"
                      value={formData.endTime}
                      onChange={e => setFormData({ ...formData, endTime: e.target.value })}
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-[8px] font-black text-slate-500 uppercase tracking-widest mb-2">Dias de Ativação</label>
                  <div className="flex flex-wrap gap-1">
                    {DAYS.map(day => (
                      <button
                        key={day.id}
                        type="button"
                        onClick={() => {
                          const newDays = formData.days.includes(day.id)
                            ? formData.days.filter(d => d !== day.id)
                            : [...formData.days, day.id];
                          setFormData({ ...formData, days: newDays });
                        }}
                        className={`px-2 py-1 rounded-md text-[8px] font-black uppercase tracking-widest transition-all border-2 ${formData.days.includes(day.id)
                          ? 'bg-lime-400 border-lime-400 text-black shadow-lg shadow-lime-400/20'
                          : 'bg-white border-slate-100 text-slate-300 hover:border-slate-300'
                          }`}
                      >
                        {day.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-[8px] font-black text-slate-500 uppercase tracking-widest mb-1">Identificação do Local</label>
                  <input
                    required
                    type="text"
                    placeholder="EX: SEDE CENTRAL"
                    className="w-full px-3 py-2.5 bg-slate-50 border-2 border-slate-200 rounded-lg text-slate-900 font-bold focus:ring-2 focus:ring-lime-400 transition-all outline-none uppercase text-[13px]"
                    value={formData.locationName}
                    onChange={e => setFormData({ ...formData, locationName: e.target.value })}
                  />
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[8px] font-black text-slate-500 uppercase tracking-widest mb-1">Latitude</label>
                    <input
                      required
                      type="number"
                      step="any"
                      className="w-full px-3 py-2 bg-slate-50 border-2 border-slate-200 rounded-lg text-slate-900 font-bold text-xs"
                      value={formData.latitude}
                      onChange={e => setFormData({ ...formData, latitude: Number(e.target.value) })}
                    />
                  </div>
                  <div>
                    <label className="block text-[8px] font-black text-slate-500 uppercase tracking-widest mb-1">Longitude</label>
                    <input
                      required
                      type="number"
                      step="any"
                      className="w-full px-3 py-2 bg-slate-50 border-2 border-slate-200 rounded-lg text-slate-900 font-bold text-xs"
                      value={formData.longitude}
                      onChange={e => setFormData({ ...formData, longitude: Number(e.target.value) })}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[8px] font-black text-slate-500 uppercase tracking-widest mb-1">Raio Valid. (m)</label>
                    <input
                      required
                      type="number"
                      className="w-full px-3 py-2 bg-slate-50 border-2 border-slate-200 rounded-lg text-slate-900 font-bold text-xs"
                      value={formData.radius}
                      onChange={e => setFormData({ ...formData, radius: Number(e.target.value) })}
                    />
                  </div>
                  <div>
                    <label className="block text-[8px] font-black text-slate-500 uppercase tracking-widest mb-1">Peso Recompensa</label>
                    <input
                      required
                      type="number"
                      min="1"
                      max="10"
                      className="w-full px-3 py-2 bg-slate-900 text-lime-400 rounded-lg font-black text-[15px] border-none outline-none"
                      value={formData.weight}
                      onChange={e => setFormData({ ...formData, weight: Number(e.target.value) })}
                    />
                  </div>
                </div>
              </div>

              <div className="pt-3">
                <button
                  type="submit"
                  className="w-full py-3 bg-black text-lime-400 rounded-lg font-black uppercase italic tracking-tighter shadow-xl hover:scale-[1.02] active:scale-95 transition-all text-[11px]"
                >
                  {editingSlotId ? 'Salvar Alterações' : 'Registrar Bloco Sincronizado'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default TimeSlots;
