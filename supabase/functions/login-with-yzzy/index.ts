// ==============================================================================
// SUPABASE EDGE FUNCTION: login-with-yzzy (ETAPA 02.1 — HARDENING COMPLETO)
// ==============================================================================
// Endpoint de login baseado no identificador Login YZZY (nome.sobrenome@empresa.yzzy)
// Implementa Rate Limiting duplo por IP e Identificador, anti-enumeração e auditoria segura
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

  // 1. Limitação de Tamanho de Payload (Max 4KB para evitar ataques de estouro)
  const rawBody = await req.text();
  if (rawBody.length > 4096) {
    return new Response(
      JSON.stringify({ success: false, error: 'Payload excessivamente grande.' }),
      { status: 413, headers: { ...cors, 'Content-Type': 'application/json' } }
    );
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!supabaseUrl || !serviceRoleKey) {
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

    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const clientIp = req.headers.get('cf-connecting-ip') || 
                     req.headers.get('x-real-ip') || 
                     req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 
                     'ip-desconhecido';

    const ipRateLimitKey = `ip:${clientIp}`;
    const loginRateLimitKey = `login:${cleanLogin}`;

    // 2. Rate Limiting por IP (Max 10 tentativas a cada 5 min, lock de 15 min)
    const { data: ipLimitData } = await supabaseAdmin.rpc('check_and_record_login_attempt', {
      p_identifier: ipRateLimitKey,
      p_max_attempts: 10,
      p_window_seconds: 300,
      p_lock_seconds: 900,
    });

    const ipLimit = Array.isArray(ipLimitData) ? ipLimitData[0] : ipLimitData;
    if (ipLimit && !ipLimit.allowed) {
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

    // 3. Rate Limiting por Login Específico (Max 5 tentativas a cada 5 min, lock de 15 min)
    const { data: loginLimitData } = await supabaseAdmin.rpc('check_and_record_login_attempt', {
      p_identifier: loginRateLimitKey,
      p_max_attempts: 5,
      p_window_seconds: 300,
      p_lock_seconds: 900,
    });

    const loginLimit = Array.isArray(loginLimitData) ? loginLimitData[0] : loginLimitData;
    if (loginLimit && !loginLimit.allowed) {
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

    // 4. Resolução da Identidade Interna (Login YZZY -> auth_email)
    let internalAuthEmail = cleanLogin;

    // Buscar no mapeamento privado
    const { data: identityData } = await supabaseAdmin
      .from('user_auth_identities')
      .select('user_id, company_id, auth_email')
      .eq('login_alias', cleanLogin)
      .maybeSingle();

    if (identityData) {
      internalAuthEmail = identityData.auth_email;
    }

    // 5. Autenticação no Supabase Auth
    const { data: authData, error: authErr } = await supabaseAdmin.auth.signInWithPassword({
      email: internalAuthEmail,
      password: password,
    });

    if (authErr || !authData?.user || !authData?.session) {
      // Registrar falha de auditoria (sem atribuir company_id não autenticado)
      await supabaseAdmin.from('security_audit_logs').insert({
        company_id: null,
        event_type: 'LOGIN_FAILED',
        ip_address: clientIp,
        metadata: { login_attempt: cleanLogin },
      });

      return new Response(
        JSON.stringify({ success: false, error: 'Login ou senha inválidos.' }),
        { status: 401, headers: { ...cors, 'Content-Type': 'application/json' } }
      );
    }

    const userId = authData.user.id;

    // 6. Validar se o perfil e a empresa estão ativos no banco
    const { data: profileData, error: profErr } = await supabaseAdmin
      .from('profiles')
      .select('id, company_id, username, full_name, display_name, role, active, must_change_password')
      .eq('id', userId)
      .maybeSingle();

    if (profErr || !profileData || !profileData.active) {
      return new Response(
        JSON.stringify({ success: false, error: 'Login ou senha inválidos.' }),
        { status: 401, headers: { ...cors, 'Content-Type': 'application/json' } }
      );
    }

    let companyData: { id: string; name: string; slug: string; active: boolean } | null = null;
    if (profileData.company_id) {
      const { data: comp } = await supabaseAdmin
        .from('companies')
        .select('id, name, slug, active')
        .eq('id', profileData.company_id)
        .maybeSingle();

      if (!comp || !comp.active) {
        return new Response(
          JSON.stringify({ success: false, error: 'Login ou senha inválidos.' }),
          { status: 401, headers: { ...cors, 'Content-Type': 'application/json' } }
        );
      }
      companyData = comp;
    }

    // 7. Reset dos Contadores de Rate Limit após Sucesso
    await Promise.allSettled([
      supabaseAdmin.rpc('reset_login_rate_limit', { p_identifier: ipRateLimitKey }),
      supabaseAdmin.rpc('reset_login_rate_limit', { p_identifier: loginRateLimitKey }),
    ]);

    // 8. Registrar auditoria de sucesso
    await supabaseAdmin.from('security_audit_logs').insert({
      user_id: userId,
      company_id: profileData.company_id,
      event_type: 'LOGIN_SUCCESS',
      ip_address: clientIp,
      metadata: { role: profileData.role, login: cleanLogin },
    });

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
        id: profileData.id,
        username: profileData.username,
        fullName: profileData.full_name,
        displayName: profileData.display_name || profileData.full_name,
        role: profileData.role,
        active: profileData.active,
        mustChangePassword: profileData.must_change_password,
        companyId: profileData.company_id || null,
        companyName: companyData?.name || null,
        companySlug: companyData?.slug || null,
        loginAlias: cleanLogin,
      },
    };

    return new Response(
      JSON.stringify(responsePayload),
      { status: 200, headers: { ...cors, 'Content-Type': 'application/json' } }
    );
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Erro interno.';
    console.error('[ERRO login-with-yzzy]:', message);
    return new Response(
      JSON.stringify({ success: false, error: 'Erro ao processar autenticação. Tente novamente.' }),
      { status: 500, headers: { ...cors, 'Content-Type': 'application/json' } }
    );
  }
});
