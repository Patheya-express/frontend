import { TestBed } from '@angular/core/testing';
import type { MenuItemResponseDto } from '@patheya-express-frontend/api-sdk';
import { CartFacade } from '@patheya-express-frontend/cart';
import { HapticsService } from '@patheya-express-frontend/core';
import { MenuItemCustomizationSheetComponent } from './menu-item-customization-sheet.component';

/**
 * P0 price-invariant regression coverage ("Chicken 65 ₹220 → ₹22000" CTA bug).
 *
 * Root cause (confirmed against the live API and database — see the investigation report):
 * `MenuItem.basePrice`, `MenuItemVariant.price`, and `MenuItemAddonOption.price` are Prisma
 * `Decimal` columns, and Prisma serializes `Decimal` to JSON as a STRING (e.g. `"220"`), even
 * though the generated SDK types declare them as `number`. `unitPrice()`/`addonsTotal()` used to
 * do raw `+`/`+=` arithmetic on these values, so real API responses hit JavaScript string
 * concatenation instead of addition: `0 + "0"` => `"00"`, `"220" + "00"` => `"22000"`, and the
 * final `* quantity` coerces that string to the number 22000.
 *
 * Fixtures here deliberately use STRING price values (exactly like the real API, and exactly what
 * the earlier, now-superseded version of this suite got wrong by using clean `number` fixtures
 * that masked the bug). `as any` on the fixture builders mirrors the established pattern for this
 * same SDK-type-vs-runtime mismatch in payments-checkout.service.spec.ts.
 */
