import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

export async function initAuth(onStateChange: (session: any) => void) {
  const { data: { session } } = await supabase.auth.getSession();
  if (session) {
    localStorage.setItem('cm_jwt', session.access_token);
  } else {
    localStorage.removeItem('cm_jwt');
  }
  onStateChange(session);

  supabase.auth.onAuthStateChange((_event, session) => {
    if (session) {
      localStorage.setItem('cm_jwt', session.access_token);
    } else {
      localStorage.removeItem('cm_jwt');
    }
    onStateChange(session);
  });
}

export async function logout() {
  await supabase.auth.signOut();
  localStorage.removeItem('cm_jwt');
}
