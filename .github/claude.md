# Patheya Express

Before implementing any feature:

- Read `.github/copilot-instructions.md`
- Read `.ai/README.md`
- Read only the PADK documents relevant to the task.

Architecture:

Generated SDK
↓
Feature Service
↓
Signal Store
↓
Facade
↓
Component

Rules:

- Never use HttpClient directly.
- Never place business logic in Components.
- Reuse Shared UI.
- One feature = one library.
- Build must pass before task completion.