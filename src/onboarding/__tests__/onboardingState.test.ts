import AsyncStorage from '@react-native-async-storage/async-storage';

import { OnboardingState } from '../onboardingState';

describe('OnboardingState', () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
  });

  it('reports not onboarded before anything is persisted', async () => {
    await expect(new OnboardingState().hasOnboarded()).resolves.toBe(false);
  });

  it('persists completion across separate instances (survives app restart)', async () => {
    await new OnboardingState().setOnboarded();

    await expect(new OnboardingState().hasOnboarded()).resolves.toBe(true);
  });

  it('clear() sends the next launch back to onboarding', async () => {
    const state = new OnboardingState();
    await state.setOnboarded();

    await state.clear();

    await expect(state.hasOnboarded()).resolves.toBe(false);
  });

  it('keeps separate storage keys independent', async () => {
    await new OnboardingState('key-a').setOnboarded();

    await expect(new OnboardingState('key-b').hasOnboarded()).resolves.toBe(false);
  });
});
