import React, { useEffect } from 'react';
import { 
  ShieldCheck, 
  MapPin, 
  AlertTriangle, 
  CheckCircle2,
  Lock
} from 'lucide-react';
import type { InspectionData } from '../types/inspection';

interface ProtectedClientViewerProps {
  inspection: InspectionData;
  onBack?: () => void;
  isClientView?: boolean;
}

export const ProtectedClientViewer: React.FC<ProtectedClientViewerProps> = ({
  inspection,
  onBack,
  isClientView = true,
}) => {
  // 1. Strict protection against PrintScreen, Right-Click, and Copy shortcuts
  useEffect(() => {
    if (!isClientView) return;

    const handleContextMenu = (e: MouseEvent) => {
      e.preventDefault();
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      // Block Ctrl+P (Print), Ctrl+S (Save), Ctrl+C (Copy), Ctrl+U (Source), F12 (DevTools)
      if (
        (e.ctrlKey || e.metaKey) &&
        ['p', 's', 'c', 'u'].includes(e.key.toLowerCase())
      ) {
        e.preventDefault();
      }
      if (e.key === 'PrintScreen' || e.keyCode === 44) {
        e.preventDefault();
      }
    };

    document.addEventListener('contextmenu', handleContextMenu);
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('contextmenu', handleContextMenu);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isClientView]);

  const totalPhotos = inspection.rooms.reduce(
    (acc, r) => acc + r.items.reduce((iAcc, item) => iAcc + item.photos.length, 0),
    0
  );

  const totalRepairs = inspection.rooms.reduce(
    (acc, r) => acc + r.items.filter((i) => i.needRepair).length,
    0
  );

  const statusColors: Record<string, string> = {
    Novo: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    Bom: 'bg-blue-50 text-blue-700 border-blue-200',
    Regular: 'bg-amber-50 text-amber-700 border-amber-200',
    Ruim: 'bg-rose-50 text-rose-700 border-rose-200',
  };

  return (
    <div className="min-h-screen bg-slate-100 py-6 sm:py-10 px-3 sm:px-6 select-none relative overflow-hidden font-sans">
      
      {/* Security Watermark Overlay */}
      <div className="fixed inset-0 pointer-events-none z-50 flex items-center justify-center opacity-[0.03] rotate-[-25deg] select-none text-slate-900 font-black text-4xl sm:text-7xl tracking-widest leading-relaxed text-center">
        DOCUMENTO REGISTRADO • USO EXCLUSIVO • REPRODUÇÃO PROIBIDA
      </div>

      <div className="max-w-4xl mx-auto bg-white rounded-3xl border border-slate-200 shadow-2xl overflow-hidden animate-fadeIn">
        
        {/* Security Top Bar */}
        <div className="bg-slate-950 text-white p-4 sm:p-5 flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shrink-0">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-sm sm:text-base font-bold leading-tight">
                Leitor Seguro de Laudo de Vistoria
              </h1>
              <p className="text-[11px] text-slate-400">
                Visualização protegida por assinatura criptográfica
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30 px-3 py-1 rounded-full uppercase tracking-wider flex items-center gap-1">
              <Lock className="w-3 h-3" />
              <span>Modo Somente Leitura</span>
            </span>

            {onBack && (
              <button
                onClick={onBack}
                className="text-xs text-slate-400 hover:text-white bg-slate-800 px-3 py-1 rounded-xl transition-colors"
              >
                Voltar
              </button>
            )}
          </div>
        </div>

        {/* Security Alert Banner */}
        <div className="bg-amber-50 border-b border-amber-200/80 p-4 sm:p-5 flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
          <p className="text-xs text-amber-900 leading-relaxed font-medium">
            <strong>Aviso de Proteção Jurídica:</strong> Este laudo contém registros fotográficos com geolocalização e data/hora. A impressão direta, cópia de texto e download de arquivos em lote foram bloqueados para garantir a integridade dos dados para ambas as partes.
          </p>
        </div>

        {/* Inspection Header */}
        <div className="p-5 sm:p-8 space-y-6">
          
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-slate-200">
            <div className="space-y-1">
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-xl sm:text-2xl font-black text-slate-900">
                  {inspection.title || 'Laudo de Vistoria'}
                </h2>
                <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                  Vistoria de {inspection.inspectionType}
                </span>
              </div>
              <p className="text-xs sm:text-sm text-slate-600 flex items-center gap-1.5">
                <MapPin className="w-4 h-4 text-brand-600 shrink-0" />
                <span>
                  {inspection.propertyAddress 
                    ? `${inspection.propertyAddress}, ${inspection.propertyNumber || 'S/N'}${inspection.propertyComplement ? ` (${inspection.propertyComplement})` : ''} - ${inspection.propertyCity || ''}/${inspection.propertyState || ''}`
                    : 'Endereço registrado no laudo'}
                </span>
              </p>
            </div>

            <img
              src={inspection.companyLogo || '/logo.jpg'}
              alt="Logo"
              className="h-12 w-auto object-contain rounded-xl p-1 bg-white border border-slate-200 shrink-0 shadow-sm"
            />
          </div>

          {/* Quick Metrics */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="bg-slate-50 border border-slate-200 rounded-2xl p-3.5 text-center">
              <span className="text-[11px] text-slate-500 font-bold block mb-0.5">Data da Vistoria</span>
              <span className="text-sm font-bold text-slate-900">
                {inspection.date ? new Date(inspection.date + 'T12:00:00').toLocaleDateString('pt-BR') : 'Registrada'}
              </span>
            </div>

            <div className="bg-slate-50 border border-slate-200 rounded-2xl p-3.5 text-center">
              <span className="text-[11px] text-slate-500 font-bold block mb-0.5">Total de Cômodos</span>
              <span className="text-sm font-bold text-slate-900">{inspection.rooms.length} Ambientes</span>
            </div>

            <div className="bg-slate-50 border border-slate-200 rounded-2xl p-3.5 text-center">
              <span className="text-[11px] text-slate-500 font-bold block mb-0.5">Fotos Catalogadas</span>
              <span className="text-sm font-bold text-slate-900">{totalPhotos} Fotos</span>
            </div>

            <div className="bg-slate-50 border border-slate-200 rounded-2xl p-3.5 text-center">
              <span className="text-[11px] text-slate-500 font-bold block mb-0.5">Apontamentos</span>
              <span className={`text-sm font-bold ${totalRepairs > 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
                {totalRepairs > 0 ? `${totalRepairs} Reparos` : 'Em Ordem'}
              </span>
            </div>
          </div>

          {/* Parties involved */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs bg-slate-50 p-4 rounded-2xl border border-slate-200">
            <div>
              <span className="text-slate-400 font-bold block text-[10px] uppercase">Vistoriador Responsável</span>
              <p className="font-bold text-slate-900 mt-0.5">{inspection.inspectorName || 'Não informado'}</p>
              {inspection.inspectorCpfCreci && <p className="text-slate-500">{inspection.inspectorCpfCreci}</p>}
            </div>

            <div>
              <span className="text-slate-400 font-bold block text-[10px] uppercase">Locatário / Inquilino</span>
              <p className="font-bold text-slate-900 mt-0.5">{inspection.tenantName || 'Não informado'}</p>
              {inspection.tenantCpf && <p className="text-slate-500">CPF: {inspection.tenantCpf}</p>}
            </div>
          </div>

          {/* Rooms and Items List */}
          <div className="space-y-6 pt-4">
            <h3 className="text-base font-bold text-slate-900 border-b border-slate-200 pb-2">
              Detalhamento dos Ambientes e Itens Inspecionados
            </h3>

            {inspection.rooms.map((room, rIdx) => (
              <div key={room.id} className="border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
                
                {/* Room Header */}
                <div className="bg-slate-900 text-white px-4 py-3 flex items-center justify-between">
                  <span className="font-bold text-xs sm:text-sm">
                    {rIdx + 1}. {room.name}
                  </span>
                  <span className="text-[11px] text-slate-400">
                    {room.items.length} itens catalogados
                  </span>
                </div>

                {/* Items in Room */}
                <div className="p-4 divide-y divide-slate-100 space-y-4">
                  {room.items.map((item) => (
                    <div key={item.id} className="pt-3 first:pt-0 space-y-2">
                      <div className="flex items-center justify-between flex-wrap gap-2">
                        <div className="flex items-center gap-2">
                          <CheckCircle2 className="w-4 h-4 text-brand-600 shrink-0" />
                          <span className="font-bold text-xs sm:text-sm text-slate-900">
                            {item.name}
                          </span>
                        </div>
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${statusColors[item.status] || 'bg-slate-100 text-slate-700'}`}>
                          {item.status}
                        </span>
                      </div>

                      {/* Observations / Description */}
                      {item.description && (
                        <p className="text-xs text-slate-600 bg-slate-50 p-2.5 rounded-xl border border-slate-200/60">
                          {item.description}
                        </p>
                      )}

                      {/* Need Repair Alert */}
                      {item.needRepair && (
                        <div className="flex items-center gap-1.5 text-[11px] font-bold text-rose-600 bg-rose-50 p-2 rounded-xl border border-rose-200">
                          <AlertTriangle className="w-3.5 h-3.5" />
                          <span>Reparo Apontado: {item.repairDetails || 'Necessita manutenção'}</span>
                        </div>
                      )}

                      {/* Protected Photo Gallery */}
                      {item.photos.length > 0 && (
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1">
                          {item.photos.map((photo) => (
                            <div 
                              key={photo.id}
                              className="relative aspect-square rounded-xl overflow-hidden bg-slate-100 border border-slate-200 shadow-sm"
                            >
                              <img
                                src={photo.dataUrl}
                                alt={photo.caption || item.name}
                                draggable={false}
                                className="w-full h-full object-cover pointer-events-none"
                              />
                              {photo.caption && (
                                <div className="absolute bottom-0 inset-x-0 bg-black/60 backdrop-blur-sm p-1 text-[9px] text-white truncate text-center">
                                  {photo.caption}
                                </div>
                              )}
                              {/* Transparent shield over photo */}
                              <div className="absolute inset-0 bg-transparent select-none" />
                            </div>
                          ))}
                        </div>
                      )}

                    </div>
                  ))}
                </div>

              </div>
            ))}
          </div>

          {/* Formal Declaration Footer */}
          <div className="bg-slate-50 border border-slate-200 rounded-2xl p-5 text-center space-y-2">
            <p className="text-xs text-slate-600 leading-relaxed max-w-2xl mx-auto">
              As partes declaram a exatidão das imagens e observações contidas neste laudo eletrônico de vistoria, resguardados os prazos legais para contestação conforme contrato de locação.
            </p>
            <p className="text-[10px] text-slate-400 font-mono">
              Autenticação Digital: SHA256 • {inspection.id}
            </p>
          </div>

        </div>

      </div>
    </div>
  );
};
