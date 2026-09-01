export type ConservationStatus = 'Novo' | 'Bom' | 'Regular' | 'Ruim';

export type RepairUrgency = 'Baixa' | 'Média' | 'Alta' | 'Crítica';

export type InspectionType = 'Entrada' | 'Saída' | 'Periódica' | 'Constatação';

export interface PhotoItem {
  id: string;
  dataUrl: string; // Base64 compressed image
  timestamp: string;
  caption?: string;
}

export interface InspectionItem {
  id: string;
  name: string;
  category?: string;
  status: ConservationStatus;
  needRepair: boolean;
  repairDetails?: string;
  repairUrgency?: RepairUrgency;
  description: string;
  photos: PhotoItem[];
  notes?: string;
}

export interface Room {
  id: string;
  name: string;
  iconName?: string;
  items: InspectionItem[];
  generalNotes?: string;
}

export interface InspectionData {
  id: string;
  title: string;
  inspectionType: InspectionType;
  date: string;
  time: string;
  
  // Inspector info
  inspectorName: string;
  inspectorCpfCreci: string;
  inspectorSignature?: string; // base64 png
  
  // Tenant info
  tenantName: string;
  tenantCpf: string;
  tenantSignature?: string; // base64 png
  
  // Owner info
  ownerName: string;
  
  // Property address
  propertyAddress: string;
  propertyNumber: string;
  propertyComplement: string;
  propertyNeighborhood: string;
  propertyCity: string;
  propertyState: string;
  propertyZip: string;
  
  // Company Branding
  companyName: string;
  companyCnpj: string;
  companyPhone: string;
  companyLogo?: string; // base64
  
  // Utility meters & keys
  waterMeter?: string;
  energyMeter?: string;
  gasMeter?: string;
  keysInfo?: string;
  
  // General
  generalObservations?: string;
  useGovBrSignatures?: boolean;
  
  // Rooms and Items
  rooms: Room[];
  
  createdAt: string;
  updatedAt: string;
}

export interface QuickTemplate {
  id: string;
  name: string;
  description: string;
  icon: string;
  rooms: {
    name: string;
    items: string[];
  }[];
}

export interface SupabaseConfig {
  url: string;
  anonKey: string;
  bucketName: string;
  tableName: string;
  autoSync: boolean;
}
