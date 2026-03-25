import React, { useState, useEffect } from 'react';
import { Store, Plus, Trash2, Pencil, Search, Camera, Upload } from 'lucide-react';
import { subscribeToPartners, addPartner, updatePartner, deletePartner } from '../../services/db';
import { safeUploadFile } from '../../services/firebaseGuard';
import { MarketplacePartner } from '../../types';

const Partners: React.FC = () => {
  const [partners, setPartners] = useState<MarketplacePartner[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingPartnerId, setEditingPartnerId] = useState<string | null>(null);
  
  const [uploading, setUploading] = useState(false);

  const [formData, setFormData] = useState({
    name: '',
    description: '',
    logoUrl: '',
    active: true,
  });

  useEffect(() => {
    const unsubscribe = subscribeToPartners((data) => {
      setPartners(data);
    });
    return () => unsubscribe();
  }, []);

  const handleOpenModal = (partner?: MarketplacePartner) => {
    if (partner) {
      setEditingPartnerId(partner.id);
      setFormData({
        name: partner.name,
        description: partner.description || '',
        logoUrl: partner.logoUrl || '',
        active: partner.active,
      });
    } else {
      setEditingPartnerId(null);
      setFormData({
        name: '',
        description: '',
        logoUrl: '',
        active: true,
      });
    }
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setEditingPartnerId(null);
  };

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setUploading(true);
      const url = await safeUploadFile(file, `partners/${Date.now()}_${file.name}`);
      setFormData(prev => ({ ...prev, logoUrl: url }));
    } catch (error) {
      console.error("Error uploading photo:", error);
      alert("Erro ao fazer upload da imagem.");
    } finally {
      setUploading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      alert("O nome da loja é obrigatório.");
      return;
    }

    try {
      if (editingPartnerId) {
        await updatePartner({
          id: editingPartnerId,
          ...formData,
          createdAt: partners.find(p => p.id === editingPartnerId)?.createdAt || new Date().toISOString()
        });
      } else {
        await addPartner({
          ...formData,
          createdAt: new Date().toISOString()
        });
      }
      handleCloseModal();
    } catch (error) {
      console.error("Error saving partner:", error);
      alert("Erro ao salvar parceiro.");
    }
  };

  const handleDelete = async (id: string) => {
    if (window.confirm('Tem certeza que deseja excluir esta loja parceira?')) {
      try {
        await deletePartner(id);
      } catch (error) {
        console.error("Error deleting partner:", error);
        alert("Erro ao excluir parceiro.");
      }
    }
  };

  const filteredPartners = partners.filter(p => 
    p.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    p.description?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl font-black italic text-slate-900 uppercase tracking-tight flex items-center gap-3">
            <Store className="w-8 h-8 text-lime-500" />
            Lojas Parceiras
          </h1>
          <p className="text-sm text-slate-500 mt-1">Gerencie os parceiros e lojas do Marketplace.</p>
        </div>
        <button
          onClick={() => handleOpenModal()}
          className="bg-black text-lime-400 px-6 py-3 rounded-xl font-bold uppercase text-sm flex items-center gap-2 hover:bg-lime-400 hover:text-black transition-colors"
        >
          <Plus className="w-5 h-5" />
          Nova Loja
        </button>
      </div>

      {/* Search Bar */}
      <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 flex items-center gap-3">
        <Search className="w-5 h-5 text-slate-400" />
        <input
          type="text"
          placeholder="Buscar lojas..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="flex-1 bg-transparent border-none focus:ring-0 text-slate-900 placeholder:text-slate-400"
        />
      </div>

      {/* Partners List */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredPartners.map(partner => (
          <div key={partner.id} className={`bg-white rounded-2xl p-6 shadow-sm border-2 transition-all ${partner.active ? 'border-slate-200 hover:border-lime-400' : 'border-red-200 opacity-75'}`}>
            <div className="flex items-start gap-4">
              <div className="w-16 h-16 rounded-xl overflow-hidden shrink-0 border-2 border-slate-100 bg-slate-50 flex flex-col justify-center items-center">
                {partner.logoUrl ? (
                  <img src={partner.logoUrl} alt={partner.name} className="w-full h-full object-cover" />
                ) : (
                  <Store className="w-8 h-8 text-slate-300" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex justify-between items-start">
                  <h3 className="font-bold text-slate-900 truncate pr-2">{partner.name}</h3>
                  <div className={`px-2 py-1 rounded text-[10px] font-bold uppercase ${partner.active ? 'bg-lime-100 text-lime-700' : 'bg-red-100 text-red-700'}`}>
                    {partner.active ? 'Ativo' : 'Inativo'}
                  </div>
                </div>
                <p className="text-xs text-slate-500 mt-1 line-clamp-2">{partner.description || 'Sem descrição'}</p>
              </div>
            </div>

            <div className="mt-6 flex justify-end gap-2 border-t border-slate-100 pt-4">
              <button
                onClick={() => handleOpenModal(partner)}
                className="p-2 text-slate-400 hover:text-blue-500 hover:bg-blue-50 rounded-lg transition-colors"
                title="Editar"
              >
                <Pencil className="w-5 h-5" />
              </button>
              <button
                onClick={() => handleDelete(partner.id)}
                className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                title="Excluir"
              >
                <Trash2 className="w-5 h-5" />
              </button>
            </div>
          </div>
        ))}
        {filteredPartners.length === 0 && (
          <div className="col-span-full py-12 text-center text-slate-500">
            Nenhuma loja parceira encontrada.
          </div>
        )}
      </div>

      {/* Modal Add/Edit */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-3xl w-full max-w-lg overflow-hidden shadow-2xl">
            <div className="p-6 border-b border-slate-100">
              <h2 className="text-xl font-black italic text-slate-900 uppercase">
                {editingPartnerId ? 'Editar Loja' : 'Nova Loja'}
              </h2>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-6">
              
              {/* Logo Upload */}
              <div className="flex flex-col items-center gap-4">
                <div className="w-24 h-24 rounded-2xl bg-slate-100 border-2 border-dashed border-slate-300 flex items-center justify-center overflow-hidden relative group">
                  {formData.logoUrl ? (
                    <>
                      <img src={formData.logoUrl} alt="Logo" className="w-full h-full object-cover" />
                      <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                        <Camera className="w-6 h-6 text-white" />
                      </div>
                    </>
                  ) : (
                    <div className="flex flex-col items-center text-slate-400">
                      {uploading ? <Upload className="w-6 h-6 animate-bounce" /> : <Camera className="w-8 h-8" />}
                    </div>
                  )}
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handlePhotoUpload}
                    disabled={uploading}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer disabled:cursor-not-allowed"
                  />
                </div>
                <div className="text-center">
                  <p className="text-sm font-medium text-slate-700">Logo da Loja</p>
                  <p className="text-xs text-slate-500">Recomendado: 1:1, max 5MB</p>
                </div>
              </div>

              {/* Form Fields */}
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Nome da Loja</label>
                  <input
                    type="text"
                    required
                    value={formData.name}
                    onChange={e => setFormData({ ...formData, name: e.target.value })}
                    className="w-full bg-slate-50 border-2 border-slate-200 rounded-xl px-4 py-3 outline-none focus:border-black transition-colors font-medium text-slate-900"
                    placeholder="Ex: Suplementos Pro"
                  />
                </div>
                
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Descrição Breve</label>
                  <textarea
                    rows={3}
                    value={formData.description}
                    onChange={e => setFormData({ ...formData, description: e.target.value })}
                    className="w-full bg-slate-50 border-2 border-slate-200 rounded-xl px-4 py-3 outline-none focus:border-black transition-colors text-sm text-slate-900 resize-none"
                    placeholder="Loja especializada em..."
                  />
                </div>

                <label className="flex items-center gap-3 p-4 bg-slate-50 rounded-xl border-2 border-slate-200 cursor-pointer hover:border-slate-300 transition-colors">
                  <input
                    type="checkbox"
                    checked={formData.active}
                    onChange={e => setFormData({ ...formData, active: e.target.checked })}
                    className="w-5 h-5 text-black border-2 border-slate-300 rounded focus:ring-black"
                  />
                  <span className="font-bold text-slate-700 uppercase text-sm">Loja Ativa no Marketplace</span>
                </label>
              </div>

              <div className="flex justify-end gap-3 pt-6 border-t border-slate-100">
                <button
                  type="button"
                  onClick={handleCloseModal}
                  className="px-6 py-3 font-bold text-slate-500 hover:bg-slate-100 rounded-xl uppercase text-sm transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={uploading}
                  className="bg-lime-400 text-black px-8 py-3 rounded-xl font-bold uppercase text-sm hover:bg-lime-500 transition-colors disabled:opacity-50"
                >
                  {uploading ? 'Salvando...' : 'Salvar Loja'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Partners;
