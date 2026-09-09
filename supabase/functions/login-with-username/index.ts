// ==============================================================================
// SUPABASE EDGE FUNCTION: login-with-username (ETAPA 3.1 — HARDENING COMPLETO)
// ==============================================================================
// Endpoint público de login oficial baseado em (companySlug + username + password).
// Configuração recomendada no Supabase: verify_jwt = false (endpoint pré-autenticação).
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

  // 1. Tratar Preflight CORS
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: cors });
  }

  // 2. Bloquear Métodos Não Permitidos (Apenas POST é aceito)
  if (req.method !== 'POST') {
    return new Response(
      JSON.stringify({ success: false, error: 'Método não permitido. Utilize POST.' }),
      { 
        status: 405, 
        headers: { 
          ...cors, 
          'Content-Type': 'application/json',
          'Allow': 'POST, OPTIONS' 
        } 
      }
    );
  }

  // 3. Validação de Content-Type
  const contentType = req.headers.get('content-type') || '';
  if (!contentType.includes('application/json')) {
    return new Response(
      JSON.stringify({ success: false, error: 'Content-Type inválido. Esperado application/json.' }),
      { status: 400, headers: { ...cors, 'Content-Type': 'application/json' } }
    );
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!supabaseUrl || !serviceRoleKey) {
      console.error('[ERRO FATAL] Configuração do servidor ausente (SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY).');
      return new Response(
        JSON.stringify({ success: false, error: 'Erro de configuração interna do servidor.' }),
        { status: 500, headers: { ...cors, 'Content-Type': 'application/json' } }
      );
    }

    // 4. Validação de Tamanho do Payload (Máximo 4KB)
    const rawText = await req.text();
    if (rawText.length > 4096) {
      return new Response(
        JSON.stringify({ success: false, error: 'Payload excessivamente grande.' }),
        { status: 413, headers: { ...cors, 'Content-Type': 'application/json' } }
      );
    }

    let parsedBody: Record<string, unknown>;
    try {
      parsedBody = JSON.parse(rawText);
    } catch {
      return new Response(
        JSON.stringify({ success: false, error: 'JSON malformado.' }),
        { status: 400, headers: { ...cors, 'Content-Type': 'application/json' } }
      );
    }

    // 5. Validação Estrita de Schema (Rejeitar/Ignorar injeção de campos não autorizados)
    const allowedKeys = new Set(['companySlug', 'username', 'password']);
    const bodyKeys = Object.keys(parsedBody);
    const hasForbiddenKeys = bodyKeys.some((k) => !allowedKeys.has(k));

    if (hasForbiddenKeys) {
      // Rejeita requisições com campos extras (como auth_email, role, company_id, isAdmin)
      return new Response(
        JSON.stringify({ success: false, error: 'Campos não autorizados no payload.' }),
        { status: 400, headers: { ...cors, 'Content-Type': 'application/json' } }
      );
    }

    const rawSlug = parsedBody.companySlug;
    const rawUsername = parsedBody.username;
    const rawPassword = parsedBody.password;

    if (!rawSlug || !rawUsername || !rawPassword || typeof rawSlug !== 'string' || typeof rawUsername !== 'string' || typeof rawPassword !== 'string') {
      return new Response(
        JSON.stringify({ success: false, error: 'Empresa, usuário e senha são obrigatórios.' }),
        { status: 400, headers: { ...cors, 'Content-Type': 'application/json' } }
      );
    }

    const companySlug = rawSlug.trim().toLowerCase();
    const username = rawUsername.trim().toLowerCase();
    const password = rawPassword;

    // Validação estrita de formato de caracteres
    if (companySlug.length < 2 || companySlug.length > 50 || !/^[a-z0-9_-]+$/.test(companySlug)) {
      return new Response(
        JSON.stringify({ success: false, error: 'Usuário ou senha inválidos.' }),
        { status: 401, headers: { ...cors, 'Content-Type': 'application/json' } }
      );
    }

    if (username.length < 2 || username.length > 50 || !/^[a-z0-9_.-]+$/.test(username)) {
      return new Response(
        JSON.stringify({ success: false, error: 'Usuário ou senha inválidos.' }),
        { status: 401, headers: { ...cors, 'Content-Type': 'application/json' } }
      );
    }

    // Cliente administrativo com Service Role isolado no runtime da Edge Function
    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    // 6. Rate Limiting Duplo (Por IP e por Conta Alvo)
    const clientIp = req.headers.get('cf-connecting-ip') || 
                     req.headers.get('x-real-ip') || 
                     req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 
                     'ip-desconhecido';

    const ipRateLimitKey = `ip:${clientIp}`;
    const accountRateLimitKey = `account:${companySlug}:${username}`;

    // Verificação 1: Rate Limit por IP
    const { data: ipLimitRes } = await supabaseAdmin.rpc('check_and_record_login_attempt', {
      p_identifier: ipRateLimitKey,
      p_max_attempts: 10,
      p_window_seconds: 300,
      p_lock_seconds: 900,
    });

    if (ipLimitRes && !ipLimitRes.allowed) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Muitas tentativas a partir deste endereço IP. Acesso temporariamente bloqueado. Tente novamente mais tarde.',
          retryAfterSeconds: ipLimitRes.retry_after_seconds || 900,
        }),
        { 
          status: 429, 
          headers: { 
            ...cors, 
            'Content-Type': 'application/json',
            'Retry-After': String(ipLimitRes.retry_after_seconds || 900),
          } 
        }
      );
    }

    // Verificação 2: Rate Limit por Conta Específica
    const { data: accLimitRes } = await supabaseAdmin.rpc('check_and_record_login_attempt', {
      p_identifier: accountRateLimitKey,
      p_max_attempts: 5,
      p_window_seconds: 300,
      p_lock_seconds: 900,
    });

    if (accLimitRes && !accLimitRes.allowed) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Muitas tentativas inválidas para este usuário. Acesso temporariamente bloqueado. Tente novamente em alguns minutos.',
          retryAfterSeconds: accLimitRes.retry_after_seconds || 900,
        }),
        { 
          status: 429, 
          headers: { 
            ...cors, 
            'Content-Type': 'application/json',
            'Retry-After': String(accLimitRes.retry_after_seconds || 900),
          } 
        }
      );
    }

    // 7. Resolução da Identidade Interna na Tabela Privada (user_auth_identities)
    const { data: resolvedUsers, error: resolveErr } = await supabaseAdmin.rpc(
      'resolve_user_auth_email',
      {
        p_company_slug: companySlug,
        p_username: username,
      }
    );

    if (resolveErr || !resolvedUsers || resolvedUsers.length === 0) {
      // Resposta genérica anti-enumeração
      return new Response(
        JSON.stringify({ success: false, error: 'Usuário ou senha inválidos.' }),
        { status: 401, headers: { ...cors, 'Content-Type': 'application/json' } }
      );
    }

    const targetUser = resolvedUsers[0];
    const internalAuthEmail = targetUser.auth_email;

    if (!internalAuthEmail) {
      return new Response(
        JSON.stringify({ success: false, error: 'Usuário ou senha inválidos.' }),
        { status: 401, headers: { ...cors, 'Content-Type': 'application/json' } }
      );
    }

    // 8. Autenticação Oficial no Supabase Auth
    const { data: authData, error: authError } = await supabaseAdmin.auth.signInWithPassword({
      email: internalAuthEmail,
      password: password,
    });

    if (authError || !authData.session) {
      return new Response(
        JSON.stringify({ success: false, error: 'Usuário ou senha inválidos.' }),
        { status: 401, headers: { ...cors, 'Content-Type': 'application/json' } }
      );
    }

    // 9. Reset dos Contadores de Rate Limit após Sucesso
    await Promise.allSettled([
      supabaseAdmin.rpc('reset_login_rate_limit', { p_identifier: ipRateLimitKey }),
      supabaseAdmin.rpc('reset_login_rate_limit', { p_identifier: accountRateLimitKey }),
    ]);

    // 10. Retorno Limpo dos Tokens Oficiais e Metadados do Usuário
    const responsePayload = {
      success: true,
      session: {
        access_token: authData.session.access_token,
        refresh_token: authData.session.refresh_token,
        expires_in: authData.session.expires_in,
        expires_at: authData.session.expires_at,
        token_type: authData.session.token_type,
      },
      user: {
        id: targetUser.user_id,
        username: targetUser.username || username,
        fullName: targetUser.full_name,
        role: targetUser.role,
        companyId: targetUser.company_id,
        companyName: targetUser.company_name,
        companySlug: targetUser.company_slug,
      },
    };

    return new Response(
      JSON.stringify(responsePayload),
      { status: 200, headers: { ...cors, 'Content-Type': 'application/json' } }
    );
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : 'Erro interno.';
    console.error('[ERRO LOGIN]', errorMsg);

    return new Response(
      JSON.stringify({ success: false, error: 'Erro ao processar autenticação. Tente novamente.' }),
      { status: 500, headers: { ...cors, 'Content-Type': 'application/json' } }
    );
  }
});
