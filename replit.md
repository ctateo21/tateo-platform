# replit.md

## Overview

This is a full-stack real estate services platform built with React, TypeScript, Express.js, and PostgreSQL. The application provides comprehensive real estate solutions including property search, mortgage calculations, insurance quotes, construction services, property management, and home services. It features a modern UI built with shadcn/ui components and Tailwind CSS, integrated with external APIs for property data and insurance quotes.

## System Architecture

The application follows a monorepo structure with clear separation between client, server, and shared code:

- **Frontend**: React 18 with TypeScript, using Vite for build tooling
- **Backend**: Express.js server with TypeScript
- **Database**: PostgreSQL with Drizzle ORM for type-safe database operations
- **Styling**: Tailwind CSS with shadcn/ui component library
- **State Management**: React Context API for service selection, TanStack React Query for server state

## Key Components

### Frontend Architecture
- **Component Structure**: Modular React components with TypeScript
- **UI Framework**: shadcn/ui components built on Radix UI primitives
- **Routing**: Wouter for client-side routing
- **Form Handling**: React Hook Form with Zod validation
- **Styling**: Tailwind CSS with custom design tokens matching Tateo & Co branding

### Backend Architecture
- **API Structure**: RESTful Express.js server with modular route handlers
- **Database Layer**: Drizzle ORM with PostgreSQL (using Neon serverless)
- **Integration Layer**: Modular external service integrations
- **Error Handling**: Centralized error handling middleware

### Database Schema
Key tables include:
- `users` - User account information
- `submissions` - Form submission data
- `integration_requests` - External API integration tracking
- `questionnaire_responses` - Progressive form data storage
- `services` - Available service categories

## Data Flow

1. **Service Selection**: Users select services on the home page using the context provider
2. **Progressive Forms**: Multi-step questionnaire system with auto-save functionality
3. **External Integration**: Form data triggers calls to partner APIs (NetCalcSheet, Arive, Canopy Connect)
4. **Results Display**: Processed data presented to users with actionable next steps

## External Dependencies

### Core Technologies
- **Database**: Neon PostgreSQL serverless
- **Maps Integration**: Google Maps API for address autocomplete and property search
- **Property Data**: Zillow API integration for property values and market data
- **Reviews**: Google Places API for business reviews

### Partner Integrations
- **NetCalcSheet**: Real estate calculations and market analysis
- **Arive**: Mortgage loan processing and rate calculations
- **Canopy Connect**: Insurance quotes and policy management
- **Hillsborough County**: Property tax estimation for local properties

### Development Tools
- **Build**: Vite for frontend, esbuild for backend bundling
- **Database**: Drizzle Kit for migrations and schema management
- **Validation**: Zod schemas shared between client and server
- **Type Safety**: TypeScript throughout the entire stack

## Deployment Strategy

The application is designed for deployment on platforms that support Node.js applications:

- **Build Process**: 
  - Frontend builds to static assets via Vite
  - Backend bundles to single file via esbuild
- **Environment**: Production mode uses the bundled server
- **Database**: Configured for Neon PostgreSQL with connection pooling
- **Static Assets**: Frontend build output served by Express in production

## Seller Listing Dashboard

A second product surface lives alongside the buyer/refi flows:

- **`/seller-dashboard`** — Seller view. Logged-in sellers see their own active listings with the latest published weekly recap: price analysis, comps, online platform engagement (Zillow/Realtor/Redfin), next steps, and a history accordion of past recaps.
- **`/admin`** — Agent-only admin. Lists all listings across all sellers, lets agents add/edit listings and create/publish weekly recaps via a long-form editor. Agents are identified by `profiles.agent` being non-null (same `AGENTS` list used elsewhere: christian/omar/kyle/team).

Database (added to `supabase/schema.sql`):
- `listings` — one row per property, linked to a seller via `seller_id`. RLS: sellers read their own; agents have full access.
- `weekly_recaps` — agent-authored per-listing snapshots (DOM, pricing recommendation, comps, engagement estimates, narrative fields, `next_steps[]`). Sellers see only `published = true` recaps. Agents have full access.
- Helper SQL function `public.is_agent()` powers the RLS policies.

Run `supabase/schema.sql` in the Supabase SQL editor to apply.

**Demo seeding** — On `/admin`, click **Seed Demo Data**. The endpoint (`POST /api/seller-dashboard/seed`, agent-only) creates a demo seller account and seeds the 3 sample Sarasota listings from the spec, each with one published recap. Idempotent.

Demo credentials (both created by the seed endpoint):
- **Demo seller** — `demo.seller@tateoco.com` / `DemoSeller2025!` (sees `/seller-dashboard` with 3 active listings)
- **Demo agent** — `demo.agent@tateoco.com` / `DemoAgent2025!` (sees `/admin`; has `profiles.agent = 'demo'` set by the service role)

Log in as the demo seller to see the seller view; log in as the demo agent (or any account with `profiles.agent` set) to see admin. Non-agent users who navigate to `/admin` are redirected to `/seller-dashboard`.

The `agent` column on `profiles` is protected by the `prevent_agent_self_elevation` trigger — only the service role (server-side admin tooling) can set it, so users cannot grant themselves agent privileges.

Additional agent tools in `/admin`:
- **Sellers tab** — list of all sellers with linked-listing counts and an **Add Seller** dialog (calls `POST /api/seller-dashboard/create-seller`, agent-only, which provisions a Supabase auth user and emails a password-reset link).
- **Preview as Seller tab** on every recap editor — renders the recap with the exact seller-facing layout before publish.

## Changelog

```
Changelog:
- July 07, 2025. Initial setup
- August 21, 2025. Completed comprehensive 12-step mortgage questionnaire with:
  * Steps 1-9: Complete mortgage application flow (purchase/refinance paths)
  * Step 10: Plaid Integration for secure bank account verification
  * Step 11: Property Taxes, Insurance & Flood cost analysis
  * Step 12: Complete loan analysis with DTI ratios and asset verification
  * Real-time feedback system with loan-specific DTI limits
  * Asset sufficiency analysis with recommendations for shortfalls
  * Enhanced refinance flow with cash-out debt selection, dynamic loan amount calculation, tax bill connection, CanopyConnect insurance integration, and refined analysis display
  * Updated refinance analysis with detailed calculation breakdown: current loan balance + selected debts + additional cash-out + closing costs = new loan amount (highlighted)
  * Fixed monthly payment precision to 2 decimal places, removed cash flow summary and assets sections per user specifications
```

## User Preferences

```
Preferred communication style: Simple, everyday language.
```