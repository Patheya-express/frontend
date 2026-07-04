# Frontend Technology Stack

## 1. Purpose

This document defines the approved frontend technology stack for the Patheya Express frontend repository. All new frontend development should use the technologies documented here unless an architectural decision explicitly changes them.

## 2. Frontend Framework

| Technology | Purpose |
| --- | --- |
| Angular | Primary frontend framework for building responsive, component-based web applications. |
| TypeScript | Primary language for application code, providing static typing and stronger developer tooling. |
| Angular Signals | State and reactivity mechanism used for efficient, modern component and state management patterns. |
| Standalone Components | Component model used to simplify module organization and improve composition in Angular applications. |
| Angular Router | Navigation and route management framework for application views and lazy-loaded features. |
| SCSS | Styling preprocessor used for structured, maintainable component and application-level styles. |
| Capacitor  | Enables packaging Angular applications for Android and iOS while sharing the same frontend codebase. |

## 3. Workspace & Development

| Technology | Purpose |
| --- | --- |
| Nx Workspace | Monorepo orchestration tool used to manage applications, libraries, and shared tooling. |
| pnpm | Package manager used to install and manage project dependencies consistently. |
| Git | Version control system used for source change tracking and collaboration. |
| GitHub | Platform used for repository hosting, code review, and collaboration workflows. |
| Visual Studio Code | Primary integrated development environment for local development and editing. |
| GitHub Copilot | AI-assisted development tool used to support implementation and code understanding. |
| PADK | Architecture and delivery knowledge base used to guide platform-aligned frontend decisions. |

## 4. API Integration

| Technology | Purpose |
| --- | --- |
| Generated OpenAPI SDK | Generated client layer for backend communication and the supported mechanism for API integration. |
| OpenAPI | API contract format used to define backend endpoints and data models for code generation. |
| JWT Authentication | Authentication mechanism used to secure requests and manage authenticated application sessions. |

The Generated OpenAPI SDK is the single source of truth for backend communication.

All API requests must use the Generated OpenAPI SDK.

Direct use of Angular HttpClient is prohibited unless explicitly approved as an architectural exception.

## 5. User Interface

| Technology | Purpose |
| --- | --- |
| SCSS | Styling system used for visual design, component styling, and theme customization. |
| Shared UI Library | Reusable user interface components and patterns shared across applications. |
| Theme Tokens | Centralized design values used to maintain consistent visual language and styling. |
| Responsive Layout | Layout approach used to ensure applications adapt to multiple screen sizes and devices. |
| App Shell | Common application frame and navigation structure used across the frontend experience. |

## 6. Build & Deployment

| Technology | Purpose |
| --- | --- |
| Vercel | Platform used for hosting and deploying frontend applications in supported environments. |
| Docker (when applicable) | Containerization technology used for consistent environments when deployment packaging requires it. |
| GitHub | Platform used for source control integration and repository-based delivery workflows. |


## 7. Technology Selection Principles

Frontend technologies are selected based on enterprise maturity, long-term maintainability, strong TypeScript ecosystem support, reusability, scalability, performance, accessibility, and developer productivity. The stack is intended to support reliable delivery, consistent implementation practices, and sustainable evolution over time.

## 8. Updating the Technology Stack

This document should be updated whenever frontend technologies are introduced, replaced, or removed. Major technology changes should also be reflected in PADK architecture documentation so that implementation guidance remains aligned with the approved stack.
