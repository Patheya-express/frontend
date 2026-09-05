import { Geolocation } from '@capacitor/geolocation';
import { GeolocationService } from './geolocation.service';

jest.mock('@capacitor/geolocation', () => ({
  Geolocation: {
    checkPermissions: jest.fn(),
    requestPermissions: jest.fn(),
    watchPosition: jest.fn(),
    clearWatch: jest.fn(),
  },
}));

const mockedGeolocation = jest.mocked(Geolocation);

describe('GeolocationService.ensurePermission', () => {
  let service: GeolocationService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new GeolocationService();
  });

  it('returns true without prompting when already granted', async () => {
    mockedGeolocation.checkPermissions.mockResolvedValue({
      location: 'granted',
      coarseLocation: 'granted',
    });

    await expect(service.ensurePermission()).resolves.toBe(true);
    expect(mockedGeolocation.requestPermissions).not.toHaveBeenCalled();
  });

  it('returns false without prompting when already denied', async () => {
    mockedGeolocation.checkPermissions.mockResolvedValue({
      location: 'denied',
      coarseLocation: 'denied',
    });

    await expect(service.ensurePermission()).resolves.toBe(false);
    expect(mockedGeolocation.requestPermissions).not.toHaveBeenCalled();
  });

  it('prompts when the decision is still pending, and honors the result', async () => {
    mockedGeolocation.checkPermissions.mockResolvedValue({
      location: 'prompt',
      coarseLocation: 'prompt',
    });
    mockedGeolocation.requestPermissions.mockResolvedValue({
      location: 'granted',
      coarseLocation: 'granted',
    });

    await expect(service.ensurePermission()).resolves.toBe(true);
    expect(mockedGeolocation.requestPermissions).toHaveBeenCalled();
  });

  it('proceeds (returns true) when requestPermissions is unimplemented, as on web', async () => {
    mockedGeolocation.checkPermissions.mockResolvedValue({
      location: 'prompt',
      coarseLocation: 'prompt',
    });
    mockedGeolocation.requestPermissions.mockRejectedValue(
      new Error('Not implemented on web.'),
    );

    await expect(service.ensurePermission()).resolves.toBe(true);
  });

  it('falls through to requestPermissions when checkPermissions itself throws', async () => {
    mockedGeolocation.checkPermissions.mockRejectedValue(
      new Error('Permissions API not available in this browser'),
    );
    mockedGeolocation.requestPermissions.mockResolvedValue({
      location: 'granted',
      coarseLocation: 'granted',
    });

    await expect(service.ensurePermission()).resolves.toBe(true);
  });
});

describe('GeolocationService watch lifecycle', () => {
  let service: GeolocationService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new GeolocationService();
  });

  it('clears any prior watch before starting a new one', async () => {
    mockedGeolocation.watchPosition
      .mockResolvedValueOnce('watch-1')
      .mockResolvedValueOnce('watch-2');

    await service.startWatching(jest.fn(), jest.fn());
    await service.startWatching(jest.fn(), jest.fn());

    expect(mockedGeolocation.clearWatch).toHaveBeenCalledWith({
      id: 'watch-1',
    });
  });

  it('forwards each position fix to onPosition', async () => {
    let capturedCallback: (position: any, error: any) => void = () => undefined;
    mockedGeolocation.watchPosition.mockImplementation(
      async (_options, callback) => {
        capturedCallback = callback;
        return 'watch-1';
      },
    );

    const onPosition = jest.fn();
    await service.startWatching(onPosition, jest.fn());

    const position = { coords: { latitude: 12.9, longitude: 77.6 } };
    capturedCallback(position, null);

    expect(onPosition).toHaveBeenCalledWith(position);
  });

  it('reports a plugin error as "unavailable" when permission is still granted (a transient/hardware issue)', async () => {
    let capturedCallback: (position: any, error: any) => void = () => undefined;
    mockedGeolocation.watchPosition.mockImplementation(
      async (_options, callback) => {
        capturedCallback = callback;
        return 'watch-1';
      },
    );
    mockedGeolocation.checkPermissions.mockResolvedValue({
      location: 'granted',
      coarseLocation: 'granted',
    });

    const onError = jest.fn();
    await service.startWatching(jest.fn(), onError);
    capturedCallback(null, new Error('GPS unavailable'));
    await Promise.resolve();
    await Promise.resolve();

    expect(onError).toHaveBeenCalledWith('unavailable');
  });

  it('reports a watch error as "permission-denied" when a re-check confirms permission was actually denied/revoked', async () => {
    let capturedCallback: (position: any, error: any) => void = () => undefined;
    mockedGeolocation.watchPosition.mockImplementation(
      async (_options, callback) => {
        capturedCallback = callback;
        return 'watch-1';
      },
    );
    mockedGeolocation.checkPermissions.mockResolvedValue({
      location: 'denied',
      coarseLocation: 'denied',
    });

    const onError = jest.fn();
    await service.startWatching(jest.fn(), onError);
    capturedCallback(null, new Error('Permission denied'));
    await Promise.resolve();
    await Promise.resolve();

    expect(onError).toHaveBeenCalledWith('permission-denied');
  });

  it('falls back to "unavailable" if the permission re-check itself throws (system location services off)', async () => {
    let capturedCallback: (position: any, error: any) => void = () => undefined;
    mockedGeolocation.watchPosition.mockImplementation(
      async (_options, callback) => {
        capturedCallback = callback;
        return 'watch-1';
      },
    );
    mockedGeolocation.checkPermissions.mockRejectedValue(
      new Error('Location services disabled'),
    );

    const onError = jest.fn();
    await service.startWatching(jest.fn(), onError);
    capturedCallback(null, new Error('unavailable'));
    await Promise.resolve();
    await Promise.resolve();

    expect(onError).toHaveBeenCalledWith('unavailable');
  });

  it('stopWatching clears the active watch and is a no-op if called again', async () => {
    mockedGeolocation.watchPosition.mockResolvedValue('watch-1');
    await service.startWatching(jest.fn(), jest.fn());

    await service.stopWatching();
    expect(mockedGeolocation.clearWatch).toHaveBeenCalledWith({
      id: 'watch-1',
    });

    mockedGeolocation.clearWatch.mockClear();
    await service.stopWatching();
    expect(mockedGeolocation.clearWatch).not.toHaveBeenCalled();
  });
});
