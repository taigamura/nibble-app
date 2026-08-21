import React from 'react';
import TestRenderer, { act, type ReactTestRenderer } from 'react-test-renderer';
import { Image, View } from 'react-native';

import { Card } from '../Card';
import { LanguageProvider } from '../../i18n';
import type { Language } from '../../i18n';
import { LanguageState } from '../../settings/languageState';
import { lightColors } from '../../theme';
import { ThemeProvider } from '../../ThemeProvider';
import type { Place } from '../../taste-engine';

/** Forces English so these design tests can assert on the (unchanged) English strings. */
class EnglishLanguageState extends LanguageState {
  async get(): Promise<Language> {
    return 'en';
  }
}

const place: Place = {
  id: 'p1',
  name: 'Tsuta Ramen',
  category: 'ramen',
  tags: [],
  priceBand: '$$',
  rating: 4.5,
  distanceMeters: 300,
  photoUrl: 'https://example.com/photo.jpg',
};

async function render(element: React.ReactElement): Promise<ReactTestRenderer> {
  let renderer!: ReactTestRenderer;
  await act(async () => {
    renderer = TestRenderer.create(
      <LanguageProvider languageState={new EnglishLanguageState()}>
        <ThemeProvider>{element}</ThemeProvider>
      </LanguageProvider>
    );
  });
  // Flush the LanguageProvider's async restore so `t()` resolves to English
  // before assertions run.
  await act(async () => {});
  return renderer;
}

const tintIds = ['tint-want-p1', 'tint-nope-p1', 'tint-been-p1'];
const actionIds = ['action-want-p1', 'action-nope-p1', 'action-been-p1'];

function flatStyle(node: { props: { style?: unknown } }) {
  const style = node.props.style;
  return Array.isArray(style) ? Object.assign({}, ...style.filter(Boolean)) : style;
}

describe('Card directional edge-tint (design)', () => {
  it('renders a directional tint for each swipe action on the interactive card', async () => {
    const renderer = await render(<Card place={place} onSwiped={() => {}} onInfoPress={() => {}} />);
    for (const id of tintIds) {
      expect(renderer.root.findAllByProps({ testID: id }).length).toBeGreaterThan(0);
    }
  });

  it('colors each tint with its intent token, fading to that hue at zero alpha', async () => {
    const renderer = await render(<Card place={place} onSwiped={() => {}} onInfoPress={() => {}} />);
    // The wash is a LinearGradient: its leading-edge stop is the intent token,
    // fading to the same hue with a `00` (transparent) alpha byte.
    const colorsOf = (id: string) => renderer.root.findByProps({ testID: id }).props.colors;
    expect(colorsOf('tint-want-p1')).toEqual([lightColors.tint, `${lightColors.tint}00`]);
    expect(colorsOf('tint-nope-p1')).toEqual([lightColors.nope, `${lightColors.nope}00`]);
    expect(colorsOf('tint-been-p1')).toEqual([lightColors.been, `${lightColors.been}00`]);
  });

  it('starts every tint fully transparent so it only appears mid-drag', async () => {
    const renderer = await render(<Card place={place} onSwiped={() => {}} onInfoPress={() => {}} />);
    for (const id of tintIds) {
      const opacity = flatStyle(renderer.root.findByProps({ testID: id })).opacity;
      // Opacity is an Animated node (interpolation); its resting value is 0.
      const resting =
        opacity && typeof opacity.__getValue === 'function' ? opacity.__getValue() : opacity;
      expect(resting).toBe(0);
    }
  });

  it('omits tints on the non-interactive card behind the top one', async () => {
    const renderer = await render(<Card place={place} onSwiped={() => {}} />);
    const tints = renderer.root.findAll(
      (node) => typeof node.props.testID === 'string' && node.props.testID.startsWith('tint-')
    );
    expect(tints).toHaveLength(0);
  });
});

