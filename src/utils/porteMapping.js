export const PORTE_CATEGORIES = {
  MEI: 'MEI',
  MICRO: 'MICRO',
  PEQUENO: 'PEQUENO',
  MEDIO: 'MÉDIO',
  GRANDE: 'GRANDE',
  OUTROS: 'OUTROS'
};

export const PORTE_MAPPING = {
  'MEI': PORTE_CATEGORIES.MEI,
  'MICROEMPREENDEDOR INDIVIDUAL': PORTE_CATEGORIES.MEI,
  'MICROEMPREENDEDOR': PORTE_CATEGORIES.MEI,
  'MICRO': PORTE_CATEGORIES.MICRO,
  'MICRO EMPRESA': PORTE_CATEGORIES.MICRO,
  'MICROEMPRESA': PORTE_CATEGORIES.MICRO,
  'MICRO EMPRESA - EMPRESÁRIO': PORTE_CATEGORIES.MICRO,
  'MICRO EMPRESA - SOCIEDADE': PORTE_CATEGORIES.MICRO,
  'PEQUENA': PORTE_CATEGORIES.PEQUENO,
  'EMPRESA DE PEQUENO PORTE': PORTE_CATEGORIES.PEQUENO,
  'EMPRESA PEQUENO PORTE': PORTE_CATEGORIES.PEQUENO,
  'EPP': PORTE_CATEGORIES.PEQUENO,
  'PEQUENO PORTE': PORTE_CATEGORIES.PEQUENO,
  'MÉDIO': PORTE_CATEGORIES.MEDIO,
  'MEDIA': PORTE_CATEGORIES.MEDIO,
  'MÉDIA EMPRESA': PORTE_CATEGORIES.MEDIO,
  'MEDIA EMPRESA': PORTE_CATEGORIES.MEDIO,
  'MÉDIO PORTE': PORTE_CATEGORIES.MEDIO,
  'MEDIO PORTE': PORTE_CATEGORIES.MEDIO,
  'GRANDE': PORTE_CATEGORIES.GRANDE,
  'GRANDE EMPRESA': PORTE_CATEGORIES.GRANDE,
  'GRANDE PORTE': PORTE_CATEGORIES.GRANDE,
  'MATRIZ': PORTE_CATEGORIES.MICRO,
  'FILIAL': PORTE_CATEGORIES.MICRO,
  '01': PORTE_CATEGORIES.MICRO,
  '03': PORTE_CATEGORIES.PEQUENO,
  '05': PORTE_CATEGORIES.MEDIO,
  '07': PORTE_CATEGORIES.GRANDE,
  '': PORTE_CATEGORIES.MICRO,
  'NULL': PORTE_CATEGORIES.MICRO,
  'UNDEFINED': PORTE_CATEGORIES.MICRO,
  'N/A': PORTE_CATEGORIES.MICRO,
  'NA': PORTE_CATEGORIES.MICRO,
};

export const normalizePorte = (porteRaw) => {
  if (!porteRaw) return PORTE_CATEGORIES.MICRO;
  const clean = String(porteRaw).trim().toUpperCase();
  if (PORTE_MAPPING[clean]) return PORTE_MAPPING[clean];
  for (const [key, category] of Object.entries(PORTE_MAPPING)) {
    if (key && clean.includes(key) && key.length > 2) return category;
  }
  console.warn(`[porteMapping] Valor de porte desconhecido: "${porteRaw}". Normalizando para MICRO.`);
  return PORTE_CATEGORIES.MICRO;
};

export const isSmallPorte = (porteRaw) => {
  const normalized = normalizePorte(porteRaw);
  return [PORTE_CATEGORIES.MEI, PORTE_CATEGORIES.MICRO, PORTE_CATEGORIES.PEQUENO].includes(normalized);
};

export const isLargePorte = (porteRaw) => {
  const normalized = normalizePorte(porteRaw);
  return [PORTE_CATEGORIES.MEDIO, PORTE_CATEGORIES.GRANDE].includes(normalized);
};

export const logPorteClassification = (companyData) => {
  const porteRaw = companyData.porte || '';
  const porteNorm = normalizePorte(porteRaw);
  const isSmall = isSmallPorte(porteRaw);
  const isLarge = isLargePorte(porteRaw);
  console.log(`[porteMapping] Classificacao de PORTE:`, {
    'Raw API': porteRaw, 'Normalizado': porteNorm,
    'Elegivel PGR': isSmall, 'Requer PGR Completo': isLarge, cnpj: companyData.cnpj
  });
  return { porteRaw, porteNormalized: porteNorm, isSmall, isLarge,
    warning: isSmall ? null : `Porte "${porteRaw}" nao e elegivel para tratamento diferenciado` };
};
