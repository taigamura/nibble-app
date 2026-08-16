import React from 'react';
import TestRenderer, { act, type ReactTestRenderer } from 'react-test-renderer';
import { Text } from 'react-native';

import { CollectionScreen } from '../CollectionScreen';
import { emptyTasteGraph, updateTaste } from '../../taste-engine';
import type { Place, TasteGraph } from '../../taste-engine';
import type { Store } from '../../providers/types';

const WANT_PLACE: Place = {
  id: 'w1',
  name: 'Yakitori Yui',
  category: 'yakitori',
  tags: [],
  priceBand: '$$',
  rating: 4.3,
  distanceMeters: 200,
  photoUrl: 'https://example.com/w1.jpg',
};

function graphWithWant(): TasteGraph {
  return updateTaste(emptyTasteGraph(), { place: WANT_PLACE, action: 'want', timestamp: 1 });
}

function makeStore(graph: TasteGraph): Store & { saved: TasteGraph[] } {
  const saved: TasteGraph[] = [];
  return {
    getGraph: async () => graph,
    saveGraph: async (g) => {
      saved.push(g);
    },
    saved,
  };
}

function allText(renderer: ReactTestRenderer): string[] {
  return renderer.root
    .findAllByType(Text)
    .map((n) => (typeof n.props.children === 'string' ? n.props.children : ''))
    .filter(Boolean);
}

describe('CollectionScreen — I went (markBeen)', () => {
  it('moves a Want place to Been when "I went" is pressed on its row', async () => {
    const store = makeStore(graphWithWant());
    let renderer!: ReactTestRenderer;
    await act(async () => {
      renderer = TestRenderer.create(<CollectionScreen store={store} />);
    });
    await act(async () => {});

    expect(allText(renderer)).toContain('Yakitori Yui');

    const iWentButton = renderer.root.findByProps({ accessibilityLabel: 'I went to Yakitori Yui' });
    await act(async () => {
      iWentButton.props.onPress({ stopPropagation: () => {} });
    });

    // markBeen reopens the detail modal for review -- close it, then confirm
    // the place is gone from the Want tab's own list.
    const closeButton = renderer.root.findByProps({ accessibilityLabel: 'Close place detail' });
    await act(async () => {
      closeButton.props.onPress();
    });
    expect(allText(renderer)).not.toContain('Yakitori Yui');
    // Persisted the updated graph.
    expect(store.saved.length).toBeGreaterThan(0);
    const latest = store.saved[store.saved.length - 1];
    expect(latest.history.some((e) => e.place.id === 'w1' && e.action === 'been')).toBe(true);

    // Switch to the Been tab and confirm it now shows there.
    const beenTab = renderer.root.findByProps({ accessibilityLabel: 'Been tab' });
    await act(async () => {
      beenTab.props.onPress();
    });
    expect(allText(renderer)).toContain('Yakitori Yui');
  });
});
