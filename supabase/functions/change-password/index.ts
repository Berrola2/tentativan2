// ==============================================================================
// SUPABASE EDGE FUNCTION: change-password (ETAPA 02)
// ==============================================================================
// Troca segura de senha e liberação do flag must_change_password
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

    // 1. Identificar usuário autenticado
    const { data: { user }, error: authErr } = await supabaseAdmin.auth.getUser(token);

    if (authErr || !user) {
      return new Response(
        JSON.stringify({ success: false, error: 'Sessão inválida ou expirada.' }),
        { status: 401, headers: { ...cors, 'Content-Type': 'application/json' } }
      );
    }

    const { newPassword } = await req.json();

    if (!newPassword || typeof newPassword !== 'string' || newPassword.length < 8) {
      return new Response(
        JSON.stringify({ success: false, error: 'A nova senha deve possuir pelo menos 8 caracteres.' }),
        { status: 400, headers: { ...cors, 'Content-Type': 'application/json' } }
      );
    }

    // Validação de complexidade (maiúscula, minúscula, número)
    const hasUpper = /[A-Z]/.test(newPassword);
    const hasLower = /[a-z]/.test(newPassword);
    const hasNumber = /[0-9]/.test(newPassword);

    if (!hasUpper || !hasLower || !hasNumber) {
      return new Response(
        JSON.stringify({ success: false, error: 'A nova senha deve conter pelo menos 1 letra maiúscula, 1 minúscula e 1 número.' }),
        { status: 400, headers: { ...cors, 'Content-Type': 'application/json' } }
      );
    }

    // 2. Atualizar senha no Supabase Auth
    const { error: updateAuthErr } = await supabaseAdmin.auth.admin.updateUserById(user.id, {
      password: newPassword,
    });

    if (updateAuthErr) {
      return new Response(
        JSON.stringify({ success: false, error: `Erro ao atualizar senha: ${updateAuthErr.message}` }),
        { status: 500, headers: { ...cors, 'Content-Type': 'application/json' } }
      );
    }

    // 3. Atualizar flag must_change_password = false
    await supabaseAdmin
      .from('profiles')
      .update({ must_change_password: false, updated_at: new Date().toISOString() })
      .eq('id', user.id);

    // 4. Log de auditoria
    await supabaseAdmin.from('security_audit_logs').insert({
      user_id: user.id,
      event_type: 'PASSWORD_CHANGED',
      metadata: { action: 'first_access_or_self_reset' },
    });

    return new Response(
      JSON.stringify({ success: true, message: 'Senha atualizada com sucesso!' }),
      { status: 200, headers: { ...cors, 'Content-Type': 'application/json' } }
    );
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Erro interno.';
    console.error('[ERRO change-password]:', msg);
    return new Response(
      JSON.stringify({ success: false, error: 'Erro ao processar alteração de senha.' }),
      { status: 500, headers: { ...cors, 'Content-Type': 'application/json' } }
    );
  }
});
