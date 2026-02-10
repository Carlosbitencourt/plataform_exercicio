
import React, { useState, useEffect } from 'react';
// Replaced ShieldInfo with Shield which exists in lucide-react
import { Clock, Plus, Trash2, Shield, Zap, X } from 'lucide-react';
import { getDB, addTimeSlot, deleteTimeSlot } from '../../services/storage';
import { TimeSlot } from '../../types';

const TimeSlots: React.FC = () => {
  const [slots, setSlots] = useState<TimeSlot[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    startTime: '',
    endTime: '',
    weight: 1
  });

  useEffect(() => {
    loadSlots();
  }, []);

  const loadSlots = () => {
    setSlots(getDB().timeSlots);
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    addTimeSlot(formData);
    setFormData({ name: '', startTime: '', endTime: '', weight: 1 });
    setIsModalOpen(false);
    loadSlots();
  };

  const handleDelete = (id: string) => {
    if (confirm('REMOVER ESTE BLOCO DE HORÁRIO?')) {
      deleteTimeSlot(id);
      loadSlots();
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
        <div className="space-y-1">
          <h3 className="text-3xl font-black italic uppercase font-sport text-slate-900 tracking-widest leading-none">Células de Treino</h3>
          <p className="text-slate-400 font-black uppercase text-[10px] tracking-[0.4em]">Configuração de Janelas de Check-in</p>
        </div>
        <button
          onClick={() => setIsModalOpen(true)}
          className="flex items-center px-8 py-4 bg-black text-lime-400 rounded-2xl font-black uppercase italic tracking-tighter hover:bg-zinc-900 hover:scale-[1.05] transition-all shadow-2xl active:scale-95"
        >
          <Plus className="w-6 h-6 mr-2" />
          Novo Horário
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-8">
        {slots.map((slot) => (
          <div key={slot.id} className="bg-white rounded-[2rem] border-2 border-slate-300 overflow-hidden shadow-lg group relative transition-all hover:border-lime-500 hover:-translate-y-1">
            <div className="p-8 space-y-6">
              <div className="flex justify-between items-start">
                <div className="p-4 bg-slate-50 border-2 border-slate-100 rounded-2xl text-slate-900 shadow-inner group-hover:border-lime-200 transition-colors">
                  <Clock className="w-8 h-8" />
                </div>
                <button 
                  onClick={() => handleDelete(slot.id)}
                  className="p-3 bg-white text-slate-300 hover:text-rose-600 border-2 border-slate-100 rounded-xl transition-all hover:border-rose-200"
                >
                  <Trash2 className="w-5 h-5" />
                </button>
              </div>

              <div>
                <h4 className="text-xl font-black text-slate-900 uppercase italic font-sport tracking-widest">{slot.name}</h4>
                <div className="flex items-center gap-2 mt-2">
                  <span className="px-3 py-1 bg-black text-white text-[10px] font-black rounded-lg uppercase tracking-widest">
                    {slot.startTime} - {slot.endTime}
                  </span>
                </div>
              </div>

              <div className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl border-2 border-slate-100">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-lime-400 rounded-lg shadow-sm">
                    <Zap className="w-4 h-4 text-black fill-current" />
                  </div>
                  <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Peso Recompensa</span>
                </div>
                <span className="text-3xl font-black text-slate-900 font-sport italic tracking-tighter">
                  x{slot.weight}
                </span>
              </div>
            </div>
            
            <div className="h-2 bg-slate-100 group-hover:bg-lime-400 transition-colors"></div>
          </div>
        ))}
      </div>

      <div className="bg-white border-2 border-slate-300 p-8 rounded-[2.5rem] relative overflow-hidden group shadow-md flex items-center gap-6">
        <div className="absolute top-0 left-0 w-2 h-full bg-slate-900"></div>
        <div className="p-4 bg-slate-50 border-2 border-slate-100 rounded-2xl text-slate-400">
          {/* Changed ShieldInfo to Shield */}
          <Shield className="w-8 h-8" />
        </div>
        <div>
          <h4 className="font-black italic uppercase font-sport text-slate-900 tracking-[0.2em] text-lg">Regras do Sistema</h4>
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">
            Check-ins realizados fora destas janelas serão invalidados automaticamente pelo servidor.
          </p>
        </div>
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-[3rem] border-4 border-slate-200 shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in duration-300">
            <div className="p-8 bg-slate-50 flex justify-between items-center border-b-4 border-slate-100">
              <h3 className="text-2xl font-black italic uppercase font-sport text-slate-900 tracking-widest">
                Novo Bloco
              </h3>
              <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-900 p-2 bg-white rounded-xl border-2 border-slate-200">
                <X className="w-6 h-6" />
              </button>
            </div>
            <form onSubmit={handleSave} className="p-10 space-y-6">
              <div>
                <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2">Identificação do Bloco</label>
                <input
                  required
                  type="text"
                  placeholder="EX: MANHÃ ELITE"
                  className="w-full px-5 py-4 bg-slate-50 border-2 border-slate-200 rounded-2xl text-slate-900 font-bold focus:ring-2 focus:ring-lime-400 transition-all outline-none uppercase"
                  value={formData.name}
                  onChange={e => setFormData({ ...formData, name: e.target.value })}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2">Abertura</label>
                  <input
                    required
                    type="time"
                    className="w-full px-5 py-4 bg-slate-50 border-2 border-slate-200 rounded-2xl text-slate-900 font-bold"
                    value={formData.startTime}
                    onChange={e => setFormData({ ...formData, startTime: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2">Fechamento</label>
                  <input
                    required
                    type="time"
                    className="w-full px-5 py-4 bg-slate-50 border-2 border-slate-200 rounded-2xl text-slate-900 font-bold"
                    value={formData.endTime}
                    onChange={e => setFormData({ ...formData, endTime: e.target.value })}
                  />
                </div>
              </div>
              <div>
                <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2">Peso da Recompensa (Multiplicador)</label>
                <input
                  required
                  type="number"
                  min="1"
                  max="10"
                  className="w-full px-5 py-4 bg-white border-2 border-slate-900 rounded-2xl text-slate-900 font-black text-xl"
                  value={formData.weight}
                  onChange={e => setFormData({ ...formData, weight: Number(e.target.value) })}
                />
              </div>
              <div className="flex gap-4 pt-4">
                <button
                  type="submit"
                  className="flex-1 py-5 bg-black text-lime-400 rounded-2xl font-black uppercase italic tracking-tighter shadow-xl hover:scale-[1.05] transition-all"
                >
                  Registrar Bloco
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
