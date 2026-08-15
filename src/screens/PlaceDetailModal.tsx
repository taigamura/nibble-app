import React from 'react';
import { Image, Linking, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import type { Place } from '../taste-engine';
import { buildDirectionsUrl, buildWriteReviewUrl } from './googleMapsLinks';

interface PlaceDetailModalProps {
  place: Place | null;
  /** The user's own Been rating, when this place came from the Been list. */
  rating?: number;
  onClose: () => void;
}

/** Opening any collection item (Want/Been list row or map pin) shows this. */
export function PlaceDetailModal({ place, rating, onClose }: PlaceDetailModalProps) {
  return (
    <Modal visible={place !== null} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={styles.sheet}>
          {place && (
            <ScrollView>
              <Image source={{ uri: place.photoUrl }} style={styles.photo} />
              <View style={styles.body}>
                <Text style={styles.name}>{place.name}</Text>
                <Text style={styles.meta}>
                  {place.category} · {place.priceBand} · ★{place.rating.toFixed(1)} ·{' '}
                  {Math.round(place.distanceMeters)}m
                </Text>
                {rating !== undefined && (
                  <Text style={styles.yourRating}>Your rating: {'★'.repeat(rating)}</Text>
                )}
                {place.tags.length > 0 && (
                  <View style={styles.tags}>
                    {place.tags.map((tag) => (
                      <View key={tag} style={styles.tag}>
                        <Text style={styles.tagText}>{tag}</Text>
                      </View>
                    ))}
                  </View>
                )}
              </View>
            </ScrollView>
          )}
          {place && (
            <View style={styles.actions}>
              <Pressable
                accessibilityLabel="Directions"
                style={[styles.actionButton, styles.directions]}
                onPress={() => Linking.openURL(buildDirectionsUrl(place))}
              >
                <Text style={[styles.actionText, styles.directionsText]}>Directions</Text>
              </Pressable>
              <Pressable
                accessibilityLabel="Write a review"
                style={[styles.actionButton, styles.writeReview]}
                onPress={() => Linking.openURL(buildWriteReviewUrl(place))}
              >
                <Text style={styles.actionText}>Write a review</Text>
              </Pressable>
            </View>
          )}
          <Pressable accessibilityLabel="Close place detail" style={styles.close} onPress={onClose}>
            <Text style={styles.closeText}>Close</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end',
  },
  sheet: {
    maxHeight: '80%',
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    overflow: 'hidden',
  },
  photo: {
    width: '100%',
    height: 240,
    backgroundColor: '#e5e5e5',
  },
  body: {
    padding: 20,
  },
  name: {
    fontSize: 22,
    fontWeight: '700',
  },
  meta: {
    marginTop: 4,
    fontSize: 14,
    color: '#666',
  },
  yourRating: {
    marginTop: 10,
    fontSize: 15,
    color: '#f5a623',
    fontWeight: '600',
  },
  tags: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 14,
    gap: 8,
  },
  tag: {
    backgroundColor: '#f0f0f0',
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  tagText: {
    fontSize: 12,
    color: '#444',
  },
  actions: {
    flexDirection: 'row',
    gap: 10,
    paddingHorizontal: 20,
    paddingBottom: 16,
  },
  actionButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
  },
  directions: {
    backgroundColor: '#111',
  },
  writeReview: {
    backgroundColor: '#f0f0f0',
  },
  actionText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#111',
  },
  directionsText: {
    color: '#fff',
  },
  close: {
    paddingVertical: 16,
    alignItems: 'center',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#e5e5e5',
  },
  closeText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#111',
  },
});
