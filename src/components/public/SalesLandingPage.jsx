import React, { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '../../utils/supabase.js';
import { loginBackoffice } from '../../utils/authAccess.js';
import { validatePasswordStrength } from '../../utils/passwordPolicy.js';
import { cleanDigits, maskCNPJ, maskCPF, maskPhone } from '../../utils/formatters.js';
import { captureUtmParams } from '../../utils/utmCapture.js';
import PasswordRulesBox from '../ui/PasswordRulesBox.jsx';

// ─── Partner branding fetch ───
const fetchPartnerBranding = async (referralCode) => {
  if (!referralCode) return null;
  try {
    const { data, error } = await supabase.rpc('get_partner_public_branding', { p_referral_code: referralCode });
    if (error || !data) return null;
    return data;
  } catch (e) {
    console.error('[SalesLP] Erro ao carregar branding do parceiro:', e);
    return null;
  }
};

// ─── Countdown hook ───
const useCountdown = (targetDate) => {
  const [remaining, setRemaining] = useState({ days: 0, hours: 0, minutes: 0, seconds: 0 });
  useEffect(() => {
    const target = new Date(targetDate).getTime();
    const tick = () => {
      const diff = Math.max(0, target - Date.now());
      setRemaining({
        days: Math.floor(diff / 86400000),
        hours: Math.floor((diff % 86400000) / 3600000),
        minutes: Math.floor((diff % 3600000) / 60000),
        seconds: Math.floor((diff % 60000) / 1000),
      });
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [targetDate]);
  return remaining;
};

// ─── SVG Icons ───
const ShieldIcon = () => <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#d4af37" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>;
const ClockIcon = () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#fbbf24" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>;
const CheckIcon = () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#22c55e" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>;
const AlertIcon = () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>;

// ─── FAQ Item ───
const FAQItem = ({ question, answer }) => {
  const [open, setOpen] = useState(false);
  return (
    <div style={{ borderBottom: '1px solid #333', paddingBottom: '1rem', marginBottom: '1rem' }}>
      <button onClick={() => setOpen(!open)} style={{ background: 'none', border: 'none', color: '#f0f0f0', fontSize: '1rem', fontWeight: 600, cursor: 'pointer', width: '100%', textAlign: 'left', display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.5rem 0' }}>
        {question}
        <span style={{ color: '#d4af37', fontSize: '1.2rem', transition: 'transform 0.2s', transform: open ? 'rotate(45deg)' : 'rotate(0deg)' }}>+</span>
      </button>
      {open && <p style={{ color: '#9ca3af', margin: '0.5rem 0 0 0', fontSize: '0.9rem', lineHeight: 1.6 }}>{answer}</p>}
    </div>
  );
};

// ─── Input style helper ───
const inputStyle = { width: '100%', padding: '0.85rem 1rem', borderRadius: '10px', border: '1px solid #444', background: '#111', color: '#f0f0f0', fontSize: '0.95rem', outline: 'none', boxSizing: 'border-box' };

// ─── Registration Form ───
const RegistrationForm = ({ partnerRef, onLogin }) => {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [cpf, setCpf] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);

    const cleanedCpf = cleanDigits(cpf);
    const cleanedPhone = cleanDigits(phone);

    if (!name.trim() || !email.trim() || !password) {
      setError('Preencha todos os campos obrigatorios.');
      return;
    }

    const { valid, errors } = validatePasswordStrength(password);
    if (!valid) {
      setError(errors[0]);
      return;
    }

    setLoading(true);
    try {
      const utmParams = captureUtmParams();

      const { data, error: fnError } = await supabase.functions.invoke('register-lead', {
        body: {
          name: name.trim(),
          email: email.trim().toLowerCase(),
          cpf: cleanedCpf || null,
          phone: cleanedPhone || null,
          password,
          partner_ref: partnerRef || null,
          utm_source: utmParams.utm_source || null,
          utm_medium: utmParams.utm_medium || null,
          utm_campaign: utmParams.utm_campaign || null,
        }
      });

      if (fnError) {
        let msg = 'Erro ao criar conta. Tente novamente.';
        try {
          const body = JSON.parse(fnError.context?.body || '{}');
          if (body.error) msg = body.error;
        } catch (_) { /* ignore */ }
        setError(msg);
        setLoading(false);
        return;
      }

      if (data?.error) {
        setError(data.error);
        setLoading(false);
        return;
      }

      // Auto-login after registration
      const loginResult = await loginBackoffice(email.trim().toLowerCase(), password, { expectedRole: 'lead' });
      if (loginResult.success) {
        onLogin(loginResult.session);
      } else {
        setError('Conta criada, mas erro ao fazer login automatico. Tente fazer login manualmente.');
      }
    } catch (err) {
      console.error('[RegistrationForm] Erro:', err);
      setError('Erro inesperado. Tente novamente.');
    }
    setLoading(false);
  };

  return (
    <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
      <input type="text" placeholder="Nome completo *" value={name} onChange={(e) => setName(e.target.value)} style={inputStyle} />
      <input type="email" placeholder="E-mail *" value={email} onChange={(e) => setEmail(e.target.value)} style={inputStyle} />
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
        <input type="text" placeholder="CPF" value={cpf} onChange={(e) => setCpf(maskCPF(e.target.value))} style={inputStyle} />
        <input type="text" placeholder="Telefone" value={phone} onChange={(e) => setPhone(maskPhone(e.target.value))} style={inputStyle} />
      </div>
      <input type="password" placeholder="Minimo 10 caracteres" value={password} onChange={(e) => setPassword(e.target.value)} style={inputStyle} />
      <PasswordRulesBox password={password} />
      {error && <p style={{ color: '#ef4444', margin: 0, fontSize: '0.85rem' }}>{error}</p>}
      <button type="submit" disabled={loading} style={{ ...s.primaryBtn, width: '100%', opacity: loading ? 0.6 : 1, cursor: loading ? 'default' : 'pointer' }}>
        {loading ? 'Criando conta...' : 'Criar conta e analisar CNPJ'}
      </button>
    </form>
  );
};

// ─── DEFAULTS ───
const DEFAULTS = {
  headline: 'Sua empresa em conformidade com a NR-1 em poucos cliques',
  subheadline: 'PGR, PCMSO e DIR com validade legal, assinados por profissionais habilitados, 100% digital.',
  countdown_target: '2026-05-26T00:00:00',
  show_countdown: true,
  show_partner_journey: true,
  show_urgency: true,
  show_technology: true,
  show_video: false,
  video_url: '',
};

// ─── Main Component ───
const SalesLandingPage = ({ onLogin, partnerRefOverride, onNavigateToMainApp }) => {
  const [partnerBranding, setPartnerBranding] = useState(null);
  const [config, setConfig] = useState(DEFAULTS);
  const formRef = useRef(null);

  const partnerRef = partnerRefOverride || null;

  useEffect(() => {
    captureUtmParams();
  }, []);

  useEffect(() => {
    if (partnerRef) {
      fetchPartnerBranding(partnerRef).then((branding) => {
        if (branding) setPartnerBranding(branding);
      });
    }
  }, [partnerRef]);

  useEffect(() => {
    supabase.from('sales_page_config').select('*').limit(1).maybeSingle().then(({ data }) => {
      if (data) setConfig((prev) => ({ ...prev, ...data }));
    });
  }, []);

  const countdown = useCountdown(config.countdown_target || DEFAULTS.countdown_target);
  const showCountdown = config.show_countdown !== false;
  const showPartnerJourney = config.show_partner_journey !== false;
  const showUrgency = config.show_urgency !== false;
  const showTechnology = config.show_technology !== false;
  const showVideo = config.show_video === true && config.video_url;

  const scrollToForm = useCallback(() => {
    formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, []);

  const partnerLogo = partnerBranding?.logo_url || null;
  const partnerName = partnerBranding?.partner_name || null;

  return (
    <div style={s.page}>
      {/* ─── Header ─── */}
      <header style={s.header}>
        <div style={s.headerInner}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <img src="/am-logo-branca.png" alt="AM Engenharia" style={{ height: '40px', width: 'auto' }} />
            {partnerLogo && (
              <>
                <span style={{ color: '#444', fontSize: '1.2rem' }}>+</span>
                <img src={partnerLogo} alt={partnerName || 'Parceiro'} style={{ height: '36px', width: 'auto', maxWidth: '120px', objectFit: 'contain' }} />
              </>
            )}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <button onClick={() => onNavigateToMainApp?.('/cliente')} style={{ background: 'none', border: 'none', color: '#9ca3af', fontSize: '0.85rem', cursor: 'pointer' }}>
              Ja sou cliente
            </button>
            <button onClick={scrollToForm} style={s.headerCTA}>Comecar agora</button>
          </div>
        </div>
      </header>

      {/* ─── Hero ─── */}
      <section style={s.hero}>
        <div style={s.heroInner}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '1rem' }}>
            <ShieldIcon />
            <span style={{ color: '#d4af37', fontSize: '0.85rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '1px' }}>Seguranca do Trabalho Digital</span>
          </div>
          <h1 style={{ color: '#f0f0f0', fontSize: 'clamp(2rem, 5vw, 3.5rem)', fontWeight: 900, lineHeight: 1.1, margin: '0 0 1.5rem 0' }}>
            {config.headline || DEFAULTS.headline}
          </h1>
          <p style={{ color: '#9ca3af', fontSize: 'clamp(1rem, 2vw, 1.25rem)', lineHeight: 1.6, margin: '0 0 2rem 0', maxWidth: '600px' }}>
            {config.subheadline || DEFAULTS.subheadline}
          </p>
          <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
            <button onClick={scrollToForm} style={s.primaryBtn}>Regularizar minha empresa</button>
          </div>
          {partnerName && (
            <p style={{ color: '#6b7280', fontSize: '0.8rem', marginTop: '1.5rem' }}>
              Indicacao: <span style={{ color: '#d4af37' }}>{partnerName}</span>
            </p>
          )}
        </div>
      </section>

      {/* ─── Partner Journey ─── */}
      {showPartnerJourney && (
        <section style={{ ...s.section, background: '#0f0f1a' }}>
          <div style={s.sectionInner}>
            <h2 style={s.sectionTitle}>Como funciona</h2>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1.5rem', marginTop: '2rem' }}>
              {[
                { step: '01', title: 'Crie sua conta', desc: 'Cadastro rapido com e-mail e senha. Sem burocracia.' },
                { step: '02', title: 'Informe o CNPJ', desc: 'Analisamos automaticamente o CNAE, porte e grau de risco da sua empresa.' },
                { step: '03', title: 'Contrate online', desc: 'Escolha o plano ideal e pague com Pix, boleto ou cartao.' },
                { step: '04', title: 'Receba seus documentos', desc: 'PGR, PCMSO ou DIR elaborados e assinados digitalmente.' },
              ].map(({ step, title, desc }) => (
                <div key={step} style={{ padding: '1.5rem', borderRadius: '14px', background: '#1a1a2e', border: '1px solid #2a2a3e' }}>
                  <span style={{ color: '#d4af37', fontSize: '2rem', fontWeight: 900, display: 'block', marginBottom: '0.75rem' }}>{step}</span>
                  <h3 style={{ color: '#f0f0f0', fontSize: '1.1rem', fontWeight: 700, margin: '0 0 0.5rem 0' }}>{title}</h3>
                  <p style={{ color: '#9ca3af', fontSize: '0.9rem', margin: 0, lineHeight: 1.5 }}>{desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ─── Urgency / Countdown ─── */}
      {showUrgency && (
        <section style={{ ...s.section, background: 'linear-gradient(180deg, #1a0a0a 0%, #0a0a0a 100%)' }}>
          <div style={s.sectionInner}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', justifyContent: 'center', marginBottom: '1rem' }}>
              <AlertIcon />
              <span style={{ color: '#ef4444', fontSize: '0.85rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '1px' }}>Atencao: prazo se aproxima</span>
            </div>
            <h2 style={{ ...s.sectionTitle, color: '#fca5a5' }}>Fiscalizacao da NR-1 atualizada comeca em maio/2026</h2>
            <p style={{ color: '#d1b8a0', fontSize: '1rem', maxWidth: '600px', margin: '0 auto 2rem', lineHeight: 1.6 }}>
              O Ministerio do Trabalho inicia fiscalizacao rigorosa com cruzamento automatico via eSocial. Empresas sem PGR e PCMSO atualizados estao sujeitas a multas de R$ 15.000 a R$ 50.000 por infracao.
            </p>

            {showCountdown && (
              <div style={{ display: 'flex', justifyContent: 'center', gap: '1rem', flexWrap: 'wrap' }}>
                {[
                  { value: countdown.days, label: 'Dias' },
                  { value: countdown.hours, label: 'Horas' },
                  { value: countdown.minutes, label: 'Min' },
                  { value: countdown.seconds, label: 'Seg' },
                ].map(({ value, label }) => (
                  <div key={label} style={{ padding: '1rem 1.5rem', borderRadius: '12px', background: '#1c1111', border: '1px solid #7f1d1d', minWidth: '80px', textAlign: 'center' }}>
                    <span style={{ color: '#fca5a5', fontSize: '2rem', fontWeight: 900, display: 'block' }}>{String(value).padStart(2, '0')}</span>
                    <span style={{ color: '#6b7280', fontSize: '0.75rem', textTransform: 'uppercase' }}>{label}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>
      )}

      {/* ─── Solution ─── */}
      <section style={{ ...s.section, background: '#0a0f0a' }}>
        <div style={s.sectionInner}>
          <h2 style={s.sectionTitle}>O que voce recebe</h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1.5rem', marginTop: '2rem' }}>
            {[
              { title: 'PGR', desc: 'Programa de Gerenciamento de Riscos conforme NR-01. Inventario completo com matriz 5x5, plano de acao e medidas de controle.', icon: <ShieldIcon /> },
              { title: 'PCMSO', desc: 'Programa de Controle Medico de Saude Ocupacional conforme NR-07. Exames ocupacionais, cronograma e relatorio analitico.', icon: <CheckIcon /> },
              { title: 'DIR', desc: 'Declaracao de Inexistencia de Riscos para MEI. Dispensa de PGR com validade legal conforme NR-01.8.4.', icon: <CheckIcon /> },
            ].map(({ title, desc, icon }) => (
              <div key={title} style={{ padding: '1.5rem', borderRadius: '14px', background: '#111a11', border: '1px solid #14532d' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '1rem' }}>{icon}<h3 style={{ color: '#86efac', fontSize: '1.15rem', fontWeight: 700, margin: 0 }}>{title}</h3></div>
                <p style={{ color: '#a3c4b0', fontSize: '0.9rem', margin: 0, lineHeight: 1.5 }}>{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── Technology ─── */}
      {showTechnology && (
        <section style={{ ...s.section, background: '#0a0a1a' }}>
          <div style={s.sectionInner}>
            <h2 style={s.sectionTitle}>Tecnologia a servico da sua seguranca</h2>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1.5rem', marginTop: '2rem' }}>
              {[
                { title: 'Consulta automatica', desc: 'CNPJ analisado em tempo real via Receita Federal com classificacao de risco automatica.' },
                { title: 'Inteligencia artificial', desc: 'IA audita os dados coletados e sugere ajustes antes da revisao tecnica final.' },
                { title: 'Assinatura digital', desc: 'Documentos assinados eletronicamente com validade juridica via Autentique.' },
                { title: '100% digital', desc: 'Todo o processo e feito online, sem necessidade de deslocamento ou papelada.' },
              ].map(({ title, desc }) => (
                <div key={title} style={{ padding: '1.25rem', borderRadius: '12px', background: '#12122a', border: '1px solid #1e1e3e' }}>
                  <h3 style={{ color: '#a5b4fc', fontSize: '1rem', fontWeight: 700, margin: '0 0 0.5rem 0' }}>{title}</h3>
                  <p style={{ color: '#7c8db5', fontSize: '0.88rem', margin: 0, lineHeight: 1.5 }}>{desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ─── Video ─── */}
      {showVideo && (
        <section style={{ ...s.section, background: '#0a0a0a' }}>
          <div style={{ ...s.sectionInner, maxWidth: '800px' }}>
            <h2 style={s.sectionTitle}>Veja como funciona</h2>
            <div style={{ position: 'relative', paddingBottom: '56.25%', height: 0, borderRadius: '14px', overflow: 'hidden', marginTop: '1.5rem', border: '1px solid #333' }}>
              <iframe
                src={config.video_url}
                style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', border: 'none' }}
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
                title="Como funciona"
              />
            </div>
          </div>
        </section>
      )}

      {/* ─── Audience ─── */}
      <section style={{ ...s.section, background: '#0f0f0f' }}>
        <div style={s.sectionInner}>
          <h2 style={s.sectionTitle}>Para quem e essa solucao</h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1rem', marginTop: '2rem' }}>
            {[
              'MEI que precisa de DIR para licitacoes ou contratos',
              'Micro e pequenas empresas que precisam de PGR e PCMSO',
              'Empresas que receberam notificacao do MTE',
              'Contadores e escritorios que atendem clientes com colaboradores',
              'Empresas em processo de licitacao publica',
              'Negocios que querem evitar multas e processos trabalhistas',
            ].map((item, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', padding: '1rem', borderRadius: '10px', background: '#1a1a1a', border: '1px solid #2a2a2a' }}>
                <CheckIcon />
                <span style={{ color: '#d1d5db', fontSize: '0.9rem', lineHeight: 1.4 }}>{item}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── Authority ─── */}
      <section style={{ ...s.section, background: '#0a0a0a' }}>
        <div style={s.sectionInner}>
          <h2 style={s.sectionTitle}>Por que a AM Engenharia</h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1.5rem', marginTop: '2rem' }}>
            {[
              { value: '100%', label: 'Digital e sem burocracia' },
              { value: 'CREA', label: 'Engenheiro de Seguranca' },
              { value: 'CRM', label: 'Medico do Trabalho' },
              { value: '24h', label: 'Suporte por e-mail' },
            ].map(({ value, label }) => (
              <div key={label} style={{ textAlign: 'center', padding: '1.5rem', borderRadius: '14px', background: '#1a1a2e', border: '1px solid #2a2a3e' }}>
                <span style={{ color: '#d4af37', fontSize: '2rem', fontWeight: 900, display: 'block', marginBottom: '0.5rem' }}>{value}</span>
                <span style={{ color: '#9ca3af', fontSize: '0.88rem' }}>{label}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── CTA + Form ─── */}
      <section ref={formRef} id="form-section" style={{ ...s.section, background: 'linear-gradient(180deg, #0a0a0a 0%, #0f1a0f 50%, #0a0a0a 100%)' }}>
        <div style={{ ...s.sectionInner, maxWidth: '480px' }}>
          <h2 style={{ ...s.sectionTitle, marginBottom: '0.5rem' }}>Comece agora</h2>
          <p style={{ color: '#9ca3af', fontSize: '0.95rem', marginBottom: '2rem', textAlign: 'center' }}>
            Crie sua conta gratuitamente e analise o CNPJ da sua empresa.
          </p>
          <div style={{ padding: '2rem', borderRadius: '16px', background: '#1a1a1a', border: '1px solid #333', boxShadow: '0 8px 32px rgba(0,0,0,0.4)' }}>
            <RegistrationForm partnerRef={partnerRef} onLogin={onLogin} />
          </div>
        </div>
      </section>

      {/* ─── FAQ ─── */}
      <section style={{ ...s.section, background: '#0a0a0a' }}>
        <div style={{ ...s.sectionInner, maxWidth: '640px' }}>
          <h2 style={s.sectionTitle}>Perguntas frequentes</h2>
          <div style={{ marginTop: '2rem' }}>
            <FAQItem question="O que e PGR?" answer="O PGR (Programa de Gerenciamento de Riscos) e o documento obrigatorio pela NR-01 que identifica, avalia e controla todos os riscos ocupacionais da empresa, incluindo riscos psicossociais." />
            <FAQItem question="Minha empresa precisa de PCMSO?" answer="Sim, toda empresa com colaboradores precisa do PCMSO (Programa de Controle Medico de Saude Ocupacional), que define os exames medicos obrigatorios com base nos riscos mapeados no PGR." />
            <FAQItem question="O que e DIR?" answer="A DIR (Declaracao de Inexistencia de Riscos) e o documento que substitui o PGR para MEI sem colaboradores e sem exposicao a agentes nocivos, conforme NR-01.8.4." />
            <FAQItem question="Quanto tempo leva para receber os documentos?" answer="Apos a confirmacao do pagamento e preenchimento dos dados, os documentos sao elaborados e entregues digitalmente em ate 5 dias uteis." />
            <FAQItem question="Os documentos tem validade legal?" answer="Sim, todos os documentos sao assinados digitalmente por Engenheiro de Seguranca do Trabalho (CREA) e Medico do Trabalho (CRM), com total validade juridica." />
            <FAQItem question="Posso parcelar o pagamento?" answer="Sim, aceitamos Pix (aprovacao imediata), boleto (ate 3 dias uteis) e cartao de credito em ate 12x." />
          </div>
        </div>
      </section>

      {/* ─── Footer ─── */}
      <footer style={{ padding: '2rem', borderTop: '1px solid #222', textAlign: 'center' }}>
        <img src="/am-logo-branca.png" alt="AM Engenharia" style={{ height: '32px', marginBottom: '1rem' }} />
        <p style={{ color: '#6b7280', fontSize: '0.8rem', margin: 0 }}>
          AM Engenharia - Seguranca do Trabalho. Todos os direitos reservados.
        </p>
      </footer>
    </div>
  );
};

// ─── Styles ───
const s = {
  page: { minHeight: '100vh', background: '#0a0a0a', color: '#f0f0f0', fontFamily: 'Inter, system-ui, -apple-system, sans-serif' },
  header: { position: 'fixed', top: 0, left: 0, right: 0, zIndex: 100, background: 'rgba(10, 10, 10, 0.9)', backdropFilter: 'blur(12px)', borderBottom: '1px solid #222', padding: '0 2rem' },
  headerInner: { maxWidth: '1100px', margin: '0 auto', display: 'flex', justifyContent: 'space-between', alignItems: 'center', height: '64px' },
  headerCTA: { padding: '0.5rem 1.25rem', borderRadius: '8px', border: 'none', background: '#d4af37', color: '#121212', fontWeight: 700, fontSize: '0.85rem', cursor: 'pointer' },
  hero: { paddingTop: '120px', paddingBottom: '4rem', background: 'linear-gradient(180deg, #0a0a0a 0%, #0f1a0f 50%, #0a0a0a 100%)' },
  heroInner: { maxWidth: '800px', margin: '0 auto', padding: '0 2rem' },
  section: { padding: '4rem 2rem' },
  sectionInner: { maxWidth: '1000px', margin: '0 auto' },
  sectionTitle: { color: '#f0f0f0', fontSize: 'clamp(1.5rem, 3vw, 2rem)', fontWeight: 800, margin: '0 0 1rem 0', textAlign: 'center' },
  primaryBtn: { padding: '1rem 2rem', borderRadius: '12px', border: 'none', background: 'linear-gradient(135deg, #d4af37 0%, #c5a028 100%)', color: '#121212', fontWeight: 800, fontSize: '1.05rem', cursor: 'pointer', transition: 'all 0.2s', boxShadow: '0 4px 20px rgba(212, 175, 55, 0.3)' },
};

export default SalesLandingPage;
