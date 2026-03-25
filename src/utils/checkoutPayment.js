import { supabase } from './supabase.js';

export const MAX_CREDIT_CARD_INSTALLMENTS = 12;

const roundCurrency = (value) => Math.round(Number(value || 0) * 100) / 100;

export const buildInstallmentFallback = ({ price, installmentCount }) => {
  const normalizedPrice = roundCurrency(price);
  const normalizedInstallmentCount = Math.min(Math.max(Number(installmentCount) || 1, 1), MAX_CREDIT_CARD_INSTALLMENTS);

  return {
    success: true,
    billing_type: 'CREDIT_CARD',
    base_value: normalizedPrice,
    total_value: normalizedPrice,
    installment_count: normalizedInstallmentCount,
    installment_value: roundCurrency(normalizedPrice / normalizedInstallmentCount),
    monthly_interest_rate: 0,
    simulated: false,
  };
};

export const extractFunctionError = async (result, fallbackMessage) => {
  if (!result?.error) return null;

  try {
    const body = await result.error.context?.json?.();
    if (body?.error) return body.error;
  } catch (error) {
    console.error('[checkoutPayment] Erro ao extrair resposta da edge function:', error);
  }

  if (result.data?.error) return result.data.error;
  if (result.error.message) return result.error.message;

  return fallbackMessage;
};

export const simulateCreditCardInstallments = async ({ price, installmentCount }) => {
  const result = await supabase.functions.invoke('asaas-checkout', {
    body: {
      action: 'simulate',
      billing_type: 'CREDIT_CARD',
      price,
      installment_count: installmentCount,
    },
  });

  const errorMessage = await extractFunctionError(result, 'Nao foi possivel simular as parcelas do cartao.');
  if (errorMessage) {
    throw new Error(errorMessage);
  }

  if (!result.data?.success) {
    throw new Error(result.data?.error || 'Nao foi possivel simular as parcelas do cartao.');
  }

  return {
    ...result.data,
    simulated: true,
  };
};

export const syncHostedPaymentStatus = async ({ paymentId }) => {
  const result = await supabase.functions.invoke('asaas-checkout', {
    body: {
      action: 'sync_status',
      payment_id: paymentId,
    },
  });

  const errorMessage = await extractFunctionError(result, 'Nao foi possivel sincronizar o status do pagamento.');
  if (errorMessage) {
    throw new Error(errorMessage);
  }

  if (!result.data?.success) {
    throw new Error(result.data?.error || 'Nao foi possivel sincronizar o status do pagamento.');
  }

  return result.data;
};
