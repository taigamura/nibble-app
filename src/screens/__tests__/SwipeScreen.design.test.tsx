import React from 'react';
import TestRenderer, { act, type ReactTestRenderer } from 'react-test-renderer';
import { Text } from 'react-native';

import { SwipeScreen } from '../SwipeScreen';
import { emptyTasteGraph } from '../../taste-engine';
import type { EnrichmentProvider, PlacesProvider, Store } from '../../providers/types';
import type { Place } from '../../taste-engine';

const places: Place[] = [
  {
    id: 'a',
    name: 'A',
    category: 'ramen',
    tags: [],
    priceBand: '$$',
    rating: 4.2,
    distanceMeters: 120,
    photoUrl: 'https://example.com/a.jpg',
  },
];

function makePlacesProvider(): PlacesProvider {
  return { getCandidates: async () => places };
}
function makeEnrichment(): EnrichmentProvider {
  return { enrich: async (p) => p.tags };
}
function makeStore(): Store {
  return {
    getGraph: async () => emptyTasteGraph(),
    saveGraph: async () => {},
  };
}

async function renderSwipe(): Promise<ReactTestRenderer> {
  let renderer!: ReactTestRenderer;
  await act(async () => {
    renderer = TestRenderer.create(
      <SwipeScreen
        placesProvider={makePlacesProvider()}
        enrichmentProvider={makeEnrichment()}
        store={makeStore()}
        seed={1}
      />
    );
  });
  await act(async () => {});
  return renderer;
}

function allText(renderer: ReactTestRenderer): string[] {
  return renderer.root
    .findAllByType(Text)
    .map((n) => (typeof n.props.children === 'string' ? n.props.children : ''))
    .filter(Boolean);
}

describe('SwipeScreen empty-deck decision card', () => {
  it('offers Widen, Reset seen, and See Want list when the deck runs out', async () => {
    let renderer!: ReactTestRenderer;
    await act(async () => {
      renderer = TestRenderer.create(
        <SwipeScreen
          placesProvider={{ getCandidates: async () => [] }}
          enrichmentProvider={makeEnrichment()}
          store={makeStore()}
          seed={1}
          onGoToWant={() => {}}
        />
      );
    });
    await act(async () => {});

    const text = allText(renderer);
    expect(text).toContain('Widen the search');
    expect(text).toContain('Reset seen');
    expect(text).toContain('See Want list');
  });

  it('hides See Want list when onGoToWant is not provided', async () => {
    let renderer!: ReactTestRenderer;
    await act(async () => {
      renderer = TestRenderer.create(
        <SwipeScreen
          placesProvider={{ getCandidates: async () => [] }}
          enrichmentProvider={makeEnrichment()}
          store={makeStore()}
          seed={1}
        />
      );
    });
    await act(async () => {});

    expect(allText(renderer)).not.toContain('See Want list');
  });
});

describe('SwipeScreen guidance (design)', () => {
  it('labels every bottom button so its action is legible without guessing', async () => {
    const renderer = await renderSwipe();
    const text = allText(renderer);
    for (const label of ['Nope', 'Undo', 'Been', 'Want']) {
      expect(text).toContain(label);
    }
  });

  // The directional gesture mapping is conveyed per-button via
  // accessibilityHint (below) rather than a standalone visible hint line.
  it('gives each action button an accessibility hint describing its gesture', async () => {
    const renderer = await renderSwipe();
    const nope = renderer.root.findByProps({ accessibilityLabel: 'Nope' });
    expect(nope.props.accessibilityHint).toMatch(/left/i);
    const been = renderer.root.findByProps({ accessibilityLabel: 'Been' });
    expect(been.props.accessibilityHint).toMatch(/up/i);
    const want = renderer.root.findByProps({ accessibilityLabel: 'Want' });
    expect(want.props.accessibilityHint).toMatch(/right/i);
  });
});
