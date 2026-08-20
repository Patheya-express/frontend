Patheya Express Frontend

Enterprise frontend monorepo for the Patheya Express platform.

This repository contains the Angular/Nx applications used by customers, restaurant partners, delivery partners, and administrators.

Applications

Application

Purpose

Development Port

customer-app

Customer ordering and tracking

4200

restaurant-app

Restaurant / partner operations

4201

admin-app

Administration and operations console

4202

delivery-app

Delivery partner application

4203

Architecture

The frontend uses:

Angular 21

Nx monorepo

TypeScript

SCSS

pnpm

Capacitor

OpenAPI-generated Angular SDK

JWT authentication

Socket.IO realtime communication

Shared UI and design tokens

Responsive web/mobile architecture

The project intentionally uses a unified component tree across web and mobile. Do not create separate web/mobile component implementations unless there is a demonstrated architectural requirement.

Repository Structure

frontend/
├── apps/
│   ├── customer-app/
│   ├── restaurant-app/
│   ├── admin-app/
│   └── delivery-app/
│
├── libs/
│   ├── api-sdk/
│   ├── auth/
│   ├── core/
│   ├── shared-models/
│   ├── shared-ui/
│   └── features/
│
├── nx.json
├── package.json
├── pnpm-workspace.yaml
└── tsconfig.base.json

The exact library list should always be verified from the current workspace because the monorepo evolves over time.

1. Prerequisites

Install before setting up the repository.

Required

Git

Node.js 24.x

pnpm 11.x

Windows 10/11 for Windows development

Required for Android development

JDK 21

Android Studio

Android SDK

Android SDK Platform Tools

ADB

Required for iOS development

macOS

Xcode

CocoaPods

iOS development certificates/provisioning as applicable

Verify the basic tools:

node -v
pnpm -v
git --version

For Android:

java -version
adb version

The repository configuration is the final source of truth if version declarations change.

2. Clone the Repository

Clone the frontend repository:

git clone <FRONTEND_REPOSITORY_URL> frontend
cd frontend

Verify:

git status

3. Install Dependencies

Use pnpm.

pnpm install

Do not use npm install or switch package managers for normal development.

Verify Nx:

pnpm exec nx --version

List workspace projects:

pnpm exec nx show projects

4. Environment Configuration

The applications use environment-specific configuration.

Depending on the application, inspect the corresponding environment files under:

apps/<app>/src/environments/

Common configurations include:

environment.ts
environment.prod.ts
environment.mobile.ts

Before starting development, verify which configuration is selected by the Nx target you are running.

Local API

The current local backend API convention is:

http://localhost:3000/api/v1

Production API

The current production API domain is:

https://api.patheyaexpress.in/api

Production Realtime

The current production realtime domain is:

https://api.patheyaexpress.in

Do not hardcode these values inside components or services.

Use the repository's environment/configuration architecture.

Never commit:

private API keys

payment secrets

authentication secrets

developer credentials

production credentials

5. Verify Nx Applications

List applications:

pnpm exec nx show projects

Inspect an application:

pnpm exec nx show project customer-app

Use the configured targets rather than inventing new scripts.

6. Start Applications

Customer

pnpm exec nx serve customer-app

Open:

http://localhost:4200

Restaurant

pnpm exec nx serve restaurant-app

Open:

http://localhost:4201

Admin

pnpm exec nx serve admin-app

Open:

http://localhost:4202

Delivery

pnpm exec nx serve delivery-app

Open:

http://localhost:4203

Only run the applications required for the current task.

7. Frontend Architecture

The preferred application flow is:

Component
    ↓
Facade / Store
    ↓
Service / SDK
    ↓
Backend API

For authenticated functionality:

Component
    ↓
Facade / Store
    ↓
Auth / API SDK
    ↓
JWT Interceptor
    ↓
NestJS API

Authentication infrastructure includes:

AuthService

AuthFacade

AuthStore

TokenStorageService

AuthBootstrapService

JWT interceptor

authGuard

guestGuard

roleGuard

Do not create a parallel authentication mechanism.

8. OpenAPI SDK

The frontend uses an OpenAPI-generated Angular SDK.

The normal contract flow is:

NestJS DTO / Controller
        ↓
Swagger / OpenAPI
        ↓
Generated SDK
        ↓
Frontend service / facade
        ↓
Component

The generated SDK contains API services and models.

Do not manually duplicate backend request/response models when the generated SDK already provides the contract.

If an API contract changes:

Update the backend.

Verify Swagger/OpenAPI.

Regenerate the SDK using the repository's configured command.

Update frontend consumers.

Run tests/builds.

Find available generation scripts with:

pnpm run

Look for scripts containing:

openapi
sdk
generate

9. Shared UI

Before creating a new UI component, search shared-ui.

The shared UI system contains reusable components and design tokens.

Examples include:

buttons

dropdowns

avatars

layout components

theme tokens

common interaction patterns

Do not create duplicate components inside individual apps when a shared component is appropriate.

10. Design Tokens and SCSS

Use the existing theme/design token system.

Prefer centralized tokens for:

colors

spacing

typography

radius

elevation

breakpoints

Avoid arbitrary values when an existing token is available.

Do not introduce a second design system.

11. Responsive and Mobile Architecture

The project uses a unified responsive architecture.

The intended model is:

One Angular Component Tree
        +
Responsive SCSS
        +
BreakpointService
        +
Capacitor

The goal is to reuse the same UI across web and mobile.

Do not create separate:

WebComponent
MobileComponent

implementations unless the existing architecture demonstrates that they are necessary.

12. Capacitor

