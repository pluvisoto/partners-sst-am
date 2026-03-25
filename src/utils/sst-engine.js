/**
 * SST ENGINE - Subconjunto para partners-sst-am
 * Apenas funcoes necessarias: fetchCompanyData, analyzeRegulatoryStatus,
 * calcularMensalidadePerCapita, getRiskDegree, isTrueMEI, getMEIScore
 */

import { isSmallPorte, logPorteClassification, normalizePorte, PORTE_CATEGORIES } from './porteMapping.js';
import { cleanDigits } from './formatters.js';
import { logBrasilApiUsage, getNowMs } from './aiLogger.js';

export const getMEIScore = (companyData) => {
  if (!companyData) return 0;
  let score = 0;
  const natureza = String(companyData.natureza_juridica || '').trim();
  const naturezaUpper = natureza.toUpperCase();
  const naturezaDigits = cleanDigits(natureza);
  const porte = String(companyData.porte || '').toUpperCase().trim();

  if (companyData.mei === true || companyData.opcao_pelo_mei === true) score += 2;
  if (naturezaDigits === '2246') score += 2;
  else if (
    naturezaDigits === '2135' ||
    naturezaUpper.includes('EMPRESÁRIO INDIVIDUAL') ||
    naturezaUpper.includes('EMPRESARIO INDIVIDUAL') ||
    naturezaUpper.includes('EMPRESÁRIO (INDIVIDUAL)') ||
    naturezaUpper.includes('EMPRESARIO (INDIVIDUAL)')
  ) score += 1;

  if (porte === 'MEI' || porte === 'MICROEMPREENDEDOR INDIVIDUAL' || porte.includes('MICROEMPREENDEDOR INDIVIDUAL')) score += 2;
  if (porte.includes('PEQUENO PORTE') || porte.includes('EPP') || porte.includes('MÉDIO') || porte.includes('MEDIO') || porte.includes('GRANDE')) return -1;
  return score;
};

export const isTrueMEI = (companyData) => {
  const score = getMEIScore(companyData);
  if (score < 0) return false;
  return score >= 2;
};

export const fetchCompanyData = async (cnpj, { clientId, skipSerpro = false } = {}) => {
  const cleanCnpj = cleanDigits(cnpj);
  try {
    console.log('[SST Engine] PRIMARY: Fetching from ReceitaWS:', cleanCnpj);
    const receitaWsData = await fetchFromReceitaWS(cleanCnpj);
    if (receitaWsData) return receitaWsData;

    console.log('[SST Engine] Fetching from Brasil API:', cleanCnpj);
    const brasilApiData = await fetchFromBrasilAPI(cleanCnpj, clientId);
    if (brasilApiData) return brasilApiData;

    console.error('[SST Engine] Nenhuma fonte retornou dados para:', cleanCnpj);
    return null;
  } catch (e) {
    console.error('[SST Engine] Erro ao buscar dados da empresa:', e);
    return null;
  }
};

const fetchFromReceitaWS = async (cleanCnpj) => {
  try {
    const response = await fetch(`/api/receitaws/${cleanCnpj}`, {
      method: 'GET', headers: { 'Accept': 'application/json' }
    });
    if (!response.ok) { console.warn(`[ReceitaWS] HTTP ${response.status}`); return null; }
    const rawData = await response.json();
    if (!rawData?.cnpj || rawData?.status === 'ERROR') { console.warn('[ReceitaWS] Resposta sem CNPJ valido'); return null; }

    const primaryActivity = Array.isArray(rawData.atividade_principal)
      ? (rawData.atividade_principal?.[0] || {})
      : (rawData.atividade_principal || {});
    const normalizedPorte = normalizePorte(rawData.porte || rawData.tipo || '');

    return mapToInternalFormat({
      cnpj: rawData.cnpj || cleanCnpj,
      razao_social: rawData.nome || rawData.razao_social || '',
      nome_fantasia: rawData.fantasia || rawData.nome_fantasia || '',
      porte: normalizedPorte,
      establishment_type: rawData.tipo || '',
      natureza_juridica: rawData.natureza_juridica || '',
      cnae_fiscal: primaryActivity.code || '',
      cnae_fiscal_descricao: primaryActivity.text || '',
      cnaes_secundarios: (rawData.atividades_secundarias || []).map((a) => ({ code: a.code || '', descricao: a.text || '' })),
      logradouro: rawData.logradouro || '', numero: rawData.numero || '', complemento: rawData.complemento || '',
      bairro: rawData.bairro || '', municipio: rawData.municipio || '', uf: rawData.uf || '', cep: rawData.cep || '',
      email: rawData.email || '', ddd_telefone_1: rawData.telefone || rawData.ddd_telefone_1 || '',
      opcao_pelo_mei: rawData.simei?.optante === true || rawData.opcao_pelo_mei === true,
      descricao_situacao_cadastral: String(rawData.situacao || rawData.status || ''),
      qsa: rawData.qsa || [], source: 'ReceitaWS'
    });
  } catch (e) {
    console.warn('[ReceitaWS] Erro de rede:', e.message);
    return null;
  }
};

