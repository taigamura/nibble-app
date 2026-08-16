import React, { useMemo } from 'react';
import { ActivityIndicator, Modal, Pressable, StyleSheet, Text, View } from 'react-native';

import { useTheme } from '../ThemeProvider';
import { type Palette, type TypeRamp } from '../theme';

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
  const { colors, type } = useTheme();
  const styles = useMemo(() => makeStyles(colors, type), [colors, type]);
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
            {signingIn ? (
              <ActivityIndicator color={colors.labelOnColor} />
            ) : (
              <Text style={styles.signInText}>Sign in with Apple</Text>
            )}
          </Pressable>
          <Pressable accessibilityLabel="Not now" style={styles.dismiss} onPress={onDismiss} disabled={signingIn}>
            <Text style={styles.dismissText}>Not now</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

function makeStyles(colors: Palette, type: TypeRamp) {
  return StyleSheet.create({
    backdrop: {
      flex: 1,
      backgroundColor: colors.scrim,
      justifyContent: 'flex-end',
    },
    sheet: {
      backgroundColor: colors.background,
      borderTopLeftRadius: 20,
      borderTopRightRadius: 20,
      padding: 24,
    },
    title: {
      fontSize: 20,
      fontWeight: '700',
      color: colors.label,
    },
    body: {
      marginTop: 8,
      fontSize: 14,
      color: colors.secondaryLabel,
      lineHeight: 20,
    },
    error: {
      marginTop: 12,
      fontSize: 13,
      color: colors.nope,
    },
    signIn: {
      marginTop: 20,
      backgroundColor: colors.tint,
      borderRadius: 10,
      paddingVertical: 14,
      alignItems: 'center',
    },
    signInText: {
      color: colors.labelOnColor,
      fontSize: 15,
      fontWeight: '700',
    },
    dismiss: {
      marginTop: 10,
      paddingVertical: 12,
      alignItems: 'center',
    },
    dismissText: {
      color: colors.secondaryLabel,
      fontSize: 14,
      fontWeight: '600',
    },
  });
}
