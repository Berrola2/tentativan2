// ==============================================================================
// SUPABASE EDGE FUNCTION: admin-manage-user (ETAPA 02.1 — HARDENING COMPLETO)
// ==============================================================================
// Gestão de empresas, primeiro gerente e funcionários com derivação estrita de Tenant
// ==============================================================================

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.112.4';

function getCorsHeaders(requestOrigin: string | null): Record<string, string> {
  return {
    'Access-Control-Allow-Origin': requestOrigin || '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
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
        JSON.stringify({ success: false, error: 'Configuração do servidor ausente.' }),
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

    // 1. Validar identidade do solicitante
    const { data: { user: callerUser }, error: callerAuthErr } = await supabaseAdmin.auth.getUser(token);

    if (callerAuthErr || !callerUser) {
      return new Response(
        JSON.stringify({ success: false, error: 'Sessão inválida ou expirada.' }),
        { status: 401, headers: { ...cors, 'Content-Type': 'application/json' } }
      );
    }

    // 2. Buscar perfil e papel do solicitante no banco
    const { data: callerProfile, error: callerProfErr } = await supabaseAdmin
      .from('profiles')
      .select('id, company_id, role, active')
      .eq('id', callerUser.id)
      .single();

    if (callerProfErr || !callerProfile || !callerProfile.active) {
      return new Response(
        JSON.stringify({ success: false, error: 'Usuário não autorizado ou inativo.' }),
        { status: 403, headers: { ...cors, 'Content-Type': 'application/json' } }
      );
    }

    const isSuperAdmin = callerProfile.role === 'ROLE_SUPER_ADMIN';
    const isCompanyManager = callerProfile.role === 'ROLE_MANAGER';

    if (!isSuperAdmin && !isCompanyManager) {
      return new Response(
        JSON.stringify({ success: false, error: 'Você não possui permissão administrativa.' }),
        { status: 403, headers: { ...cors, 'Content-Type': 'application/json' } }
      );
    }

    const payload = await req.json();
    const action = payload.action;

    // ------------------------------------------------------------------
    // AÇÃO 1: CRIAR EMPRESA (Apenas SUPER_ADMIN)
    // ------------------------------------------------------------------
    if (action === 'create_company') {
      if (!isSuperAdmin) {
        return new Response(
          JSON.stringify({ success: false, error: 'Apenas Super Administradores podem criar empresas.' }),
          { status: 403, headers: { ...cors, 'Content-Type': 'application/json' } }
        );
      }

      const { name, legalName, tradeName, slug, documentNumber, phone, email, managerFirstName, managerLastName } = payload;
      const cleanSlug = normalizeText(slug || tradeName || name);

      if (!cleanSlug || cleanSlug.length < 2) {
        return new Response(
          JSON.stringify({ success: false, error: 'Slug de empresa inválido.' }),
          { status: 400, headers: { ...cors, 'Content-Type': 'application/json' } }
        );
      }

      // Inserir empresa
      const { data: newCompany, error: compErr } = await supabaseAdmin
        .from('companies')
        .insert({
          name: name || tradeName,
          legal_name: legalName || name,
          trade_name: tradeName || name,
          slug: cleanSlug,
          document_number: documentNumber || null,
          phone: phone || null,
          email: email || null,
          active: true,
        })
        .select()
        .single();

      if (compErr || !newCompany) {
        return new Response(
          JSON.stringify({ success: false, error: `Falha ao criar empresa: ${compErr?.message}` }),
          { status: 400, headers: { ...cors, 'Content-Type': 'application/json' } }
        );
      }

      let managerInfo = null;

      // Se informou primeiro gerente, criar conta
      if (managerFirstName && managerLastName) {
        const normFirst = normalizeText(managerFirstName);
        const normLast = normalizeText(managerLastName);
        const loginAlias = `${normFirst}.${normLast}@${cleanSlug}.yzzy`;
        const authEmail = `usr_${crypto.randomUUID().replace(/-/g, '')}@auth.yzzy.internal`;
        const tempPassword = generateTempPassword();

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

          await supabaseAdmin.from('user_auth_identities').insert({
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

    // ------------------------------------------------------------------
    // AÇÃO 2: CRIAR FUNCIONÁRIO (COMPANY_MANAGER ou SUPER_ADMIN)
    // ------------------------------------------------------------------
    if (action === 'create_employee') {
      const { firstName, lastName, role } = payload;
      
      // Derivação estrita de Tenant: Gerente NUNCA pode usar outro company_id
      const targetCompanyId = isSuperAdmin ? (payload.targetCompanyId || callerProfile.company_id) : callerProfile.company_id;

      if (!targetCompanyId) {
        return new Response(
          JSON.stringify({ success: false, error: 'Empresa não identificada para este usuário.' }),
          { status: 400, headers: { ...cors, 'Content-Type': 'application/json' } }
        );
      }

      // Bloqueio de elevação de privilégio: Gerente NÃO pode criar SUPER_ADMIN
      if (!isSuperAdmin && role === 'ROLE_SUPER_ADMIN') {
        return new Response(
          JSON.stringify({ success: false, error: 'Apenas Super Administradores podem criar outro Super Administrador.' }),
          { status: 403, headers: { ...cors, 'Content-Type': 'application/json' } }
        );
      }

      const allowedRoles = ['ROLE_MANAGER', 'ROLE_INSPECTOR', 'ROLE_VIEWER'];
      if (isSuperAdmin) allowedRoles.push('ROLE_SUPER_ADMIN');

      const targetRole = allowedRoles.includes(role) ? role : 'ROLE_INSPECTOR';

      // Buscar slug da empresa
      const { data: comp } = await supabaseAdmin
        .from('companies')
        .select('slug, name, active')
        .eq('id', targetCompanyId)
        .single();

      if (!comp || !comp.active) {
        return new Response(
          JSON.stringify({ success: false, error: 'Empresa inexistente ou inativa.' }),
          { status: 400, headers: { ...cors, 'Content-Type': 'application/json' } }
        );
      }

      const normFirst = normalizeText(firstName || 'usuario');
      const normLast = normalizeText(lastName || 'teste');
      const baseAlias = `${normFirst}.${normLast}@${comp.slug}.yzzy`;

      // Tratamento determinístico de colisão de Login YZZY com retry
      let finalLoginAlias = baseAlias;
      let counter = 2;

      while (counter < 100) {
        const { data: exists } = await supabaseAdmin
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
      await supabaseAdmin.from('user_auth_identities').insert({
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
