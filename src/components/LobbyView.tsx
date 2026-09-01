import React, { useState } from 'react';
import { 
  Plus, 
  Search, 
  Building, 
  Calendar, 
  MapPin, 
  Copy, 
  Trash2, 
  ArrowRight, 
  Mic, 
  Sparkles, 
  DownloadCloud, 
  ShieldCheck, 
  Image as ImageIcon,
  AlertTriangle,
  FolderOpen
} from 'lucide-react';
import type { InspectionData, InspectionType } from '../types/inspection';

interface LobbyViewProps {
  inspections: InspectionData[];
  onSelectInspection: (inspection: InspectionData) => void;
  onNewInspection: () => void;
  onOpenAudioInspection: () => void;
  onOpenTemplates: () => void;
  onDuplicateInspection: (source: InspectionData, newType: InspectionType) => void;
  onDeleteInspection: (id: string, title: string) => void;
  onOpenCloudSync: () => void;
}

export const LobbyView: React.FC<LobbyViewProps> = ({
  inspections,
  onSelectInspection,
  onNewInspection,
  onOpenAudioInspection,
  onOpenTemplates,
  onDuplicateInspection,
  onDeleteInspection,
  onOpenCloudSync,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState<string>('all');

  // Compute metrics across all inspections
  const totalInspections = inspections.length;
  const totalPhotosAll = inspections.reduce(
    (acc, insp) =>
      acc +
      insp.rooms.reduce(
        (rAcc, r) => rAcc + r.items.reduce((iAcc, it) => iAcc + it.photos.length, 0),
        0
      ),
    0
  );
  const totalRepairsAll = inspections.reduce(
    (acc, insp) =>
      acc +
      insp.rooms.reduce(
        (rAcc, r) => rAcc + r.items.filter((it) => it.needRepair).length,
        0
      ),
    0
  );

  const filtered = inspections.filter((item) => {
    const matchesSearch =
      (item.title || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (item.propertyAddress || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (item.tenantName || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (item.inspectorName || '').toLowerCase().includes(searchQuery.toLowerCase());

    const matchesType = typeFilter === 'all' || item.inspectionType === typeFilter;
    return matchesSearch && matchesType;
  });

  const typeBadges: Record<InspectionType, string> = {
    Entrada: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    Saída: 'bg-amber-50 text-amber-700 border-amber-200',
    Periódica: 'bg-sky-50 text-sky-700 border-sky-200',
    Constatação: 'bg-purple-50 text-purple-700 border-purple-200',
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      
      {/* Top Welcome Banner */}
      <div className="bg-white rounded-3xl border border-slate-200 p-6 sm:p-8 shadow-sm relative overflow-hidden">
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <span className="text-xs font-extrabold uppercase tracking-wider px-2.5 py-1 rounded-full bg-brand-50 text-brand-700 border border-brand-200">
                Painel de Vistorias
              </span>
              <span className="text-xs text-slate-400 font-medium flex items-center gap-1">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                Offline-First & Nuvem Pronta
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
              Gerencie suas Vistorias e Laudos Técnicos
            </h1>
            <p className="text-sm text-slate-500 max-w-xl">
              Crie novas vistorias em campo, transcreva gravações de áudio e gere relatórios profissionais em PDF com 3 fotos por linha.
            </p>
          </div>

          {/* Action CTAs */}
          <div className="flex flex-wrap items-center gap-2.5">
            <button
              onClick={onOpenTemplates}
              className="flex items-center gap-2 px-3.5 py-3 rounded-2xl bg-amber-50 hover:bg-amber-100 text-amber-800 font-bold text-xs sm:text-sm border border-amber-200 shadow-sm transition-all active:scale-95"
              title="Iniciar a partir de um modelo pronto de cômodos"
            >
              <Sparkles className="w-4 h-4 text-amber-600" />
              <span>Modelos Prontos</span>
            </button>

            <button
              onClick={onOpenAudioInspection}
              className="flex items-center gap-2 px-4 py-3 rounded-2xl bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold text-xs sm:text-sm border border-indigo-200 shadow-sm transition-all active:scale-95"
              title="Vistoria guiada por áudio gravado"
            >
              <Mic className="w-4 h-4 text-indigo-600" />
              <span>Vistoria por Áudio</span>
            </button>

            <button
              onClick={onNewInspection}
              className="flex items-center gap-2 px-5 py-3 rounded-2xl bg-brand-600 hover:bg-brand-700 text-white font-bold text-xs sm:text-sm shadow-lg shadow-brand-600/25 transition-all active:scale-95"
            >
              <Plus className="w-4 h-4" />
              <span>+ Nova Vistoria</span>
            </button>
          </div>
        </div>

        {/* Subtle background gradient circle */}
        <div className="absolute right-0 top-0 translate-x-1/3 -translate-y-1/3 w-96 h-96 rounded-full bg-brand-100/40 pointer-events-none blur-3xl"></div>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
        <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-sm">
          <div className="flex items-center gap-2 text-slate-400 mb-1">
            <FolderOpen className="w-4 h-4 text-brand-600" />
            <span className="text-xs font-semibold">Total de Vistorias</span>
          </div>
          <span className="text-2xl font-black text-slate-900">{totalInspections}</span>
        </div>

        <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-sm">
          <div className="flex items-center gap-2 text-slate-400 mb-1">
            <ImageIcon className="w-4 h-4 text-sky-600" />
            <span className="text-xs font-semibold">Fotos Armazenadas</span>
          </div>
          <span className="text-2xl font-black text-slate-900">{totalPhotosAll}</span>
        </div>

        <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-sm">
          <div className="flex items-center gap-2 text-slate-400 mb-1">
            <AlertTriangle className="w-4 h-4 text-rose-500" />
            <span className="text-xs font-semibold">Reparos Apontados</span>
          </div>
          <span className="text-2xl font-black text-rose-600">{totalRepairsAll}</span>
        </div>

        <div 
          onClick={onOpenCloudSync}
          className="bg-white hover:bg-slate-50 rounded-2xl p-4 border border-slate-200 shadow-sm cursor-pointer transition-colors"
        >
          <div className="flex items-center gap-2 text-slate-400 mb-1">
            <DownloadCloud className="w-4 h-4 text-indigo-600" />
            <span className="text-xs font-semibold">Supabase Cloud</span>
          </div>
          <span className="text-xs font-bold text-indigo-600 block mt-1">Conectado & Sincronizável</span>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between">
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Buscar por título, endereço, inquilino ou vistoriador..."
            className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-10 pr-4 py-2.5 text-xs sm:text-sm text-slate-800 focus:outline-none focus:border-brand-500 focus:bg-white transition-colors"
          />
        </div>

        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
          {['all', 'Entrada', 'Saída', 'Periódica', 'Constatação'].map((type) => (
            <button
              key={type}
              onClick={() => setTypeFilter(type)}
              className={`text-xs font-bold px-3 py-2 rounded-xl transition-all ${
                typeFilter === type
                  ? 'bg-slate-900 text-white shadow-sm'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {type === 'all' ? 'Todas' : type}
            </button>
          ))}
        </div>
      </div>

      {/* Inspections Grid */}
      {filtered.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((item) => {
            const totalItems = item.rooms.reduce((acc, r) => acc + r.items.length, 0);
            const totalPhotos = item.rooms.reduce(
              (acc, r) => acc + r.items.reduce((iAcc, it) => iAcc + it.photos.length, 0),
              0
            );
            const repairsCount = item.rooms.reduce(
              (acc, r) => acc + r.items.filter((it) => it.needRepair).length,
              0
            );

            return (
              <div
                key={item.id}
                onClick={() => onSelectInspection(item)}
                className="bg-white rounded-2xl border border-slate-200 hover:border-brand-400 card-shadow card-shadow-hover p-5 flex flex-col justify-between gap-4 cursor-pointer transition-all"
              >
                <div className="space-y-3">
                  {/* Top line with badge */}
                  <div className="flex items-start justify-between gap-2">
                    <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full border ${typeBadges[item.inspectionType]}`}>
                      {item.inspectionType}
                    </span>
                    <span className="text-[11px] text-slate-400 flex items-center gap-1 font-medium">
                      <Calendar className="w-3 h-3" />
                      {item.date ? new Date(item.date + 'T12:00:00').toLocaleDateString('pt-BR') : 'Sem data'}
                    </span>
                  </div>

                  {/* Title & Address */}
                  <div>
                    <h3 className="font-bold text-base text-slate-900 line-clamp-1 group-hover:text-brand-600">
                      {item.title || 'Vistoria sem título'}
                    </h3>
                    <p className="text-xs text-slate-500 flex items-center gap-1 mt-1 line-clamp-1">
                      <MapPin className="w-3.5 h-3.5 text-brand-600 shrink-0" />
                      <span>{item.propertyAddress ? `${item.propertyAddress}, ${item.propertyNumber}` : 'Endereço não informado'}</span>
                    </p>
                  </div>

                  {/* Parties info */}
                  <div className="text-xs text-slate-600 space-y-1 bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                    <div className="flex items-center justify-between">
                      <span className="text-slate-400">Inquilino:</span>
                      <strong className="text-slate-800 truncate max-w-[150px]">{item.tenantName || 'Não informado'}</strong>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-slate-400">Vistoriador:</span>
                      <span className="text-slate-700 truncate max-w-[150px]">{item.inspectorName || 'Não informado'}</span>
                    </div>
                  </div>

                  {/* Summary badges */}
                  <div className="flex items-center gap-2 text-[11px] text-slate-500 font-semibold pt-1">
                    <span className="bg-slate-100 px-2 py-0.5 rounded-md">{item.rooms.length} cômodos</span>
                    <span className="bg-slate-100 px-2 py-0.5 rounded-md">{totalItems} itens</span>
                    <span className="bg-slate-100 px-2 py-0.5 rounded-md">{totalPhotos} fotos</span>
                    {repairsCount > 0 && (
                      <span className="bg-rose-50 text-rose-600 border border-rose-200 px-2 py-0.5 rounded-md font-bold">
                        {repairsCount} reparos
                      </span>
                    )}
                  </div>
                </div>

                {/* Card Actions Footer */}
                <div className="pt-3 border-t border-slate-100 flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5">
                    {/* Duplicate as Saída */}
                    {item.inspectionType === 'Entrada' && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onDuplicateInspection(item, 'Saída');
                        }}
                        className="p-2 rounded-xl bg-amber-50 hover:bg-amber-100 text-amber-700 text-xs font-semibold border border-amber-200 transition-colors flex items-center gap-1"
                        title="Criar Vistoria de Saída baseada nesta"
                      >
                        <Copy className="w-3.5 h-3.5" />
                        <span className="text-[10px] hidden sm:inline">Gerar Saída</span>
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onDeleteInspection(item.id, item.title);
                      }}
                      className="p-2 rounded-xl text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"
                      title="Excluir Vistoria"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>

                  <button
                    type="button"
                    onClick={() => onSelectInspection(item)}
                    className="flex items-center gap-1 text-xs font-bold text-brand-600 hover:text-brand-700 px-3 py-1.5 rounded-xl hover:bg-brand-50 transition-colors"
                  >
                    <span>Abrir Laudo</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="bg-white rounded-3xl border-2 border-dashed border-slate-200 p-12 text-center space-y-4">
          <div className="w-14 h-14 rounded-2xl bg-brand-50 text-brand-600 flex items-center justify-center mx-auto">
            <Building className="w-7 h-7" />
          </div>
          <div>
            <h3 className="text-base font-bold text-slate-800">Nenhuma vistoria encontrada</h3>
            <p className="text-xs text-slate-500 max-w-sm mx-auto mt-1">
              Comece agora criando seu primeiro laudo de vistoria imobiliária.
            </p>
          </div>
          <button
            onClick={onNewInspection}
            className="px-5 py-2.5 rounded-xl bg-brand-600 hover:bg-brand-700 text-white font-bold text-xs shadow-md transition-all inline-flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            <span>Criar Nova Vistoria</span>
          </button>
        </div>
      )}

    </div>
  );
};
