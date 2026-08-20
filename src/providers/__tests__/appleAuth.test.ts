import * as AppleAuthentication from 'expo-apple-authentication';

import { SupabaseAppleAuthProvider } from '../appleAuth';

jest.mock('expo-apple-authentication', () => ({
  signInAsync: jest.fn(),
  AppleAuthenticationScope: { EMAIL: 0 },
}));

function fakeStorage() {
  const data = new Map<string, string>();
  return {
    getItem: jest.fn(async (key: string) => data.get(key) ?? null),
    setItem: jest.fn(async (key: string, value: string) => {
      data.set(key, value);
    }),
    removeItem: jest.fn(async (key: string) => {
      data.delete(key);
    }),
  };
}

describe('SupabaseAppleAuthProvider', () => {
  it('getSession resolves null when no session has ever been established', async () => {
    const provider = new SupabaseAppleAuthProvider({
      supabaseUrl: 'https://project.supabase.co',
      supabaseAnonKey: 'anon-key',
      storage: fakeStorage(),
    });

    await expect(provider.getSession()).resolves.toBeNull();
  });

  it('exchanges the Apple identity token for a Supabase session and persists it', async () => {
    (AppleAuthentication.signInAsync as jest.Mock).mockResolvedValue({ identityToken: 'apple-token' });
    const fetchImpl = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ access_token: 'sb-token', user: { id: 'user-1' } }),
    });
    const storage = fakeStorage();
    const provider = new SupabaseAppleAuthProvider({
      supabaseUrl: 'https://project.supabase.co',
      supabaseAnonKey: 'anon-key',
      fetchImpl: fetchImpl as unknown as typeof fetch,
      storage,
    });

    const session = await provider.signInWithApple();

    expect(AppleAuthentication.signInAsync).toHaveBeenCalledWith({
      requestedScopes: [AppleAuthentication.AppleAuthenticationScope.EMAIL],
    });
    expect(session).toEqual({ userId: 'user-1', accessToken: 'sb-token' });
    const [url, init] = fetchImpl.mock.calls[0];
    expect(String(url)).toContain('/auth/v1/token?grant_type=id_token');
    expect(JSON.parse((init as RequestInit).body as string)).toEqual({
      provider: 'apple',
      id_token: 'apple-token',
    });
    expect(storage.setItem).toHaveBeenCalledWith('nibble.authSession.v1', JSON.stringify(session));
  });

  it('restores a persisted session on getSession without re-prompting', async () => {
    const storage = fakeStorage();
    await storage.setItem('nibble.authSession.v1', JSON.stringify({ userId: 'user-1', accessToken: 'sb-token' }));
    const provider = new SupabaseAppleAuthProvider({
      supabaseUrl: 'https://project.supabase.co',
      supabaseAnonKey: 'anon-key',
      storage,
    });

    await expect(provider.getSession()).resolves.toEqual({ userId: 'user-1', accessToken: 'sb-token' });
  });

  it('throws when Apple does not return an identity token', async () => {
    (AppleAuthentication.signInAsync as jest.Mock).mockResolvedValue({ identityToken: null });
    const provider = new SupabaseAppleAuthProvider({
      supabaseUrl: 'https://project.supabase.co',
      supabaseAnonKey: 'anon-key',
      storage: fakeStorage(),
    });

    await expect(provider.signInWithApple()).rejects.toThrow('identity token');
  });

  it('throws when the Supabase token exchange fails', async () => {
    (AppleAuthentication.signInAsync as jest.Mock).mockResolvedValue({ identityToken: 'apple-token' });
    const fetchImpl = jest.fn().mockResolvedValue({ ok: false, status: 401, text: async () => '' });
    const provider = new SupabaseAppleAuthProvider({
      supabaseUrl: 'https://project.supabase.co',
      supabaseAnonKey: 'anon-key',
      fetchImpl: fetchImpl as unknown as typeof fetch,
      storage: fakeStorage(),
    });

    await expect(provider.signInWithApple()).rejects.toThrow('status 401');
  });

  it('includes the Supabase response body in the thrown error for debugging', async () => {
    (AppleAuthentication.signInAsync as jest.Mock).mockResolvedValue({ identityToken: 'apple-token' });
    const fetchImpl = jest.fn().mockResolvedValue({
      ok: false,
      status: 400,
      text: async () => '{"error":"invalid_grant","error_description":"bad_id_token"}',
    });
    const provider = new SupabaseAppleAuthProvider({
      supabaseUrl: 'https://project.supabase.co',
      supabaseAnonKey: 'anon-key',
      fetchImpl: fetchImpl as unknown as typeof fetch,
      storage: fakeStorage(),
    });

    await expect(provider.signInWithApple()).rejects.toThrow('bad_id_token');
  });

  it('signOut clears the in-memory session and the persisted session', async () => {
    (AppleAuthentication.signInAsync as jest.Mock).mockResolvedValue({ identityToken: 'apple-token' });
    const fetchImpl = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ access_token: 'sb-token', user: { id: 'user-1' } }),
    });
    const storage = fakeStorage();
    const provider = new SupabaseAppleAuthProvider({
      supabaseUrl: 'https://project.supabase.co',
      supabaseAnonKey: 'anon-key',
      fetchImpl: fetchImpl as unknown as typeof fetch,
      storage,
    });
    await provider.signInWithApple();

    await provider.signOut();

    expect(storage.removeItem).toHaveBeenCalledWith('nibble.authSession.v1');
    await expect(provider.getSession()).resolves.toBeNull();
  });
});
