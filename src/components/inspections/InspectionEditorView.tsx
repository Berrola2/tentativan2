import React, { useState, useEffect, useCallback, useRef } from 'react';
import { 
  ArrowLeft, 
  Building, 
  CheckCircle2, 
  Plus, 
  ChevronDown, 
  ChevronUp, 
  Trash2, 
  Wrench, 
  Loader2, 
  AlertCircle, 
  RotateCcw, 
  Camera, 
  Check,
  AlertTriangle,
  Image as ImageIcon,
  Mic,
  Sparkles,
  DownloadCloud,
  CheckCircle
} from 'lucide-react';
import { 
  getInspectionWithDetails, 
  addRoom, 
  deleteRoom, 
  addItem, 
  updateItem, 
  deleteItem, 
  finalizeInspection, 
  reopenInspection 
} from '../../services/inspections';
import { 
  listInspectionMedia, 
  deleteInspectionMedia 
} from '../../services/media';
import { 
  processAudioWithAI 
} from '../../services/ai';
import { offlineDb } from '../../services/offlineDb';
import { syncEngine } from '../../services/syncEngine';
import { networkState } from '../../services/networkState';
import type { 
  Inspection, 
  InspectionRoom, 
  InspectionItem, 
  ItemCondition 
} from '../../types/inspection';
import type { InspectionMedia } from '../../types/media';
import type { InspectionTranscription } from '../../types/audio';
import { 
  ITEM_CONDITION_LABELS, 
  ITEM_CONDITION_COLORS, 
  COMMON_ROOM_TEMPLATES, 
  COMMON_ITEM_SUGGESTIONS 
} from '../../types/inspection';
import { useAuth } from '../../contexts/AuthContext';
import { MediaUploader } from '../media/MediaUploader';
import { MediaGallery } from '../media/MediaGallery';
import { AudioRecorderModal } from '../audio/AudioRecorderModal';
import { TranscriptionReviewModal } from '../audio/TranscriptionReviewModal';
import { InspectionDocumentsPanel } from '../documents/InspectionDocumentsPanel';


interface InspectionEditorViewProps {
  inspectionId: string;
  onBack: () => void;
}

