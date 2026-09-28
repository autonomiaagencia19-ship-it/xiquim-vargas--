# Architecture

```text
Ring 0
  JWT / scrypt / RBAC / Audit / SQLite configuration
        |
Ring 1
  Transactional services
  Stock reservation / Orders / Prices / PDF persistence
        |
Ring 2
  Admin / Online / Seller / POS / Driver
        |
Ring 3
  Routing heuristic / deterministic AI context / reports
```

The web clients are deliberately lightweight and call the same API. Native Android seller and driver clients also consume the same API and do not use Expo.
