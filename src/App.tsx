import { useState, useEffect } from 'react';
import { 
  Plus, 
  FileText, 
  Building,
  Mic,
  LayoutDashboard
} from 'lucide-react';
import type { 
  InspectionData, 
  Room, 
  InspectionItem, 
  QuickTemplate,
  SupabaseConfig,
  InspectionType
} from './types/inspection';
import { 
  saveInspectionToDb, 
  getAllInspectionsFromDb, 
  deleteInspectionFromDb,
  getAppProfile, 
  saveAppProfile 
} from './services/db';
import { 
  uploadInspectionToSupabase, 
  fetchInspectionsFromSupabase, 
  deleteInspectionFromSupabase 
} from './services/supabaseClient';
import { getCurrentSession, clearSession } from './services/authService';
import type { AuthSession } from './types/auth';

// Components
import { ToastProvider, useToast } from './components/Toast';
import { Navbar } from './components/Navbar';
import { LobbyView } from './components/LobbyView';
import { LoginView } from './components/LoginView';
import { UserManagementModal } from './components/UserManagementModal';
import { ProtectedClientViewer } from './components/ProtectedClientViewer';
import { AudioInspectionView } from './components/AudioInspectionView';
import { PropertyHeaderCard } from './components/PropertyHeaderCard';
import { RoomList } from './components/RoomList';
import { RoomDetail } from './components/RoomDetail';
import { PropertyInfoModal } from './components/PropertyInfoModal';
import { TemplateSelectorModal } from './components/TemplateSelectorModal';
import { ItemEditorModal } from './components/ItemEditorModal';
import { PhotoViewerModal } from './components/PhotoViewerModal';
import { PdfPreviewModal } from './components/PdfPreviewModal';
import { BackupSyncModal } from './components/BackupSyncModal';
import { AddRoomModal } from './components/AddRoomModal';
import { ConfirmModal } from './components/ConfirmModal';

