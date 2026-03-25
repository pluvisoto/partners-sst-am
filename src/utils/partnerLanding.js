/**
 * Partner Landing - Extrai referral do path (slug) e utilitários de URL.
 */

const RESERVED_PARTNER_LANDING_PATHS = new Set([
  'login', 'admin', 'cliente', 'parceiro', 'dashboard',
  'contadores', 'landingpage', 'checkout', 'api',
]);

export const normalizeReferralCode = (raw) => {
  if (!raw) return '';
  return String(raw).trim().toLowerCase().replace(/[^a-z0-9_-]/g, '');
};

export const isReservedPartnerLandingSlug = (slug) => {
  return RESERVED_PARTNER_LANDING_PATHS.has(normalizeReferralCode(slug));
};

export const extractPartnerReferralFromPath = (pathname) => {
  if (!pathname) return null;
  const clean = pathname.replace(/^\/+|\/+$/g, '');
  if (!clean) return null;
  const segments = clean.split('/');
  if (segments.length !== 1) return null;
  const slug = normalizeReferralCode(segments[0]);
  if (!slug || isReservedPartnerLandingSlug(slug)) return null;
  return slug;
};

export const buildPartnerLandingPath = (referralCode) => {
  const code = normalizeReferralCode(referralCode);
  return code ? `/${code}` : '/';
};

export const buildPartnerLandingUrl = (referralCode, baseUrl) => {
  const base = (baseUrl || window.location.origin).replace(/\/+$/, '');
  return `${base}${buildPartnerLandingPath(referralCode)}`;
};
