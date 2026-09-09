// ==============================================================================
// VISTORIA YZZY — SERVICE: VISTORIAS, AMBIENTES E ITENS (ETAPA 03)
// ==============================================================================

import { getSupabaseClient } from './supabaseClient';
import type { 
  Inspection, 
  InspectionRoom, 
  InspectionItem, 
  InspectionType, 
  InspectionStatus, 
  ItemCondition 
} from '../types/inspection';

export interface CreateInspectionInput {
  property_id: string;
  inspection_type: InspectionType;
  title: string;
  scheduled_date?: string | null;
  inspector_id?: string | null;
  notes?: string | null;
}

export interface CreateRoomInput {
  inspection_id: string;
  name: string;
  room_type?: string | null;
  position?: number;
  notes?: string | null;
}

export interface CreateItemInput {
  room_id: string;
  inspection_id: string;
  name: string;
  item_type?: string | null;
  condition_status?: ItemCondition;
  description?: string | null;
  requires_repair?: boolean;
  repair_notes?: string | null;
  position?: number;
}

// ------------------------------------------------------------------------------
// 1. VISTORIAS (INSPECTIONS)
// ------------------------------------------------------------------------------

export async function fetchInspections(filter?: { status?: InspectionStatus; search?: string; propertyId?: string }): Promise<Inspection[]> {
  const client = getSupabaseClient();
  let query = client
    .from('inspections')
    .select(`
      *,
      property:properties (
        id,
        street,
        number,
        complement,
        neighborhood,
        city,
        state,
        internal_code,
        property_type
      )
    `)
    .order('created_at', { ascending: false });

  if (filter?.propertyId) {
    query = query.eq('property_id', filter.propertyId);
  }

  if (filter?.status) {
    query = query.eq('status', filter.status);
  }

  if (filter?.search && filter.search.trim()) {
    const term = `%${filter.search.trim()}%`;
    query = query.ilike('title', term);
  }

  const { data, error } = await query;

  if (error) {
    console.error('[ERRO fetchInspections]:', error.message);
    throw new Error(`Falha ao buscar vistorias: ${error.message}`);
  }

  return (data || []) as Inspection[];
}

export async function getInspectionWithDetails(id: string): Promise<{
  inspection: Inspection;
  rooms: (InspectionRoom & { items: InspectionItem[] })[];
}> {
  const client = getSupabaseClient();

  // 1. Buscar vistoria com imóvel
  const { data: inspectionData, error: inspError } = await client
    .from('inspections')
    .select(`
      *,
      property:properties (*)
    `)
    .eq('id', id)
    .single();

  if (inspError || !inspectionData) {
    console.error('[ERRO getInspectionWithDetails]:', inspError?.message);
    throw new Error(`Vistoria não encontrada ou sem permissão de acesso.`);
  }

  // 2. Buscar ambientes da vistoria ordenados
  const { data: roomsData, error: roomsError } = await client
    .from('inspection_rooms')
    .select('*')
    .eq('inspection_id', id)
    .order('position', { ascending: true });

  if (roomsError) {
    console.error('[ERRO roomsError]:', roomsError.message);
    throw new Error(`Falha ao buscar ambientes: ${roomsError.message}`);
  }

  // 3. Buscar itens de todos os ambientes
  const { data: itemsData, error: itemsError } = await client
    .from('inspection_items')
    .select('*')
    .eq('inspection_id', id)
    .order('position', { ascending: true });

  if (itemsError) {
    console.error('[ERRO itemsError]:', itemsError.message);
    throw new Error(`Falha ao buscar itens: ${itemsError.message}`);
  }

  const itemsByRoom: Record<string, InspectionItem[]> = {};
  ((itemsData || []) as InspectionItem[]).forEach((item: InspectionItem) => {
    const rId = item.room_id || '';
    if (!itemsByRoom[rId]) {
      itemsByRoom[rId] = [];
    }
    itemsByRoom[rId].push(item);
  });

  const assembledRooms = ((roomsData || []) as InspectionRoom[]).map((room: InspectionRoom) => ({
    ...room,
    items: itemsByRoom[room.id] || [],
    photos: room.photos || [],
  }));

  return {
    inspection: inspectionData as Inspection,
    rooms: assembledRooms,
  };
}

export async function createInspection(input: CreateInspectionInput): Promise<Inspection> {
  const client = getSupabaseClient();
  const { data, error } = await client
    .from('inspections')
    .insert({
      property_id: input.property_id,
      inspection_type: input.inspection_type,
      title: input.title.trim(),
      status: 'DRAFT',
      scheduled_date: input.scheduled_date || null,
      inspector_id: input.inspector_id || null,
      notes: input.notes ? input.notes.trim() : null,
    })
    .select(`
      *,
      property:properties (*)
    `)
    .single();

  if (error) {
    console.error('[ERRO createInspection]:', error.message);
    throw new Error(`Erro ao criar vistoria: ${error.message}`);
  }

  return data as Inspection;
}

