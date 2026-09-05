import { Location } from '@angular/common';
import { ApplicationInitStatus } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { App } from '@capacitor/app';
import { Keyboard } from '@capacitor/keyboard';
import { SplashScreen } from '@capacitor/splash-screen';
import { StatusBar } from '@capacitor/status-bar';
import { MobilePlatformService } from './mobile-platform.service';
import { provideMobilePlatform } from './mobile.providers';

jest.mock('@capacitor/keyboard', () => ({
  Keyboard: { setResizeMode: jest.fn() },
  KeyboardResize: { Body: 'body' },
}));
jest.mock('@capacitor/status-bar', () => ({
  StatusBar: { setStyle: jest.fn(), setBackgroundColor: jest.fn() },
  Style: { Light: 'LIGHT' },
}));
jest.mock('@capacitor/splash-screen', () => ({
  SplashScreen: { hide: jest.fn() },
}));
jest.mock('@capacitor/app', () => ({
  App: {
    addListener: jest.fn().mockResolvedValue({ remove: jest.fn() }),
    exitApp: jest.fn(),
  },
}));

const mockedKeyboard = jest.mocked(Keyboard);
const mockedStatusBar = jest.mocked(StatusBar);
const mockedSplashScreen = jest.mocked(SplashScreen);
const mockedApp = jest.mocked(App);

function configureTestBed(mobilePlatform: Partial<MobilePlatformService>) {
  TestBed.configureTestingModule({
    providers: [
      provideMobilePlatform(),
      { provide: Location, useValue: { back: jest.fn() } },
      { provide: Router, useValue: { navigateByUrl: jest.fn() } },
      {
        provide: MobilePlatformService,
        useValue: {
          isNative: () => true,
          isAndroid: () => true,
          ...mobilePlatform,
        },
      },
    ],
  });
}

/**
 * Regression coverage for the Phase 0.1 bootstrap defect: `@capacitor/keyboard@8.0.5`'s Android
 * implementation rejects `setResizeMode` unconditionally (it's a native no-op stub), and that
 * rejection used to propagate out of this `provideAppInitializer` and reject
 * `bootstrapApplication()` itself — leaving `<app-root>` permanently empty on every Android launch.
 */
describe('provideMobilePlatform', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedKeyboard.setResizeMode.mockResolvedValue(undefined);
    mockedStatusBar.setStyle.mockResolvedValue(undefined);
    mockedStatusBar.setBackgroundColor.mockResolvedValue(undefined);
    mockedSplashScreen.hide.mockResolvedValue(undefined);
    mockedApp.addListener.mockResolvedValue({ remove: jest.fn() } as never);
  });

  afterEach(() => {
    TestBed.resetTestingModule();
  });

  it('is a no-op on web — never touches native plugins, and bootstrap completes', async () => {
    configureTestBed({ isNative: () => false });

    await expect(
      TestBed.inject(ApplicationInitStatus).donePromise,
    ).resolves.toBeUndefined();

    expect(mockedKeyboard.setResizeMode).not.toHaveBeenCalled();
  });

  it('runs every native convenience call, in order, when they all succeed', async () => {
    configureTestBed({});

    await TestBed.inject(ApplicationInitStatus).donePromise;

    expect(mockedKeyboard.setResizeMode).toHaveBeenCalledWith({ mode: 'body' });
    expect(mockedStatusBar.setStyle).toHaveBeenCalledWith({ style: 'LIGHT' });
    expect(mockedStatusBar.setBackgroundColor).toHaveBeenCalledWith({
      color: '#ffffff',
    });
    expect(mockedSplashScreen.hide).toHaveBeenCalled();
  });

  it('does not reject bootstrap when Keyboard.setResizeMode rejects, as it does on Android with @capacitor/keyboard 8.0.5', async () => {
    mockedKeyboard.setResizeMode.mockRejectedValue(
      new Error('Not implemented'),
    );
    configureTestBed({});

    await expect(
      TestBed.inject(ApplicationInitStatus).donePromise,
    ).resolves.toBeUndefined();
  });

  it('continues running the rest of the initializer after Keyboard.setResizeMode rejects', async () => {
    mockedKeyboard.setResizeMode.mockRejectedValue(
      new Error('Not implemented'),
    );
    configureTestBed({});

    await TestBed.inject(ApplicationInitStatus).donePromise;

    expect(mockedStatusBar.setStyle).toHaveBeenCalled();
    expect(mockedStatusBar.setBackgroundColor).toHaveBeenCalled();
    expect(mockedSplashScreen.hide).toHaveBeenCalled();
  });

  it('tolerates any single optional native call rejecting, one at a time', async () => {
    for (const rejecting of [
      mockedStatusBar.setStyle,
      mockedStatusBar.setBackgroundColor,
      mockedSplashScreen.hide,
    ]) {
      jest.clearAllMocks();
      mockedKeyboard.setResizeMode.mockResolvedValue(undefined);
      mockedStatusBar.setStyle.mockResolvedValue(undefined);
      mockedStatusBar.setBackgroundColor.mockResolvedValue(undefined);
      mockedSplashScreen.hide.mockResolvedValue(undefined);
      rejecting.mockRejectedValue(new Error('platform quirk'));

      configureTestBed({});

      await expect(
        TestBed.inject(ApplicationInitStatus).donePromise,
      ).resolves.toBeUndefined();
      TestBed.resetTestingModule();
    }
  });

  // This initializer has no async step that's "required" the way the native plugin calls above
  // are optional — everything awaited is one of those best-effort convenience calls. What *can*
  // still fail for real is DI/config itself (e.g. a required token misconfigured); that must keep
  // surfacing as a genuine bootstrap failure rather than being swallowed by the same fix.
  it('does not swallow a genuine failure unrelated to an optional native call', async () => {
    configureTestBed({
      isNative: () => {
        throw new Error('unrelated configuration failure');
      },
    });

    await expect(
      TestBed.inject(ApplicationInitStatus).donePromise,
    ).rejects.toThrow('unrelated configuration failure');
  });
});

