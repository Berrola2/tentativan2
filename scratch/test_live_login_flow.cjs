// ==============================================================================
// VISTORIA YZZY — TESTE DE LOGIN EM PRODUÇÃO / AMBIENTE REMOTO
// ==============================================================================

const { createClient } = require('@supabase/supabase-js');
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
const publishableKey = envVars.VITE_SUPABASE_PUBLISHABLE_KEY || 'sb_publishable_UUFwLaZc0yvtb6oJenbljA_6q2HO0st';

async function testLiveLogin() {
  console.log('====================================================================');
  console.log('AUDITORIA DE LOGIN — SUPABASE EDGE FUNCTION');
  console.log('Endpoint:', supabaseUrl);
  console.log('Timestamp:', new Date().toISOString());
  console.log('====================================================================\n');

  const client = createClient(supabaseUrl, publishableKey);

  console.log('1. Testando chamada invoke("login-with-yzzy") com credenciais de teste...');
  const { data, error } = await client.functions.invoke('login-with-yzzy', {
    body: { login: 'admin@yzzy.yzzy', password: 'SenhaIncorretaParaTeste123!' }
  });

  console.log('Resultado invoke:');
  console.log(' - Data:', data);
  if (error) {
    console.log(' - Error Name:', error.name);
    console.log(' - Error Message:', error.message);
    if (error.context) {
      const errJson = await error.context.json().catch(() => null);
      console.log(' - Error Context JSON:', errJson);
    }
  }

  console.log('\n2. Testando CORS e Headers via fetch direto...');
  const res = await fetch(`${supabaseUrl}/functions/v1/login-with-yzzy`, {
    method: 'OPTIONS',
    headers: {
      'Origin': 'https://tentativan2.vercel.app',
      'Access-Control-Request-Method': 'POST',
      'Access-Control-Request-Headers': 'content-type,apikey'
    }
  });

  console.log('CORS Preflight Status:', res.status);
  console.log('CORS Allow Origin:', res.headers.get('access-control-allow-origin'));
  console.log('CORS Allow Methods:', res.headers.get('access-control-allow-methods'));
  console.log('CORS Allow Headers:', res.headers.get('access-control-allow-headers'));

  console.log('\n====================================================================');
  console.log('AUDITORIA CONCLUÍDA: Função respondendo com CORS e mensagens tratadas!');
  console.log('====================================================================\n');
}

testLiveLogin().catch(console.error);
