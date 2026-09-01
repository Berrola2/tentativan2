import React, { useRef } from 'react';
import { 
  Plus, 
  ChevronLeft, 
  ChevronRight
} from 'lucide-react';
import type { Room } from '../types/inspection';

interface RoomListProps {
  rooms: Room[];
  activeRoomId: string;
  onSelectRoom: (id: string) => void;
  onAddRoom: () => void;
}

export const RoomList: React.FC<RoomListProps> = ({
  rooms,
  activeRoomId,
  onSelectRoom,
  onAddRoom,
}) => {
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  const scroll = (direction: 'left' | 'right') => {
    if (scrollContainerRef.current) {
      const scrollAmount = 200;
      scrollContainerRef.current.scrollBy({
        left: direction === 'left' ? -scrollAmount : scrollAmount,
        behavior: 'smooth',
      });
    }
  };

  return (
    <div className="relative mb-5">
      <div className="flex items-center justify-between mb-2 px-1">
        <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
          Ambientes do Imóvel ({rooms.length})
        </span>
        <button
          onClick={onAddRoom}
          className="flex items-center gap-1 text-xs font-bold text-brand-600 hover:text-brand-700 transition-colors"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>Novo Cômodo</span>
        </button>
      </div>

      {/* Navigation Scroll Buttons for Desktop / Tablet */}
      <div className="relative group">
        <button
          onClick={() => scroll('left')}
          className="hidden md:flex absolute -left-3 top-1/2 -translate-y-1/2 z-10 w-8 h-8 rounded-full bg-white border border-slate-200 items-center justify-center text-slate-600 hover:text-slate-900 shadow-md opacity-0 group-hover:opacity-100 transition-opacity"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>

        <button
          onClick={() => scroll('right')}
          className="hidden md:flex absolute -right-3 top-1/2 -translate-y-1/2 z-10 w-8 h-8 rounded-full bg-white border border-slate-200 items-center justify-center text-slate-600 hover:text-slate-900 shadow-md opacity-0 group-hover:opacity-100 transition-opacity"
        >
          <ChevronRight className="w-4 h-4" />
        </button>

        {/* Scrollable Tabs */}
        <div
          ref={scrollContainerRef}
          className="flex items-center gap-2 overflow-x-auto pb-2 pt-1 no-scrollbar scroll-smooth"
          style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
        >
          {rooms.map((room, index) => {
            const isActive = room.id === activeRoomId;
            const hasRepairs = room.items.some((i) => i.needRepair);
            const totalPhotos = room.items.reduce((acc, curr) => acc + curr.photos.length, 0);

            return (
              <button
                key={room.id}
                onClick={() => onSelectRoom(room.id)}
                className={`relative shrink-0 flex items-center gap-2 px-3.5 py-2.5 rounded-xl border text-xs font-bold transition-all duration-200 ${
                  isActive
                    ? 'bg-brand-600 text-white border-brand-600 shadow-md shadow-brand-600/25 ring-2 ring-brand-400/30'
                    : 'bg-white text-slate-700 border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                }`}
              >
                <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold ${
                  isActive ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-600'
                }`}>
                  {index + 1}
                </span>

                <span className="truncate max-w-[130px]">{room.name}</span>

                {/* Items & Photos badge */}
                <span className={`text-[10px] px-1.5 py-0.5 rounded-md font-semibold ${
                  isActive ? 'bg-black/20 text-white' : 'bg-slate-100 text-slate-600'
                }`}>
                  {room.items.length} {room.items.length === 1 ? 'item' : 'itens'}{totalPhotos > 0 ? ` • ${totalPhotos}📷` : ''}
                </span>

                {/* Repair needed indicator */}
                {hasRepairs && (
                  <span className="flex items-center" title="Contém itens com reparo pendente">
                    <span className="relative flex h-2 w-2">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-rose-500"></span>
                    </span>
                  </span>
                )}
              </button>
            );
          })}

          {/* Add Room Quick Card */}
          <button
            onClick={onAddRoom}
            className="shrink-0 flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl border border-dashed border-slate-300 hover:border-brand-500 bg-white hover:bg-brand-50/50 text-slate-500 hover:text-brand-600 text-xs font-bold transition-all"
          >
            <Plus className="w-4 h-4" />
            <span>Adicionar</span>
          </button>
        </div>
      </div>
    </div>
  );
};
