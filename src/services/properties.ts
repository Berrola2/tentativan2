// ==============================================================================
// VISTORIA YZZY — SERVICE: IMÓVEIS (ETAPA 03)
// ==============================================================================

import { getSupabaseClient } from './supabaseClient';
import type { Property } from '../types/inspection';

export interface CreatePropertyInput {
  internal_code?: string | null;
  property_type: Property['property_type'];
  street: string;
  number?: string | null;
  complement?: string | null;
  neighborhood?: string | null;
  city: string;
  state: string;
  postal_code?: string | null;
  notes?: string | null;
}

export async function fetchProperties(searchTerm?: string): Promise<Property[]> {
  const client = getSupabaseClient();
  let query = client
    .from('properties')
    .select('*')
    .order('created_at', { ascending: false });

  if (searchTerm && searchTerm.trim()) {
    const term = `%${searchTerm.trim()}%`;
    query = query.or(`street.ilike.${term},city.ilike.${term},neighborhood.ilike.${term},internal_code.ilike.${term}`);
  }

  const { data, error } = await query;

  if (error) {
    console.error('[ERRO fetchProperties]:', error.message);
    throw new Error(`Falha ao buscar imóveis: ${error.message}`);
  }

  return (data || []) as Property[];
}

export async function getPropertyById(id: string): Promise<Property | null> {
  const client = getSupabaseClient();
  const { data, error } = await client
    .from('properties')
    .select('*')
    .eq('id', id)
    .maybeSingle();

  if (error) {
    console.error('[ERRO getPropertyById]:', error.message);
    throw new Error(`Falha ao buscar imóvel: ${error.message}`);
  }

  return data as Property | null;
}

export async function createProperty(input: CreatePropertyInput): Promise<Property> {
  const client = getSupabaseClient();
  const { data, error } = await client
    .from('properties')
    .insert({
      internal_code: input.internal_code ? input.internal_code.trim() : null,
      property_type: input.property_type,
      street: input.street.trim(),
      number: input.number ? input.number.trim() : null,
      complement: input.complement ? input.complement.trim() : null,
      neighborhood: input.neighborhood ? input.neighborhood.trim() : null,
      city: input.city.trim(),
      state: input.state.trim().toUpperCase(),
      postal_code: input.postal_code ? input.postal_code.trim() : null,
      notes: input.notes ? input.notes.trim() : null,
      active: true,
    })
    .select()
    .single();

  if (error) {
    console.error('[ERRO createProperty]:', error.message);
    throw new Error(`Erro ao cadastrar imóvel: ${error.message}`);
  }

  return data as Property;
}

export async function updateProperty(id: string, updates: Partial<CreatePropertyInput>): Promise<Property> {
  const client = getSupabaseClient();
  const { data, error } = await client
    .from('properties')
    .update({
      ...updates,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .select()
    .single();

  if (error) {
    console.error('[ERRO updateProperty]:', error.message);
    throw new Error(`Erro ao atualizar imóvel: ${error.message}`);
  }

  return data as Property;
}

export async function togglePropertyActive(id: string, active: boolean): Promise<boolean> {
  const client = getSupabaseClient();
  const { error } = await client
    .from('properties')
    .update({ active, updated_at: new Date().toISOString() })
    .eq('id', id);

  if (error) {
    console.error('[ERRO togglePropertyActive]:', error.message);
    throw new Error(`Erro ao alterar status do imóvel: ${error.message}`);
  }

  return true;
}
