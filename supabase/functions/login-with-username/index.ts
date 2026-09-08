// ==============================================================================
// SUPABASE EDGE FUNCTION: login-with-username
// ==============================================================================
// Autenticação oficial com Supabase Auth baseada em (companySlug + username + password)
// Sem expor e-mail técnico interno, sem expor service_role e protegido contra enumeração.
// ==============================================================================

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.112.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

interface LoginRequestBody {
  companySlug?: string;
  username?: string;
  password?: string;
}

serve(async (req: Request) => {
  // 1. Tratar Preflight CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return new Response(
      JSON.stringify({ success: false, error: 'Método não permitido.' }),
      { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!supabaseUrl || !serviceRoleKey) {
      console.error('Configuração do servidor ausente: SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY.');
      return new Response(
        JSON.stringify({ success: false, error: 'Erro de configuração no servidor.' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Cliente administrativo com Service Role (apenas dentro da Edge Function)
    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    // 2. Parse e Validação de Entrada
    const body: LoginRequestBody = await req.json().catch(() => ({}));
    const rawSlug = body.companySlug;
    const rawUsername = body.username;
    const rawPassword = body.password;

    if (!rawSlug || !rawUsername || !rawPassword) {
      return new Response(
        JSON.stringify({ success: false, error: 'Empresa, usuário e senha são obrigatórios.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const companySlug = String(rawSlug).trim().toLowerCase();
    const username = String(rawUsername).trim().toLowerCase();
    const password = String(rawPassword);

    // Validação estrita de formato
    if (companySlug.length < 2 || companySlug.length > 50 || !/^[a-z0-9_-]+$/.test(companySlug)) {
      return new Response(
        JSON.stringify({ success: false, error: 'Usuário ou senha inválidos.' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (username.length < 2 || username.length > 50 || !/^[a-z0-9_.-]+$/.test(username)) {
      return new Response(
        JSON.stringify({ success: false, error: 'Usuário ou senha inválidos.' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 3. Rate Limiting por IP e por Conta
    const clientIp = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 
                     req.headers.get('cf-connecting-ip') || 
                     'anonymous-ip';
    const rateLimitKey = `login:${clientIp}:${companySlug}:${username}`;

    const { data: rateLimitRes, error: rateLimitErr } = await supabaseAdmin.rpc(
      'check_and_record_login_attempt',
      {
        p_identifier: rateLimitKey,
        p_max_attempts: 5,
        p_window_seconds: 300, // 5 minutos
        p_lock_seconds: 900,   // 15 minutos de bloqueio
      }
    );

    if (rateLimitErr) {
      console.warn('Falha ao verificar rate limit no PostgreSQL:', rateLimitErr);
    } else if (rateLimitRes && !rateLimitRes.allowed) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Muitas tentativas inválidas. Acesso temporariamente bloqueado. Tente novamente mais tarde.',
          retryAfterSeconds: rateLimitRes.retry_after_seconds || 900,
        }),
        { 
          status: 429, 
          headers: { 
            ...corsHeaders, 
            'Content-Type': 'application/json',
            'Retry-After': String(rateLimitRes.retry_after_seconds || 900),
          } 
        }
      );
    }

    // 4. Resolução Segura da Identidade Interna (auth_email)
    const { data: resolvedUsers, error: resolveErr } = await supabaseAdmin.rpc(
      'resolve_user_auth_email',
      {
        p_company_slug: companySlug,
        p_username: username,
      }
    );

    if (resolveErr || !resolvedUsers || resolvedUsers.length === 0) {
      // Erro genérico anti-enumeração
      return new Response(
        JSON.stringify({ success: false, error: 'Usuário ou senha inválidos.' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const targetUser = resolvedUsers[0];
    const internalAuthEmail = targetUser.auth_email;

    if (!internalAuthEmail) {
      return new Response(
        JSON.stringify({ success: false, error: 'Usuário ou senha inválidos.' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 5. Autenticação Oficial no Supabase Auth usando o e-mail técnico interno
    const { data: authData, error: authError } = await supabaseAdmin.auth.signInWithPassword({
      email: internalAuthEmail,
      password: password,
    });

    if (authError || !authData.session) {
      return new Response(
        JSON.stringify({ success: false, error: 'Usuário ou senha inválidos.' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 6. Reset do contador de Rate Limit após sucesso
    await supabaseAdmin.rpc('reset_login_rate_limit', { p_identifier: rateLimitKey }).catch(() => {});

    // 7. Retorno dos dados de sessão oficiais
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
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : 'Erro interno durante a autenticação.';
    console.error('Exceção na Edge Function login-with-username:', errorMsg);

    return new Response(
      JSON.stringify({ success: false, error: 'Erro ao processar autenticação. Tente novamente.' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
