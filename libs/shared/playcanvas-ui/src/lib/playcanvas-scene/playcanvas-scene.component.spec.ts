import { Component } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { MobilePlatformService } from '@patheya-express-frontend/core';
import type { ExperienceConfig, ExperienceRegistry, RuntimeStatus } from '@patheya-express-frontend/playcanvas-runtime';
import { PlaycanvasSceneComponent } from './playcanvas-scene.component';

type StatusListener = (status: RuntimeStatus) => void;

const mockRuntimeInstances: MockRuntime[] = [];

class MockRuntime {
  readonly create = jest.fn(async () => {
    this.currentStatus = { state: 'paused' };
  });
  readonly start = jest.fn(() => (this.currentStatus = { state: 'running' }));
  readonly pause = jest.fn(() => (this.currentStatus = { state: 'paused' }));
  readonly resume = jest.fn(() => (this.currentStatus = { state: 'running' }));
  readonly resize = jest.fn();
  readonly destroy = jest.fn(() => (this.currentStatus = { state: 'destroyed' }));
  private currentStatus: RuntimeStatus = { state: 'idle' };

  constructor(readonly options: { onStatusChange?: StatusListener; experienceRegistry?: ExperienceRegistry } = {}) {
    mockRuntimeInstances.push(this);
  }

  getStatus(): RuntimeStatus {
    return this.currentStatus;
  }

  // test helper, not part of the real PlaycanvasRuntime API
  emitStatus(status: RuntimeStatus): void {
    this.currentStatus = status;
    this.options.onStatusChange?.(status);
  }
}

jest.mock('@patheya-express-frontend/playcanvas-runtime', () => ({
  PlaycanvasRuntime: jest.fn().mockImplementation((options) => new MockRuntime(options)),
}));

class MockResizeObserver {
  static instances: MockResizeObserver[] = [];
  observe = jest.fn();
  disconnect = jest.fn();
  constructor(public callback: ResizeObserverCallback) {
    MockResizeObserver.instances.push(this);
  }
}

class MockIntersectionObserver {
  static instances: MockIntersectionObserver[] = [];
  observe = jest.fn();
  disconnect = jest.fn();
  constructor(public callback: IntersectionObserverCallback) {
    MockIntersectionObserver.instances.push(this);
  }
}

const demoConfig: ExperienceConfig = { experienceType: 'technical-demo', quality: 'medium', reducedMotion: false };

@Component({
  standalone: true,
  imports: [PlaycanvasSceneComponent],
  template: `<lib-playcanvas-scene [config]="config" [ariaLabel]="ariaLabel" [experienceRegistry]="experienceRegistry" (statusChange)="onStatusChange($event)" />`,
})
class HostComponent {
  config: ExperienceConfig = demoConfig;
  ariaLabel: string | undefined;
  experienceRegistry: ExperienceRegistry | undefined;
  onStatusChange = jest.fn();
}

