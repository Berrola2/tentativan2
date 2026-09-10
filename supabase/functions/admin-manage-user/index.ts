// ==============================================================================
// SUPABASE EDGE FUNCTION: admin-manage-user (FLUXO CANÔNICO DE PROVISIONAMENTO)
// ==============================================================================
// Gestão de empresas, gerentes e funcionários com fonte de verdade única
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

export function normalizeText(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]/g, '');
}

export function generateTempPassword(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789!@#$%&*';
  const array = new Uint8Array(12);
  crypto.getRandomValues(array);
  let pass = 'Yz#';
  for (let i = 0; i < 9; i++) {
    pass += chars[array[i] % chars.length];
  }
  return pass;
}

function maskEmail(email?: string | null): string {
  if (!email) return 'sem_email';
  const parts = email.split('@');
  if (parts.length < 2) return '***';
  const user = parts[0];
  const domain = parts[1];
  return `${user.substring(0, 3)}***@${domain}`;
}

/**
 * SERVIÇO CANÔNICO SERVER-SIDE DE PROVISIONAMENTO DE USUÁRIOS YZZY
 * Responsável pelas 11 etapas canônicas com compensação atômica (rollback completo)
 */
async function provision_yzzy_user(
  supabaseAdmin: any,
  params: {
    actorUserId: string;
    actorRole: string;
    actorCompanyId: string | null;
    targetCompanyId: string | null;
    companySlug: string;
    firstName: string;
    lastName: string;
    role: string;
    correlationId: string;
    clientIp?: string | null;
  }
) {
  const {
    actorUserId,
    actorRole,
    actorCompanyId,
    targetCompanyId,
    companySlug,
    firstName,
    lastName,
    role: requestedRole,
    correlationId,
    clientIp,
  } = params;

  console.log(`[CID:${correlationId}] [USER_PROVISION_STARTED] Role Solicitado: ${requestedRole} | Tenant Destino: ${targetCompanyId || 'NULL (Global)'}`);

  // 1. Validar Ator Autorizado e RBAC
  const isSuperAdmin = actorRole === 'ROLE_SUPER_ADMIN';
  const isManager = actorRole === 'ROLE_MANAGER';

  if (!isSuperAdmin && !isManager) {
    throw new Error('Acesso negado. Apenas Super Admins e Gerentes podem provisionar usuários.');
  }

  // Se for Gerente, só pode criar dentro de sua própria empresa
  if (!isSuperAdmin) {
    if (!actorCompanyId || actorCompanyId !== targetCompanyId) {
      throw new Error('Gerentes só podem criar usuários dentro da sua própria empresa.');
    }
    // Gerente só pode criar Vistoriador ou Visualizador
    if (requestedRole !== 'ROLE_INSPECTOR' && requestedRole !== 'ROLE_VIEWER') {
      throw new Error('Gerentes só podem criar usuários com papel ROLE_INSPECTOR ou ROLE_VIEWER.');
    }
  }

  // 2. Validar Papel Alvo
  const validRoles = new Set(['ROLE_SUPER_ADMIN', 'ROLE_MANAGER', 'ROLE_INSPECTOR', 'ROLE_VIEWER']);
  const finalRole = requestedRole.trim();
  if (!validRoles.has(finalRole)) {
    throw new Error(`Papel inválido ou não reconhecido: ${finalRole}`);
  }

  // 3. Normalização de Nomes e Geração Canônica do Login Alias com Colisão Controlada
  const normFirst = normalizeText(firstName || 'usuario');
  const normLast = normalizeText(lastName || 'teste');
  const cleanSlug = normalizeText(companySlug || 'yzzy');
  const baseAlias = `${normFirst}.${normLast}@${cleanSlug}.yzzy`;

  let finalLoginAlias = baseAlias;
  let collisionCounter = 2;

  while (collisionCounter < 100) {
    const { data: exists } = await supabaseAdmin.rpc('resolve_login_yzzy_identity', {
      p_login_alias: finalLoginAlias,
    });

    if (!exists || exists.length === 0) {
      break;
    }
    finalLoginAlias = `${normFirst}.${normLast}${collisionCounter}@${cleanSlug}.yzzy`;
    collisionCounter++;
  }

  // 4. Geração Canônica de Auth Email Interno e Senha Temporária
  const tempPassword = generateTempPassword();
  const internalAuthEmail = `usr_${crypto.randomUUID().replace(/-/g, '')}@auth.yzzy.internal`;
  const fullName = `${firstName.trim()} ${lastName.trim()}`;

  let createdAuthUserId: string | null = null;
  let createdProfile = false;

  try {
    // 5. Criar no Supabase Auth
    const { data: authCreated, error: authErr } = await supabaseAdmin.auth.admin.createUser({
      email: internalAuthEmail,
      password: tempPassword,
      email_confirm: true,
      user_metadata: { full_name: fullName },
    });

    if (authErr || !authCreated?.user) {
      throw new Error(`Falha ao criar usuário no Supabase Auth: ${authErr?.message}`);
    }

    createdAuthUserId = authCreated.user.id;
    console.log(`[CID:${correlationId}] [AUTH_USER_CREATED] AuthUserId: ${createdAuthUserId} | AuthEmail: ${maskEmail(internalAuthEmail)}`);

    // 6. Criar Perfil em public.profiles
    const { error: profErr } = await supabaseAdmin.from('profiles').insert({
      id: createdAuthUserId,
      company_id: targetCompanyId,
      first_name: firstName.trim(),
      last_name: lastName.trim(),
      full_name: fullName,
      display_name: fullName,
      username: finalLoginAlias.split('@')[0],
      role: finalRole,
      active: true,
      must_change_password: true,
    });

    if (profErr) {
      throw new Error(`Falha ao criar perfil em public.profiles: ${profErr.message}`);
    }

    createdProfile = true;
    console.log(`[CID:${correlationId}] [PROFILE_CREATED] Profile ID: ${createdAuthUserId} | Role: ${finalRole}`);

    // 7. Registrar Identidade no schema private via RPC Segura
    const { data: identityData, error: idErr } = await supabaseAdmin.rpc('admin_register_user_auth_identity', {
      p_user_id: createdAuthUserId,
      p_company_id: targetCompanyId,
      p_login_alias: finalLoginAlias,
      p_auth_email: internalAuthEmail,
    });

    if (idErr || !identityData?.success) {
      throw new Error(`Falha ao registrar identidade no schema private: ${idErr?.message || 'Erro na RPC'}`);
    }

    console.log(`[CID:${correlationId}] [IDENTITY_CREATED] Alias: ${finalLoginAlias} | AuthEmail: ${maskEmail(internalAuthEmail)}`);

    // 8. Validação de Integridade Final
    const { data: verifyRows, error: verifyErr } = await supabaseAdmin.rpc('resolve_login_yzzy_identity', {
      p_login_alias: finalLoginAlias,
    });

    if (verifyErr || !verifyRows || verifyRows.length === 0) {
      throw new Error('Falha na validação pós-provisionamento da identidade.');
    }

    console.log(`[CID:${correlationId}] [USER_PROVISION_VALIDATED] Integridade 100% confirmada.`);

    // 9. Registrar Auditoria
    await supabaseAdmin.from('security_audit_logs').insert({
      company_id: targetCompanyId,
      user_id: actorUserId,
      event_type: 'USER_PROVISIONED',
      ip_address: clientIp || null,
      metadata: {
        created_user_id: createdAuthUserId,
        login_alias: finalLoginAlias,
        role: finalRole,
        correlation_id: correlationId,
      },
    });

    console.log(`[CID:${correlationId}] [USER_PROVISION_SUCCESS] Usuário ${finalLoginAlias} provisionado com sucesso.`);

    return {
      userId: createdAuthUserId,
      loginAlias: finalLoginAlias,
      authEmail: internalAuthEmail,
      tempPassword,
      fullName,
      role: finalRole,
      companyId: targetCompanyId,
    };
  } catch (err: unknown) {
    console.error(`[CID:${correlationId}] [USER_PROVISION_ROLLBACK] Revertendo alterações devido a falha:`, err instanceof Error ? err.message : err);

    // Rollback / Compensação Completa
    if (createdProfile && createdAuthUserId) {
      await supabaseAdmin.from('profiles').delete().eq('id', createdAuthUserId).catch(() => {});
    }
    if (createdAuthUserId) {
      await supabaseAdmin.auth.admin.deleteUser(createdAuthUserId).catch(() => {});
    }

    throw err;
  }
}

