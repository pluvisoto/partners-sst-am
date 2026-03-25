import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { fetchCompanyData, analyzeRegulatoryStatus } from '../../utils/sst-engine';
import { getCompanyConfig } from '../../utils/companyConfig';
import { MAX_CREDIT_CARD_INSTALLMENTS, buildInstallmentFallback, extractFunctionError, simulateCreditCardInstallments, syncHostedPaymentStatus } from '../../utils/checkoutPayment';
import { supabase } from '../../utils/supabase';
import { cleanDigits, formatCurrency, formatPercentWithDecimals, maskCNPJ, maskPhone } from '../../utils/formatters';
import { buildAvailableOffers, buildDocumentOfferPayload } from '../../utils/documentOffers';
import { mergeCompanyPricingWithPartnerPricing } from '../../utils/partnerPricing';

const SST_APP_URL = import.meta.env.VITE_SST_APP_URL || 'https://sst.amengenhariaseg.com.br';

// ─── Icons ───
const SearchIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
);
const LockIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
);
const LogOutIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
);
const BuildingIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="4" y="2" width="16" height="20" rx="2" ry="2"/><path d="M9 22v-4h6v4M8 6h.01M16 6h.01M12 6h.01M12 10h.01M8 10h.01M16 10h.01M12 14h.01M8 14h.01M16 14h.01"/></svg>
);
const MapPinIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
);
const ShieldIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
);
const CheckCircleIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#22c55e" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
);
const AlertTriangleIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
);
const UsersIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
);

