import React from 'react';
import { ActivityIndicator, Modal, Pressable, StyleSheet, Text, View } from 'react-native';

interface SignInPromptModalProps {
  visible: boolean;
  signingIn: boolean;
  error: string | null;
  onSignIn: () => void;
  onDismiss: () => void;
}

/**
 * The one and only sign-up ask in the app (issue #9). Shown after value has
 * already landed -- callers decide the moment (end of first session, tapping
 * "Sync", or "Write a review"), never before. "Not now" always works: the
 * graph and history stay fully usable locally either way.
 */
export function SignInPromptModal({ visible, signingIn, error, onSignIn, onDismiss }: SignInPromptModalProps) {
  return (
    <Modal visible={visible} animationType="fade" transparent onRequestClose={onDismiss}>
      <View style={styles.backdrop}>
        <View style={styles.sheet}>
          <Text style={styles.title}>Save your taste graph</Text>
          <Text style={styles.body}>
            Sign in to sync your Want list, Been history, and taste graph across devices. Your graph and history stay
            free either way.
          </Text>
          {error && <Text style={styles.error}>{error}</Text>}
          <Pressable
            accessibilityLabel="Sign in with Apple"
            style={styles.signIn}
            disabled={signingIn}
            onPress={onSignIn}
          >
            {signingIn ? <ActivityIndicator color="#fff" /> : <Text style={styles.signInText}>Sign in with Apple</Text>}
          </Pressable>
          <Pressable accessibilityLabel="Not now" style={styles.dismiss} onPress={onDismiss} disabled={signingIn}>
            <Text style={styles.dismissText}>Not now</Text>
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
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 24,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
  },
  body: {
    marginTop: 8,
    fontSize: 14,
    color: '#666',
    lineHeight: 20,
  },
  error: {
    marginTop: 12,
    fontSize: 13,
    color: '#e74c3c',
  },
  signIn: {
    marginTop: 20,
    backgroundColor: '#111',
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
  },
  signInText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '700',
  },
  dismiss: {
    marginTop: 10,
    paddingVertical: 12,
    alignItems: 'center',
  },
  dismissText: {
    color: '#666',
    fontSize: 14,
    fontWeight: '600',
  },
});