serve(async (req: Request) => {
  const correlationId = crypto.randomUUID();
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
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY') || Deno.env.get('SUPABASE_PUBLISHABLE_KEY') || '';

    if (!supabaseUrl || !serviceRoleKey) {
      console.error(`[CID:${correlationId}] [CONFIG_ERROR] SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY não configurados.`);
      return new Response(
        JSON.stringify({ success: false, error: 'Erro de configuração do servidor.' }),
        { status: 500, headers: { ...cors, 'Content-Type': 'application/json' } }
      );
    }

    const authHeader = req.headers.get('Authorization') || req.headers.get('authorization') || '';
    let token = authHeader.replace(/^Bearer\s+/i, '').trim();
    if ((token.startsWith('"') && token.endsWith('"')) || (token.startsWith("'") && token.endsWith("'"))) {
      token = token.slice(1, -1).trim();
    }

    console.log(`[CID:${correlationId}] [ADMIN_REQUEST_RECEIVED] Origin: ${requestOrigin || 'N/A'}`);

    if (!token) {
      console.warn(`[CID:${correlationId}] [AUTH_HEADER_MISSING] Token de autenticação Bearer não fornecido.`);
      return new Response(
        JSON.stringify({ success: false, error: 'Token de autenticação não fornecido.' }),
        { status: 401, headers: { ...cors, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[CID:${correlationId}] [AUTH_HEADER_PRESENT] Bearer token presente (prefix: ${token.substring(0, 15)}..., len: ${token.length})`);

    // 1. Cliente com privilégios administrativos para operações de banco
    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // 2. Validação do JWT de usuário via GoTrue (100% server-side)
    let callerUser: { id: string; email?: string } | null = null;
    let authErrorMessage = '';

    // Estratégia 1: Cliente oficial com ANON_KEY e Bearer header
    if (anonKey) {
      try {
        const userClient = createClient(supabaseUrl, anonKey, {
          auth: { autoRefreshToken: false, persistSession: false },
          global: { headers: { Authorization: `Bearer ${token}` } },
        });
        const { data: userData, error: userErr } = await userClient.auth.getUser();
        if (userData?.user) {
          callerUser = userData.user;
        } else if (userErr) {
          authErrorMessage = userErr.message;
        }
      } catch (errAnon) {
        authErrorMessage = errAnon instanceof Error ? errAnon.message : 'Erro na validação via anonClient';
      }
    }

    // Estratégia 2: Validação direta via getUser(token) no cliente Admin
    if (!callerUser) {
      try {
        const { data: adminUserData, error: adminUserErr } = await supabaseAdmin.auth.getUser(token);
        if (adminUserData?.user) {
          callerUser = adminUserData.user;
          authErrorMessage = '';
        } else if (adminUserErr && !authErrorMessage) {
          authErrorMessage = adminUserErr.message;
        }
      } catch (errAdmin) {
        if (!authErrorMessage) {
          authErrorMessage = errAdmin instanceof Error ? errAdmin.message : 'Erro no adminClient.getUser';
        }
      }
    }

    // Estratégia 3: Chamada HTTP direta ao endpoint GoTrue /auth/v1/user
    if (!callerUser) {
      try {
        const goTrueRes = await fetch(`${supabaseUrl}/auth/v1/user`, {
          headers: {
            'Authorization': `Bearer ${token}`,
            'apikey': anonKey || serviceRoleKey,
          },
        });
        if (goTrueRes.ok) {
          const directUser = await goTrueRes.json();
          if (directUser && directUser.id) {
            callerUser = directUser;
            authErrorMessage = '';
          }
        } else {
          const errBody = await goTrueRes.json().catch(() => ({}));
          console.warn(`[CID:${correlationId}] [GOTRUE_HTTP_ERROR] Status: ${goTrueRes.status} | Msg: ${errBody?.msg || errBody?.message || errBody?.error_description || 'Erro GoTrue'}`);
          if (!authErrorMessage) {
            authErrorMessage = errBody?.msg || errBody?.message || 'Sessão inválida no GoTrue';
          }
        }
      } catch (fetchErr) {
        console.warn(`[CID:${correlationId}] [GOTRUE_FETCH_EXCEPTION]`, fetchErr);
      }
    }

    if (!callerUser) {
      console.warn(`[CID:${correlationId}] [TOKEN_INVALID] Falha ao autenticar token JWT: ${authErrorMessage || 'Usuário nulo'}`);
      return new Response(
        JSON.stringify({ success: false, error: 'Sessão inválida ou expirada.' }),
        { status: 401, headers: { ...cors, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[CID:${correlationId}] [TOKEN_VALID] Token validado com sucesso via GoTrue. UID: ${callerUser.id}`);
    console.log(`[CID:${correlationId}] [USER_RESOLVED] Caller User: ${callerUser.id} | Email: ${maskEmail(callerUser.email)}`);

    // 3. Consultar perfil e permissões no banco de dados
    const { data: callerProfile, error: callerProfErr } = await supabaseAdmin
      .from('profiles')
      .select('id, company_id, role, active')
      .eq('id', callerUser.id)
      .single();

    if (callerProfErr || !callerProfile || !callerProfile.active) {
      console.warn(`[CID:${correlationId}] [PROFILE_ERROR] Perfil não encontrado ou inativo: ${callerProfErr?.message || 'active=false'}`);
      const isManager = callerProfile?.role === 'ROLE_MANAGER';
      const userInactiveMsg = isManager
        ? 'Seu acesso está inativo. Entre em contato com o Super Administrador YZZY.'
        : 'Seu acesso está inativo. Entre em contato com o gerente da sua empresa.';
      return new Response(
        JSON.stringify({ success: false, error: userInactiveMsg, code: 'USER_INACTIVE' }),
        { status: 403, headers: { ...cors, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[CID:${correlationId}] [PROFILE_FOUND] Role: ${callerProfile.role} | Active: ${callerProfile.active} | CompanyId: ${callerProfile.company_id || 'NULL'}`);

    // Verificar se a empresa do chamador está ativa
    if (callerProfile.company_id) {
      const { data: callerComp } = await supabaseAdmin
        .from('companies')
        .select('active')
        .eq('id', callerProfile.company_id)
        .single();

      if (callerComp && !callerComp.active) {
        console.warn(`[CID:${correlationId}] [COMPANY_INACTIVE] Empresa ${callerProfile.company_id} está inativa.`);
        const isManager = callerProfile.role === 'ROLE_MANAGER';
        const companyInactiveMsg = isManager
          ? 'Sua empresa está inativa no Vistoria YZZY. Entre em contato com o Super Administrador YZZY.'
          : 'O acesso da sua empresa está temporariamente indisponível. Entre em contato com o gerente da sua empresa.';
        return new Response(
          JSON.stringify({ success: false, error: companyInactiveMsg, code: 'COMPANY_INACTIVE' }),
          { status: 403, headers: { ...cors, 'Content-Type': 'application/json' } }
        );
      }
    }

    const isSuperAdmin = callerProfile.role === 'ROLE_SUPER_ADMIN';
    const isCompanyManager = callerProfile.role === 'ROLE_MANAGER';

    if (!isSuperAdmin && !isCompanyManager) {
      console.warn(`[CID:${correlationId}] [FORBIDDEN] Role ${callerProfile.role} não possui privilégios administrativos.`);
      return new Response(
        JSON.stringify({ success: false, error: 'Acesso negado. Apenas administradores e gerentes podem realizar esta operação.' }),
        { status: 403, headers: { ...cors, 'Content-Type': 'application/json' } }
      );
    }

    const body = await req.json();
    const { action } = body;
    const clientIp = req.headers.get('x-forwarded-for') || null;

    // =========================================================================
    // AÇÃO 0: AUDITORIA / CHECK DE SESSÃO AUTENTICADA
    // =========================================================================
    if (action === 'check_session' || action === 'ping') {
      if (isSuperAdmin) {
        console.log(`[CID:${correlationId}] [ROLE_SUPER_ADMIN_CONFIRMED] Permissão de Super Admin confirmada.`);
      }
      return new Response(
        JSON.stringify({
          success: true,
          correlationId,
          user: {
            id: callerUser.id,
            email: maskEmail(callerUser.email),
            role: callerProfile.role,
            companyId: callerProfile.company_id,
            active: callerProfile.active,
          },
        }),
        { status: 200, headers: { ...cors, 'Content-Type': 'application/json' } }
      );
    }

    // =========================================================================
    // AÇÃO 1: SUPER_ADMIN — Criar nova empresa e primeiro gerente (Canônico)
    // =========================================================================
    if (action === 'create_company') {
      if (!isSuperAdmin) {
        console.warn(`[CID:${correlationId}] [FORBIDDEN] Tentativa de create_company por não-SuperAdmin (Role: ${callerProfile.role})`);
        return new Response(
          JSON.stringify({ success: false, error: 'Apenas Super Admins podem criar novas empresas.' }),
          { status: 403, headers: { ...cors, 'Content-Type': 'application/json' } }
        );
      }

      console.log(`[CID:${correlationId}] [ROLE_SUPER_ADMIN_CONFIRMED] Permissão de Super Admin confirmada.`);

      const name = body.name?.trim();
      const slug = body.slug?.trim();
      const legalName = body.legalName?.trim() || name;
      const tradeName = body.tradeName?.trim() || name;
      const documentNumber = body.documentNumber?.trim() || body.cnpj?.trim() || null;
      const phone = body.phone?.trim() || null;
      const email = body.email?.trim() || null;
      const managerFirstName = body.managerFirstName?.trim();
      const managerLastName = body.managerLastName?.trim();

      if (!name || !slug) {
        return new Response(
          JSON.stringify({ success: false, error: 'Nome e slug da empresa são obrigatórios.' }),
          { status: 400, headers: { ...cors, 'Content-Type': 'application/json' } }
        );
      }

      const cleanSlug = normalizeText(slug);
      console.log(`[CID:${correlationId}] [CREATE_COMPANY_STARTED] Nome: ${name} | Slug: ${cleanSlug}`);

      // Inserir empresa na tabela public.companies
      const { data: newCompany, error: compErr } = await supabaseAdmin
        .from('companies')
        .insert({
          name: name,
          slug: cleanSlug,
          legal_name: legalName,
          trade_name: tradeName,
          document_number: documentNumber,
          phone: phone,
          email: email,
          active: true,
        })
        .select()
        .single();

      if (compErr || !newCompany) {
        console.error(`[CID:${correlationId}] [CREATE_COMPANY_FAILED] Erro no banco: ${compErr?.message}`);
        return new Response(
          JSON.stringify({ success: false, error: `Erro ao criar empresa: ${compErr?.message || 'Erro desconhecido'}` }),
          { status: 400, headers: { ...cors, 'Content-Type': 'application/json' } }
        );
      }

      console.log(`[CID:${correlationId}] [CREATE_COMPANY_SUCCESS] Empresa criada com sucesso. ID: ${newCompany.id}`);

      let managerInfo = null;

      // Provisionar primeiro gerente usando o SERVIÇO CANÔNICO
      if (managerFirstName && managerLastName) {
        const provisionedManager = await provision_yzzy_user(supabaseAdmin, {
          actorUserId: callerUser.id,
          actorRole: callerProfile.role,
          actorCompanyId: null,
          targetCompanyId: newCompany.id,
          companySlug: cleanSlug,
          firstName: managerFirstName,
          lastName: managerLastName,
          role: 'ROLE_MANAGER',
          correlationId,
          clientIp,
        });

        managerInfo = {
          userId: provisionedManager.userId,
          loginAlias: provisionedManager.loginAlias,
          tempPassword: provisionedManager.tempPassword,
          fullName: provisionedManager.fullName,
        };
      }

      // Log de Auditoria
      await supabaseAdmin.from('security_audit_logs').insert({
        company_id: newCompany.id,
        user_id: callerUser.id,
        event_type: 'COMPANY_CREATED',
        ip_address: clientIp,
        metadata: { company_id: newCompany.id, company_name: name, correlation_id: correlationId },
      });

      return new Response(
        JSON.stringify({ success: true, correlationId, company: newCompany, manager: managerInfo }),
        { status: 200, headers: { ...cors, 'Content-Type': 'application/json' } }
      );
    }

    // =========================================================================
    // AÇÃO 1.5: SUPER_ADMIN — Desativar / Reativar Empresa (Soft Deactivation)
    // =========================================================================
    if (action === 'toggle_company_status') {
      if (!isSuperAdmin) {
        return new Response(
          JSON.stringify({ success: false, error: 'Apenas Super Administradores podem desativar ou reativar empresas.' }),
          { status: 403, headers: { ...cors, 'Content-Type': 'application/json' } }
        );
      }

      const { targetCompanyId, active, reason } = body;

      const { data: comp } = await supabaseAdmin
        .from('companies')
        .select('id, name, slug, active')
        .eq('id', targetCompanyId)
        .single();

      if (!comp) {
        return new Response(
          JSON.stringify({ success: false, error: 'Empresa não encontrada.' }),
          { status: 404, headers: { ...cors, 'Content-Type': 'application/json' } }
        );
      }

      const isDeactivating = !active;
      const deactReason = reason?.trim() || (isDeactivating ? 'Suspensão administrativa' : null);

      const updatePayload: Record<string, any> = {
        active: !!active,
        deactivated_at: isDeactivating ? new Date().toISOString() : null,
        deactivated_by: isDeactivating ? callerUser.id : null,
        deactivation_reason: isDeactivating ? deactReason : null,
        updated_at: new Date().toISOString(),
      };

      const { error: updateCompErr } = await supabaseAdmin
        .from('companies')
        .update(updatePayload)
        .eq('id', targetCompanyId);

      if (updateCompErr) {
        return new Response(
          JSON.stringify({ success: false, error: `Erro ao atualizar empresa: ${updateCompErr.message}` }),
          { status: 400, headers: { ...cors, 'Content-Type': 'application/json' } }
        );
      }

      // Registrar auditoria de segurança
      await supabaseAdmin.from('security_audit_logs').insert({
        company_id: targetCompanyId,
        user_id: callerUser.id,
        event_type: isDeactivating ? 'COMPANY_DEACTIVATED' : 'COMPANY_REACTIVATED',
        ip_address: clientIp,
        metadata: {
          company_id: targetCompanyId,
          company_name: comp.name,
          reason: deactReason,
          correlation_id: correlationId,
        },
      });

      console.log(`[CID:${correlationId}] [COMPANY_STATUS_UPDATED] Empresa ${comp.name} -> active=${!!active} | Motivo: ${deactReason || 'Reativação'}`);

      return new Response(
        JSON.stringify({
          success: true,
          correlationId,
          companyId: targetCompanyId,
          active: !!active,
        }),
        { status: 200, headers: { ...cors, 'Content-Type': 'application/json' } }
      );
    }

    // =========================================================================
    // AÇÃO 1.6: SUPER_ADMIN — Excluir Empresa Permanentemente (Hard Delete)
    // =========================================================================
    if (action === 'delete_company_permanently') {
      if (!isSuperAdmin) {
        console.warn(`[CID:${correlationId}] [FORBIDDEN] Tentativa de delete_company_permanently por não-SuperAdmin (Role: ${callerProfile.role})`);
        return new Response(
          JSON.stringify({ success: false, error: 'Apenas Super Administradores podem excluir empresas permanentemente.' }),
          { status: 403, headers: { ...cors, 'Content-Type': 'application/json' } }
        );
      }

      const { targetCompanyId, confirmationName, reason } = body;

      if (!targetCompanyId) {
        return new Response(
          JSON.stringify({ success: false, error: 'ID da empresa não informado.' }),
          { status: 400, headers: { ...cors, 'Content-Type': 'application/json' } }
        );
      }

      if (!reason || !reason.trim()) {
        return new Response(
          JSON.stringify({ success: false, error: 'O motivo da exclusão permanente é obrigatório.' }),
          { status: 400, headers: { ...cors, 'Content-Type': 'application/json' } }
        );
      }

      // Buscar empresa
      const { data: comp, error: compErr } = await supabaseAdmin
        .from('companies')
        .select('id, name, slug, trade_name, active')
        .eq('id', targetCompanyId)
        .single();

      if (compErr || !comp) {
        return new Response(
          JSON.stringify({ success: false, error: 'Empresa não encontrada.' }),
          { status: 404, headers: { ...cors, 'Content-Type': 'application/json' } }
        );
      }

      // BARREIRA 1: A empresa PRECISA estar previamente DESATIVADA
      if (comp.active !== false) {
        return new Response(
          JSON.stringify({ success: false, error: 'A empresa precisa estar previamente desativada antes da exclusão permanente.' }),
          { status: 400, headers: { ...cors, 'Content-Type': 'application/json' } }
        );
      }

      // BARREIRA 2: Confirmação exata pelo nome
      const typedName = (confirmationName || '').trim();
      const expectedName = (comp.name || '').trim();
      const expectedTrade = (comp.trade_name || '').trim();
      if (typedName !== expectedName && typedName !== expectedTrade) {
        return new Response(
          JSON.stringify({ success: false, error: 'O nome digitado não corresponde ao nome da empresa.' }),
          { status: 400, headers: { ...cors, 'Content-Type': 'application/json' } }
        );
      }

      console.log(`[CID:${correlationId}] [DELETE_COMPANY_INITIATED] Deletando empresa ${comp.name} (${targetCompanyId}) | Motivo: ${reason}`);

      // 1. Obter usuários da empresa (garantindo que Super Admin NUNCA seja afetado)
      const { data: companyProfiles } = await supabaseAdmin
        .from('profiles')
        .select('id, role')
        .eq('company_id', targetCompanyId)
        .neq('role', 'ROLE_SUPER_ADMIN');

      const userIdsToDelete = (companyProfiles || []).map((p: any) => p.id);

      // 2. Limpar arquivos do Storage para os buckets da empresa
      const buckets = ['inspection-media', 'inspection-documents', 'document-signatures'];
      for (const b of buckets) {
        try {
          const { data: files } = await supabaseAdmin.storage.from(b).list(targetCompanyId, { limit: 1000 });
          if (files && files.length > 0) {
            const paths = files.map((f: any) => `${targetCompanyId}/${f.name}`);
            await supabaseAdmin.storage.from(b).remove(paths);
          }
        } catch (storageErr) {
          console.warn(`[CID:${correlationId}] [STORAGE_CLEANUP_WARN] Erro ao limpar bucket ${b}:`, storageErr);
        }
      }

      // 3. Tentar executar via RPC ou via remoções em cascata
      const { data: rpcRes, error: rpcErr } = await supabaseAdmin.rpc('admin_delete_company_permanently', {
        p_company_id: targetCompanyId,
        p_confirmation_name: typedName,
        p_reason: reason.trim(),
      });

      if (rpcErr) {
        console.warn(`[CID:${correlationId}] [RPC_FAIL_FALLBACK] RPC falhou ou não existe, executando exclusão direta via adminClient:`, rpcErr.message);

        // Registro de Auditoria do Sistema que sobrevive à exclusão
        await supabaseAdmin.from('system_audit_logs').insert({
          event_type: 'DELETE_COMPANY_PERMANENTLY',
          severity: 'SEV-2',
          actor_id: callerUser.id,
          details: {
            deleted_company_id: targetCompanyId,
            company_name: comp.name,
            company_slug: comp.slug,
            reason: reason.trim(),
            deleted_users_count: userIdsToDelete.length,
            deleted_by: callerUser.id,
            deleted_at: new Date().toISOString(),
            correlation_id: correlationId,
          },
        }).catch(() => {});

        // Excluir tabela principal (cascata cuidará das tabelas filhas com ON DELETE CASCADE)
        const { error: delCompErr } = await supabaseAdmin
          .from('companies')
          .delete()
          .eq('id', targetCompanyId);

        if (delCompErr) {
          console.error(`[CID:${correlationId}] [DELETE_COMPANY_FAILED] Erro no banco:`, delCompErr.message);
          return new Response(
            JSON.stringify({ success: false, error: `Falha na exclusão da empresa: ${delCompErr.message}` }),
            { status: 500, headers: { ...cors, 'Content-Type': 'application/json' } }
          );
        }

        // Excluir Auth Users dos colaboradores da empresa
        for (const uid of userIdsToDelete) {
          await supabaseAdmin.auth.admin.deleteUser(uid).catch((uErr: any) => {
            console.warn(`[CID:${correlationId}] Erro ao deletar auth user ${uid}:`, uErr);
          });
        }
      } else {
        // Se a RPC executou, ainda garantimos a limpeza dos Auth Users
        for (const uid of userIdsToDelete) {
          await supabaseAdmin.auth.admin.deleteUser(uid).catch(() => {});
        }
      }

      console.log(`[CID:${correlationId}] [DELETE_COMPANY_SUCCESS] Empresa ${comp.name} excluída permanentemente.`);

      return new Response(
        JSON.stringify({
          success: true,
          correlationId,
          companyId: targetCompanyId,
          companyName: comp.name,
          message: 'Empresa excluída permanentemente.',
        }),
        { status: 200, headers: { ...cors, 'Content-Type': 'application/json' } }
      );
    }

    // =========================================================================
    // AÇÃO 2: COMPANY_MANAGER / SUPER_ADMIN — Cadastrar colaborador (Canônico)
    // =========================================================================
    if (action === 'create_employee') {
      const requestedCompanyId = body.companyId || body.targetCompanyId;

      // Se não for Super Admin e tentar especificar outra empresa, bloqueia com HTTP 403
      if (!isSuperAdmin && requestedCompanyId && requestedCompanyId !== callerProfile.company_id) {
        return new Response(
          JSON.stringify({ success: false, error: 'Acesso negado. Não é permitido criar usuários em outra empresa.' }),
          { status: 403, headers: { ...cors, 'Content-Type': 'application/json' } }
        );
      }

      const targetCompanyId = isSuperAdmin ? requestedCompanyId : callerProfile.company_id;

      if (!targetCompanyId) {
        return new Response(
          JSON.stringify({ success: false, error: 'Empresa de destino não identificada.' }),
          { status: 400, headers: { ...cors, 'Content-Type': 'application/json' } }
        );
      }

      const { data: comp } = await supabaseAdmin
        .from('companies')
        .select('id, name, slug, active')
        .eq('id', targetCompanyId)
        .single();

      if (!comp || !comp.active) {
        return new Response(
          JSON.stringify({ success: false, error: 'Empresa inativa ou inexistente.', code: 'COMPANY_INACTIVE' }),
          { status: 400, headers: { ...cors, 'Content-Type': 'application/json' } }
        );
      }

      const { firstName, lastName, role } = body;

      if (!firstName || !lastName) {
        return new Response(
          JSON.stringify({ success: false, error: 'Nome e sobrenome são obrigatórios.' }),
          { status: 400, headers: { ...cors, 'Content-Type': 'application/json' } }
        );
      }

      // Validação de Role
      let targetRole = role || 'ROLE_INSPECTOR';
      if (!isSuperAdmin) {
        if (targetRole === 'ROLE_SUPER_ADMIN' || targetRole === 'ROLE_MANAGER') {
          return new Response(
            JSON.stringify({ success: false, error: 'Gerentes só podem criar usuários com papel ROLE_INSPECTOR ou ROLE_VIEWER.' }),
            { status: 403, headers: { ...cors, 'Content-Type': 'application/json' } }
          );
        }
      }

      // Executar Provisionamento via SERVIÇO CANÔNICO
      const provisioned = await provision_yzzy_user(supabaseAdmin, {
        actorUserId: callerUser.id,
        actorRole: callerProfile.role,
        actorCompanyId: callerProfile.company_id,
        targetCompanyId,
        companySlug: comp.slug,
        firstName,
        lastName,
        role: targetRole,
        correlationId,
        clientIp,
      });

      return new Response(
        JSON.stringify({
          success: true,
          correlationId,
          loginAlias: provisioned.loginAlias,
          tempPassword: provisioned.tempPassword,
          user: {
            id: provisioned.userId,
            fullName: provisioned.fullName,
            role: provisioned.role,
            companyId: provisioned.companyId,
          },
        }),
        { status: 200, headers: { ...cors, 'Content-Type': 'application/json' } }
      );
    }

    // ------------------------------------------------------------------
    // AÇÃO 3: ALTERAR STATUS DE USUÁRIO (DESATIVAR / REATIVAR / DEMISSÃO)
    // ------------------------------------------------------------------
    if (action === 'toggle_user_status') {
      const { targetUserId, active, reason } = body;

      const { data: targetProf } = await supabaseAdmin
        .from('profiles')
        .select('company_id, role, full_name, active')
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

      // Gerente não pode desativar outro Gerente nem Super Admin
      if (!isSuperAdmin) {
        if (targetProf.role === 'ROLE_SUPER_ADMIN' || targetProf.role === 'ROLE_MANAGER') {
          return new Response(
            JSON.stringify({ success: false, error: 'Acesso negado. Gerentes não podem desativar administradores ou outros gerentes.' }),
            { status: 403, headers: { ...cors, 'Content-Type': 'application/json' } }
          );
        }
      }

      const isDeactivating = !active;
      const deactReason = reason?.trim() || (isDeactivating ? 'Desligamento / Afastamento' : null);

      const updatePayload: Record<string, any> = {
        active: !!active,
        deactivated_at: isDeactivating ? new Date().toISOString() : null,
        deactivated_by: isDeactivating ? callerUser.id : null,
        deactivation_reason: isDeactivating ? deactReason : null,
        updated_at: new Date().toISOString(),
      };

      await supabaseAdmin.from('profiles').update(updatePayload).eq('id', targetUserId);

      await supabaseAdmin.from('security_audit_logs').insert({
        company_id: targetProf.company_id,
        user_id: callerUser.id,
        event_type: isDeactivating ? 'USER_DEACTIVATED' : 'USER_REACTIVATED',
        ip_address: clientIp,
        metadata: {
          target_user_id: targetUserId,
          target_role: targetProf.role,
          target_name: targetProf.full_name,
          reason: deactReason,
          correlation_id: correlationId,
        },
      });

      console.log(`[CID:${correlationId}] [USER_STATUS_UPDATED] Usuário ${targetUserId} (${targetProf.role}) -> active=${!!active} | Motivo: ${deactReason || 'Reativação'}`);

      return new Response(
        JSON.stringify({ success: true, correlationId, active: !!active, targetUserId }),
        { status: 200, headers: { ...cors, 'Content-Type': 'application/json' } }
      );
    }

    // ------------------------------------------------------------------
    // AÇÃO 4: ALTERAR CARGO (ROLE)
    // ------------------------------------------------------------------
    if (action === 'change_user_role') {
      const { targetUserId } = body;
      const targetRole = body.newRole || body.targetRole || body.role;

      if (!isSuperAdmin && (targetRole === 'ROLE_SUPER_ADMIN' || targetRole === 'ROLE_MANAGER')) {
        return new Response(
          JSON.stringify({ success: false, error: 'Apenas Super Administradores podem conceder privilégios de gerência ou administração global.' }),
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

      await supabaseAdmin.from('profiles').update({ role: targetRole }).eq('id', targetUserId);

      await supabaseAdmin.from('security_audit_logs').insert({
        company_id: targetProf.company_id,
        user_id: callerUser.id,
        event_type: 'ROLE_CHANGED',
        ip_address: clientIp,
        metadata: { target_user_id: targetUserId, old_role: targetProf.role, new_role: targetRole, correlation_id: correlationId },
      });

      return new Response(
        JSON.stringify({ success: true, correlationId, role: targetRole }),
        { status: 200, headers: { ...cors, 'Content-Type': 'application/json' } }
      );
    }

    // ------------------------------------------------------------------
    // AÇÃO 5: CONTROLES DE CACHE / DATABASE / MANUTENÇÃO (SUPER ADMIN ONLY)
    // ------------------------------------------------------------------
    if (action === 'clear_cache' || action === 'clear_database' || action === 'maintenance') {
      if (!isSuperAdmin) {
        return new Response(
          JSON.stringify({ success: false, error: 'Acesso negado. Ações de manutenção e limpeza são restritas ao Super Administrador.' }),
          { status: 403, headers: { ...cors, 'Content-Type': 'application/json' } }
        );
      }

      const { confirmationPhrase } = body;
      if (action === 'clear_database' && confirmationPhrase !== 'LIMPAR') {
        return new Response(
          JSON.stringify({ success: false, error: 'Confirmação inválida. Digite LIMPAR para confirmar a ação de manutenção.' }),
          { status: 400, headers: { ...cors, 'Content-Type': 'application/json' } }
        );
      }

      await supabaseAdmin.from('security_audit_logs').insert({
        company_id: null,
        user_id: callerUser.id,
        event_type: 'ADMIN_MAINTENANCE_ACTION',
        ip_address: clientIp,
        metadata: { action, correlation_id: correlationId },
      });

      return new Response(
        JSON.stringify({ success: true, correlationId, message: 'Ação de manutenção registrada e executada com sucesso.' }),
        { status: 200, headers: { ...cors, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ success: false, error: 'Ação não reconhecida.' }),
      { status: 400, headers: { ...cors, 'Content-Type': 'application/json' } }
    );
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Erro interno.';
    console.error(`[CID:${correlationId}] [ERRO admin-manage-user]:`, msg);
    return new Response(
      JSON.stringify({ success: false, error: msg || 'Erro ao processar solicitação administrativa.' }),
      { status: 500, headers: { ...cors, 'Content-Type': 'application/json' } }
    );
  }
});
