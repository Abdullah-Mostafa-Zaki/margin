# Margin — Financial Analytics Platform


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

## Core Architecture: The Dual Pipeline

Margin operates on a dual-ingestion architecture to handle different types of financial data securely and efficiently:

### 1. The Deterministic Pipeline (Bulk CSV)
Built for speed and strict data integrity. Used for bulk importing structured e-commerce data.
* **Flow:** `Shopify CSV` -> `UploadThing` -> `PapaParse` -> `Database`.
* **Behavior:** Bypasses human-in-the-loop review. Data is already structured and validated, so it is written directly to the database. The UI automatically closes upon a successful upload toast.

### 2. The Probabilistic Pipeline (AI Vision)
Built for flexibility and unstructured data. Used for daily operations, ad-hoc expenses, and physical receipts.
* **Flow:** `Image Upload(s)` -> `UploadThing` -> `Groq Vision API` -> `Two-Layer Sanitization` -> `Review Grid` -> `Database`.
* **Multi-Shot Extraction:** Engineered to process 1-to-N transactions per image. A single screenshot of a bank statement or a WhatsApp chat will be dynamically flattened (`flatMap`) into multiple distinct rows in the UI.
* **Human-in-the-Loop:** Because LLMs are probabilistic, all extracted data is paused in a Review Grid, allowing the user to verify amounts, categories, and reference the original `imageUrl` thumbnail before executing the database write.

## 🛡️ Security & Data Integrity

### Two-Layer Categorization Defense
To prevent database pollution from LLM hallucinations, the AI pipeline utilizes a strict two-layer defense mechanism for expense categorization:
1. **System Prompt Restraint:** The Groq `llama-4-scout` model is strictly prompted to only select from an exact list of approved enums (`Raw Materials`, `Manufacturing`, `Packaging`, `Logistics (Shipping)`, `Ads`, `Content Creation`, `Other`).
2. **Runtime Coercion Guard:** Before the backend returns the AI payload to the frontend, a TypeScript interceptor checks the category against a `VALID_CATEGORIES` tuple. Any rogue strings are instantly crushed and coerced to `"Other"`, ensuring frontend UI components (like Select dropdowns) never break.

## 📱 UI / UX Highlights

* **Unified Import Hub:** A responsive, mobile-first modal (`UnifiedImportModal.tsx`) that houses both CSV and AI ingestion methods. Uses `flex-col sm:flex-row` for perfect 50/50 desktop splits and clean mobile stacking.
* **Dynamic Feedback:** Intelligent toast notifications that aggregate processing metrics (e.g., "Extracted 4 transactions. 1 failed to parse, 2 had no readable transactions.").

## 📂 Key File Structure

* `src/actions/ai.actions.ts`: Houses the Groq API calls, system prompts, and the Two-Layer categorization defense.
* `src/components/dashboard/UnifiedImportModal.tsx`: The primary UI hub managing state between CSV uploads, AI processing, and the Review Grid.
* `src/components/dashboard/CSVUploader.tsx`: Manages the PapaParse logic and deterministic upload state.
