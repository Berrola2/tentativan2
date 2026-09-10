const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// Carregar .env
const envPath = path.join(__dirname, '..', '.env');
const envVars = {};
if (fs.existsSync(envPath)) {
  const content = fs.readFileSync(envPath, 'utf8');
  content.split('\n').forEach(line => {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith('#')) {
      const idx = trimmed.indexOf('=');
      if (idx > -1) {
        const key = trimmed.substring(0, idx).trim();
        let val = trimmed.substring(idx + 1).trim();
        if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
          val = val.substring(1, val.length - 1);
        }
        envVars[key] = val;
      }
    }
  });
}

const supabaseUrl = process.env.SUPABASE_URL || envVars.VITE_SUPABASE_URL || 'https://wyyigrlqxwjxjqkazeof.supabase.co';
const anonKey = process.env.SUPABASE_ANON_KEY || envVars.VITE_SUPABASE_PUBLISHABLE_KEY || envVars.VITE_SUPABASE_ANON_KEY;
const secretKey = 
  process.env.SUPABASE_SECRET_KEY || 
  process.env.SUPABASE_SERVICE_ROLE_KEY || 
  envVars.SUPABASE_SECRET_KEY || 
  envVars.SUPABASE_SERVICE_ROLE_KEY;

async function diagnose() {
  console.log('====================================================================');
  console.log('🔍 DIAGNÓSTICO PROFUNDO — SUPER ADMIN & AUTENTICAÇÃO');
  console.log('Endpoint :', supabaseUrl);
  console.log('SecretKey:', secretKey ? 'Configurada (***)' : 'NÃO CONFIGURADA');
  console.log('AnonKey  :', anonKey ? 'Configurada (***)' : 'NÃO CONFIGURADA');
  console.log('====================================================================\n');

  if (!secretKey) {
    console.error('[ERRO] SUPABASE_SECRET_KEY não encontrada no ambiente.');
    process.exit(1);
  }

  const supabaseAdmin = createClient(supabaseUrl, secretKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  // 1. Consultar Profiles ROLE_SUPER_ADMIN
  console.log('--- 1. CONSULTANDO PUBLIC.PROFILES (ROLE_SUPER_ADMIN) ---');
  const { data: profiles, error: profErr } = await supabaseAdmin
    .from('profiles')
    .select('id, username, full_name, role, active, must_change_password, company_id')
    .eq('role', 'ROLE_SUPER_ADMIN');

  if (profErr) {
    console.error('Erro em profiles:', profErr);
  } else {
    console.log(`Encontrados ${profiles.length} Super Admin(s):`);
    profiles.forEach(p => console.log(JSON.stringify(p, null, 2)));
  }

  // 2. Consultar Private.user_auth_identities
  console.log('\n--- 2. CONSULTANDO PRIVATE.USER_AUTH_IDENTITIES ---');
  const { data: identities, error: idErr } = await supabaseAdmin
    .schema('private')
    .from('user_auth_identities')
    .select('id, user_id, company_id, login_alias, auth_email');

  if (idErr) {
    console.error('Erro em user_auth_identities:', idErr);
  } else {
    console.log(`Encontradas ${identities.length} identidade(s) no schema private:`);
    identities.forEach(id => {
      // Mascarar email para exibição
      const emailParts = (id.auth_email || '').split('@');
      const maskedEmail = emailParts.length === 2 
        ? `${emailParts[0].substring(0, 4)}***@${emailParts[1]}` 
        : '***';
      console.log(`  - ID: ${id.id} | user_id: ${id.user_id} | alias: ${id.login_alias} | auth_email: ${maskedEmail}`);
    });
  }

  // 3. Consultar Auth.users
  console.log('\n--- 3. CONSULTANDO SUPABASE AUTH.USERS (ADMIN API) ---');
  if (profiles && profiles.length > 0) {
    for (const p of profiles) {
      const { data: authUser, error: authErr } = await supabaseAdmin.auth.admin.getUserById(p.id);
      if (authErr) {
        console.error(`Erro ao buscar auth user ${p.id}:`, authErr);
      } else {
        const u = authUser.user;
        const emailParts = (u.email || '').split('@');
        const maskedEmail = emailParts.length === 2 
          ? `${emailParts[0].substring(0, 4)}***@${emailParts[1]}` 
          : '***';
        console.log(`  - Auth ID: ${u.id}`);
        console.log(`    Email: ${maskedEmail}`);
        console.log(`    Email Confirmed At: ${u.email_confirmed_at}`);
        console.log(`    Banned Until: ${u.banned_until}`);
        console.log(`    Confirmed At: ${u.confirmed_at}`);
        console.log(`    Last Sign In: ${u.last_sign_in_at}`);
      }
    }
  }

  console.log('\n====================================================================');
  console.log('DIAGNÓSTICO DE BANCO CONCLUÍDO.');
  console.log('====================================================================\n');
}

diagnose();
