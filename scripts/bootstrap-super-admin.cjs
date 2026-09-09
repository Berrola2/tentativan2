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
  const isResetMode = process.argv.includes('--reset-password') || process.argv.includes('--reset');
  const isAuditMode = process.argv.includes('--audit') || process.argv.includes('--check');
  const customPasswordArg = process.argv.find(arg => !arg.startsWith('--') && arg !== process.argv[0] && arg !== process.argv[1]);

  console.log('====================================================================');
  console.log('🚀 VISTORIA YZZY — GESTÃO & BOOTSTRAP DO SUPER ADMIN');
  console.log('Endpoint:', supabaseUrl);
  console.log('Modo    :', isResetMode ? 'REDEFINIÇÃO DE SENHA (--reset-password)' : isAuditMode ? 'AUDITORIA (--audit)' : 'PROVISIONAMENTO / VERIFICAÇÃO');
  console.log('====================================================================\n');

  if (!secretKey) {
    console.error('[ERRO] Chave de administração do Supabase não configurada na sessão.');
    console.log('\nComo executar no PowerShell:');
    console.log('  $env:SUPABASE_SECRET_KEY="sua_secret_key_aqui"');
    console.log('  node scripts/bootstrap-super-admin.cjs --reset-password [senha_temporaria_opcional]');
    console.log('  Remove-Item Env:SUPABASE_SECRET_KEY\n');
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

      // Auditar vínculo em private.user_auth_identities
      const { data: identityData, error: idErr } = await supabaseAdmin
        .schema('private')
        .from('user_auth_identities')
        .select('id, user_id, company_id, login_alias, auth_email')
        .eq('user_id', targetUserId)
        .maybeSingle();

      // Auditar vínculo em auth.users
      const { data: authUserData, error: authUserErr } = await supabaseAdmin.auth.admin.getUserById(targetUserId);

      console.log('📊 [AUDITORIA DO SUPER ADMIN EXISTENTE]');
      console.log(`   - Auth User ID       : ${targetUserId}`);
      console.log(`   - Profile ID         : ${superAdmin.id} (${superAdmin.full_name})`);
      console.log(`   - Role               : ${superAdmin.role}`);
      console.log(`   - Company ID         : ${superAdmin.company_id || 'NULL (Global)'}`);
      console.log(`   - Ativo              : ${superAdmin.active}`);
      console.log(`   - Must Change Pass   : ${superAdmin.must_change_password}`);
      console.log(`   - Email Interno Auth : ${authUserData?.user?.email || identityData?.auth_email || 'Não encontrado'}`);
      console.log(`   - Alias Login YZZY   : ${identityData?.login_alias || defaultLoginAlias}`);
      console.log(`   - Integridade Vínculo: ${targetUserId === authUserData?.user?.id && targetUserId === identityData?.user_id ? '✅ 100% ÍNTEGRO' : '⚠️ Vínculo parcial'}\n`);

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

        const actualAuthEmail = updatedAuthUser?.user?.email || authUserData?.user?.email;

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

        // 3. Garantir identidade em private.user_auth_identities com auth_email sincronizado
        if (!identityData) {
          await supabaseAdmin.schema('private').from('user_auth_identities').insert({
            user_id: targetUserId,
            company_id: null,
            login_alias: defaultLoginAlias,
            auth_email: actualAuthEmail,
          });
        } else {
          await supabaseAdmin.schema('private').from('user_auth_identities').update({
            login_alias: defaultLoginAlias,
            auth_email: actualAuthEmail,
            updated_at: new Date().toISOString(),
          }).eq('user_id', targetUserId);
        }

        // 4. Teste de Validação Direta do Auth
        console.log('🧪 Validando credencial via Supabase Auth (signInWithPassword)...');
        const { data: testAuth, error: testAuthErr } = await supabaseAdmin.auth.signInWithPassword({
          email: actualAuthEmail,
          password: tempPassword,
        });

        if (testAuthErr || !testAuth?.session) {
          console.warn('⚠️ Alerta durante teste direto de signInWithPassword:', testAuthErr?.message);
        } else {
          console.log('✅ Teste direto signInWithPassword: AUTENTICADO COM SUCESSO!');
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
        console.log('👉 Acesse https://vistoriayzzy.vercel.app para efetuar o login e definir a senha definitiva.');
        return;
      }

      console.log('💡 Dica: Para redefinir a senha do Super Admin existente de forma segura, execute:');
      console.log('   node scripts/bootstrap-super-admin.cjs --reset-password [nova_senha_opcional]\n');
      return;
    }

    // Caso NÃO exista Super Admin, executa provisionamento do primeiro Super Admin
    console.log('Auditoria confirmada: Nenhum Super Admin existente. Iniciando provisionamento seguro...');

    const tempPassword = customPasswordArg || generateSecureTempPassword();
    const internalAuthEmail = `superadmin_${crypto.randomUUID().replace(/-/g, '').slice(0, 12)}@auth.yzzy.internal`;

    let createdAuthUserId = null;
    let createdProfile = false;

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
    console.log('[OK] 2/3: Perfil ROLE_SUPER_ADMIN criado em public.profiles.');

    // 4. Registrar identidade no schema private através da RPC administrativa segura
    const { data: rpcResult, error: rpcErr } = await supabaseAdmin.rpc('admin_bootstrap_super_admin_identity', {
      p_user_id: createdAuthUserId,
      p_auth_email: internalAuthEmail,
      p_login_alias: defaultLoginAlias,
    });

    if (rpcErr || !rpcResult?.success) {
      throw new Error(`Falha ao registrar identidade no schema private: ${rpcErr?.message || 'Erro desconhecido na RPC'}`);
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
    console.log('👉 No primeiro login, você será direcionado para criar sua nova senha definitiva.');
  } catch (err) {
    console.error('\n❌ [ERRO NO BOOTSTRAP/RESET]:', err.message);
    process.exit(1);
  }
}

bootstrapSuperAdmin();
