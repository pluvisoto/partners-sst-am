import { analyzeRegulatoryStatus, calcularMensalidadePerCapita } from './sst-engine.js';

export const DOCUMENT_OFFER_IDS = {
  PGR_PCMSO: 'PGR_PCMSO',
  PGR: 'PGR_PCMSO',
  PCMSO: 'PGR_PCMSO',
  DIR: 'DIR',
  CONSULTORIA: 'CONSULTORIA',
  PARTNER_CUSTOM: 'PARTNER_CUSTOM',
};

const OFFER_TITLES = {
  [DOCUMENT_OFFER_IDS.PGR_PCMSO]: 'PGR + PCMSO',
  [DOCUMENT_OFFER_IDS.DIR]: 'DIR',
  [DOCUMENT_OFFER_IDS.CONSULTORIA]: 'Consultoria Especializada',
  [DOCUMENT_OFFER_IDS.PARTNER_CUSTOM]: 'Oferta Personalizada',
};

const normalizeDocuments = (documents) => {
  if (!Array.isArray(documents)) return [];
  const normalized = documents
    .map((item) => String(item || '').trim().toUpperCase())
    .map((item) => (item === 'PGR+PCMSO' ? 'PGR_PCMSO' : item))
    .flatMap((item) => {
      if (item === 'PGR_PCMSO') return ['PGR', 'PCMSO'];
      if (item === 'DIR') return ['DIR'];
      if (item === 'PGR' || item === 'PCMSO') return [item];
      return [];
    });
  return [...new Set(normalized)];
};

export const getOfferTitle = (offerId) => OFFER_TITLES[offerId] || 'Oferta Documental';

const resolveOfferDocuments = (offerId, customDocuments = []) => {
  if (offerId === DOCUMENT_OFFER_IDS.PGR_PCMSO) return ['PGR', 'PCMSO'];
  if (offerId === DOCUMENT_OFFER_IDS.DIR) return ['DIR'];
  if (offerId === DOCUMENT_OFFER_IDS.PARTNER_CUSTOM) return normalizeDocuments(customDocuments);
  return [];
};

export const getOfferPrice = ({ offerId, recommendation, pricing = {}, customPrice = null, employeeCount = null }) => {
  if (customPrice != null && Number.isFinite(Number(customPrice))) return Number(customPrice);
  if (offerId === DOCUMENT_OFFER_IDS.DIR) return Number(pricing.dir_price || 0);

  if (employeeCount != null && Number(employeeCount) >= 1) {
    const resultado = calcularMensalidadePerCapita({
      employeeCount: Number(employeeCount),
      valorBaseCapita: Number(pricing.valor_base_capita) || 10,
      limitePlanoMinimo: Number(pricing.limite_plano_minimo) || 30,
      valorExtraCapita: Number(pricing.valor_extra_capita) || 20,
    });
    return resultado.total;
  }

  const bundlePrice = Number(pricing.pgr_pcmso_bundle_price || 0);
  return bundlePrice > 0 ? bundlePrice : 4300;
};

export const getOfferPriceBreakdown = ({ offerId, pricing = {}, employeeCount = null }) => {
  if (offerId === DOCUMENT_OFFER_IDS.DIR || !employeeCount || Number(employeeCount) < 1) return null;
  return calcularMensalidadePerCapita({
    employeeCount: Number(employeeCount),
    valorBaseCapita: Number(pricing.valor_base_capita) || 10,
    limitePlanoMinimo: Number(pricing.limite_plano_minimo) || 30,
    valorExtraCapita: Number(pricing.valor_extra_capita) || 20,
  });
};

const buildOfferDescription = (offerId) => {
  if (offerId === DOCUMENT_OFFER_IDS.DIR) {
    return 'Declaracao de Inexistencia de Risco com validade legal para enquadramentos elegiveis.';
  }
  return 'Pacote completo com PGR e PCMSO alinhados a avaliacao de riscos da empresa.';
};

export const getRecommendedOfferId = (regulatoryStatus) => {
  const recommendation = regulatoryStatus?.recommendation || null;
  if (recommendation === 'DIR') return DOCUMENT_OFFER_IDS.DIR;
  if (recommendation === 'PGR') return DOCUMENT_OFFER_IDS.PGR_PCMSO;
  return null;
};

export const buildAvailableOffers = ({ companyData, pricing = {}, customOffers = [], employeeCount = null }) => {
  const regulatoryStatus = analyzeRegulatoryStatus(companyData || {});
  const recommendation = regulatoryStatus?.recommendation || null;
  const recommendedOfferId = getRecommendedOfferId(regulatoryStatus);

  if (recommendation === 'DIR') {
    return {
      regulatoryStatus,
      recommendedOfferId,
      offers: [{
        id: DOCUMENT_OFFER_IDS.DIR,
        title: getOfferTitle(DOCUMENT_OFFER_IDS.DIR),
        shortLabel: 'DIR',
        checkoutLabel: 'DIR',
        description: buildOfferDescription(DOCUMENT_OFFER_IDS.DIR),
        documents: ['DIR'],
        recommended: true,
        recommendation,
        price: getOfferPrice({ offerId: DOCUMENT_OFFER_IDS.DIR, recommendation, pricing }),
        priceBreakdown: null,
      }],
    };
  }

  const baseOffers = [DOCUMENT_OFFER_IDS.PGR_PCMSO].map((offerId) => ({
    id: offerId,
    title: getOfferTitle(offerId),
    shortLabel: 'PGR + PCMSO',
    checkoutLabel: getOfferTitle(offerId),
    description: buildOfferDescription(offerId),
    documents: resolveOfferDocuments(offerId),
    recommended: offerId === recommendedOfferId,
    recommendation,
    price: getOfferPrice({ offerId, recommendation, pricing, employeeCount }),
    priceBreakdown: getOfferPriceBreakdown({ offerId, pricing, employeeCount }),
  }));

  return {
    regulatoryStatus,
    recommendedOfferId,
    offers: baseOffers,
  };
};

export const buildDocumentOfferPayload = ({
  offerId,
  companyData,
  pricing = {},
  customPrice = null,
  customDocuments = null,
  source = 'system',
  employeeCount = null,
}) => {
  const regulatoryStatus = analyzeRegulatoryStatus(companyData || {});
  const recommendation = regulatoryStatus?.recommendation || null;
  const resolvedOfferId = offerId || getRecommendedOfferId(regulatoryStatus) || DOCUMENT_OFFER_IDS.PGR_PCMSO;
  const documents = resolveOfferDocuments(resolvedOfferId, customDocuments || []);
  const label = getOfferTitle(resolvedOfferId);

  return {
    offer_id: resolvedOfferId,
    recommendation_basis: recommendation,
    regulatory_title: regulatoryStatus?.title || null,
    documents,
    label,
    price: getOfferPrice({
      offerId: resolvedOfferId,
      recommendation,
      pricing,
      customPrice,
      employeeCount,
    }),
    employee_count: employeeCount != null ? Math.max(1, Math.round(Number(employeeCount) || 1)) : null,
    price_breakdown: getOfferPriceBreakdown({ offerId: resolvedOfferId, pricing, employeeCount }),
    source,
  };
};