Capacitor is used for mobile applications.

Before mobile work, verify the configured Capacitor version:

pnpm list @capacitor/core

Build the relevant application first:

pnpm exec nx build <app>

Then synchronize the native project using the repository's configured Capacitor workflow.

Typical commands:

pnpm exec cap sync android

and on macOS:

pnpm exec cap sync ios

Use the actual Capacitor project configuration as the source of truth.

13. Android Development

Verify:

node -v
pnpm -v
java -version
adb version

Connect a physical Android device with USB debugging enabled.

Check:

adb devices

Expected:

List of devices attached
XXXXXXXX    device

If the device is unauthorized, unlock the phone and accept the USB debugging authorization dialog.

Open the Android project:

pnpm exec cap open android

Build/install through Android Studio.

14. Android Local API Consideration

On a physical Android device:

localhost

means the Android device itself, not the development computer.

Therefore a mobile build cannot normally reach:

http://localhost:3000

on the developer PC.

Use the approved development/QA API configuration or the project's documented local-network configuration.

Do not permanently place a developer machine IP into production configuration.

15. iOS Development

iOS native development requires macOS.

Typical workflow:

pnpm install
pnpm exec nx build <app>
pnpm exec cap sync ios
pnpm exec cap open ios

Then build/run through Xcode.

Windows developers cannot perform the final native iOS build locally.

16. Production Builds

Customer:

pnpm exec nx build customer-app --configuration=production

Restaurant:

pnpm exec nx build restaurant-app --configuration=production

Delivery:

pnpm exec nx build delivery-app --configuration=production

Admin:

pnpm exec nx build admin-app --configuration=production

Do not consider a build successful merely because compilation succeeds.

For release verification, confirm that:

production API configuration is correct

QA URLs are not embedded

localhost URLs are not embedded

development configuration is not accidentally selected

secrets are not embedded

17. Testing

Use the targets actually configured by Nx.

Example:

pnpm exec nx test customer-app

For affected projects:

pnpm exec nx affected -t test

Inspect available project targets:

pnpm exec nx show project customer-app

Run lint/check targets exposed by the repository before committing.

18. Useful Nx Commands

List projects:

pnpm exec nx show projects

Inspect project:

pnpm exec nx show project customer-app

Serve:

pnpm exec nx serve customer-app

Build:

pnpm exec nx build customer-app

Test:

pnpm exec nx test customer-app

View dependency graph:

pnpm exec nx graph

Affected tasks:

pnpm exec nx affected -t build
pnpm exec nx affected -t test

Use only targets actually defined by the repository.

19. Git Workflow

Before starting work:

git status
git pull
git branch --show-current

Create/use the team's approved feature branch workflow.

Before committing:

git status

Review all changed files.

Do not commit generated build output, local environment files, credentials, or unrelated changes.

20. Frontend Development Rules

Always

Reuse existing shared components.

Reuse existing services and facades.

Use the generated SDK.

Follow Nx dependency boundaries.

Use design tokens.

Preserve responsive behavior.

Test mobile behavior when the feature affects mobile.

Verify API integration.

Keep authentication centralized.

Do not

Duplicate API clients.

Duplicate authentication.

Duplicate shared UI.

Hardcode production URLs.

Hardcode secrets.

Put business logic into templates.

Bypass guards/interceptors.

Create a separate mobile UI tree without architectural justification.

Modify unrelated completed modules.

21. Troubleshooting

pnpm not found

Check:

pnpm -v

Enable Corepack if required:

corepack enable

Then restart PowerShell.

nx not found

Use:

pnpm exec nx

Do not rely on a global Nx installation.

Build dependency errors

First verify:

node -v
pnpm -v

Then inspect:

git status

Do not randomly delete the lockfile or switch package managers.

API/CORS errors

Check:

selected environment

API URL

backend availability

browser network tab

backend CORS configuration

port

authentication token

Do not disable CORS as a workaround.

Mobile API errors

Check:

device network

API environment

localhost behavior

Android/iOS permissions

backend accessibility

SSL/certificate configuration

22. New Developer Setup Checklist

Git installed

Node.js 24.x installed

pnpm 11.x installed

Repository cloned

pnpm install completed

Nx workspace loads

Customer app starts

Restaurant app starts

Admin app starts

Delivery app starts

Backend API reachable

Login tested

Shared UI understood

API SDK understood

Environment configuration understood

Android setup completed if required

Physical Android device recognized if required

iOS setup completed on macOS if required

Production build tested for assigned application

23. Recommended Learning Order

A new frontend developer should learn:

Nx workspace

Application structure

Shared libraries

Shared UI

Design tokens

Auth architecture

API SDK

Facades/stores

Feature modules

Responsive/mobile architecture

Capacitor

Build/deployment workflow

Do not begin by creating new components before understanding the shared architecture.

24. Definition of Ready

The frontend environment is ready when the developer can:

Install dependencies
      ↓
Start backend
      ↓
Start an application
      ↓
Login
      ↓
Call authenticated APIs
      ↓
Use shared UI
      ↓
Debug frontend
      ↓
Build application
      ↓
Run tests
      ↓
Test mobile when required

25. Golden Rules

Enterprise architecture over shortcuts.

Reuse before creating.

Generated API contracts are the source of truth.

Authentication remains centralized.

Shared UI remains shared.

Production configuration must never point to localhost/QA accidentally.

Never commit secrets.

Never bypass authorization.

Never duplicate mobile/web component trees without architectural justification.

Do not redesign completed modules without a demonstrated requirement.

Make the smallest correct change.

Verify the complete feature flow, not only the screen.

