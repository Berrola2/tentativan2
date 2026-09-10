// ==============================================================================
// SUPABASE EDGE FUNCTION: login-with-yzzy (FLUXO CANÔNICO DE AUTENTICAÇÃO)
// ==============================================================================
// Endpoint de login baseado no identificador Login YZZY (nome.sobrenome@empresa.yzzy)
// Implementa Rate Limiting duplo, resolução 100% read-only, anti-enumeração e observabilidade
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

  // 1. Limitação de Tamanho de Payload
  const rawBody = await req.text();
  if (rawBody.length > 4096) {
    return new Response(
      JSON.stringify({ success: false, error: 'Payload excessivamente grande.' }),
      { status: 413, headers: { ...cors, 'Content-Type': 'application/json' } }
    );
  }

  const correlationId = crypto.randomUUID();
  const AUTH_FUNCTION_VERSION = '2026-09-10-v5-canonical';

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY') || serviceRoleKey;

    if (!supabaseUrl || !serviceRoleKey) {
      console.error(`[CID:${correlationId}] [CONFIG_ERROR] SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY ausentes.`);
      return new Response(
        JSON.stringify({ success: false, error: 'Erro de configuração interna do servidor.' }),
        { status: 500, headers: { ...cors, 'Content-Type': 'application/json' } }
      );
    }

    let parsedBody: Record<string, unknown>;
    try {
      parsedBody = JSON.parse(rawBody);
    } catch {
      return new Response(
        JSON.stringify({ success: false, error: 'JSON inválido.' }),
        { status: 400, headers: { ...cors, 'Content-Type': 'application/json' } }
      );
    }

    const { login, password } = parsedBody;

    if (!login || !password || typeof login !== 'string' || typeof password !== 'string') {
      return new Response(
        JSON.stringify({ success: false, error: 'Login ou senha inválidos.' }),
        { status: 400, headers: { ...cors, 'Content-Type': 'application/json' } }
      );
    }

    const cleanLogin = login.trim().toLowerCase();
    console.log(`[CID:${correlationId}] [LOGIN_RECEIVED] Versão: ${AUTH_FUNCTION_VERSION} | Alias: ${cleanLogin}`);

    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const clientIp = req.headers.get('cf-connecting-ip') || 
                     req.headers.get('x-real-ip') || 
                     req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 
                     'ip-desconhecido';

    const ipRateLimitKey = `ip:${clientIp}`;
    const loginRateLimitKey = `login:${cleanLogin}`;

    // 2. Rate Limiting por IP (Max 10 tentativas / 5 min, lock 15 min)
    const { data: ipLimitData } = await supabaseAdmin.rpc('check_and_record_login_attempt', {
      p_identifier: ipRateLimitKey,
      p_max_attempts: 10,
      p_window_seconds: 300,
      p_lock_seconds: 900,
    });

    const ipLimit = Array.isArray(ipLimitData) ? ipLimitData[0] : ipLimitData;
    if (ipLimit && !ipLimit.allowed) {
      console.warn(`[CID:${correlationId}] [RATE_LIMIT_IP_BLOCKED] IP: ${clientIp}`);
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Muitas tentativas a partir deste endereço IP. Acesso temporariamente bloqueado. Tente novamente mais tarde.',
          retryAfterSeconds: ipLimit.retry_after_seconds || 900,
        }),
        { 
          status: 429, 
          headers: { 
            ...cors, 
            'Content-Type': 'application/json',
            'Retry-After': String(ipLimit.retry_after_seconds || 900),
          } 
        }
      );
    }

    // 3. Rate Limiting por Login Específico (Max 5 tentativas / 5 min, lock 15 min)
    const { data: loginLimitData } = await supabaseAdmin.rpc('check_and_record_login_attempt', {
      p_identifier: loginRateLimitKey,
      p_max_attempts: 5,
      p_window_seconds: 300,
      p_lock_seconds: 900,
    });

    const loginLimit = Array.isArray(loginLimitData) ? loginLimitData[0] : loginLimitData;
    if (loginLimit && !loginLimit.allowed) {
      console.warn(`[CID:${correlationId}] [RATE_LIMIT_ACCOUNT_BLOCKED] Login: ${cleanLogin}`);
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Muitas tentativas para este usuário. Acesso temporariamente bloqueado. Tente novamente em alguns minutos.',
          retryAfterSeconds: loginLimit.retry_after_seconds || 900,
        }),
        { 
          status: 429, 
          headers: { 
            ...cors, 
            'Content-Type': 'application/json',
            'Retry-After': String(loginLimit.retry_after_seconds || 900),
          } 
        }
      );
    }

    // 4. Resolução da Identidade Interna (Login YZZY -> auth_email real de auth.users via RPC READ-ONLY)
    console.log(`[CID:${correlationId}] [IDENTITY_RESOLUTION_STARTED] Alias: ${cleanLogin}`);

    const { data: rpcRows, error: rpcErr } = await supabaseAdmin.rpc('resolve_login_yzzy_identity', {
      p_login_alias: cleanLogin,
    });

    if (rpcErr || !Array.isArray(rpcRows) || rpcRows.length === 0) {
      console.warn(`[CID:${correlationId}] [IDENTITY_NOT_FOUND] Alias não cadastrado em private.user_auth_identities. Erro RPC: ${rpcErr?.message || 'Nenhum registro encontrado.'}`);

      // Registrar falha de auditoria sem expor detalhes internos
      await supabaseAdmin.from('security_audit_logs').insert({
        company_id: null,
        event_type: 'LOGIN_FAILED',
        ip_address: clientIp,
        metadata: { login_attempt: cleanLogin, correlation_id: correlationId, reason: 'identity_not_found' },
      });

      // Abortar imediatamente com erro 401 seguro
      return new Response(
        JSON.stringify({ success: false, error: 'Login ou senha inválidos.' }),
        { status: 401, headers: { ...cors, 'Content-Type': 'application/json' } }
      );
    }

    const identityUser = rpcRows[0];
    const internalAuthEmail = identityUser.auth_email;
    const userId = identityUser.user_id;

    console.log(`[CID:${correlationId}] [IDENTITY_FOUND] UserId: ${userId} | Role: ${identityUser.role} | Active: ${identityUser.active} | MustChangePass: ${identityUser.must_change_password}`);

    // 5. Validar Perfil e Empresa Ativos
    if (!identityUser.active) {
      console.warn(`[CID:${correlationId}] [USER_INACTIVE] Usuário ${userId} está desativado.`);
      return new Response(
        JSON.stringify({ success: false, error: 'Login ou senha inválidos.' }),
        { status: 401, headers: { ...cors, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[CID:${correlationId}] [PROFILE_VALID] Perfil ${userId} ativo com sucesso.`);

    if (identityUser.company_id && !identityUser.company_active) {
      console.warn(`[CID:${correlationId}] [COMPANY_INACTIVE] Empresa ${identityUser.company_id} está inativa.`);
      return new Response(
        JSON.stringify({ success: false, error: 'Login ou senha inválidos.' }),
        { status: 401, headers: { ...cors, 'Content-Type': 'application/json' } }
      );
    }

    if (identityUser.company_id) {
      console.log(`[CID:${correlationId}] [COMPANY_VALID] Empresa ${identityUser.company_id} ativa com sucesso.`);
    }

    // 6. Autenticação no Supabase Auth usando o email interno real
    console.log(`[CID:${correlationId}] [SIGN_IN_STARTED] Autenticando no Supabase Auth com email: ${internalAuthEmail.split('@')[0]}***@...`);

    const authClient = createClient(supabaseUrl, anonKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const { data: authData, error: authErr } = await authClient.auth.signInWithPassword({
      email: internalAuthEmail,
      password: password,
    });

    if (authErr || !authData?.user || !authData?.session) {
      const errStatus = (authErr as any)?.status || 401;
      const errCode = (authErr as any)?.code || authErr?.name || 'invalid_credentials';
      console.warn(`[CID:${correlationId}] [SIGN_IN_FAILURE] Motivo: ${authErr?.message || 'Sessão nula'} | Código: ${errCode} | Status: ${errStatus}`);

      await supabaseAdmin.from('security_audit_logs').insert({
        company_id: identityUser.company_id,
        event_type: 'LOGIN_FAILED',
        ip_address: clientIp,
        metadata: { login_attempt: cleanLogin, correlation_id: correlationId, error_code: errCode },
      });

      return new Response(
        JSON.stringify({ success: false, error: 'Login ou senha inválidos.' }),
        { status: 401, headers: { ...cors, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[CID:${correlationId}] [SIGN_IN_SUCCESS] Autenticação confirmada no Supabase Auth. AuthUserId: ${authData.user.id}`);

    // 7. Reset dos Contadores de Rate Limit após Sucesso
    await Promise.allSettled([
      supabaseAdmin.rpc('reset_login_rate_limit', { p_identifier: ipRateLimitKey }),
      supabaseAdmin.rpc('reset_login_rate_limit', { p_identifier: loginRateLimitKey }),
    ]);

    // 8. Registrar auditoria de sucesso
    await supabaseAdmin.from('security_audit_logs').insert({
      user_id: userId,
      company_id: identityUser.company_id,
      event_type: 'LOGIN_SUCCESS',
      ip_address: clientIp,
      metadata: { role: identityUser.role, login: cleanLogin, correlation_id: correlationId },
    });

    const responsePayload = {
      success: true,
      correlationId,
      session: {
        access_token: authData.session.access_token,
        refresh_token: authData.session.refresh_token,
        expires_in: authData.session.expires_in,
        expires_at: authData.session.expires_at,
        token_type: authData.session.token_type,
      },
      user: {
        id: identityUser.user_id,
        username: identityUser.username,
        fullName: identityUser.full_name,
        displayName: identityUser.display_name,
        role: identityUser.role,
        active: identityUser.active,
        mustChangePassword: identityUser.must_change_password,
        companyId: identityUser.company_id || null,
        companyName: identityUser.company_name || null,
        companySlug: identityUser.company_slug || null,
        loginAlias: cleanLogin,
      },
    };

    console.log(`[CID:${correlationId}] [LOGIN_COMPLETED] Resposta HTTP 200 emitida com sucesso.`);

    return new Response(
      JSON.stringify(responsePayload),
      { status: 200, headers: { ...cors, 'Content-Type': 'application/json' } }
    );
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Erro interno.';
    console.error(`[CID:${correlationId}] [ERRO login-with-yzzy]:`, message);
    return new Response(
      JSON.stringify({ success: false, error: 'Erro ao processar autenticação. Tente novamente.' }),
      { status: 500, headers: { ...cors, 'Content-Type': 'application/json' } }
    );
  }
});
