# API Map

## Auth
- POST `/api/auth/login`
- GET `/api/me`

## Dashboard/Admin
- GET `/api/dashboard`
- GET `/api/audit`
- GET/POST `/api/users`
- GET/POST `/api/settings`
- POST `/api/admin/impersonate`
- POST `/api/admin/impersonate/exit`
- POST `/api/admin/ia`

## Catalog
- GET/POST `/api/products`
- PUT `/api/products/:id`
- GET/POST `/api/categories`
- POST `/api/subcategories`

## Stock
- GET `/api/stock`
- POST `/api/stock/:productId`

## Clients / pricing
- GET/POST `/api/clients`
- GET `/api/clients/:id/profile`
- POST `/api/clients/:id/repeat-last`
- GET/POST `/api/price-tables`

## Orders
- GET/POST `/api/orders`
- POST `/api/orders/:id/status`
- GET `/api/orders/:id/pdf`

## Logistics
- GET/POST `/api/logistics/routes`
- POST `/api/logistics/orders/:id/proof`
- POST `/api/logistics/orders/:id/complete`

## Reports
- GET `/api/reports`
