import * as Location from 'expo-location';

import { ExpoLocationProvider } from '../location';

jest.mock('expo-location', () => ({
  requestForegroundPermissionsAsync: jest.fn(),
  getCurrentPositionAsync: jest.fn(),
  getForegroundPermissionsAsync: jest.fn(),
}));

const mockedRequestPermissions = Location.requestForegroundPermissionsAsync as jest.Mock;
const mockedGetPosition = Location.getCurrentPositionAsync as jest.Mock;
const mockedGetPermissions = Location.getForegroundPermissionsAsync as jest.Mock;

describe('ExpoLocationProvider', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  it('resolves the device coordinates when permission is granted', async () => {
    mockedRequestPermissions.mockResolvedValue({ status: 'granted' });
    mockedGetPosition.mockResolvedValue({ coords: { latitude: 35.66, longitude: 139.7 } });

    const location = await new ExpoLocationProvider().getCurrentLocation();

    expect(location).toEqual({ lat: 35.66, lng: 139.7 });
  });

  it('degrades gracefully to null when permission is denied', async () => {
    mockedRequestPermissions.mockResolvedValue({ status: 'denied' });

    const location = await new ExpoLocationProvider().getCurrentLocation();

    expect(location).toBeNull();
    expect(mockedGetPosition).not.toHaveBeenCalled();
  });

  it('degrades gracefully to null when the position read throws', async () => {
    mockedRequestPermissions.mockResolvedValue({ status: 'granted' });
    mockedGetPosition.mockRejectedValue(new Error('GPS unavailable'));

    const location = await new ExpoLocationProvider().getCurrentLocation();

    expect(location).toBeNull();
  });

  it('getPermissionStatus resolves granted without prompting', async () => {
    mockedGetPermissions.mockResolvedValue({ status: 'granted' });

    const status = await new ExpoLocationProvider().getPermissionStatus();

    expect(status).toBe('granted');
    expect(mockedRequestPermissions).not.toHaveBeenCalled();
  });

  it('getPermissionStatus resolves undetermined', async () => {
    mockedGetPermissions.mockResolvedValue({ status: 'undetermined' });

    const status = await new ExpoLocationProvider().getPermissionStatus();

    expect(status).toBe('undetermined');
  });

  it('getPermissionStatus resolves denied', async () => {
    mockedGetPermissions.mockResolvedValue({ status: 'denied' });

    const status = await new ExpoLocationProvider().getPermissionStatus();

    expect(status).toBe('denied');
  });

  it('getPermissionStatus degrades gracefully to denied when the read throws', async () => {
    mockedGetPermissions.mockRejectedValue(new Error('unavailable'));

    const status = await new ExpoLocationProvider().getPermissionStatus();

    expect(status).toBe('denied');
  });
});
