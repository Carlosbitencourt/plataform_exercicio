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
        <div className="p-6 space-y-8 animate-in slide-in-from-bottom-4 duration-500 pb-28">
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
                                        className="p-3 bg-white text-black rounded-2xl hover:bg-lime-400 transition-all active:scale-90 shadow-xl flex items-center justify-center group/btn"
                                        title="Abrir no Waze"
                                    >
                                        <img src="/waze-icon.png" alt="Waze" className="w-6 h-6 group-hover/btn:scale-110 transition-transform object-contain" />
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
