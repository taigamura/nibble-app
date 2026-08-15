import type { Store } from '../providers/types';
import type { TasteGraph } from '../taste-engine';
import { mergeTasteGraphs } from './mergeGraphs';

/**
 * Runs once, right after sign-in: merges the local-anonymous graph into
 * whatever the cloud store already holds (empty for a brand-new account,
 * populated for a returning user on a new device) and writes the merged
 * result back to the cloud. Never writes back to `local` -- callers switch
 * `Store` references to `cloud` afterward, per the Store interface's "swap
 * without changing call sites" contract.
 */
export async function migrateLocalDataToCloud(local: Store, cloud: Store): Promise<TasteGraph> {
  const [localGraph, cloudGraph] = await Promise.all([local.getGraph(), cloud.getGraph()]);
  const merged = mergeTasteGraphs(localGraph, cloudGraph);
  await cloud.saveGraph(merged);
  return merged;
}
