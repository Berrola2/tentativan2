// ==============================================================================
// VISTORIA YZZY — MÓDULO DE PROTEÇÃO DE PRODUÇÃO E ISOLAMENTO DE TESTES E2E
// ==============================================================================
// Garante que nenhum teste E2E, seed ou script automatizado possa:
// 1. Alterar senha de usuários reais/persistentes de produção.
// 2. Executar deleteUser / updateUserById no Super Admin ou gerentes reais.
// 3. Executar mutações contra contas com role ROLE_SUPER_ADMIN de produção.
// ==============================================================================

const PROTECTED_PRODUCTION_USERS = Object.freeze({
  SUPER_ADMIN_ID: '7759bc29-cb13-4842-bf2f-139a7266fc0d',
  SUPER_ADMIN_ALIAS: 'admin@yzzy.yzzy',
  PROTECTED_ROLES: ['ROLE_SUPER_ADMIN'],
});

/**
 * Valida se um alvo de mutação é seguro para execução em testes.
 * Aborta imediatamente a execução se o alvo for o Super Admin ou um usuário protegido.
 */
function assertSafeForMutation(target) {
  if (!target) return;
  const { userId, loginAlias, role, authEmail, operationName = 'Operação de Teste' } = target;

  if (userId && userId === PROTECTED_PRODUCTION_USERS.SUPER_ADMIN_ID) {
    const errorMsg = `🚨 [PROTEÇÃO DE PRODUÇÃO VIOLADA] Tentativa de executar ${operationName} no UUID protegido do Super Admin (${userId}). Execução abortada!`;
    console.error(errorMsg);
    throw new Error(errorMsg);
  }

  if (loginAlias && loginAlias.toLowerCase().trim() === PROTECTED_PRODUCTION_USERS.SUPER_ADMIN_ALIAS) {
    const errorMsg = `🚨 [PROTEÇÃO DE PRODUÇÃO VIOLADA] Tentativa de executar ${operationName} no alias protegido (${loginAlias}). Execução abortada!`;
    console.error(errorMsg);
    throw new Error(errorMsg);
  }

  if (role && PROTECTED_PRODUCTION_USERS.PROTECTED_ROLES.includes(role)) {
    // Permite apenas se for explicitamente um usuário dinâmico e efêmero com prefixo 'e2e_'
    const isEphemeralE2E = (loginAlias && loginAlias.startsWith('e2e_')) || (authEmail && authEmail.startsWith('e2e_'));
    if (!isEphemeralE2E) {
      const errorMsg = `🚨 [PROTEÇÃO DE PRODUÇÃO VIOLADA] Tentativa de mutação em conta com papel ${role} não-efêmera. Execução abortada!`;
      console.error(errorMsg);
      throw new Error(errorMsg);
    }
  }
}

/**
 * Gera dados seguros e isolados para usuários de teste E2E efêmeros.
 */
function generateEphemeralE2EUser(role = 'ROLE_MANAGER') {
  const nonce = Date.now().toString(36) + Math.random().toString(36).substring(2, 6);
  const companySlug = `e2e_co_${nonce}`;
  const username = `e2e_user_${nonce}`;
  const loginAlias = `${username}@${companySlug}.yzzy`;
  const internalAuthEmail = `e2e_${nonce}@auth.yzzy.internal`;
  const testPassword = `E2E#Test_${nonce}!`;

  return {
    nonce,
    companyName: `Empresa de Teste E2E ${nonce}`,
    companySlug,
    username,
    loginAlias,
    internalAuthEmail,
    testPassword,
    role,
    firstName: 'Teste',
    lastName: `E2E ${nonce}`,
  };
}

module.exports = {
  PROTECTED_PRODUCTION_USERS,
  assertSafeForMutation,
  generateEphemeralE2EUser,
};