export const InspectionEditorView: React.FC<InspectionEditorViewProps> = ({
  inspectionId,
  onBack,
}) => {
  const { isCompanyManager, companyId: authCompanyId } = useAuth();
  const [inspection, setInspection] = useState<Inspection | null>(null);
  const [rooms, setRooms] = useState<(InspectionRoom & { items: InspectionItem[] })[]>([]);
  const [allMedia, setAllMedia] = useState<InspectionMedia[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [expandedRooms, setExpandedRooms] = useState<Record<string, boolean>>({});

  // Modals & Actions
  const [isAddRoomModalOpen, setIsAddRoomModalOpen] = useState(false);
  const [customRoomName, setCustomRoomName] = useState('');
  const [isFinalizeModalOpen, setIsFinalizeModalOpen] = useState(false);
  const [isActionLoading, setIsActionLoading] = useState(false);
  const [globalError, setGlobalError] = useState<string | null>(null);

  // Offline state
  const [isOfflineAvailable, setIsOfflineAvailable] = useState(false);
  const [isDownloadingOffline, setIsDownloadingOffline] = useState(false);
  const [offlineProgress, setOfflineProgress] = useState<{ step: string; percent: number } | null>(null);

  // Audio & AI Transcription state
  const [audioTarget, setAudioTarget] = useState<{
    roomId: string;
    itemId: string;
    roomName: string;
    itemName: string;
    currentDescription: string;
  } | null>(null);
  const [isAudioModalOpen, setIsAudioModalOpen] = useState(false);
  const [activeTranscription, setActiveTranscription] = useState<InspectionTranscription | null>(null);
  const [isReviewModalOpen, setIsReviewModalOpen] = useState(false);
  const [isProcessingAI, setIsProcessingAI] = useState(false);

  // Quick item addition modal/popover per room
  const [activeRoomForItem, setActiveRoomForItem] = useState<string | null>(null);
  const [customItemName, setCustomItemName] = useState('');

  // Autosave status per item: itemId -> 'saving' | 'saved' | 'error' | 'conflict'
  const [saveStatus, setSaveStatus] = useState<Record<string, 'saving' | 'saved' | 'error' | 'conflict'>>({});
  const debounceTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  const isCompleted = inspection?.status === 'COMPLETED';

  // Verificar status offline local
  const checkOfflineStatus = useCallback(async () => {
    try {
      const off = await offlineDb.offline_inspections.get(inspectionId);
      setIsOfflineAvailable(!!off && off.offline_available);
    } catch (e) {
      console.warn('Erro ao verificar offline status:', e);
    }
  }, [inspectionId]);

  // Carregar dados de estrutura da vistoria e mídias
  const loadMedia = useCallback(async () => {
    if (networkState.getStatus() === 'OFFLINE') {
      const offMedia = await offlineDb.offline_media.where('inspection_id').equals(inspectionId).toArray();
      const mappedMedia: InspectionMedia[] = offMedia.map((m) => ({
        id: m.id,
        inspection_id: m.inspection_id,
        room_id: m.room_id || null,
        item_id: m.item_id || null,
        company_id: m.company_id,
        media_type: m.media_type as any,
        storage_bucket: 'inspection-media',
        storage_path: m.storage_path || '',
        original_filename: `${m.id}.jpg`,
        mime_type: 'image/jpeg',
        file_size: m.size_bytes,
        width: 1920,
        height: 1080,
        public_url: m.blob ? URL.createObjectURL(m.blob) : '',
        thumbnail_url: m.thumbnail_url || (m.blob ? URL.createObjectURL(m.blob) : ''),
        caption: m.caption || null,
        position: m.position,
        upload_status: 'READY' as const,
        uploaded_by: '',
        created_at: m.created_at,
        updated_at: m.created_at
      }));
      setAllMedia(mappedMedia);
      return;
    }

    try {
      const mediaList = await listInspectionMedia({ inspectionId });
      setAllMedia(mediaList);
    } catch (err) {
      console.warn('[InspectionEditorView] Erro ao carregar mídias:', err);
    }
  }, [inspectionId]);

  const loadData = useCallback(async () => {
    setIsLoading(true);
    setGlobalError(null);
    try {
      await checkOfflineStatus();

      // Se estiver OFFLINE, carregar exclusivamente do IndexedDB
      if (networkState.getStatus() === 'OFFLINE') {
        const offInsp = await offlineDb.offline_inspections.get(inspectionId);
        if (!offInsp) {
          throw new Error('Esta vistoria não foi disponibilizada para acesso offline no dispositivo.');
        }

        const offRooms = await offlineDb.offline_rooms.where('inspection_id').equals(inspectionId).sortBy('position');
        const offItems = await offlineDb.offline_items.where('inspection_id').equals(inspectionId).sortBy('position');

        const roomsWithItems = offRooms.map((r) => ({
          id: r.id,
          inspection_id: r.inspection_id,
          name: r.name,
          room_type: r.room_type,
          position: r.position,
          notes: r.notes || null,
          created_at: r.created_at,
          updated_at: r.updated_at,
          items: offItems
            .filter((it) => it.room_id === r.id)
            .map((it) => ({
              id: it.id,
              inspection_id: it.inspection_id,
              room_id: it.room_id,
              name: it.name,
              item_type: it.item_type,
              condition_status: it.condition_status,
              description: it.description || null,
              requires_repair: it.requires_repair,
              repair_notes: it.repair_notes || null,
              position: it.position,
              created_at: it.created_at,
              updated_at: it.updated_at
            }))
        }));

        setInspection({
          id: offInsp.id,
          property_id: offInsp.property_id,
          company_id: offInsp.company_id,
          inspector_id: offInsp.user_id,
          title: offInsp.property?.title || 'Vistoria Offline',
          inspection_type: offInsp.inspection_type as any,
          status: offInsp.status as any,
          scheduled_date: offInsp.scheduled_date || null,
          inspection_date: offInsp.scheduled_date || new Date().toISOString(),
          created_at: offInsp.downloaded_at,
          updated_at: offInsp.local_updated_at,
          property: offInsp.property ? ({
            id: offInsp.property.id,
            street: offInsp.property.address_street || '',
            number: offInsp.property.address_number || '',
            neighborhood: offInsp.property.address_neighborhood || '',
            city: offInsp.property.address_city || '',
            state: offInsp.property.address_state || '',
            complement: '',
            property_type: 'RESIDENTIAL' as any,
            title: offInsp.property.title,
            company_id: offInsp.company_id,
            created_at: '',
            updated_at: ''
          } as any) : undefined
        } as any);

        setRooms(roomsWithItems as any);
        const expanded: Record<string, boolean> = {};
        roomsWithItems.forEach((r) => { expanded[r.id] = true; });
        setExpandedRooms(expanded);
        await loadMedia();
        return;
      }

      // Se ONLINE, carregar do Supabase
      const data = await getInspectionWithDetails(inspectionId);
      setInspection(data.inspection);
      setRooms(data.rooms);
      
      const expanded: Record<string, boolean> = {};
      data.rooms.forEach((r) => { expanded[r.id] = true; });
      setExpandedRooms(expanded);

      await loadMedia();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erro ao carregar vistoria.';
      setGlobalError(msg);
    } finally {
      setIsLoading(false);
    }
  }, [inspectionId, loadMedia, checkOfflineStatus]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const toggleRoomAccordion = (roomId: string) => {
    setExpandedRooms((prev) => ({ ...prev, [roomId]: !prev[roomId] }));
  };

  // --------------------------------------------------------------------------
  // Gestão de Disponibilização Offline
  // --------------------------------------------------------------------------
  const handleToggleOffline = async () => {
    if (isOfflineAvailable) {
      const res = await syncEngine.removeOfflineInspection(inspectionId);
      if (!res.success) {
        alert(`Não é possível remover: existem ${res.pendingOpsCount} alteraçõe(s) pendentes no dispositivo.`);
        return;
      }
      setIsOfflineAvailable(false);
      alert('Vistoria removida do armazenamento local do dispositivo.');
    } else {
      setIsDownloadingOffline(true);
      setOfflineProgress({ step: 'Iniciando download...', percent: 5 });

      const res = await syncEngine.prepareInspectionOffline(inspectionId, {
        onProgress: (step, percent) => {
          setOfflineProgress({ step, percent });
        }
      });

      setIsDownloadingOffline(false);
      setOfflineProgress(null);

      if (res.success) {
        setIsOfflineAvailable(true);
        alert('Vistoria disponibilizada offline com sucesso! Você pode continuar trabalhando mesmo sem sinal.');
      } else {
        alert(`Erro ao disponibilizar offline: ${res.error}`);
      }
    }
  };

  // --------------------------------------------------------------------------
  // Gestão de Ambientes (Rooms)
  // --------------------------------------------------------------------------
  const handleAddRoom = async (name: string) => {
    if (!name.trim()) return;
    setIsActionLoading(true);
    try {
      const newPosition = rooms.length + 1;
      const compId = inspection?.company_id || authCompanyId || '';

      if (networkState.getStatus() === 'OFFLINE') {
        const created = await syncEngine.offlineCreateRoom(
          inspectionId,
          compId,
          name.trim(),
          'CUSTOM',
          newPosition
        );
        setRooms((prev) => [...prev, { ...created, items: [] } as any]);
        setExpandedRooms((prev) => ({ ...prev, [created.id]: true }));
        setIsAddRoomModalOpen(false);
        setCustomRoomName('');
        return;
      }

      const created = await addRoom({
        inspection_id: inspectionId,
        name: name.trim(),
        position: newPosition,
      });

      setRooms((prev) => [...prev, { ...created, items: [] }]);
      setExpandedRooms((prev) => ({ ...prev, [created.id]: true }));
      setIsAddRoomModalOpen(false);
      setCustomRoomName('');
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Erro ao adicionar ambiente.');
    } finally {
      setIsActionLoading(false);
    }
  };

  const handleDeleteRoom = async (roomId: string) => {
    if (isCompleted) return;
    if (!confirm('Deseja realmente excluir este ambiente e todos os seus itens e fotos?')) return;

    try {
      if (networkState.getStatus() === 'OFFLINE') {
        await offlineDb.offline_rooms.delete(roomId);
        await syncEngine.enqueueOperation('ROOM', roomId, 'DELETE_ROOM', inspectionId, {});
        setRooms((prev) => prev.filter((r) => r.id !== roomId));
        await loadMedia();
        return;
      }

      await deleteRoom(roomId);
      setRooms((prev) => prev.filter((r) => r.id !== roomId));
      await loadMedia();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Erro ao remover ambiente.');
    }
  };

  // --------------------------------------------------------------------------
  // Gestão de Itens (Items)
  // --------------------------------------------------------------------------
  const handleAddItem = async (roomId: string, name: string) => {
    if (!name.trim() || isCompleted) return;
    try {
      const room = rooms.find((r) => r.id === roomId);
      const position = (room?.items.length || 0) + 1;
      const compId = inspection?.company_id || authCompanyId || '';

      if (networkState.getStatus() === 'OFFLINE') {
        const created = await syncEngine.offlineCreateItem(
          inspectionId,
          roomId,
          compId,
          name.trim(),
          'CUSTOM',
          'GOOD',
          undefined,
          false,
          undefined,
          position
        );
        setRooms((prev) =>
          prev.map((r) => (r.id === roomId ? { ...r, items: [...r.items, created as any] } : r))
        );
        setActiveRoomForItem(null);
        setCustomItemName('');
        return;
      }

      const created = await addItem({
        room_id: roomId,
        inspection_id: inspectionId,
        name: name.trim(),
        position,
        condition_status: 'GOOD',
      });

      setRooms((prev) =>
        prev.map((r) => (r.id === roomId ? { ...r, items: [...r.items, created] } : r))
      );
      setActiveRoomForItem(null);
      setCustomItemName('');
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Erro ao adicionar item.');
    }
  };

  const handleDeleteItem = async (roomId: string, itemId: string) => {
    if (isCompleted) return;
    if (!confirm('Deseja realmente excluir este item e suas fotos?')) return;

    try {
      if (networkState.getStatus() === 'OFFLINE') {
        await offlineDb.offline_items.delete(itemId);
        await syncEngine.enqueueOperation('ITEM', itemId, 'DELETE_ITEM', inspectionId, {});
        setRooms((prev) =>
          prev.map((r) =>
            r.id === roomId ? { ...r, items: r.items.filter((i) => i.id !== itemId) } : r
          )
        );
        await loadMedia();
        return;
      }

      await deleteItem(itemId);
      setRooms((prev) =>
        prev.map((r) =>
          r.id === roomId ? { ...r, items: r.items.filter((i) => i.id !== itemId) } : r
        )
      );
      await loadMedia();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Erro ao remover item.');
    }
  };

  // --------------------------------------------------------------------------
  // Autosave com Debounce & Detecção de Concorrência
  // --------------------------------------------------------------------------
  const handleItemFieldChange = (
    roomId: string,
    itemId: string,
    fields: Partial<InspectionItem>
  ) => {
    if (isCompleted) return;

    // Atualização otimista local imediata no React state
    let currentItemUpdatedAt: string | undefined;
    setRooms((prevRooms) =>
      prevRooms.map((r) => {
        if (r.id !== roomId) return r;
        return {
          ...r,
          items: r.items.map((it) => {
            if (it.id === itemId) {
              currentItemUpdatedAt = it.updated_at;
              return { ...it, ...fields };
            }
            return it;
          }),
        };
      })
    );

    // Se estiver OFFLINE, salva diretamente no IndexedDB e enfileira
    if (networkState.getStatus() === 'OFFLINE') {
      setSaveStatus((prev) => ({ ...prev, [itemId]: 'saved' }));
      syncEngine.offlineUpdateItem(itemId, inspectionId, fields as any);
      return;
    }

    // Marca como 'saving'
    setSaveStatus((prev) => ({ ...prev, [itemId]: 'saving' }));

    // Limpa timeout anterior de debounce
    if (debounceTimers.current[itemId]) {
      clearTimeout(debounceTimers.current[itemId]);
    }

    // Debounce de 700ms para salvar no PostgreSQL
    debounceTimers.current[itemId] = setTimeout(async () => {
      try {
        const updated = await updateItem(itemId, fields, currentItemUpdatedAt);

        // Atualiza a versão do updated_at retornado pelo banco
        setRooms((prevRooms) =>
          prevRooms.map((r) => {
            if (r.id !== roomId) return r;
            return {
              ...r,
              items: r.items.map((it) => (it.id === itemId ? { ...it, updated_at: updated.updated_at } : it)),
            };
          })
        );

        setSaveStatus((prev) => ({ ...prev, [itemId]: 'saved' }));
        setTimeout(() => {
          setSaveStatus((prev) => {
            const next = { ...prev };
            if (next[itemId] === 'saved') delete next[itemId];
            return next;
          });
        }, 2500);
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Erro desconhecido';
        if (msg.includes('CONCURRENCY_CONFLICT')) {
          setSaveStatus((prev) => ({ ...prev, [itemId]: 'conflict' }));
        } else {
          setSaveStatus((prev) => ({ ...prev, [itemId]: 'error' }));
        }
      }
    }, 700);
  };


  // --------------------------------------------------------------------------
  // Gestão de Áudio e Assistente de IA
  // --------------------------------------------------------------------------
  const handleStartVoiceDescription = (
    roomId: string, 
    itemId: string, 
    roomName: string, 
    itemName: string, 
    currentDescription: string
  ) => {
    if (isCompleted) return;

    if (networkState.getStatus() === 'OFFLINE') {
      alert('O assistente de IA Gemini requer conexão com a internet. Você pode digitar a descrição técnica diretamente no campo de texto.');
      return;
    }

    setAudioTarget({ roomId, itemId, roomName, itemName, currentDescription });
    setIsAudioModalOpen(true);
  };

  const handleAudioRecordingComplete = async (transcript: string) => {
    if (!audioTarget) return;
    setIsAudioModalOpen(false);
    setIsProcessingAI(true);

    try {
      const result = await processAudioWithAI({
        inspectionId,
        roomId: audioTarget.roomId,
        itemId: audioTarget.itemId,
        roomName: audioTarget.roomName,
        itemName: audioTarget.itemName,
        rawTranscript: transcript,
      });

      setActiveTranscription(result);
      setIsReviewModalOpen(true);
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Erro ao processar áudio com IA.');
    } finally {
      setIsProcessingAI(false);
    }
  };

  const handleTranscriptionApplied = (appliedDescription: string) => {
    if (!audioTarget) return;
    handleItemFieldChange(audioTarget.roomId, audioTarget.itemId, { description: appliedDescription });
    setIsReviewModalOpen(false);
    setAudioTarget(null);
  };

  const handleReprocessTranscription = async (newRawText: string) => {
    if (!audioTarget) return;
    setIsProcessingAI(true);

    try {
      const result = await processAudioWithAI({
        inspectionId,
        roomId: audioTarget.roomId,
        itemId: audioTarget.itemId,
        roomName: audioTarget.roomName,
        itemName: audioTarget.itemName,
        rawTranscript: newRawText,
      });
      setActiveTranscription(result);
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Erro ao reprocessar com IA.');
    } finally {
      setIsProcessingAI(false);
    }
  };

  // --------------------------------------------------------------------------
  // Gestão de Mídias
  // --------------------------------------------------------------------------
  const handleDeleteMedia = async (mediaId: string) => {
    if (networkState.getStatus() === 'OFFLINE') {
      await offlineDb.offline_media.delete(mediaId);
      await syncEngine.enqueueOperation('MEDIA', mediaId, 'DELETE_MEDIA', inspectionId, {});
      await loadMedia();
      return;
    }

    await deleteInspectionMedia(mediaId);
    setAllMedia((prev) => prev.filter((m) => m.id !== mediaId));
  };

  const getInspectionPhotos = () => allMedia.filter((m) => !m.room_id && !m.item_id);
  const getRoomPhotos = (roomId: string) => allMedia.filter((m) => m.room_id === roomId && !m.item_id);
  const getItemPhotos = (itemId: string) => allMedia.filter((m) => m.item_id === itemId);

  // --------------------------------------------------------------------------
  // Finalização e Reabertura
  // --------------------------------------------------------------------------
  const handleFinalize = async () => {
    if (networkState.getStatus() === 'OFFLINE') {
      alert('Esta ação exige conexão com a internet. A vistoria não pode ser finalizada oficialmente offline.');
      return;
    }

    setIsActionLoading(true);
    try {
      await finalizeInspection(inspectionId);
      await loadData();
      setIsFinalizeModalOpen(false);
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Erro ao finalizar vistoria.');
    } finally {
      setIsActionLoading(false);
    }
  };

  const handleReopen = async () => {
    if (networkState.getStatus() === 'OFFLINE') {
      alert('Esta ação exige conexão com a internet. A vistoria não pode ser reaberta offline.');
      return;
    }

    if (!confirm('Deseja reabrir esta vistoria para edição?')) return;
    setIsActionLoading(true);
    try {
      await reopenInspection(inspectionId);
      await loadData();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Erro ao reabrir vistoria.');
    } finally {
      setIsActionLoading(false);
    }
  };

  // --------------------------------------------------------------------------
  // Render
  // --------------------------------------------------------------------------
  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4">
        <Loader2 className="w-8 h-8 text-blue-600 animate-spin mb-3" />
        <p className="text-sm font-bold text-slate-700">Carregando dados da vistoria e mídias...</p>
      </div>
    );
  }

  if (globalError || !inspection) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4">
        <div className="bg-white p-6 sm:p-8 rounded-3xl border border-slate-200 shadow-xl max-w-md w-full text-center space-y-4">
          <div className="w-12 h-12 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center mx-auto">
            <AlertCircle className="w-6 h-6" />
          </div>
          <h2 className="text-lg font-black text-slate-900">Erro ao Acessar Vistoria</h2>
          <p className="text-xs text-slate-600">{globalError || 'Vistoria não encontrada ou sem permissão de acesso.'}</p>
          <button
            onClick={onBack}
            className="w-full py-2.5 rounded-xl bg-slate-900 text-white font-bold text-xs hover:bg-slate-800 transition-colors"
          >
            Voltar para Lista
          </button>
        </div>
      </div>
    );
  }

  const totalRooms = rooms.length;
  const totalItems = rooms.reduce((acc, r) => acc + r.items.length, 0);
  const totalPhotos = allMedia.length;
  const companyId = inspection.company_id || authCompanyId || '';

  return (
    <div className="min-h-screen bg-slate-50/60 pb-24 text-slate-800">
      
      {/* Top Sticky Header */}
      <header className="sticky top-0 z-30 bg-white/95 backdrop-blur-md border-b border-slate-200 shadow-xs">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <button
              onClick={onBack}
              className="p-2 rounded-xl text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition-colors"
              title="Voltar"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-sm sm:text-base font-black text-slate-900 truncate max-w-[200px] sm:max-w-md">
                  {inspection.title}
                </h1>
                <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider ${
                  isCompleted ? 'bg-emerald-100 text-emerald-800' : 'bg-blue-100 text-blue-800'
                }`}>
                  {isCompleted ? 'Concluída' : 'Em Andamento'}
                </span>
              </div>
              <p className="text-[11px] text-slate-400">
                {new Date(inspection.inspection_date).toLocaleDateString('pt-BR')} • {inspection.inspection_type}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Botão Disponibilizar Offline */}
            <button
              onClick={handleToggleOffline}
              disabled={isDownloadingOffline}
              className={`px-3 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all shadow-xs ${
                isOfflineAvailable
                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-300 hover:bg-emerald-100'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200 border border-slate-200'
              }`}
              title={isOfflineAvailable ? 'Vistoria salva no aparelho. Clique para remover.' : 'Baixar dados para uso sem internet'}
            >
              {isDownloadingOffline ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-blue-600" />
                  <span className="hidden sm:inline">Baixando ({offlineProgress?.percent || 0}%)...</span>
                  <span className="sm:hidden">{offlineProgress?.percent || 0}%</span>
                </>
              ) : isOfflineAvailable ? (
                <>
                  <CheckCircle className="w-3.5 h-3.5 text-emerald-600" />
                  <span className="hidden sm:inline">No Dispositivo</span>
                  <span className="sm:hidden">Offline</span>
                </>
              ) : (
                <>
                  <DownloadCloud className="w-3.5 h-3.5 text-slate-600" />
                  <span className="hidden sm:inline">Disponibilizar Offline</span>
                  <span className="sm:hidden">Baixar</span>
                </>
              )}
            </button>

            {isCompleted ? (
              isCompanyManager && (
                <button
                  onClick={handleReopen}
                  disabled={isActionLoading}
                  className="px-3 sm:px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-white font-bold text-xs flex items-center gap-1.5 shadow-sm transition-all active:scale-95"
                  title="Reabrir Vistoria (Gerente)"
                >
                  <RotateCcw className="w-4 h-4" />
                  <span className="hidden sm:inline">Reabrir Vistoria</span>
                  <span className="sm:hidden">Reabrir</span>
                </button>
              )
            ) : (
              <button
                onClick={() => setIsFinalizeModalOpen(true)}
                className="px-3 sm:px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center gap-1.5 shadow-lg shadow-emerald-600/20 transition-all active:scale-95"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>Finalizar Vistoria</span>
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Main Field Editor Content */}
      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-6 w-full space-y-6">
        
        {/* Inspection Summary Card */}
        <div className="bg-white rounded-3xl p-5 sm:p-6 border border-slate-200 shadow-sm flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-xs font-bold text-slate-500 uppercase tracking-wider">
              <Building className="w-4 h-4 text-blue-600" />
              <span>Dados do Imóvel</span>
            </div>
            {inspection.property && (
              <>
                <h2 className="text-sm sm:text-base font-bold text-slate-900">
                  {inspection.property.street}{inspection.property.number ? `, ${inspection.property.number}` : ''}
                  {inspection.property.complement ? ` - ${inspection.property.complement}` : ''}
                </h2>
                <p className="text-xs text-slate-500">
                  {inspection.property.neighborhood ? `${inspection.property.neighborhood}, ` : ''}
                  {inspection.property.city} - {inspection.property.state}
                </p>
              </>
            )}
          </div>

          <div className="flex sm:flex-col items-center sm:items-end justify-between w-full sm:w-auto pt-3 sm:pt-0 border-t sm:border-t-0 border-slate-100">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Progresso do Laudo</span>
            <div className="text-xs sm:text-sm font-black text-slate-900 flex items-center gap-1.5">
              <span>{totalRooms} {totalRooms === 1 ? 'ambiente' : 'ambientes'}</span>
              <span className="text-slate-300">•</span>
              <span className="text-blue-600">{totalItems} {totalItems === 1 ? 'item' : 'itens'}</span>
              <span className="text-slate-300">•</span>
              <span className="text-emerald-600 flex items-center gap-1">
                <Camera className="w-3.5 h-3.5" /> {totalPhotos} {totalPhotos === 1 ? 'foto' : 'fotos'}
              </span>
            </div>
          </div>
        </div>

        {/* Painel de Laudos Oficiais e PDF */}
        <InspectionDocumentsPanel
          inspectionId={inspectionId}
          isCompleted={isCompleted}
          canGenerate={!isCompleted ? false : true}
        />

        {/* Fotos Gerais da Vistoria (Fachada, Medidores, etc.) */}
        <div className="bg-white rounded-3xl p-5 sm:p-6 border border-slate-200 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold text-xs">
                <Camera className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm sm:text-base font-bold text-slate-900">
                  Fotos Gerais da Vistoria
                </h3>
                <p className="text-xs text-slate-500">
                  Fachada, número do imóvel, medidores de água/luz/gás e visão panorâmica externa.
                </p>
              </div>
            </div>
            <span className="px-2.5 py-1 bg-slate-100 text-slate-600 rounded-lg text-xs font-bold">
              {getInspectionPhotos().length} {getInspectionPhotos().length === 1 ? 'foto' : 'fotos'}
            </span>
          </div>

          {!isCompleted && (
            <MediaUploader
              companyId={companyId}
              inspectionId={inspectionId}
              roomId={null}
              itemId={null}
              disabled={isCompleted}
              onUploadSuccess={loadMedia}
            />
          )}

          <MediaGallery
            mediaList={getInspectionPhotos()}
            onDeleteMedia={handleDeleteMedia}
            onRefresh={loadMedia}
            readOnly={isCompleted}
          />
        </div>

        {/* Ambientes Section Header */}
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-base font-black text-slate-900 tracking-tight">Ambientes da Vistoria</h2>
            <p className="text-xs text-slate-500">Adicione cômodos, tire fotos, grave descrições por voz e detalhe a conservação</p>
          </div>

          {!isCompleted && (
            <button
              onClick={() => setIsAddRoomModalOpen(true)}
              className="px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs flex items-center gap-1.5 shadow-md shadow-blue-600/20 transition-all active:scale-95"
            >
              <Plus className="w-4 h-4" />
              <span>Adicionar Ambiente</span>
            </button>
          )}
        </div>

        {/* Ambientes / Rooms List */}
        {rooms.length === 0 ? (
          <div className="bg-white p-12 rounded-3xl border border-slate-200 text-center space-y-3 shadow-sm">
            <Building className="w-10 h-10 mx-auto text-slate-300" />
            <h3 className="text-sm font-bold text-slate-800">Nenhum ambiente adicionado ainda</h3>
            <p className="text-xs text-slate-400 max-w-sm mx-auto">
              Clique no botão abaixo para adicionar a Sala, Cozinha, Quartos ou qualquer ambiente personalizado.
            </p>
            {!isCompleted && (
              <button
                onClick={() => setIsAddRoomModalOpen(true)}
                className="px-6 py-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs inline-flex items-center gap-2 shadow-lg shadow-blue-600/20 transition-all"
              >
                <Plus className="w-4 h-4" />
                <span>Adicionar Primeiro Ambiente</span>
              </button>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            {rooms.map((room) => {
              const isExpanded = !!expandedRooms[room.id];
              const roomKey = room.name.toLowerCase().includes('coz') ? 'cozinha' : room.name.toLowerCase().includes('banh') ? 'banheiro' : 'default';
              const suggestions = COMMON_ITEM_SUGGESTIONS[roomKey] || COMMON_ITEM_SUGGESTIONS.default;
              const roomPhotos = getRoomPhotos(room.id);

              return (
                <div 
                  key={room.id}
                  className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden transition-all"
                >
                  {/* Room Accordion Header */}
                  <div 
                    onClick={() => toggleRoomAccordion(room.id)}
                    className="p-4 sm:p-5 flex items-center justify-between cursor-pointer hover:bg-slate-50/50 select-none"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold text-xs">
                        {room.position}
                      </div>
                      <div>
                        <h3 className="text-sm sm:text-base font-bold text-slate-900 flex items-center gap-2">
                          <span>{room.name}</span>
                          <span className="text-xs font-normal text-slate-400">({room.items.length} itens)</span>
                          {roomPhotos.length > 0 && (
                            <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 text-[10px] font-bold flex items-center gap-1">
                              <Camera className="w-3 h-3 text-slate-500" /> {roomPhotos.length}
                            </span>
                          )}
                        </h3>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      {!isCompleted && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteRoom(room.id);
                          }}
                          className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-colors"
                          title="Remover Ambiente"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                      <div className="p-1.5 rounded-xl bg-slate-100 text-slate-600">
                        {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                      </div>
                    </div>
                  </div>

                  {/* Room Content when Expanded */}
                  {isExpanded && (
                    <div className="p-4 sm:p-6 border-t border-slate-100 bg-slate-50/40 space-y-5">
                      
                      {/* Fotos Gerais do Ambiente */}
                      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs space-y-3">
                        <div className="flex items-center justify-between">
                          <h4 className="text-xs font-bold text-slate-700 flex items-center gap-1.5 uppercase tracking-wider">
                            <ImageIcon className="w-4 h-4 text-blue-500" />
                            <span>Fotos Gerais do Ambiente</span>
                          </h4>
                          <span className="text-[11px] font-semibold text-slate-500">
                            {roomPhotos.length} fotos
                          </span>
                        </div>

                        {!isCompleted && (
                          <MediaUploader
                            companyId={companyId}
                            inspectionId={inspectionId}
                            roomId={room.id}
                            itemId={null}
                            disabled={isCompleted}
                            onUploadSuccess={loadMedia}
                          />
                        )}

                        <MediaGallery
                          mediaList={roomPhotos}
                          onDeleteMedia={handleDeleteMedia}
                          onRefresh={loadMedia}
                          readOnly={isCompleted}
                        />
                      </div>

                      {/* Items List */}
                      {room.items.length === 0 ? (
                        <div className="p-6 text-center text-slate-400 bg-white rounded-2xl border border-dashed border-slate-200 text-xs">
                          Nenhum item adicionado neste ambiente. Use os botões abaixo para sugerir itens comuns.
                        </div>
                      ) : (
                        <div className="space-y-4">
                          {room.items.map((item) => {
                            const status = saveStatus[item.id];
                            const itemPhotos = getItemPhotos(item.id);

                            return (
                              <div 
                                key={item.id}
                                className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-sm space-y-4"
                              >
                                <div className="flex items-center justify-between gap-3">
                                  <div className="flex items-center gap-2">
                                    <span className="w-6 h-6 rounded-lg bg-slate-100 text-slate-600 font-bold text-[11px] flex items-center justify-center">
                                      {item.position}
                                    </span>
                                    <h4 className="text-xs sm:text-sm font-bold text-slate-900">
                                      {item.name}
                                    </h4>
                                    <span className="px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 text-[10px] font-bold flex items-center gap-1 border border-blue-200">
                                      <Camera className="w-3 h-3" /> {itemPhotos.length} {itemPhotos.length === 1 ? 'foto' : 'fotos'}
                                    </span>
                                  </div>

                                  <div className="flex items-center gap-2">
                                    {/* Status de Autosave */}
                                    {status === 'saving' && (
                                      <span className="text-[10px] text-blue-600 font-bold flex items-center gap-1">
                                        <Loader2 className="w-3 h-3 animate-spin" /> Salvando...
                                      </span>
                                    )}
                                    {status === 'saved' && (
                                      <span className="text-[10px] text-emerald-600 font-bold flex items-center gap-1">
                                        <Check className="w-3 h-3" /> Salvo
                                      </span>
                                    )}
                                    {status === 'error' && (
                                      <span className="text-[10px] text-rose-600 font-bold flex items-center gap-1">
                                        <AlertCircle className="w-3 h-3" /> Erro ao salvar
                                      </span>
                                    )}
                                    {status === 'conflict' && (
                                      <span className="text-[10px] text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full font-bold flex items-center gap-1 border border-amber-200">
                                        <AlertTriangle className="w-3 h-3" /> Conflito de edição
                                      </span>
                                    )}

                                    {!isCompleted && (
                                      <button
                                        onClick={() => handleDeleteItem(room.id, item.id)}
                                        className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-rose-50 transition-colors"
                                        title="Excluir Item"
                                      >
                                        <Trash2 className="w-3.5 h-3.5" />
                                      </button>
                                    )}
                                  </div>
                                </div>

                                {/* Condition Status Selector Pills */}
                                <div>
                                  <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1.5">
                                    Estado de Conservação
                                  </label>
                                  <div className="flex flex-wrap gap-1.5">
                                    {(['NEW', 'GOOD', 'REGULAR', 'BAD', 'DAMAGED', 'NOT_APPLICABLE'] as ItemCondition[]).map((cond) => {
                                      const isSelected = item.condition_status === cond;
                                      const style = ITEM_CONDITION_COLORS[cond];

                                      return (
                                        <button
                                          key={cond}
                                          disabled={isCompleted}
                                          type="button"
                                          onClick={() => handleItemFieldChange(room.id, item.id, { condition_status: cond })}
                                          className={`px-3 py-1 rounded-xl text-[11px] font-bold transition-all ${
                                            isSelected
                                              ? `${style.bg} ${style.text} border-2 ${style.border} shadow-sm`
                                              : 'bg-slate-50 text-slate-500 border border-slate-200 hover:bg-slate-100'
                                          } disabled:opacity-75`}
                                        >
                                          {ITEM_CONDITION_LABELS[cond]}
                                        </button>
                                      );
                                    })}
                                  </div>
                                </div>

                                {/* Requires Repair Toggle */}
                                <div className="pt-1">
                                  <label className="flex items-center gap-2 cursor-pointer select-none">
                                    <input
                                      type="checkbox"
                                      disabled={isCompleted}
                                      checked={item.requires_repair}
                                      onChange={(e) => handleItemFieldChange(room.id, item.id, { requires_repair: e.target.checked })}
                                      className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500 border-slate-300"
                                    />
                                    <span className="text-xs font-bold text-slate-700 flex items-center gap-1">
                                      <Wrench className="w-3.5 h-3.5 text-amber-600" />
                                      <span>Necessita Reparo ou Manutenção</span>
                                    </span>
                                  </label>

                                  {item.requires_repair && (
                                    <div className="mt-2 animate-in fade-in duration-150">
                                      <input
                                        type="text"
                                        disabled={isCompleted}
                                        placeholder="Descreva o reparo necessário (Ex: Trocar interruptor, reparar rachadura)..."
                                        value={item.repair_notes || ''}
                                        onChange={(e) => handleItemFieldChange(room.id, item.id, { repair_notes: e.target.value })}
                                        className="w-full px-3 py-2 bg-amber-50/50 border border-amber-200 rounded-xl text-xs focus:ring-2 focus:ring-amber-500 font-medium text-slate-800"
                                      />
                                    </div>
                                  )}
                                </div>

                                {/* Description Area com Botão de Voz e IA */}
                                <div className="space-y-1.5">
                                  <div className="flex items-center justify-between">
                                    <label className="block text-[10px] font-bold uppercase text-slate-400">
                                      Descrição Detalhada do Item
                                    </label>

                                    {!isCompleted && (
                                      <button
                                        type="button"
                                        onClick={() =>
                                          handleStartVoiceDescription(
                                            room.id,
                                            item.id,
                                            room.name,
                                            item.name,
                                            item.description || ''
                                          )
                                        }
                                        className="flex items-center gap-1.5 px-3 py-1 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-xl text-xs font-bold transition-all border border-blue-200 shadow-xs active:scale-95"
                                        title="Ditar fala e formatar com IA"
                                      >
                                        <Mic className="w-3.5 h-3.5 text-blue-600" />
                                        <span>Descrever por voz</span>
                                        <Sparkles className="w-3 h-3 text-amber-500" />
                                      </button>
                                    )}
                                  </div>

                                  <textarea
                                    disabled={isCompleted}
                                    rows={2}
                                    placeholder="Ex: Parede com pintura branca lisa, sem marcas ou avarias aparentes..."
                                    value={item.description || ''}
                                    onChange={(e) => handleItemFieldChange(room.id, item.id, { description: e.target.value })}
                                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-blue-600 resize-none font-normal text-slate-800 disabled:bg-slate-100 leading-relaxed"
                                  />
                                </div>

                                {/* Fotos do Item */}
                                <div className="pt-2 border-t border-slate-100 space-y-3">
                                  <label className="block text-[10px] font-bold uppercase text-slate-400">
                                    Fotos e Evidências do Item
                                  </label>

                                  {!isCompleted && (
                                    <MediaUploader
                                      companyId={companyId}
                                      inspectionId={inspectionId}
                                      roomId={room.id}
                                      itemId={item.id}
                                      disabled={isCompleted}
                                      onUploadSuccess={loadMedia}
                                    />
                                  )}

                                  <MediaGallery
                                    mediaList={itemPhotos}
                                    onDeleteMedia={handleDeleteMedia}
                                    onRefresh={loadMedia}
                                    readOnly={isCompleted}
                                  />
                                </div>

                              </div>
                            );
                          })}
                        </div>
                      )}

                      {/* Quick Item Addition Bar */}
                      {!isCompleted && (
                        <div className="pt-2 space-y-2">
                          <span className="text-[11px] font-bold text-slate-500 block">
                            Adicionar itens a este ambiente:
                          </span>
                          
                          <div className="flex flex-wrap gap-1.5 items-center">
                            {suggestions.map((sug) => (
                              <button
                                key={sug}
                                onClick={() => handleAddItem(room.id, sug)}
                                className="px-3 py-1.5 rounded-xl bg-white hover:bg-blue-50 border border-slate-200 hover:border-blue-300 text-slate-700 hover:text-blue-700 text-xs font-bold transition-all active:scale-95 shadow-sm"
                              >
                                + {sug}
                              </button>
                            ))}

                            <button
                              onClick={() => {
                                setActiveRoomForItem(room.id);
                                setCustomItemName('');
                              }}
                              className="px-3 py-1.5 rounded-xl bg-blue-600 text-white text-xs font-bold hover:bg-blue-700 transition-all shadow-sm"
                            >
                              + Item Personalizado
                            </button>
                          </div>

                          {/* Modal/Input para Item Customizado */}
                          {activeRoomForItem === room.id && (
                            <div className="p-3 bg-white rounded-2xl border border-blue-200 shadow-md space-y-2 animate-in fade-in duration-150">
                              <label className="block text-[11px] font-bold uppercase text-blue-700">
                                Nome do Item Personalizado
                              </label>
                              <div className="flex gap-2">
                                <input
                                  type="text"
                                  placeholder="Ex: Ar Condicionado Split, Cortina, Interfone..."
                                  value={customItemName}
                                  onChange={(e) => setCustomItemName(e.target.value)}
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter') {
                                      e.preventDefault();
                                      handleAddItem(room.id, customItemName);
                                    }
                                  }}
                                  className="flex-1 px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-blue-600"
                                />
                                <button
                                  onClick={() => handleAddItem(room.id, customItemName)}
                                  className="px-4 py-2 bg-blue-600 text-white rounded-xl text-xs font-bold hover:bg-blue-700 transition-all"
                                >
                                  Adicionar
                                </button>
                                <button
                                  onClick={() => setActiveRoomForItem(null)}
                                  className="px-3 py-2 bg-slate-100 text-slate-600 rounded-xl text-xs font-bold hover:bg-slate-200 transition-all"
                                >
                                  Cancelar
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      )}

                    </div>
                  )}

                </div>
              );
            })}
          </div>
        )}

      </main>

      {/* Modal: Gravação de Áudio */}
      {isAudioModalOpen && audioTarget && (
        <AudioRecorderModal
          isOpen={isAudioModalOpen}
          roomName={audioTarget.roomName}
          itemName={audioTarget.itemName}
          onClose={() => {
            setIsAudioModalOpen(false);
            setAudioTarget(null);
          }}
          onRecordingComplete={handleAudioRecordingComplete}
        />
      )}

      {/* Modal: Revisão e Aceite de Transcrição IA */}
      {isReviewModalOpen && activeTranscription && audioTarget && (
        <TranscriptionReviewModal
          isOpen={isReviewModalOpen}
          transcription={activeTranscription}
          existingDescription={audioTarget.currentDescription}
          roomName={audioTarget.roomName}
          itemName={audioTarget.itemName}
          onClose={() => {
            setIsReviewModalOpen(false);
            setActiveTranscription(null);
            setAudioTarget(null);
          }}
          onApplied={handleTranscriptionApplied}
          onReprocess={handleReprocessTranscription}
        />
      )}

      {/* Overlay de Processamento de IA */}
      {isProcessingAI && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-white rounded-3xl p-6 shadow-2xl border border-slate-100 flex items-center gap-3 text-slate-800 animate-in zoom-in-95">
            <Loader2 className="w-5 h-5 text-blue-600 animate-spin" />
            <span className="text-xs sm:text-sm font-bold">
              Estruturando descrição pericial com IA...
            </span>
            <Sparkles className="w-4 h-4 text-amber-500" />
          </div>
        </div>
      )}

      {/* Modal: Adicionar Ambiente */}
      {isAddRoomModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 sm:p-8 shadow-2xl border border-slate-200 space-y-6 animate-in fade-in zoom-in-95 duration-200">
            <div>
              <h3 className="text-base font-black text-slate-900">Adicionar Ambiente</h3>
              <p className="text-xs text-slate-500 mt-0.5">Selecione um modelo comum ou digite o nome do cômodo</p>
            </div>

            <div className="space-y-3">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">Sugestões Rápidas</span>
              <div className="grid grid-cols-2 gap-2">
                {COMMON_ROOM_TEMPLATES.map((tmpl) => (
                  <button
                    key={tmpl}
                    onClick={() => handleAddRoom(tmpl)}
                    className="p-2.5 rounded-xl border border-slate-200 hover:border-blue-300 bg-slate-50 hover:bg-blue-50 text-slate-700 hover:text-blue-700 text-xs font-bold text-left transition-all active:scale-95 truncate"
                  >
                    + {tmpl}
                  </button>
                ))}
              </div>
            </div>

            <div className="pt-2 border-t border-slate-100 space-y-2">
              <label className="block text-[11px] font-bold uppercase text-slate-600">Ou Nome Personalizado</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="Ex: Área Gourmet, Closet, Adega..."
                  value={customRoomName}
                  onChange={(e) => setCustomRoomName(e.target.value)}
                  className="flex-1 px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-blue-600"
                />
                <button
                  onClick={() => handleAddRoom(customRoomName)}
                  disabled={!customRoomName.trim() || isActionLoading}
                  className="px-4 py-2 bg-blue-600 text-white rounded-xl text-xs font-bold hover:bg-blue-700 transition-all disabled:opacity-50"
                >
                  Criar
                </button>
              </div>
            </div>

            <button
              onClick={() => setIsAddRoomModalOpen(false)}
              className="w-full py-2.5 rounded-xl border border-slate-200 text-slate-600 font-bold text-xs hover:bg-slate-50 transition-colors"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}

      {/* Modal: Confirmação de Finalização */}
      {isFinalizeModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 sm:p-8 shadow-2xl border border-slate-200 space-y-5 text-center animate-in fade-in zoom-in-95 duration-200">
            <div className="w-12 h-12 rounded-2xl bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto">
              <CheckCircle2 className="w-6 h-6" />
            </div>

            <div>
              <h3 className="text-lg font-black text-slate-900">Finalizar Vistoria?</h3>
              <p className="text-xs text-slate-500 mt-1 max-w-xs mx-auto">
                Após finalizar, a vistoria será travada como <strong>Concluída (COMPLETED)</strong>. O vistoriador não poderá mais editar ambientes, fotos ou descrições sem que um Gerente a reabra.
              </p>
            </div>

            <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200 text-xs font-bold text-slate-700">
              Total: {totalRooms} ambiente(s), {totalItems} item(ns) e {totalPhotos} foto(s)
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setIsFinalizeModalOpen(false)}
                className="w-1/2 py-2.5 rounded-xl border border-slate-200 text-slate-600 font-bold text-xs hover:bg-slate-50 transition-colors"
              >
                Voltar ao Editor
              </button>
              <button
                onClick={handleFinalize}
                disabled={isActionLoading}
                className="w-1/2 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-lg shadow-emerald-600/20 transition-all"
              >
                {isActionLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Confirmar e Travar'}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
