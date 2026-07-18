import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { EmptyStateComponent, SkeletonComponent } from '@patheya-express-frontend/ui';
import { CustomerSupportFacade } from '../../facades/customer-support.facade';

@Component({
  selector: 'lib-faq-page',
  standalone: true,
  imports: [RouterLink, SkeletonComponent, EmptyStateComponent],
  templateUrl: './faq-page.component.html',
  styleUrl: './faq-page.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FaqPageComponent implements OnInit {
  protected readonly facade = inject(CustomerSupportFacade);
  protected readonly expandedId = signal<string | null>(null);

  protected readonly categories = computed(() => {
    const set = new Set(this.facade.faqs().map((faq) => faq.category));
    return Array.from(set);
  });

  ngOnInit(): void {
    void this.facade.loadFaqs();
  }

  protected faqsForCategory(category: string) {
    return this.facade.faqs().filter((faq) => faq.category === category);
  }

  protected toggle(id: string): void {
    this.expandedId.set(this.expandedId() === id ? null : id);
  }
}