// Clean, zero-mock new inspection helper
const createEmptyInspection = (): InspectionData => {
  const today = new Date().toISOString().split('T')[0];
  const currentTime = new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

  return {
    id: `insp-${Date.now()}`,
    title: 'Nova Vistoria Imobiliária',
    inspectionType: 'Entrada',
    date: today,
    time: currentTime,
    inspectorName: '',
    inspectorCpfCreci: '',
    tenantName: '',
    tenantCpf: '',
    ownerName: '',
    propertyAddress: '',
    propertyNumber: '',
    propertyComplement: '',
    propertyNeighborhood: '',
    propertyCity: '',
    propertyState: '',
    propertyZip: '',
    companyName: '',
    companyCnpj: '',
    companyPhone: '',
    waterMeter: '',
    energyMeter: '',
    gasMeter: '',
    keysInfo: '',
    generalObservations: '',
    useGovBrSignatures: false,
    rooms: [
      {
        id: `room-${Date.now()}-1`,
        name: 'Sala de Estar',
        items: [
          {
            id: `item-${Date.now()}-1`,
            name: 'Paredes e Pintura',
            status: 'Bom',
            description: '',
            needRepair: false,
            photos: [],
          },
        ],
      },
    ],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
};

function MainApp() {
  const { showToast } = useToast();

  // Multi-tenant auth session
  const [authSession, setAuthSession] = useState<AuthSession | null>(getCurrentSession);

  // Navigation: 'lobby' | 'inspection' | 'audio-inspection'
  const [currentView, setCurrentView] = useState<'lobby' | 'inspection' | 'audio-inspection'>('lobby');

  const [inspectionsList, setInspectionsList] = useState<InspectionData[]>([]);
  const [currentInspection, setCurrentInspection] = useState<InspectionData>(createEmptyInspection);
  const [activeRoomId, setActiveRoomId] = useState<string>('');
  const [supabaseConfig, setSupabaseConfig] = useState<SupabaseConfig | undefined>();

  // Modals state
  const [isPropertyInfoOpen, setIsPropertyInfoOpen] = useState(false);
  const [isTemplatesOpen, setIsTemplatesOpen] = useState(false);
  const [isPdfPreviewOpen, setIsPdfPreviewOpen] = useState(false);
  const [isBackupSyncOpen, setIsBackupSyncOpen] = useState(false);
  const [isUserManagementOpen, setIsUserManagementOpen] = useState(false);
  const [isItemEditorOpen, setIsItemEditorOpen] = useState(false);
  const [isAddRoomOpen, setIsAddRoomOpen] = useState(false);
  const [selectedItemForEdit, setSelectedItemForEdit] = useState<InspectionItem | null>(null);
  const [inspectionToDelete, setInspectionToDelete] = useState<{ id: string; title: string } | null>(null);
  const [isDeleteActiveRoomOpen, setIsDeleteActiveRoomOpen] = useState(false);
  const [isSyncingCloud, setIsSyncingCloud] = useState(false);

  // Public client viewing token mode
  const [clientInspection, setClientInspection] = useState<InspectionData | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const laudoId = params.get('laudo') || params.get('viewToken');
    if (laudoId) {
      getAllInspectionsFromDb().then((all) => {
        const found = all.find((i) => i.id === laudoId);
        if (found) {
          setClientInspection(found);
        } else {
          fetchInspectionsFromSupabase().then((res) => {
            const remoteFound = res.data?.find((i) => i.id === laudoId);
            if (remoteFound) {
              setClientInspection(remoteFound);
            }
          });
        }
      });
    }
  }, []);

  // Photo viewer state
  const [photoViewer, setPhotoViewer] = useState<{ isOpen: boolean; url: string; caption?: string }>({
    isOpen: false,
    url: '',
    caption: '',
  });

  const reloadInspections = async () => {
    try {
      const list = await getAllInspectionsFromDb();
      setInspectionsList(list);
      return list;
    } catch (e) {
      console.warn('Error loading inspections list', e);
      return [];
    }
  };

  const handleSyncCloud = async (silent = false) => {
    setIsSyncingCloud(true);
    try {
      const res = await fetchInspectionsFromSupabase(supabaseConfig, authSession?.company.id);
      if (res.success && res.data && res.data.length > 0) {
        // Save all remote inspections into local Dexie IndexedDB
        for (const remoteInsp of res.data) {
          await saveInspectionToDb(remoteInsp);
        }
        const updatedList = await reloadInspections();
        if (updatedList.length > 0) {
          const currentStillExists = updatedList.some((i) => i.id === currentInspection.id);
          if (!currentStillExists) {
            setCurrentInspection(updatedList[0]);
          }
        }
        if (!silent) {
          showToast(`${res.data.length} vistoria(s) sincronizada(s) da nuvem!`, 'success');
        }
      } else if (!silent) {
        showToast('Nuvem verificada: suas vistorias já estão atualizadas.', 'info');
      }
    } catch (err) {
      if (!silent) {
        showToast('Não foi possível sincronizar com a nuvem agora.', 'error');
      }
    } finally {
      setIsSyncingCloud(false);
    }
  };

  // Initial load
  useEffect(() => {
    async function loadData() {
      try {
        const profile = await getAppProfile();
        let activeCfg = supabaseConfig;
        if (profile?.supabaseConfig) {
          setSupabaseConfig(profile.supabaseConfig);
          activeCfg = profile.supabaseConfig;
        }

        const list = await reloadInspections();
        if (list.length > 0) {
          setCurrentInspection(list[0]);
          if (list[0].rooms.length > 0) {
            setActiveRoomId(list[0].rooms[0].id);
          }
        }

        // Auto-fetch from Supabase on startup with company isolation
        fetchInspectionsFromSupabase(activeCfg, authSession?.company.id).then(async (res) => {
          if (res.success && res.data && res.data.length > 0) {
            for (const remoteInsp of res.data) {
              await saveInspectionToDb(remoteInsp);
            }
            await reloadInspections();
          }
        }).catch(() => {});
      } catch (err) {
        console.error('Error loading data', err);
      }
    }

    loadData();
  }, [authSession]);

  // Sync active room when current inspection changes
  useEffect(() => {
    if (currentInspection.rooms.length > 0) {
      const exists = currentInspection.rooms.some((r) => r.id === activeRoomId);
      if (!exists) {
        setActiveRoomId(currentInspection.rooms[0].id);
      }
    } else {
      setActiveRoomId('');
    }
  }, [currentInspection, activeRoomId]);

  // Auto-save current inspection to local IndexedDB and Supabase Cloud with debounce
  useEffect(() => {
    if (currentInspection && currentInspection.id) {
      const timer = setTimeout(async () => {
        try {
          await saveInspectionToDb(currentInspection);
          await reloadInspections();
          // Push to cloud in background with company isolation
          uploadInspectionToSupabase(currentInspection, supabaseConfig, authSession?.company.id).catch(() => {});
        } catch (e) {
          console.warn('Autosave error', e);
        }
      }, 500);

      return () => clearTimeout(timer);
    }
  }, [currentInspection, supabaseConfig, authSession]);

  // Handlers
  const handleSelectInspectionFromLobby = (selected: InspectionData) => {
    setCurrentInspection(selected);
    if (selected.rooms.length > 0) {
      setActiveRoomId(selected.rooms[0].id);
    }
    setCurrentView('inspection');
  };

  const handleStartNewInspection = async () => {
    const profile = await getAppProfile();
    const fresh = createEmptyInspection();

    if (authSession) {
      fresh.companyName = authSession.company.tradeName;
      fresh.companyLogo = authSession.company.logoUrl;
      fresh.inspectorName = authSession.user.fullName;
      fresh.inspectorCpfCreci = authSession.user.creci || authSession.user.cpf || '';
    } else if (profile) {
      if (profile.companyName) fresh.companyName = profile.companyName;
      if (profile.companyCnpj) fresh.companyCnpj = profile.companyCnpj;
      if (profile.companyPhone) fresh.companyPhone = profile.companyPhone;
      if (profile.companyLogo) fresh.companyLogo = profile.companyLogo;
      if (profile.defaultInspectorName) fresh.inspectorName = profile.defaultInspectorName;
      if (profile.defaultInspectorCpfCreci) fresh.inspectorCpfCreci = profile.defaultInspectorCpfCreci;
    }

    await saveInspectionToDb(fresh);
    // Push immediately to Supabase
    uploadInspectionToSupabase(fresh, supabaseConfig, authSession?.company.id).catch(() => {});
    await reloadInspections();
    setCurrentInspection(fresh);
    setActiveRoomId(fresh.rooms[0]?.id || '');
    setCurrentView('inspection');
    showToast('Nova vistoria criada e sincronizada!', 'success');
  };

  const handleDeleteInspection = (id: string, title: string) => {
    setInspectionToDelete({ id, title });
  };

  const confirmDeleteInspection = async () => {
    if (!inspectionToDelete) return;
    const { id } = inspectionToDelete;
    await deleteInspectionFromDb(id);
    // Delete from Supabase in background
    deleteInspectionFromSupabase(id, supabaseConfig).catch(() => {});
    const remaining = await reloadInspections();
    if (currentInspection.id === id) {
      if (remaining.length > 0) {
        setCurrentInspection(remaining[0]);
      } else {
        setCurrentInspection(createEmptyInspection());
      }
    }
    showToast('Vistoria excluída com sucesso.', 'info');
    setInspectionToDelete(null);
  };

  const handleDuplicateInspection = async (source: InspectionData, newType: InspectionType) => {
    const duplicated: InspectionData = {
      ...source,
      id: `insp-${Date.now()}`,
      title: `${source.title || 'Vistoria'} (${newType})`,
      inspectionType: newType,
      date: new Date().toISOString().split('T')[0],
      time: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
      inspectorSignature: undefined,
      tenantSignature: undefined,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    await saveInspectionToDb(duplicated);
    await reloadInspections();
    setCurrentInspection(duplicated);
    if (duplicated.rooms.length > 0) {
      setActiveRoomId(duplicated.rooms[0].id);
    }
    setCurrentView('inspection');
    showToast(`Vistoria duplicada como "${newType}" com sucesso!`, 'success');
  };

  const handleUpdateInspectionData = (partial: Partial<InspectionData>) => {
    setCurrentInspection((prev) => {
      const updated = { ...prev, ...partial, updatedAt: new Date().toISOString() };
      
      if (partial.companyName || partial.companyLogo || partial.inspectorName) {
        saveAppProfile({
          companyName: updated.companyName,
          companyCnpj: updated.companyCnpj,
          companyPhone: updated.companyPhone,
          companyLogo: updated.companyLogo,
          defaultInspectorName: updated.inspectorName,
          defaultInspectorCpfCreci: updated.inspectorCpfCreci,
        });
      }

      return updated;
    });
  };

  const handleApplyTemplate = (template: QuickTemplate) => {
    const newRooms: Room[] = template.rooms.map((r, rIdx) => ({
      id: `room-${Date.now()}-${rIdx + 1}`,
      name: r.name,
      items: r.items.map((itemName, iIdx) => ({
        id: `item-${Date.now()}-${rIdx + 1}-${iIdx + 1}`,
        name: itemName,
        status: 'Bom',
        description: '',
        needRepair: false,
        photos: [],
      })),
    }));

    setCurrentInspection((prev) => ({
      ...prev,
      rooms: newRooms,
      updatedAt: new Date().toISOString(),
    }));

    if (newRooms.length > 0) {
      setActiveRoomId(newRooms[0].id);
    }

    showToast(`Modelo "${template.name}" aplicado com ${newRooms.length} cômodos!`, 'success');
  };

  const handleCreateRoom = (roomName: string) => {
    const newRoom: Room = {
      id: `room-${Date.now()}`,
      name: roomName.trim(),
      items: [
        {
          id: `item-${Date.now()}-1`,
          name: 'Paredes e Pintura',
          status: 'Bom',
          description: '',
          needRepair: false,
          photos: [],
        },
      ],
    };

    setCurrentInspection((prev) => ({
      ...prev,
      rooms: [...prev.rooms, newRoom],
      updatedAt: new Date().toISOString(),
    }));

    setActiveRoomId(newRoom.id);
    showToast(`Ambiente "${roomName.trim()}" criado com sucesso!`, 'success');
  };

  const handleUpdateActiveRoom = (updatedRoom: Room) => {
    setCurrentInspection((prev) => ({
      ...prev,
      rooms: prev.rooms.map((r) => (r.id === updatedRoom.id ? updatedRoom : r)),
      updatedAt: new Date().toISOString(),
    }));
  };

  const handleDeleteActiveRoom = () => {
    if (currentInspection.rooms.length <= 1) {
      showToast('A vistoria precisa conter pelo menos um ambiente.', 'error');
      return;
    }
    setIsDeleteActiveRoomOpen(true);
  };

  const confirmDeleteActiveRoom = () => {
    const remainingRooms = currentInspection.rooms.filter((r) => r.id !== activeRoomId);
    setCurrentInspection((prev) => ({
      ...prev,
      rooms: remainingRooms,
      updatedAt: new Date().toISOString(),
    }));
    setActiveRoomId(remainingRooms[0]?.id || '');
    showToast('Ambiente excluído.', 'info');
  };

  const handleOpenItemEditor = (itemToEdit: InspectionItem | null) => {
    setSelectedItemForEdit(itemToEdit);
    setIsItemEditorOpen(true);
  };

  const handleSaveItem = (savedItem: InspectionItem) => {
    setCurrentInspection((prev) => {
      return {
        ...prev,
        rooms: prev.rooms.map((room) => {
          if (room.id !== activeRoomId) return room;

          const exists = room.items.some((i) => i.id === savedItem.id);
          const updatedItems = exists
            ? room.items.map((i) => (i.id === savedItem.id ? savedItem : i))
            : [...room.items, savedItem];

          return {
            ...room,
            items: updatedItems,
          };
        }),
        updatedAt: new Date().toISOString(),
      };
    });
  };

  const handleSaveAudioRooms = (audioRooms: Room[]) => {
    setCurrentInspection((prev) => ({
      ...prev,
      rooms: [...prev.rooms, ...audioRooms],
      updatedAt: new Date().toISOString(),
    }));
    if (audioRooms.length > 0) {
      setActiveRoomId(audioRooms[0].id);
    }
    setCurrentView('inspection');
  };

  const activeRoom = currentInspection.rooms.find((r) => r.id === activeRoomId) || currentInspection.rooms[0];
  const totalPhotosCount = currentInspection.rooms.reduce(
    (acc, r) => acc + r.items.reduce((iAcc, item) => iAcc + item.photos.length, 0),
    0
  );

  // If accessed via client share link (View-Only mode for Tenant/Landlord)
  if (clientInspection) {
    return (
      <ProtectedClientViewer
        inspection={clientInspection}
        onBack={() => {
          window.history.pushState({}, '', window.location.pathname);
          setClientInspection(null);
        }}
      />
    );
  }

  // If employee is not logged in, render the secure LoginView
  if (!authSession) {
    return (
      <LoginView
        onLoginSuccess={(session) => {
          setAuthSession(session);
          showToast(`Bem-vindo, ${session.user.fullName}!`, 'success');
        }}
      />
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col font-sans selection:bg-brand-500 selection:text-white pb-24 md:pb-8">
      
      {/* 1. Corporate Navbar */}
      <Navbar
        currentView={currentView}
        onNavigate={(view) => setCurrentView(view)}
        inspectionType={currentInspection.inspectionType}
        inspectionTitle={currentInspection.title}
        onOpenTemplates={() => setIsTemplatesOpen(true)}
        onOpenPropertyInfo={() => setIsPropertyInfoOpen(true)}
        onOpenBackupSync={() => setIsBackupSyncOpen(true)}
        onOpenUserManagement={() => setIsUserManagementOpen(true)}
        onGeneratePdf={() => setIsPdfPreviewOpen(true)}
        isGeneratingPdf={false}
        totalPhotos={totalPhotosCount}
        currentSession={authSession}
        onLogout={() => {
          clearSession();
          setAuthSession(null);
          showToast('Sessão encerrada com sucesso.', 'info');
        }}
      />

      {/* 2. Main Content Router */}
      <main className="max-w-7xl mx-auto px-3 sm:px-6 py-4 sm:py-6 flex-1 w-full">
        
        {/* VIEW 1: LOBBY / DASHBOARD */}
        {currentView === 'lobby' && (
          <LobbyView
            inspections={inspectionsList}
            onSelectInspection={handleSelectInspectionFromLobby}
            onNewInspection={handleStartNewInspection}
            onOpenAudioInspection={() => setCurrentView('audio-inspection')}
            onOpenTemplates={() => setIsTemplatesOpen(true)}
            onDuplicateInspection={handleDuplicateInspection}
            onDeleteInspection={handleDeleteInspection}
            onOpenCloudSync={() => setIsBackupSyncOpen(true)}
            onSyncCloud={handleSyncCloud}
            isSyncingCloud={isSyncingCloud}
          />
        )}

        {/* VIEW 2: AUDIO INSPECTION & PHOTO ATTRIBUTION */}
        {currentView === 'audio-inspection' && (
          <AudioInspectionView
            onBack={() => setCurrentView('lobby')}
            onSaveToInspection={handleSaveAudioRooms}
            onViewPhoto={(url, caption) => setPhotoViewer({ isOpen: true, url, caption })}
          />
        )}

        {/* VIEW 3: ACTIVE INSPECTION WORKSPACE */}
        {currentView === 'inspection' && (
          <div className="space-y-4">
            
            {/* Property Header Summary Card */}
            <PropertyHeaderCard
              data={currentInspection}
              onEdit={() => setIsPropertyInfoOpen(true)}
            />

            {/* Room Navigation Tabs */}
            <RoomList
              rooms={currentInspection.rooms}
              activeRoomId={activeRoomId}
              onSelectRoom={(id) => setActiveRoomId(id)}
              onAddRoom={() => setIsAddRoomOpen(true)}
            />

            {/* Active Room Detail View */}
            {activeRoom ? (
              <RoomDetail
                room={activeRoom}
                onUpdateRoom={handleUpdateActiveRoom}
                onDeleteRoom={handleDeleteActiveRoom}
                onOpenItemEditor={handleOpenItemEditor}
                onViewPhoto={(url, caption) => setPhotoViewer({ isOpen: true, url, caption })}
              />
            ) : (
              <div className="p-12 text-center text-slate-400 bg-white rounded-3xl border border-slate-200">
                Nenhum cômodo selecionado. Toque em "+ Novo Cômodo" para começar.
              </div>
            )}

          </div>
        )}

      </main>

      {/* 3. Mobile Bottom Action Bar (Fixed on Small Screens during Inspection) */}
      {currentView === 'inspection' && (
        <nav className="md:hidden fixed bottom-0 left-0 right-0 z-30 bg-white/95 backdrop-blur-md border-t border-slate-200 px-4 py-2 safe-bottom shadow-2xl flex items-center justify-around">
          <button
            onClick={() => setCurrentView('lobby')}
            className="flex flex-col items-center gap-0.5 text-slate-500 hover:text-slate-900"
          >
            <LayoutDashboard className="w-5 h-5 text-slate-600" />
            <span className="text-[10px] font-bold">Lobby</span>
          </button>

          <button
            onClick={() => setCurrentView('audio-inspection')}
            className="flex flex-col items-center gap-0.5 text-slate-500 hover:text-indigo-600"
          >
            <Mic className="w-5 h-5 text-indigo-600" />
            <span className="text-[10px] font-bold">Áudio</span>
          </button>

          <button
            onClick={() => handleOpenItemEditor(null)}
            className="flex flex-col items-center gap-0.5 text-slate-500 hover:text-brand-600"
          >
            <div className="w-10 h-10 rounded-full bg-brand-600 flex items-center justify-center text-white -mt-5 shadow-lg shadow-brand-600/30 border-2 border-white">
              <Plus className="w-5 h-5" />
            </div>
            <span className="text-[10px] font-bold text-slate-800">Item</span>
          </button>

          <button
            onClick={() => setIsPropertyInfoOpen(true)}
            className="flex flex-col items-center gap-0.5 text-slate-500 hover:text-brand-600"
          >
            <Building className="w-5 h-5 text-brand-600" />
            <span className="text-[10px] font-bold">Imóvel</span>
          </button>

          <button
            onClick={() => setIsPdfPreviewOpen(true)}
            className="flex flex-col items-center gap-0.5 text-slate-500 hover:text-brand-600"
          >
            <FileText className="w-5 h-5 text-brand-600" />
            <span className="text-[10px] font-bold">PDF</span>
          </button>
        </nav>
      )}

      {/* --- MODALS --- */}

      {/* Property Info Modal */}
      <PropertyInfoModal
        isOpen={isPropertyInfoOpen}
        onClose={() => setIsPropertyInfoOpen(false)}
        data={currentInspection}
        onSave={handleUpdateInspectionData}
      />

      {/* Templates Selector Modal */}
      <TemplateSelectorModal
        isOpen={isTemplatesOpen}
        onClose={() => setIsTemplatesOpen(false)}
        onSelectTemplate={handleApplyTemplate}
      />

      {/* Item Editor Modal */}
      <ItemEditorModal
        isOpen={isItemEditorOpen}
        onClose={() => setIsItemEditorOpen(false)}
        item={selectedItemForEdit}
        roomName={activeRoom?.name || 'Ambiente'}
        onSave={handleSaveItem}
        onViewPhoto={(url, caption) => setPhotoViewer({ isOpen: true, url, caption })}
      />

      {/* Fullscreen Photo Viewer */}
      <PhotoViewerModal
        isOpen={photoViewer.isOpen}
        onClose={() => setPhotoViewer((prev) => ({ ...prev, isOpen: false }))}
        photoUrl={photoViewer.url}
        caption={photoViewer.caption}
      />

      {/* PDF Preview & Download Modal */}
      <PdfPreviewModal
        isOpen={isPdfPreviewOpen}
        onClose={() => setIsPdfPreviewOpen(false)}
        data={currentInspection}
      />

      {/* Backup & Supabase Sync Modal */}
      <BackupSyncModal
        isOpen={isBackupSyncOpen}
        onClose={() => setIsBackupSyncOpen(false)}
        data={currentInspection}
        onRestoreData={async (restored) => {
          await saveInspectionToDb(restored);
          await reloadInspections();
          setCurrentInspection(restored);
          if (restored.rooms.length > 0) {
            setActiveRoomId(restored.rooms[0].id);
          }
          setCurrentView('inspection');
        }}
        supabaseConfig={supabaseConfig}
        onSaveSupabaseConfig={(cfg) => {
          setSupabaseConfig(cfg);
          saveAppProfile({ supabaseConfig: cfg });
        }}
      />

      {/* User & Team Management Modal (Manager only) */}
      <UserManagementModal
        isOpen={isUserManagementOpen}
        onClose={() => setIsUserManagementOpen(false)}
        currentSession={authSession}
      />

      {/* Add Room In-App Modal */}
      <AddRoomModal
        isOpen={isAddRoomOpen}
        onClose={() => setIsAddRoomOpen(false)}
        onAddRoom={handleCreateRoom}
      />

      {/* Confirm Delete Inspection In-App Modal */}
      <ConfirmModal
        isOpen={!!inspectionToDelete}
        onClose={() => setInspectionToDelete(null)}
        onConfirm={confirmDeleteInspection}
        title="Excluir Vistoria"
        message={`Deseja realmente excluir a vistoria "${inspectionToDelete?.title || 'esta vistoria'}"? Todos os cômodos e fotos serão removidos permanentemente.`}
        confirmText="Sim, Excluir Vistoria"
        confirmVariant="danger"
      />

      {/* Confirm Delete Room In-App Modal */}
      <ConfirmModal
        isOpen={isDeleteActiveRoomOpen}
        onClose={() => setIsDeleteActiveRoomOpen(false)}
        onConfirm={confirmDeleteActiveRoom}
        title="Excluir Ambiente"
        message={`Deseja realmente excluir o ambiente "${activeRoom?.name || 'este ambiente'}" e todos os itens e fotos contidos nele?`}
        confirmText="Sim, Excluir Ambiente"
        confirmVariant="danger"
      />

    </div>
  );
}

export default function App() {
  return (
    <ToastProvider>
      <MainApp />
    </ToastProvider>
  );
}
