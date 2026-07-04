import { ChangeDetectionStrategy, Component, EventEmitter, Input, OnInit, Output, inject } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import type { MenuCategoryResponseDto } from '@patheya-express-frontend/api-sdk';
import { MenuManagementFacade } from '../../facades/menu-management.facade';

@Component({
  selector: 'lib-category-form',
  standalone: true,
  imports: [ReactiveFormsModule],
  templateUrl: './category-form.component.html',
  styleUrl: './category-form.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CategoryFormComponent implements OnInit {
  /** Omit to create a new category; provide to edit an existing one. */
  @Input() category?: MenuCategoryResponseDto;
  @Output() closed = new EventEmitter<void>();

  private readonly facade = inject(MenuManagementFacade);
  private readonly formBuilder = inject(FormBuilder);

  protected readonly form = this.formBuilder.group({
    name: ['', Validators.required],
    description: [''],
  });

  ngOnInit(): void {
    if (this.category) {
      this.form.patchValue({
        name: this.category.name,
        description: this.category.description ?? '',
      });
    }
  }

  protected get isProcessing(): boolean {
    return this.facade.processingId() === (this.category?.id ?? 'new-category');
  }

  protected async submit(): Promise<void> {
    if (this.form.invalid || this.isProcessing) {
      return;
    }

    const { name, description } = this.form.getRawValue();

    if (this.category) {
      await this.facade.updateCategory(this.category.id, { name: name ?? undefined, description: description || undefined });
    } else {
      await this.facade.createCategory(name ?? '', description || undefined);
    }

    this.closed.emit();
  }

  protected cancel(): void {
    this.closed.emit();
  }
}