const fetchFromBrasilAPI = async (cleanCnpj, clientId = null) => {
  const startedAt = getNowMs();
  try {
    const response = await fetch(`/api/brasilapi/${cleanCnpj}`, {
      method: 'GET', headers: { 'Accept': 'application/json' }
    });
    if (!response.ok) {
      const latencyMs = getNowMs() - startedAt;
      logBrasilApiUsage({ clientId, cnpj: cleanCnpj, latencyMs, success: false, errorMessage: `HTTP ${response.status}` }).catch(() => {});
      return null;
    }
    const rawData = await response.json();
    if (!rawData.cnpj) {
      const latencyMs = getNowMs() - startedAt;
      logBrasilApiUsage({ clientId, cnpj: cleanCnpj, latencyMs, success: false, errorMessage: 'Resposta sem CNPJ' }).catch(() => {});
      return null;
    }

    const primaryActivity = Array.isArray(rawData.atividade_principal)
      ? (rawData.atividade_principal?.[0] || {})
      : (rawData.atividade_principal || {});
    const normalizedPorte = normalizePorte(rawData.porte || rawData.tipo || '');

    const latencyMs = getNowMs() - startedAt;
    logBrasilApiUsage({ clientId, cnpj: cleanCnpj, latencyMs, success: true }).catch(() => {});

    return mapToInternalFormat({
      cnpj: rawData.cnpj,
      razao_social: rawData.razao_social || rawData.nome || '',
      nome_fantasia: rawData.nome_fantasia || '',
      porte: normalizedPorte,
      natureza_juridica: rawData.natureza_juridica || '',
      cnae_fiscal: primaryActivity.code || '',
      cnae_fiscal_descricao: primaryActivity.text || '',
      cnaes_secundarios: (rawData.atividades_secundarias || []).map(a => ({ code: a.code, descricao: a.text || '' })),
      logradouro: rawData.logradouro || '', numero: rawData.numero || '', complemento: rawData.complemento || '',
      bairro: rawData.bairro || '', municipio: rawData.municipio || '', uf: rawData.uf || '', cep: rawData.cep || '',
      email: rawData.email || '', ddd_telefone_1: rawData.ddd_telefone_1 || '',
      opcao_pelo_mei: undefined,
      descricao_situacao_cadastral: typeof rawData.situacao_cadastral === 'object'
        ? (rawData.situacao_cadastral?.descricao || '')
        : String(rawData.situacao_cadastral || ''),
      source: 'Brasil API'
    });
  } catch (e) {
    console.warn('[Brasil API] Network error:', e.message);
    const latencyMs = getNowMs() - startedAt;
    logBrasilApiUsage({ clientId, cnpj: cleanCnpj, latencyMs, success: false, errorMessage: e.message }).catch(() => {});
    return null;
  }
};

const mapToInternalFormat = (data) => {
  const addressParts = [data.logradouro];
  if (data.numero) addressParts.push(data.numero);
  if (data.complemento) addressParts.push(data.complemento);
  addressParts.push(`${data.bairro}, ${data.municipio} - ${data.uf}`);
  const address = addressParts.filter(p => p && String(p).trim()).join(', ');

  let formattedPhone = '';
  if (data.ddd_telefone_1) {
    const phone = cleanDigits(data.ddd_telefone_1);
    if (phone.length >= 10) formattedPhone = `(${phone.substring(0, 2)}) ${phone.substring(2, 7)}-${phone.substring(7)}`;
    else if (phone.length > 0) formattedPhone = phone;
  }

  const companyObject = {
    cnpj: data.cnpj, name: data.razao_social || data.nome_fantasia || 'N/A',
    cnae: data.cnae_fiscal, cnae_desc: data.cnae_fiscal_descricao,
    cnaes_secundarios: data.cnaes_secundarios || [], porte: data.porte,
    natureza_juridica: data.natureza_juridica,
    address: address || 'Endereco nao informado',
    street: data.logradouro, number: data.numero, complement: data.complemento || '',
    neighborhood: data.bairro, city: data.municipio, state: data.uf, zip_code: data.cep,
    email: data.email || '', phone: formattedPhone,
    mei: false, opcao_pelo_mei: data.opcao_pelo_mei,
    situacao: typeof data.descricao_situacao_cadastral === 'object'
      ? (data.descricao_situacao_cadastral?.descricao || '')
      : String(data.descricao_situacao_cadastral || ''),
    source: data.source, qsa: data.qsa || []
  };

  companyObject.grau_risco = getRiskDegree(companyObject.cnae);
  companyObject.risk_level = String(companyObject.grau_risco).padStart(2, '0');
  companyObject.mei = isTrueMEI(companyObject);
  return companyObject;
};

const roundCurrency = (value) => Math.round((Number(value) || 0) * 100) / 100;

