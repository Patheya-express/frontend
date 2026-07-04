# Swagger Contract Standard

Every public REST endpoint must satisfy:

- Request DTOs use @ApiProperty().
- Response DTOs use @ApiProperty().
- Controllers declare request and response types.
- Authentication decorators are documented.
- Generated SDK must produce fully typed methods.

Frontend features must not be implemented against incomplete API contracts.

When an incomplete contract is discovered, the backend contract should be corrected before continuing feature development.