export async function updateInspection(
  id: string, 
  updates: Partial<Inspection>, 
  expectedUpdatedAt?: string
): Promise<Inspection> {
  const client = getSupabaseClient();

  // Verificação otimista de concorrência se expectedUpdatedAt foi fornecido
  if (expectedUpdatedAt) {
    const { data: current } = await client
      .from('inspections')
      .select('updated_at')
      .eq('id', id)
      .single();

    if (current && new Date(current.updated_at).getTime() > new Date(expectedUpdatedAt).getTime()) {
      throw new Error('CONCURRENCY_CONFLICT: A vistoria foi modificada por outro usuário. Recarregue a página antes de salvar.');
    }
  }

  const { data, error } = await client
    .from('inspections')
    .update({
      ...updates,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .select()
    .single();

  if (error) {
    console.error('[ERRO updateInspection]:', error.message);
    throw new Error(`Erro ao atualizar vistoria: ${error.message}`);
  }

  return data as Inspection;
}

export async function finalizeInspection(id: string): Promise<{ success: boolean; status: string }> {
  const client = getSupabaseClient();
  const { data, error } = await client.rpc('finalize_inspection', {
    p_inspection_id: id,
  });

  if (error) {
    console.error('[ERRO finalizeInspection]:', error.message);
    throw new Error(`Falha ao finalizar vistoria: ${error.message}`);
  }

  return data as { success: boolean; status: string };
}

export async function reopenInspection(id: string): Promise<{ success: boolean; status: string }> {
  const client = getSupabaseClient();
  const { data, error } = await client.rpc('reopen_inspection', {
    p_inspection_id: id,
  });

  if (error) {
    console.error('[ERRO reopenInspection]:', error.message);
    throw new Error(`Falha ao reabrir vistoria: ${error.message}`);
  }

  return data as { success: boolean; status: string };
}

export async function archiveInspection(id: string): Promise<{ success: boolean; status: string }> {
  const client = getSupabaseClient();
  const { data, error } = await client.rpc('archive_inspection', {
    p_inspection_id: id,
  });

  if (error) {
    console.error('[ERRO archiveInspection]:', error.message);
    throw new Error(`Falha ao arquivar vistoria: ${error.message}`);
  }

  return data as { success: boolean; status: string };
}

// ------------------------------------------------------------------------------
// 2. AMBIENTES (INSPECTION ROOMS)
// ------------------------------------------------------------------------------

export async function addRoom(input: CreateRoomInput): Promise<InspectionRoom> {
  const client = getSupabaseClient();
  const { data, error } = await client
    .from('inspection_rooms')
    .insert({
      inspection_id: input.inspection_id,
      name: input.name.trim(),
      room_type: input.room_type || null,
      position: input.position || 1,
      notes: input.notes ? input.notes.trim() : null,
    })
    .select()
    .single();

  if (error) {
    console.error('[ERRO addRoom]:', error.message);
    throw new Error(`Erro ao adicionar ambiente: ${error.message}`);
  }

  return { ...(data as InspectionRoom), items: [], photos: [] };
}

export async function updateRoom(roomId: string, updates: Partial<InspectionRoom>): Promise<InspectionRoom> {
  const client = getSupabaseClient();
  const { data, error } = await client
    .from('inspection_rooms')
    .update({
      ...updates,
      updated_at: new Date().toISOString(),
    })
    .eq('id', roomId)
    .select()
    .single();

  if (error) {
    console.error('[ERRO updateRoom]:', error.message);
    throw new Error(`Erro ao atualizar ambiente: ${error.message}`);
  }

  return data as InspectionRoom;
}

export async function deleteRoom(roomId: string): Promise<boolean> {
  const client = getSupabaseClient();
  const { error } = await client
    .from('inspection_rooms')
    .delete()
    .eq('id', roomId);

  if (error) {
    console.error('[ERRO deleteRoom]:', error.message);
    throw new Error(`Erro ao remover ambiente: ${error.message}`);
  }

  return true;
}

// ------------------------------------------------------------------------------
// 3. ITENS DO AMBIENTE (INSPECTION ITEMS)
// ------------------------------------------------------------------------------

export async function addItem(input: CreateItemInput): Promise<InspectionItem> {
  const client = getSupabaseClient();
  const { data, error } = await client
    .from('inspection_items')
    .insert({
      room_id: input.room_id,
      inspection_id: input.inspection_id,
      name: input.name.trim(),
      item_type: input.item_type || null,
      condition_status: input.condition_status || 'GOOD',
      description: input.description ? input.description.trim() : null,
      requires_repair: Boolean(input.requires_repair),
      repair_notes: input.repair_notes ? input.repair_notes.trim() : null,
      position: input.position || 1,
    })
    .select()
    .single();

  if (error) {
    console.error('[ERRO addItem]:', error.message);
    throw new Error(`Erro ao adicionar item: ${error.message}`);
  }

  return { ...(data as InspectionItem), photos: (data as InspectionItem).photos || [] };
}

export async function updateItem(
  itemId: string, 
  updates: Partial<InspectionItem>, 
  expectedUpdatedAt?: string
): Promise<InspectionItem> {
  const client = getSupabaseClient();

  // Controle otimista de concorrência para autosave
  if (expectedUpdatedAt) {
    const { data: current } = await client
      .from('inspection_items')
      .select('updated_at')
      .eq('id', itemId)
      .single();

    if (current && new Date(current.updated_at).getTime() > new Date(expectedUpdatedAt).getTime()) {
      throw new Error('CONCURRENCY_CONFLICT: Este item foi modificado em outra sessão. Recarregue os dados para evitar perda de alterações.');
    }
  }

  const { data, error } = await client
    .from('inspection_items')
    .update({
      ...updates,
      updated_at: new Date().toISOString(),
    })
    .eq('id', itemId)
    .select()
    .single();

  if (error) {
    console.error('[ERRO updateItem]:', error.message);
    throw new Error(`Erro ao atualizar item: ${error.message}`);
  }

  return data as InspectionItem;
}

export async function deleteItem(itemId: string): Promise<boolean> {
  const client = getSupabaseClient();
  const { error } = await client
    .from('inspection_items')
    .delete()
    .eq('id', itemId);

  if (error) {
    console.error('[ERRO deleteItem]:', error.message);
    throw new Error(`Erro ao excluir item: ${error.message}`);
  }

  return true;
}
