import React, { useMemo } from 'react';
import { ActivityIndicator, Modal, Pressable, StyleSheet, Text, View } from 'react-native';

import { haptics } from '../haptics';
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
            style={({ pressed }) => [styles.signIn, pressed && styles.signInPressed]}
            disabled={signingIn}
            onPress={() => {
              haptics.selection();
              onSignIn();
            }}
          >
            {signingIn ? (
              <ActivityIndicator color={colors.labelOnColor} />
            ) : (
              <Text style={styles.signInText}>Sign in with Apple</Text>
            )}
          </Pressable>
          <Pressable
            accessibilityLabel="Not now"
            style={({ pressed }) => [styles.dismiss, pressed && styles.dismissPressed]}
            onPress={onDismiss}
            disabled={signingIn}
          >
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
      ...type.title3,
    },
    body: {
      ...type.subheadline,
      marginTop: 8,
      color: colors.secondaryLabel,
    },
    error: {
      ...type.footnote,
      marginTop: 12,
      color: colors.nope,
    },
    signIn: {
      marginTop: 20,
      backgroundColor: colors.tint,
      borderRadius: 10,
      paddingVertical: 14,
      alignItems: 'center',
    },
    signInPressed: {
      opacity: 0.85,
    },
    signInText: {
      ...type.headline,
      color: colors.labelOnColor,
    },
    dismiss: {
      marginTop: 10,
      paddingVertical: 12,
      alignItems: 'center',
    },
    dismissPressed: {
      opacity: 0.55,
    },
    dismissText: {
      ...type.subheadline,
      color: colors.secondaryLabel,
      fontWeight: '600',
    },
  });
}
