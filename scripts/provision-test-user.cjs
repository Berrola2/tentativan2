// ==============================================================================
// SCRIPT DE PROVISIONAMENTO SEGURO COM ROLLBACK COMPENSATÓRIO — VISTORIA YZZY
// ==============================================================================
// Executa exclusivamente no servidor via Supabase Admin API oficial.
// Possui verificação de duplicidade e rollback compensatório (deleteUser) em caso de falha.
// ==============================================================================

const { createClient } = require('@supabase/supabase-js');
const crypto = require('crypto');

async function provisionTestUser() {
  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl) {
    console.error('[ERRO] SUPABASE_URL ou VITE_SUPABASE_URL não configurada.');
    process.exit(1);
  }

  if (!serviceRoleKey) {
    console.error('[ERRO] SUPABASE_SERVICE_ROLE_KEY não configurada na sessão.');
    console.log('\nUso recomendado no PowerShell (sessão temporária):');
    console.log('  $env:SUPABASE_SERVICE_ROLE_KEY="sua_secret_aqui"');
    console.log('  node scripts/provision-test-user.cjs "SuaSenhaSegura123!"');
    console.log('  Remove-Item Env:SUPABASE_SERVICE_ROLE_KEY\n');
    process.exit(1);
  }

  const password = process.argv[2] || process.env.TEST_USER_PASSWORD;
  if (!password || password.length < 6) {
    console.error('[ERRO] Senha não fornecida ou menor que 6 caracteres.');
    console.log('Uso: node scripts/provision-test-user.cjs "SuaSenhaSegura123!"');
    process.exit(1);
  }

  const companyName = 'YZZY Teste';
  const companySlug = 'yzzy-teste';
  const username = 'teste';
  const fullName = 'Usuário Teste Gerente';
  const role = 'ROLE_MANAGER';

  // 1. Instanciar cliente administrativo com Service Role isolada
  const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  let createdAuthUserId = null;

  try {
    console.log(`\n======================================================`);
    console.log(`Verificando ambiente para [${companySlug}] / [${username}]...`);
    console.log(`======================================================`);

    // 2. Verificar/Reutilizar Empresa (Não duplicar)
    let companyId;
    const { data: existingComp, error: compFetchErr } = await supabaseAdmin
      .from('companies')
      .select('id, name, active')
      .eq('slug', companySlug)
      .maybeSingle();

    if (compFetchErr) {
      throw new Error(`Falha ao consultar empresa: ${compFetchErr.message}`);
    }

    if (existingComp) {
      companyId = existingComp.id;
      console.log(`[OK] Empresa existente identificada (Reutilizada): ${existingComp.name}`);
    } else {
      const { data: newComp, error: compCreateErr } = await supabaseAdmin
        .from('companies')
        .insert({ name: companyName, slug: companySlug, active: true })
        .select('id')
        .single();

      if (compCreateErr) {
        throw new Error(`Falha ao criar empresa: ${compCreateErr.message}`);
      }
      companyId = newComp.id;
      console.log(`[OK] Nova empresa criada: ${companyName}`);
    }

    // 3. Verificar se o Usuário já existe na empresa (Não sobrescrever)
    const { data: existingProfile, error: profCheckErr } = await supabaseAdmin
      .from('profiles')
      .select('id, username, role')
      .eq('company_id', companyId)
      .eq('username', username)
      .maybeSingle();

    if (profCheckErr) {
      throw new Error(`Falha ao verificar perfil: ${profCheckErr.message}`);
    }

    if (existingProfile) {
      console.log(`\n[AVISO] Usuário de teste "${username}" já está provisionado nesta empresa.`);
      console.log(`User ID: ${existingProfile.id}`);
      console.log(`Nenhuma alteração foi realizada. O usuário já está pronto para uso.\n`);
      return;
    }

    // 4. Gerar auth_email interno criptograficamente aleatório
    const randomHex = crypto.randomUUID().replace(/-/g, '');
    const internalAuthEmail = `usr_${randomHex}@auth.yzzy.internal`;

    // 5. Criar usuário no Supabase Auth via API Oficial Admin
    const { data: authUser, error: authErr } = await supabaseAdmin.auth.admin.createUser({
      email: internalAuthEmail,
      password: password,
      email_confirm: true,
      user_metadata: { full_name: fullName },
    });

    if (authErr || !authUser?.user) {
      throw new Error(`Falha no Supabase Auth: ${authErr?.message || 'Erro desconhecido'}`);
    }

    createdAuthUserId = authUser.user.id;
    console.log(`[OK] Usuário registrado no Supabase Auth.`);

    // 6. Inserir em public.profiles (SEM auth_email)
    const { error: profErr } = await supabaseAdmin
      .from('profiles')
      .insert({
        id: createdAuthUserId,
        company_id: companyId,
        username: username,
        full_name: fullName,
        role: role,
        active: true,
      });

    if (profErr) {
      throw new Error(`Falha ao vincular perfil em public.profiles: ${profErr.message}`);
    }
    console.log(`[OK] Perfil registrado em public.profiles.`);

    // 7. Inserir na tabela privada public.user_auth_identities com o mesmo auth_email
    const { error: identErr } = await supabaseAdmin
      .from('user_auth_identities')
      .insert({
        user_id: createdAuthUserId,
        company_id: companyId,
        username: username,
        auth_email: internalAuthEmail,
      });

    if (identErr) {
      throw new Error(`Falha ao registrar identidade em public.user_auth_identities: ${identErr.message}`);
    }
    console.log(`[OK] Identidade privada registrada em public.user_auth_identities.`);

    console.log('\n======================================================');
    console.log('✅ USUÁRIO DE TESTE PROVISIONADO COM SUCESSO!');
    console.log('======================================================');
    console.log(`Empresa (Slug) : ${companySlug}`);
    console.log(`Usuário        : ${username}`);
    console.log(`Cargo (Role)   : ${role}`);
    console.log(`User ID        : ${createdAuthUserId}`);
    console.log('======================================================\n');
  } catch (err) {
    console.error('\n[ERRO DURANTE O PROVISIONAMENTO]:', err.message);

    // 8. Rollback Compensatório: Desfazer usuário criado no Supabase Auth se algo falhou após o createUser
    if (createdAuthUserId) {
      console.log('[ROLLBACK] Executando compensação: excluindo usuário Auth órfão...');
      try {
        await supabaseAdmin.auth.admin.deleteUser(createdAuthUserId);
        console.log('[ROLLBACK CONCLUÍDO] Usuário Auth órfão removido com sucesso.');
      } catch (rollbackErr) {
        console.error('[ERRO NO ROLLBACK]: Falha ao remover usuário Auth:', rollbackErr.message);
      }
    }

    process.exit(1);
  }
}

provisionTestUser();
