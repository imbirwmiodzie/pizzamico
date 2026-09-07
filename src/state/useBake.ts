import { useSyncExternalStore } from 'react';

import { bakeActions, getSnapshot, subscribe } from './bakeStore';
import type { BakeSnapshot } from './bakeStore';

/** Read the one live bake. The actions are stable and never re-render anything. */
export function useBake(): { bake: BakeSnapshot; actions: typeof bakeActions } {
  const bake = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
  return { bake, actions: bakeActions };
}
