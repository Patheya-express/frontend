# Frontend Architecture

## 1. Purpose

This document defines the frontend architecture used throughout the Patheya Express platform. It serves as the architectural reference for implementing all frontend features and for guiding decisions that affect the structure, boundaries, and responsibilities of the application.

## 2. Architectural Overview

The frontend follows a layered architecture with clear separation of responsibilities. User interactions are handled in the presentation layer and flow through progressively lower layers for state access, service orchestration, and backend communication.

User Interaction

↓

Component

↓

Facade

↓

Signal Store

↓

Feature Service

↓

Generated OpenAPI SDK

↓

Backend API

Each layer has a distinct responsibility. The presentation layer handles interaction and display, while the lower layers manage data access, orchestration, and API communication.

## 3. Layer Responsibilities

| Layer | Responsibility |
| --- | --- |
| Component | Presents UI, handles user interaction, and delegates behavior to higher-level abstractions. |
| Facade | Exposes feature capabilities to components and coordinates access to state and services. |
| Signal Store | Owns feature state and exposes state transitions in a structured and predictable manner. |
| Feature Service | Encapsulates feature-specific orchestration and coordination of backend-facing operations. |
| Generated OpenAPI SDK | Provides the typed interface for backend API communication and acts as the canonical contract layer. |
| Backend API | Delivers the underlying business data and operations required by the frontend. |

## 4. Dependency Direction

Dependencies always flow downward through the architecture. Higher layers may depend on lower layers, while lower layers must never depend on higher layers. Components must never access services or the Generated SDK directly. Signal Stores must not contain presentation logic, and Feature Services must not contain UI logic.

The intended direction is:

Component

↓

Facade

↓

Signal Store

↓

Feature Service

↓

Generated SDK

This rule ensures that architectural boundaries remain intact and that business logic, state ownership, and presentation remain appropriately separated.

## 5. Feature Organization

The application is organized into feature libraries. Each feature owns its own API integration, service, Signal Store, facade, models, and components. Features should remain cohesive and independent so that they can evolve without creating unnecessary coupling across the system.

Shared functionality belongs in shared libraries rather than inside individual features. This keeps the feature layer focused on capabilities that are specific to a domain or user journey.

Each feature library should remain independently testable and should expose a clear public API to consuming applications.

## 6. Application Responsibilities

Applications are responsible for composing feature libraries into complete user experiences.

Applications should:

- Configure routing
- Configure providers
- Compose feature libraries
- Configure application-wide services

Applications should not:

- Contain business logic
- Implement reusable features
- Duplicate shared functionality

Business capabilities belong inside feature libraries.

Reusable capabilities belong inside shared libraries.

## 6. Shared Libraries

| Library | Responsibility |
| --- | --- |
| api-sdk | Provides the generated API client and shared access to backend contracts. |
| auth | Contains authentication-related capabilities and shared access patterns for protected experiences. |
| core | Holds cross-cutting application primitives, shared infrastructure, and foundational abstractions. |
| shared-models | Defines shared domain and transport models reused across features and applications. |
| shared-ui | Provides reusable user interface building blocks that can be consumed by multiple features. |

## 7. State Management

Application state is managed using Angular Signals. Signal Stores own feature state and expose it in a structured manner for use by facades and components. Components consume state and emit user-driven actions, while the state layer remains responsible for the underlying state model and transitions.

This approach keeps state ownership explicit and supports a clear distinction between presentation and application state.

## 8. Routing Strategy

Applications use lazy-loaded feature routes to keep the application scalable and responsive. Features own their relevant routes where appropriate, and route guards protect authenticated and role-based experiences. Navigation should remain feature-oriented so that domain boundaries are visible in the structure of the application.

## 9. User Interface Architecture

Presentation is built from reusable Shared UI components. Feature-specific user interface elements belong within the owning feature library, while shared UI remains reusable across the platform. The application shell provides the common layout, navigation, header, footer, and overall user experience.

Shared UI should remain presentation-focused and should not contain business logic.

## 10. Design Principles

The architecture is guided by the following principles:

- Layered architecture
- Separation of concerns
- Feature isolation
- Reusability
- Strong typing
- Composition over inheritance
- Enterprise scalability
- Production readiness

## 11. AI Guidance

AI agents should follow the documented architecture, extend existing features before creating new abstractions, reuse Shared UI, and reuse existing Signal Stores and facades where appropriate. They should never bypass architectural layers, never introduce HttpClient, never call the Generated SDK from Components, and always preserve feature boundaries.

## 12. Relationship with PADK

Project context is documented under .ai/context. Coding conventions are documented under .ai/standards. Development workflows are documented under .ai/workflows. This document defines only the frontend architecture and should be used as the reference for structural decisions in the repository.
