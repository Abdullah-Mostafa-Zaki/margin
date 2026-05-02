# 📈 Margin — Financial Analytics Platform

**Margin** is a multimodal, multi-tenant B2B SaaS financial analytics platform tailored for Egyptian clothing brands operating on the drop/campaign model.

It blends strict deterministic e-commerce data with unstructured probabilistic real-world data (receipts, voice, text) into a unified, mobile-responsive dashboard.

**Status:** MVP feature-complete. Live at: [margin-eg.vercel.app](https://margin-eg.vercel.app/)

---

## 🚀 Core Architecture: The Dual Pipeline

Margin operates on a dual-ingestion architecture to handle different types of financial data securely and efficiently:

### 1. The Deterministic Pipeline (Bulk CSV)
Built for speed and strict data integrity. Used for bulk importing structured e-commerce data.
* **Flow:** `Shopify CSV` -> `UploadThing` -> `PapaParse` -> `Database`.
* **Behavior:** Bypasses human-in-the-loop review. Data is already structured and validated, so it is written directly to the database. The UI automatically closes upon a successful upload.

### 2. The Probabilistic Pipeline (AI Vision & Voice)
Built for flexibility and unstructured data. Used for daily operations, ad-hoc expenses, physical receipts, and Instapay screenshots. Engineered to handle the complexities of the Egyptian market, including mixed Arabic/English text, unique fonts, and EGP formatting.
* **Flow:** `Image Uploads / Audio` -> `UploadThing` -> `Groq (Llama Vision / Whisper)` -> `Two-Layer Sanitization` -> `Review Grid` -> `Database`.
* **Multi-Shot Extraction:** Engineered to process 1-to-N transactions per image. A single screenshot of a bank statement or a WhatsApp chat will be dynamically flattened (`flatMap`) into multiple distinct rows in the UI.
* **Human-in-the-Loop:** Because LLMs are probabilistic, all extracted data is paused in a Review Grid, allowing the user to verify amounts, categories, and reference the original `imageUrl` thumbnail before executing the database write.

---

## 💻 Tech Stack

* **Framework:** Next.js 16 (App Router), React 19, TypeScript
* **Database & ORM:** PostgreSQL, Prisma ORM
* **Authentication:** NextAuth.js (with Prisma adapter)
* **Real-time & Storage:** Supabase (for real-time listeners), UploadThing (for file handling)
* **AI & LLMs:** Groq SDK (`llama-3.2-90b-vision-preview` for multimodal extraction, `whisper-large-v3` for Ammiya transcription, and `llama-4-scout-17b-16e-instruct` for categorization defense).
* **Styling:** Tailwind CSS v4, Framer Motion, shadcn/ui

---

## 🏛️ Database Architecture

* **Multi-Tenant:** 10-table PostgreSQL schema designed for B2B scale.
* **Isolation:** Row-level data isolation via mandatory `organizationId` foreign keys.
* **Integrity:** Cascading constraints enforcing strict workspace boundaries.
* **Core Entities:** `User`, `Organization`, `Membership` (Roles: ADMIN, ACCOUNTANT, MEMBER), `Transaction`, `LineItem`, `Tag`.

---

## ✨ Core Features & Capabilities

* **Financial KPI Engine:** Computes complex metrics including Realized Revenue, Pending COD Escrow, Net Margin %, Ad Spend isolation, and Catalog Velocity (Pareto by product).
* **Voice-to-Expense:** `parseVoiceTransaction` pipeline using Whisper for Egyptian Ammiya transcription and Llama 3 for JSON extraction.
* **Instapay Vision Parser:** Extracts structured JSON (amount, merchant, date, category) from messy financial screenshots using Llama 3.2 90B Vision, automatically translating Arabic merchant names into standard English context.
* **Real-time Dashboard:** Supabase realtime listeners keeping financial widgets (`GodMetric`, `Insights`, `expense-donut-chart`) constantly synced without manual refreshes.
* **Guided Onboarding:** 3-step wizard with secure workspace and Shopify webhook configuration.
* **Tagging System:** For custom multidimensional slicing of transactions.
* **Server Actions:** Secure, API-less mutation layer with automatic Next.js cache invalidation.

---

## 🛡️ Security & Data Integrity

### Two-Layer Categorization Defense
To prevent database pollution from LLM hallucinations, the AI pipeline utilizes a strict two-layer defense mechanism for expense categorization:
1. **System Prompt Restraint:** The Groq `llama-4-scout` model is strictly prompted to only select from an exact list of approved enums (`Raw Materials`, `Manufacturing`, `Packaging`, `Logistics (Shipping)`, `Ads`, `Content Creation`, `Other`).
2. **Runtime Coercion Guard:** Before the backend returns the AI payload to the frontend, a TypeScript interceptor checks the category against a `VALID_CATEGORIES` tuple. Any rogue strings are instantly crushed and coerced to `"Other"`, ensuring frontend UI components (like Select dropdowns) never break.

---

## 📱 UI / UX Highlights

* **Unified Import Hub:** A responsive, mobile-first modal (`UnifiedImportModal.tsx`) that houses both CSV and AI ingestion methods. Uses `flex-col sm:flex-row` for perfect 50/50 desktop splits and clean mobile stacking.
* **Truth Banner:** A contextual global banner ensuring data bounds are clearly surfaced to the user.
* **Dynamic Feedback:** Intelligent toast notifications that aggregate processing metrics (e.g., *"Extracted 4 transactions. 1 failed to parse, 2 had no readable transactions."*).

---

## 📂 Key File Structure

* **`src/actions/`**: Server actions for business logic (`ai.actions.ts`, `transactions.actions.ts`, `csvImport.ts`).
* **`src/app/(dashboard)/`**: Dynamic organization-based routing (`[orgSlug]`).
* **`src/components/dashboard/`**: Core UI logic (`UnifiedImportModal.tsx`, `CSVUploader.tsx`, `GodMetric.tsx`, `Insights.tsx`).
* **`prisma/schema.prisma`**: The single source of truth for the multi-tenant database models.

---
*Built for scale, engineered for precision.*
