// ==============================================================================
// VISTORIA YZZY — COMPONENT: InspectionEditorView (Execução de Vistoria em Campo)
// DESIGN SYSTEM: SOFT FUTURISTIC / CALM TECHNOLOGY • MOBILE-FIRST (390px Baseline)
// AMBIENTES + ITENS + FOTOS + ÁUDIO + IA GEMINI + OFFLINE + REVISÃO + FINALIZAÇÃO
// ==============================================================================

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { 
  ArrowLeft, 
  Building, 
  CheckCircle2, 
  Plus, 
  ChevronDown, 
  ChevronUp, 
  ChevronRight,
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
  CheckCircle,
  CloudOff,
  Cloud,
  FileCheck2,
  FolderOpen,
  Search,
  X,
  Layers,
  CheckCheck
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
import { networkState, type NetworkStatus } from '../../services/networkState';
import type { 
  Inspection, 
  InspectionRoom, 
  InspectionItem, 
  ItemCondition 
} from '../../types/inspection';
import type { InspectionMedia } from '../../types/media';
import type { InspectionTranscription } from '../../types/audio';
import { 
  COMMON_ROOM_TEMPLATES, 
  COMMON_ITEM_SUGGESTIONS 
} from '../../types/inspection';
import { useAuth } from '../../contexts/AuthContext';
import { MediaUploader } from '../media/MediaUploader';
import { MediaGallery } from '../media/MediaGallery';
import { AudioRecorderModal } from '../audio/AudioRecorderModal';
import { TranscriptionReviewModal } from '../audio/TranscriptionReviewModal';
import { InspectionDocumentsPanel } from '../documents/InspectionDocumentsPanel';

// Configuração visual dos estados de conservação com ÍCONE + TEXTO + CORES
const CONDITION_BUTTONS: { 
  value: ItemCondition; 
  label: string; 
  iconText: string; 
  activeBg: string; 
  activeBorder: string; 
  activeText: string;
  badgeBg: string;
  badgeText: string;
  badgeBorder: string;
}[] = [
  { 
    value: 'NEW', 
    label: 'Novo', 
    iconText: 'Novo', 
    activeBg: 'bg-emerald-600', 
    activeBorder: 'border-emerald-600 ring-4 ring-emerald-100', 
    activeText: 'text-white',
    badgeBg: 'bg-emerald-50',
    badgeText: 'text-emerald-700',
    badgeBorder: 'border-emerald-200'
  },
  { 
    value: 'GOOD', 
    label: 'Bom', 
    iconText: 'Bom', 
    activeBg: 'bg-primary-600', 
    activeBorder: 'border-primary-600 ring-4 ring-primary-100', 
    activeText: 'text-white',
    badgeBg: 'bg-primary-50',
    badgeText: 'text-primary-700',
    badgeBorder: 'border-primary-200'
  },
  { 
    value: 'REGULAR', 
    label: 'Regular', 
    iconText: 'Reg.', 
    activeBg: 'bg-amber-500', 
    activeBorder: 'border-amber-500 ring-4 ring-amber-100', 
    activeText: 'text-white',
    badgeBg: 'bg-amber-50',
    badgeText: 'text-amber-700',
    badgeBorder: 'border-amber-200'
  },
  { 
    value: 'BAD', 
    label: 'Ruim', 
    iconText: 'Ruim', 
    activeBg: 'bg-orange-500', 
    activeBorder: 'border-orange-500 ring-4 ring-orange-100', 
    activeText: 'text-white',
    badgeBg: 'bg-orange-50',
    badgeText: 'text-orange-700',
    badgeBorder: 'border-orange-200'
  },
  { 
    value: 'DAMAGED', 
    label: 'Danificado', 
    iconText: 'Danif.', 
    activeBg: 'bg-rose-600', 
    activeBorder: 'border-rose-600 ring-4 ring-rose-100', 
    activeText: 'text-white',
    badgeBg: 'bg-rose-50',
    badgeText: 'text-rose-700',
    badgeBorder: 'border-rose-200'
  },
  { 
    value: 'NOT_APPLICABLE', 
    label: 'N/A', 
    iconText: 'N/A', 
    activeBg: 'bg-slate-600', 
    activeBorder: 'border-slate-600 ring-4 ring-slate-100', 
    activeText: 'text-white',
    badgeBg: 'bg-slate-100',
    badgeText: 'text-slate-600',
    badgeBorder: 'border-slate-200'
  }
];

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

  // Navegação de Ambientes e Itens
  const [activeRoomId, setActiveRoomId] = useState<string | null>(null);
  const [expandedItems, setExpandedItems] = useState<Record<string, boolean>>({});
  const [isRoomsDrawerOpen, setIsRoomsDrawerOpen] = useState(false);
  const [roomSearchQuery, setRoomSearchQuery] = useState('');
  const [showRoomGeneralNotes, setShowRoomGeneralNotes] = useState(false);
  const [showRoomPhotosSection, setShowRoomPhotosSection] = useState(true);
  const [showGeneralPhotosSection, setShowGeneralPhotosSection] = useState(false);

  // Modals de Operação
  const [isAddRoomModalOpen, setIsAddRoomModalOpen] = useState(false);
  const [customRoomName, setCustomRoomName] = useState('');
  const [isReviewModalOpen, setIsReviewModalOpen] = useState(false);
  const [isFinalizeModalOpen, setIsFinalizeModalOpen] = useState(false);
  const [isActionLoading, setIsActionLoading] = useState(false);
  const [globalError, setGlobalError] = useState<string | null>(null);

  // Status de Conectividade e Offline
  const [netStatus, setNetStatus] = useState<NetworkStatus>(networkState.getStatus());
  const [isOfflineAvailable, setIsOfflineAvailable] = useState(false);
  const [isDownloadingOffline, setIsDownloadingOffline] = useState(false);
  const [offlineProgress, setOfflineProgress] = useState<{ step: string; percent: number } | null>(null);
  const [justReturnedOnline, setJustReturnedOnline] = useState(false);

  // Áudio e IA Gemini
  const [audioTarget, setAudioTarget] = useState<{
    roomId: string;
    itemId: string;
    roomName: string;
    itemName: string;
    currentDescription: string;
  } | null>(null);
  const [isAudioModalOpen, setIsAudioModalOpen] = useState(false);
  const [activeTranscription, setActiveTranscription] = useState<InspectionTranscription | null>(null);
  const [isAIRefineModalOpen, setIsAIRefineModalOpen] = useState(false);
  const [isProcessingAI, setIsProcessingAI] = useState(false);

  // Item rápido adicionado por cômodo
  const [activeRoomForItem, setActiveRoomForItem] = useState<string | null>(null);
  const [customItemName, setCustomItemName] = useState('');

  // Autosave status per item: itemId -> 'saving' | 'saved' | 'error' | 'conflict'
  const [saveStatus, setSaveStatus] = useState<Record<string, 'saving' | 'saved' | 'error' | 'conflict'>>({});
  const debounceTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const roomScrollRef = useRef<HTMLDivElement>(null);

  const isCompleted = inspection?.status === 'COMPLETED';

  // Monitorar estado de rede em tempo real
  useEffect(() => {
    const unsub = networkState.subscribe((status) => {
      setNetStatus((prev) => {
        if (prev === 'OFFLINE' && status === 'ONLINE') {
          setJustReturnedOnline(true);
          setTimeout(() => setJustReturnedOnline(false), 4000);
        }
        return status;
      });
    });
    return unsub;
  }, []);

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
        signed_url: m.blob ? URL.createObjectURL(m.blob) : '',
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
          photos: [],
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
              photos: [],
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
            active: true,
            internal_code: null,
            postal_code: null,
            notes: null,
            created_at: '',
            updated_at: ''
          } as any) : undefined
        } as any);

        setRooms(roomsWithItems as any);
        if (roomsWithItems.length > 0 && !activeRoomId) {
          setActiveRoomId(roomsWithItems[0].id);
        }
        await loadMedia();
        return;
      }

      // Se ONLINE, carregar do Supabase
      const data = await getInspectionWithDetails(inspectionId);
      setInspection(data.inspection);
      setRooms(data.rooms as any);
      
      if (data.rooms.length > 0 && !activeRoomId) {
        setActiveRoomId(data.rooms[0].id);
      }

      await loadMedia();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erro ao carregar vistoria.';
      setGlobalError(msg);
    } finally {
      setIsLoading(false);
    }
  }, [inspectionId, loadMedia, checkOfflineStatus, activeRoomId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Se o activeRoomId atual não existir nas salas, aponta para a primeira
  useEffect(() => {
    if (rooms.length > 0) {
      const exists = rooms.some((r) => r.id === activeRoomId);
      if (!exists) {
        setActiveRoomId(rooms[0].id);
      }
    }
  }, [rooms, activeRoomId]);

  const activeRoom = rooms.find((r) => r.id === activeRoomId) || rooms[0] || null;

  // Toggle do item expandido
  const toggleItemExpand = (itemId: string) => {
    setExpandedItems((prev) => ({
      ...prev,
      [itemId]: !prev[itemId]
    }));
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
      alert('Vistoria removida do armazenamento local deste dispositivo.');
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
        alert('Vistoria salva neste aparelho! Você pode inspecionar todos os cômodos mesmo sem conexão com a internet.');
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
        const newRoom = { ...created, items: [], photos: [] } as any;
        setRooms((prev) => [...prev, newRoom]);
        setActiveRoomId(created.id);
        setIsAddRoomModalOpen(false);
        setCustomRoomName('');
        return;
      }

      const created = await addRoom({
        inspection_id: inspectionId,
        name: name.trim(),
        position: newPosition,
      });

      const newRoom = { ...created, items: [], photos: [] } as any;
      setRooms((prev) => [...prev, newRoom]);
      setActiveRoomId(created.id);
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
    const roomToDelete = rooms.find((r) => r.id === roomId);
    if (!confirm(`Deseja realmente excluir o ambiente "${roomToDelete?.name || 'Ambiente'}" e todos os seus itens e fotos?`)) return;

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
        const newItem = { ...created, photos: [] } as any;
        setRooms((prev) =>
          prev.map((r) => (r.id === roomId ? { ...r, items: [...r.items, newItem] } : r))
        );
        setExpandedItems((prev) => ({ ...prev, [created.id]: true }));
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

      const newItem = { ...created, photos: [] } as any;
      setRooms((prev) =>
        prev.map((r) => (r.id === roomId ? { ...r, items: [...r.items, newItem] } : r))
      );
      setExpandedItems((prev) => ({ ...prev, [created.id]: true }));
      setActiveRoomForItem(null);
      setCustomItemName('');
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Erro ao adicionar item.');
    }
  };

  const handleDeleteItem = async (roomId: string, itemId: string) => {
    if (isCompleted) return;
    if (!confirm('Deseja realmente excluir este item e suas evidências?')) return;

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

  // Ação "Próximo Item" dentro do ambiente ativo
  const handleNextItem = (currentRoomId: string, currentItemId: string) => {
    const room = rooms.find((r) => r.id === currentRoomId);
    if (!room) return;
    const currentIndex = room.items.findIndex((i) => i.id === currentItemId);
    if (currentIndex !== -1 && currentIndex < room.items.length - 1) {
      const nextItem = room.items[currentIndex + 1];
      setExpandedItems({ [nextItem.id]: true });
      const nextEl = document.getElementById(`item-${nextItem.id}`);
      if (nextEl) {
        nextEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    } else {
      // Se era o último item do cômodo, foca no próximo cômodo se houver
      const currentRoomIndex = rooms.findIndex((r) => r.id === currentRoomId);
      if (currentRoomIndex !== -1 && currentRoomIndex < rooms.length - 1) {
        const nextRoom = rooms[currentRoomIndex + 1];
        setActiveRoomId(nextRoom.id);
        if (nextRoom.items.length > 0) {
          setExpandedItems({ [nextRoom.items[0].id]: true });
        }
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }
    }
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
      alert('O assistente de IA Gemini requer conexão com a internet. Você pode digitar sua observação diretamente no campo de texto.');
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
      setIsAIRefineModalOpen(true);
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Erro ao processar áudio com IA.');
    } finally {
      setIsProcessingAI(false);
    }
  };

  const handleTranscriptionApplied = (appliedDescription: string) => {
    if (!audioTarget) return;
    handleItemFieldChange(audioTarget.roomId, audioTarget.itemId, { description: appliedDescription });
    setIsAIRefineModalOpen(false);
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
      alert('Esta ação exige conexão com a internet para consolidação pericial. A vistoria não pode ser finalizada offline.');
      return;
    }

    setIsActionLoading(true);
    try {
      await finalizeInspection(inspectionId);
      await loadData();
      setIsFinalizeModalOpen(false);
      setIsReviewModalOpen(false);
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

    if (!confirm('Deseja reabrir esta vistoria para edição pericial?')) return;
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
  // Métricas e Cálculos Reais de Progresso
  // --------------------------------------------------------------------------
  const totalRooms = rooms.length;
  const totalItems = rooms.reduce((acc, r) => acc + r.items.length, 0);
  const totalPhotos = allMedia.length;
  const companyId = inspection?.company_id || authCompanyId || '';

  const evaluatedItemsCount = rooms.reduce(
    (acc, r) =>
      acc +
      r.items.filter(
        (i) =>
          (i.condition_status && i.condition_status !== 'NOT_APPLICABLE') ||
          (i.description && i.description.trim().length > 0) ||
          i.requires_repair
      ).length,
    0
  );

  const completionPercent = totalItems > 0 ? Math.round((evaluatedItemsCount / totalItems) * 100) : 0;
  const repairItemsCount = rooms.reduce((acc, r) => acc + r.items.filter((i) => i.requires_repair).length, 0);

  // Itens pendentes para o modal de revisão
  const pendingItemsList: { room: InspectionRoom; item: InspectionItem }[] = [];
  rooms.forEach((r) => {
    r.items.forEach((i) => {
      const isEvaluated =
        (i.condition_status && i.condition_status !== 'NOT_APPLICABLE') ||
        (i.description && i.description.trim().length > 0) ||
        i.requires_repair;
      if (!isEvaluated) {
        pendingItemsList.push({ room: r, item: i });
      }
    });
  });

  // --------------------------------------------------------------------------
  // Render de Loading & Erros Globais
  // --------------------------------------------------------------------------
  if (isLoading) {
    return (
      <div className="min-h-screen bg-yzzy-canvas flex flex-col items-center justify-center p-6 text-center">
        <div className="w-14 h-14 rounded-2xl bg-primary-50 text-primary-600 flex items-center justify-center mb-4 shadow-sm animate-pulse">
          <Loader2 className="w-7 h-7 animate-spin" />
        </div>
        <h2 className="text-base font-bold text-slate-900">Carregando ambiente de vistoria...</h2>
        <p className="text-xs text-slate-500 mt-1 max-w-xs">Recuperando cômodos, itens cadastrados e galeria de evidências.</p>
      </div>
    );
  }

  if (globalError || !inspection) {
    return (
      <div className="min-h-screen bg-yzzy-canvas flex flex-col items-center justify-center p-4">
        <div className="bg-white p-6 sm:p-8 rounded-3xl border border-slate-200 shadow-xl max-w-md w-full text-center space-y-4">
          <div className="w-12 h-12 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center mx-auto">
            <AlertCircle className="w-6 h-6" />
          </div>
          <h2 className="text-lg font-bold text-slate-900">Erro ao Acessar Vistoria</h2>
          <p className="text-xs text-slate-600">{globalError || 'Vistoria não encontrada ou sem permissão de acesso.'}</p>
          <button
            onClick={onBack}
            className="w-full min-h-[48px] rounded-xl bg-slate-900 text-white font-bold text-xs hover:bg-slate-800 transition-colors flex items-center justify-center"
          >
            Voltar para Lista
          </button>
        </div>
      </div>
    );
  }

  // Sugestões de itens para o ambiente ativo
  const activeRoomSuggestionsKey = activeRoom?.name.toLowerCase().includes('coz')
    ? 'cozinha'
    : activeRoom?.name.toLowerCase().includes('banh') || activeRoom?.name.toLowerCase().includes('lavab')
    ? 'banheiro'
    : 'default';
  const activeRoomSuggestions = COMMON_ITEM_SUGGESTIONS[activeRoomSuggestionsKey] || COMMON_ITEM_SUGGESTIONS.default;

  return (
    <div className="min-h-screen bg-yzzy-canvas text-yzzy-text-primary pb-32 font-sans selection:bg-primary-600 selection:text-white">
      
      {/* ========================================================================= */}
      {/* 1. TOPBAR COMPACTA & MODO VISTORIA                                        */}
      {/* ========================================================================= */}
      <header className="sticky top-0 z-30 bg-white/95 backdrop-blur-md border-b border-slate-200 shadow-xs">
        <div className="max-w-6xl mx-auto px-3 sm:px-6 py-2.5 flex items-center justify-between gap-2 sm:gap-4">
          
          {/* Lado Esquerdo: Voltar + Identificação do Imóvel */}
          <div className="flex items-center gap-2 sm:gap-3 min-w-0">
            <button
              onClick={onBack}
              className="min-w-[44px] min-h-[44px] p-2.5 rounded-xl text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-colors flex items-center justify-center shrink-0"
              title="Voltar às Vistorias"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>

            <div className="min-w-0">
              <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
                <h1 className="text-xs sm:text-sm font-black text-slate-900 truncate max-w-[170px] sm:max-w-sm">
                  {inspection.property?.street ? `${inspection.property.street}${inspection.property.number ? `, ${inspection.property.number}` : ''}` : inspection.title}
                </h1>
                
                {/* Badge de Tipo */}
                <span className="px-2 py-0.5 rounded-md text-[10px] font-bold uppercase bg-slate-100 text-slate-700 border border-slate-200 shrink-0">
                  {inspection.inspection_type === 'CHECK_IN' ? 'Entrada' : inspection.inspection_type === 'CHECK_OUT' ? 'Saída' : inspection.inspection_type}
                </span>

                {/* Badge de Status */}
                <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold uppercase shrink-0 ${
                  isCompleted ? 'bg-emerald-100 text-emerald-800' : 'bg-primary-100 text-primary-800'
                }`}>
                  {isCompleted ? 'Concluída' : 'Em Campo'}
                </span>
              </div>

              {/* Status de Sincronização / Salvamento em Tempo Real */}
              <div className="flex items-center gap-2 text-[10px] font-medium text-slate-500 mt-0.5">
                {netStatus === 'OFFLINE' ? (
                  <span className="flex items-center gap-1 text-amber-700 font-bold bg-amber-50 px-1.5 py-0.2 rounded border border-amber-200">
                    <CloudOff className="w-3 h-3" /> Offline (Salvo no aparelho)
                  </span>
                ) : (
                  <span className="flex items-center gap-1 text-emerald-700 font-semibold">
                    <Cloud className="w-3 h-3 text-emerald-500" /> Sincronizado
                  </span>
                )}
                <span className="text-slate-300 hidden sm:inline">•</span>
                <span className="hidden sm:inline">{totalRooms} cômodos • {totalItems} itens</span>
              </div>
            </div>
          </div>

          {/* Lado Direito: Ações de Topo (Offline + Finalizar/Reabrir) */}
          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
            {/* Botão de Disponibilização Offline */}
            <button
              onClick={handleToggleOffline}
              disabled={isDownloadingOffline}
              className={`min-h-[44px] px-2.5 sm:px-3 py-2 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all border ${
                isOfflineAvailable
                  ? 'bg-emerald-50 text-emerald-700 border-emerald-300 hover:bg-emerald-100'
                  : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
              }`}
              title={isOfflineAvailable ? 'Vistoria armazenada no dispositivo para uso sem internet' : 'Baixar vistoria para uso offline em campo'}
            >
              {isDownloadingOffline ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-primary-600" />
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
                  <DownloadCloud className="w-3.5 h-3.5 text-slate-500" />
                  <span className="hidden sm:inline">Disponibilizar Offline</span>
                  <span className="sm:hidden">Baixar</span>
                </>
              )}
            </button>

            {/* Ação de Conclusão / Revisão */}
            {isCompleted ? (
              isCompanyManager && (
                <button
                  onClick={handleReopen}
                  disabled={isActionLoading}
                  className="min-h-[44px] px-3 sm:px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow-sm transition-all active:scale-95"
                  title="Reabrir Vistoria (Gerente)"
                >
                  <RotateCcw className="w-4 h-4" />
                  <span className="hidden sm:inline">Reabrir Vistoria</span>
                  <span className="sm:hidden">Reabrir</span>
                </button>
              )
            ) : (
              <button
                onClick={() => setIsReviewModalOpen(true)}
                className="min-h-[44px] px-3 sm:px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow-md shadow-emerald-600/20 transition-all active:scale-95"
              >
                <FileCheck2 className="w-4 h-4" />
                <span className="hidden sm:inline">Revisar & Finalizar</span>
                <span className="sm:hidden">Revisar</span>
              </button>
            )}
          </div>
        </div>

        {/* Barra de Progresso Fina */}
        <div className="w-full bg-slate-100 h-1 relative overflow-hidden">
          <div 
            className="bg-gradient-to-r from-primary-600 to-emerald-500 h-1 transition-all duration-500 ease-out"
            style={{ width: `${completionPercent}%` }}
          />
        </div>
      </header>

      {/* ========================================================================= */}
      {/* 2. ALERTA CALMO DE MODO OFFLINE / RETORNO                                 */}
      {/* ========================================================================= */}
      {netStatus === 'OFFLINE' && (
        <div className="bg-amber-500 text-slate-950 px-4 py-2 text-xs font-semibold flex items-center justify-center gap-2 border-b border-amber-600 select-none animate-in fade-in">
          <CloudOff className="w-4 h-4 shrink-0" />
          <span>Você está operando offline. Todas as fotos e notas estão sendo salvas no dispositivo.</span>
        </div>
      )}

      {justReturnedOnline && (
        <div className="bg-emerald-600 text-white px-4 py-2 text-xs font-semibold flex items-center justify-center gap-2 border-b border-emerald-700 select-none animate-in fade-in">
          <CheckCheck className="w-4 h-4 shrink-0" />
          <span>Conexão restabelecida! Todas as alterações foram sincronizadas com sucesso.</span>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 3. CONTEÚDO PRINCIPAL                                                     */}
      {/* ========================================================================= */}
      <main className="max-w-6xl mx-auto px-3 sm:px-6 py-4 space-y-4">
        
        {/* Banner de Progresso Geral da Vistoria */}
        <div className="bg-white rounded-3xl p-4 sm:p-5 border border-slate-200 shadow-xs flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-primary-50 text-primary-600 flex items-center justify-center font-bold text-sm shrink-0">
              <Building className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-slate-900">Progresso da Vistoria</span>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-primary-50 text-primary-700 border border-primary-100">
                  {completionPercent}% Concluído
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                {evaluatedItemsCount} de {totalItems} itens avaliados • {totalPhotos} fotos registradas
                {repairItemsCount > 0 && ` • ${repairItemsCount} com reparo pendente`}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
            <button
              onClick={() => setShowGeneralPhotosSection(!showGeneralPhotosSection)}
              className={`min-h-[40px] px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all border ${
                showGeneralPhotosSection 
                  ? 'bg-primary-50 text-primary-700 border-primary-200' 
                  : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
              }`}
            >
              <Camera className="w-3.5 h-3.5" />
              <span>Fotos Gerais ({getInspectionPhotos().length})</span>
            </button>

            {!isCompleted && (
              <button
                onClick={() => setIsAddRoomModalOpen(true)}
                className="min-h-[40px] px-3.5 py-1.5 rounded-xl bg-primary-600 hover:bg-primary-700 text-white font-bold text-xs flex items-center gap-1.5 shadow-sm active:scale-95 transition-all"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>+ Novo Cômodo</span>
              </button>
            )}
          </div>
        </div>

        {/* Fotos Gerais da Vistoria (Fachada, Medidores, etc.) - Colapsável */}
        {showGeneralPhotosSection && (
          <div className="bg-white rounded-3xl p-4 sm:p-6 border border-primary-200 shadow-sm space-y-4 animate-in fade-in">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-primary-50 text-primary-600 flex items-center justify-center">
                  <Camera className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">Fotos Gerais e Fachada</h3>
                  <p className="text-xs text-slate-500">Fachada externa, número, hidrômetro, medidor de luz e gás.</p>
                </div>
              </div>
              <span className="text-xs font-bold px-2.5 py-1 bg-slate-100 text-slate-700 rounded-lg">
                {getInspectionPhotos().length} fotos
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
        )}

        {/* Documentos / Laudos Gerados */}
        <InspectionDocumentsPanel
          inspectionId={inspectionId}
          isCompleted={isCompleted}
          canGenerate={!isCompleted ? false : true}
        />

        {/* ======================================================================= */}
        {/* 4. NAVEGADOR DE AMBIENTES (CHIPS HORIZONTAIS MOBILE-FIRST)             */}
        {/* ======================================================================= */}
        <div className="space-y-2">
          <div className="flex items-center justify-between px-1">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
              <Layers className="w-3.5 h-3.5 text-primary-600" />
              <span>Ambientes ({rooms.length})</span>
            </span>
            
            {rooms.length > 3 && (
              <button
                onClick={() => setIsRoomsDrawerOpen(true)}
                className="text-xs font-bold text-primary-600 hover:text-primary-700 flex items-center gap-1 min-h-[36px] px-2"
              >
                <span>Ver todos os cômodos</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {rooms.length === 0 ? (
            <div className="bg-white p-8 rounded-3xl border border-slate-200 text-center space-y-3 shadow-xs">
              <Building className="w-10 h-10 mx-auto text-slate-300" />
              <h3 className="text-sm font-bold text-slate-800">Nenhum cômodo adicionado ainda</h3>
              <p className="text-xs text-slate-500 max-w-sm mx-auto">
                Adicione a Sala, Cozinha, Quartos ou qualquer ambiente para iniciar a vistoria.
              </p>
              {!isCompleted && (
                <button
                  onClick={() => setIsAddRoomModalOpen(true)}
                  className="min-h-[48px] px-5 py-3 rounded-2xl bg-primary-600 hover:bg-primary-700 text-white font-bold text-xs inline-flex items-center gap-2 shadow-md shadow-primary-600/20 transition-all active:scale-95"
                >
                  <Plus className="w-4 h-4" />
                  <span>Adicionar Primeiro Ambiente</span>
                </button>
              )}
            </div>
          ) : (
            <div 
              ref={roomScrollRef}
              className="flex items-center gap-2 overflow-x-auto pb-2 pt-1 no-scrollbar scroll-smooth"
              style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
            >
              {rooms.map((room, idx) => {
                const isActive = room.id === activeRoomId;
                const roomPhotosCount = getRoomPhotos(room.id).length;
                const roomItemsPhotosCount = room.items.reduce((acc, it) => acc + getItemPhotos(it.id).length, 0);
                const hasRepairs = room.items.some((i) => i.requires_repair);

                return (
                  <button
                    key={room.id}
                    onClick={() => setActiveRoomId(room.id)}
                    className={`min-h-[48px] shrink-0 flex items-center gap-2.5 px-4 py-2.5 rounded-2xl border text-xs font-bold transition-all select-none ${
                      isActive
                        ? 'bg-primary-600 text-white border-primary-600 shadow-md shadow-primary-600/25 ring-2 ring-primary-400/30'
                        : 'bg-white text-slate-700 border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                    }`}
                  >
                    <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold ${
                      isActive ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-600'
                    }`}>
                      {idx + 1}
                    </span>

                    <span className="truncate max-w-[140px]">{room.name}</span>

                    {/* Badge de Itens / Fotos */}
                    <span className={`text-[10px] px-1.5 py-0.5 rounded-md font-semibold ${
                      isActive ? 'bg-black/20 text-white' : 'bg-slate-100 text-slate-600'
                    }`}>
                      {room.items.length} {room.items.length === 1 ? 'item' : 'itens'}
                      {(roomPhotosCount + roomItemsPhotosCount) > 0 && ` • ${roomPhotosCount + roomItemsPhotosCount} fotos`}
                    </span>

                    {hasRepairs && (
                      <span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse" title="Possui reparo necessário" />
                    )}
                  </button>
                );
              })}

              {!isCompleted && (
                <button
                  onClick={() => setIsAddRoomModalOpen(true)}
                  className="min-h-[48px] shrink-0 flex items-center gap-1.5 px-4 py-2.5 rounded-2xl border border-dashed border-slate-300 hover:border-primary-500 bg-white hover:bg-primary-50/50 text-slate-600 hover:text-primary-600 text-xs font-bold transition-all select-none"
                >
                  <Plus className="w-4 h-4" />
                  <span>Novo Cômodo</span>
                </button>
              )}
            </div>
          )}
        </div>

        {/* ======================================================================= */}
        {/* 5. AMBIENTE ATIVO & LISTA DE ITENS                                     */}
        {/* ======================================================================= */}
        {activeRoom && (
          <div className="space-y-4">
            {/* Header do Ambiente Ativo */}
            <div className="bg-white rounded-3xl p-4 sm:p-6 border border-slate-200 shadow-xs space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-primary-50 text-primary-600 flex items-center justify-center font-bold text-sm shrink-0">
                    <FolderOpen className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h2 className="text-base sm:text-lg font-black text-slate-900 tracking-tight">
                        {activeRoom.name}
                      </h2>
                      <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 text-xs font-bold">
                        {activeRoom.items.length} {activeRoom.items.length === 1 ? 'item' : 'itens'}
                      </span>
                    </div>
                    <p className="text-xs text-slate-500">
                      {getRoomPhotos(activeRoom.id).length} fotos gerais do cômodo
                    </p>
                  </div>
                </div>

                {/* Ações do Ambiente */}
                <div className="flex items-center gap-2 self-end sm:self-center">
                  <button
                    onClick={() => setShowRoomGeneralNotes(!showRoomGeneralNotes)}
                    className={`min-h-[40px] px-3 py-1.5 rounded-xl text-xs font-bold border transition-all flex items-center gap-1.5 ${
                      showRoomGeneralNotes || activeRoom.notes
                        ? 'bg-primary-50 text-primary-700 border-primary-200'
                        : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200'
                    }`}
                  >
                    <span>Obs. do Cômodo</span>
                  </button>

                  <button
                    onClick={() => setShowRoomPhotosSection(!showRoomPhotosSection)}
                    className={`min-h-[40px] px-3 py-1.5 rounded-xl text-xs font-bold border transition-all flex items-center gap-1.5 ${
                      showRoomPhotosSection
                        ? 'bg-primary-50 text-primary-700 border-primary-200'
                        : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200'
                    }`}
                  >
                    <Camera className="w-3.5 h-3.5" />
                    <span>Fotos ({getRoomPhotos(activeRoom.id).length})</span>
                  </button>

                  {!isCompleted && (
                    <button
                      onClick={() => handleDeleteRoom(activeRoom.id)}
                      className="min-w-[40px] min-h-[40px] p-2 rounded-xl text-slate-400 hover:text-rose-600 hover:bg-rose-50 border border-slate-200 transition-colors flex items-center justify-center"
                      title="Excluir este cômodo"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>

              {/* Observações Gerais do Cômodo (Opcional) */}
              {showRoomGeneralNotes && (
                <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200 space-y-1.5 animate-in fade-in">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                    Observações Gerais do Cômodo
                  </label>
                  <textarea
                    rows={2}
                    disabled={isCompleted}
                    placeholder="Ex: Cômodo recém-pintado, piso em porcelanato polido sem riscos..."
                    value={activeRoom.notes || ''}
                    onChange={(e) => {
                      const newNotes = e.target.value;
                      setRooms((prev) =>
                        prev.map((r) => (r.id === activeRoom.id ? { ...r, notes: newNotes } : r))
                      );
                    }}
                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-primary-600 resize-none text-slate-800"
                  />
                </div>
              )}

              {/* Fotos Gerais do Ambiente */}
              {showRoomPhotosSection && (
                <div className="p-3 sm:p-4 bg-slate-50/70 rounded-2xl border border-slate-200 space-y-3 animate-in fade-in">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                      <ImageIcon className="w-3.5 h-3.5 text-primary-600" />
                      <span>Fotos Panorâmicas do Cômodo ({getRoomPhotos(activeRoom.id).length})</span>
                    </span>
                  </div>

                  {!isCompleted && (
                    <MediaUploader
                      companyId={companyId}
                      inspectionId={inspectionId}
                      roomId={activeRoom.id}
                      itemId={null}
                      disabled={isCompleted}
                      onUploadSuccess={loadMedia}
                    />
                  )}

                  <MediaGallery
                    mediaList={getRoomPhotos(activeRoom.id)}
                    onDeleteMedia={handleDeleteMedia}
                    onRefresh={loadMedia}
                    readOnly={isCompleted}
                  />
                </div>
              )}

              {/* =================================================================== */}
              {/* ITENS DO AMBIENTE (CARDS COM MODO COLAPSADO E EXPANDIDO INLINE)     */}
              {/* =================================================================== */}
              <div className="space-y-3 pt-2">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs sm:text-sm font-black text-slate-900 uppercase tracking-wider">
                    Itens Inspecionados ({activeRoom.items.length})
                  </h3>
                  
                  {activeRoom.items.length > 0 && (
                    <span className="text-[11px] text-slate-400 font-medium">
                      Toque no item para expandir ou editar
                    </span>
                  )}
                </div>

                {activeRoom.items.length === 0 ? (
                  <div className="p-8 text-center bg-slate-50/50 rounded-2xl border border-dashed border-slate-200 text-xs text-slate-400 space-y-2">
                    <p>Nenhum item cadastrado neste ambiente.</p>
                    <p className="text-[11px]">Use os botões de sugestão rápida abaixo para adicionar itens comuns.</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {activeRoom.items.map((item, idx) => {
                      const isExpanded = !!expandedItems[item.id];
                      const itemPhotos = getItemPhotos(item.id);
                      const status = saveStatus[item.id];
                      const conditionConfig = CONDITION_BUTTONS.find((c) => c.value === item.condition_status) || CONDITION_BUTTONS[1];

                      return (
                        <div
                          key={item.id}
                          id={`item-${item.id}`}
                          className={`rounded-2xl border transition-all duration-200 overflow-hidden ${
                            isExpanded
                              ? 'bg-white border-primary-400 shadow-md ring-2 ring-primary-100'
                              : 'bg-white border-slate-200 shadow-xs hover:border-slate-300'
                          }`}
                        >
                          {/* ------------------------------------------------------------- */}
                          {/* ITEM HEADER (SEMPRE VISÍVEL - TOUCH TARGET AMPLO)             */}
                          {/* ------------------------------------------------------------- */}
                          <div
                            onClick={() => toggleItemExpand(item.id)}
                            className="p-3.5 sm:p-4 flex items-center justify-between gap-3 cursor-pointer select-none hover:bg-slate-50/50 transition-colors"
                          >
                            <div className="flex items-center gap-3 min-w-0">
                              <span className="w-6 h-6 rounded-lg bg-slate-100 text-slate-700 font-bold text-xs flex items-center justify-center shrink-0">
                                {idx + 1}
                              </span>

                              <div className="min-w-0">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <h4 className="text-sm font-bold text-slate-900 truncate">
                                    {item.name}
                                  </h4>

                                  {/* Badge de Estado com Ícone + Texto */}
                                  {item.condition_status ? (
                                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border flex items-center gap-1 ${conditionConfig.badgeBg} ${conditionConfig.badgeText} ${conditionConfig.badgeBorder}`}>
                                      <span>{conditionConfig.iconText}</span>
                                      <span>{conditionConfig.label}</span>
                                    </span>
                                  ) : (
                                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-500 border border-slate-200">
                                      ○ Não avaliado
                                    </span>
                                  )}

                                  {/* Badge de Reparo */}
                                  {item.requires_repair && (
                                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-rose-50 text-rose-700 border border-rose-200 flex items-center gap-1">
                                      <Wrench className="w-3 h-3 text-rose-600" /> Reparo
                                    </span>
                                  )}
                                </div>

                                {/* Snippet da descrição se colapsado */}
                                {!isExpanded && (
                                  <p className="text-xs text-slate-500 truncate mt-0.5 max-w-xs sm:max-w-md">
                                    {item.description || <span className="italic text-slate-400">Sem observações descritas.</span>}
                                  </p>
                                )}
                              </div>
                            </div>

                            {/* Lado Direito do Item Header */}
                            <div className="flex items-center gap-2 shrink-0">
                              {/* Fotos Badge com miniatura */}
                              <span className="px-2 py-1 rounded-xl bg-slate-100 text-slate-700 text-xs font-bold flex items-center gap-1">
                                <Camera className="w-3.5 h-3.5 text-slate-500" />
                                <span>{itemPhotos.length}</span>
                              </span>

                              {/* Indicador de Salvamento em Tempo Real */}
                              {status === 'saving' && (
                                <span className="text-[10px] text-primary-600 font-bold flex items-center gap-1">
                                  <Loader2 className="w-3 h-3 animate-spin" /> Salvando...
                                </span>
                              )}
                              {status === 'saved' && (
                                <span className="text-[10px] text-emerald-600 font-bold flex items-center gap-1">
                                  <Check className="w-3 h-3" /> Salvo
                                </span>
                              )}
                              {status === 'conflict' && (
                                <span className="text-[10px] text-amber-700 font-bold flex items-center gap-1 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200">
                                  <AlertTriangle className="w-3 h-3" /> Conflito
                                </span>
                              )}

                              {/* Chevron de Expansão com Touch Target >= 44px */}
                              <div className="min-w-[40px] min-h-[40px] flex items-center justify-center rounded-xl bg-slate-100 text-slate-600">
                                {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                              </div>
                            </div>
                          </div>

                          {/* ------------------------------------------------------------- */}
                          {/* ITEM EXPANDIDO: EDITOR DE CAMPO DEDICADO                      */}
                          {/* ------------------------------------------------------------- */}
                          {isExpanded && (
                            <div className="p-4 sm:p-6 border-t border-slate-100 bg-slate-50/40 space-y-5 animate-in fade-in">
                              
                              {/* 1. SELETOR DE ESTADO DE CONSERVAÇÃO (TOUCH TARGET >= 48px) */}
                              <div className="space-y-1.5">
                                <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500">
                                  Estado de Conservação
                                </label>
                                
                                <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
                                  {CONDITION_BUTTONS.map((cond) => {
                                    const isSelected = item.condition_status === cond.value;

                                    return (
                                      <button
                                        key={cond.value}
                                        type="button"
                                        disabled={isCompleted}
                                        onClick={() => handleItemFieldChange(activeRoom.id, item.id, { condition_status: cond.value })}
                                        className={`min-h-[48px] px-2 py-2 rounded-2xl text-xs font-bold transition-all flex flex-col items-center justify-center gap-0.5 border select-none ${
                                          isSelected
                                            ? `${cond.activeBg} ${cond.activeText} ${cond.activeBorder} shadow-md`
                                            : 'bg-white text-slate-700 border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                                        }`}
                                      >
                                        <span className="text-sm font-black">{cond.iconText}</span>
                                        <span className="text-[11px]">{cond.label}</span>
                                      </button>
                                    );
                                  })}
                                </div>
                              </div>

                              {/* 2. TOGGLE DE NECESSITA REPARO */}
                              <div className="p-3.5 bg-white rounded-2xl border border-slate-200 space-y-2">
                                <label className="flex items-center gap-3 cursor-pointer select-none">
                                  <input
                                    type="checkbox"
                                    disabled={isCompleted}
                                    checked={Boolean(item.requires_repair)}
                                    onChange={(e) => handleItemFieldChange(activeRoom.id, item.id, { requires_repair: e.target.checked })}
                                    className="w-5 h-5 rounded-lg text-primary-600 focus:ring-primary-500 border-slate-300"
                                  />
                                  <div>
                                    <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                                      <Wrench className="w-4 h-4 text-amber-600" />
                                      <span>Necessita de Reparo ou Manutenção</span>
                                    </span>
                                    <p className="text-[11px] text-slate-500">Marque se este item apresenta avarias que exigem conserto.</p>
                                  </div>
                                </label>

                                {item.requires_repair && (
                                  <div className="pt-2 animate-in fade-in">
                                    <input
                                      type="text"
                                      disabled={isCompleted}
                                      placeholder="Descreva o reparo necessário (Ex: Substituir espelho do interruptor trincado)..."
                                      value={item.repair_notes || ''}
                                      onChange={(e) => handleItemFieldChange(activeRoom.id, item.id, { repair_notes: e.target.value })}
                                      className="w-full min-h-[44px] px-3.5 py-2.5 bg-amber-50/50 border border-amber-200 rounded-xl text-xs focus:ring-2 focus:ring-amber-500 font-medium text-slate-900"
                                    />
                                  </div>
                                )}
                              </div>

                              {/* 3. DESCRIÇÃO TÉCNICA COM BOTÃO DE VOZ + IA */}
                              <div className="space-y-2">
                                <div className="flex items-center justify-between">
                                  <label className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                                    Descrição Pericial do Item
                                  </label>

                                  {!isCompleted && (
                                    <button
                                      type="button"
                                      onClick={() =>
                                        handleStartVoiceDescription(
                                          activeRoom.id,
                                          item.id,
                                          activeRoom.name,
                                          item.name,
                                          item.description || ''
                                        )
                                      }
                                      className="min-h-[38px] flex items-center gap-1.5 px-3 py-1.5 bg-primary-50 hover:bg-primary-100 text-primary-700 rounded-xl text-xs font-bold transition-all border border-primary-200 shadow-xs active:scale-95"
                                      title="Gravar observação e organizar com IA"
                                    >
                                      <Mic className="w-4 h-4 text-primary-600" />
                                      <span>Descrever por voz</span>
                                      <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                                    </button>
                                  )}
                                </div>

                                <textarea
                                  disabled={isCompleted}
                                  rows={3}
                                  placeholder="Ex: Parede em pintura látex fosca branca, sem riscos, marcas ou umidade aparente..."
                                  value={item.description || ''}
                                  onChange={(e) => handleItemFieldChange(activeRoom.id, item.id, { description: e.target.value })}
                                  className="w-full p-3 bg-white border border-slate-200 rounded-2xl text-xs sm:text-sm focus:ring-2 focus:ring-primary-600 resize-none font-normal text-slate-800 disabled:bg-slate-100 leading-relaxed shadow-xs"
                                />
                              </div>

                              {/* 4. FOTOS E EVIDÊNCIAS DO ITEM */}
                              <div className="space-y-3 pt-2 border-t border-slate-200/80">
                                <div className="flex items-center justify-between">
                                  <label className="text-[11px] font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                                    <Camera className="w-3.5 h-3.5 text-primary-600" />
                                    <span>Fotos do Item ({itemPhotos.length})</span>
                                  </label>
                                </div>

                                {!isCompleted && (
                                  <MediaUploader
                                    companyId={companyId}
                                    inspectionId={inspectionId}
                                    roomId={activeRoom.id}
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

                              {/* 5. AÇÕES DE RODAPÉ DO ITEM (PRÓXIMO ITEM + EXCLUIR) */}
                              <div className="flex items-center justify-between pt-3 border-t border-slate-200">
                                {!isCompleted && (
                                  <button
                                    type="button"
                                    onClick={() => handleDeleteItem(activeRoom.id, item.id)}
                                    className="min-h-[44px] px-3 py-2 rounded-xl text-slate-400 hover:text-rose-600 hover:bg-rose-50 text-xs font-bold transition-colors flex items-center gap-1.5"
                                  >
                                    <Trash2 className="w-4 h-4" />
                                    <span>Excluir Item</span>
                                  </button>
                                )}

                                <div className="flex items-center gap-2 ml-auto">
                                  <button
                                    type="button"
                                    onClick={() => toggleItemExpand(item.id)}
                                    className="min-h-[44px] px-4 py-2 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-100 text-xs font-bold transition-colors"
                                  >
                                    Concluir Item
                                  </button>

                                  <button
                                    type="button"
                                    onClick={() => handleNextItem(activeRoom.id, item.id)}
                                    className="min-h-[44px] px-4 py-2 rounded-xl bg-primary-600 hover:bg-primary-700 text-white text-xs font-bold flex items-center gap-1.5 shadow-sm active:scale-95 transition-all"
                                  >
                                    <span>Próximo Item</span>
                                    <ChevronRight className="w-4 h-4" />
                                  </button>
                                </div>
                              </div>

                            </div>
                          )}

                        </div>
                      );
                    })}
                  </div>
                )}

                {/* BARRA DE ADIÇÃO RÁPIDA DE ITENS */}
                {!isCompleted && (
                  <div className="pt-4 space-y-2">
                    <span className="text-[11px] font-bold text-slate-500 block">
                      Adicionar itens sugeridos neste cômodo:
                    </span>

                    <div className="flex flex-wrap gap-1.5 items-center">
                      {activeRoomSuggestions.map((sug) => (
                        <button
                          key={sug}
                          onClick={() => handleAddItem(activeRoom.id, sug)}
                          className="min-h-[40px] px-3.5 py-2 rounded-xl bg-white hover:bg-primary-50 border border-slate-200 hover:border-primary-300 text-slate-700 hover:text-primary-700 text-xs font-bold transition-all active:scale-95 shadow-xs"
                        >
                          + {sug}
                        </button>
                      ))}

                      <button
                        onClick={() => {
                          setActiveRoomForItem(activeRoom.id);
                          setCustomItemName('');
                        }}
                        className="min-h-[40px] px-3.5 py-2 rounded-xl bg-primary-600 text-white text-xs font-bold hover:bg-primary-700 transition-all shadow-xs"
                      >
                        + Item Personalizado
                      </button>
                    </div>

                    {/* Input para Item Customizado */}
                    {activeRoomForItem === activeRoom.id && (
                      <div className="p-3.5 bg-white rounded-2xl border-2 border-primary-300 shadow-md space-y-2 animate-in fade-in">
                        <label className="block text-[11px] font-bold uppercase tracking-wider text-primary-700">
                          Nome do Item Personalizado
                        </label>
                        <div className="flex gap-2">
                          <input
                            type="text"
                            placeholder="Ex: Ar-condicionado Split, Interfone, Armário Planejado..."
                            value={customItemName}
                            onChange={(e) => setCustomItemName(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                e.preventDefault();
                                handleAddItem(activeRoom.id, customItemName);
                              }
                            }}
                            autoFocus
                            className="flex-1 min-h-[44px] px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-primary-600"
                          />
                          <button
                            onClick={() => handleAddItem(activeRoom.id, customItemName)}
                            className="min-h-[44px] px-5 py-2 bg-primary-600 text-white rounded-xl text-xs font-bold hover:bg-primary-700 transition-all"
                          >
                            Adicionar
                          </button>
                          <button
                            onClick={() => setActiveRoomForItem(null)}
                            className="min-h-[44px] px-3.5 py-2 bg-slate-100 text-slate-600 rounded-xl text-xs font-bold hover:bg-slate-200 transition-all"
                          >
                            Cancelar
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )}

              </div>

            </div>
          </div>
        )}

      </main>

      {/* ========================================================================= */}
      {/* 6. BOTTOM CONTEXTUAL THUMB BAR (MOBILE ONLY)                              */}
      {/* ========================================================================= */}
      <nav 
        className="fixed bottom-0 left-0 right-0 z-30 bg-white/95 backdrop-blur-md border-t border-slate-200 sm:hidden shadow-lg"
        style={{ paddingBottom: 'env(safe-area-inset-bottom, 12px)' }}
      >
        <div className="grid grid-cols-4 gap-1 p-2">
          {/* 1. Ambientes Drawer */}
          <button
            onClick={() => setIsRoomsDrawerOpen(true)}
            className="min-h-[48px] flex flex-col items-center justify-center gap-0.5 text-slate-700 hover:text-primary-600 rounded-xl active:bg-slate-100 transition-colors"
          >
            <FolderOpen className="w-5 h-5 text-primary-600" />
            <span className="text-[10px] font-bold">Cômodos ({rooms.length})</span>
          </button>

          {/* 2. + Foto Rápida no Cômodo */}
          <button
            disabled={!activeRoom || isCompleted}
            onClick={() => {
              const input = document.querySelector('input[capture="environment"]') as HTMLInputElement;
              if (input) input.click();
            }}
            className="min-h-[48px] flex flex-col items-center justify-center gap-0.5 text-slate-700 hover:text-primary-600 disabled:opacity-40 rounded-xl active:bg-slate-100 transition-colors"
          >
            <Camera className="w-5 h-5 text-primary-600" />
            <span className="text-[10px] font-bold">+ Foto</span>
          </button>

          {/* 3. + Item no Cômodo */}
          <button
            disabled={!activeRoom || isCompleted}
            onClick={() => {
              if (activeRoom) {
                setActiveRoomForItem(activeRoom.id);
                setCustomItemName('');
              }
            }}
            className="min-h-[48px] flex flex-col items-center justify-center gap-0.5 text-slate-700 hover:text-primary-600 disabled:opacity-40 rounded-xl active:bg-slate-100 transition-colors"
          >
            <Plus className="w-5 h-5 text-primary-600" />
            <span className="text-[10px] font-bold">+ Item</span>
          </button>

          {/* 4. Revisar / Concluir */}
          <button
            onClick={() => setIsReviewModalOpen(true)}
            className="min-h-[48px] flex flex-col items-center justify-center gap-0.5 bg-emerald-600 text-white rounded-xl active:scale-95 shadow-sm transition-all"
          >
            <FileCheck2 className="w-5 h-5" />
            <span className="text-[10px] font-bold">Revisar ({completionPercent}%)</span>
          </button>
        </div>
      </nav>

      {/* ========================================================================= */}
      {/* 7. MODALS AUXILIARES (ÁUDIO, IA, AMBIENTES, REVISÃO, FINALIZAÇÃO)         */}
      {/* ========================================================================= */}

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
      {isAIRefineModalOpen && activeTranscription && audioTarget && (
        <TranscriptionReviewModal
          isOpen={isAIRefineModalOpen}
          transcription={activeTranscription}
          existingDescription={audioTarget.currentDescription}
          roomName={audioTarget.roomName}
          itemName={audioTarget.itemName}
          onClose={() => {
            setIsAIRefineModalOpen(false);
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
            <Loader2 className="w-5 h-5 text-primary-600 animate-spin" />
            <span className="text-xs sm:text-sm font-bold">
              Organizando observação pericial com IA...
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
              <h3 className="text-base font-black text-slate-900">Adicionar Cômodo / Ambiente</h3>
              <p className="text-xs text-slate-500 mt-0.5">Selecione uma sugestão comum ou digite o nome personalizado</p>
            </div>

            <div className="space-y-3">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">Modelos Comuns</span>
              <div className="grid grid-cols-2 gap-2">
                {COMMON_ROOM_TEMPLATES.map((tmpl) => (
                  <button
                    key={tmpl}
                    onClick={() => handleAddRoom(tmpl)}
                    className="min-h-[44px] p-2.5 rounded-xl border border-slate-200 hover:border-primary-300 bg-slate-50 hover:bg-primary-50 text-slate-700 hover:text-primary-700 text-xs font-bold text-left transition-all active:scale-95 truncate flex items-center"
                  >
                    + {tmpl}
                  </button>
                ))}
              </div>
            </div>

            <div className="pt-2 border-t border-slate-100 space-y-2">
              <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-600">Ou Nome Personalizado</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="Ex: Área Gourmet, Closet, Adega..."
                  value={customRoomName}
                  onChange={(e) => setCustomRoomName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleAddRoom(customRoomName);
                    }
                  }}
                  className="flex-1 min-h-[44px] px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-primary-600"
                />
                <button
                  onClick={() => handleAddRoom(customRoomName)}
                  disabled={!customRoomName.trim() || isActionLoading}
                  className="min-h-[44px] px-5 py-2 bg-primary-600 text-white rounded-xl text-xs font-bold hover:bg-primary-700 transition-all disabled:opacity-50"
                >
                  Criar
                </button>
              </div>
            </div>

            <button
              onClick={() => setIsAddRoomModalOpen(false)}
              className="w-full min-h-[44px] py-2.5 rounded-xl border border-slate-200 text-slate-600 font-bold text-xs hover:bg-slate-50 transition-colors flex items-center justify-center"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}

      {/* Drawer / Modal: Lista Completa de Ambientes */}
      {isRoomsDrawerOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 overflow-y-auto animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl max-w-lg w-full p-5 sm:p-7 shadow-2xl border border-slate-200 space-y-4 max-h-[85vh] flex flex-col animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div>
                <h3 className="text-base font-black text-slate-900">Todos os Ambientes</h3>
                <p className="text-xs text-slate-500">Selecione para navegar diretamente ao cômodo</p>
              </div>
              <button
                onClick={() => setIsRoomsDrawerOpen(false)}
                className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-xl hover:bg-slate-100 text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Busca de Ambientes */}
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Buscar ambiente..."
                value={roomSearchQuery}
                onChange={(e) => setRoomSearchQuery(e.target.value)}
                className="w-full min-h-[44px] pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-primary-600"
              />
            </div>

            {/* Lista Filtrada */}
            <div className="overflow-y-auto space-y-2 flex-1 max-h-[45vh] pr-1">
              {rooms
                .filter((r) => r.name.toLowerCase().includes(roomSearchQuery.toLowerCase()))
                .map((room, idx) => {
                  const isActive = room.id === activeRoomId;
                  const roomPhotosCount = getRoomPhotos(room.id).length;
                  const roomItemsPhotosCount = room.items.reduce((acc, it) => acc + getItemPhotos(it.id).length, 0);
                  const hasRepairs = room.items.some((i) => i.requires_repair);

                  return (
                    <div
                      key={room.id}
                      onClick={() => {
                        setActiveRoomId(room.id);
                        setIsRoomsDrawerOpen(false);
                      }}
                      className={`p-3 rounded-2xl border cursor-pointer flex items-center justify-between transition-all ${
                        isActive
                          ? 'bg-primary-50 border-primary-300 shadow-xs'
                          : 'bg-white border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                      }`}
                    >
                      <div className="flex items-center gap-2.5">
                        <span className="w-6 h-6 rounded-lg bg-slate-100 text-slate-700 font-bold text-xs flex items-center justify-center">
                          {idx + 1}
                        </span>
                        <div>
                          <h4 className="text-xs font-bold text-slate-900">{room.name}</h4>
                          <p className="text-[10px] text-slate-500">
                            {room.items.length} itens • {roomPhotosCount + roomItemsPhotosCount} fotos
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5">
                        {hasRepairs && (
                          <span className="text-[10px] font-bold text-rose-600 bg-rose-50 px-2 py-0.5 rounded-full border border-rose-200">
                            Reparo
                          </span>
                        )}
                        <ChevronRight className="w-4 h-4 text-slate-400" />
                      </div>
                    </div>
                  );
                })}
            </div>

            <div className="pt-2 border-t border-slate-100 flex gap-2">
              {!isCompleted && (
                <button
                  onClick={() => {
                    setIsRoomsDrawerOpen(false);
                    setIsAddRoomModalOpen(true);
                  }}
                  className="flex-1 min-h-[44px] py-2.5 bg-primary-600 text-white rounded-xl font-bold text-xs hover:bg-primary-700 transition-colors flex items-center justify-center gap-1.5"
                >
                  <Plus className="w-4 h-4" />
                  <span>Novo Cômodo</span>
                </button>
              )}
              <button
                onClick={() => setIsRoomsDrawerOpen(false)}
                className="min-h-[44px] px-4 py-2.5 rounded-xl border border-slate-200 text-slate-600 font-bold text-xs hover:bg-slate-50"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Checklist de Revisão Pré-Finalização */}
      {isReviewModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 overflow-y-auto animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl max-w-xl w-full p-5 sm:p-7 shadow-2xl border border-slate-200 space-y-5 max-h-[90vh] flex flex-col animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-2xl bg-primary-50 text-primary-600 flex items-center justify-center">
                  <FileCheck2 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-black text-slate-900">Revisão Pré-Finalização</h3>
                  <p className="text-xs text-slate-500">Confira o resumo geral da vistoria antes de concluir o laudo.</p>
                </div>
              </div>
              <button
                onClick={() => setIsReviewModalOpen(false)}
                className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-xl hover:bg-slate-100 text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Métricas do Laudo */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center">
              <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200">
                <span className="text-[10px] font-bold text-slate-400 uppercase block">Cômodos</span>
                <span className="text-lg font-black text-slate-900">{totalRooms}</span>
              </div>
              <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200">
                <span className="text-[10px] font-bold text-slate-400 uppercase block">Itens</span>
                <span className="text-lg font-black text-slate-900">{totalItems}</span>
              </div>
              <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200">
                <span className="text-[10px] font-bold text-slate-400 uppercase block">Fotos</span>
                <span className="text-lg font-black text-slate-900">{totalPhotos}</span>
              </div>
              <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200">
                <span className="text-[10px] font-bold text-slate-400 uppercase block">Progresso</span>
                <span className="text-lg font-black text-primary-600">{completionPercent}%</span>
              </div>
            </div>

            {/* Alerta de Itens com Reparo Marcado */}
            {repairItemsCount > 0 && (
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-2xl text-xs text-amber-900 flex items-start gap-2">
                <Wrench className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <div>
                  <strong>{repairItemsCount} item(ns) com reparo sinalizado:</strong> Serão destacados no laudo técnico para providências do locador/administradora.
                </div>
              </div>
            )}

            {/* Lista de Pendências Não Inspecionadas */}
            {pendingItemsList.length > 0 ? (
              <div className="space-y-2 flex-1 overflow-y-auto max-h-[30vh]">
                <span className="text-xs font-bold text-slate-700 flex items-center justify-between">
                  <span>Itens Pendentes de Avaliação ({pendingItemsList.length}):</span>
                  <span className="text-[10px] font-normal text-slate-400">Toque para inspecionar</span>
                </span>
                
                <div className="space-y-1.5">
                  {pendingItemsList.map(({ room, item }) => (
                    <div
                      key={item.id}
                      onClick={() => {
                        setActiveRoomId(room.id);
                        setExpandedItems({ [item.id]: true });
                        setIsReviewModalOpen(false);
                      }}
                      className="p-2.5 bg-slate-50 hover:bg-primary-50 rounded-xl border border-slate-200 hover:border-primary-300 flex items-center justify-between cursor-pointer transition-all text-xs"
                    >
                      <div className="flex items-center gap-2">
                        <span className="text-slate-400 font-bold">{room.name} →</span>
                        <span className="font-bold text-slate-800">{item.name}</span>
                      </div>
                      <span className="text-[10px] text-amber-700 font-bold bg-amber-100 px-2 py-0.5 rounded-full">
                        Pendente
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl text-xs text-emerald-800 flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                <div>
                  <strong>Todos os itens foram inspecionados!</strong> A vistoria está pronta para ser finalizada e consolidada.
                </div>
              </div>
            )}

            {/* Ações do Modal de Revisão */}
            <div className="pt-2 border-t border-slate-100 flex flex-col sm:flex-row gap-2.5">
              <button
                onClick={() => setIsReviewModalOpen(false)}
                className="sm:w-1/2 min-h-[48px] py-3 rounded-xl border border-slate-200 text-slate-700 font-bold text-xs hover:bg-slate-50 transition-colors flex items-center justify-center"
              >
                Continuar Editando
              </button>

              <button
                onClick={() => {
                  setIsReviewModalOpen(false);
                  setIsFinalizeModalOpen(true);
                }}
                className="sm:w-1/2 min-h-[48px] py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-lg shadow-emerald-600/20 active:scale-95 transition-all"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>Prosseguir para Finalização</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Confirmação de Finalização Definitiva */}
      {isFinalizeModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 sm:p-8 shadow-2xl border border-slate-200 space-y-5 text-center animate-in fade-in zoom-in-95 duration-200">
            <div className="w-14 h-14 rounded-2xl bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto">
              <CheckCircle2 className="w-7 h-7" />
            </div>

            <div>
              <h3 className="text-lg font-black text-slate-900">Finalizar Vistoria?</h3>
              <p className="text-xs text-slate-500 mt-1 max-w-xs mx-auto leading-relaxed">
                Após a finalização, o conteúdo será consolidado e não poderá ser editado sem o fluxo autorizado de reabertura por um Gerente.
              </p>
            </div>

            <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200 text-xs font-bold text-slate-700">
              Total: {totalRooms} ambiente(s), {totalItems} item(ns) e {totalPhotos} foto(s)
            </div>

            {netStatus === 'OFFLINE' && (
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-800 text-left flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <span>Conecte-se à internet para finalizar a vistoria oficialmente.</span>
              </div>
            )}

            <div className="flex gap-3">
              <button
                onClick={() => setIsFinalizeModalOpen(false)}
                className="w-1/2 min-h-[48px] py-3 rounded-xl border border-slate-200 text-slate-600 font-bold text-xs hover:bg-slate-50 transition-colors flex items-center justify-center"
              >
                Cancelar
              </button>
              <button
                onClick={handleFinalize}
                disabled={isActionLoading || netStatus === 'OFFLINE'}
                className="w-1/2 min-h-[48px] py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-300 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-lg shadow-emerald-600/20 active:scale-95 transition-all"
              >
                {isActionLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Finalizando...</span>
                  </>
                ) : (
                  'Finalizar Vistoria'
                )}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
