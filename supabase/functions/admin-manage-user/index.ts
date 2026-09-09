// ==============================================================================
// SUPABASE EDGE FUNCTION: admin-manage-user (ETAPA 02.1 — HARDENING COMPLETO)
// ==============================================================================
// Gestão de empresas, primeiro gerente e funcionários com derivação estrita de Tenant
// ==============================================================================

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.112.4';

const ALLOWED_ORIGINS = new Set([
  'https://vistoriayzzy.vercel.app',
  'https://tentativan2.vercel.app',
  'http://localhost:5173',
  'http://127.0.0.1:5173',
  'http://localhost:3000',
  'http://127.0.0.1:3000',
]);

function getCorsHeaders(requestOrigin: string | null): Record<string, string> {
  let allowedOrigin = 'https://vistoriayzzy.vercel.app';
  if (requestOrigin) {
    if (
      ALLOWED_ORIGINS.has(requestOrigin) ||
      /^https:\/\/vistoriayzzy(-[a-z0-9-]+)?\.vercel\.app$/.test(requestOrigin) ||
      /^https:\/\/tentativan2(-[a-z0-9-]+)?\.vercel\.app$/.test(requestOrigin)
    ) {
      allowedOrigin = requestOrigin;
    }
  }

  return {
    'Access-Control-Allow-Origin': allowedOrigin,
    'Access-Control-Allow-Methods': 'POST, OPTIONS, GET',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-version, x-requested-with, accept, origin, pragma, cache-control',
    'Access-Control-Max-Age': '86400',
    'Vary': 'Origin',
  };
}

function normalizeText(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]/g, '');
}

function generateTempPassword(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789!@#$%&*';
  const array = new Uint8Array(12);
  crypto.getRandomValues(array);
  let pass = 'Yz#';
  for (let i = 0; i < 9; i++) {
    pass += chars[array[i] % chars.length];
  }
  return pass;
}

