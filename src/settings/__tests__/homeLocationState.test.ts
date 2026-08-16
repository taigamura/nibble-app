import AsyncStorage from '@react-native-async-storage/async-storage';

import { HomeLocationState } from '../homeLocationState';

describe('HomeLocationState', () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
  });

  it('resolves to null before anything is persisted', async () => {
    await expect(new HomeLocationState().get()).resolves.toBeNull();
  });

  it('persists a set point across separate instances (survives app restart)', async () => {
    await new HomeLocationState().set({ lat: 35.6812, lng: 139.7671 });

    await expect(new HomeLocationState().get()).resolves.toEqual({ lat: 35.6812, lng: 139.7671 });
  });

  it('clear un-sets a previously stored point', async () => {
    const state = new HomeLocationState();
    await state.set({ lat: 1, lng: 2 });

    await state.clear();

    await expect(state.get()).resolves.toBeNull();
  });

  it('falls back to null when the stored JSON is corrupt', async () => {
    await AsyncStorage.setItem('nibble.homeLocation.v1', '{not valid json');

    await expect(new HomeLocationState().get()).resolves.toBeNull();
  });

  it('falls back to null when the stored value is missing coordinates', async () => {
    await AsyncStorage.setItem('nibble.homeLocation.v1', JSON.stringify({ lat: 35.6 }));

    await expect(new HomeLocationState().get()).resolves.toBeNull();
  });

  it('rejects non-finite coordinates as invalid', async () => {
    await AsyncStorage.setItem('nibble.homeLocation.v1', JSON.stringify({ lat: 'x', lng: null }));

    await expect(new HomeLocationState().get()).resolves.toBeNull();
  });

  it('keeps separate storage keys independent', async () => {
    await new HomeLocationState('key-a').set({ lat: 10, lng: 20 });

    await expect(new HomeLocationState('key-b').get()).resolves.toBeNull();
  });
});
