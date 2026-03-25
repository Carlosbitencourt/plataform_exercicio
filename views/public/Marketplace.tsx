import { useState, useEffect } from 'react';
import {
  ShoppingBag, Coins, Wallet, Lock, Package,
  CheckCircle2, AlertCircle, Loader2, Sparkles, Tag, Star, Store, MapPin, X
} from 'lucide-react';
import { User, MarketplaceProduct, MarketplacePartner } from '../../types';
import {
  subscribeToMarketplaceProducts,
  purchaseMarketplaceProduct,
  subscribeToUsers,
  subscribeToPartners
} from '../../services/db';
import { useAuth } from '../../contexts/AuthContext';

export default function Marketplace() {
  const { currentUser } = useAuth();
  const [user, setUser] = useState<User | null>(null);
  const [products, setProducts] = useState<MarketplaceProduct[]>([]);
  const [partners, setPartners] = useState<MarketplacePartner[]>([]);
  const [loading, setLoading] = useState(true);
  const [buying, setBuying] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  
  const [activeTab, setActiveTab] = useState<'produtos' | 'categorias' | 'lojas'>('produtos');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [selectedPartner, setSelectedPartner] = useState<string | null>(null);

  const uniqueCategories = Array.from(new Set(products.map(p => p.category).filter(Boolean))) as string[];

  useEffect(() => {
    if (!currentUser?.email) return;
    return subscribeToUsers(users => {
      const found =
        users.find(u => u.id === currentUser.uid) ||
        users.find(u => u.email?.toLowerCase() === currentUser.email?.toLowerCase());
      if (found) setUser(found);
    });
  }, [currentUser]);

  useEffect(() => {
    const unsubProducts = subscribeToMarketplaceProducts(prods => {
      setProducts(prods.filter(p => p.active));
      setLoading(false);
    });
    const unsubPartners = subscribeToPartners(setPartners);

    return () => {
      unsubProducts();
      unsubPartners();
    };
  }, []);

  const handleBuy = async (product: MarketplaceProduct) => {
    if (!user) return;
    setBuying(product.id);
    setError(null);
    setSuccess(null);
    try {
      await purchaseMarketplaceProduct(user.id, product);
      setSuccess(`"${product.name}" resgatado com sucesso! 🎉`);
      setTimeout(() => setSuccess(null), 4500);
    } catch (err: any) {
      setError(err.message || 'Erro ao realizar compra.');
      setTimeout(() => setError(null), 4500);
    } finally {
      setBuying(null);
    }
  };

  const canAfford = (p: MarketplaceProduct) => {
    if (!user) return false;
    if (p.costCoins && (user.coins ?? 0) < p.costCoins) return false;
    if (p.costFreeBalance && (user.freeBalance ?? 0) < p.costFreeBalance) return false;
    if (p.costLockedBalance && (user.lockedBalance ?? 0) < p.costLockedBalance) return false;
    return true;
  };

  const filtered = products.filter(p => 
    (!selectedCategory || p.category === selectedCategory) &&
    (!selectedPartner || p.partnerId === selectedPartner)
  );

  return (
    <div className="min-h-screen pb-28" style={{ background: '#080808' }}>

      {/* ─── STICKY HEADER ─── */}
      <div
        className="sticky top-0 z-20 border-b px-4 pt-5 pb-0"
        style={{ background: 'rgba(8,8,8,0.95)', backdropFilter: 'blur(20px)', borderColor: 'rgba(255,255,255,0.05)' }}
      >
        {/* Title */}
        <div className="flex items-center gap-3 mb-4">
          <div
            className="w-10 h-10 rounded-2xl flex items-center justify-center shrink-0"
            style={{ background: '#a3e635', boxShadow: '0 4px 14px rgba(163,230,53,0.2)' }}
          >
            <ShoppingBag size={20} className="text-[#064e3b]" />
          </div>
          <div className="flex-1">
            <h1 className="font-black text-white tracking-widest uppercase text-sm leading-none">Marketplace</h1>
            <p className="text-[9px] text-zinc-600 font-semibold mt-0.5">
              {products.length} {products.length === 1 ? 'produto disponível' : 'produtos disponíveis'}
            </p>
          </div>
          <Sparkles size={14} className="text-[#a3e635] opacity-40 shadow-sm" />
        </div>

        {/* Wallet strip */}
        {user && (
          <div
            className="flex gap-2 mb-4 p-3 rounded-2xl border"
            style={{ background: 'rgba(255,255,255,0.02)', borderColor: 'rgba(255,255,255,0.06)' }}
          >
            <div className="flex-1 text-center border-r" style={{ borderColor: 'rgba(255,255,255,0.06)' }}>
              <p className="text-[7px] font-black uppercase tracking-widest text-zinc-600 mb-0.5">Moedas</p>
              <p className="text-sm font-black" style={{ color: '#facc15' }}>
                {(user.coins ?? 0).toLocaleString('pt-BR')}
              </p>
            </div>
            <div className="flex-1 text-center border-r" style={{ borderColor: 'rgba(255,255,255,0.06)' }}>
              <p className="text-[7px] font-black uppercase tracking-widest text-zinc-600 mb-0.5">Saldo</p>
              <p className="text-sm font-black" style={{ color: '#4ade80' }}>
                R${(user.freeBalance ?? 0).toFixed(2)}
              </p>
            </div>
            <div className="flex-1 text-center">
              <p className="text-[7px] font-black uppercase tracking-widest text-zinc-600 mb-0.5">Travado</p>
              <p className="text-sm font-black" style={{ color: '#fb923c' }}>
                R${(user.lockedBalance ?? 0).toFixed(2)}
              </p>
            </div>
          </div>
        )}

        {/* Filters Info if any */}
        {(selectedCategory || selectedPartner) && activeTab === 'produtos' && (
          <div className="flex items-center gap-2 mb-4">
            <span className="text-[10px] font-black uppercase text-zinc-500">Filtrando por:</span>
            {selectedCategory && (
              <span className="flex items-center gap-1 bg-[#a3e635]/20 text-[#a3e635] px-2 py-1 rounded-lg text-[9px] font-bold">
                <Tag size={10} /> {selectedCategory}
                <button onClick={() => setSelectedCategory(null)} className="ml-1"><X size={10} /></button>
              </span>
            )}
            {selectedPartner && (
              <span className="flex items-center gap-1 bg-[#a3e635]/20 text-[#a3e635] px-2 py-1 rounded-lg text-[9px] font-bold">
                <Store size={10} /> {partners.find(p => p.id === selectedPartner)?.name}
                <button onClick={() => setSelectedPartner(null)} className="ml-1"><X size={10} /></button>
              </span>
            )}
            <button
              onClick={() => { setSelectedCategory(null); setSelectedPartner(null); }}
              className="text-[9px] font-bold text-red-400 ml-auto uppercase tracking-wide"
            >
              Limpar
            </button>
          </div>
        )}

        {/* Action Buttons (Produtos, Categorias e Lojas) */}
        <div className="flex gap-1.5 mb-4">
          <button
            onClick={() => setActiveTab('produtos')}
            className="flex-1 py-2.5 rounded-xl text-[9px] font-black uppercase tracking-wider flex items-center justify-center gap-1.5 transition-all active:scale-95"
            style={activeTab === 'produtos' 
              ? { background: '#a3e635', color: '#064e3b', boxShadow: '0 4px 14px rgba(163,230,53,0.2)' }
              : { background: 'rgba(255,255,255,0.04)', color: '#d4d4d8', border: '1px solid rgba(255,255,255,0.08)' }}
          >
            <Package size={12} className={activeTab === 'produtos' ? '' : 'opacity-70'} />
            Produtos
          </button>
          <button
            onClick={() => setActiveTab('categorias')}
            className="flex-1 py-2.5 rounded-xl text-[9px] font-black uppercase tracking-wider flex items-center justify-center gap-1.5 transition-all active:scale-95"
            style={activeTab === 'categorias' 
              ? { background: '#a3e635', color: '#064e3b', boxShadow: '0 4px 14px rgba(163,230,53,0.2)' }
              : { background: 'rgba(255,255,255,0.04)', color: '#d4d4d8', border: '1px solid rgba(255,255,255,0.08)' }}
          >
            <Tag size={12} className={activeTab === 'categorias' ? '' : 'opacity-70'} />
            Categorias
          </button>
          <button
            onClick={() => setActiveTab('lojas')}
            className="flex-1 py-2.5 rounded-xl text-[9px] font-black uppercase tracking-wider flex items-center justify-center gap-1.5 transition-all active:scale-95"
            style={activeTab === 'lojas' 
              ? { background: '#a3e635', color: '#064e3b', boxShadow: '0 4px 14px rgba(163,230,53,0.2)' }
              : { background: 'rgba(255,255,255,0.04)', color: '#d4d4d8', border: '1px solid rgba(255,255,255,0.08)' }}
          >
            <Store size={12} className={activeTab === 'lojas' ? '' : 'opacity-70'} />
            Lojas
          </button>
        </div>
      </div>

      {/* ─── ALERTS ─── */}
      <div className="px-4 pt-3 space-y-2">
        {success && (
          <div
            className="flex items-start gap-3 p-3.5 rounded-2xl border"
            style={{ background: 'rgba(74,222,128,0.08)', borderColor: 'rgba(74,222,128,0.2)' }}
          >
            <CheckCircle2 size={16} className="text-green-400 shrink-0 mt-0.5" />
            <p className="text-[11px] font-bold text-green-400 leading-relaxed">{success}</p>
          </div>
        )}
        {error && (
          <div
            className="flex items-start gap-3 p-3.5 rounded-2xl border"
            style={{ background: 'rgba(248,113,113,0.08)', borderColor: 'rgba(248,113,113,0.2)' }}
          >
            <AlertCircle size={16} className="text-red-400 shrink-0 mt-0.5" />
            <p className="text-[11px] font-bold text-red-400 leading-relaxed">{error}</p>
          </div>
        )}
      </div>

      {/* ─── PRODUCTS GRID ─── */}
      <div className="px-3 pt-4">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-24 gap-4">
            <Loader2 size={30} className="animate-spin" style={{ color: '#facc15' }} />
            <p className="text-[9px] font-black uppercase tracking-widest text-zinc-700">Carregando...</p>
          </div>
        ) : activeTab === 'categorias' ? (
          <div className="grid grid-cols-2 gap-3 w-full">
            {uniqueCategories.map(cat => (
              <button
                key={cat}
                onClick={() => { setSelectedCategory(cat); setActiveTab('produtos'); }}
                className="flex flex-col items-center justify-center gap-2 p-6 rounded-2xl border transition-all active:scale-95"
                style={{ background: 'rgba(255,255,255,0.02)', borderColor: 'rgba(255,255,255,0.06)' }}
              >
                <Tag size={24} className="text-[#a3e635]" />
                <span className="text-white font-bold text-sm text-center">{cat}</span>
              </button>
            ))}
            {uniqueCategories.length === 0 && (
              <div className="col-span-2 text-center py-10 text-zinc-500 text-xs">Nenhuma categoria encontrada</div>
            )}
          </div>
        ) : activeTab === 'lojas' ? (
           <div className="grid grid-cols-2 gap-3 w-full">
            {partners.map(p => (
              <button
                key={p.id}
                onClick={() => { setSelectedPartner(p.id); setActiveTab('produtos'); }}
                className="flex flex-col items-center justify-center gap-3 p-4 rounded-2xl border transition-all active:scale-95 text-center"
                style={{ background: 'rgba(255,255,255,0.02)', borderColor: 'rgba(255,255,255,0.06)' }}
              >
                {p.logoUrl ? (
                  <img src={p.logoUrl} alt={p.name} className="w-12 h-12 rounded-full object-cover border-2 border-[#a3e635]" />
                ) : (
                  <div className="w-12 h-12 rounded-full border-2 border-[#a3e635] flex items-center justify-center bg-[#a3e635]/10">
                    <Store size={20} className="text-[#a3e635]" />
                  </div>
                )}
                <span className="text-white font-bold text-sm line-clamp-1">{p.name}</span>
              </button>
            ))}
            {partners.length === 0 && (
              <div className="col-span-2 text-center py-10 text-zinc-500 text-xs">Nenhuma loja parceira cadastrada</div>
            )}
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center py-24 gap-4">
            <div
              className="w-16 h-16 rounded-3xl flex items-center justify-center"
              style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}
            >
              <Package size={28} className="text-zinc-700" />
            </div>
            <div className="text-center">
              <p className="text-xs font-black text-zinc-700 uppercase tracking-widest">Nenhum produto</p>
              <p className="text-[9px] text-zinc-800 font-semibold mt-1">Em breve novas recompensas</p>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-2 sm:gap-3 w-full">
            {filtered.map(product => {
              const affordable = canAfford(product);
              const isBuying = buying === product.id;
              const hasCoin = !!product.costCoins;
              const hasMoney = !!(product.costFreeBalance || product.costLockedBalance);
              const partner = partners.find(p => p.id === product.partnerId);
              const coinOk = !product.costCoins || (user?.coins ?? 0) >= product.costCoins;
              const moneyOk = !product.costFreeBalance || (user?.freeBalance ?? 0) >= product.costFreeBalance;

              return (
                <div
                  key={product.id}
                  className="relative flex flex-col rounded-[20px] overflow-hidden w-full max-w-[180px] mx-auto"
                  style={{
                    background: 'rgba(18,18,18,1)',
                    border: affordable
                      ? '2px solid #a3e635' // Solid, thick Lime green border
                      : '1px solid rgba(255,255,255,0.15)', // More visible border for insufficient
                    boxShadow: affordable
                      ? '0 0 20px rgba(163,230,53,0.15)' // Stronger green glowing shadow
                      : 'none',
                    opacity: affordable ? 1 : 0.9, // Make insufficient products less faded
                    transition: 'all 0.2s',
                  }}
                >
                  {/* ── IMAGE ── */}
                  <div className="relative w-full h-[140px] shrink-0">
                    {product.imageUrl ? (
                      <>
                        <img
                          src={product.imageUrl}
                          alt={product.name}
                          className="w-full h-full object-cover"
                          style={{ filter: affordable ? 'none' : 'brightness(0.9)' }}
                        />
                        <div
                          className="absolute inset-0"
                          style={{ background: 'linear-gradient(to top, rgba(18,18,18,0.9) 0%, transparent 40%)' }}
                        />
                      </>
                    ) : (
                      <div
                        className="w-full h-full flex flex-col items-center justify-center gap-2"
                        style={{ background: 'linear-gradient(135deg,#1a1a1a,#111)' }}
                      >
                        <Package size={24} className="text-zinc-800" />
                      </div>
                    )}

                    {/* Stock & availability tiny badges */}
                    <div className="absolute top-1.5 right-1.5 flex flex-col items-end gap-1">
                      {product.stock !== undefined && (
                        <span
                          className="flex items-center gap-[2px] px-1.5 py-0.5 rounded-lg text-[7px] font-black"
                          style={product.stock <= 3
                            ? { background: 'rgba(239,68,68,0.9)', color: '#fff' }
                            : { background: 'rgba(0,0,0,0.6)', color: '#a1a1aa', border: '1px solid rgba(255,255,255,0.1)' }
                          }
                        >
                          <Tag size={8} />{product.stock <= 3 ? `Só ${product.stock}!` : product.stock}
                        </span>
                      )}
                      {affordable && (
                        <span
                          className="flex items-center gap-[2px] px-1.5 py-0.5 rounded-lg text-[6px] font-black"
                          style={{ background: 'rgba(74,222,128,0.15)', color: '#4ade80', border: '1px solid rgba(74,222,128,0.2)' }}
                        >
                          <Star size={6} fill="currentColor" /> Disponível
                        </span>
                      )}
                    </div>

                    {/* Product Name overlaid closely */}
                    <div className="absolute bottom-0 left-0 right-0 px-2 pb-2">
                      <div className="flex items-center gap-1 mb-0.5">
                        {partner && (
                          <span className="text-[6px] font-black uppercase flex items-center gap-0.5 bg-lime-400/20 text-lime-400 px-1 py-[1px] rounded">
                            <Store size={6} />
                            {partner.name}
                          </span>
                        )}
                        {product.category && (
                          <span className="text-[6px] font-black uppercase" style={{ color: '#facc1580' }}>
                            {product.category}
                          </span>
                        )}
                      </div>
                      <h3
                        className="font-black text-white leading-tight line-clamp-2"
                        style={{ fontSize: '11px', textShadow: '0 2px 4px rgba(0,0,0,0.8)' }}
                      >
                        {product.name}
                      </h3>
                    </div>
                  </div>

                  {/* ── COSTS & CTA ── */}
                  <div className="p-3 pt-2 flex flex-col justify-end flex-1 w-full bg-gradient-to-t from-[rgba(15,15,15,0.9)] to-transparent">
                    {/* Compact Price String */}
                    <div className="flex flex-col mb-2">
                      <span className="text-[7.5px] font-black uppercase text-zinc-500 tracking-[0.2em] mb-1">
                        Valor
                      </span>
                      <div className="flex items-center flex-wrap gap-1 leading-none">
                        {hasCoin && (
                          <span className="font-black text-[11px] text-[#facc15]">
                            {(product.costCoins ?? 0).toLocaleString('pt-BR')} <span className="font-bold text-[8px] uppercase tracking-wide">moedas</span>
                          </span>
                        )}
                        {hasCoin && hasMoney && (
                          <span className="text-zinc-600 font-bold text-[10px]">+</span>
                        )}
                        {hasMoney && (
                          <span className="font-black text-[11px] text-[#4ade80]">
                            R$ {(product.costFreeBalance ?? 0).toFixed(2)}
                          </span>
                        )}
                        {!hasCoin && !hasMoney && (
                          <span className="font-black text-[11px] text-[#4ade80]">Grátis</span>
                        )}
                      </div>
                    </div>

                    {/* Progress Bar for Coins */}
                    {hasCoin && (
                      <div className="flex flex-col gap-1 mb-2.5">
                        <div className="flex justify-between items-center text-[6.5px] font-black uppercase tracking-wider">
                           <span className="text-zinc-500">Progresso</span>
                           {coinOk ? (
                             <span className="text-[#a3e635]">Alcançado!</span>
                           ) : (
                             <span className="text-zinc-400">
                               Faltam <span className="text-[#facc15]">{((product.costCoins || 0) - (user?.coins ?? 0)).toLocaleString('pt-BR')}</span> moedas
                             </span>
                           )}
                        </div>
                        <div className="w-full bg-[rgba(255,255,255,0.04)] rounded-full h-1 overflow-hidden" style={{ border: '1px solid rgba(255,255,255,0.05)' }}>
                          <div 
                            className="h-full transition-all duration-500 rounded-full" 
                            style={{ 
                              width: `${Math.min(100, ((user?.coins ?? 0) / (product.costCoins || 1)) * 100)}%`,
                              background: coinOk ? '#a3e635' : 'linear-gradient(90deg, #ca8a04, #facc15)',
                              boxShadow: coinOk ? '0 0 10px rgba(163,230,53,0.5)' : '0 0 10px rgba(250,204,21,0.2)'
                            }} 
                          />
                        </div>
                      </div>
                    )}

                    {/* Compact CTA */}
                    <button
                      onClick={() => handleBuy(product)}
                      disabled={!affordable || isBuying || !user}
                      className="w-full h-8 rounded-xl font-black text-[9px] uppercase tracking-[0.1em] flex items-center justify-center gap-1.5 transition-all active:scale-95 shrink-0"
                      style={affordable && !isBuying
                        ? {
                            background: '#a3e635', // Lime Green
                            color: '#064e3b', // Intense dark green text
                            boxShadow: '0 4px 14px rgba(163,230,53,0.25)',
                          }
                        : {
                            background: 'rgba(239, 68, 68, 0.1)', // Red translucent
                            color: '#f87171', // Red 400
                            border: '1px solid rgba(239, 68, 68, 0.25)',
                          }
                      }
                    >
                      {isBuying
                        ? <Loader2 size={12} className="animate-spin" />
                        : affordable
                          ? 'RESGATAR'
                          : 'INSUFICIENTE'
                      }
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
