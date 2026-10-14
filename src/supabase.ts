import { createClient, SupabaseClient, User } from '@supabase/supabase-js';

export const DEFAULT_SUPABASE_URL = 'https://vjoaxuusbmwfiygntbjv.supabase.co';
export const DEFAULT_SUPABASE_KEY = 'sb_publishable_UaicqMAXrbFFbiyBHFf6YA_CNpI8qBJ';

// Helper to get or set the saved key in localStorage
export function getSavedSupabaseKey(): string {
  if (typeof window === 'undefined') return DEFAULT_SUPABASE_KEY;
  return localStorage.getItem('supabase_anon_key') || DEFAULT_SUPABASE_KEY;
}

export function saveSupabaseKey(key: string): void {
  if (typeof window !== 'undefined') {
    localStorage.setItem('supabase_anon_key', key.trim());
  }
}

let clientInstance: SupabaseClient | null = null;
let currentKeyUsed = '';

export function getSupabase(customKey?: string): SupabaseClient {
  const key = customKey || getSavedSupabaseKey() || DEFAULT_SUPABASE_KEY;

  if (!clientInstance || currentKeyUsed !== key) {
    clientInstance = createClient(DEFAULT_SUPABASE_URL, key, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
      },
    });
    currentKeyUsed = key;
  }

  return clientInstance;
}

// Authentication Helpers
export async function signUpWithEmail(email: string, pass: string): Promise<{ user: User | null; error: string | null }> {
  const sb = getSupabase();
  try {
    const { data, error } = await sb.auth.signUp({
      email,
      password: pass,
    });
    if (error) return { user: null, error: error.message };
    return { user: data.user, error: null };
  } catch (e: any) {
    return { user: null, error: e?.message || 'فشل إنشاء الحساب' };
  }
}

export async function signInWithEmail(email: string, pass: string): Promise<{ user: User | null; error: string | null }> {
  const sb = getSupabase();
  try {
    const { data, error } = await sb.auth.signInWithPassword({
      email,
      password: pass,
    });
    if (error) return { user: null, error: error.message };
    return { user: data.user, error: null };
  } catch (e: any) {
    return { user: null, error: e?.message || 'فشل تسجيل الدخول' };
  }
}

export async function signOutUser(): Promise<{ error: string | null }> {
  const sb = getSupabase();
  try {
    const { error } = await sb.auth.signOut();
    return { error: error ? error.message : null };
  } catch (e: any) {
    return { error: e?.message || 'فشل تسجيل الخروج' };
  }
}

export async function getCurrentUser(): Promise<User | null> {
  const sb = getSupabase();
  try {
    const { data: { user } } = await sb.auth.getUser();
    return user;
  } catch {
    return null;
  }
}

// Chat History Helpers
export async function saveMessageToSupabase(userMessage: string, botReply: string, userId?: string) {
  const sb = getSupabase();
  try {
    await sb.from('chat_history').insert({
      user_message: userMessage,
      bot_reply: botReply,
      user_id: userId || null,
      created_at: new Date().toISOString()
    });
  } catch (err) {
    console.warn('Could not save to Supabase chat_history:', err);
  }
}

export async function loadChatHistoryFromSupabase(userId?: string): Promise<{ text: string; isUser: boolean }[]> {
  const sb = getSupabase();
  try {
    let query = sb
      .from('chat_history')
      .select('user_message, bot_reply, created_at')
      .order('created_at', { ascending: true })
      .limit(30);

    if (userId) {
      query = query.eq('user_id', userId);
    }

    const { data, error } = await query;
    if (error || !data) return [];

    const messages: { text: string; isUser: boolean }[] = [];
    for (const item of data) {
      if (item.user_message) messages.push({ text: item.user_message, isUser: true });
      if (item.bot_reply) messages.push({ text: item.bot_reply, isUser: false });
    }
    return messages;
  } catch {
    return [];
  }
}
