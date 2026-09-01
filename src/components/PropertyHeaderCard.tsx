import React from 'react';
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
import type { InspectionData, InspectionType } from '../types/inspection';

interface PropertyHeaderCardProps {
  data: InspectionData;
  onEdit: () => void;
}

export const PropertyHeaderCard: React.FC<PropertyHeaderCardProps> = ({ data, onEdit }) => {
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
    : 'Toque em "Editar Dados" para preencher o endereço do imóvel.';

  const formattedDate = data.date 
    ? new Date(data.date + 'T12:00:00').toLocaleDateString('pt-BR') 
    : 'Sem data';

  const typeBadges: Record<InspectionType, string> = {
    Entrada: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    Saída: 'bg-amber-50 text-amber-700 border-amber-200',
    Periódica: 'bg-sky-50 text-sky-700 border-sky-200',
    Constatação: 'bg-purple-50 text-purple-700 border-purple-200',
  };

  return (
    <div className="bg-white rounded-2xl p-4 sm:p-5 border border-slate-200 shadow-sm mb-5">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        
        {/* Left Side: Property Info */}
        <div className="flex items-start gap-3.5">
          {data.companyLogo ? (
            <img 
              src={data.companyLogo} 
              alt="Logo" 
              className="w-14 h-14 rounded-xl object-contain bg-slate-50 p-1 border border-slate-200 shrink-0" 
            />
          ) : (
            <div className="w-12 h-12 rounded-xl bg-brand-50 border border-brand-200 flex items-center justify-center text-brand-600 shrink-0">
              <Building className="w-6 h-6" />
            </div>
          )}

          <div className="space-y-1">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-lg sm:text-xl font-bold text-slate-900 tracking-tight">
                {data.title || 'Laudo de Vistoria'}
              </h1>
              <span className={`text-xs px-2.5 py-0.5 rounded-full font-bold border ${typeBadges[data.inspectionType]}`}>
                {data.inspectionType}
              </span>
            </div>

            <p className="text-xs sm:text-sm text-slate-600 flex items-center gap-1.5 line-clamp-1">
              <MapPin className="w-3.5 h-3.5 text-brand-600 shrink-0" />
              <span>{fullAddress}</span>
            </p>

            <div className="flex items-center gap-4 text-xs text-slate-500 flex-wrap pt-0.5 font-medium">
              <span className="flex items-center gap-1">
                <Calendar className="w-3 h-3 text-slate-400" />
                {formattedDate} {data.time ? `às ${data.time}` : ''}
              </span>
              <span className="flex items-center gap-1">
                <User className="w-3 h-3 text-slate-400" />
                Vistoriador: <strong className="text-slate-700">{data.inspectorName || 'Não informado'}</strong>
              </span>
              <span className="flex items-center gap-1">
                <User className="w-3 h-3 text-slate-400" />
                Locatário: <strong className="text-slate-700">{data.tenantName || 'Não informado'}</strong>
              </span>
              {(data.waterMeter || data.energyMeter || data.gasMeter) && (
                <span className="flex items-center gap-1 text-brand-600">
                  <Gauge className="w-3 h-3" />
                  Medidores registrados
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Right Side: Stats & Edit Button */}
        <div className="flex items-center justify-between sm:justify-end gap-3 pt-2 md:pt-0 border-t md:border-t-0 border-slate-100">
          
          <div className="flex items-center gap-2">
            {/* Rooms count */}
            <div className="px-3 py-1.5 rounded-xl bg-slate-50 border border-slate-200 text-center">
              <span className="block text-xs font-bold text-slate-900">{data.rooms.length}</span>
              <span className="block text-[10px] text-slate-500">Cômodos</span>
            </div>

            {/* Total Items */}
            <div className="px-3 py-1.5 rounded-xl bg-slate-50 border border-slate-200 text-center">
              <span className="block text-xs font-bold text-slate-900">{totalItems}</span>
              <span className="block text-[10px] text-slate-500">Itens</span>
            </div>

            {/* Total Photos */}
            <div className="px-3 py-1.5 rounded-xl bg-slate-50 border border-slate-200 text-center">
              <div className="flex items-center justify-center gap-1">
                <ImageIcon className="w-3 h-3 text-brand-600" />
                <span className="text-xs font-bold text-slate-900">{totalPhotos}</span>
              </div>
              <span className="block text-[10px] text-slate-500">Fotos</span>
            </div>

            {/* Repairs Alert */}
            {repairsCount > 0 && (
              <div className="px-3 py-1.5 rounded-xl bg-rose-50 border border-rose-200 text-center">
                <div className="flex items-center justify-center gap-1">
                  <AlertTriangle className="w-3 h-3 text-rose-600" />
                  <span className="text-xs font-bold text-rose-700">{repairsCount}</span>
                </div>
                <span className="block text-[10px] text-rose-600 font-bold">Reparos</span>
              </div>
            )}
          </div>

          <button
            onClick={onEdit}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold border border-slate-200 transition-all shrink-0"
          >
            <Edit3 className="w-3.5 h-3.5 text-brand-600" />
            <span>Editar Dados</span>
          </button>

        </div>

      </div>
    </div>
  );
};
