const { createClient } = require('d:/NOVA_TENTATIVA_2/node_modules/@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

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

const supabaseUrl = envVars.VITE_SUPABASE_URL || 'https://wyyigrlqxwjxjqkazeof.supabase.co';
const serviceRoleKey = envVars.SUPABASE_SERVICE_ROLE_KEY || envVars.VITE_SUPABASE_PUBLISHABLE_KEY || 'sb_publishable_UUFwLaZc0yvtb6oJenbljA_6q2HO0st';

async function auditSuperAdmin() {
  console.log('====================================================================');
  console.log('AUDITORIA DE SUPER ADMIN — VISTORIA YZZY');
  console.log('Endpoint:', supabaseUrl);
  console.log('====================================================================\n');

  const client = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  // 1. Consultar perfis com ROLE_SUPER_ADMIN
  const { data: superAdmins, error: errSA } = await client
    .from('profiles')
    .select('id, username, full_name, display_name, role, active, must_change_password, company_id')
    .eq('role', 'ROLE_SUPER_ADMIN');

  console.log('1. Perfis com ROLE_SUPER_ADMIN em public.profiles:', superAdmins, errSA ? `(Erro: ${errSA.message})` : '');

  // 2. Consultar todos os perfis existentes
  const { data: allProfiles, error: errProf } = await client
    .from('profiles')
    .select('id, username, full_name, role, active, company_id');

  console.log('\n2. Total de perfis cadastrados:', allProfiles ? allProfiles.length : 0);
  if (allProfiles && allProfiles.length > 0) {
    allProfiles.forEach(p => {
      console.log(`   - ID: ${p.id} | User: ${p.username} | Role: ${p.role} | Active: ${p.active} | Company: ${p.company_id || 'NULL (Global)'}`);
    });
  }

  // 3. Consultar identidades em private.user_auth_identities
  const { data: identities, error: errIdent } = await client
    .from('user_auth_identities')
    .select('user_id, company_id, login_alias, auth_email');

  console.log('\n3. Identidades cadastradas (Login YZZY):', identities ? identities.length : 0);
  if (identities && identities.length > 0) {
    identities.forEach(i => {
      console.log(`   - User ID: ${i.user_id} | Login Alias: ${i.login_alias} | Company: ${i.company_id || 'NULL'}`);
    });
  }

  // 4. Consultar empresas cadastradas
  const { data: companies, error: errComp } = await client
    .from('companies')
    .select('id, name, slug, active');

  console.log('\n4. Empresas cadastradas:', companies ? companies.length : 0);
  if (companies && companies.length > 0) {
    companies.forEach(c => {
      console.log(`   - Empresa: ${c.name} (@${c.slug}.yzzy) | Active: ${c.active} | ID: ${c.id}`);
    });
  }
}

auditSuperAdmin().catch(console.error);
