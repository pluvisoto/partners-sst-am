// ==================== FORMATACAO PADRONIZADA ====================
const PT_BR_LOCALE = 'pt-BR';

export const cleanDigits = (value) => String(value || '').replace(/\D/g, '');

export const parseCurrencyInput = (value) => {
  if (value === null || value === undefined || value === '') return null;
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  const normalized = String(value)
    .replace(/\s/g, '')
    .replace(/R\$/gi, '')
    .replace(/\./g, '')
    .replace(',', '.')
    .replace(/[^\d.-]/g, '');
  if (!normalized || normalized === '-' || normalized === '.' || normalized === '-.') return null;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
};

export const formatCNPJ = (value) => {
  if (!value) return '';
  const clean = cleanDigits(value).slice(0, 14);
  if (clean.length !== 14) return clean;
  return clean.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5');
};

export const maskCNPJ = (value) => {
  const digits = cleanDigits(value).slice(0, 14);
  return digits
    .replace(/^(\d{2})(\d)/, '$1.$2')
    .replace(/^(\d{2})\.(\d{3})(\d)/, '$1.$2.$3')
    .replace(/\.(\d{3})(\d)/, '.$1/$2')
    .replace(/(\d{4})(\d)/, '$1-$2');
};

export const formatPhone = (value) => {
  if (!value) return '';
  const clean = cleanDigits(value);
  if (clean.length === 11) return clean.replace(/^(\d{2})(\d{5})(\d{4})$/, '($1) $2-$3');
  if (clean.length === 10) return clean.replace(/^(\d{2})(\d{4})(\d{4})$/, '($1) $2-$3');
  return value;
};

export const maskPhone = (value) => {
  const digits = cleanDigits(value).slice(0, 11);
  if (digits.length <= 10) return digits.replace(/^(\d{2})(\d{4})(\d{0,4})/, '($1) $2-$3');
  return digits.replace(/^(\d{2})(\d{5})(\d{0,4})/, '($1) $2-$3');
};

export const formatCPF = (value) => {
  if (!value) return '';
  const clean = cleanDigits(value).slice(0, 11);
  if (clean.length !== 11) return clean;
  return clean.replace(/^(\d{3})(\d{3})(\d{3})(\d{2})$/, '$1.$2.$3-$4');
};

export const maskCPF = (value) => {
  const digits = cleanDigits(value).slice(0, 11);
  return digits
    .replace(/^(\d{3})(\d)/, '$1.$2')
    .replace(/^(\d{3})\.(\d{3})(\d)/, '$1.$2.$3')
    .replace(/\.(\d{3})(\d)/, '.$1-$2');
};

export const formatCurrency = (value) => {
  const num = parseCurrencyInput(value);
  if (num === null) return '';
  return num.toLocaleString(PT_BR_LOCALE, { style: 'currency', currency: 'BRL' });
};

export const formatPercent = (value) => {
  if (value === null || value === undefined || value === '') return '';
  const normalized = typeof value === 'string'
    ? value.replace(/\s/g, '').replace(/%/g, '').replace(/\./g, '').replace(',', '.')
    : value;
  const num = Number(normalized);
  if (!Number.isFinite(num)) return '';
  return num.toLocaleString(PT_BR_LOCALE, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + '%';
};

export const formatPercentWithDecimals = (value, decimals = 2) => {
  if (value === null || value === undefined || value === '') return '';
  const normalized = typeof value === 'string'
    ? value.replace(/\s/g, '').replace(/%/g, '').replace(/\./g, '').replace(',', '.')
    : value;
  const num = Number(normalized);
  if (!Number.isFinite(num)) return '';
  return num.toLocaleString(PT_BR_LOCALE, {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }) + '%';
};

export const formatCompanyName = (value) => {
  if (!value) return '';
  return String(value).toUpperCase();
};
