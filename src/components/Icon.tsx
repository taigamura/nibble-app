/**
 * Semantic icon component wrapping Ionicons from `@expo/vector-icons`.
 *
 * Call sites should always use APP-SEMANTIC names (e.g. 'want', 'undo'),
 * never raw Ionicons glyph names, so the icon vocabulary stays centralized
 * and swappable in one place.
 */
import * as React from 'react';
import { StyleProp, TextStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

export type IconName =
  | 'discover'
  | 'discover-active'
  | 'collection'
  | 'collection-active'
  | 'nope'
  | 'been'
  | 'want'
  | 'want-filled'
  | 'undo'
  | 'settings'
  | 'info'
  | 'location'
  | 'star'
  | 'star-outline'
  | 'tonight'
  | 'sparkles'
  | 'close'
  | 'back'
  | 'forward'
  | 'down'
  | 'add';

const GLYPHS: Record<IconName, React.ComponentProps<typeof Ionicons>['name']> = {
  discover: 'restaurant-outline',
  'discover-active': 'restaurant',
  collection: 'bookmark-outline',
  'collection-active': 'bookmark',
  nope: 'close',
  been: 'checkmark',
  want: 'heart-outline',
  'want-filled': 'heart',
  undo: 'arrow-undo',
  settings: 'settings-outline',
  info: 'information-circle',
  location: 'location',
  star: 'star',
  'star-outline': 'star-outline',
  tonight: 'moon',
  sparkles: 'sparkles',
  close: 'close',
  back: 'chevron-back',
  forward: 'chevron-forward',
  down: 'chevron-down',
  add: 'add',
};

export interface IconProps {
  name: IconName;
  size?: number;
  color?: string;
  style?: StyleProp<TextStyle>;
}

export function Icon({ name, size = 24, color, style }: IconProps) {
  return <Ionicons name={GLYPHS[name]} size={size} color={color} style={style} />;
}
