# Credit System Architecture

Based on the backend codebase, the credit system is implemented as a unified ledger designed to handle both **Customer Accounts Receivable (AR)** and **Supplier Accounts Payable (AP)**.

Here is a detailed breakdown of how it works under the hood:

## 1. Data Model: The Ledger (`CreditAccount` model)

At the core of the system is the `CreditAccount` model (`backend/src/models/creditAccount.model.js`). It acts as a continuous running ledger.

- **Polymorphic Design**: It uses `entityType` (`'customer'` or `'supplier'`) and `entityId` to link a single ledger entry to either a Customer or a Supplier.
- **Transaction Types**: It tracks different types of transactions: `'sale'`, `'payment'`, `'refund'`, `'return'`, `'purchase'`, `'supplier_payment'`, and `'supplier_return'`.
- **Running Balance**: Every entry saves the specific `amount` of the transaction and a snapshot of the `balance` at that exact moment, making it easy to generate account statements without having to recalculate everything.

## 2. Customer Credit (Accounts Receivable)

This tracks how much money customers owe your business. The current total owed is stored on the `Customer` model as `currentBalance`.

- **Credit Limits**: The system enforces credit limits. When a new credit sale is initiated, `recordCreditSale()` first calculates `availableCredit = customer.creditLimit - customer.currentBalance`. If the sale amount exceeds the available credit, the system throws a `400 Credit limit exceeded` error.
- **Credit Sales**: If approved, the customer's `currentBalance` is increased, and a `'sale'` entry is added to the `CreditAccount` ledger linked to the `orderId`. This is triggered when processing a POS order with the `'credit'` payment method.
- **Payments & Returns**: When a customer makes a payment to clear their debt, the `/api/credit/customer/payment` route is called. This reduces their `currentBalance` (down to a minimum of 0) and creates a `'payment'` entry in the ledger. Customer returns automatically reduce the owed balance similarly.

## 3. Supplier Credit (Accounts Payable)

This tracks how much money your business owes to your suppliers. The total owed is stored on the `Supplier` model as `currentBalance`.

- **Purchases on Credit**: When you receive inventory from a supplier but don't pay immediately, `recordSupplierPurchase()` is called. This increases the supplier's `currentBalance` (meaning the business owes them more) and adds a `'purchase'` entry to the ledger linked to the `purchaseOrderId`.
- **Payments to Suppliers**: When you pay your supplier, the `/api/credit/supplier/payment` route is used. This reduces the supplier's `currentBalance` and logs a `'supplier_payment'` in the ledger.

## 4. Viewing the Ledger

The `credit.routes.js` file exposes endpoints to retrieve the ledger history:

- `GET /api/credit/customer/:id`
- `GET /api/credit/supplier/:id`

These routes call `getLedger()` which simply queries the `CreditAccount` collection for all entries matching the entity, sorted by `createdAt` in descending order. This provides a complete chronological timeline of every charge, payment, and return, perfectly suitable for printing or displaying a "Statement of Account".

## 5. Auditing & Security

- **Role-Based Access**: All manual credit adjustments (`/customer/payment` and `/supplier/payment`) and ledger views are protected by the `auth(['admin'])` middleware, ensuring only administrators or authorized roles can manually apply payments or view ledgers.
- **Audit Logging**: For actions like credit sales and customer payments, the service automatically calls `logAudit()`. This records the user who initiated the action, the specific changes made to the balance, and the entity involved into an immutable audit log for security and traceability.
