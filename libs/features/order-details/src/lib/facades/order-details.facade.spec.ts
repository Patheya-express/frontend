import { TestBed } from '@angular/core/testing';
import { PaymentsCheckoutService } from '@patheya-express-frontend/core';
import { OrderDetailsFacade } from './order-details.facade';
import { OrderDetailsStore } from '../store/order-details.store';
import { OrderDetailsService } from '../services/order-details.service';

/** Payment/order lifecycle Rule 4 ("Continue with COD") — regression coverage for
 *  OrderDetailsFacade.continueWithCod. */
describe('OrderDetailsFacade.continueWithCod', () => {
  let switchToCodMock: jest.Mock;
  let loadOrderMock: jest.Mock;
  let facade: OrderDetailsFacade;

  beforeEach(() => {
    switchToCodMock = jest.fn();
    loadOrderMock = jest.fn().mockResolvedValue(undefined);

    TestBed.configureTestingModule({
      providers: [
        { provide: OrderDetailsService, useValue: { switchToCod: switchToCodMock } },
        { provide: OrderDetailsStore, useValue: { loadOrder: loadOrderMock } },
        { provide: PaymentsCheckoutService, useValue: { payForOrder: jest.fn() } },
      ],
    });

    facade = TestBed.inject(OrderDetailsFacade);
  });

  it('switches the order to COD and reloads it', async () => {
    switchToCodMock.mockResolvedValue({ id: 'order-1', paymentMode: 'COD' });

    const result = await facade.continueWithCod('order-1');

    expect(result).toBe(true);
    expect(switchToCodMock).toHaveBeenCalledWith('order-1');
    expect(loadOrderMock).toHaveBeenCalledWith('order-1');
  });

  it('returns false (without throwing) and still reloads the order when the backend rejects the switch — e.g. payment succeeded concurrently', async () => {
    switchToCodMock.mockRejectedValue(new Error('Conflict'));

    const result = await facade.continueWithCod('order-1');

    expect(result).toBe(false);
    expect(loadOrderMock).toHaveBeenCalledWith('order-1');
  });
});
