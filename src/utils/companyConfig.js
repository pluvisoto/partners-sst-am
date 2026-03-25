import { supabase } from './supabase.js';

export const DEFAULT_COMPANY_CONFIG = {
  pgr_pcmso_bundle_price: 4300,
  dir_price: 800,
  valor_base_capita: 10,
  limite_plano_minimo: 30,
  valor_extra_capita: 20,
  additional_employee_price: 250,
};

export const getCompanyConfig = async () => {
  try {
    const { data, error } = await supabase
      .from('company_config')
      .select('*')
      .limit(1)
      .maybeSingle();

    if (error) {
      console.error('[getCompanyConfig] Erro ao carregar configuracao:', error.message);
      return { ...DEFAULT_COMPANY_CONFIG };
    }

    return data ? { ...DEFAULT_COMPANY_CONFIG, ...data } : { ...DEFAULT_COMPANY_CONFIG };
  } catch (error) {
    console.error('[getCompanyConfig] Erro inesperado:', error);
    return { ...DEFAULT_COMPANY_CONFIG };
  }
};
