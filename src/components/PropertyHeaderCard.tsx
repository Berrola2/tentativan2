import { 
  MapPin, 
  User, 
  Calendar, 
  Edit3, 
  Image as ImageIcon, 
  AlertTriangle, 
  Building, 
  Gauge 
} from 'lucide-react';
import type { InspectionData } from '../types/inspection';

interface PropertyHeaderCardProps {
  data: InspectionData;
  onEdit: () => void;
}

export const PropertyHeaderCard: React.FC<PropertyHeaderCardProps> = ({ data, onEdit }) => {
  // Compute metrics
  let totalItems = 0;
  let totalPhotos = 0;
  let repairsCount = 0;

  data.rooms.forEach((r) => {
    r.items.forEach((item) => {
      totalItems++;
      totalPhotos += item.photos.length;
      if (item.needRepair) repairsCount++;
    });
  });

  const fullAddress = data.propertyAddress 
    ? `${data.propertyAddress}, ${data.propertyNumber || 'S/N'}${data.propertyComplement ? ` (${data.propertyComplement})` : ''} - ${data.propertyCity || ''}/${data.propertyState || ''}`
    : 'Clique em "Editar Dados" para preencher o endereço do imóvel.';

  const formattedDate = data.date 
    ? new Date(data.date + 'T12:00:00').toLocaleDateString('pt-BR') 
    : new Date().toLocaleDateString('pt-BR');

  return (
    <div className="bg-slate-900/80 backdrop-blur-md rounded-2xl p-4 sm:p-5 border border-slate-800 shadow-xl mb-5">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        
        {/* Left Side: Property Info */}
        <div className="flex items-start gap-3.5">
          {data.companyLogo ? (
            <img 
              src={data.companyLogo} 
              alt="Logo" 
              className="w-14 h-14 rounded-xl object-contain bg-slate-950 p-1 border border-slate-800 shrink-0" 
            />
          ) : (
            <div className="w-12 h-12 rounded-xl bg-slate-800 border border-slate-700 flex items-center justify-center text-brand-400 shrink-0">
              <Building className="w-6 h-6" />
            </div>
          )}

          <div className="space-y-1">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-lg sm:text-xl font-bold text-white tracking-tight">
                {data.title || 'Laudo de Vistoria'}
              </h1>
              <span className="text-xs px-2 py-0.5 rounded-full bg-brand-500/10 text-brand-400 font-semibold border border-brand-500/20">
                {data.inspectionType}
              </span>
            </div>

            <p className="text-xs sm:text-sm text-slate-300 flex items-center gap-1.5 line-clamp-1">
              <MapPin className="w-3.5 h-3.5 text-brand-400 shrink-0" />
              <span>{fullAddress}</span>
            </p>

            <div className="flex items-center gap-4 text-xs text-slate-400 flex-wrap pt-0.5">
              <span className="flex items-center gap-1">
                <Calendar className="w-3 h-3 text-slate-500" />
                {formattedDate} {data.time ? `às ${data.time}` : ''}
              </span>
              <span className="flex items-center gap-1">
                <User className="w-3 h-3 text-slate-500" />
                Vistoriador: <strong className="text-slate-300">{data.inspectorName || 'Pendente'}</strong>
              </span>
              <span className="flex items-center gap-1">
                <User className="w-3 h-3 text-slate-500" />
                Locatário: <strong className="text-slate-300">{data.tenantName || 'Pendente'}</strong>
              </span>
              {(data.waterMeter || data.energyMeter || data.gasMeter) && (
                <span className="flex items-center gap-1 text-sky-400">
                  <Gauge className="w-3 h-3" />
                  Medidores registrados
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Right Side: Stats & Edit Button */}
        <div className="flex items-center justify-between sm:justify-end gap-3 pt-2 md:pt-0 border-t md:border-t-0 border-slate-800/80">
          
          <div className="flex items-center gap-2">
            {/* Rooms count */}
            <div className="px-2.5 py-1.5 rounded-lg bg-slate-800/80 border border-slate-700/60 text-center">
              <span className="block text-xs font-bold text-white">{data.rooms.length}</span>
              <span className="block text-[10px] text-slate-400">Cômodos</span>
            </div>

            {/* Total Items */}
            <div className="px-2.5 py-1.5 rounded-lg bg-slate-800/80 border border-slate-700/60 text-center">
              <span className="block text-xs font-bold text-white">{totalItems}</span>
              <span className="block text-[10px] text-slate-400">Itens</span>
            </div>

            {/* Total Photos */}
            <div className="px-2.5 py-1.5 rounded-lg bg-slate-800/80 border border-slate-700/60 text-center">
              <div className="flex items-center justify-center gap-1">
                <ImageIcon className="w-3 h-3 text-brand-400" />
                <span className="text-xs font-bold text-white">{totalPhotos}</span>
              </div>
              <span className="block text-[10px] text-slate-400">Fotos</span>
            </div>

            {/* Repairs Alert */}
            {repairsCount > 0 && (
              <div className="px-2.5 py-1.5 rounded-lg bg-rose-500/10 border border-rose-500/30 text-center">
                <div className="flex items-center justify-center gap-1">
                  <AlertTriangle className="w-3 h-3 text-rose-400" />
                  <span className="text-xs font-bold text-rose-300">{repairsCount}</span>
                </div>
                <span className="block text-[10px] text-rose-400 font-semibold">Reparos</span>
              </div>
            )}
          </div>

          <button
            onClick={onEdit}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold border border-slate-700 hover:border-slate-600 transition-all shrink-0"
          >
            <Edit3 className="w-3.5 h-3.5 text-brand-400" />
            <span>Editar Dados</span>
          </button>

        </div>

      </div>
    </div>
  );
};
