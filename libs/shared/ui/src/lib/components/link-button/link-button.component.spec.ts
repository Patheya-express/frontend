import { TestBed } from '@angular/core/testing';
import { LinkButtonComponent } from './link-button.component';

/**
 * Focused coverage for the `type` input added in UI-1G (see PrimaryButtonComponent's own spec for
 * the full rationale — all shared buttons inherit it via `ButtonBase`). Regression guard for
 * LinkButtonComponent's ~9 pre-UI-1G call sites, none of which set `type`.
 */
describe('LinkButtonComponent', () => {
  async function createFixture() {
    await TestBed.configureTestingModule({ imports: [LinkButtonComponent] }).compileComponents();
    const fixture = TestBed.createComponent(LinkButtonComponent);
    fixture.detectChanges();
    return fixture;
  }

  function nativeButton(root: HTMLElement): HTMLButtonElement {
    return root.querySelector('button') as HTMLButtonElement;
  }

  it('defaults to type="button" when not set', async () => {
    const fixture = await createFixture();
    expect(nativeButton(fixture.nativeElement).type).toBe('button');
  });

  it('renders type="submit" when explicitly set', async () => {
    const fixture = await createFixture();
    fixture.componentRef.setInput('type', 'submit');
    fixture.detectChanges();

    expect(nativeButton(fixture.nativeElement).type).toBe('submit');
  });

  it('disabled sets the native property and blocks buttonClick', async () => {
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

  it('loading disables the button, shows the spinner, and blocks buttonClick', async () => {
    const fixture = await createFixture();
    fixture.componentRef.setInput('loading', true);
    fixture.detectChanges();
    const root = fixture.nativeElement as HTMLElement;
    const btn = nativeButton(root);

    expect(btn.disabled).toBe(true);
    expect(root.querySelector('.mobile-spinner')).not.toBeNull();

    const clickSpy = jest.fn();
    fixture.componentInstance.buttonClick.subscribe(clickSpy);
    btn.click();
    expect(clickSpy).not.toHaveBeenCalled();
  });

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