describe('MenuItemCustomizationSheetComponent — price invariants (realistic string API values)', () => {
  interface OptionTemplate {
    id: string;
    name: string;
    price: string;
  }

  interface AddonTemplate {
    id: string;
    name: string;
    minSelection: number;
    maxSelection: number;
    options: OptionTemplate[];
  }

  function buildItem(overrides: {
    basePrice: string;
    variants?: Array<{ id: string; name: string; price: string; isDefault: boolean }>;
    addons?: AddonTemplate[];
  }): MenuItemResponseDto {
    return {
      id: 'item-1',
      categoryId: 'cat-1',
      name: 'Chicken 65',
      isAvailable: true,
      isVegan: false,
      isVegetarian: false,
      basePrice: overrides.basePrice,
      variants: (overrides.variants ?? []).map((v) => ({
        id: v.id,
        menuItemId: 'item-1',
        name: v.name,
        price: v.price,
        isDefault: v.isDefault,
      })),
      addons: (overrides.addons ?? []).map((a) => ({
        id: a.id,
        menuItemId: 'item-1',
        name: a.name,
        minSelection: a.minSelection,
        maxSelection: a.maxSelection,
        options: a.options.map((o) => ({ id: o.id, addonId: a.id, name: o.name, price: o.price, isAvailable: true })),
      })),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any;
  }

  async function createComponent(item: MenuItemResponseDto) {
    await TestBed.configureTestingModule({
      imports: [MenuItemCustomizationSheetComponent],
      providers: [
        { provide: CartFacade, useValue: { addItem: jest.fn().mockResolvedValue(undefined) } },
        {
          provide: HapticsService,
          useValue: {
            selectionChanged: jest.fn().mockResolvedValue(undefined),
            action: jest.fn().mockResolvedValue(undefined),
          },
        },
      ],
    }).compileComponents();

    const fixture = TestBed.createComponent(MenuItemCustomizationSheetComponent);
    fixture.componentRef.setInput('item', item);
    fixture.componentRef.setInput('restaurantName', 'Test Restaurant');
    fixture.detectChanges();
    return fixture;
  }

  type Harness = {
    unitPrice(): number;
    addonsTotal(): number;
    totalPrice(): number;
    increaseQuantity(): void;
    toggleOption(addonId: string, optionId: string, maxSelection: number): void;
    selectVariant(variantId: string): void;
  };

  function harness(fixture: { componentInstance: unknown }): Harness {
    return fixture.componentInstance as unknown as Harness;
  }

  it('1. base price as string "220", quantity 1 → 220', async () => {
    const fixture = await createComponent(buildItem({ basePrice: '220' }));
    const c = harness(fixture);

    expect(c.unitPrice()).toBe(220);
    expect(typeof c.unitPrice()).toBe('number');
    expect(c.totalPrice()).toBe(220);
  });

  it('2. base price string "220" + zero-price addon string "0" → 220 (not 22000)', async () => {
    const item = buildItem({
      basePrice: '220',
      addons: [
        {
          id: 'addon-1',
          name: 'Spice Level',
          minSelection: 1,
          maxSelection: 1,
          options: [
            { id: 'opt-mild', name: 'Mild', price: '0' },
            { id: 'opt-medium', name: 'Medium', price: '0' },
            { id: 'opt-hot', name: 'Hot', price: '0' },
          ],
        },
      ],
    });
    const fixture = await createComponent(item);
    const c = harness(fixture);

    c.toggleOption('addon-1', 'opt-mild', 1);
    fixture.detectChanges();

    expect(c.addonsTotal()).toBe(0);
    expect(typeof c.addonsTotal()).toBe('number');
    expect(c.totalPrice()).toBe(220);
  });

  it('3. quantity 2 → 440', async () => {
    const fixture = await createComponent(buildItem({ basePrice: '220' }));
    const c = harness(fixture);

    c.increaseQuantity();
    fixture.detectChanges();

    expect(c.totalPrice()).toBe(440);
  });

  it('4. quantity 3 → 660', async () => {
    const fixture = await createComponent(buildItem({ basePrice: '220' }));
    const c = harness(fixture);

    c.increaseQuantity();
    c.increaseQuantity();
    fixture.detectChanges();

    expect(c.totalPrice()).toBe(660);
  });

  it('5. paid addon "10", quantity 1 → 230', async () => {
    const item = buildItem({
      basePrice: '220',
      addons: [
        {
          id: 'addon-1',
          name: 'Extra Sauce',
          minSelection: 0,
          maxSelection: 1,
          options: [{ id: 'opt-sauce', name: 'Extra Sauce', price: '10' }],
        },
      ],
    });
    const fixture = await createComponent(item);
    const c = harness(fixture);

    c.toggleOption('addon-1', 'opt-sauce', 1);
    fixture.detectChanges();

    expect(c.totalPrice()).toBe(230);
  });

  it('6. paid addon "10", quantity 2 → 460', async () => {
    const item = buildItem({
      basePrice: '220',
      addons: [
        {
          id: 'addon-1',
          name: 'Extra Sauce',
          minSelection: 0,
          maxSelection: 1,
          options: [{ id: 'opt-sauce', name: 'Extra Sauce', price: '10' }],
        },
      ],
    });
    const fixture = await createComponent(item);
    const c = harness(fixture);

    c.toggleOption('addon-1', 'opt-sauce', 1);
    c.increaseQuantity();
    fixture.detectChanges();

    expect(c.totalPrice()).toBe(460);
  });

  it('7. multiple string addons ("30" + "20" + "40") on base "249" → 339, quantity 2 → 678', async () => {
    const item = buildItem({
      basePrice: '249',
      addons: [
        {
          id: 'addon-extras',
          name: 'Extras',
          minSelection: 0,
          maxSelection: 3,
          options: [
            { id: 'opt-raita', name: 'Raita', price: '30' },
            { id: 'opt-egg', name: 'Boiled Egg', price: '20' },
            { id: 'opt-gravy', name: 'Extra Gravy', price: '40' },
          ],
        },
      ],
    });
    const fixture = await createComponent(item);
    const c = harness(fixture);

    c.toggleOption('addon-extras', 'opt-raita', 3);
    c.toggleOption('addon-extras', 'opt-egg', 3);
    c.toggleOption('addon-extras', 'opt-gravy', 3);
    fixture.detectChanges();
    expect(c.totalPrice()).toBe(339);

    c.increaseQuantity();
    fixture.detectChanges();
    expect(c.totalPrice()).toBe(678);
  });

  it('8. variant price as string "249" → unit price 249', async () => {
    const item = buildItem({
      basePrice: '249',
      variants: [
        { id: 'variant-half', name: 'Half', price: '249', isDefault: true },
        { id: 'variant-full', name: 'Full', price: '449', isDefault: false },
      ],
    });
    const fixture = await createComponent(item);
    const c = harness(fixture);

    expect(c.unitPrice()).toBe(249);
    expect(typeof c.unitPrice()).toBe('number');
    expect(c.totalPrice()).toBe(249);
  });

  it('9. variant price string "249" + addon string "10" → 259', async () => {
    const item = buildItem({
      basePrice: '249',
      variants: [{ id: 'variant-half', name: 'Half', price: '249', isDefault: true }],
      addons: [
        {
          id: 'addon-1',
          name: 'Extras',
          minSelection: 0,
          maxSelection: 1,
          options: [{ id: 'opt-raita', name: 'Raita', price: '10' }],
        },
      ],
    });
    const fixture = await createComponent(item);
    const c = harness(fixture);

    c.toggleOption('addon-1', 'opt-raita', 1);
    fixture.detectChanges();

    expect(c.totalPrice()).toBe(259);
  });

  it('10. required zero-price customization never string-concatenates (regression for the exact reported bug)', async () => {
    const item = buildItem({
      basePrice: '220',
      addons: [
        {
          id: 'addon-1',
          name: 'Spice Level',
          minSelection: 1,
          maxSelection: 1,
          options: [
            { id: 'opt-mild', name: 'Mild', price: '0' },
            { id: 'opt-medium', name: 'Medium', price: '0' },
            { id: 'opt-hot', name: 'Hot', price: '0' },
          ],
        },
      ],
    });
    const fixture = await createComponent(item);
    const c = harness(fixture);

    c.toggleOption('addon-1', 'opt-medium', 1);
    fixture.detectChanges();

    // The exact regression: this used to be the string "22000" coerced to the number 22000.
    expect(c.totalPrice()).toBe(220);
    expect(c.totalPrice()).not.toBe(22000);
  });
});
