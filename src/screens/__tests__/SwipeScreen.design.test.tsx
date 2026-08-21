import React from 'react';
import TestRenderer, { act, type ReactTestRenderer } from 'react-test-renderer';
import { Text } from 'react-native';

import { SwipeScreen } from '../SwipeScreen';
import { LanguageProvider } from '../../i18n';
import type { Language } from '../../i18n';
import { LanguageState } from '../../settings/languageState';
import { emptyTasteGraph } from '../../taste-engine';
import type { EnrichmentProvider, PlacesProvider, Store } from '../../providers/types';
import type { Place } from '../../taste-engine';
import { ThemeProvider } from '../../ThemeProvider';

/** Forces English so these design tests can assert on the (unchanged) English strings. */
class EnglishLanguageState extends LanguageState {
  async get(): Promise<Language> {
    return 'en';
  }
}

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
      <LanguageProvider languageState={new EnglishLanguageState()}>
        <ThemeProvider>
          <SwipeScreen
            placesProvider={makePlacesProvider()}
            enrichmentProvider={makeEnrichment()}
            store={makeStore()}
            seed={1}
          />
        </ThemeProvider>
      </LanguageProvider>
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
        <LanguageProvider languageState={new EnglishLanguageState()}>
          <ThemeProvider>
            <SwipeScreen
              placesProvider={{ getCandidates: async () => [] }}
              enrichmentProvider={makeEnrichment()}
              store={makeStore()}
              seed={1}
              onGoToWant={() => {}}
            />
          </ThemeProvider>
        </LanguageProvider>
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
        <LanguageProvider languageState={new EnglishLanguageState()}>
          <ThemeProvider>
            <SwipeScreen
              placesProvider={{ getCandidates: async () => [] }}
              enrichmentProvider={makeEnrichment()}
              store={makeStore()}
              seed={1}
            />
          </ThemeProvider>
        </LanguageProvider>
      );
    });
    await act(async () => {});

    expect(allText(renderer)).not.toContain('See Want list');
  });
});

describe('SwipeScreen guidance (design)', () => {
  // The action controls now live on the card's docked segmented bar (rendered
  // by Card), relabeled Save / Been / Not for me. They carry the gesture
  // mapping via accessibilityHint rather than a standalone visible hint line.
  it("labels the card's action segments so each action is legible", async () => {
    const renderer = await renderSwipe();
    for (const label of ['Save', 'Been', 'Not for me']) {
      expect(renderer.root.findAllByProps({ accessibilityLabel: label }).length).toBeGreaterThan(0);
    }
  });

  it('gives each action segment an accessibility hint describing its gesture', async () => {
    const renderer = await renderSwipe();
    const nope = renderer.root.findByProps({ accessibilityLabel: 'Not for me' });
    expect(nope.props.accessibilityHint).toMatch(/left/i);
    const been = renderer.root.findByProps({ accessibilityLabel: 'Been' });
    expect(been.props.accessibilityHint).toMatch(/up/i);
    const save = renderer.root.findByProps({ accessibilityLabel: 'Save' });
    expect(save.props.accessibilityHint).toMatch(/right/i);
  });

  it('shows Undo in the header only once there is something to undo', async () => {
    const renderer = await renderSwipe();
    // Fresh deck: nothing swiped yet, so no Undo affordance.
    expect(renderer.root.findAll((n) => n.props.accessibilityLabel === 'Undo')).toHaveLength(0);
  });
});
