import AsyncStorage from '@react-native-async-storage/async-storage';
import * as AppleAuthentication from 'expo-apple-authentication';

import type { AuthProvider, AuthSession } from './types';

const SESSION_STORAGE_KEY = 'nibble.authSession.v1';

export interface SupabaseAppleAuthProviderOptions {
  supabaseUrl: string;
  supabaseAnonKey: string;
  /** Injected fetch, defaulting to the global -- mirrors `SupabasePlacesProvider`. */
  fetchImpl?: typeof fetch;
  /** Injected persistence so a session survives an app restart; defaults to AsyncStorage. */
  storage?: { getItem(key: string): Promise<string | null>; setItem(key: string, value: string): Promise<void> };
}

interface SupabaseTokenResponse {
  access_token: string;
  user: { id: string };
}

/**
 * Signs in with the OS "Sign in with Apple" prompt, then exchanges the
 * returned identity token for a Supabase session via Supabase's native
 * id_token grant (POST /auth/v1/token?grant_type=id_token) -- a plain fetch
 * call, matching this repo's no-SDK pattern (see SupabasePlacesProvider)
 * rather than pulling in @supabase/supabase-js.
 */
export class SupabaseAppleAuthProvider implements AuthProvider {
  private readonly fetchImpl: typeof fetch;
  private readonly storage: NonNullable<SupabaseAppleAuthProviderOptions['storage']>;
  private session: AuthSession | null = null;

  constructor(private readonly options: SupabaseAppleAuthProviderOptions) {
    this.fetchImpl = options.fetchImpl ?? fetch;
    this.storage = options.storage ?? AsyncStorage;
  }

  async getSession(): Promise<AuthSession | null> {
    if (this.session) return this.session;
    const raw = await this.storage.getItem(SESSION_STORAGE_KEY);
    if (!raw) return null;
    this.session = JSON.parse(raw) as AuthSession;
    return this.session;
  }

  async signInWithApple(): Promise<AuthSession> {
    const credential = await AppleAuthentication.signInAsync({
      requestedScopes: [AppleAuthentication.AppleAuthenticationScope.FULL_NAME],
    });
    if (!credential.identityToken) {
      throw new Error('Apple sign-in did not return an identity token');
    }

    const { supabaseUrl, supabaseAnonKey } = this.options;
    const response = await this.fetchImpl(`${supabaseUrl}/auth/v1/token?grant_type=id_token`, {
      method: 'POST',
      headers: { apikey: supabaseAnonKey, 'Content-Type': 'application/json' },
      body: JSON.stringify({ provider: 'apple', id_token: credential.identityToken }),
    });

    if (!response.ok) {
      throw new Error(`Supabase Apple sign-in failed with status ${response.status}`);
    }

    const body = (await response.json()) as SupabaseTokenResponse;
    const session: AuthSession = { userId: body.user.id, accessToken: body.access_token };
    this.session = session;
    await this.storage.setItem(SESSION_STORAGE_KEY, JSON.stringify(session));
    return session;
  }
}