export const calcularMensalidadePerCapita = ({
  employeeCount,
  valorBaseCapita = 10,
  limitePlanoMinimo = 30,
  valorExtraCapita = 20,
} = {}) => {
  const count = Math.max(1, Math.round(Number(employeeCount) || 1));
  const baseRate = Math.max(0, Number(valorBaseCapita) || 10);
  const minPlan = Math.max(1, Math.round(Number(limitePlanoMinimo) || 30));
  const extraRate = Math.max(0, Number(valorExtraCapita) || 20);
  const base = roundCurrency(minPlan * baseRate);
  const excedente = roundCurrency(Math.max(count - minPlan, 0) * extraRate);
  const total = roundCurrency(base + excedente);
  return { total, base, excedente, employeeCount: count, limitePlanoMinimo: minPlan, valorBaseCapita: baseRate, valorExtraCapita: extraRate };
};

export const getRiskDegree = (cnae) => {
  if (!cnae) return 2;
  const clean = cleanDigits(cnae);
  const prefix = clean.substring(0, 2);
  const div = parseInt(prefix);
  if (div >= 1 && div <= 3) return 3;
  if (div >= 5 && div <= 9) return 4;
  if (div === 12) return 3;
  if (div >= 10 && div <= 12) return 3;
  if (div >= 13 && div <= 15) return 2;
  if (div >= 16 && div <= 18) return 3;
  if (div === 19) return 4;
  if (div >= 20 && div <= 23) return 3;
  if (div === 24) return 4;
  if (div >= 25 && div <= 33) return 3;
  if (div >= 35 && div <= 39) return 3;
  if (div >= 41 && div <= 43) return 4;
  if (div >= 45 && div <= 47) return 2;
  if (div >= 49 && div <= 53) return 3;
  if (div >= 55 && div <= 56) return 2;
  if (div >= 58 && div <= 63) return 2;
  if (div >= 64 && div <= 66) return 1;
  if (div === 68) return 2;
  if (div === 75) return 3;
  if (div >= 69 && div <= 74) return 2;
  if (div === 80) return 3;
  if (div === 81) return 3;
  if (div >= 77 && div <= 82) return 2;
  if (div === 84) return 1;
  if (div === 85) return 2;
  if (div === 86) return 3;
  if (div >= 87 && div <= 88) return 2;
  if (div >= 90 && div <= 93) return 2;
  if (div === 94) return 2;
  if (div === 95) return 2;
  if (div === 96) return 2;
  if (div >= 97) return 2;
  return 2;
};

export const analyzeRegulatoryStatus = (companyData) => {
  const grauRisco = companyData.grau_risco || getRiskDegree(companyData.cnae);
  const isMEI = isTrueMEI(companyData);
  const isDemandingSmallCompany = isSmallPorte(companyData.porte) && !isMEI;
  logPorteClassification(companyData);
  const isLowRisk = grauRisco === 1 || grauRisco === 2;
  const isHighRisk = grauRisco === 3 || grauRisco === 4;

  if (isHighRisk) {
    return {
      recommendation: 'PGR', title: 'PGR',
      description: `Grau de Risco ${grauRisco}: a documentacao segue com PGR e PCMSO, mas a assinatura final depende da decisao do consultor sobre a necessidade de visita in loco.`,
      allowed_types: ['PGR'], grau_risco: grauRisco, requires_consultant: true, can_generate_final: false,
      warning: 'Empresas de Grau de Risco 3 ou 4 passam obrigatoriamente pela decisao do consultor.'
    };
  }

  if (isMEI && isLowRisk) {
    const employeeCount = Number(companyData.employee_count || companyData.intake_data?.employee_count || 0);
    if (employeeCount > 0) {
      return {
        recommendation: 'PGR', title: 'PGR + PCMSO',
        description: `MEI com ${employeeCount} colaborador(es) - mesmo com Grau de Risco ${grauRisco}, a presenca de colaboradores exige PGR e PCMSO conforme NR-01.`,
        allowed_types: ['PGR'], grau_risco: grauRisco, requires_consultant: false, can_generate_final: true, validity_months: 24
      };
    }
    return {
      recommendation: 'DIR', title: 'DIR - Declaracao de Inexistencia de Risco',
      description: 'MEI Grau 1/2 sem colaboradores: dispensado de PGR conforme NR-01.8.4.',
      allowed_types: ['DIR'], grau_risco: grauRisco, requires_consultant: false, can_generate_final: true, validity_months: 24
    };
  }

  if (isDemandingSmallCompany && isLowRisk) {
    return {
      recommendation: 'PGR', title: 'PGR',
      description: 'Empresa de baixo risco com enquadramento elegivel ao tratamento diferenciado da NR-01.',
      allowed_types: ['PGR'], grau_risco: grauRisco, requires_consultant: false, can_generate_final: true, validity_months: 24
    };
  }

  return {
    recommendation: 'PGR', title: 'PGR',
    description: `Grau de Risco ${grauRisco}. A empresa deve seguir com PGR e PCMSO conforme a NR-01 e a NR-07.`,
    allowed_types: ['PGR'], grau_risco: grauRisco, requires_consultant: false, can_generate_final: true, validity_months: 24
  };
};
