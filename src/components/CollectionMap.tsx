import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { projectPoints } from '../collection/mapProjection';
import type { MapPoint } from '../collection/selectors';

interface CollectionMapProps {
  points: MapPoint[];
  onSelect: (place: MapPoint['place']) => void;
}

/**
 * Lightweight custom map: no native map SDK / react-native-maps dependency
 * (would need a config plugin and a native build this project can't verify
 * headlessly). Projects each place's lat/lng onto a plain bounded canvas via
 * `projectPoints` — enough to visually distinguish Want vs. Been placement
 * without the native dependency risk.
 */
export function CollectionMap({ points, onSelect }: CollectionMapProps) {
  if (points.length === 0) {
    return (
      <View style={styles.empty}>
        <Text style={styles.emptyText}>No located places yet.</Text>
      </View>
    );
  }

  const projected = projectPoints(points.map(({ place }) => ({ lat: place.lat!, lng: place.lng! })));

  return (
    <View style={styles.canvas} testID="collection-map-canvas">
      {points.map((point, index) => {
        const { x, y } = projected[index];
        return (
          <Pressable
            key={point.place.id}
            accessibilityLabel={`Map pin for ${point.place.name}`}
            style={[
              styles.pin,
              point.kind === 'been' ? styles.pinBeen : styles.pinWant,
              { left: `${x * 100}%`, top: `${y * 100}%` },
            ]}
            onPress={() => onSelect(point.place)}
          >
            <Text style={styles.pinText}>{point.kind === 'been' ? '✓' : '♥'}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  canvas: {
    flex: 1,
    margin: 16,
    borderRadius: 16,
    backgroundColor: '#e8ede8',
    overflow: 'hidden',
  },
  empty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyText: {
    fontSize: 14,
    color: '#888',
  },
  pin: {
    position: 'absolute',
    width: 28,
    height: 28,
    borderRadius: 14,
    marginLeft: -14,
    marginTop: -14,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 3,
    shadowOffset: { width: 0, height: 1 },
    elevation: 2,
  },
  pinBeen: {
    backgroundColor: '#27ae60',
  },
  pinWant: {
    backgroundColor: '#e91e63',
  },
  pinText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '700',
  },
});
