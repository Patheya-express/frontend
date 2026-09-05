import { scrubSensitiveData } from './sensitive-data';

describe('scrubSensitiveData', () => {
  it('redacts an Authorization header', () => {
    expect(scrubSensitiveData({ Authorization: 'Bearer abc.def.ghi' })).toEqual({
      Authorization: '[redacted]',
    });
  });

  it('redacts an access token under any common casing', () => {
    expect(scrubSensitiveData({ accessToken: 'x', access_token: 'y' })).toEqual({
      accessToken: '[redacted]',
      access_token: '[redacted]',
    });
  });

  it('redacts a refresh token', () => {
    expect(scrubSensitiveData({ refreshToken: 'x' })).toEqual({ refreshToken: '[redacted]' });
  });

  it('redacts a push token', () => {
    expect(scrubSensitiveData({ pushToken: 'x', deviceToken: 'y' })).toEqual({
      pushToken: '[redacted]',
      deviceToken: '[redacted]',
    });
  });

  it('redacts GPS coordinates', () => {
    expect(scrubSensitiveData({ latitude: 12.9, longitude: 77.6, coords: {} })).toEqual({
      latitude: '[redacted]',
      longitude: '[redacted]',
      coords: '[redacted]',
    });
  });

  it('redacts payment-related fields', () => {
    expect(
      scrubSensitiveData({ razorpayOrderId: 'x', cardNumber: 'y', cvv: 'z', password: 'p', otp: '1234' }),
    ).toEqual({
      razorpayOrderId: '[redacted]',
      cardNumber: '[redacted]',
      cvv: '[redacted]',
      password: '[redacted]',
      otp: '[redacted]',
    });
  });

  it('recurses into nested objects', () => {
    expect(scrubSensitiveData({ user: { id: '1', accessToken: 'x' } })).toEqual({
      user: { id: '1', accessToken: '[redacted]' },
    });
  });

  it('recurses into arrays', () => {
    expect(scrubSensitiveData([{ password: 'x' }, { id: '2' }])).toEqual([
      { password: '[redacted]' },
      { id: '2' },
    ]);
  });

  it('leaves non-sensitive fields untouched', () => {
    const value = { event: 'order_placed', app: 'customer', count: 3 };
    expect(scrubSensitiveData(value)).toEqual(value);
  });

  it('passes primitives through unchanged', () => {
    expect(scrubSensitiveData('hello')).toBe('hello');
    expect(scrubSensitiveData(42)).toBe(42);
    expect(scrubSensitiveData(null)).toBeNull();
    expect(scrubSensitiveData(undefined)).toBeUndefined();
  });

  it('truncates past the max recursion depth rather than hanging on deep/circular-shaped input', () => {
    const deep = { a: { b: { c: { d: { e: { secret: 'x' } } } } } };
    const result = scrubSensitiveData(deep) as Record<string, unknown>;
    // Depth 0=a,1=b,2=c,3=d,4=e -> at depth 4 the whole remaining value is truncated wholesale.
    expect(JSON.stringify(result)).toContain('[truncated]');
  });
});
