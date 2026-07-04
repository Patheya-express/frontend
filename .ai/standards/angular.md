# Angular Development Standards

## 1. Purpose

This document defines the Angular development standards used across the Patheya Express frontend. Its purpose is to ensure consistency, maintainability, and alignment with the established frontend architecture across the repository.

## 2. Feature-First Organization

The frontend is organized around feature libraries. Each feature owns its components, feature service, Signal Store, facade, and models. Business capabilities belong inside feature libraries, while applications compose these features rather than implementing business logic directly.

This approach keeps features cohesive, easier to evolve, and aligned with the repository’s architectural boundaries.

## 3. Component Standards

Components should focus on presentation, remain small and reusable, and be strongly typed. They should receive state from facades and emit user interactions to the layer above. Components are responsible for rendering information and collecting user intent, not for implementing business behavior.

Components must never:

- Contain business logic
- Call HttpClient
- Call the Generated OpenAPI SDK
- Manage feature state directly
- Access browser storage directly

## 4. State Management

Angular Signals are the standard state management mechanism in this repository. Signal Stores own feature state, facades expose state and actions, and components consume state. Business logic belongs outside components so that state handling remains explicit, testable, and consistent with the architecture.

## 5. API Communication

All backend communication must use the Generated OpenAPI SDK. Feature Services are responsible for interacting with the SDK, while components must never communicate with the backend directly. This ensures a single, consistent integration layer for backend operations.

## 6. Shared Libraries

The repository uses shared libraries to hold reusable functionality rather than feature-specific logic.

| Library | Responsibility |
| --- | --- |
| api-sdk | Provides the generated API client and typed access to backend contracts. |
| auth | Contains authentication-related capabilities and shared access patterns for protected experiences. |
| core | Holds cross-cutting infrastructure, reusable abstractions, and foundational application services. |
| shared-models | Defines shared domain and transport models used across features and applications. |
| shared-ui | Provides reusable user interface building blocks for consistent presentation across the platform. |

## 7. Routing

Features should use lazy loading to keep the application scalable and responsive. Route guards protect authenticated and role-based pages, and routing should remain feature-oriented so that navigation reflects the domain structure of the application.

## 8. Dependency Injection

Angular dependency injection should be used consistently across the repository. Dependencies should be injected rather than manually created, and constructor injection should be preferred for clarity and maintainability.

## 9. Performance

Performance should be considered as part of architectural and implementation decisions. The repository favors Angular Signals, avoids unnecessary change detection work, lazy loads features, reuses Shared UI components, and minimizes unnecessary rendering to keep the frontend efficient.

## 10. AI Guidance

AI agents should reuse existing features, reuse Shared UI, extend existing Signal Stores and facades, and follow the documented frontend architecture. They should never bypass architectural layers, never introduce direct HttpClient usage, and always preserve feature boundaries.

## 11. Relationship with PADK

Project context is documented under .ai/context. Frontend architecture is documented under .ai/architecture. Development workflows are documented under .ai/workflows. This document defines Angular-specific repository standards only and should be used alongside those documents rather than as a replacement for them.

## Preferred Angular Features

The repository adopts modern Angular features as the default approach.

Prefer:

- Standalone Components
- Angular Signals
- `inject()` where appropriate
- Built-in control flow (`@if`, `@for`, `@switch`)
- Lazy-loaded routes
- Strongly typed Reactive Forms
- ChangeDetectionStrategy.OnPush

Avoid introducing legacy Angular patterns unless required for compatibility.

## Nx Library Standards

Business functionality belongs inside feature libraries.

Shared functionality belongs inside shared libraries.

Applications compose features but should not implement reusable business logic.

Avoid creating dependencies that violate established Nx library boundaries.

## Application Identity

Each application must present a distinct product identity.

Applications may share infrastructure, authentication architecture, design tokens, and reusable UI components.

Applications must not share user journeys, branding, navigation, or layouts where those differ by user role.

The customer, restaurant, delivery, and admin applications should feel like independent products built on a common platform.

## Shared Component Criteria

Before adding a component to shared/ui, confirm that:

- It represents a reusable presentation pattern.
- It is not specific to a single business feature.
- It contains no business logic.
- It depends only on inputs and outputs.
- It is likely to be reused by multiple applications or features.

Do not move components to shared/ui simply to reduce duplication. Reuse should be driven by common behavior and structure, not by identical-looking code alone.