/**
 * The appUrlOpen listener itself is registered unconditionally (see `provideMobilePlatform`
 * above); what changed for M1 is that it now defers to `validateDeepLink` (mobile-security)
 * before ever calling `router.navigateByUrl`. These tests cover that wiring specifically —
 * `validateDeepLink`'s own allow-list logic is unit-tested in
 * `libs/shared/mobile-security/src/lib/deep-link/deep-link-validator.spec.ts`.
 */
describe('appUrlOpen deep-link handling', () => {
  function getAppUrlOpenHandler(): (event: { url: string }) => void {
    // `App.addListener` is overloaded per event name, which makes `mock.calls` a union of
    // per-overload tuples that TS won't let us search across with a single `===` — this mock
    // only cares that calls are `[eventName, handler]` pairs, so that's what it's cast to.
    const calls = mockedApp.addListener.mock.calls as unknown as Array<
      [string, (event: { url: string }) => void]
    >;
    const call = calls.find(([eventName]) => eventName === 'appUrlOpen');
    if (!call) {
      throw new Error('appUrlOpen listener was never registered');
    }
    return call[1];
  }

  beforeEach(() => {
    jest.clearAllMocks();
    mockedKeyboard.setResizeMode.mockResolvedValue(undefined);
    mockedStatusBar.setStyle.mockResolvedValue(undefined);
    mockedStatusBar.setBackgroundColor.mockResolvedValue(undefined);
    mockedSplashScreen.hide.mockResolvedValue(undefined);
    mockedApp.addListener.mockResolvedValue({ remove: jest.fn() } as never);
  });

  afterEach(() => {
    TestBed.resetTestingModule();
  });

  it('navigates the router for an allow-listed deep link', async () => {
    const navigateByUrl = jest.fn();
    TestBed.configureTestingModule({
      providers: [
        provideMobilePlatform(),
        { provide: Location, useValue: { back: jest.fn() } },
        { provide: Router, useValue: { navigateByUrl } },
        {
          provide: MobilePlatformService,
          useValue: { isNative: () => true, isAndroid: () => true },
        },
      ],
    });

    await TestBed.inject(ApplicationInitStatus).donePromise;
    getAppUrlOpenHandler()({ url: 'patheyaexpress://restaurants/abc123' });

    expect(navigateByUrl).toHaveBeenCalledWith('/restaurants/abc123');
  });

  it('does not navigate when the URL fails validation — e.g. an external URL', async () => {
    const navigateByUrl = jest.fn();
    TestBed.configureTestingModule({
      providers: [
        provideMobilePlatform(),
        { provide: Location, useValue: { back: jest.fn() } },
        { provide: Router, useValue: { navigateByUrl } },
        {
          provide: MobilePlatformService,
          useValue: { isNative: () => true, isAndroid: () => true },
        },
      ],
    });

    await TestBed.inject(ApplicationInitStatus).donePromise;
    getAppUrlOpenHandler()({ url: 'https://evil.example/restaurants/abc123' });

    expect(navigateByUrl).not.toHaveBeenCalled();
  });
});
