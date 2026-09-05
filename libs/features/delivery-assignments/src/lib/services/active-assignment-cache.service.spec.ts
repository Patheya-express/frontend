import type { DeliveryAssignmentResponseDto } from '@patheya-express-frontend/api-sdk';
import { ActiveAssignmentCacheService } from './active-assignment-cache.service';

function buildAssignment(
  overrides: Partial<DeliveryAssignmentResponseDto> = {},
): DeliveryAssignmentResponseDto {
  return {
    id: 'assignment-1',
    orderId: 'order-1',
    deliveryPartnerId: 'partner-1',
    status: 'ACCEPTED',
    assignedAt: '2026-01-01T00:00:00.000Z',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

describe('ActiveAssignmentCacheService', () => {
  let service: ActiveAssignmentCacheService;

  beforeEach(() => {
    window.localStorage.clear();
    service = new ActiveAssignmentCacheService();
  });

  it('returns null when nothing has been cached', async () => {
    expect(await service.read()).toBeNull();
  });

  it('writes and reads back the same assignment', async () => {
    const assignment = buildAssignment();
    await service.write(assignment);

    const result = await service.read();

    expect(result?.data).toEqual(assignment);
    expect(result?.isStale).toBe(false);
  });

  it('clears a cached assignment', async () => {
    await service.write(buildAssignment());
    await service.clear();

    expect(await service.read()).toBeNull();
  });

  it('does not store anything resembling an auth token or credential', async () => {
    await service.write(buildAssignment());

    const raw = window.localStorage.getItem(
      'patheya.cache.delivery.active-assignment',
    );
    expect(raw).not.toBeNull();
    expect(raw).not.toMatch(/accessToken|refreshToken|authorization|bearer/i);
  });
});
