import React from 'react';
import TestRenderer, { act, type ReactTestRenderer } from 'react-test-renderer';
import { FlatList, Image, Text } from 'react-native';

import { OnboardingScreen } from '../OnboardingScreen';
import { emptyTasteGraph } from '../../taste-engine';
import type { Place } from '../../taste-engine';
import type { PlacesProvider, Store } from '../../providers/types';
import { FALLBACK_PHOTO_URL } from '../../providers/curatedPlace';
import { ThemeProvider } from '../../ThemeProvider';

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

async function renderOnboarding(provider: PlacesProvider = makePlacesProvider()): Promise<ReactTestRenderer> {
  let renderer!: ReactTestRenderer;
  await act(async () => {
    renderer = TestRenderer.create(
      <ThemeProvider>
        <OnboardingScreen
          placesProvider={provider}
          store={makeStore()}
          requestLocation={async () => undefined}
          onComplete={() => {}}
        />
      </ThemeProvider>
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

  it('caps the grid to 10 places and drops photoless (fallback-image) rows', async () => {
    const many: Place[] = Array.from({ length: 25 }, (_, i) => ({
      id: `p${i}`,
      name: `Place ${i}`,
      category: 'ramen',
      tags: [],
      priceBand: '$$',
      rating: 4,
      distanceMeters: i * 10,
      // Every third place has no real photo (uses the stock fallback URL).
      photoUrl: i % 3 === 0 ? FALLBACK_PHOTO_URL : `https://example.com/${i}.jpg`,
    }));
    const provider: PlacesProvider = { getCandidates: async () => many };
    const renderer = await renderOnboarding(provider);

    const images = renderer.root.findAllByType(Image);
    expect(images.length).toBeLessThanOrEqual(10);
    // No surfaced tile points at the fallback stock image.
    for (const image of images) {
      expect(image.props.source.uri).not.toBe(FALLBACK_PHOTO_URL);
    }
  });
});
