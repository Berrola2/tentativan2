import Dexie, { type Table } from 'dexie';
import type { InspectionData, SupabaseConfig } from '../types/inspection';

export interface AppProfile {
  id: string; // 'default'
  companyName: string;
  companyCnpj: string;
  companyPhone: string;
  companyLogo?: string;
  defaultInspectorName: string;
  defaultInspectorCpfCreci: string;
  supabaseConfig?: SupabaseConfig;
  updatedAt: string;
}

export class VistoriaDatabase extends Dexie {
  inspections!: Table<InspectionData, string>;
  profile!: Table<AppProfile, string>;

  constructor() {
    super('VistoriaProDB');
    this.version(1).stores({
      inspections: 'id, title, inspectionType, date, createdAt, updatedAt',
      profile: 'id, companyName',
    });
  }
}

export const db = new VistoriaDatabase();

// Helpers
export async function saveInspectionToDb(inspection: InspectionData): Promise<void> {
  const updatedInspection = {
    ...inspection,
    updatedAt: new Date().toISOString(),
  };
  await db.inspections.put(updatedInspection);
}

export async function getInspectionFromDb(id: string): Promise<InspectionData | undefined> {
  return await db.inspections.get(id);
}

export async function getAllInspectionsFromDb(): Promise<InspectionData[]> {
  return await db.inspections.orderBy('updatedAt').reverse().toArray();
}

export async function deleteInspectionFromDb(id: string): Promise<void> {
  await db.inspections.delete(id);
}

export async function getAppProfile(): Promise<AppProfile | undefined> {
  return await db.profile.get('default');
}

export async function saveAppProfile(profile: Partial<AppProfile>): Promise<void> {
  const existing = await getAppProfile();
  const updated: AppProfile = {
    id: 'default',
    companyName: profile.companyName ?? existing?.companyName ?? '',
    companyCnpj: profile.companyCnpj ?? existing?.companyCnpj ?? '',
    companyPhone: profile.companyPhone ?? existing?.companyPhone ?? '',
    companyLogo: profile.companyLogo ?? existing?.companyLogo ?? '',
    defaultInspectorName: profile.defaultInspectorName ?? existing?.defaultInspectorName ?? '',
    defaultInspectorCpfCreci: profile.defaultInspectorCpfCreci ?? existing?.defaultInspectorCpfCreci ?? '',
    supabaseConfig: profile.supabaseConfig ?? existing?.supabaseConfig,
    updatedAt: new Date().toISOString(),
  };
  await db.profile.put(updated);
}
