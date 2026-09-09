// ==============================================================================
// VISTORIA YZZY — BOOTSTRAP DO PRIMEIRO SUPER ADMIN (SERVER-SIDE)
// ==============================================================================
// Executa exclusivamente no servidor via Supabase Admin API e RPC segura.
// Registra a identidade no schema private sem violar RLS ou expor tabelas.
// ==============================================================================

const { createClient } = require('@supabase/supabase-js');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

// Carregar .env se existir (apenas para SUPABASE_URL local)
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

// Suporte prioritário ao padrão SUPABASE_SECRET_KEY, com fallback para SUPABASE_SERVICE_ROLE_KEY
const secretKey = 
  process.env.SUPABASE_SECRET_KEY || 
  process.env.SUPABASE_SERVICE_ROLE_KEY || 
  envVars.SUPABASE_SECRET_KEY || 
  envVars.SUPABASE_SERVICE_ROLE_KEY;

function generateSecureTempPassword() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789!@#$%&*';
  const array = new Uint8Array(12);
  crypto.getRandomValues(array);
  let pass = 'Yz#';
  for (let i = 0; i < 9; i++) {
    pass += chars[array[i] % chars.length];
  }
  return pass;
}

async function bootstrapSuperAdmin() {
  console.log('====================================================================');
  console.log('🚀 VISTORIA YZZY — BOOTSTRAP DO PRIMEIRO SUPER ADMIN');
  console.log('Endpoint:', supabaseUrl);
  console.log('====================================================================\n');

  if (!secretKey) {
    console.error('[ERRO] Chave de administração do Supabase não configurada na sessão.');
    console.log('\nComo executar no PowerShell:');
    console.log('  $env:SUPABASE_SECRET_KEY="sua_secret_key_aqui"');
    console.log('  node scripts/bootstrap-super-admin.cjs [senha_temporaria_opcional]');
    console.log('  Remove-Item Env:SUPABASE_SECRET_KEY\n');
    process.exit(1);
  }

  const supabaseAdmin = createClient(supabaseUrl, secretKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const tempPassword = process.argv[2] || generateSecureTempPassword();
  const loginAlias = 'admin@yzzy.yzzy';
  const username = 'superadmin';
  const fullName = 'Super Administrador YZZY';
  const internalAuthEmail = `superadmin_${crypto.randomUUID().replace(/-/g, '').slice(0, 12)}@auth.yzzy.internal`;

  let createdAuthUserId = null;
  let createdProfile = false;

  try {
    // 1. Verificar se já existe algum SUPER_ADMIN cadastrado
    const { data: existingSuperAdmins, error: saCheckErr } = await supabaseAdmin
      .from('profiles')
      .select('id, username, full_name, role, active, must_change_password')
      .eq('role', 'ROLE_SUPER_ADMIN');

    if (saCheckErr) {
      throw new Error(`Falha ao auditar perfis: ${saCheckErr.message}`);
    }

    if (existingSuperAdmins && existingSuperAdmins.length > 0) {
      console.log('⚠️ [AVISO] Já existe Super Admin cadastrado na base de dados:');
      existingSuperAdmins.forEach(sa => {
        console.log(`   - ID: ${sa.id} | Usuário: ${sa.username} | Nome: ${sa.full_name} | Ativo: ${sa.active}`);
      });
      console.log('\nNenhum novo Super Admin foi criado para preservar a segurança da base.\n');
      return;
    }

    console.log('Auditoria confirmada: Nenhum Super Admin existente. Iniciando provisionamento seguro...');

    // 2. Criar usuário no Supabase Auth via Admin API
    const { data: authUser, error: authErr } = await supabaseAdmin.auth.admin.createUser({
      email: internalAuthEmail,
      password: tempPassword,
      email_confirm: true,
      user_metadata: {
        full_name: fullName,
        display_name: 'Super Admin',
      },
    });

    if (authErr || !authUser?.user) {
      throw new Error(`Falha ao criar usuário no Supabase Auth: ${authErr?.message}`);
    }

    createdAuthUserId = authUser.user.id;
    console.log('[OK] 1/3: Usuário criado no Supabase Auth.');

    // 3. Criar perfil em public.profiles com company_id = NULL e must_change_password = true
    const { error: profileErr } = await supabaseAdmin
      .from('profiles')
      .insert({
        id: createdAuthUserId,
        company_id: null,
        username: username,
        full_name: fullName,
        first_name: 'Super',
        last_name: 'Admin',
        display_name: 'Super Admin YZZY',
        role: 'ROLE_SUPER_ADMIN',
        active: true,
        must_change_password: true,
      });

    if (profileErr) {
      throw new Error(`Falha ao criar perfil em public.profiles: ${profileErr.message}`);
    }
    createdProfile = true;
    console.log('[OK] 2/3: Perfil ROLE_SUPER_ADMIN criado em public.profiles (company_id: NULL, must_change_password: TRUE).');

    // 4. Registrar identidade no schema private através da RPC administrativa segura
    const { data: rpcResult, error: rpcErr } = await supabaseAdmin.rpc('admin_bootstrap_super_admin_identity', {
      p_user_id: createdAuthUserId,
      p_auth_email: internalAuthEmail,
      p_login_alias: loginAlias,
    });

    if (rpcErr || !rpcResult?.success) {
      throw new Error(`Falha ao registrar identidade no schema private: ${rpcErr?.message || 'Erro desconhecido na RPC'}`);
    }

    console.log('[OK] 3/3: Identidade registrada com sucesso em private.user_auth_identities.');

    console.log('\n====================================================================');
    console.log('✅ [SUCESSO] PRIMEIRO SUPER ADMIN PROVISIONADO COM SUCESSO!');
    console.log('====================================================================');
    console.log(`Login YZZY        : ${loginAlias}`);
    console.log(`Senha Temporária  : ${tempPassword}`);
    console.log(`Papel (Role)      : ROLE_SUPER_ADMIN`);
    console.log(`Empresa           : Global (company_id = NULL)`);
    console.log(`Troca Obrigatória : Sim (must_change_password = TRUE)`);
    console.log('====================================================================\n');
    console.log('👉 No primeiro login, você será direcionado para criar sua nova senha definitiva.');
  } catch (err) {
    console.error('\n❌ [ERRO NO BOOTSTRAP]:', err.message);

    // Rollback compensatório atômico caso falhe
    if (createdProfile && createdAuthUserId) {
      console.log('[ROLLBACK] Removendo perfil criado em public.profiles...');
      await supabaseAdmin.from('profiles').delete().eq('id', createdAuthUserId).catch(() => {});
    }

    if (createdAuthUserId) {
      console.log('[ROLLBACK] Removendo usuário Auth órfão...');
      try {
        await supabaseAdmin.auth.admin.deleteUser(createdAuthUserId);
        console.log('[ROLLBACK CONCLUÍDO] Estado parcial removido com sucesso.');
      } catch (rErr) {
        console.error('[ERRO NO ROLLBACK]:', rErr.message);
      }
    }

    process.exit(1);
  }
}

bootstrapSuperAdmin();
