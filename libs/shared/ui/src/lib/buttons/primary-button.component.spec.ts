import { TestBed } from '@angular/core/testing';
import { PrimaryButtonComponent } from './primary-button.component';

/**
 * Focused coverage for the `type` input added in UI-1G — the capability that unblocks reusing
 * this component as a `<form>`'s native submit button. Every existing call site (~11 before
 * UI-1G) never set `type` at all and relied on the previously-hardcoded `type="button"`; the
 * "defaults to button" tests here are the regression guard proving that behavior is unchanged.
 */
describe('PrimaryButtonComponent', () => {
  async function createFixture() {
    await TestBed.configureTestingModule({ imports: [PrimaryButtonComponent] }).compileComponents();
    const fixture = TestBed.createComponent(PrimaryButtonComponent);
    fixture.detectChanges();
    return fixture;
  }

  function nativeButton(root: HTMLElement): HTMLButtonElement {
    return root.querySelector('button') as HTMLButtonElement;
  }

  describe('type', () => {
    it('defaults to type="button" when not set (regression — every pre-UI-1G call site relies on this)', async () => {
      const fixture = await createFixture();
      expect(nativeButton(fixture.nativeElement).type).toBe('button');
    });

    it('renders type="submit" when explicitly set', async () => {
      const fixture = await createFixture();
      fixture.componentRef.setInput('type', 'submit');
      fixture.detectChanges();

      expect(nativeButton(fixture.nativeElement).type).toBe('submit');
    });
  });

  describe('disabled', () => {
    it('sets the native disabled property and blocks buttonClick', async () => {
      const fixture = await createFixture();
      fixture.componentRef.setInput('disabled', true);
      fixture.detectChanges();

      const clickSpy = jest.fn();
      fixture.componentInstance.buttonClick.subscribe(clickSpy);
      const btn = nativeButton(fixture.nativeElement);

      expect(btn.disabled).toBe(true);
      btn.click();
      expect(clickSpy).not.toHaveBeenCalled();
    });
  });

  describe('loading', () => {
    it('sets aria-busy, disables the button, shows the spinner, and blocks buttonClick', async () => {
      const fixture = await createFixture();
      fixture.componentRef.setInput('loading', true);
      fixture.detectChanges();
      const root = fixture.nativeElement as HTMLElement;
      const btn = nativeButton(root);

      expect(btn.getAttribute('aria-busy')).toBe('true');
      expect(btn.disabled).toBe(true);
      expect(root.querySelector('.mobile-spinner')).not.toBeNull();

      const clickSpy = jest.fn();
      fixture.componentInstance.buttonClick.subscribe(clickSpy);
      btn.click();
      expect(clickSpy).not.toHaveBeenCalled();
    });
  });

  describe('click behavior', () => {
    it('emits buttonClick when enabled, regardless of type', async () => {
      const fixture = await createFixture();
      fixture.componentRef.setInput('type', 'submit');
      fixture.detectChanges();

      const clickSpy = jest.fn();
      fixture.componentInstance.buttonClick.subscribe(clickSpy);
      nativeButton(fixture.nativeElement).click();

      expect(clickSpy).toHaveBeenCalledTimes(1);
    });
  });
});
