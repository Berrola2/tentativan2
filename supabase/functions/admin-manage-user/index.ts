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
      return new Response(
        JSON.stringify({ success: false, error: 'Usuário sem permissão ou inativo.' }),
        { status: 403, headers: { ...cors, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[CID:${correlationId}] [PROFILE_FOUND] Role: ${callerProfile.role} | Active: ${callerProfile.active} | CompanyId: ${callerProfile.company_id || 'NULL'}`);

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
          JSON.stringify({ success: false, error: 'Empresa inativa ou inexistente.' }),
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
    // AÇÃO 3: ALTERAR STATUS DE USUÁRIO (ATIVAR/DESATIVAR)
    // ------------------------------------------------------------------
    if (action === 'toggle_user_status') {
      const { targetUserId, active } = body;

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
        ip_address: clientIp,
        metadata: { target_user_id: targetUserId, correlation_id: correlationId },
      });

      return new Response(
        JSON.stringify({ success: true, correlationId, active: !!active }),
        { status: 200, headers: { ...cors, 'Content-Type': 'application/json' } }
      );
    }

    // ------------------------------------------------------------------
    // AÇÃO 4: ALTERAR CARGO (ROLE)
    // ------------------------------------------------------------------
    if (action === 'change_user_role') {
      const { targetUserId, newRole } = body;

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
        ip_address: clientIp,
        metadata: { target_user_id: targetUserId, old_role: targetProf.role, new_role: newRole, correlation_id: correlationId },
      });

      return new Response(
        JSON.stringify({ success: true, correlationId, role: newRole }),
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
