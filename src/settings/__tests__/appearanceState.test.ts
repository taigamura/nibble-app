import AsyncStorage from '@react-native-async-storage/async-storage';

import { AppearanceState } from '../appearanceState';

describe('AppearanceState', () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
  });

  it("defaults to 'system' before anything is persisted", async () => {
    await expect(new AppearanceState().get()).resolves.toBe('system');
  });

  it('persists a chosen preference across separate instances (survives app restart)', async () => {
    await new AppearanceState().set('dark');

    await expect(new AppearanceState().get()).resolves.toBe('dark');
  });

  it("falls back to 'system' when the stored value is corrupt/unknown", async () => {
    await AsyncStorage.setItem('nibble.appearance.v1', 'sepia');

    await expect(new AppearanceState().get()).resolves.toBe('system');
  });

  it('keeps separate storage keys independent', async () => {
    await new AppearanceState('key-a').set('light');

    await expect(new AppearanceState('key-b').get()).resolves.toBe('system');
  });
});
