/**
 * aiLogger stub - versao minima para o partners-sst-am.
 * Apenas exporta getNowMs e logBrasilApiUsage (usado pelo sst-engine).
 * Logs de IA/SERPRO nao sao necessarios neste repositorio.
 */

export const getNowMs = () => {
  return typeof performance !== 'undefined' && typeof performance.now === 'function'
    ? performance.now()
    : Date.now();
};

export const logBrasilApiUsage = async ({ clientId, cnpj, latencyMs, success, errorMessage }) => {
  // No-op neste repositorio - leads nao tem client_id para FK
  console.log('[BrasilAPI Log] Consulta sem client_id - log descartado:', cnpj);
  return { success: false, error: 'client_id ausente - log descartado' };
};
