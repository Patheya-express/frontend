# Business Rules

## Cart

- A cart belongs to exactly one restaurant.
- Switching restaurants requires explicit confirmation.

## Authentication

- Customers self-register.
- Restaurant owners apply.
- Delivery partners join.
- Admins never self-register.

## Orders

- An order is created from a single cart.
- Orders cannot contain items from multiple restaurants.

## Payments

- Payment is initiated only after order creation.

## Delivery

- A delivery partner may only accept assigned orders.