import { useState, useEffect } from 'react';
import { 
  Plus, 
  FileText, 
  Building, 
  PenTool
} from 'lucide-react';
import type { 
  InspectionData, 
  Room, 
  InspectionItem, 
  QuickTemplate,
  SupabaseConfig 
} from './types/inspection';
import { INSPECTION_TEMPLATES } from './data/templates';
import { 
  saveInspectionToDb, 
  getAllInspectionsFromDb, 
  getAppProfile, 
  saveAppProfile 
} from './services/db';

// Components
import { ToastProvider, useToast } from './components/Toast';
import { Navbar } from './components/Navbar';
import { PropertyHeaderCard } from './components/PropertyHeaderCard';
import { RoomList } from './components/RoomList';
import { RoomDetail } from './components/RoomDetail';
import { PropertyInfoModal } from './components/PropertyInfoModal';
import { TemplateSelectorModal } from './components/TemplateSelectorModal';
import { ItemEditorModal } from './components/ItemEditorModal';
import { PhotoViewerModal } from './components/PhotoViewerModal';
import { SignatureModal } from './components/SignatureModal';
import { PdfPreviewModal } from './components/PdfPreviewModal';
import { BackupSyncModal } from './components/BackupSyncModal';

const createDefaultInspection = (): InspectionData => {
  const defaultTemplate = INSPECTION_TEMPLATES[0]; // Apartamento Padrão
  const rooms: Room[] = defaultTemplate.rooms.map((r, rIdx) => ({
    id: `room-${rIdx + 1}`,
    name: r.name,
    items: r.items.map((itemName, iIdx) => ({
      id: `item-${rIdx + 1}-${iIdx + 1}`,
      name: itemName,
      status: 'Bom',
      description: '',
      needRepair: false,
      photos: [],
    })),
  }));

  const today = new Date().toISOString().split('T')[0];
  const currentTime = new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

  return {
    id: `insp-${Date.now()}`,
    title: 'Vistoria de Entrada - Imóvel Residencial',
    inspectionType: 'Entrada',
    date: today,
    time: currentTime,
    inspectorName: 'Carlos Mendonça',
    inspectorCpfCreci: 'CRECI 45.892-F',
    tenantName: 'Mariana Silva Souza',
    tenantCpf: '321.654.987-00',
    ownerName: 'Roberto Albuquerque',
    propertyAddress: 'Rua das Palmeiras',
    propertyNumber: '450',
    propertyComplement: 'Apto 102 Bloco B',
    propertyNeighborhood: 'Jardins',
    propertyCity: 'São Paulo',
    propertyState: 'SP',
    propertyZip: '01423-001',
    companyName: 'Imobiliária Alpha Prime',
    companyCnpj: '12.345.678/0001-90',
    companyPhone: '(11) 3254-8800',
    waterMeter: '00412 m³',
    energyMeter: '13840 kWh',
    gasMeter: '0092 m³',
    keysInfo: '02 chaves da porta principal e 01 controle da garagem',
    generalObservations: 'O locatário declara estar de acordo com o estado do imóvel registrado neste laudo fotográfico.',
    useGovBrSignatures: false,
    rooms,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
};

function MainApp() {
  const { showToast } = useToast();

  const [inspection, setInspection] = useState<InspectionData>(createDefaultInspection);
  const [activeRoomId, setActiveRoomId] = useState<string>('');
  const [supabaseConfig, setSupabaseConfig] = useState<SupabaseConfig | undefined>();

  // Modals state
  const [isPropertyInfoOpen, setIsPropertyInfoOpen] = useState(false);
  const [isTemplatesOpen, setIsTemplatesOpen] = useState(false);
  const [isSignaturesOpen, setIsSignaturesOpen] = useState(false);
  const [isPdfPreviewOpen, setIsPdfPreviewOpen] = useState(false);
  const [isBackupSyncOpen, setIsBackupSyncOpen] = useState(false);
  const [isItemEditorOpen, setIsItemEditorOpen] = useState(false);
  const [selectedItemForEdit, setSelectedItemForEdit] = useState<InspectionItem | null>(null);

  // Photo viewer state
  const [photoViewer, setPhotoViewer] = useState<{ isOpen: boolean; url: string; caption?: string }>({
    isOpen: false,
    url: '',
    caption: '',
  });

  // Load from IndexedDB on initial mount
  useEffect(() => {
    async function loadData() {
      try {
        const profile = await getAppProfile();
        if (profile?.supabaseConfig) {
          setSupabaseConfig(profile.supabaseConfig);
        }

        const list = await getAllInspectionsFromDb();
        if (list.length > 0) {
          setInspection(list[0]);
          if (list[0].rooms.length > 0) {
            setActiveRoomId(list[0].rooms[0].id);
          }
        } else {
          const initial = createDefaultInspection();
          if (profile) {
            if (profile.companyName) initial.companyName = profile.companyName;
            if (profile.companyCnpj) initial.companyCnpj = profile.companyCnpj;
            if (profile.companyPhone) initial.companyPhone = profile.companyPhone;
            if (profile.companyLogo) initial.companyLogo = profile.companyLogo;
            if (profile.defaultInspectorName) initial.inspectorName = profile.defaultInspectorName;
            if (profile.defaultInspectorCpfCreci) initial.inspectorCpfCreci = profile.defaultInspectorCpfCreci;
          }
          setInspection(initial);
          if (initial.rooms.length > 0) {
            setActiveRoomId(initial.rooms[0].id);
          }
          await saveInspectionToDb(initial);
        }
      } catch (err) {
        console.error('Error loading IndexedDB data', err);
      }
    }

    loadData();
  }, []);

  // Set active room if not set
  useEffect(() => {
    if (!activeRoomId && inspection.rooms.length > 0) {
      setActiveRoomId(inspection.rooms[0].id);
    }
  }, [activeRoomId, inspection.rooms]);

  // Auto-save to IndexedDB with debounce
  useEffect(() => {
    const timer = setTimeout(() => {
      saveInspectionToDb(inspection).catch((e) => console.warn('Autosave error', e));
    }, 400);

    return () => clearTimeout(timer);
  }, [inspection]);

  // Handlers
  const handleUpdateInspectionData = (partial: Partial<InspectionData>) => {
    setInspection((prev) => {
      const updated = { ...prev, ...partial, updatedAt: new Date().toISOString() };
      
      // Also update saved profile defaults for future use
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

    setInspection((prev) => ({
      ...prev,
      rooms: newRooms,
      updatedAt: new Date().toISOString(),
    }));

    if (newRooms.length > 0) {
      setActiveRoomId(newRooms[0].id);
    }

    showToast(`Modelo "${template.name}" aplicado com ${newRooms.length} cômodos!`, 'success');
  };

  const handleAddRoom = () => {
    const roomName = window.prompt('Digite o nome do novo ambiente (Ex: Varanda Gourmet, Lavabo, Garagem):');
    if (!roomName || !roomName.trim()) return;

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

    setInspection((prev) => ({
      ...prev,
      rooms: [...prev.rooms, newRoom],
      updatedAt: new Date().toISOString(),
    }));

    setActiveRoomId(newRoom.id);
    showToast(`Ambiente "${roomName.trim()}" criado com sucesso!`, 'success');
  };

  const handleUpdateActiveRoom = (updatedRoom: Room) => {
    setInspection((prev) => ({
      ...prev,
      rooms: prev.rooms.map((r) => (r.id === updatedRoom.id ? updatedRoom : r)),
      updatedAt: new Date().toISOString(),
    }));
  };

  const handleDeleteActiveRoom = () => {
    if (inspection.rooms.length <= 1) {
      showToast('A vistoria precisa conter pelo menos um ambiente.', 'error');
      return;
    }

    const currentRoom = inspection.rooms.find((r) => r.id === activeRoomId);
    if (window.confirm(`Deseja realmente excluir o ambiente "${currentRoom?.name}" e todos os seus itens?`)) {
      const remainingRooms = inspection.rooms.filter((r) => r.id !== activeRoomId);
      setInspection((prev) => ({
        ...prev,
        rooms: remainingRooms,
        updatedAt: new Date().toISOString(),
      }));
      setActiveRoomId(remainingRooms[0]?.id || '');
      showToast('Ambiente excluído.', 'info');
    }
  };

  const handleOpenItemEditor = (itemToEdit: InspectionItem | null) => {
    setSelectedItemForEdit(itemToEdit);
    setIsItemEditorOpen(true);
  };

  const handleSaveItem = (savedItem: InspectionItem) => {
    setInspection((prev) => {
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

  const handleNewInspection = () => {
    if (window.confirm('Deseja iniciar uma nova vistoria? Os dados atuais serão substituídos.')) {
      const fresh = createDefaultInspection();
      setInspection(fresh);
      setActiveRoomId(fresh.rooms[0]?.id || '');
      showToast('Nova vistoria iniciada!', 'success');
    }
  };

  const handleSaveSignatures = (signatures: {
    inspectorSignature?: string;
    tenantSignature?: string;
    useGovBrSignatures?: boolean;
  }) => {
    setInspection((prev) => ({
      ...prev,
      ...signatures,
      updatedAt: new Date().toISOString(),
    }));
  };

  const activeRoom = inspection.rooms.find((r) => r.id === activeRoomId) || inspection.rooms[0];
  const totalPhotosCount = inspection.rooms.reduce(
    (acc, r) => acc + r.items.reduce((iAcc, item) => iAcc + item.photos.length, 0),
    0
  );

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-brand-500 selection:text-white pb-24 md:pb-8">
      
      {/* 1. Corporate Navbar */}
      <Navbar
        inspectionType={inspection.inspectionType}
        onNewInspection={handleNewInspection}
        onOpenTemplates={() => setIsTemplatesOpen(true)}
        onOpenPropertyInfo={() => setIsPropertyInfoOpen(true)}
        onOpenSignatures={() => setIsSignaturesOpen(true)}
        onOpenBackupSync={() => setIsBackupSyncOpen(true)}
        onGeneratePdf={() => setIsPdfPreviewOpen(true)}
        isGeneratingPdf={false}
        totalPhotos={totalPhotosCount}
      />

      {/* 2. Main Content Container */}
      <main className="max-w-7xl mx-auto px-3 sm:px-6 py-4 flex-1 w-full">
        
        {/* Property Header Summary Card */}
        <PropertyHeaderCard
          data={inspection}
          onEdit={() => setIsPropertyInfoOpen(true)}
        />

        {/* Room Navigation Tabs */}
        <RoomList
          rooms={inspection.rooms}
          activeRoomId={activeRoomId}
          onSelectRoom={(id) => setActiveRoomId(id)}
          onAddRoom={handleAddRoom}
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
          <div className="p-12 text-center text-slate-500">
            Nenhum cômodo selecionado.
          </div>
        )}

      </main>

      {/* 3. Mobile Bottom Action Bar (Fixed on Small Screens) */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-30 bg-slate-900/95 backdrop-blur-md border-t border-slate-800 px-4 py-2 safe-bottom shadow-2xl flex items-center justify-around">
        <button
          onClick={() => setIsPropertyInfoOpen(true)}
          className="flex flex-col items-center gap-0.5 text-slate-400 hover:text-white"
        >
          <Building className="w-5 h-5 text-sky-400" />
          <span className="text-[10px] font-semibold">Imóvel</span>
        </button>

        <button
          onClick={() => handleOpenItemEditor(null)}
          className="flex flex-col items-center gap-0.5 text-slate-400 hover:text-brand-400"
        >
          <div className="w-10 h-10 rounded-full bg-brand-600 flex items-center justify-center text-white -mt-5 shadow-lg shadow-brand-600/40 border-2 border-slate-950">
            <Plus className="w-5 h-5" />
          </div>
          <span className="text-[10px] font-bold text-white">Item</span>
        </button>

        <button
          onClick={() => setIsSignaturesOpen(true)}
          className="flex flex-col items-center gap-0.5 text-slate-400 hover:text-white"
        >
          <PenTool className="w-5 h-5 text-emerald-400" />
          <span className="text-[10px] font-semibold">Assinar</span>
        </button>

        <button
          onClick={() => setIsPdfPreviewOpen(true)}
          className="flex flex-col items-center gap-0.5 text-slate-400 hover:text-white"
        >
          <FileText className="w-5 h-5 text-brand-400" />
          <span className="text-[10px] font-semibold">Laudo PDF</span>
        </button>
      </nav>

      {/* --- MODALS --- */}

      {/* Property Info Modal */}
      <PropertyInfoModal
        isOpen={isPropertyInfoOpen}
        onClose={() => setIsPropertyInfoOpen(false)}
        data={inspection}
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

      {/* Signatures Modal */}
      <SignatureModal
        isOpen={isSignaturesOpen}
        onClose={() => setIsSignaturesOpen(false)}
        inspectorName={inspection.inspectorName}
        tenantName={inspection.tenantName}
        inspectorSignature={inspection.inspectorSignature}
        tenantSignature={inspection.tenantSignature}
        useGovBrSignatures={inspection.useGovBrSignatures}
        onSave={handleSaveSignatures}
      />

      {/* PDF Preview & Download Modal */}
      <PdfPreviewModal
        isOpen={isPdfPreviewOpen}
        onClose={() => setIsPdfPreviewOpen(false)}
        data={inspection}
      />

      {/* Backup & Supabase Sync Modal */}
      <BackupSyncModal
        isOpen={isBackupSyncOpen}
        onClose={() => setIsBackupSyncOpen(false)}
        data={inspection}
        onRestoreData={(restored) => {
          setInspection(restored);
          if (restored.rooms.length > 0) {
            setActiveRoomId(restored.rooms[0].id);
          }
        }}
        supabaseConfig={supabaseConfig}
        onSaveSupabaseConfig={(cfg) => {
          setSupabaseConfig(cfg);
          saveAppProfile({ supabaseConfig: cfg });
        }}
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
