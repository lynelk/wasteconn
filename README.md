# WasteConn

WasteConn is a waste management operations platform built with React, Vite, and Base44 SDK integrations.

## Quick Start

1. Install dependencies:
   ```bash
   npm install
   ```
2. Copy environment template and configure values:
   ```bash
   cp .env.example .env.local
   ```
3. Start local development:
   ```bash
   npm run dev
   ```

## Validation Commands

- `npm run lint`
- `npm run typecheck`
- `npm run typecheck:strict`
- `npm run test`
- `npm run build`

## Architecture Highlights

- Modular route configuration in `src/routes/`
- API abstraction in `src/api/`
- Shared query hooks in `src/hooks/queries/`
- Common reusable UI patterns in `src/components/common/`
