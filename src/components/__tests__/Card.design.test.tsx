import React from 'react';
import TestRenderer, { act, type ReactTestRenderer } from 'react-test-renderer';
import { Text } from 'react-native';

import { Card } from '../Card';
import { colors } from '../../theme';
import type { Place } from '../../taste-engine';

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

function render(element: React.ReactElement): ReactTestRenderer {
  let renderer!: ReactTestRenderer;
  act(() => {
    renderer = TestRenderer.create(element);
  });
  return renderer;
}

const guideIds = ['guide-want-p1', 'guide-nope-p1', 'guide-been-p1'];

describe('Card swipe guides (design)', () => {
  it('renders a directional guide for each swipe action on the interactive card', () => {
    const renderer = render(<Card place={place} onSwiped={() => {}} onInfoPress={() => {}} />);
    for (const id of guideIds) {
      expect(renderer.root.findAllByProps({ testID: id }).length).toBeGreaterThan(0);
    }
  });

  it('labels each guide with the action and colors it with the intent token', () => {
    const renderer = render(<Card place={place} onSwiped={() => {}} onInfoPress={() => {}} />);
    const labelText = renderer.root
      .findAllByType(Text)
      .map((node) => (typeof node.props.children === 'string' ? node.props.children : ''));
    expect(labelText.some((t) => t.includes('WANT'))).toBe(true);
    expect(labelText.some((t) => t.includes('NOPE'))).toBe(true);
    expect(labelText.some((t) => t.includes('BEEN'))).toBe(true);

    const wantGuide = renderer.root.findByProps({ testID: 'guide-want-p1' });
    const wantLabel = wantGuide.findByType(Text);
    const wantStyle = Array.isArray(wantLabel.props.style)
      ? Object.assign({}, ...wantLabel.props.style)
      : wantLabel.props.style;
    expect(wantStyle.color).toBe(colors.want);
  });

  it('starts every guide fully transparent so it only appears mid-drag', () => {
    const renderer = render(<Card place={place} onSwiped={() => {}} onInfoPress={() => {}} />);
    for (const id of guideIds) {
      const guide = renderer.root.findByProps({ testID: id });
      const style = Array.isArray(guide.props.style)
        ? Object.assign({}, ...guide.props.style.filter(Boolean))
        : guide.props.style;
      // Opacity is an Animated node (interpolation); its resting value is 0.
      const opacity = style.opacity;
      const resting = opacity && typeof opacity.__getValue === 'function' ? opacity.__getValue() : opacity;
      expect(resting).toBe(0);
    }
  });

  it('omits guides on the non-interactive card behind the top one', () => {
    const renderer = render(<Card place={place} onSwiped={() => {}} />);
    const guides = renderer.root.findAll(
      (node) => typeof node.props.testID === 'string' && node.props.testID.startsWith('guide-')
    );
    expect(guides).toHaveLength(0);
  });
});
