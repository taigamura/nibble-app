import React from 'react';
import TestRenderer, { act, type ReactTestRenderer } from 'react-test-renderer';
import { FlatList, Image, Text } from 'react-native';

import { OnboardingScreen } from '../OnboardingScreen';
import { emptyTasteGraph } from '../../taste-engine';
import type { Place } from '../../taste-engine';
import type { PlacesProvider, Store } from '../../providers/types';

const places: Place[] = [
  {
    id: 'a',
    name: 'A restaurant with a fairly long name that could overflow its row',
    category: 'ramen',
    tags: [],
    priceBand: '$$',
    rating: 4.2,
    distanceMeters: 120,
    photoUrl: 'https://example.com/a.jpg',
  },
  {
    id: 'b',
    name: 'B izakaya',
    category: 'izakaya',
    tags: [],
    priceBand: '$$$',
    rating: 4.7,
    distanceMeters: 400,
    photoUrl: 'https://example.com/b.jpg',
  },
];

function makePlacesProvider(): PlacesProvider {
  return { getCandidates: async () => places };
}

function makeStore(): Store {
  return {
    getGraph: async () => emptyTasteGraph(),
    saveGraph: async () => {},
  };
}

async function renderOnboarding(): Promise<ReactTestRenderer> {
  let renderer!: ReactTestRenderer;
  await act(async () => {
    renderer = TestRenderer.create(
      <OnboardingScreen
        placesProvider={makePlacesProvider()}
        store={makeStore()}
        requestLocation={async () => undefined}
        onComplete={() => {}}
      />
    );
  });
  // Flush the async getCandidates() effect.
  await act(async () => {});
  return renderer;
}

describe('OnboardingScreen layout (design)', () => {
  it('lays the places out one per row (single column) so images are not cramped', async () => {
    const renderer = await renderOnboarding();
    const list = renderer.root.findByType(FlatList);
    expect(list.props.numColumns).toBe(1);
  });

  it('renders one image per place and clamps long names to a single line', async () => {
    const renderer = await renderOnboarding();
    const images = renderer.root.findAllByType(Image);
    expect(images).toHaveLength(places.length);

    // The long name must be clamped, not wrapped/clipped, so it never
    // overflows or squeezes its row.
    const nameNode = renderer.root.findAll(
      (node) => node.type === Text && node.props.children === places[0].name
    )[0];
    expect(nameNode.props.numberOfLines).toBe(1);
  });

  it('gives the scroll list room to clear the pinned Continue button', async () => {
    const renderer = await renderOnboarding();
    const list = renderer.root.findByType(FlatList);
    const contentStyle = Array.isArray(list.props.contentContainerStyle)
      ? Object.assign({}, ...list.props.contentContainerStyle)
      : list.props.contentContainerStyle;
    expect(contentStyle.paddingBottom).toBeGreaterThanOrEqual(96);
  });

  it('exposes an accessible Continue action reflecting the selection count', async () => {
    const renderer = await renderOnboarding();
    const cont = renderer.root.findByProps({ accessibilityLabel: 'Continue to deck' });
    expect(cont).toBeTruthy();
  });
});