serve(async (req: Request) => {
  const requestOrigin = req.headers.get('origin');
  const cors = getCorsHeaders(requestOrigin);

  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: cors });
  }

  if (req.method !== 'POST') {
    return new Response(
      JSON.stringify({ success: false, error: 'Método não permitido.' }),
      { status: 405, headers: { ...cors, 'Content-Type': 'application/json' } }
    );
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!supabaseUrl || !serviceRoleKey) {
      return new Response(
        JSON.stringify({ success: false, error: 'Erro de configuração do servidor.' }),
        { status: 500, headers: { ...cors, 'Content-Type': 'application/json' } }
      );
    }

    const authHeader = req.headers.get('Authorization') || '';
    const token = authHeader.replace(/^Bearer\s+/i, '');

    if (!token) {
      return new Response(
        JSON.stringify({ success: false, error: 'Token de autenticação não fornecido.' }),
        { status: 401, headers: { ...cors, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // 1. Identificar usuário autenticado e suas permissões
    const { data: { user: callerUser }, error: callerAuthErr } = await supabaseAdmin.auth.getUser(token);

    if (callerAuthErr || !callerUser) {
      return new Response(
        JSON.stringify({ success: false, error: 'Sessão inválida ou expirada.' }),
        { status: 401, headers: { ...cors, 'Content-Type': 'application/json' } }
      );
    }

    const { data: callerProfile, error: callerProfErr } = await supabaseAdmin
      .from('profiles')
      .select('id, company_id, role, active')
      .eq('id', callerUser.id)
      .single();

    if (callerProfErr || !callerProfile || !callerProfile.active) {
      return new Response(
        JSON.stringify({ success: false, error: 'Usuário sem permissão ou inativo.' }),
        { status: 403, headers: { ...cors, 'Content-Type': 'application/json' } }
      );
    }

    const isSuperAdmin = callerProfile.role === 'ROLE_SUPER_ADMIN';
    const isCompanyManager = callerProfile.role === 'ROLE_MANAGER';

    if (!isSuperAdmin && !isCompanyManager) {
      return new Response(
        JSON.stringify({ success: false, error: 'Acesso negado. Apenas administradores e gerentes podem realizar esta operação.' }),
        { status: 403, headers: { ...cors, 'Content-Type': 'application/json' } }
      );
    }

    const body = await req.json();
    const { action } = body;

    // =========================================================================
    // AÇÃO 1: SUPER_ADMIN — Criar nova empresa e primeiro gerente
    // =========================================================================
    if (action === 'create_company') {
      if (!isSuperAdmin) {
        return new Response(
          JSON.stringify({ success: false, error: 'Apenas Super Admins podem criar novas empresas.' }),
          { status: 403, headers: { ...cors, 'Content-Type': 'application/json' } }
        );
      }

      const { name, slug, cnpj, phone, email, maxUsers, maxProperties, maxInspectionsMonth, managerFirstName, managerLastName } = body;

      if (!name || !slug) {
        return new Response(
          JSON.stringify({ success: false, error: 'Nome e slug da empresa são obrigatórios.' }),
          { status: 400, headers: { ...cors, 'Content-Type': 'application/json' } }
        );
      }

      const cleanSlug = normalizeText(slug);

      // Inserir empresa
      const { data: newCompany, error: compErr } = await supabaseAdmin
        .from('companies')
        .insert({
          name: name.trim(),
          slug: cleanSlug,
          cnpj: cnpj?.trim() || null,
          phone: phone?.trim() || null,
          email: email?.trim() || null,
          max_users: maxUsers || 10,
          max_properties: maxProperties || 100,
          max_inspections_month: maxInspectionsMonth || 50,
          active: true,
        })
        .select()
        .single();

      if (compErr || !newCompany) {
        return new Response(
          JSON.stringify({ success: false, error: `Erro ao criar empresa: ${compErr?.message || 'Erro desconhecido'}` }),
          { status: 400, headers: { ...cors, 'Content-Type': 'application/json' } }
        );
      }

      let managerInfo = null;

      // Criar primeiro gerente caso informado
      if (managerFirstName && managerLastName) {
        const normFirst = normalizeText(managerFirstName);
        const normLast = normalizeText(managerLastName);
        const loginAlias = `${normFirst}.${normLast}@${cleanSlug}.yzzy`;
        const tempPassword = generateTempPassword();
        const authEmail = `mgr_${newCompany.id.replace(/-/g, '')}@auth.yzzy.internal`;

        const { data: authCreated, error: authErr } = await supabaseAdmin.auth.admin.createUser({
          email: authEmail,
          password: tempPassword,
          email_confirm: true,
          user_metadata: { full_name: `${managerFirstName} ${managerLastName}` },
        });

        if (!authErr && authCreated?.user) {
          const managerId = authCreated.user.id;
          await supabaseAdmin.from('profiles').insert({
            id: managerId,
            company_id: newCompany.id,
            first_name: managerFirstName.trim(),
            last_name: managerLastName.trim(),
            display_name: `${managerFirstName.trim()} ${managerLastName.trim()}`,
            username: `${normFirst}.${normLast}`,
            role: 'ROLE_MANAGER',
            active: true,
            must_change_password: true,
          });

          await supabaseAdmin.schema('private').from('user_auth_identities').insert({
            user_id: managerId,
            company_id: newCompany.id,
            login_alias: loginAlias,
            auth_email: authEmail,
          });

          managerInfo = {
            loginAlias,
            tempPassword,
            fullName: `${managerFirstName.trim()} ${managerLastName.trim()}`,
          };
        }
      }

      return new Response(
        JSON.stringify({ success: true, company: newCompany, manager: managerInfo }),
        { status: 200, headers: { ...cors, 'Content-Type': 'application/json' } }
      );
    }

    // =========================================================================
    // AÇÃO 2: COMPANY_MANAGER / SUPER_ADMIN — Cadastrar funcionário
    // =========================================================================
    if (action === 'create_employee') {
      const targetCompanyId = isSuperAdmin ? body.companyId : callerProfile.company_id;

      if (!targetCompanyId) {
        return new Response(
          JSON.stringify({ success: false, error: 'Empresa de destino não identificada.' }),
          { status: 400, headers: { ...cors, 'Content-Type': 'application/json' } }
        );
      }

      // Validar limites da empresa (max_users)
      const { data: comp } = await supabaseAdmin
        .from('companies')
        .select('id, name, slug, max_users, active')
        .eq('id', targetCompanyId)
        .single();

      if (!comp || !comp.active) {
        return new Response(
          JSON.stringify({ success: false, error: 'Empresa inativa ou inexistente.' }),
          { status: 400, headers: { ...cors, 'Content-Type': 'application/json' } }
        );
      }

      const { count: currentUsersCount } = await supabaseAdmin
        .from('profiles')
        .select('id', { count: 'exact', head: true })
        .eq('company_id', targetCompanyId);

      if (currentUsersCount !== null && currentUsersCount >= comp.max_users) {
        return new Response(
          JSON.stringify({ 
            success: false, 
            error: `Limite de usuários atingido para esta empresa (${comp.max_users} usuários). Faça upgrade do plano para continuar.` 
          }),
          { status: 403, headers: { ...cors, 'Content-Type': 'application/json' } }
        );
      }

      const { firstName, lastName, role } = body;

      if (!firstName || !lastName) {
        return new Response(
          JSON.stringify({ success: false, error: 'Nome e sobrenome são obrigatórios.' }),
          { status: 400, headers: { ...cors, 'Content-Type': 'application/json' } }
        );
      }

      // Se o criador for Gerente, só pode criar Vistoriador ou Visualizador
      let targetRole = role || 'ROLE_INSPECTOR';
      if (!isSuperAdmin) {
        if (targetRole !== 'ROLE_INSPECTOR' && targetRole !== 'ROLE_VIEWER') {
          targetRole = 'ROLE_INSPECTOR';
        }
      }

      const normFirst = normalizeText(firstName || 'usuario');
      const normLast = normalizeText(lastName || 'teste');
      const baseAlias = `${normFirst}.${normLast}@${comp.slug}.yzzy`;

      // Tratamento determinístico de colisão de Login YZZY com retry
      let finalLoginAlias = baseAlias;
      let counter = 2;

      while (counter < 100) {
        const { data: exists } = await supabaseAdmin
          .schema('private')
          .from('user_auth_identities')
          .select('id')
          .eq('login_alias', finalLoginAlias)
          .maybeSingle();

        if (!exists) break;
        finalLoginAlias = `${normFirst}.${normLast}${counter}@${comp.slug}.yzzy`;
        counter++;
      }

      const tempPassword = generateTempPassword();
      const internalAuthEmail = `usr_${crypto.randomUUID().replace(/-/g, '')}@auth.yzzy.internal`;
      const fullName = `${firstName.trim()} ${lastName.trim()}`;

      // Criar no Supabase Auth
      const { data: authUser, error: authErr } = await supabaseAdmin.auth.admin.createUser({
        email: internalAuthEmail,
        password: tempPassword,
        email_confirm: true,
        user_metadata: { full_name: fullName },
      });

      if (authErr || !authUser?.user) {
        return new Response(
          JSON.stringify({ success: false, error: `Erro no Supabase Auth: ${authErr?.message}` }),
          { status: 400, headers: { ...cors, 'Content-Type': 'application/json' } }
        );
      }

      const newUserId = authUser.user.id;

      // Inserir Profile
      const { error: profErr } = await supabaseAdmin.from('profiles').insert({
        id: newUserId,
        company_id: targetCompanyId,
        first_name: firstName.trim(),
        last_name: lastName.trim(),
        display_name: fullName,
        username: finalLoginAlias.split('@')[0],
        role: targetRole,
        active: true,
        must_change_password: true,
      });

      if (profErr) {
        await supabaseAdmin.auth.admin.deleteUser(newUserId);
        return new Response(
          JSON.stringify({ success: false, error: `Erro ao criar perfil: ${profErr.message}` }),
          { status: 500, headers: { ...cors, 'Content-Type': 'application/json' } }
        );
      }

      // Inserir Identidade
      await supabaseAdmin.schema('private').from('user_auth_identities').insert({
        user_id: newUserId,
        company_id: targetCompanyId,
        login_alias: finalLoginAlias,
        auth_email: internalAuthEmail,
      });

      // Log de Auditoria
      await supabaseAdmin.from('security_audit_logs').insert({
        company_id: targetCompanyId,
        user_id: callerUser.id,
        event_type: 'USER_CREATED',
        metadata: { created_user_id: newUserId, login_alias: finalLoginAlias, role: targetRole },
      });

      return new Response(
        JSON.stringify({
          success: true,
          loginAlias: finalLoginAlias,
          tempPassword,
          user: {
            id: newUserId,
            fullName,
            role: targetRole,
            companyId: targetCompanyId,
          },
        }),
        { status: 200, headers: { ...cors, 'Content-Type': 'application/json' } }
      );
    }

    // ------------------------------------------------------------------
    // AÇÃO 3: ALTERAR STATUS DE USUÁRIO (ATIVAR/DESATIVAR)
    // ------------------------------------------------------------------
    if (action === 'toggle_user_status') {
      const { targetUserId, active } = payload;

      const { data: targetProf } = await supabaseAdmin
        .from('profiles')
        .select('company_id, role')
        .eq('id', targetUserId)
        .single();

      if (!targetProf) {
        return new Response(
          JSON.stringify({ success: false, error: 'Usuário não encontrado.' }),
          { status: 404, headers: { ...cors, 'Content-Type': 'application/json' } }
        );
      }

      // Validação estrita de isolamento de tenant
      if (!isSuperAdmin && targetProf.company_id !== callerProfile.company_id) {
        return new Response(
          JSON.stringify({ success: false, error: 'Acesso negado a usuário de outra empresa.' }),
          { status: 403, headers: { ...cors, 'Content-Type': 'application/json' } }
        );
      }

      await supabaseAdmin.from('profiles').update({ active: !!active }).eq('id', targetUserId);

      await supabaseAdmin.from('security_audit_logs').insert({
        company_id: targetProf.company_id,
        user_id: callerUser.id,
        event_type: active ? 'USER_ENABLED' : 'USER_DISABLED',
        metadata: { target_user_id: targetUserId },
      });

      return new Response(
        JSON.stringify({ success: true, active: !!active }),
        { status: 200, headers: { ...cors, 'Content-Type': 'application/json' } }
      );
    }

    // ------------------------------------------------------------------
    // AÇÃO 4: ALTERAR CARGO (ROLE)
    // ------------------------------------------------------------------
    if (action === 'change_user_role') {
      const { targetUserId, newRole } = payload;

      if (!isSuperAdmin && newRole === 'ROLE_SUPER_ADMIN') {
        return new Response(
          JSON.stringify({ success: false, error: 'Apenas Super Administradores podem definir esse papel.' }),
          { status: 403, headers: { ...cors, 'Content-Type': 'application/json' } }
        );
      }

      const { data: targetProf } = await supabaseAdmin
        .from('profiles')
        .select('company_id, role')
        .eq('id', targetUserId)
        .single();

      if (!targetProf) {
        return new Response(
          JSON.stringify({ success: false, error: 'Usuário não encontrado.' }),
          { status: 404, headers: { ...cors, 'Content-Type': 'application/json' } }
        );
      }

      // Validação estrita de isolamento de tenant
      if (!isSuperAdmin && targetProf.company_id !== callerProfile.company_id) {
        return new Response(
          JSON.stringify({ success: false, error: 'Acesso negado a usuário de outra empresa.' }),
          { status: 403, headers: { ...cors, 'Content-Type': 'application/json' } }
        );
      }

      await supabaseAdmin.from('profiles').update({ role: newRole }).eq('id', targetUserId);

      await supabaseAdmin.from('security_audit_logs').insert({
        company_id: targetProf.company_id,
        user_id: callerUser.id,
        event_type: 'ROLE_CHANGED',
        metadata: { target_user_id: targetUserId, old_role: targetProf.role, new_role: newRole },
      });

      return new Response(
        JSON.stringify({ success: true, role: newRole }),
        { status: 200, headers: { ...cors, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ success: false, error: 'Ação não reconhecida.' }),
      { status: 400, headers: { ...cors, 'Content-Type': 'application/json' } }
    );
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Erro interno.';
    console.error('[ERRO admin-manage-user]:', msg);
    return new Response(
      JSON.stringify({ success: false, error: 'Erro ao processar solicitação administrativa.' }),
      { status: 500, headers: { ...cors, 'Content-Type': 'application/json' } }
    );
  }
});
