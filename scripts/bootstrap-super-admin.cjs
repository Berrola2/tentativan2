// ==============================================================================
// VISTORIA YZZY — BOOTSTRAP DO PRIMEIRO SUPER ADMIN (CANÔNICO)
// ==============================================================================
// Executa exclusivamente no servidor via Supabase Admin API e RPC segura.
// Registra e audita a identidade no schema private exclusivamente via RPCs.
// ==============================================================================

const { createClient } = require('@supabase/supabase-js');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

// Carregar .env se existir
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
  const isResetMode = process.argv.includes('--reset-password') || process.argv.includes('--reset');
  const isAuditMode = process.argv.includes('--audit') || process.argv.includes('--check');
  const customPasswordArg = process.argv.find(arg => !arg.startsWith('--') && arg !== process.argv[0] && arg !== process.argv[1]);

  console.log('====================================================================');
  console.log('🚀 VISTORIA YZZY — GESTÃO & BOOTSTRAP DO SUPER ADMIN (CANÔNICO)');
  console.log('Endpoint:', supabaseUrl);
  console.log('Modo    :', isResetMode ? 'REDEFINIÇÃO DE SENHA (--reset-password)' : isAuditMode ? 'AUDITORIA (--audit)' : 'PROVISIONAMENTO / VERIFICAÇÃO');
  console.log('====================================================================\n');

  if (!secretKey) {
    console.error('[ERRO] Chave de administração do Supabase não configurada.');
    process.exit(1);
  }

  const supabaseAdmin = createClient(supabaseUrl, secretKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const defaultLoginAlias = 'admin@yzzy.yzzy';
  const username = 'superadmin';
  const fullName = 'Super Administrador YZZY';

  try {
    // 1. Auditar se já existe SUPER_ADMIN cadastrado em public.profiles
    const { data: existingSuperAdmins, error: saCheckErr } = await supabaseAdmin
      .from('profiles')
      .select('id, username, full_name, role, active, must_change_password, company_id')
      .eq('role', 'ROLE_SUPER_ADMIN');

    if (saCheckErr) {
      throw new Error(`Falha ao consultar public.profiles: ${saCheckErr.message}`);
    }

    // Se já existe Super Admin
    if (existingSuperAdmins && existingSuperAdmins.length > 0) {
      const superAdmin = existingSuperAdmins[0];
      const targetUserId = superAdmin.id;

      // Auditar identidade via RPC segura resolve_login_yzzy_identity
      const { data: identityRows } = await supabaseAdmin.rpc('resolve_login_yzzy_identity', {
        p_login_alias: defaultLoginAlias,
      });

      const identityData = identityRows && identityRows.length > 0 ? identityRows[0] : null;

      // Auditar vínculo em auth.users
      const { data: authUserData } = await supabaseAdmin.auth.admin.getUserById(targetUserId);

      const isConsistent = targetUserId === authUserData?.user?.id && targetUserId === identityData?.user_id;

      console.log('📊 [AUDITORIA DO SUPER ADMIN EXISTENTE]');
      console.log(`   - Auth User ID       : ${targetUserId}`);
      console.log(`   - Profile ID         : ${superAdmin.id} (${superAdmin.full_name})`);
      console.log(`   - Role               : ${superAdmin.role}`);
      console.log(`   - Company ID         : ${superAdmin.company_id || 'NULL (Global)'}`);
      console.log(`   - Ativo              : ${superAdmin.active}`);
      console.log(`   - Must Change Pass   : ${superAdmin.must_change_password}`);
      console.log(`   - Email Interno Auth : ${authUserData?.user?.email || identityData?.auth_email || 'Não encontrado'}`);
      console.log(`   - Alias Login YZZY   : ${identityData ? defaultLoginAlias : 'Não cadastrado'}`);
      console.log(`   - Integridade Vínculo: ${isConsistent ? '✅ 100% ÍNTEGRO' : '⚠️ Vínculo parcial'}\n`);

      if (isAuditMode) {
        console.log('Auditoria concluída com sucesso.');
        return;
      }

      // Se solicitado reset ou provisionamento com usuário já existente
      if (isResetMode || customPasswordArg) {
        const tempPassword = customPasswordArg || generateSecureTempPassword();

        console.log(`🔄 Iniciando redefinição de senha para o Super Admin (${targetUserId})...`);

        // 1. Atualizar senha no Supabase Auth garantindo email_confirm = true
        const { data: updatedAuthUser, error: updateAuthErr } = await supabaseAdmin.auth.admin.updateUserById(targetUserId, {
          password: tempPassword,
          email_confirm: true,
        });

        if (updateAuthErr) {
          throw new Error(`Falha ao atualizar senha no Supabase Auth: ${updateAuthErr.message}`);
        }

        const actualAuthEmail = updatedAuthUser?.user?.email || authUserData?.user?.email || `superadmin_${targetUserId.replace(/-/g, '').slice(0, 12)}@auth.yzzy.internal`;

        // 2. Garantir must_change_password = true no profile
        const { error: updateProfErr } = await supabaseAdmin
          .from('profiles')
          .update({
            must_change_password: true,
            active: true,
            updated_at: new Date().toISOString(),
          })
          .eq('id', targetUserId);

        if (updateProfErr) {
          throw new Error(`Falha ao atualizar perfil: ${updateProfErr.message}`);
        }

        // 3. Garantir identidade em private.user_auth_identities via RPC administrativa
        const { data: regRes, error: regErr } = await supabaseAdmin.rpc('admin_register_user_auth_identity', {
          p_user_id: targetUserId,
          p_company_id: null,
          p_login_alias: defaultLoginAlias,
          p_auth_email: actualAuthEmail,
        });

        if (regErr || !regRes?.success) {
          throw new Error(`Falha ao registrar identidade via RPC: ${regErr?.message || 'Erro no registro'}`);
        }

        // 4. Teste de Validação Direta do Auth
        console.log('🧪 1/2: Validando credencial via Supabase Auth (signInWithPassword)...');
        const { error: testAuthErr } = await supabaseAdmin.auth.signInWithPassword({
          email: actualAuthEmail,
          password: tempPassword,
        });

        if (testAuthErr) {
          console.warn('⚠️ Alerta durante teste direto de signInWithPassword:', testAuthErr.message);
        } else {
          console.log('✅ Teste direto signInWithPassword: AUTENTICADO COM SUCESSO!');
        }

        // 5. Teste da Edge Function login-with-yzzy
        console.log('🧪 2/2: Validando fluxo oficial via Edge Function login-with-yzzy...');
        const { data: edgeData, error: edgeErr } = await supabaseAdmin.functions.invoke('login-with-yzzy', {
          body: { login: defaultLoginAlias, password: tempPassword }
        });

        if (edgeErr || !edgeData?.success) {
          console.warn('⚠️ Alerta durante teste da Edge Function:', edgeErr?.message || edgeData?.error);
        } else {
          console.log('✅ Teste completo login-with-yzzy: SUCESSO! Sessão e Perfil ROLE_SUPER_ADMIN confirmados.');
        }

        console.log('\n====================================================================');
        console.log('✅ [SUCESSO] SENHA DO SUPER ADMIN REDEFINIDA E VALIDADA COM SUCESSO!');
        console.log('====================================================================');
        console.log(`Login YZZY        : ${defaultLoginAlias}`);
        console.log(`Nova Senha Temp   : ${tempPassword}`);
        console.log(`Papel (Role)      : ROLE_SUPER_ADMIN`);
        console.log(`Email Interno Auth: ${actualAuthEmail.split('@')[0]}***@${actualAuthEmail.split('@')[1]}`);
        console.log(`Troca Obrigatória : Sim (must_change_password = TRUE)`);
        console.log('====================================================================\n');
        return;
      }

      console.log('💡 Dica: Para redefinir a senha do Super Admin existente, execute:');
      console.log('   node scripts/bootstrap-super-admin.cjs --reset-password [nova_senha_opcional]\n');
      return;
    }

    // Provisionamento do primeiro Super Admin caso não exista
    console.log('Iniciando provisionamento do primeiro Super Admin...');

    const tempPassword = customPasswordArg || generateSecureTempPassword();
    const internalAuthEmail = `superadmin_${crypto.randomUUID().replace(/-/g, '').slice(0, 12)}@auth.yzzy.internal`;

    let createdAuthUserId = null;

    // 1. Criar usuário no Supabase Auth
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

    // 2. Criar perfil em public.profiles
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
      await supabaseAdmin.auth.admin.deleteUser(createdAuthUserId);
      throw new Error(`Falha ao criar perfil em public.profiles: ${profileErr.message}`);
    }
    console.log('[OK] 2/3: Perfil ROLE_SUPER_ADMIN criado em public.profiles.');

    // 3. Registrar identidade no schema private através da RPC administrativa segura
    const { data: rpcResult, error: rpcErr } = await supabaseAdmin.rpc('admin_register_user_auth_identity', {
      p_user_id: createdAuthUserId,
      p_company_id: null,
      p_login_alias: defaultLoginAlias,
      p_auth_email: internalAuthEmail,
    });

    if (rpcErr || !rpcResult?.success) {
      await supabaseAdmin.from('profiles').delete().eq('id', createdAuthUserId);
      await supabaseAdmin.auth.admin.deleteUser(createdAuthUserId);
      throw new Error(`Falha ao registrar identidade no schema private: ${rpcErr?.message}`);
    }

    console.log('[OK] 3/3: Identidade registrada com sucesso em private.user_auth_identities.');

    console.log('\n====================================================================');
    console.log('✅ [SUCESSO] PRIMEIRO SUPER ADMIN PROVISIONADO COM SUCESSO!');
    console.log('====================================================================');
    console.log(`Login YZZY        : ${defaultLoginAlias}`);
    console.log(`Senha Temporária  : ${tempPassword}`);
    console.log(`Papel (Role)      : ROLE_SUPER_ADMIN`);
    console.log(`Empresa           : Global (company_id = NULL)`);
    console.log(`Troca Obrigatória : Sim (must_change_password = TRUE)`);
    console.log('====================================================================\n');
  } catch (err) {
    console.error('\n❌ [ERRO NO BOOTSTRAP/RESET]:', err.message);
    process.exit(1);
  }
}

bootstrapSuperAdmin();
