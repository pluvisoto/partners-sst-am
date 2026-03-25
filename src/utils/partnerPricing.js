import { calcularMensalidadePerCapita } from './sst-engine.js';

export const PARTNER_PRODUCT_PRICE_FIELDS = [
  {
    key: 'pgr_pcmso_bundle_price',
    label: 'PGR + PCMSO (legado)',
    description: 'Pacote completo PGR + PCMSO - substituido pelo modelo per capita',
  },
  {
    key: 'dir_price',
    label: 'DIR',
    description: 'Declaracao de Inexistencia de Risco',
  },
  {
    key: 'additional_employee_price',
    label: 'Colaborador adicional (legado)',
    description: 'Custo unitario adicional - substituido pelo modelo per capita',
  },
  {
    key: 'valor_base_capita',
    label: 'Valor base per capita',
    description: 'Valor por colaborador dentro do plano minimo',
  },
  {
    key: 'limite_plano_minimo',
    label: 'Plano minimo (colaboradores)',
    description: 'Quantidade minima de colaboradores no plano',
    isInteger: true,
  },
  {
    key: 'valor_extra_capita',
    label: 'Valor excedente per capita',
    description: 'Valor por colaborador acima do plano minimo',
  },
];

const normalizePrice = (value, fallback = 0) => {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return Math.max(0, Number(fallback) || 0);
  return Math.max(0, Math.round(numeric * 100) / 100);
};

export const normalizePartnerProductPrices = (productPrices = {}, fallbackPrices = {}) => {
  return PARTNER_PRODUCT_PRICE_FIELDS.reduce((acc, field) => {
    acc[field.key] = normalizePrice(productPrices?.[field.key], fallbackPrices?.[field.key]);
    return acc;
  }, {});
};

export const countConfiguredPartnerProducts = (productPrices = {}) => {
  const normalized = normalizePartnerProductPrices(productPrices);
  return Object.values(normalized).filter((value) => value > 0).length;
};

export const hasPartnerProductPricing = (productPrices = {}) => countConfiguredPartnerProducts(productPrices) > 0;

export const mergeCompanyPricingWithPartnerPricing = (companyPricing = {}, productPrices = {}) => {
  const merged = { ...(companyPricing || {}) };
  const normalized = normalizePartnerProductPrices(productPrices);
  PARTNER_PRODUCT_PRICE_FIELDS.forEach((field) => {
    if (normalized[field.key] > 0) {
      merged[field.key] = normalized[field.key];
    }
  });
  return merged;
};

const normalizeDocuments = (documents = []) => {
  if (!Array.isArray(documents)) return [];
  return [...new Set(documents.map((item) => String(item || '').trim().toUpperCase()).filter(Boolean))];
};

export const getPartnerBasePriceForDocuments = ({ documents = [], productPrices = {}, fallbackBasePrice = 0, employeeCount = null }) => {
  const normalizedDocs = normalizeDocuments(documents);
  if (normalizedDocs.length === 0) return normalizePrice(fallbackBasePrice);

  const normalizedPrices = normalizePartnerProductPrices(productPrices);
  let total = 0;

  const hasPgr = normalizedDocs.includes('PGR');
  const hasPcmso = normalizedDocs.includes('PCMSO');
  const hasDir = normalizedDocs.includes('DIR');

  if (hasPgr || hasPcmso) {
    if (employeeCount != null && Number(employeeCount) >= 1) {
      const resultado = calcularMensalidadePerCapita({
        employeeCount: Number(employeeCount),
        valorBaseCapita: Number(normalizedPrices.valor_base_capita) || 10,
        limitePlanoMinimo: Number(normalizedPrices.limite_plano_minimo) || 30,
        valorExtraCapita: Number(normalizedPrices.valor_extra_capita) || 20,
      });
      total += resultado.total;
    } else {
      total += normalizedPrices.pgr_pcmso_bundle_price > 0
        ? normalizedPrices.pgr_pcmso_bundle_price
        : 4300;
    }
  }

  if (hasDir) {
    total += normalizedPrices.dir_price;
  }

  return total > 0 ? normalizePrice(total) : normalizePrice(fallbackBasePrice);
};
