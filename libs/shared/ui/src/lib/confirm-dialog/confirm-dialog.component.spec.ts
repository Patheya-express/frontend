import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ConfirmDialogComponent } from './confirm-dialog.component';

/**
 * Coverage for the shared confirm dialog — the primitive ~24+ delete/cancel/logout-style
 * confirmations reuse (UI-1B), plus PickupPhotoDialogComponent (UI-1D), which is the first
 * consumer of the `[dialogContent]` slot and `confirmDisabled` input added for it. Both additions
 * are exercised here for genericity: every "existing behavior" test below uses only the
 * pre-UI-1D API (no `confirmDisabled`, no projected content) and must keep passing unchanged,
 * proving the additions are additive rather than a redesign.
 */
describe('ConfirmDialogComponent', () => {
  /** Flushes the leave-animation effect() in the constructor — same pattern as
   *  live-orders-floating-tracker.component.spec.ts's own `settle` (Angular's effect scheduler
   *  runs on its own microtask/tick, not synchronously with the signal write that triggered it). */
  async function settle(fixture: { detectChanges(): void; whenStable(): Promise<void> }, rounds = 4): Promise<void> {
    for (let i = 0; i < rounds; i++) {
      TestBed.tick();
      fixture.detectChanges();
      await Promise.resolve();
    }
    await fixture.whenStable();
    fixture.detectChanges();
  }

  function panel(root: HTMLElement): HTMLElement | null {
    return root.querySelector('.confirm-dialog');
  }
  function cancelBtn(root: HTMLElement): HTMLButtonElement {
    return root.querySelector('.confirm-dialog-cancel') as HTMLButtonElement;
  }
  function confirmBtn(root: HTMLElement): HTMLButtonElement {
    return root.querySelector('.confirm-dialog-confirm') as HTMLButtonElement;
  }

  // Every fixture's root is appended to document.body and torn down afterward — focus assertions
  // (`document.activeElement`, Tab-key simulation) are unreliable in jsdom for elements that were
  // never actually inserted into the live document.
  const mountedRoots: HTMLElement[] = [];

  afterEach(() => {
    for (const root of mountedRoots.splice(0)) {
      root.remove();
    }
  });

  async function createFixture() {
    await TestBed.configureTestingModule({ imports: [ConfirmDialogComponent] }).compileComponents();
    const fixture = TestBed.createComponent(ConfirmDialogComponent);
    document.body.appendChild(fixture.nativeElement);
    mountedRoots.push(fixture.nativeElement);
    fixture.componentRef.setInput('open', true);
    await settle(fixture);
    return fixture;
  }

  describe('existing behavior (pre-UI-1D API only)', () => {
    it('renders the default title and no message when none is given', async () => {
      const fixture = await createFixture();
      const root = fixture.nativeElement as HTMLElement;

      expect(panel(root)?.querySelector('.confirm-dialog-title')?.textContent).toContain('Are you sure?');
      expect(panel(root)?.querySelector('.confirm-dialog-message')).toBeNull();
    });

    it('renders a custom title and message', async () => {
      const fixture = await createFixture();
      fixture.componentRef.setInput('title', 'Delete this item?');
      fixture.componentRef.setInput('message', 'This cannot be undone.');
      await settle(fixture);
      const root = fixture.nativeElement as HTMLElement;

      expect(panel(root)?.querySelector('.confirm-dialog-title')?.textContent).toContain('Delete this item?');
      expect(panel(root)?.querySelector('.confirm-dialog-message')?.textContent).toContain('This cannot be undone.');
    });

    it('emits confirmed when the confirm button is clicked', async () => {
      const fixture = await createFixture();
      const confirmedSpy = jest.fn();
      fixture.componentInstance.confirmed.subscribe(confirmedSpy);

      confirmBtn(fixture.nativeElement).click();

      expect(confirmedSpy).toHaveBeenCalledTimes(1);
    });

    it('emits cancelled when the cancel button is clicked', async () => {
      const fixture = await createFixture();
      const cancelledSpy = jest.fn();
      fixture.componentInstance.cancelled.subscribe(cancelledSpy);

      cancelBtn(fixture.nativeElement).click();

      expect(cancelledSpy).toHaveBeenCalledTimes(1);
    });

    it('busy disables both actions and suppresses both events', async () => {
      const fixture = await createFixture();
      fixture.componentRef.setInput('busy', true);
      await settle(fixture);
      const root = fixture.nativeElement as HTMLElement;

      expect(cancelBtn(root).disabled).toBe(true);
      expect(confirmBtn(root).disabled).toBe(true);

      const confirmedSpy = jest.fn();
      const cancelledSpy = jest.fn();
      fixture.componentInstance.confirmed.subscribe(confirmedSpy);
      fixture.componentInstance.cancelled.subscribe(cancelledSpy);

      confirmBtn(root).click();
      cancelBtn(root).click();

      expect(confirmedSpy).not.toHaveBeenCalled();
      expect(cancelledSpy).not.toHaveBeenCalled();
    });

    it('applies the is-danger modifier only for tone="danger"', async () => {
      const fixture = await createFixture();
      fixture.componentRef.setInput('tone', 'danger');
      await settle(fixture);

      expect(confirmBtn(fixture.nativeElement).classList.contains('is-danger')).toBe(true);
    });
  });

  describe('confirmDisabled (new in UI-1D)', () => {
    it('defaults to false — confirm is enabled with no other inputs set', async () => {
      const fixture = await createFixture();
      expect(confirmBtn(fixture.nativeElement).disabled).toBe(false);
    });

    it('disables only the confirm button when true — cancel stays independently enabled', async () => {
      const fixture = await createFixture();
      fixture.componentRef.setInput('confirmDisabled', true);
      await settle(fixture);
      const root = fixture.nativeElement as HTMLElement;

      expect(confirmBtn(root).disabled).toBe(true);
      expect(cancelBtn(root).disabled).toBe(false);
    });

    it('re-enables confirm when set back to false', async () => {
      const fixture = await createFixture();
      fixture.componentRef.setInput('confirmDisabled', true);
      await settle(fixture);
      fixture.componentRef.setInput('confirmDisabled', false);
      await settle(fixture);

      expect(confirmBtn(fixture.nativeElement).disabled).toBe(false);
    });

    it('busy=true still disables confirm even when confirmDisabled=false', async () => {
      const fixture = await createFixture();
      fixture.componentRef.setInput('busy', true);
      fixture.componentRef.setInput('confirmDisabled', false);
      await settle(fixture);

      expect(confirmBtn(fixture.nativeElement).disabled).toBe(true);
    });

    it('busy and confirmDisabled are independent — cancel is controlled by busy only', async () => {
      const fixture = await createFixture();
      // confirmDisabled alone must never touch cancel.
      fixture.componentRef.setInput('confirmDisabled', true);
      await settle(fixture);
      const root = fixture.nativeElement as HTMLElement;
      expect(cancelBtn(root).disabled).toBe(false);

      const cancelledSpy = jest.fn();
      fixture.componentInstance.cancelled.subscribe(cancelledSpy);
      cancelBtn(root).click();
      expect(cancelledSpy).toHaveBeenCalledTimes(1);
    });

    it('does not emit confirmed while confirmDisabled is true', async () => {
      const fixture = await createFixture();
      fixture.componentRef.setInput('confirmDisabled', true);
      await settle(fixture);

      const confirmedSpy = jest.fn();
      fixture.componentInstance.confirmed.subscribe(confirmedSpy);
      // The native `disabled` attribute already blocks a real click; this exercises onConfirm()'s
      // own internal guard directly too, the same defense-in-depth `busy` already had.
      confirmBtn(fixture.nativeElement).click();

      expect(confirmedSpy).not.toHaveBeenCalled();
    });
  });

  describe('[dialogContent] projection (new in UI-1D)', () => {
    @Component({
      standalone: true,
      imports: [ConfirmDialogComponent],
      template: `
        <lib-confirm-dialog
          [open]="true"
          title="With content"
          message="Plain message stays too."
          (confirmed)="confirmedCount = confirmedCount + 1"
          (cancelled)="cancelledCount = cancelledCount + 1"
        >
          <p dialogContent class="projected-marker">Projected body content</p>
        </lib-confirm-dialog>
      `,
    })
    class HostWithContentComponent {
      confirmedCount = 0;
      cancelledCount = 0;
    }

    async function createHostFixture() {
      await TestBed.configureTestingModule({ imports: [HostWithContentComponent] }).compileComponents();
      const fixture = TestBed.createComponent(HostWithContentComponent);
      document.body.appendChild(fixture.nativeElement);
      mountedRoots.push(fixture.nativeElement);
      await settle(fixture);
      return fixture;
    }

    it('renders projected content between the message and the action row', async () => {
      const fixture = await createHostFixture();
      const root = fixture.nativeElement as HTMLElement;
      const el = panel(root);
      const message = el?.querySelector('.confirm-dialog-message');
      const marker = el?.querySelector('.projected-marker');
      const actions = el?.querySelector('.confirm-dialog-actions');

      expect(message).not.toBeNull();
      expect(marker).not.toBeNull();
      expect(actions).not.toBeNull();
      expect(marker?.textContent).toContain('Projected body content');
      // DOM order: message, then projected content, then the action row.
      expect(message?.compareDocumentPosition(marker as Node)).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
      expect(marker?.compareDocumentPosition(actions as Node)).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
    });

    it('does not alter confirm/cancel behavior when content is projected', async () => {
      const fixture = await createHostFixture();
      const root = fixture.nativeElement as HTMLElement;

      confirmBtn(root).click();
      cancelBtn(root).click();

      expect(fixture.componentInstance.confirmedCount).toBe(1);
      expect(fixture.componentInstance.cancelledCount).toBe(1);
    });

    it('a consumer without projected content renders no stray content (existing consumers unaffected)', async () => {
      const fixture = await createFixture();
      fixture.componentRef.setInput('message', 'Plain message only.');
      await settle(fixture);
      const root = fixture.nativeElement as HTMLElement;

      expect(panel(root)?.querySelector('.projected-marker')).toBeNull();
      expect(panel(root)?.textContent).toContain('Plain message only.');
    });
  });

  describe('accessibility', () => {
    it('has alertdialog role and aria-modal', async () => {
      const fixture = await createFixture();
      const el = panel(fixture.nativeElement);

      expect(el?.getAttribute('role')).toBe('alertdialog');
      expect(el?.getAttribute('aria-modal')).toBe('true');
    });

    it('uses the title as the accessible name', async () => {
      const fixture = await createFixture();
      fixture.componentRef.setInput('title', 'Remove favorite?');
      await settle(fixture);

      expect(panel(fixture.nativeElement)?.getAttribute('aria-label')).toBe('Remove favorite?');
    });

    it('moves initial focus into the dialog panel on open', async () => {
      const fixture = await createFixture();
      expect(document.activeElement).toBe(panel(fixture.nativeElement));
    });

    it('traps Tab so it cycles forward from the last action back to the first', async () => {
      const fixture = await createFixture();
      const root = fixture.nativeElement as HTMLElement;
      confirmBtn(root).focus();

      confirmBtn(root).dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true }));

      expect(document.activeElement).toBe(cancelBtn(root));
    });

    it('traps Shift+Tab so it wraps backward from the first action to the last', async () => {
      const fixture = await createFixture();
      const root = fixture.nativeElement as HTMLElement;
      cancelBtn(root).focus();

      cancelBtn(root).dispatchEvent(
        new KeyboardEvent('keydown', { key: 'Tab', shiftKey: true, bubbles: true, cancelable: true }),
      );

      expect(document.activeElement).toBe(confirmBtn(root));
    });

    it('emits cancelled on Escape when open and not busy', async () => {
      const fixture = await createFixture();
      const cancelledSpy = jest.fn();
      fixture.componentInstance.cancelled.subscribe(cancelledSpy);

      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));

      expect(cancelledSpy).toHaveBeenCalledTimes(1);
    });

    it('does not emit cancelled on Escape while busy', async () => {
      const fixture = await createFixture();
      fixture.componentRef.setInput('busy', true);
      await settle(fixture);

      const cancelledSpy = jest.fn();
      fixture.componentInstance.cancelled.subscribe(cancelledSpy);

      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));

      expect(cancelledSpy).not.toHaveBeenCalled();
    });

    // Focus restoration is NOT implemented on ConfirmDialogComponent itself (it lives on
    // OverlayStackService, used only by DialogService/ConfirmDialogOverlayComponent) — no test for
    // it here, per "do not invent new accessibility behavior".
  });
});
