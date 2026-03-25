export const MIN_PASSWORD_LENGTH = 10;

export const PASSWORD_RULES = [
  { label: `Mínimo de ${10} caracteres`, test: (v) => v.length >= 10 },
  { label: 'Ao menos uma letra maiúscula (A-Z)', test: (v) => /[A-Z]/.test(v) },
  { label: 'Ao menos uma letra minúscula (a-z)', test: (v) => /[a-z]/.test(v) },
  { label: 'Ao menos um número (0-9)', test: (v) => /\d/.test(v) },
  { label: 'Ao menos um caractere especial (!@#$...)', test: (v) => /[^A-Za-z0-9]/.test(v) },
];

export const getPasswordPolicyErrors = (password) => {
  const value = String(password || '');
  const errors = [];
  if (value.length < MIN_PASSWORD_LENGTH) errors.push(`A senha deve ter no minimo ${MIN_PASSWORD_LENGTH} caracteres.`);
  if (!/[a-z]/.test(value)) errors.push('A senha deve incluir ao menos uma letra minuscula.');
  if (!/[A-Z]/.test(value)) errors.push('A senha deve incluir ao menos uma letra maiuscula.');
  if (!/\d/.test(value)) errors.push('A senha deve incluir ao menos um numero.');
  if (!/[^A-Za-z0-9]/.test(value)) errors.push('A senha deve incluir ao menos um caractere especial.');
  return errors;
};

export const validatePasswordStrength = (password) => {
  const errors = getPasswordPolicyErrors(password);
  return { valid: errors.length === 0, errors };
};

export const getPasswordValidationMessage = (password) => {
  const { errors } = validatePasswordStrength(password);
  return errors[0] || '';
};

export const generateStrongPassword = () => {
  const randomSource = typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID().replace(/-/g, '')
    : `${Date.now().toString(36)}${Math.random().toString(36).slice(2)}`;
  return `Am#${randomSource.slice(0, 8)}9z`;
};
