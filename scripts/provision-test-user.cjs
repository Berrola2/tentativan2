// ==============================================================================
// SCRIPT DE PROVISIONAMENTO SEGURO DE USUÁRIO DE TESTE (SERVER-SIDE)
// ==============================================================================
// Executa exclusivamente no servidor via Supabase Admin API oficial:
// supabase.auth.admin.createUser({ email: auth_email, password, email_confirm: true })
// ==============================================================================

const { createClient } = require('@supabase/supabase-js');
const crypto = require('crypto');

async function provisionTestUser() {
  const supabaseUrl = process.env.SUPABASE_URL || 'https://dgeczjzbohmveonqxxzv.supabase.co';
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!serviceRoleKey) {
    console.error('[ERRO] SUPABASE_SERVICE_ROLE_KEY não fornecida.');
    console.log('Uso:');
    console.log('  SUPABASE_SERVICE_ROLE_KEY="sua_secret_aqui" node scripts/provision-test-user.cjs <senha>');
    process.exit(1);
  }

  const password = process.argv[2] || process.env.TEST_USER_PASSWORD;
  if (!password) {
    console.error('[ERRO] Senha não fornecida.');
    console.log('Uso: node scripts/provision-test-user.cjs <senha>');
    process.exit(1);
  }

  const companyName = 'YZZY Teste';
  const companySlug = 'yzzy-teste';
  const username = 'teste';
  const fullName = 'Usuário Teste Gerente';
  const role = 'ROLE_MANAGER';

  // 1. Cliente com privilégios administrativos
  const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  try {
    console.log(`\n=== Iniciando provisionamento para empresa [${companySlug}] e usuário [${username}] ===`);

    // 2. Criar ou resgatar empresa
    let companyId;
    const { data: existingComp } = await supabaseAdmin
      .from('companies')
      .select('id')
      .eq('slug', companySlug)
      .maybeSingle();

    if (existingComp) {
      companyId = existingComp.id;
      console.log(`[OK] Empresa existente identificada: ${companyId}`);
    } else {
      const { data: newComp, error: compErr } = await supabaseAdmin
        .from('companies')
        .insert({ name: companyName, slug: companySlug, active: true })
        .select('id')
        .single();

      if (compErr) throw new Error(`Falha ao criar empresa: ${compErr.message}`);
      companyId = newComp.id;
      console.log(`[OK] Empresa criada com sucesso: ${companyId}`);
    }

    // 3. Gerar auth_email interno criptograficamente aleatório
    const randomHex = crypto.randomUUID().replace(/-/g, '');
    const internalAuthEmail = `usr_${randomHex}@auth.yzzy.internal`;

    // 4. Criar usuário no Supabase Auth usando a API Oficial Admin
    const { data: authUser, error: authErr } = await supabaseAdmin.auth.admin.createUser({
      email: internalAuthEmail,
      password: password,
      email_confirm: true,
      user_metadata: { full_name: fullName },
    });

    if (authErr) throw new Error(`Falha ao criar usuário no Supabase Auth: ${authErr.message}`);
    const userId = authUser.user.id;
    console.log(`[OK] Usuário criado no Supabase Auth com sucesso. ID: ${userId}`);

    // 5. Criar registro em public.profiles (SEM auth_email)
    const { error: profErr } = await supabaseAdmin
      .from('profiles')
      .upsert({
        id: userId,
        company_id: companyId,
        username: username,
        full_name: fullName,
        role: role,
        active: true,
      });

    if (profErr) throw new Error(`Falha ao criar profile: ${profErr.message}`);
    console.log(`[OK] Perfil vinculado em public.profiles.`);

    // 6. Criar registro em public.user_auth_identities com EXATAMENTE o mesmo auth_email
    const { error: identErr } = await supabaseAdmin
      .from('user_auth_identities')
      .upsert({
        user_id: userId,
        company_id: companyId,
        username: username,
        auth_email: internalAuthEmail,
      });

    if (identErr) throw new Error(`Falha ao registrar identidade privada: ${identErr.message}`);
    console.log(`[OK] Identidade técnica registrada em public.user_auth_identities.`);

    console.log('\n======================================================');
    console.log('✅ PROVISIONAMENTO CONCLUÍDO COM SUCESSO!');
    console.log('======================================================');
    console.log(`Empresa (Slug) : ${companySlug}`);
    console.log(`Usuário        : ${username}`);
    console.log(`Cargo (Role)   : ${role}`);
    console.log(`User ID        : ${userId}`);
    console.log('======================================================\n');
  } catch (err) {
    console.error('\n[ERRO NO PROVISIONAMENTO]:', err.message);
    process.exit(1);
  }
}

provisionTestUser();