describe('Card docked action bar (design)', () => {
  it('renders a segment for each action on the interactive card, none behind', async () => {
    const interactive = await render(<Card place={place} onSwiped={() => {}} onInfoPress={() => {}} />);
    for (const id of actionIds) {
      expect(interactive.root.findAllByProps({ testID: id }).length).toBeGreaterThan(0);
    }

    const behind = await render(<Card place={place} onSwiped={() => {}} />);
    const segments = behind.root.findAll(
      (node) => typeof node.props.testID === 'string' && node.props.testID.startsWith('action-')
    );
    expect(segments).toHaveLength(0);
  });

  it('labels each segment and describes its gesture for accessibility', async () => {
    const renderer = await render(<Card place={place} onSwiped={() => {}} onInfoPress={() => {}} />);
    const save = renderer.root.findByProps({ accessibilityLabel: 'Save' });
    expect(save.props.accessibilityHint).toMatch(/right/i);
    const nope = renderer.root.findByProps({ accessibilityLabel: 'Not for me' });
    expect(nope.props.accessibilityHint).toMatch(/left/i);
    const been = renderer.root.findByProps({ accessibilityLabel: 'Been' });
    expect(been.props.accessibilityHint).toMatch(/up/i);
  });

  it('accents only Save (solid pill) and keeps the other two neutral', async () => {
    const renderer = await render(<Card place={place} onSwiped={() => {}} onInfoPress={() => {}} />);
    // Pressable style is a function of press state; resolve it at rest.
    const resolve = (label: string) => {
      const style = renderer.root.findByProps({ accessibilityLabel: label }).props.style;
      const arr = typeof style === 'function' ? style({ pressed: false }) : style;
      return Array.isArray(arr) ? Object.assign({}, ...arr.filter(Boolean)) : arr;
    };
    expect(resolve('Save').backgroundColor).toBe(lightColors.labelOnColor);
    expect(resolve('Not for me').backgroundColor).toBeUndefined();
    expect(resolve('Been').backgroundColor).toBeUndefined();
  });

  it('wires each segment to a press handler (taps drive flyOut → onSwiped)', async () => {
    const renderer = await render(<Card place={place} onSwiped={() => {}} onInfoPress={() => {}} />);
    for (const id of actionIds) {
      expect(typeof renderer.root.findByProps({ testID: id }).props.onPress).toBe('function');
    }
  });
});

describe('Card photo gallery (design)', () => {
  const gallery: Place = {
    ...place,
    photoUrls: [
      'https://example.com/1.jpg',
      'https://example.com/2.jpg',
      'https://example.com/3.jpg',
    ],
  };

  it('shows one indicator segment per photo only on the interactive card', async () => {
    const interactive = await render(<Card place={gallery} onSwiped={() => {}} onInfoPress={() => {}} />);
    const indicator = interactive.root.findByProps({ testID: 'photo-indicator-p1' });
    // The container itself is a View; each segment is a child View, so subtract 1.
    expect(indicator.findAllByType(View).length - 1).toBe(gallery.photoUrls!.length);

    const behind = await render(<Card place={gallery} onSwiped={() => {}} />);
    expect(
      behind.root.findAll((n) => n.props.testID === 'photo-indicator-p1')
    ).toHaveLength(0);
  });

  it('pages to the next photo when the right tap zone is pressed', async () => {
    const renderer = await render(<Card place={gallery} onSwiped={() => {}} onInfoPress={() => {}} />);
    const image = () =>
      renderer.root.findAllByType(Image).find((n) => typeof n.props.source?.uri === 'string')!;

    expect(image().props.source.uri).toBe(gallery.photoUrls![0]);
    act(() => {
      renderer.root.findByProps({ testID: 'photo-next-p1' }).props.onPress();
    });
    expect(image().props.source.uri).toBe(gallery.photoUrls![1]);
  });

  it('wraps from the first photo back to the last when paging previous', async () => {
    const renderer = await render(<Card place={gallery} onSwiped={() => {}} onInfoPress={() => {}} />);
    const image = () =>
      renderer.root.findAllByType(Image).find((n) => typeof n.props.source?.uri === 'string')!;

    act(() => {
      renderer.root.findByProps({ testID: 'photo-prev-p1' }).props.onPress();
    });
    expect(image().props.source.uri).toBe(gallery.photoUrls![gallery.photoUrls!.length - 1]);
  });

  it('shows no paging controls for a single-photo place', async () => {
    const renderer = await render(<Card place={place} onSwiped={() => {}} onInfoPress={() => {}} />);
    expect(renderer.root.findAll((n) => n.props.testID === 'photo-indicator-p1')).toHaveLength(0);
    expect(renderer.root.findAll((n) => n.props.testID === 'photo-next-p1')).toHaveLength(0);
  });
});
