# Margin — Financial Analytics Platform

> Private repository. Architecture and technical details documented here.

## Status
MVP feature-complete. Live at: https://margin-eg.vercel.app/

## Overview
Multi-tenant B2B SaaS financial dashboard for Egyptian clothing brands 
operating on the drop/campaign model.

## Tech Stack
Next.js 16 · TypeScript · PostgreSQL · Prisma ORM · Supabase · 
NextAuth.js · Vercel · Node.js

## Database Architecture
- 10-table multi-tenant PostgreSQL schema
- Row-level data isolation via mandatory `organizationId` foreign keys
- Cascading constraints enforcing workspace boundaries

## Core Features
- Shopify webhook ingestion pipeline with HMAC-SHA256 verification 
  and idempotency constraints
- Financial KPI engine computing 11 metrics: Realized Revenue, 
  Pending COD Escrow, Net Margin %, Ad Spend isolation, 
  Catalog Velocity (Pareto by product)
- Next.js Server Actions mutation layer with automatic cache invalidation
- 3-step onboarding wizard with guided workspace configuration

