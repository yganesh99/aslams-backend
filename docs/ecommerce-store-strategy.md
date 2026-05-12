# E-commerce vs POS Inventory Strategy

## Overview

This document explains how inventory is managed between the Point of Sale (POS) system and the E-commerce platform, and outlines the recommended architecture for preventing stock conflicts.

## How Orders Work

### 1. POS Orders

- **Flow:** Synchronous and Immediate.
- **Stock Deduction:** When a cashier completes an order via `/api/pos/create-order`, the inventory `quantity` is immediately deducted from the specific `storeId` the POS terminal is logged into.
- **Validation:** If the store lacks sufficient stock at the exact moment of sale, the transaction fails immediately.

### 2. E-commerce Orders

- **Flow:** Asynchronous with Soft-Locking.
- **Checkout (`/api/ecommerce/checkout`):** The e-commerce frontend sends the cart items and a target `storeId`. The system checks stock at *that specific store*. If available, it creates a `StockLock` (incrementing `reservedQuantity`) for 15 minutes, preventing others from buying those units during the payment flow.
- **Payment Confirmation (`/api/ecommerce/confirm-payment`):** Upon successful payment, the lock is released, and the actual `quantity` is permanently deducted.
- **Store Assignment:** The backend currently supports assigning a fulfillment store (`fulfilledBy`), but the initial stock deduction always occurs against the `storeId` provided during checkout.

## The Problem with Shared Retail Stock

If the e-commerce platform allows customers to purchase stock that is physically sitting on a retail store shelf (Ship-from-Store), several issues arise:

1. **Race Conditions:** An online customer and a walk-in customer might try to buy the last unit simultaneously. If the online customer reaches checkout first, the item is soft-locked, and the cashier cannot sell the physical item sitting in front of them.
2. **Fragmented Checkout:** If an online customer wants 5 units, but Store A has 3 and Store B has 2, a checkout against a single `storeId` will fail, even though the business has 5 units in total.
3. **Complex Fulfillment:** Routing a single online order to multiple retail stores for fulfillment requires complex split-shipment logistics.

## Recommended Architecture: Dedicated E-commerce Warehouse

To resolve the above issues, the system should be configured with a **Dedicated E-commerce Store**.

### Advantages

- **Complete Isolation:** Walk-in customers and online customers never compete for the exact same physical unit.
- **Frontend Simplicity:** The e-commerce frontend only queries stock levels and executes checkouts against a single, fixed `storeId`.
- **Accurate Availability:** What the customer sees online is exactly what is available in the warehouse, eliminating "out-of-stock after checkout" scenarios.

### Implementation Guide

1. **Create the Store:**
  Create a new `Store` record in your database specifically for online inventory.
2. **Configure Frontend:**
  Retrieve the MongoDB `_id` of the newly created store and inject it into the E-commerce frontend's environment variables.
3. **Update API Calls:**
  Ensure the E-commerce frontend uses this environment variable when fetching product stock and when sending the `/api/ecommerce/checkout` request.
4. **Inventory Management:**
  Use the `/api/inventory/transfer` endpoint in the ERP backoffice to periodically move stock from physical retail locations to the E-commerce Warehouse, or receive purchase orders directly into the warehouse.

