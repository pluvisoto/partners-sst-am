import { supabase } from './supabase.js';

const ROLE_GROUP_MAP = {
  admin: ['admin'],
  partner: ['partner'],
  comercial_am: ['comercial_am'],
  lead: ['lead'],
};

export const loginBackoffice = async (email, password, { expectedRole = null } = {}) => {
  try {
    // Sign out first to avoid stale sessions
    await supabase.auth.signOut().catch(() => {});

    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({ email, password });
    if (authError) {
      console.error('[loginBackoffice] Erro de autenticacao:', authError.message);
      return { success: false, error: 'Credenciais invalidas. Verifique e tente novamente.' };
    }

    if (!authData?.user) {
      return { success: false, error: 'Nao foi possivel autenticar. Tente novamente.' };
    }

    const session = await buildBackofficeSessionFromAuthUser(authData.user);
    if (!session) {
      await supabase.auth.signOut().catch(() => {});
      return { success: false, error: 'Perfil de acesso nao encontrado para este usuario.' };
    }

    if (expectedRole) {
      const allowedGroups = ROLE_GROUP_MAP[expectedRole] || [expectedRole];
      if (!allowedGroups.includes(session.role)) {
        await supabase.auth.signOut().catch(() => {});
        return { success: false, error: `Acesso negado. Este login nao possui permissao para a area de ${expectedRole}.` };
      }
    }

    return { success: true, session };
  } catch (error) {
    console.error('[loginBackoffice] Erro inesperado:', error);
    return { success: false, error: 'Erro inesperado ao autenticar. Tente novamente.' };
  }
};

const buildBackofficeSessionFromAuthUser = async (authUser) => {
  if (!authUser?.id) return null;

  // Check user_access_profiles table
  const { data: profile } = await supabase
    .from('user_access_profiles')
    .select('*')
    .eq('user_id', authUser.id)
    .eq('is_active', true)
    .single();

  if (profile) {
    return {
      role: profile.role || 'lead',
      user_id: authUser.id,
      name: profile.display_name || authUser.email,
      email: authUser.email,
      cpf: profile.cpf || null,
      phone: profile.phone || null,
      partner_ref: profile.partner_ref || null,
    };
  }

  return null;
};

export const resumeBackofficeSession = async () => {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user) return null;

    const builtSession = await buildBackofficeSessionFromAuthUser(session.user);
    return builtSession;
  } catch (error) {
    console.error('[resumeBackofficeSession] Erro:', error);
    return null;
  }
};

export const signOutBackoffice = async () => {
  try {
    await supabase.auth.signOut();
    return { success: true };
  } catch (error) {
    console.error('[signOutBackoffice] Erro:', error);
    return { success: false, error: 'Erro ao sair da sessao.' };
  }
};