describe('PlaycanvasSceneComponent', () => {
  let fixture: ComponentFixture<HostComponent>;
  let mobilePlatform: { onResume: jest.Mock; onPause: jest.Mock };

  beforeEach(async () => {
    mockRuntimeInstances.length = 0;
    MockResizeObserver.instances.length = 0;
    MockIntersectionObserver.instances.length = 0;
    (globalThis as unknown as { ResizeObserver: unknown }).ResizeObserver = MockResizeObserver;
    (globalThis as unknown as { IntersectionObserver: unknown }).IntersectionObserver = MockIntersectionObserver;

    mobilePlatform = { onResume: jest.fn(), onPause: jest.fn() };

    await TestBed.configureTestingModule({
      imports: [HostComponent],
      providers: [{ provide: MobilePlatformService, useValue: mobilePlatform }],
    }).compileComponents();

    fixture = TestBed.createComponent(HostComponent);
  });

  async function afterViewInitSettled(): Promise<void> {
    fixture.detectChanges();
    await fixture.whenStable();
  }

  it('renders the canvas as aria-hidden when no accessible label is provided', async () => {
    await afterViewInitSettled();

    const canvas = fixture.debugElement.query(By.css('canvas')).nativeElement as HTMLCanvasElement;
    expect(canvas.getAttribute('aria-hidden')).toBe('true');
    expect(canvas.getAttribute('role')).toBeNull();
  });

  it('exposes role="img" and the label instead of aria-hidden when ariaLabel is set', async () => {
    fixture.componentInstance.ariaLabel = 'Rotating preview of the technical demo scene';
    await afterViewInitSettled();

    const canvas = fixture.debugElement.query(By.css('canvas')).nativeElement as HTMLCanvasElement;
    expect(canvas.getAttribute('aria-hidden')).toBeNull();
    expect(canvas.getAttribute('role')).toBe('img');
    expect(canvas.getAttribute('aria-label')).toBe('Rotating preview of the technical demo scene');
  });

  it('creates exactly one runtime and starts it once creation settles as visible', async () => {
    await afterViewInitSettled();

    expect(mockRuntimeInstances).toHaveLength(1);
    const runtime = mockRuntimeInstances[0];
    expect(runtime.create).toHaveBeenCalledWith(
      expect.any(HTMLCanvasElement),
      expect.objectContaining({ experienceType: 'technical-demo', quality: 'medium' }),
    );
    expect(runtime.start).toHaveBeenCalledTimes(1);
  });

  it('forwards an [experienceRegistry] input straight through to the runtime, unmodified', async () => {
    const customRegistry = {} as ExperienceRegistry;
    fixture.componentInstance.experienceRegistry = customRegistry;

    await afterViewInitSettled();

    expect(mockRuntimeInstances[0].options.experienceRegistry).toBe(customRegistry);
  });

  it('leaves experienceRegistry undefined when no custom registry is provided, so the runtime falls back to its own default', async () => {
    await afterViewInitSettled();

    expect(mockRuntimeInstances[0].options.experienceRegistry).toBeUndefined();
  });

  it('registers native pause/resume with MobilePlatformService instead of a duplicate lifecycle service', async () => {
    await afterViewInitSettled();

    expect(mobilePlatform.onPause).toHaveBeenCalledTimes(1);
    expect(mobilePlatform.onResume).toHaveBeenCalledTimes(1);
  });

  it('pauses when the canvas leaves the viewport and resumes when it returns, without destroying the runtime', async () => {
    await afterViewInitSettled();
    const runtime = mockRuntimeInstances[0];
    const observer = MockIntersectionObserver.instances[0];

    observer.callback([{ isIntersecting: false } as IntersectionObserverEntry], observer as unknown as IntersectionObserver);
    expect(runtime.pause).toHaveBeenCalledTimes(1);
    expect(runtime.destroy).not.toHaveBeenCalled();

    observer.callback([{ isIntersecting: true } as IntersectionObserverEntry], observer as unknown as IntersectionObserver);
    expect(runtime.resume).toHaveBeenCalledTimes(1);
  });

  it('forwards resize-observer size changes to the runtime', async () => {
    await afterViewInitSettled();
    const runtime = mockRuntimeInstances[0];
    const observer = MockResizeObserver.instances[0];

    observer.callback(
      [{ contentRect: { width: 320.4, height: 240.6 } } as ResizeObserverEntry],
      observer as unknown as ResizeObserver,
    );

    expect(runtime.resize).toHaveBeenCalledWith(320, 241);
  });

  it('propagates runtime status changes to the status output', async () => {
    await afterViewInitSettled();
    const runtime = mockRuntimeInstances[0];
    const errorStatus: RuntimeStatus = { state: 'error', message: 'WebGL2 unavailable' };

    runtime.emitStatus(errorStatus);

    expect(fixture.componentInstance.onStatusChange).toHaveBeenCalledWith(errorStatus);
  });

  it('destroys the runtime and disconnects both observers on destroy', async () => {
    await afterViewInitSettled();
    const runtime = mockRuntimeInstances[0];
    const resizeObserver = MockResizeObserver.instances[0];
    const intersectionObserver = MockIntersectionObserver.instances[0];

    fixture.destroy();

    expect(runtime.destroy).toHaveBeenCalledTimes(1);
    expect(resizeObserver.disconnect).toHaveBeenCalledTimes(1);
    expect(intersectionObserver.disconnect).toHaveBeenCalledTimes(1);
  });
});
