import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import {
  Router,
  type ActivatedRouteSnapshot,
  type RouterStateSnapshot,
  type UrlTree,
} from '@angular/router';
import {
  AuthFacade,
  authGuard,
  guestGuard,
} from '@patheya-express-frontend/auth';
import { ToastService } from '@patheya-express-frontend/ui';
import { routes } from './app.routes';
import { deliveryPartnerGuard } from './delivery-partner.guard';
import { DELIVERY_PARTNER_BRAND_NAME } from './brand';

const PUBLIC_PATHS = [
  'auth/login',
  'auth/forgot-password',
  'auth/reset-password',
  'partner/join',
  '',
  '**',
];

describe('Delivery app routes', () => {
  it('opens on login and sends unknown URLs to login (login-first)', () => {
    expect(routes.find((r) => r.path === '')).toMatchObject({
      redirectTo: 'auth/login',
      pathMatch: 'full',
    });
    expect(routes.find((r) => r.path === '**')).toMatchObject({
      redirectTo: 'auth/login',
    });
  });

  it('protects every non-public route with authGuard and the delivery-partner role guard', () => {
    const protectedRoutes = routes.filter(
      (r) => !PUBLIC_PATHS.includes(r.path ?? ''),
    );
    expect(protectedRoutes.length).toBeGreaterThan(5);
    for (const route of protectedRoutes) {
      expect(route.canActivate?.[0]).toBe(authGuard);
      expect(route.canActivate).toContain(deliveryPartnerGuard);
    }
  });

  it('keeps login, password recovery and registration guest-only and branded', () => {
    for (const path of [
      'auth/login',
      'auth/forgot-password',
      'auth/reset-password',
      'partner/join',
    ]) {
      expect(routes.find((r) => r.path === path)?.canActivate).toEqual([
        guestGuard,
      ]);
    }
    expect(
      routes.find((r) => r.path === 'auth/login')?.data?.['brandName'],
    ).toBe(DELIVERY_PARTNER_BRAND_NAME);
    expect(DELIVERY_PARTNER_BRAND_NAME).toBe('Patheya Delivery Partner');
  });
});

describe('deliveryPartnerGuard', () => {
  let logout: jest.Mock;
  let showSnackbar: jest.Mock;

  function run(
    user: { role: string } | null,
    authenticated: boolean,
  ): Promise<boolean | UrlTree> {
    logout = jest.fn().mockResolvedValue(undefined);
    showSnackbar = jest.fn();
    TestBed.configureTestingModule({
      providers: [
        {
          provide: AuthFacade,
          useValue: {
            user: signal(user),
            isAuthenticated: signal(authenticated),
            logout,
          },
        },
        { provide: ToastService, useValue: { showSnackbar } },
      ],
    });
    return TestBed.runInInjectionContext(
      () =>
        deliveryPartnerGuard(
          {} as ActivatedRouteSnapshot,
          {} as RouterStateSnapshot,
        ) as Promise<boolean | UrlTree>,
    );
  }

  afterEach(() => TestBed.resetTestingModule());

  it('lets a delivery partner through', async () => {
    expect(await run({ role: 'DELIVERY_PARTNER' }, true)).toBe(true);
    expect(logout).not.toHaveBeenCalled();
  });

  it('defers to authGuard for a signed-out visitor (no logout, no message)', async () => {
    expect(await run(null, false)).toBe(true);
    expect(logout).not.toHaveBeenCalled();
    expect(showSnackbar).not.toHaveBeenCalled();
  });

  it('signs out any other role, explains why and sends them to login', async () => {
    const result = await run({ role: 'CUSTOMER' }, true);

    expect(logout).toHaveBeenCalled();
    expect(showSnackbar).toHaveBeenCalledWith(
      expect.objectContaining({
        message: expect.stringContaining('for delivery partners'),
      }),
    );
    expect(TestBed.inject(Router).serializeUrl(result as UrlTree)).toBe(
      '/auth/login',
    );
  });
});