// ─── Info cell for company data grid ───
const InfoItem = ({ label, value, sub, badge, badgeColor }) => (
  <div>
    <span style={{ color: '#6b7280', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
      {label}
    </span>
    {badge ? (
      <div style={{ marginTop: '3px', display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
        <span style={{
          display: 'inline-block', width: '8px', height: '8px', borderRadius: '50%',
          background: badgeColor, flexShrink: 0
        }} />
        <span style={{ color: '#e5e7eb', fontSize: '0.92rem', fontWeight: 600 }}>{value}</span>
      </div>
    ) : (
      <p style={{ color: '#d1d5db', margin: '2px 0 0 0', fontSize: '0.88rem', lineHeight: 1.4 }}>
        {value}
      </p>
    )}
    {sub && (
      <p style={{ color: '#6b7280', margin: '1px 0 0 0', fontSize: '0.78rem', lineHeight: 1.3 }}>
        {sub}
      </p>
    )}
  </div>
);

const LeadDashboard = ({
  session,
  onLogout,
}) => {
  const [cnpj, setCnpj] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [companyPrices, setCompanyPrices] = useState(null);
  const [partnerProductPrices, setPartnerProductPrices] = useState(null);
  const resultRef = useRef(null);

  // Checkout state
  const [checkoutStep, setCheckoutStep] = useState(null); // null, 'form', 'payment'
  const [billingType, setBillingType] = useState('PIX');
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const [checkoutError, setCheckoutError] = useState(null);
  const [paymentResult, setPaymentResult] = useState(null);
  const [copied, setCopied] = useState(false);
  const [leadData, setLeadData] = useState(null);
  const [paymentConfirmed, setPaymentConfirmed] = useState(false);
  const [installmentCount, setInstallmentCount] = useState(MAX_CREDIT_CARD_INSTALLMENTS);
  const [cardSimulation, setCardSimulation] = useState(null);
  const [cardSimulationLoading, setCardSimulationLoading] = useState(false);
  const [cardSimulationError, setCardSimulationError] = useState(null);
  const [selectedOfferId, setSelectedOfferId] = useState(null);
  const [employeeCount, setEmployeeCount] = useState('');

  useEffect(() => {
    // Preload lead profile data via SECURITY DEFINER RPC (bypasses RLS timing)
    if (session?.user_id) {
      supabase.rpc('get_my_lead_data')
        .then(({ data, error }) => {
          if (error) console.error('[LeadDash] RPC get_my_lead_data erro:', error.message);
          if (data?.[0]) setLeadData(data[0]);
        })
        .catch((err) => console.error('[LeadDash] Erro ao carregar dados do lead:', err));
    }
  }, [session?.user_id]);

  useEffect(() => {
    getCompanyConfig().then((res) => {
      if (res.success) setCompanyPrices(res.data);
    }).catch((err) => console.error('[LeadDash] Erro ao carregar precos:', err));
  }, []);

  const partnerRef = leadData?.partner_ref || session?.partner_ref || null;

  useEffect(() => {
    let active = true;

    if (!partnerRef) {
      setPartnerProductPrices(null);
      return () => {
        active = false;
      };
    }

    supabase.rpc('get_partner_public_pricing', {
      p_referral_code: partnerRef,
    }).then(({ data, error: pricingError }) => {
      if (!active) return;
      if (pricingError) {
        console.error('[LeadDash] Erro ao carregar precificacao publica do parceiro:', pricingError);
        setPartnerProductPrices(null);
        return;
      }

      setPartnerProductPrices(data?.[0]?.product_base_prices || null);
    }).catch((rpcError) => {
      console.error('[LeadDash] Erro inesperado ao carregar precificacao do parceiro:', rpcError);
      if (active) setPartnerProductPrices(null);
    });

    return () => {
      active = false;
    };
  }, [partnerRef]);

  const prices = useMemo(() => {
    if (!companyPrices) return null;
    return mergeCompanyPricingWithPartnerPricing(companyPrices, partnerProductPrices || {});
  }, [companyPrices, partnerProductPrices]);

  const parsedEmployeeCount = Number(employeeCount) > 0 ? Number(employeeCount) : null;

  useEffect(() => {
    let active = true;

    if (!prices || !result) {
      setCardSimulation(null);
      setCardSimulationError(null);
      setCardSimulationLoading(false);
      return () => {
        active = false;
      };
    }

    const availableOffers = buildAvailableOffers({ companyData: result.company, pricing: prices, employeeCount: parsedEmployeeCount });
    const currentOffer = availableOffers.offers.find((offer) => offer.id === selectedOfferId)
      || availableOffers.offers.find((offer) => offer.recommended)
      || availableOffers.offers[0]
      || null;
    const priceToSimulate = Number(currentOffer?.price || 0) || null;
    if (!priceToSimulate) {
      setCardSimulation(null);
      setCardSimulationError(null);
      setCardSimulationLoading(false);
      return () => {
        active = false;
      };
    }

    setCardSimulationLoading(true);

    simulateCreditCardInstallments({
      price: priceToSimulate,
      installmentCount,
    })
      .then((data) => {
        if (!active) return;
        setCardSimulation(data);
        setCardSimulationError(null);
      })
      .catch((error) => {
        console.error('[LeadDash] Erro ao simular parcelas:', error);
        if (!active) return;
        setCardSimulation(buildInstallmentFallback({
          price: priceToSimulate,
          installmentCount,
        }));
        setCardSimulationError(null);
      })
      .finally(() => {
        if (active) setCardSimulationLoading(false);
      });

    return () => {
      active = false;
    };
  }, [installmentCount, prices, result, selectedOfferId, parsedEmployeeCount]);

  useEffect(() => {
    if (!result || !prices) return;
    const availableOffers = buildAvailableOffers({ companyData: result.company, pricing: prices, employeeCount: parsedEmployeeCount });
    if (!selectedOfferId && availableOffers.recommendedOfferId) {
      setSelectedOfferId(availableOffers.recommendedOfferId);
    }
  }, [result, prices, selectedOfferId]);

  // Poll payment status after payment is created
  useEffect(() => {
    if (!paymentResult?.payment_id || paymentConfirmed) return;
    // If auto-confirmed (sandbox), mark immediately
    if (paymentResult.auto_confirmed) {
      setPaymentConfirmed(true);
      return;
    }
    const interval = setInterval(async () => {
      try {
        const data = await syncHostedPaymentStatus({ paymentId: paymentResult.payment_id });
        if (data?.confirmed) {
          setPaymentConfirmed(true);
          clearInterval(interval);
        }
      } catch (err) {
        console.error('[LeadDash] Erro ao verificar status:', err);
      }
    }, 5000);
    return () => clearInterval(interval);
  }, [paymentResult?.payment_id, paymentResult?.auto_confirmed, paymentConfirmed]);

  const handleAnalyze = useCallback(async () => {
    const cleanCNPJ = cleanDigits(cnpj);
    if (cleanCNPJ.length !== 14) {
      setError('Informe um CNPJ valido com 14 digitos.');
      return;
    }
    setLoading(true);
    setError(null);
    setResult(null);
    setCheckoutStep(null);
    setPaymentResult(null);
    setSelectedOfferId(null);
    setEmployeeCount('');
    try {
      const company = await fetchCompanyData(cleanCNPJ);
      if (!company || company.error) {
        setError('Nao foi possivel consultar este CNPJ. Verifique o numero e tente novamente.');
        return;
      }
      const analysis = analyzeRegulatoryStatus(company);
      setResult({ company, analysis });
      setTimeout(() => resultRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 300);

      // Save CNPJ + analysis to sales_leads
      try {
        const leadUpdate = {
          cnpj: cleanCNPJ,
          razao_social: company.razao_social || company.nome || null,
          recommendation: analysis.recommendation,
          status: analysis.requires_consultant ? 'aguardando_consultor' : 'analyzed'
        };
        await supabase.from('sales_leads').update(leadUpdate).eq('user_id', session.user_id);
      } catch (err) {
        console.error('[LeadDash] Erro ao atualizar lead:', err);
      }
    } catch (err) {
      console.error('[LeadDash] Erro na analise:', err);
      setError('Falha ao consultar dados da empresa. Tente novamente em alguns instantes.');
    } finally {
      setLoading(false);
    }
  }, [cnpj, session?.user_id]);

  const offerCatalog = result && prices
    ? buildAvailableOffers({ companyData: result.company, pricing: prices, employeeCount: parsedEmployeeCount })
    : { offers: [], recommendedOfferId: null };

  const selectedOffer = offerCatalog.offers.find((offer) => offer.id === selectedOfferId)
    || offerCatalog.offers.find((offer) => offer.recommended)
    || offerCatalog.offers[0]
    || null;

  const documentOffer = selectedOffer && result && prices
    ? buildDocumentOfferPayload({
        offerId: selectedOffer.id,
        companyData: result.company,
        pricing: prices,
        source: 'lead_dashboard',
        employeeCount: parsedEmployeeCount,
      })
    : null;

  const getAnchorPrice = () => {
    if (!selectedOffer || !result) return null;
    if (selectedOffer.id === 'DIR') return 1990;
    if (selectedOffer.id === 'PGR_PCMSO' || selectedOffer.id === 'PGR' || selectedOffer.id === 'PCMSO') return 5990;
    return null;
  };

  const price = Number(documentOffer?.price || 0) || null;
  const docLabel = documentOffer?.label || '';
  const anchorPrice = getAnchorPrice();
  const isCtaEnabled = !!documentOffer && (selectedOffer?.id === 'DIR' || !!parsedEmployeeCount);
  const interestRate = Number(cardSimulation?.monthly_interest_rate || 0);
  const installmentValue = Number(cardSimulation?.installment_value || 0) || null;
  const hasInterest = interestRate > 0 && installmentCount > 1;
  const requiresConsultantDecision = result?.analysis?.requires_consultant === true;
  const creditCardEnabled = true;
  const installmentHeadline = installmentCount === MAX_CREDIT_CARD_INSTALLMENTS
    ? `em ate ${installmentCount}x de ${formatCurrency(installmentValue)}`
    : `${installmentCount}x de ${formatCurrency(installmentValue)}`;
  const selectedCheckoutValue = billingType === 'CREDIT_CARD'
    ? Number(cardSimulation?.total_value || price || 0)
    : Number(price || 0);

  const handleStartCheckout = async () => {
    setCheckoutStep('form');
    // Update lead status
    try {
      await supabase.from('sales_leads').update({
        status: 'checkout_started',
        document_offer: documentOffer,
      }).eq('user_id', session.user_id);
    } catch (err) {
      console.error('[LeadDash] Erro ao atualizar status:', err);
    }
  };

  const handleNavigateToApp = () => {
    window.location.href = `${SST_APP_URL}/cliente`;
  };

  const handleSubmitPayment = async () => {
    setCheckoutLoading(true);
    setCheckoutError(null);
    try {
      const contactName = leadData?.name || session.name || '';
      const contactEmail = leadData?.email || session.email || '';
      const contactCpf = leadData?.cpf || session.cpf || '';
      const contactPhone = leadData?.phone || session.phone || '';
      const partnerRef = leadData?.partner_ref || session.partner_ref || undefined;
      const normalizedContactCpf = cleanDigits(contactCpf);
      const normalizedContactPhone = cleanDigits(contactPhone);

      if (!contactName || normalizedContactCpf.length !== 11) {
        setCheckoutError('Dados de contato incompletos. Faca logout e login novamente.');
        return;
      }

      const res = await supabase.functions.invoke('asaas-checkout', {
        body: {
          cnpj: cleanDigits(result.company.cnpj) || cleanDigits(cnpj),
          razao_social: result.company.razao_social || result.company.nome,
          recommendation: result.analysis.recommendation,
          doc_label: docLabel,
          document_offer: documentOffer,
          price,
          billing_type: billingType,
          installment_count: billingType === 'CREDIT_CARD' && installmentCount > 1 ? installmentCount : undefined,
          contact_name: contactName,
          contact_email: contactEmail,
          contact_cpf: normalizedContactCpf,
          contact_phone: normalizedContactPhone || undefined,
          partner_ref: partnerRef,
          employee_count: parsedEmployeeCount || undefined,
        },
      });

      const errorMessage = await extractFunctionError(res, 'Erro ao processar pagamento.');
      if (errorMessage) {
        setCheckoutError(errorMessage);
        return;
      }

      const data = res.data;
      if (!data?.success) {
        setCheckoutError(data?.error || 'Erro ao criar pagamento.');
        return;
      }

      setPaymentResult(data);
      setCheckoutStep('payment');
    } catch (err) {
      console.error('[LeadDash] Erro no checkout:', err);
      setCheckoutError('Erro de conexao. Tente novamente.');
    } finally {
      setCheckoutLoading(false);
    }
  };

  const handleCopyPix = () => {
    if (paymentResult?.pix_payload) {
      navigator.clipboard.writeText(paymentResult.pix_payload).then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 3000);
      }).catch((err) => {
        console.error('[LeadDash] Erro ao copiar codigo Pix:', err);
      });
    }
  };

  // ─── Payment Result View ───
  if (checkoutStep === 'payment' && paymentResult) {
    return (
      <div style={s.page}>
        <header style={s.header}>
          <div style={s.headerInner}>
            <img src="/am-logo-branca.png" alt="AM Engenharia" style={{ height: '44px', width: 'auto' }} />
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
              <span style={{ color: '#9ca3af', fontSize: '0.85rem' }}>{session.name}</span>
              <button onClick={onLogout} style={s.logoutBtn}><LogOutIcon /></button>
            </div>
          </div>
        </header>
        <main style={s.main}>
          <div style={{ ...s.card, maxWidth: '500px', margin: '0 auto' }}>

            {/* ── Payment Confirmed ── */}
            {paymentConfirmed ? (
              <>
                <div style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
                  <svg width="56" height="56" viewBox="0 0 24 24" fill="none" stroke="#22c55e" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
                </div>
                <h2 style={{ color: '#22c55e', margin: '0 0 0.5rem 0', textAlign: 'center', fontSize: '1.4rem' }}>
                  Pagamento confirmado!
                </h2>
                <p style={{ color: '#9ca3af', margin: '0 0 2rem 0', textAlign: 'center', fontSize: '0.95rem', lineHeight: 1.6 }}>
                  Sua conta foi promovida para cliente. Acesse o sistema principal para preencher os dados da sua empresa e acompanhar a elaboracao dos documentos.
                </p>

                <div style={{
                  background: 'rgba(34, 197, 94, 0.06)', border: '1px solid rgba(34, 197, 94, 0.2)',
                  borderRadius: '12px', padding: '1.25rem', marginBottom: '1.5rem'
                }}>
                  <h3 style={{ color: '#86efac', margin: '0 0 0.75rem 0', fontSize: '0.95rem', fontWeight: 700 }}>
                    Proximos passos
                  </h3>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    {[
                      'Clique no botao abaixo para acessar o sistema principal',
                      'Faca login com o mesmo e-mail e senha que voce cadastrou',
                      'Preencha os dados da sua empresa para elaboracao dos documentos',
                      'Acompanhe o progresso pelo painel do cliente'
                    ].map((step, i) => (
                      <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: '0.5rem' }}>
                        <span style={{ color: '#22c55e', fontWeight: 700, fontSize: '0.85rem', minWidth: '20px' }}>{i + 1}.</span>
                        <span style={{ color: '#d1d5db', fontSize: '0.88rem', lineHeight: 1.4 }}>{step}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div style={{ background: '#111', border: '1px solid #333', borderRadius: '8px', padding: '1rem', fontSize: '0.85rem', marginBottom: '1.5rem' }}>
                  <p style={{ color: '#6b7280', margin: 0, fontSize: '0.8rem' }}>
                    Valor pago: <strong style={{ color: '#d4af37' }}>{formatCurrency(paymentResult.charged_value || paymentResult.value || price || 0)}</strong>
                  </p>
                </div>

                <button
                  onClick={handleNavigateToApp}
                  style={{
                    width: '100%', padding: '14px', background: '#d4af37', color: '#0a0a0a',
                    border: 'none', borderRadius: '10px', fontSize: '1rem', fontWeight: 700,
                    cursor: 'pointer', letterSpacing: '0.02em'
                  }}
                >
                  Acessar area do cliente
                </button>
              </>
            ) : (
              /* ── Payment Pending ── */
              <>
                <div style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
                  <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#22c55e" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
                </div>
                <h2 style={{ color: '#f0f0f0', margin: '0 0 0.5rem 0', textAlign: 'center' }}>Pagamento criado</h2>
                <p style={{ color: '#9ca3af', margin: '0 0 2rem 0', textAlign: 'center', fontSize: '0.95rem' }}>
                  {billingType === 'PIX'
                    ? 'Use o QR Code ou copie o codigo Pix para realizar o pagamento.'
                    : billingType === 'CREDIT_CARD'
                      ? 'Acesse o ambiente seguro do Asaas para informar os dados do cartao e concluir o pagamento.'
                      : 'Acesse o link abaixo para concluir o pagamento.'}
                </p>

                {billingType === 'PIX' && paymentResult.pix_qrcode && (
                  <div style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
                    <img
                      src={`data:image/png;base64,${paymentResult.pix_qrcode}`}
                      alt="QR Code Pix"
                      style={{ width: '220px', height: '220px', borderRadius: '12px', background: '#fff', padding: '12px' }}
                    />
                  </div>
                )}

                {billingType === 'PIX' && paymentResult.pix_payload && (
                  <div style={{ marginBottom: '1.5rem' }}>
                    <div style={{
                      background: '#111', border: '1px solid #333', borderRadius: '8px',
                      padding: '1rem', fontSize: '0.8rem', color: '#9ca3af',
                      wordBreak: 'break-all', marginBottom: '0.75rem'
                    }}>
                      {paymentResult.pix_payload}
                    </div>
                    <button onClick={handleCopyPix} style={{ ...s.primaryBtn, width: '100%' }}>
                      {copied ? 'Copiado' : 'Copiar codigo Pix'}
                    </button>
                  </div>
                )}

                {paymentResult.invoice_url && (
                  <a
                    href={paymentResult.invoice_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{ ...s.primaryBtn, display: 'block', textAlign: 'center', textDecoration: 'none', marginBottom: '1rem' }}
                  >
                    {billingType === 'CREDIT_CARD' ? 'Pagar com cartao no Asaas' : 'Acessar fatura'}
                  </a>
                )}

                <div style={{ background: '#111', border: '1px solid #333', borderRadius: '8px', padding: '1rem', fontSize: '0.85rem' }}>
                  <p style={{ color: '#9ca3af', margin: '0 0 0.5rem 0' }}>
                    Apos a confirmacao do pagamento, seus documentos serao elaborados e voce recebera acesso completo ao sistema.
                  </p>
                  <p style={{ color: '#6b7280', margin: 0, fontSize: '0.8rem' }}>
                    Valor: <strong style={{ color: '#d4af37' }}>{formatCurrency(paymentResult.charged_value || paymentResult.value || price || 0)}</strong>
                  </p>
                </div>

                {/* Polling indicator */}
                <div style={{ textAlign: 'center', marginTop: '1rem' }}>
                  <p style={{ color: '#6b7280', fontSize: '0.75rem', margin: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}>
                    <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#eab308', display: 'inline-block', animation: 'pulse 2s infinite' }} />
                    Aguardando confirmacao do pagamento...
                  </p>
                </div>
              </>
            )}
          </div>
        </main>
      </div>
    );
  }

  // ─── Checkout: Detailed Deliverables + Payment ───
  if (checkoutStep === 'form') {
    const selectedDocuments = documentOffer?.documents || [];
    const grauRisco = result?.company?.grau_risco || result?.analysis?.grau_risco || 2;
    const cnaeDesc = result?.company?.cnae_desc || 'atividade economica';
    const cnaeCode = result?.company?.cnae || '';
    const porte = result?.company?.porte || '';
    const isHighRisk = grauRisco >= 3;
    const faixaMulta = isHighRisk
      ? 'R$ 25.000 a R$ 50.000'
      : 'R$ 15.000 a R$ 30.000';

    // Inferir riscos provaveis pela atividade CNAE
    const inferRisksByActivity = (desc) => {
      const d = (desc || '').toLowerCase();
      const risks = [];
      if (/construc|obra|edificac|demolic|infra/.test(d)) {
        risks.push('Queda de altura', 'Soterramento', 'Ruido ocupacional', 'Exposicao a poeiras');
      } else if (/aliment|restaur|lanchon|padari|acougue|frigor/.test(d)) {
        risks.push('Risco biologico', 'Cortes e queimaduras', 'Postura inadequada', 'Exposicao a calor');
      } else if (/saude|hospital|clinic|medic|odont|farmac|laborat/.test(d)) {
        risks.push('Risco biologico (NR-32)', 'Perfurocortantes', 'Agentes quimicos', 'Estresse ocupacional');
      } else if (/comerci|varej|lojas|mercad|atacad/.test(d)) {
        risks.push('Postura prolongada', 'Movimentacao de carga', 'Estresse psicossocial', 'Risco ergonomico');
      } else if (/transpo|logist|motoris|caminhao|entreg/.test(d)) {
        risks.push('Vibracoes de corpo inteiro', 'Postura prolongada', 'Fadiga', 'Risco de acidente de transito');
      } else if (/metal|mecanic|sold|usinag|fabric|industr/.test(d)) {
        risks.push('Ruido ocupacional', 'Vibracoes', 'Exposicao a fumos metalicos', 'Risco de prensamento');
      } else if (/eletric|telecom|energ/.test(d)) {
        risks.push('Choque eletrico (NR-10)', 'Trabalho em altura', 'Campos eletromagneticos', 'Risco de arco eletrico');
      } else if (/inform|software|tecnolog|consult|escrit|admin|contab/.test(d)) {
        risks.push('Risco ergonomico (NR-17)', 'LER/DORT', 'Fadiga visual', 'Risco psicossocial');
      } else if (/beleza|cabel|estet|manicur/.test(d)) {
        risks.push('Agentes quimicos', 'Postura inadequada', 'Risco biologico', 'Dermatose ocupacional');
      } else if (/educa|escola|creche|ensino/.test(d)) {
        risks.push('Risco ergonomico', 'Estresse ocupacional', 'Disfonia vocal', 'Risco psicossocial');
      } else {
        risks.push('Riscos ergonomicos', 'Riscos psicossociais', 'Riscos de acidentes', 'Riscos ambientais');
      }
      return risks;
    };

    const inferredRisks = inferRisksByActivity(cnaeDesc);

    return (
      <div style={s.page}>
        <header style={s.header}>
          <div style={s.headerInner}>
            <img src="/am-logo-branca.png" alt="AM Engenharia" style={{ height: '44px', width: 'auto' }} />
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
              <span style={{ color: '#9ca3af', fontSize: '0.85rem' }}>{session.name}</span>
              <button onClick={onLogout} style={s.logoutBtn}><LogOutIcon /></button>
            </div>
          </div>
        </header>
        <main style={s.main}>
          <div style={{ maxWidth: '640px', margin: '0 auto' }}>
            <button onClick={() => setCheckoutStep(null)} style={s.backBtn}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
              Voltar a analise
            </button>

            {/* Company summary */}
            <div style={{ ...s.card, marginTop: '1rem', marginBottom: '1.5rem', padding: '1.25rem 1.5rem' }}>
              <p style={{ color: '#9ca3af', margin: '0 0 0.15rem 0', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Empresa</p>
              <p style={{ color: '#f0f0f0', margin: '0 0 0.25rem 0', fontSize: '1.1rem', fontWeight: 700 }}>
                {result.company.name}
              </p>
              <p style={{ color: '#6b7280', margin: 0, fontSize: '0.85rem', fontFamily: 'monospace' }}>
                {maskCNPJ(result.company.cnpj || '')} - {result.analysis.title}
              </p>
            </div>

            {/* What you receive */}
            <h2 style={{ color: '#f0f0f0', fontSize: '1.35rem', fontWeight: 800, margin: '0 0 0.5rem 0' }}>
              O que sera produzido para sua empresa
            </h2>
            <p style={{ color: '#9ca3af', fontSize: '0.9rem', margin: '0 0 1.5rem 0', lineHeight: 1.5 }}>
              Com base na atividade <span style={{ color: '#e2e8f0', fontWeight: 600 }}>{cnaeDesc}</span>{cnaeCode ? ` (CNAE ${cnaeCode})` : ''} e 
              Grau de Risco <span style={{ color: isHighRisk ? '#f87171' : '#facc15', fontWeight: 700 }}>{grauRisco}</span>, 
              identificamos os seguintes pontos criticos para sua documentacao.
            </p>

            {/* Riscos provaveis */}
            <div style={{
              ...s.card, marginBottom: '1rem', padding: '1.25rem 1.5rem',
              borderLeft: '3px solid #ef4444'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem' }}>
                <AlertTriangleIcon />
                <h3 style={{ color: '#f87171', margin: 0, fontSize: '0.9rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  Riscos provaveis da sua atividade
                </h3>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
                {inferredRisks.map((risk, ri) => (
                  <div key={ri} style={{
                    display: 'flex', alignItems: 'center', gap: '6px',
                    padding: '0.5rem 0.65rem', borderRadius: '8px',
                    background: 'rgba(239, 68, 68, 0.08)', border: '1px solid rgba(239, 68, 68, 0.15)'
                  }}>
                    <span style={{ color: '#ef4444', fontSize: '0.7rem' }}>●</span>
                    <span style={{ color: '#fca5a5', fontSize: '0.8rem', lineHeight: 1.3 }}>{risk}</span>
                  </div>
                ))}
              </div>
              <p style={{ color: '#6b7280', margin: '0.75rem 0 0 0', fontSize: '0.72rem', fontStyle: 'italic' }}>
                * Riscos preliminares baseados no CNAE. O inventario definitivo sera elaborado apos aprovacao dos setores e cargos.
              </p>
            </div>

            {/* Multa */}
            <div style={{
              ...s.card, marginBottom: '1.25rem', padding: '1rem 1.25rem',
              background: 'linear-gradient(135deg, rgba(234, 179, 8, 0.06) 0%, rgba(239, 68, 68, 0.06) 100%)',
              border: '1px solid rgba(234, 179, 8, 0.2)'
            }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem' }}>
                <div style={{
                  minWidth: '36px', height: '36px', borderRadius: '50%',
                  background: 'rgba(234, 179, 8, 0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center'
                }}>
                  <span style={{ fontSize: '1.1rem' }}>⚠</span>
                </div>
                <div>
                  <p style={{ color: '#fbbf24', margin: '0 0 0.25rem 0', fontSize: '0.82rem', fontWeight: 700, textTransform: 'uppercase' }}>
                    Risco de multa para sua empresa
                  </p>
                  <p style={{ color: '#d1d5db', margin: 0, fontSize: '0.82rem', lineHeight: 1.5 }}>
                    Empresas com atividade de <strong style={{ color: '#f0f0f0' }}>{cnaeDesc.toLowerCase()}</strong> sem PGR
                    {selectedDocuments.includes('PCMSO') ? ' e PCMSO' : ''} atualizados estao sujeitas a multas de{' '}
                    <strong style={{ color: '#fbbf24' }}>{faixaMulta}</strong> por infracao, alem de interdicao e processos trabalhistas.
                  </p>
                </div>
              </div>
            </div>

            {/* PGR Card */}
            {selectedDocuments.includes('PGR') && (
              <div style={{
                ...s.card, marginBottom: '1rem', padding: 0, overflow: 'hidden',
                border: '1px solid rgba(34, 197, 94, 0.2)'
              }}>
                <div style={{
                  padding: '0.75rem 1.25rem',
                  background: 'linear-gradient(90deg, rgba(34, 197, 94, 0.1) 0%, transparent 100%)',
                  borderBottom: '1px solid rgba(34, 197, 94, 0.1)',
                  display: 'flex', alignItems: 'center', gap: '0.5rem'
                }}>
                  <ShieldIcon />
                  <h3 style={{ color: '#4ade80', margin: 0, fontSize: '1rem', fontWeight: 700 }}>PGR - Programa de Gerenciamento de Riscos</h3>
                </div>
                <div style={{ padding: '1.25rem' }}>
                  <p style={{ color: '#94a3b8', margin: '0 0 1rem 0', fontSize: '0.82rem', lineHeight: 1.5 }}>
                    Documento obrigatorio conforme NR-01 para empresas com atividade de <strong style={{ color: '#d1d5db' }}>{cnaeDesc.toLowerCase()}</strong>.
                    O PGR mapeara todos os riscos identificados e estabelecera medidas de controle proporcionais ao Grau de Risco {grauRisco} da sua empresa.
                  </p>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {[
                      `Inventario de riscos ocupacionais e psicossociais alinhado ao CNAE ${cnaeCode || 'da empresa'}`,
                      'Plano de acao com medidas de prevencao priorizadas',
                      `Matriz de risco calibrada para Grau ${grauRisco}`,
                      'Assinado por Engenheiro de Seguranca do Trabalho (CREA)'
                    ].map((item, ii) => (
                      <div key={ii} style={{ display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
                        <CheckCircleIcon />
                        <span style={{ color: '#d1d5db', fontSize: '0.85rem', lineHeight: 1.4 }}>{item}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* DIR Card */}
            {selectedDocuments.includes('DIR') && !selectedDocuments.includes('PGR') && (
              <div style={{
                ...s.card, marginBottom: '1rem', padding: 0, overflow: 'hidden',
                border: '1px solid rgba(34, 197, 94, 0.2)'
              }}>
                <div style={{
                  padding: '0.75rem 1.25rem',
                  background: 'linear-gradient(90deg, rgba(34, 197, 94, 0.1) 0%, transparent 100%)',
                  borderBottom: '1px solid rgba(34, 197, 94, 0.1)',
                  display: 'flex', alignItems: 'center', gap: '0.5rem'
                }}>
                  <ShieldIcon />
                  <h3 style={{ color: '#4ade80', margin: 0, fontSize: '1rem', fontWeight: 700 }}>DIR - Declaracao de Inexistencia de Riscos</h3>
                </div>
                <div style={{ padding: '1.25rem' }}>
                  <p style={{ color: '#94a3b8', margin: '0 0 1rem 0', fontSize: '0.82rem', lineHeight: 1.5 }}>
                    MEI dispensado de PGR conforme NR-01.8.4. A DIR substitui o PGR com total validade legal.
                  </p>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {[
                      'Declaracao formal de inexistencia de riscos',
                      'Valida para MEI sem exposicao a agentes nocivos',
                      'Substitui o PGR com total validade legal',
                      'Assinada por Engenheiro de Seguranca do Trabalho'
                    ].map((item, ii) => (
                      <div key={ii} style={{ display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
                        <CheckCircleIcon />
                        <span style={{ color: '#d1d5db', fontSize: '0.85rem', lineHeight: 1.4 }}>{item}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* PCMSO Card */}
            {selectedDocuments.includes('PCMSO') && (
              <div style={{
                ...s.card, marginBottom: '1rem', padding: 0, overflow: 'hidden',
                border: '1px solid rgba(59, 130, 246, 0.2)'
              }}>
                <div style={{
                  padding: '0.75rem 1.25rem',
                  background: 'linear-gradient(90deg, rgba(59, 130, 246, 0.1) 0%, transparent 100%)',
                  borderBottom: '1px solid rgba(59, 130, 246, 0.1)',
                  display: 'flex', alignItems: 'center', gap: '0.5rem'
                }}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#60a5fa" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></svg>
                  <h3 style={{ color: '#60a5fa', margin: 0, fontSize: '1rem', fontWeight: 700 }}>PCMSO - Controle Medico de Saude Ocupacional</h3>
                </div>
                <div style={{ padding: '1.25rem' }}>
                  <p style={{ color: '#94a3b8', margin: '0 0 1rem 0', fontSize: '0.82rem', lineHeight: 1.5 }}>
                    Para a atividade de <strong style={{ color: '#d1d5db' }}>{cnaeDesc.toLowerCase()}</strong>, o PCMSO definira 
                    os exames medicos obrigatorios com base nos riscos mapeados no PGR, atendendo integralmente a NR-07.
                  </p>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {[
                      'Exames ocupacionais definidos conforme riscos do CNAE',
                      'Cronograma admissional, periodico, retorno e demissional',
                      'Relatorio analitico e indicadores de saude ocupacional',
                      'Assinado por Medico do Trabalho (CRM)'
                    ].map((item, ii) => (
                      <div key={ii} style={{ display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
                        <CheckCircleIcon />
                        <span style={{ color: '#d1d5db', fontSize: '0.85rem', lineHeight: 1.4 }}>{item}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Price + Payment */}
            <div style={{
              ...s.card, marginTop: '0.5rem', marginBottom: '1rem',
              background: 'linear-gradient(160deg, #1a1a2e 0%, #0f1923 50%, #1a1a2e 100%)',
              border: '1px solid rgba(212, 175, 55, 0.2)',
              padding: '2rem 1.5rem', textAlign: 'center'
            }}>
              {/* Anchor price */}
              {anchorPrice && (
                <p style={{ color: '#6b7280', fontSize: '1rem', margin: '0 0 0.25rem 0' }}>
                  de{' '}
                  <span style={{ textDecoration: 'line-through', color: '#ef4444', fontSize: '1.15rem' }}>
                    {formatCurrency(anchorPrice)}
                  </span>
                </p>
              )}

              {price != null && (
                <p style={{ color: '#9ca3af', fontSize: '0.95rem', margin: '0 0 0.75rem 0' }}>
                  por apenas <span style={{ color: '#f0f0f0', fontWeight: 700 }}>{formatCurrency(price)}</span> a vista ou
                </p>
              )}
              {selectedOffer?.priceBreakdown && (
                <p style={{ color: '#6b7280', fontSize: '0.72rem', margin: '-0.25rem 0 0.5rem 0' }}>
                  Calculado para {selectedOffer.priceBreakdown.employeeCount} {selectedOffer.priceBreakdown.employeeCount === 1 ? 'colaborador' : 'colaboradores'}
                </p>
              )}

              {/* Installment price */}
              {installmentValue != null ? (
                <div style={{ margin: '0 0 0.5rem 0' }}>
                  <span style={{ color: '#d4af37', fontSize: '2.2rem', fontWeight: 900, lineHeight: 1 }}>
                    {installmentHeadline}
                  </span>
                </div>
              ) : (
                <span style={{ color: '#d4af37', fontSize: '2rem', fontWeight: 800 }}>Consulte</span>
              )}

              {/* Doc label */}
              <div style={{
                marginTop: '1.25rem', padding: '0.6rem 1rem', borderRadius: '8px',
                background: 'rgba(212, 175, 55, 0.06)', border: '1px solid rgba(212, 175, 55, 0.12)',
                display: 'inline-block'
              }}>
                <p style={{ color: '#d4af37', margin: 0, fontSize: '0.8rem', fontWeight: 600 }}>
                  {docLabel}
                </p>
                <p style={{ color: '#6b7280', margin: '2px 0 0 0', fontSize: '0.72rem' }}>
                  Oferta contratada conforme avaliacao de risco
                </p>
              </div>

              {/* Payment method */}
              <div style={{ borderTop: '1px solid rgba(255,255,255,0.06)', marginTop: '1.5rem', paddingTop: '1.25rem', textAlign: 'left' }}>
                <h3 style={{ color: '#f0f0f0', margin: '0 0 0.75rem 0', fontSize: '0.95rem', fontWeight: 700 }}>
                  Escolha como pagar
                </h3>
                <div style={{ display: 'flex', gap: '0.6rem', marginBottom: '1.25rem' }}>
                  {[
                    { type: 'PIX', label: 'Pix', sub: 'Aprovacao imediata', disabled: false },
                    { type: 'BOLETO', label: 'Boleto', sub: 'Ate 3 dias uteis', disabled: false },
                    { type: 'CREDIT_CARD', label: 'Cartao', sub: hasInterest ? `${formatPercentWithDecimals(interestRate)} a.m.` : 'Parcelamento disponivel', disabled: !creditCardEnabled }
                  ].map(({ type, label, sub, disabled }) => (
                    <button
                      key={type}
                      onClick={() => !disabled && setBillingType(type)}
                      disabled={disabled}
                      style={{
                        flex: 1, padding: '0.7rem 0.5rem', borderRadius: '10px',
                        border: `1.5px solid ${billingType === type ? '#d4af37' : '#333'}`,
                        background: disabled ? '#161616' : (billingType === type ? 'rgba(212, 175, 55, 0.1)' : '#111'),
                        color: disabled ? '#4b5563' : (billingType === type ? '#d4af37' : '#9ca3af'),
                        cursor: disabled ? 'not-allowed' : 'pointer',
                        transition: 'all 0.2s',
                        textAlign: 'center',
                        opacity: disabled ? 0.55 : 1
                      }}
                    >
                      <span style={{ display: 'block', fontWeight: 700, fontSize: '0.88rem' }}>{label}</span>
                      <span style={{ display: 'block', fontSize: '0.68rem', marginTop: '2px', opacity: 0.7 }}>{sub}</span>
                    </button>
                  ))}
                </div>

                {billingType === 'CREDIT_CARD' && (
                  <div style={{ marginBottom: '1rem' }}>
                    <label style={{ color: '#9ca3af', display: 'block', fontSize: '0.8rem', marginBottom: '0.5rem' }}>
                      Parcelamento no cartao
                    </label>
                    <select
                      value={installmentCount}
                      onChange={(event) => setInstallmentCount(Number(event.target.value))}
                      style={{
                        width: '100%',
                        background: '#111',
                        color: '#f0f0f0',
                        border: '1px solid #333',
                        borderRadius: '10px',
                        padding: '0.85rem 1rem',
                        fontSize: '0.95rem'
                      }}
                    >
                      {Array.from({ length: MAX_CREDIT_CARD_INSTALLMENTS }, (_, index) => index + 1).map((count) => (
                        <option key={count} value={count}>
                          {count}x
                        </option>
                      ))}
                    </select>
                    <p style={{ color: '#6b7280', margin: '0.65rem 0 0 0', fontSize: '0.78rem' }}>
                      {cardSimulationLoading
                        ? 'Atualizando parcelamento...'
                        : `${installmentCount}x de ${formatCurrency(installmentValue || selectedCheckoutValue)}`}
                    </p>
                  </div>
                )}

                {checkoutError && (
                  <p style={{ color: '#ef4444', margin: '0 0 1rem 0', fontSize: '0.9rem' }}>{checkoutError}</p>
                )}

                <button
                  onClick={handleSubmitPayment}
                  disabled={checkoutLoading || (billingType === 'CREDIT_CARD' && cardSimulationLoading)}
                  style={{
                    width: '100%', padding: '1.1rem', borderRadius: '12px', border: 'none',
                    background: (checkoutLoading || (billingType === 'CREDIT_CARD' && cardSimulationLoading)) ? '#555' : 'linear-gradient(135deg, #d4af37 0%, #c5a028 100%)',
                    color: (checkoutLoading || (billingType === 'CREDIT_CARD' && cardSimulationLoading)) ? '#999' : '#121212',
                    fontWeight: 800, fontSize: '1.05rem',
                    cursor: (checkoutLoading || (billingType === 'CREDIT_CARD' && cardSimulationLoading)) ? 'default' : 'pointer',
                    transition: 'all 0.2s', textTransform: 'uppercase', letterSpacing: '0.5px',
                    boxShadow: (checkoutLoading || (billingType === 'CREDIT_CARD' && cardSimulationLoading)) ? 'none' : '0 4px 20px rgba(212, 175, 55, 0.3)'
                  }}
                >
                  {checkoutLoading ? 'Processando...' : 'Confirmar e Contratar'}
                </button>
                <p style={{ color: '#6b7280', margin: '0.75rem 0 0 0', fontSize: '0.78rem', textAlign: 'center' }}>
                  Pagamento seguro processado via Asaas. Documentos elaborados apos confirmacao.
                </p>
              </div>
            </div>
          </div>
        </main>
      </div>
    );
  }

  // ─── Main View: CNPJ Analysis ───
  return (
    <div style={s.page}>
      <header style={s.header}>
        <div style={s.headerInner}>
          <img src="/am-logo-branca.png" alt="AM Engenharia" style={{ height: '44px', width: 'auto' }} />
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <span style={{ color: '#9ca3af', fontSize: '0.85rem' }}>{session.name}</span>
            <button onClick={onLogout} style={s.logoutBtn}><LogOutIcon /></button>
          </div>
        </div>
      </header>
      <main style={s.main}>
        <div style={{ maxWidth: '640px', margin: '0 auto' }}>
          {/* Welcome */}
          <div style={{ marginBottom: '2rem' }}>
            <h1 style={{ color: '#f0f0f0', fontSize: '1.75rem', fontWeight: 700, margin: '0 0 0.75rem 0' }}>
              Bem-vindo(a) a AM Engenharia, {session.name?.split(' ')[0]}!
            </h1>
            <p style={{ color: '#9ca3af', margin: '0 0 1rem 0', fontSize: '1rem', lineHeight: 1.7 }}>
              Estamos aqui para garantir que sua empresa esteja em conformidade com as normas de seguranca do trabalho.
            </p>
            <div style={{
              background: 'linear-gradient(135deg, rgba(212,175,55,0.08) 0%, rgba(212,175,55,0.03) 100%)',
              border: '1px solid rgba(212,175,55,0.2)', borderRadius: '12px', padding: '1.25rem'
            }}>
              <p style={{ color: '#d4af37', margin: '0 0 0.5rem 0', fontSize: '0.95rem', fontWeight: 600 }}>
                Por que precisamos do seu CNPJ?
              </p>
              <p style={{ color: '#9ca3af', margin: 0, fontSize: '0.88rem', lineHeight: 1.65 }}>
                Com o CNPJ, consultamos automaticamente os dados oficiais da Receita Federal para identificar o porte,
                atividades economicas (CNAEs) e grau de risco da sua empresa. Com essas informacoes, determinamos
                exatamente quais documentos de seguranca do trabalho sao obrigatorios para voce - PGR, PCMSO ou DIR -
                de forma gratuita e sem compromisso.
              </p>
            </div>
          </div>

          {/* CNPJ Analysis */}
          <div style={s.card}>
            <h3 style={{ color: '#f0f0f0', margin: '0 0 1.25rem 0', fontSize: '1.15rem', fontWeight: 700 }}>
              Analise regulatoria
            </h3>

            <div style={{ display: 'flex', gap: '0.75rem' }}>
              <input
                type="text"
                placeholder="00.000.000/0000-00"
                value={cnpj}
                onChange={(e) => { setCnpj(maskCNPJ(e.target.value)); setError(null); setResult(null); setCheckoutStep(null); }}
                onKeyDown={(e) => { if (e.key === 'Enter') handleAnalyze(); }}
                style={{
                  flex: 1, padding: '0.9rem 1rem', borderRadius: '10px', border: '1px solid #444',
                  background: '#111', color: '#f0f0f0', fontSize: '1rem', outline: 'none',
                  fontFamily: 'monospace', letterSpacing: '0.5px'
                }}
                disabled={loading}
              />
              <button
                onClick={handleAnalyze}
                disabled={loading || cleanDigits(cnpj).length < 14}
                style={{
                  padding: '0.9rem 1.5rem', borderRadius: '10px', border: 'none',
                  background: loading ? '#555' : '#d4af37', color: loading ? '#999' : '#121212',
                  fontWeight: 700, fontSize: '0.95rem', cursor: loading ? 'default' : 'pointer',
                  display: 'flex', alignItems: 'center', gap: '8px',
                  transition: 'all 0.2s', whiteSpace: 'nowrap'
                }}
              >
                {loading ? 'Analisando...' : <><SearchIcon /> Analisar</>}
              </button>
            </div>

            {error && (
              <p style={{ color: '#ef4444', margin: '1rem 0 0 0', fontSize: '0.9rem' }}>{error}</p>
            )}

            {result && (
              <div ref={resultRef} style={{ marginTop: '1.5rem' }}>
                {/* ── Company Header ── */}
                <div style={{
                  padding: '1.5rem', borderRadius: '14px 14px 0 0',
                  background: 'linear-gradient(135deg, #1a1f2e 0%, #1a1a2e 100%)',
                  borderTop: '3px solid #d4af37', borderLeft: '1px solid #333', borderRight: '1px solid #333'
                }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: '1rem' }}>
                    <div style={{
                      width: '48px', height: '48px', borderRadius: '12px',
                      background: 'rgba(212, 175, 55, 0.15)', display: 'flex',
                      alignItems: 'center', justifyContent: 'center', flexShrink: 0
                    }}>
                      <BuildingIcon />
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <h3 style={{ color: '#f0f0f0', margin: '0 0 0.25rem 0', fontSize: '1.15rem', fontWeight: 700 }}>
                        {result.company.name}
                      </h3>
                      <p style={{ color: '#9ca3af', margin: 0, fontSize: '0.85rem', fontFamily: 'monospace' }}>
                        CNPJ: {maskCNPJ(result.company.cnpj || '')}
                      </p>
                    </div>
                    <div style={{
                      padding: '0.3rem 0.75rem', borderRadius: '20px', fontSize: '0.75rem', fontWeight: 600,
                      background: result.company.situacao?.toLowerCase() === 'ativa'
                        ? 'rgba(34, 197, 94, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                      color: result.company.situacao?.toLowerCase() === 'ativa' ? '#22c55e' : '#ef4444',
                      border: `1px solid ${result.company.situacao?.toLowerCase() === 'ativa' ? 'rgba(34, 197, 94, 0.3)' : 'rgba(239, 68, 68, 0.3)'}`,
                      whiteSpace: 'nowrap', flexShrink: 0
                    }}>
                      {result.company.situacao || 'N/A'}
                    </div>
                  </div>
                </div>

                {/* ── Company Data Grid ── */}
                <div style={{
                  padding: '1.25rem 1.5rem', background: '#141620',
                  borderLeft: '1px solid #333', borderRight: '1px solid #333',
                  display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem'
                }}>
                  <InfoItem label="Porte" value={result.company.porte || 'N/A'} />
                  <InfoItem label="Natureza Juridica" value={result.company.natureza_juridica || 'N/A'} />
                  <InfoItem
                    label="CNAE Principal"
                    value={result.company.cnae ? `${result.company.cnae}` : 'N/A'}
                    sub={result.company.cnae_desc || ''}
                  />
                  <InfoItem
                    label="Grau de Risco (NR-04)"
                    value={`Grau ${result.company.grau_risco || result.analysis.grau_risco}`}
                    badge
                    badgeColor={
                      (result.company.grau_risco || result.analysis.grau_risco) <= 2
                        ? '#22c55e' : '#ef4444'
                    }
                  />

                  {/* Address - full width */}
                  <div style={{ gridColumn: '1 / -1' }}>
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: '6px' }}>
                      <MapPinIcon />
                      <div>
                        <span style={{ color: '#6b7280', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                          Endereco
                        </span>
                        <p style={{ color: '#d1d5db', margin: '2px 0 0 0', fontSize: '0.88rem', lineHeight: 1.4 }}>
                          {result.company.address || 'Nao informado'}
                        </p>
                        {result.company.zip_code && (
                          <span style={{ color: '#6b7280', fontSize: '0.8rem' }}>
                            CEP: {result.company.zip_code}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Contact - prefer user's registered data, fallback to API */}
                  <InfoItem label="Telefone" value={session.phone ? maskPhone(session.phone) : (result.company.phone || 'Nao informado')} />
                  <InfoItem label="E-mail" value={session.email || result.company.email || 'Nao informado'} />
                </div>

                {/* ── CNAEs Secundarios ── */}
                {result.company.cnaes_secundarios?.length > 0 && (
                  <div style={{
                    padding: '1rem 1.5rem', background: '#121420',
                    borderLeft: '1px solid #333', borderRight: '1px solid #333',
                    borderTop: '1px solid #222'
                  }}>
                    <p style={{ color: '#6b7280', fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.5px', margin: '0 0 0.5rem 0' }}>
                      Atividades Secundarias ({result.company.cnaes_secundarios.length})
                    </p>
                    <div style={{
                      maxHeight: '180px', overflowY: 'auto', border: '1px solid #2a2a3e',
                      borderRadius: '8px', padding: '6px',
                      scrollbarWidth: 'thin', scrollbarColor: '#d4af37 #1a1a2e'
                    }}>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                        {result.company.cnaes_secundarios.map((c, i) => (
                          <div key={i} style={{
                            padding: '5px 10px', borderRadius: '6px',
                            background: '#1a1a2e', border: '1px solid #2a2a3e',
                            display: 'flex', alignItems: 'flex-start', gap: '8px'
                          }}>
                            <span style={{
                              color: '#d4af37', fontSize: '0.7rem', fontFamily: 'monospace',
                              fontWeight: 600, flexShrink: 0, minWidth: '80px'
                            }}>
                              {c.code || c.codigo}
                            </span>
                            <span style={{ color: '#b0b0c0', fontSize: '0.72rem', lineHeight: 1.3 }}>
                              {c.descricao || c.text || '-'}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                {/* ── Quadro Societario ── */}
                {result.company.qsa?.length > 0 && (() => {
                  const isAdmin = (s) => /administrador/i.test(s.qual || s.qualificacao || '');
                  const sorted = [...result.company.qsa].sort((a, b) => (isAdmin(b) ? 1 : 0) - (isAdmin(a) ? 1 : 0));
                  return (
                    <div style={{
                      padding: '1rem 1.5rem', background: '#121420',
                      borderLeft: '1px solid #333', borderRight: '1px solid #333',
                      borderTop: '1px solid #222'
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '0.75rem' }}>
                        <UsersIcon />
                        <span style={{ color: '#6b7280', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                          Quadro Societario ({result.company.qsa.length})
                        </span>
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                        {sorted.map((socio, i) => {
                          const admin = isAdmin(socio);
                          return (
                            <div key={i} style={{
                              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                              padding: '8px 12px', borderRadius: '8px',
                              background: admin ? 'rgba(212, 175, 55, 0.08)' : '#1a1a2e',
                              border: admin ? '1px solid rgba(212, 175, 55, 0.25)' : '1px solid #2a2a3e'
                            }}>
                              <span style={{
                                color: admin ? '#e5d9a8' : '#d1d5db', fontSize: '0.88rem',
                                fontWeight: admin ? 700 : 400
                              }}>
                                {socio.nome || socio.name || 'N/A'}
                              </span>
                              <span style={{
                                fontSize: '0.75rem', flexShrink: 0, marginLeft: '1rem',
                                color: admin ? '#d4af37' : '#6b7280',
                                fontWeight: admin ? 600 : 400
                              }}>
                                {socio.qual || socio.qualificacao || ''}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })()}

                {/* ── Regulatory Analysis Result ── */}
                <div style={{
                  padding: '1.5rem', background: requiresConsultantDecision ? '#1c1111' : '#111a11',
                  borderLeft: `1px solid ${requiresConsultantDecision ? '#7f1d1d' : '#14532d'}`,
                  borderRight: `1px solid ${requiresConsultantDecision ? '#7f1d1d' : '#14532d'}`,
                  borderTop: `1px solid ${requiresConsultantDecision ? '#7f1d1d' : '#14532d'}`
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '0.75rem' }}>
                    <ShieldIcon />
                    <h4 style={{
                      color: requiresConsultantDecision ? '#fca5a5' : '#86efac', margin: 0,
                      fontSize: '1.1rem', fontWeight: 700
                    }}>
                      {result.analysis.title}
                    </h4>
                  </div>
                  <p style={{ color: '#d1d5db', margin: '0', fontSize: '0.9rem', lineHeight: '1.5' }}>
                    {result.analysis.description}
                  </p>
                </div>

                {/* ── Urgency / Penalty Warning ── */}
                <div style={{
                  padding: '1.25rem 1.5rem',
                  background: 'linear-gradient(135deg, #1a1412 0%, #1c1510 100%)',
                  borderLeft: '1px solid #78350f', borderRight: '1px solid #78350f',
                  borderTop: '1px solid #92400e'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '0.75rem' }}>
                    <AlertTriangleIcon />
                    <span style={{ color: '#fbbf24', fontSize: '0.85rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                      Atencao: Fiscalizacao a partir de maio/2026
                    </span>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '0.85rem', lineHeight: 1.5, color: '#e5d5b0' }}>
                    <p style={{ margin: 0 }}>
                      A NR-1 atualizada obriga todas as empresas com colaboradores a manter PGR e PCMSO atualizados, incluindo riscos psicossociais. O MTE inicia fiscalizacao rigorosa com cruzamento automatico via eSocial.
                    </p>
                    <div style={{
                      display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginTop: '4px'
                    }}>
                      <div style={{ padding: '10px', borderRadius: '8px', background: 'rgba(239, 68, 68, 0.08)', border: '1px solid rgba(239, 68, 68, 0.2)' }}>
                        <p style={{ color: '#fca5a5', fontWeight: 700, fontSize: '0.8rem', margin: '0 0 2px 0' }}>Multas</p>
                        <p style={{ color: '#d1b8a0', fontSize: '0.78rem', margin: 0 }}>De R$ 15.000 a R$ 30.000 por infracao para pequenas empresas</p>
                      </div>
                      <div style={{ padding: '10px', borderRadius: '8px', background: 'rgba(239, 68, 68, 0.08)', border: '1px solid rgba(239, 68, 68, 0.2)' }}>
                        <p style={{ color: '#fca5a5', fontWeight: 700, fontSize: '0.8rem', margin: '0 0 2px 0' }}>Risco Juridico</p>
                        <p style={{ color: '#d1b8a0', fontSize: '0.78rem', margin: 0 }}>Sem laudos, voce perde qualquer defesa em processos trabalhistas</p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* ── AM as partner message ── */}
                <div style={{
                  padding: '1.25rem 1.5rem',
                  background: 'linear-gradient(135deg, #0f1a14 0%, #101a16 100%)',
                  borderLeft: '1px solid #14532d', borderRight: '1px solid #14532d',
                  borderTop: '1px solid #1a3a28'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '0.5rem' }}>
                    <CheckCircleIcon />
                    <span style={{ color: '#86efac', fontSize: '0.85rem', fontWeight: 700 }}>
                      A AM Engenharia cuida de tudo para voce
                    </span>
                  </div>
                  <p style={{ color: '#a3c4b0', fontSize: '0.85rem', lineHeight: 1.5, margin: 0 }}>
                    Somos seu braco direito na seguranca do trabalho. Elaboramos toda a documentacao obrigatoria com validade legal, assinada por Engenheiro de Seguranca (CREA) e Medico do Trabalho (CRM), com entrega 100% digital para que voce foque no seu negocio com tranquilidade.
                  </p>
                </div>

                {/* ── Employee Count Input ── */}
                {!requiresConsultantDecision && selectedOffer?.id !== 'DIR' && (
                  <div style={{
                    padding: '1.25rem 1.5rem',
                    background: '#111827',
                    borderLeft: '1px solid #14532d', borderRight: '1px solid #14532d',
                    borderTop: '1px solid #1a3a28'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '0.75rem' }}>
                      <UsersIcon />
                      <span style={{ color: '#e2e8f0', fontSize: '0.9rem', fontWeight: 700 }}>
                        Quantos colaboradores sua empresa possui?
                      </span>
                    </div>
                    <p style={{ color: '#9ca3af', fontSize: '0.8rem', margin: '0 0 0.75rem 0', lineHeight: 1.5 }}>
                      O valor do PGR + PCMSO e calculado com base no numero de colaboradores.
                    </p>
                    <input
                      type="number"
                      min="1"
                      step="1"
                      placeholder="Ex: 15"
                      value={employeeCount}
                      onChange={(e) => setEmployeeCount(e.target.value)}
                      style={{
                        width: '100%', padding: '0.85rem 1rem', borderRadius: '10px',
                        border: '1px solid #444', background: '#0a0a0a', color: '#f0f0f0',
                        fontSize: '1.1rem', fontWeight: 600, outline: 'none',
                        boxSizing: 'border-box',
                      }}
                    />
                    {parsedEmployeeCount > 0 && selectedOffer?.priceBreakdown && (
                      <div style={{
                        marginTop: '0.75rem', padding: '0.75rem 1rem', borderRadius: '8px',
                        background: 'rgba(16, 185, 129, 0.08)', border: '1px solid rgba(16, 185, 129, 0.2)',
                      }}>
                        <div style={{ color: '#10b981', fontSize: '1.15rem', fontWeight: 800 }}>
                          {formatCurrency(selectedOffer.priceBreakdown.total)}
                        </div>
                        <div style={{ color: '#6b7280', fontSize: '0.75rem', marginTop: '0.25rem' }}>
                          Base: {selectedOffer.priceBreakdown.limitePlanoMinimo} colaboradores x {formatCurrency(selectedOffer.priceBreakdown.valorBaseCapita)} = {formatCurrency(selectedOffer.priceBreakdown.base)}
                          {selectedOffer.priceBreakdown.excedente > 0 && (
                            <span> + excedente: {parsedEmployeeCount - selectedOffer.priceBreakdown.limitePlanoMinimo} x {formatCurrency(selectedOffer.priceBreakdown.valorExtraCapita)} = {formatCurrency(selectedOffer.priceBreakdown.excedente)}</span>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* ── CTA ── */}
                <div style={{
                  padding: '1.5rem', borderRadius: '0 0 14px 14px',
                  background: requiresConsultantDecision ? '#1c1111' : '#0d1a0f',
                  borderLeft: `1px solid ${requiresConsultantDecision ? '#7f1d1d' : '#14532d'}`,
                  borderRight: `1px solid ${requiresConsultantDecision ? '#7f1d1d' : '#14532d'}`,
                  borderBottom: `1px solid ${requiresConsultantDecision ? '#7f1d1d' : '#14532d'}`
                }}>
                  <div>
                    {requiresConsultantDecision ? (
                      <div style={{ textAlign: 'center' }}>
                        <p style={{ color: '#fca5a5', fontSize: '0.9rem', margin: '0 0 1rem 0', lineHeight: 1.5 }}>
                          Sua empresa possui Grau de Risco {result?.analysis?.grau_risco || '3+'}, o que exige avaliacao de um consultor especializado antes da contratacao.
                        </p>
                        <p style={{ color: '#94a3b8', fontSize: '0.85rem', margin: '0 0 1rem 0' }}>
                          Um consultor da AM Engenharia entrara em contato para definir a melhor abordagem para sua empresa. O valor pode ser diferente do apresentado.
                        </p>
                        <div style={{
                          padding: '0.75rem 1.5rem', borderRadius: '12px',
                          background: '#1e293b', border: '1px solid #334155',
                          color: '#e2e8f0', fontWeight: 700, fontSize: '0.95rem',
                          textAlign: 'center'
                        }}>
                          Aguarde contato do consultor
                        </div>
                      </div>
                    ) : (
                      <button
                        onClick={handleStartCheckout}
                        disabled={!isCtaEnabled}
                        style={{
                          width: '100%', padding: '1.15rem', borderRadius: '12px', border: 'none',
                          background: isCtaEnabled ? 'linear-gradient(135deg, #d4af37 0%, #c5a028 100%)' : '#4b5563',
                          color: '#121212', fontWeight: 800, fontSize: '1.1rem',
                          cursor: isCtaEnabled ? 'pointer' : 'not-allowed', transition: 'all 0.2s', display: 'flex',
                          alignItems: 'center', justifyContent: 'center', gap: '10px',
                          boxShadow: isCtaEnabled ? '0 4px 20px rgba(212, 175, 55, 0.3)' : 'none',
                          textTransform: 'uppercase', letterSpacing: '0.5px'
                        }}
                        onMouseOver={(e) => { if (isCtaEnabled) { e.currentTarget.style.background = 'linear-gradient(135deg, #e9c98a 0%, #d4af37 100%)'; e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 6px 24px rgba(212, 175, 55, 0.4)'; } }}
                        onMouseOut={(e) => { if (isCtaEnabled) { e.currentTarget.style.background = 'linear-gradient(135deg, #d4af37 0%, #c5a028 100%)'; e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = '0 4px 20px rgba(212, 175, 55, 0.3)'; } }}
                      >
                        <ShieldIcon /> Quero Regularizar Minha Empresa
                      </button>
                    )}
                  </div>
                </div>

                {/* ── Source badge ── */}
                <p style={{ color: '#4b5563', fontSize: '0.7rem', textAlign: 'right', margin: '0.5rem 0 0 0' }}>
                  Dados obtidos via {result.company.source || 'ReceitaWS'}
                </p>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
};

// ─── Styles ───
const s = {
  page: {
    minHeight: '100vh',
    background: '#0a0a0a',
    color: '#f0f0f0',
    fontFamily: 'Inter, system-ui, -apple-system, sans-serif',
  },
  header: {
    position: 'fixed', top: 0, left: 0, right: 0, zIndex: 100,
    background: 'rgba(10, 10, 10, 0.85)', backdropFilter: 'blur(12px)',
    borderBottom: '1px solid #222', padding: '0 2rem'
  },
  headerInner: {
    maxWidth: '1100px', margin: '0 auto',
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    height: '64px'
  },
  main: {
    paddingTop: '96px', paddingBottom: '3rem', padding: '96px 1.5rem 3rem 1.5rem'
  },
  card: {
    background: '#1a1a1a', border: '1px solid #333', borderRadius: '16px',
    padding: '2rem', boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
  },
  primaryBtn: {
    padding: '1rem 2rem', borderRadius: '10px', border: 'none',
    background: '#d4af37', color: '#121212', fontWeight: 700,
    fontSize: '1rem', cursor: 'pointer', transition: 'all 0.2s',
  },
  logoutBtn: {
    background: 'none', border: '1px solid #333', borderRadius: '8px',
    color: '#9ca3af', padding: '0.4rem 0.6rem', cursor: 'pointer',
    display: 'flex', alignItems: 'center', transition: 'all 0.2s'
  },
  backBtn: {
    background: 'none', border: 'none', color: '#9ca3af',
    display: 'flex', alignItems: 'center', gap: '6px',
    fontSize: '0.9rem', cursor: 'pointer', padding: 0,
  },
};

export default LeadDashboard;
