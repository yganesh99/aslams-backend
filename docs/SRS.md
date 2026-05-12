# Software Requirements Specification (SRS)

## Omnichannel ERP + POS + Ecommerce Platform

| Field           | Value            |
| --------------- | ---------------- |
| **Version**     | 1.0              |
| **Date**        | 11 February 2026 |
| **Status**      | Draft            |
| **Prepared By** | Engineering Team |

**Implementation note (auth):** Staff authentication is implemented with **Better Auth** on the **ERP Next.js app**; the Express API validates **sessions** from shared MongoDB (`client_authentication_integration.md`, `../../docs/production-configuration.md`). SRS tables below that mention JWT access/refresh describe product intent; align engineering docs with the live stack when they differ.

---

## Table of Contents

1. [Introduction](#1-introduction)
2. [System Overview](#2-system-overview)
3. [User Roles & Permissions](#3-user-roles--permissions)
4. [Functional Requirements](#4-functional-requirements)
    - 4.1 [Business & Store Management](#41-business--store-management)
    - 4.2 [User Management](#42-user-management)
    - 4.3 [Product Catalogue](#43-product-catalogue)
    - 4.4 [Inventory Management](#44-inventory-management)
    - 4.5 [Point of Sale (POS)](#45-point-of-sale-pos)
    - 4.6 [Ecommerce](#46-ecommerce)
    - 4.7 [Customer Management](#47-customer-management)
    - 4.8 [Supplier Management](#48-supplier-management)
    - 4.9 [Purchase Orders](#49-purchase-orders)
    - 4.10 [Supplier Invoices](#410-supplier-invoices)
    - 4.11 [Credit & Accounts Management](#411-credit--accounts-management)
    - 4.12 [Returns & Refunds](#412-returns--refunds)
    - 4.13 [Tax Configuration](#413-tax-configuration)
    - 4.14 [Reporting & Analytics](#414-reporting--analytics)
    - 4.15 [Audit Logging](#415-audit-logging)
5. [Non-Functional Requirements](#5-non-functional-requirements)
6. [Business Rules & Edge Cases](#6-business-rules--edge-cases)
7. [Glossary](#7-glossary)

---

## 1. Introduction

### 1.1 Purpose

This document specifies the functional and non-functional requirements for an **Omnichannel ERP + POS + Ecommerce Platform**. The system is designed for multi-store retail businesses that need to manage products, inventory, sales (both in-store and online), customers, suppliers, procurement, credit accounts, and financial reporting—all from a single unified platform.

### 1.2 Scope

The platform covers:

- **Multi-tenant architecture:** Multiple independent businesses on one platform, each with its own stores, users, products, and data.
- **Omnichannel sales:** Unified order model for both in-store (POS) and online (Ecommerce) sales.
- **End-to-end procurement:** Purchase orders, delivery receiving, supplier invoicing, and payments.
- **Credit management:** Accounts Receivable (customer credit) and Accounts Payable (supplier payables).
- **Real-time inventory:** Stock tracking per store with reservation, transfer, and low-stock alerting.
- **Comprehensive reporting:** Sales analytics, inventory valuation, profitability, and credit exposure.

### 1.3 Intended Audience

- Business owners and decision-makers
- Product managers
- Quality assurance teams
- Client stakeholders evaluating the system

---

## 2. System Overview

```
┌──────────────────────────────────────────────────────────┐
│                      PLATFORM                            │
│                                                          │
│  ┌────────────┐   ┌────────────┐   ┌──────────────────┐  │
│  │  ERP Back  │   │  POS App   │   │  Ecommerce Store │  │
│  │  Office    │   │            │   │                  │  │
│  └─────┬──────┘   └─────┬──────┘   └────────┬─────────┘  │
│        │                │                   │            │
│        └────────────────┼───────────────────┘            │
│                         │                                │
│              ┌──────────▼──────────┐                     │
│              │   Unified Backend   │                     │
│              │   (REST API)        │                     │
│              └──────────┬──────────┘                     │
│                         │                                │
│              ┌──────────▼──────────┐                     │
│              │      Database       │                     │
│              └─────────────────────┘                     │
└──────────────────────────────────────────────────────────┘
```

The system follows a **multi-tenant** model where each Business is a completely isolated tenant. All data—products, inventory, orders, customers, users—is scoped to a specific business and cannot be accessed by another business's users.

---

## 3. User Roles & Permissions

The system supports six hierarchical roles. Higher roles inherit the capabilities of lower roles.

| Role                  | Description                                                                                       |
| --------------------- | ------------------------------------------------------------------------------------------------- |
| **Super Admin**       | Platform-level administrator. Can manage all businesses and has unrestricted cross-tenant access. |
| **Business Admin**    | Full control over a single business: stores, users, products, settings, and all operations.       |
| **Store Manager**     | Manages a specific store: inventory, POS sales, staff, and day-to-day operations.                 |
| **Inventory Manager** | Manages stock levels, transfers, adjustments, and purchase order receiving.                       |
| **Accountant**        | Access to credit accounts, supplier invoices, payments, and financial reports.                    |
| **Cashier**           | POS-only access: create sales, process refunds, and view assigned store inventory.                |

### Permission Enforcement Rules

1. Every request must include a valid authentication token.
2. Each route specifies which roles are permitted. Unauthorized roles receive a **403 Forbidden** response.
3. **Tenant isolation:** Non-super-admin users can only access data belonging to their assigned business. Any attempt to access another business's data returns **403 Cross-business access denied**.
4. **Business activation check:** If a business is marked as deactivated, all operations for that business are blocked with a **403** response until the business is reactivated.

---

## 4. Functional Requirements

### 4.1 Business & Store Management

#### 4.1.1 Business Entity

A Business represents a tenant on the platform. Each business has:

| Attribute      | Description                                                  |
| -------------- | ------------------------------------------------------------ |
| Name           | Business display name                                        |
| Slug           | Unique URL-friendly identifier (must be globally unique)     |
| Logo           | Optional business logo URL                                   |
| Address        | Street, city, state, zip, country                            |
| Phone / Email  | Contact information                                          |
| Tax ID         | Government-issued tax identification                         |
| Currency       | Default currency for the business (default: USD)             |
| Stock Lock TTL | How long ecommerce stock reservations last (default: 15 min) |
| Default Tax    | Default tax rate for new products (default: 0%)              |
| Active Status  | Business can be activated or deactivated                     |

**Operations:** Create, Read, Update, List All, Deactivate/Reactivate

#### 4.1.2 Store Entity

Each business can have multiple stores (physical locations or warehouses).

| Attribute     | Description                                        |
| ------------- | -------------------------------------------------- |
| Name          | Store display name                                 |
| Code          | Unique code within the business (e.g., "STORE-01") |
| Address       | Physical location address                          |
| Phone         | Store contact number                               |
| Active Status | Store can be activated or deactivated              |

**Operations:** Create, Read, Update, List by Business

> **Edge Case:** Store codes are unique per business. Two different businesses can have a store with the same code, but the same business cannot.

---

### 4.2 User Management

#### 4.2.1 User Entity

| Attribute | Description                                                        |
| --------- | ------------------------------------------------------------------ |
| Email     | Unique login identifier (globally unique)                          |
| Password  | Securely hashed authentication credential                          |
| Google ID | Optional—for Google OAuth sign-in                                  |
| Name      | Display name                                                       |
| Phone     | Optional contact number                                            |
| Role      | One of the six defined roles                                       |
| Business  | The business this user belongs to (null for super admins)          |
| Store     | The store this user is assigned to (null for business-level roles) |
| Active    | Can be deactivated to revoke access                                |

#### 4.2.2 Authentication

| Feature       | Description                                                                              |
| ------------- | ---------------------------------------------------------------------------------------- |
| Registration  | Email + password registration creates new users                                          |
| Login         | Staff sign-in via Better Auth on the ERP app (session cookies; shared DB with API)      |
| Session       | API validates Better Auth session on protected routes (`auth` middleware)                |
| Google OAuth  | Alternative sign-in via Google account                                                   |
| Rate Limiting | Login attempts are limited to **10 per 15-minute window** to prevent brute-force attacks |

> **Edge Case:** Passwords are automatically hashed before storage. The raw password is never stored or retrievable.

**Operations:** Register, Login, Session validation, Google OAuth (ERP), Create User (admin), List Users, Update User

---

### 4.3 Product Catalogue

#### 4.3.1 Product Entity

| Attribute       | Description                                                  |
| --------------- | ------------------------------------------------------------ |
| SKU             | Stock Keeping Unit—unique per business                       |
| Name            | Product display name (full-text searchable)                  |
| Description     | Optional product description                                 |
| Category        | Optional product category                                    |
| Unit            | Unit of measure (default: "pcs")                             |
| POS Price       | Selling price used for in-store (POS) transactions           |
| Ecommerce Price | Selling price used for online transactions                   |
| Cost Price      | Purchase cost, used for profit/margin calculations           |
| Tax Rate        | Product-specific tax percentage (overrides business default) |
| Visibility      | Controls where the product can be sold (see below)           |
| Active          | Controls whether the product appears in searches and sales   |

#### 4.3.2 Channel Visibility

Each product has a **visibility** setting that controls where it can be sold:

| Visibility         | POS Sales | Ecommerce Sales |
| ------------------ | --------- | --------------- |
| **Both**           | ✅        | ✅              |
| **POS Only**       | ✅        | ❌              |
| **Ecommerce Only** | ❌        | ✅              |

> **Edge Case:** If a POS cashier tries to sell a product marked "Ecommerce Only," the system rejects the transaction. The same applies in reverse—an ecommerce checkout for a "POS Only" product is rejected. This prevents operational errors where products intended for a single channel are accidentally sold on the wrong channel.

**Operations:** Create, Read, Update, List by Business (with text search on name)

---

### 4.4 Inventory Management

#### 4.4.1 Stock Tracking

Inventory is tracked **per product, per store**. Each inventory record holds:

| Field              | Description                                                  |
| ------------------ | ------------------------------------------------------------ |
| Quantity           | Physical stock count at this store                           |
| Reserved Quantity  | Stock reserved for pending ecommerce orders                  |
| Available Quantity | Computed: Quantity − Reserved Quantity (true sellable stock) |

#### 4.4.2 Manual Stock Adjustment

Authorized users can manually adjust stock levels (e.g., after a physical count).

**Rules & Edge Cases:**

| Rule                      | Detail                                                                                               |
| ------------------------- | ---------------------------------------------------------------------------------------------------- |
| Negative stock prevention | If an adjustment would bring the quantity below zero, the adjustment is **rejected and rolled back** |
| Auto-creation             | If no inventory record exists for the product at that store, one is automatically created            |
| Audit trail               | Every adjustment is logged with the user, timestamp, and quantity change                             |

#### 4.4.3 Inter-Store Stock Transfer

Stock can be transferred between stores within the same business.

**Rules & Edge Cases:**

| Rule                         | Detail                                                                                                |
| ---------------------------- | ----------------------------------------------------------------------------------------------------- |
| Atomic operation             | Either all items transfer successfully or none do—partial transfers never occur                       |
| Insufficient stock           | If the source store doesn't have enough stock of any item, the entire transfer is rejected            |
| Auto-creation at destination | If the destination store has never stocked a product, a new inventory record is created automatically |
| Multi-item support           | A single transfer can move multiple products between the same two stores                              |

#### 4.4.4 Ecommerce Stock Reservation (Stock Locking)

When a customer begins an ecommerce checkout, the system **reserves** (soft-locks) the requested quantities so they cannot be oversold.

**Lifecycle:**

```
Customer clicks "Checkout"
    ↓
lockStock()  →  Reserves stock (increases Reserved Quantity)
               Creates time-limited lock records
    ↓
Customer completes payment
    ↓
confirmStock()  →  Deducts from both Quantity and Reserved Quantity
                   Marks locks as "confirmed"

── OR ──

Customer abandons checkout / lock expires
    ↓
releaseStock()  →  Releases reservation (decreases Reserved Quantity)
                   Marks locks as "released"
```

**Rules & Edge Cases:**

| Rule                     | Detail                                                                                                                                     |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------ |
| Availability check       | Available stock = Quantity − Reserved Quantity. Only truly available stock can be locked.                                                  |
| Configurable TTL         | Lock duration is configurable per business (default: 15 minutes)                                                                           |
| Automatic expiry         | Expired locks are automatically cleaned up by the system, releasing reserved quantities                                                    |
| Concurrent checkout race | If two customers try to check out the last unit simultaneously, only the first succeeds; the second receives an "Insufficient stock" error |
| All-or-nothing           | If any single item in the checkout cannot be reserved, the entire checkout fails—no partial locks                                          |

#### 4.4.5 Viewing Stock

- **By store:** View all product stock levels at a specific store
- **By product:** View a specific product's stock across all stores
- **Total available:** Get the aggregate available quantity of a product across the entire business

**Operations:** View Stock, Adjust Stock, Transfer Stock, Lock/Confirm/Release Stock

---

### 4.5 Point of Sale (POS)

#### 4.5.1 Creating a POS Sale

A POS sale is an in-store transaction processed by a cashier.

**Process Flow:**

1. Cashier selects products and quantities
2. System validates each product:
    - Product must exist and belong to the same business
    - Product must not be "Ecommerce Only"
    - Store must have sufficient stock
3. Stock is immediately deducted from the store's inventory
4. Tax is calculated per line item using the product's tax rate
5. Order is created with status **"Confirmed"**
6. If payment is via credit, the customer's AR balance is updated

#### 4.5.2 Payment Methods

| Method     | Description                                                    |
| ---------- | -------------------------------------------------------------- |
| **Cash**   | Standard cash payment                                          |
| **Card**   | Credit/debit card payment                                      |
| **QR**     | QR code-based digital payment                                  |
| **Split**  | Combination of multiple payment methods for one order          |
| **Credit** | Charged to the customer's credit account (requires a customer) |

#### 4.5.3 Credit Sale Rules

| Rule                  | Detail                                                                                       |
| --------------------- | -------------------------------------------------------------------------------------------- |
| Customer required     | A `customerId` must be provided for credit sales                                             |
| Credit limit check    | Sale amount must not exceed the customer's available credit (Credit Limit − Current Balance) |
| Atomic balance update | The customer's AR balance is updated in the same transaction as the sale                     |
| Rejection on exceeded | If credit limit is exceeded, the entire sale is rejected                                     |

> **Edge Case:** The credit limit check uses `creditLimit − currentBalance` to determine available credit. This means previously unpaid credit sales reduce the available credit for future transactions.

#### 4.5.4 Order Numbering

POS orders are automatically assigned unique order numbers with the prefix **"POS-"** followed by a timestamp-based identifier.

---

### 4.6 Ecommerce

#### 4.6.1 Two-Phase Checkout

Ecommerce follows a **two-phase** process to handle the gap between order placement and payment completion:

**Phase 1 — Checkout (Stock Reservation)**

1. Customer submits their cart
2. System validates products (must exist, must not be "POS Only")
3. Stock is **reserved** (locked) for a configurable duration (default: 15 minutes)
4. A **pending** order is created with order number prefix **"ECM-"**
5. Customer is directed to complete payment

**Phase 2 — Payment Confirmation**

1. Payment gateway confirms successful payment
2. System **confirms** the stock locks (converts reservation to actual deduction)
3. Order status transitions to **"Confirmed"**

> **Edge Case — Abandoned Checkout:** If the customer does not complete payment within the lock TTL, reserved stock is automatically released and made available for other customers. The pending order remains but the stock is freed.

#### 4.6.2 Pricing

Ecommerce transactions use the **Ecommerce Price** of each product, which may differ from the POS Price, allowing businesses to maintain separate pricing strategies per channel.

#### 4.6.3 Fulfillment Store Assignment

After an ecommerce order is confirmed, an administrator assigns a physical store to fulfill the order. The order status transitions to **"Processing"** once a fulfillment store is assigned.

#### 4.6.4 Order Status Lifecycle

```
pending → confirmed → processing → shipped → delivered
                ↘ cancelled
```

| Status     | Trigger                              |
| ---------- | ------------------------------------ |
| Pending    | Checkout initiated, awaiting payment |
| Confirmed  | Payment verified, stock deducted     |
| Processing | Fulfillment store assigned           |
| Shipped    | Order dispatched from store          |
| Delivered  | Order received by customer           |
| Cancelled  | Order cancelled before delivery      |

#### 4.6.5 Ecommerce Returns

Returns for ecommerce orders can be processed at **any store**, not just the fulfillment store. This supports walk-in returns where a customer returns an online purchase at their nearest store.

| Rule              | Detail                                                                                       |
| ----------------- | -------------------------------------------------------------------------------------------- |
| Any-store returns | The return payload specifies which store receives the returned stock                         |
| Item validation   | Every returned item must exist in the original order                                         |
| Stock restoration | Returned quantities are added back to the specified store's inventory                        |
| Credit adjustment | If the original order used credit, the customer's AR balance is reduced by the return amount |

---

### 4.7 Customer Management

#### 4.7.1 Customer Entity

| Attribute        | Description                                      |
| ---------------- | ------------------------------------------------ |
| Name             | Customer's full name                             |
| Email            | Email address                                    |
| Phone            | Contact number                                   |
| Address          | Full address (street, city, state, zip, country) |
| Credit Limit     | Maximum credit the customer can use              |
| Current Balance  | Outstanding amount owed by the customer (AR)     |
| Available Credit | Computed: Credit Limit − Current Balance         |
| Active           | Whether the customer account is active           |

**Operations:** Create, Read, Update, List by Business

> **Edge Case:** Customer emails are indexed per business to prevent duplicate customer entries within the same business.

---

### 4.8 Supplier Management

#### 4.8.1 Supplier Entity

| Attribute       | Description                                   |
| --------------- | --------------------------------------------- |
| Name            | Supplier company name                         |
| Contact Person  | Primary contact at the supplier               |
| Email / Phone   | Contact details                               |
| Address         | Supplier address                              |
| Lead Time Days  | Expected delivery lead time in days           |
| Current Balance | Outstanding amount owed to this supplier (AP) |
| Active          | Whether the supplier is active                |

**Operations:** Create, Read, Update, List by Business

---

### 4.9 Purchase Orders

#### 4.9.1 Purchase Order Lifecycle

Purchase Orders (POs) follow a strict state machine:

```
draft → approved → sent → partial_received → closed
                              ↘ cancelled
```

| Status           | Description                                                |
| ---------------- | ---------------------------------------------------------- |
| Draft            | PO created but not yet reviewed                            |
| Approved         | Reviewed and approved by management (records who approved) |
| Sent             | Transmitted to the supplier                                |
| Partial Received | Some items have been delivered                             |
| Closed           | All items fully received                                   |
| Cancelled        | PO cancelled (no further deliveries expected)              |

#### 4.9.2 PO Line Items

Each PO contains line items with:

| Field        | Description                        |
| ------------ | ---------------------------------- |
| Product      | The product being ordered          |
| SKU          | Product SKU                        |
| Ordered Qty  | Number of units ordered            |
| Received Qty | Number of units received so far    |
| Unit Price   | Agreed price per unit              |
| Line Total   | Computed: Ordered Qty × Unit Price |

#### 4.9.3 Receiving Deliveries

When a delivery arrives, the system processes received items with the following rules:

| Rule               | Detail                                                                                        |
| ------------------ | --------------------------------------------------------------------------------------------- |
| Item validation    | Every received item must be part of the original PO                                           |
| Over-receive guard | The system rejects any delivery where `received so far + incoming` exceeds `ordered quantity` |
| Inventory update   | Received quantities are immediately added to the designated store's inventory                 |
| Auto-close         | If all items are fully received, the PO automatically transitions to "Closed"                 |
| Partial tracking   | If only some items are received, the PO transitions to "Partial Received"                     |
| Atomic operation   | Receiving is all-or-nothing: if any item is invalid, the entire delivery is rejected          |

> **Edge Case:** The over-receive guard prevents warehouse staff from accidentally recording more units than were ordered, which would create inventory discrepancies.

#### 4.9.4 PO Numbering

PO numbers are automatically generated with the prefix **"PO-"** followed by a unique identifier.

**Operations:** Create, List (with filtering & pagination), View, Approve, Mark as Sent, Receive Delivery, Cancel

---

### 4.10 Supplier Invoices

#### 4.10.1 Invoice Entity

| Attribute      | Description                                   |
| -------------- | --------------------------------------------- |
| Invoice Number | Unique invoice identifier within the business |
| Supplier       | The supplier who issued the invoice           |
| Purchase Order | The PO this invoice is linked to              |
| Line Items     | Products, quantities, and unit prices         |
| Total Amount   | Total invoice value                           |
| Paid Amount    | Amount paid so far                            |
| Status         | pending → partial_paid → paid                 |

#### 4.10.2 Price Validation

When creating a supplier invoice, the system **cross-checks every line item's unit price against the linked Purchase Order**. If any price differs, the invoice is rejected.

> **Edge Case:** This prevents invoicing errors or unauthorized price changes. If a supplier submits an invoice with a different price than agreed on the PO, it must be resolved before the invoice can be entered into the system.

#### 4.10.3 Payment Recording

Payments against invoices support **partial payments**:

| Scenario        | Result                                             |
| --------------- | -------------------------------------------------- |
| Partial payment | Invoice status → "Partial Paid"                    |
| Full payment    | Invoice status → "Paid" (when paid amount ≥ total) |

#### 4.10.4 Invoice Attachments

Users can upload and attach digital copies (PDF, JPEG, PNG) of the original supplier invoice to the system record.

| Rule           | Detail                                                                            |
| -------------- | --------------------------------------------------------------------------------- |
| **File Types** | JPEG, PNG, PDF                                                                    |
| **Max Size**   | 5 MB per file                                                                     |
| **Limit**      | Max 5 attachments per invoice                                                     |
| **Storage**    | Files are stored securely on the server and can be downloaded by authorized users |
| **Lifecycle**  | Attachments can be added or removed at any time, even after the invoice is paid   |

**Operations:** Create (with price validation), List (with filtering & pagination), View, Record Payment, Upload Attachments, Remove Attachments

---

### 4.11 Credit & Accounts Management

#### 4.11.1 Accounts Receivable (Customer Credit)

The system maintains customer credit accounts for tracking outstanding balances.

| Operation        | Effect on Customer Balance                  |
| ---------------- | ------------------------------------------- |
| Credit Sale      | Increases balance (customer owes more)      |
| Customer Payment | Decreases balance (customer paid down debt) |
| Customer Return  | Decreases balance (customer returned goods) |

**Rules & Edge Cases:**

| Rule                     | Detail                                                                                                                                                     |
| ------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Credit limit enforcement | New credit sales are rejected if the sale amount exceeds available credit                                                                                  |
| Balance floor at zero    | Payments and returns can never reduce the balance below zero. If a customer overpays, the balance stops at zero—no negative balances (credits) are created |
| Ledger trail             | Every operation creates a ledger entry with a running balance snapshot, allowing full reconstruction of the account's history                              |
| Order linkage            | Each ledger entry references the related order, providing end-to-end traceability                                                                          |

#### 4.11.2 Accounts Payable (Supplier Credit)

| Operation          | Effect on Supplier Balance                         |
| ------------------ | -------------------------------------------------- |
| Purchase on Credit | Increases balance (business owes more to supplier) |
| Supplier Payment   | Decreases balance (business paid down its debt)    |
| Supplier Return    | Decreases balance (goods returned to supplier)     |

The same **balance floor at zero** rule applies to supplier balances.

#### 4.11.3 Credit Ledger

Both customer and supplier credit accounts maintain a **chronological ledger** of all transactions. Each entry records:

- Transaction type (sale, payment, return, purchase, etc.)
- Amount (positive for debits, negative for credits)
- Running balance after the transaction
- Related order or purchase order reference
- User who performed the action
- Timestamp

The ledger can be queried by entity (customer or supplier) to show the complete credit history in reverse-chronological order.

---

### 4.12 Returns & Refunds

#### 4.12.1 POS Refunds

| Step                  | Detail                                                                        |
| --------------------- | ----------------------------------------------------------------------------- |
| Order lookup          | The original order must exist and belong to the same business                 |
| Item validation       | Each returned item must exist in the original order                           |
| Inventory restoration | Returned quantities are added back to the store's inventory                   |
| Credit reversal       | If the original order was a credit sale, the customer's AR balance is reduced |
| Status update         | Order status is changed to "Returned"                                         |

> **Edge Case:** Only items that were part of the original order can be returned. Attempting to return a product that wasn't in the order results in a validation error.

#### 4.12.2 Ecommerce Returns

Ecommerce returns follow the same logic as POS refunds, with one key difference: the **return can be processed at any store**, not just the one that fulfilled the order. See [Section 4.6.5](#465-ecommerce-returns).

#### 4.12.3 Return Entity

Each return record captures:

| Field         | Description                               |
| ------------- | ----------------------------------------- |
| Type          | Customer return or supplier return        |
| Related Order | The original order or purchase order      |
| Store         | Where the return was processed            |
| Items         | Products, quantities, and values returned |
| Total Amount  | Monetary value of the return              |
| Reason        | Optional reason for the return            |
| Status        | pending → approved → completed            |

---

### 4.13 Tax Configuration

Businesses can define custom tax rates:

| Attribute  | Description                                             |
| ---------- | ------------------------------------------------------- |
| Name       | Tax name (e.g., "VAT", "Sales Tax")—unique per business |
| Rate       | Tax percentage                                          |
| Is Default | Whether this is the business's default tax rate         |
| Active     | Whether this tax rate is in use                         |

Taxes are applied at the **product level**: each product has its own tax rate. During a sale, the tax is calculated per line item as:

```
Tax Amount = Unit Price × Quantity × (Tax Rate / 100)
Line Total = (Unit Price × Quantity) + Tax Amount
```

**Operations:** Create, Read, Update, List by Business

---

### 4.14 Reporting & Analytics

The system provides the following reports, all filterable by **date range** (start date and end date).

#### 4.14.1 Sales Reports

| Report           | Description                                                    |
| ---------------- | -------------------------------------------------------------- |
| Sales by Store   | Total sales, order count, and average order value per store    |
| Sales by Product | Total quantity sold and revenue per product (SKU)              |
| Sales by Cashier | Total sales and order count per POS cashier (POS channel only) |

> **Edge Case:** All sales reports automatically **exclude cancelled and returned orders** to ensure revenue figures are accurate and not inflated.

#### 4.14.2 Inventory Reports

| Report              | Description                                                                                                              |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| Low Stock Alerts    | Products where **available** quantity (physical − reserved) is at or below a configurable threshold (default: 10 units)  |
| Inventory Valuation | Total units in stock, total cost value (at cost price), and total retail value (at POS price) across the entire business |

> **Edge Case — Low Stock Accuracy:** The low stock alert compares against **available quantity** (quantity minus reserved), not physical quantity. This means products that are physically in stock but fully reserved for pending ecommerce orders will correctly trigger a low-stock alert.

#### 4.14.3 Financial Reports

| Report                   | Description                                                              |
| ------------------------ | ------------------------------------------------------------------------ |
| Customer Credit Exposure | All customers with outstanding AR balances, sorted by balance descending |
| Supplier Payables        | All suppliers with outstanding AP balances, sorted by balance descending |
| Profit per SKU           | Revenue, cost, profit, and margin percentage for each product sold       |

> **Edge Case — Profit Margin:** When a product has zero revenue (e.g., only been sampled or gifted), the profit margin is reported as **0%** instead of producing an error.

---

### 4.15 Audit Logging

All critical business operations are recorded in an audit log:

| Field     | Description                                                   |
| --------- | ------------------------------------------------------------- |
| User      | Who performed the action                                      |
| Action    | What was done (e.g., "adjust", "transfer", "pos_sale")        |
| Entity    | What type of record was affected (e.g., "Inventory", "Order") |
| Entity ID | The specific record that was modified                         |
| Changes   | Details of what changed                                       |
| Timestamp | When the action occurred                                      |

**Audited operations include:**

- Stock adjustments and transfers
- POS sales and refunds
- Ecommerce order confirmations and returns
- Purchase order deliveries
- Credit account transactions

> **Important:** Audit logging is designed to never interfere with business operations. If the logging system encounters an error, the business transaction still completes successfully—the log failure is recorded separately for the operations team but does not block or rollback the user's action.

---

## 5. Non-Functional Requirements

### 5.1 Security

| Requirement        | Detail                                                              |
| ------------------ | ------------------------------------------------------------------- |
| Authentication     | Better Auth sessions (ERP) verified on API; RBAC on protected routes  |
| Password Security  | Passwords are hashed with bcrypt (10 salt rounds)                   |
| Transport Security | Security headers enforced via Helmet middleware                     |
| CORS               | Configurable allowed origins                                        |
| Rate Limiting      | Auth endpoints limited to 10 requests per 15-minute window          |
| Tenant Isolation   | All data access is scoped and validated against the user's business |

### 5.2 Data Integrity

| Requirement              | Detail                                                                                                                                   |
| ------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------- |
| Transactional Operations | Critical operations (sales, transfers, receiving) use database transactions to ensure all-or-nothing consistency                         |
| Unique Constraints       | SKUs per business, order numbers per business, store codes per business, invoice numbers per business—all enforced at the database level |
| Referential Integrity    | All cross-entity references are validated before operations proceed                                                                      |

### 5.3 Performance

| Requirement       | Detail                                                                              |
| ----------------- | ----------------------------------------------------------------------------------- |
| Pagination        | All list endpoints support pagination (page + limit) with total count returned      |
| Indexed Queries   | All frequently-queried fields are indexed for fast lookups                          |
| Concurrent Safety | Stock operations use optimistic locking patterns to handle concurrent access safely |

### 5.4 Availability

| Requirement             | Detail                                                                                                           |
| ----------------------- | ---------------------------------------------------------------------------------------------------------------- |
| Health Check Endpoint   | `/health` returns system status and uptime                                                                       |
| Graceful Error Handling | All errors return structured JSON responses with appropriate HTTP status codes                                   |
| Stock Lock Cleanup      | A periodic background process cleans up expired stock locks to prevent inventory from being permanently reserved |

---

## 6. Business Rules & Edge Cases

### 6.1 Cross-Business Data Isolation

Every data lookup validates that the record belongs to the requesting user's business. A user from Business A cannot access products, orders, or customers belonging to Business B—even if they possess a valid product/order ID from Business B.

### 6.2 Negative Balance Prevention

| Entity      | Prevention Mechanism                                                         |
| ----------- | ---------------------------------------------------------------------------- |
| Inventory   | Adjustments that would result in negative stock are rejected and rolled back |
| Customer AR | Payments and returns use `max(0, balance - amount)` to floor at zero         |
| Supplier AP | Payments and returns use `max(0, balance - amount)` to floor at zero         |

### 6.3 Concurrent Stock Operations

When multiple users or customers attempt to modify the same inventory simultaneously:

| Scenario                                  | Handling                                                             |
| ----------------------------------------- | -------------------------------------------------------------------- |
| Two POS cashiers selling the last unit    | First sale succeeds; second fails with "Insufficient stock"          |
| POS sale + ecommerce checkout             | Only available (non-reserved) stock is considered for new POS sales  |
| Two ecommerce checkouts for the last unit | First checkout locks the stock; second gets "Insufficient stock"     |
| Transfer + sale of same stock             | Whichever operation processes first gets the stock; the second fails |

### 6.4 Ecommerce Checkout Timeout

If a customer initiates a checkout but never completes payment:

1. Stock remains reserved for the configured TTL (default: 15 minutes)
2. After TTL expires, a background cleanup process detects expired locks
3. Reserved quantities are released back to available stock
4. The pending order remains in the system (status: "pending") for record-keeping

### 6.5 Split Payments

POS orders support **split payments** where the total can be paid across multiple methods. The order stores an array of individual payment details, each with its own method, amount, and reference.

### 6.6 Supplier Invoice Price Mismatch

The system enforces **strict price matching** between purchase orders and supplier invoices. If a supplier submits an invoice with prices that differ from the agreed PO prices, the invoice cannot be created until the discrepancy is resolved.

### 6.7 Over-Receiving Prevention

When recording deliveries against a purchase order, the system prevents receiving more units of any item than were originally ordered. This guards against inventory inflation due to data entry errors.

### 6.8 Auto-Generated Identifiers

| Entity           | Format    | Example        |
| ---------------- | --------- | -------------- |
| POS Orders       | POS-xxxxx | POS-M5K2R-A7B3 |
| Ecommerce Orders | ECM-xxxxx | ECM-M5K2R-X9Y1 |
| Purchase Orders  | PO-xxxxx  | PO-M5K2R-AB    |

All identifiers include timestamp components to ensure chronological uniqueness.

---

## 7. Glossary

| Term             | Definition                                                                   |
| ---------------- | ---------------------------------------------------------------------------- |
| **AR**           | Accounts Receivable—money owed to the business by customers                  |
| **AP**           | Accounts Payable—money the business owes to suppliers                        |
| **SKU**          | Stock Keeping Unit—a unique product identifier                               |
| **POS**          | Point of Sale—in-store transaction terminal                                  |
| **PO**           | Purchase Order—a formal request to buy goods from a supplier                 |
| **TTL**          | Time To Live—duration before an automatic expiry (e.g., stock locks)         |
| **Tenant**       | A single business with its own isolated data space on the platform           |
| **Stock Lock**   | A temporary reservation of inventory for a pending ecommerce order           |
| **Ledger**       | A chronological record of all credit/debit transactions for an account       |
| **Multi-tenant** | Architecture where multiple businesses share one platform with isolated data |
| **Better Auth**  | Auth library used on the ERP app; API shares MongoDB session store           |
| **RBAC**         | Role-Based Access Control—permissions determined by user role                |

---

_End of Document_
