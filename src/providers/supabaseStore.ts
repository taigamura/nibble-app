import { emptyTasteGraph } from '../taste-engine';
import type { TasteGraph } from '../taste-engine';
import type { AuthSession, Store } from './types';

interface TasteGraphRow {
  graph: TasteGraph;
}

export interface SupabaseStoreOptions {
  supabaseUrl: string;
  supabaseAnonKey: string;
  /** Injected so this can't drift from whatever `AuthProvider` currently holds the session. */
  getSession: () => Promise<AuthSession>;
  /** Injected fetch, defaulting to the global -- mirrors `SupabasePlacesProvider`. */
  fetchImpl?: typeof fetch;
}

/**
 * Persists the taste graph to the `taste_graphs` table (one row per user,
 * see supabase/schema.sql), scoped by the signed-in user's id + RLS. Only
 * ever used once a `Store` swap has happened post sign-in -- see
 * `migrateLocalDataToCloud`.
 */
export class SupabaseStore implements Store {
  private readonly fetchImpl: typeof fetch;

  constructor(private readonly options: SupabaseStoreOptions) {
    // Bound to the realm global; browsers throw "Illegal invocation" if
    // window.fetch is called off an instance rather than the global object.
    this.fetchImpl = options.fetchImpl ?? fetch.bind(globalThis);
  }

  async getGraph(): Promise<TasteGraph> {
    const { supabaseUrl, supabaseAnonKey, getSession } = this.options;
    const session = await getSession();

    const url = new URL(`${supabaseUrl}/rest/v1/taste_graphs`);
    url.searchParams.set('select', 'graph');
    url.searchParams.set('user_id', `eq.${session.userId}`);

    const response = await this.fetchImpl(url.toString(), {
      headers: {
        apikey: supabaseAnonKey,
        Authorization: `Bearer ${session.accessToken}`,
      },
    });

    if (!response.ok) {
      throw new Error(`Supabase taste graph fetch failed with status ${response.status}`);
    }

    const rows = (await response.json()) as TasteGraphRow[];
    return rows[0]?.graph ?? emptyTasteGraph();
  }

  async saveGraph(graph: TasteGraph): Promise<void> {
    const { supabaseUrl, supabaseAnonKey, getSession } = this.options;
    const session = await getSession();

    const url = new URL(`${supabaseUrl}/rest/v1/taste_graphs`);

    const response = await this.fetchImpl(url.toString(), {
      method: 'POST',
      headers: {
        apikey: supabaseAnonKey,
        Authorization: `Bearer ${session.accessToken}`,
        'Content-Type': 'application/json',
        // Upserts by the table's primary key (user_id) so repeated saves
        // during a session don't create duplicate rows.
        Prefer: 'resolution=merge-duplicates',
      },
      body: JSON.stringify({ user_id: session.userId, graph }),
    });

    if (!response.ok) {
      throw new Error(`Supabase taste graph save failed with status ${response.status}`);
    }
  }
}
