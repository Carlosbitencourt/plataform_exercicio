import React from 'react';
import { MapPin, Navigation, Star, Clock } from 'lucide-react';
import { subscribeToTimeSlots } from '../../services/db';
import { TimeSlot } from '../../types';

const AthleteLocations: React.FC = () => {
    const [locations, setLocations] = React.useState<TimeSlot[]>([]);

    React.useEffect(() => {
        return subscribeToTimeSlots(setLocations);
    }, []);

    return (
        <div className="p-6 space-y-8 animate-in slide-in-from-bottom-4 duration-500">
            <header className="space-y-1">
                <h1 className="text-3xl font-black italic font-sport text-white uppercase tracking-tighter">Locais</h1>
                <p className="text-zinc-500 font-bold uppercase text-[10px] tracking-widest">Encontre pontos de check-in ativos</p>
            </header>

            <div className="grid gap-6">
                {locations.length > 0 ? locations.map((location) => (
                    <div key={location.id} className="bg-zinc-900/50 border border-zinc-800 rounded-3xl overflow-hidden group">
                        <div className="h-40 bg-zinc-800 relative">
                            {location.photoUrl ? (
                                <img src={location.photoUrl} alt={location.locationName} className="w-full h-full object-cover" />
                            ) : (
                                <div className="w-full h-full flex items-center justify-center text-zinc-700">
                                    <MapPin className="w-12 h-12" />
                                </div>
                            )}
                            <div className="absolute inset-0 bg-gradient-to-t from-zinc-950 via-transparent to-transparent"></div>
                            <div className="absolute bottom-4 left-4 right-4 flex items-end justify-between">
                                <div>
                                    <h3 className="text-xl font-black italic font-sport text-white uppercase tracking-tighter leading-none mb-1">
                                        {location.locationName}
                                    </h3>
                                    <div className="flex items-center gap-2">
                                        <span className="bg-lime-400 text-black text-[10px] font-black px-2 py-0.5 rounded italic font-sport tracking-tighter flex items-center gap-1">
                                            <Star className="w-2.5 h-2.5 fill-black" />
                                            {location.weight * 10} PONTOS
                                        </span>
                                    </div>
                                </div>
                                <div className="flex gap-2">
                                    <a
                                        href={`https://www.google.com/maps/dir/?api=1&destination=${location.latitude},${location.longitude}`}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="p-3 bg-white text-black rounded-2xl hover:bg-lime-400 transition-all active:scale-90 shadow-xl flex items-center justify-center group/btn"
                                        title="Abrir no Google Maps"
                                    >
                                        <Navigation className="w-5 h-5 group-hover/btn:scale-110 transition-transform" />
                                    </a>
                                    <a
                                        href={`https://waze.com/ul?ll=${location.latitude},${location.longitude}&navigate=yes`}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="p-3 bg-[#33ccff] text-white rounded-2xl hover:bg-white hover:text-[#33ccff] transition-all active:scale-90 shadow-xl flex items-center justify-center group/btn"
                                        title="Abrir no Waze"
                                    >
                                        <svg className="w-5 h-5 fill-current group-hover/btn:scale-110 transition-transform" viewBox="0 0 24 24">
                                            <path d="M19.16 11.2a2 2 0 0 0-3.32 0l-1.66 2.49a.2.2 0 0 1-.34 0L10.51 9.2a2 2 0 0 0-3.32 0l-5.32 8a2 2 0 0 0 1.66 3.1h16.64a2 2 0 0 0 1.66-3.1zM5 16a1 1 0 1 1 0-2 1 1 0 0 1 0 2zm14 0a1 1 0 1 1 0-2 1 1 0 0 1 0 2z m-7-6a1 1 0 1 1 0-2 1 1 0 0 1 0 2z" />
                                            <path d="M18.52 11c-.55 0-1.07.22-1.45.61l-2.67 2.67c-.2.2-.51.2-.71 0l-2.67-2.67c-.38-.39-.9-.61-1.45-.61s-1.07.22-1.45.61l-2.67 2.67c-.2.2-.51.2-.71 0l-2.67-2.67c-.38-.39-.9-.61-1.45-.61s-1.07.22-1.45.61L.82 15.28c-.53.53-.53 1.39 0 1.92s1.39.53 1.92 0l2.35-2.35c.2-.2.51-.2.71 0l2.67 2.67c.38.39.9.61 1.45.61s1.07-.22 1.45-.61l2.67-2.67c.2-.2.51-.2.71 0l2.67 2.67c.38.39.9.61 1.45.61s1.07-.22 1.45-.61l2.35 2.35c.53.53 1.39.53 1.92 0s.53-1.39 0-1.92l-2.67-2.67c-.38-.39-.9-.61-1.45-.61z" opacity=".3" />
                                            <path d="M22.5 12.5c-.83 0-1.5.67-1.5 1.5 0 .28.08.53.22.75L20 16.5c-.55 0-1 .45-1 1s.45 1 1 1h2.5c.83 0 1.5-.67 1.5-1.5 0-.28-.08-.53-.22-.75l1.22-1.75c.55 0 1-.45 1-1s-.45-1-1-1H22.5z" />
                                            <path d="M22.463 17.514a3.315 3.315 0 0 1-2.903-1.63L16.273 11.23a3.328 3.328 0 0 0-5.546 0L7.439 15.884a3.315 3.315 0 0 1-2.903 1.63H3.66a3.332 3.332 0 0 1-2.772-5.186l5.321-7.981a3.333 3.333 0 0 1 5.546 0l3.288 4.931 3.288-4.931a3.333 3.333 0 0 1 5.546 0l5.321 7.981a3.332 3.332 0 0 1-2.772 5.186h-.873zM5.333 14.667a1.333 1.333 0 1 0 0-2.667 1.333 1.333 0 0 0 0 2.667zm13.334 0a1.333 1.333 0 1 0 0-2.667 1.333 1.333 0 0 0 0 2.667zM12 8a1.333 1.333 0 1 0 0-2.667 1.333 1.333 0 0 0 0 2.667z" />
                                        </svg>
                                    </a>
                                </div>
                            </div>
                        </div>

                        <div className="p-5 flex items-center justify-between border-t border-zinc-800/50">
                            <div className="flex items-center gap-2 text-zinc-400">
                                <Clock className="w-4 h-4" />
                                <span className="text-[10px] font-black uppercase tracking-widest">Janelas Ativas:</span>
                            </div>
                            <div className="flex gap-2">
                                {location.intervals?.slice(0, 2).map((inv, i) => (
                                    <span key={i} className="text-[10px] font-black font-sport italic text-lime-400 bg-lime-400/10 px-2 py-1 rounded-lg border border-lime-400/20">
                                        {inv.startTime}-{inv.endTime}
                                    </span>
                                ))}
                            </div>
                        </div>
                    </div>
                )) : (
                    <div className="py-20 text-center space-y-4">
                        <div className="w-20 h-20 bg-zinc-900 rounded-full mx-auto flex items-center justify-center text-zinc-700 border border-zinc-800">
                            <MapPin className="w-8 h-8" />
                        </div>
                        <p className="text-zinc-500 font-black uppercase text-[10px] tracking-widest">Nenhum local cadastrado</p>
                    </div>
                )}
            </div>
        </div>
    );
};

export default AthleteLocations;
