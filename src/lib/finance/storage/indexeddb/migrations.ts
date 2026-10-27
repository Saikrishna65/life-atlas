/**
 * Life Atlas Finance: IndexedDB Schema Migrations & System Seeders
 * 
 * Version 1 schema definition with idempotent upgrade triggers.
 */

import { FinanceCategory, CategorizationRule } from "../../domain/models";

export const FINANCE_DB_NAME = "life_atlas_finance_db";
export const FINANCE_DB_VERSION = 4;

export const DEFAULT_FINANCE_CATEGORIES: FinanceCategory[] = [
  // Expense Categories
  {
    id: "cat_food_dining",
    name: "Food & Dining",
    icon: "Utensils",
    color: "#F59E0B",
    type: "expense",
    isSystem: true,
    sortOrder: 1,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  },
  {
    id: "cat_groceries",
    name: "Groceries",
    icon: "ShoppingCart",
    color: "#10B981",
    type: "expense",
    isSystem: true,
    sortOrder: 2,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  },
  {
    id: "cat_housing_rent",
    name: "Housing & Rent",
    icon: "Home",
    color: "#6366F1",
    type: "expense",
    isSystem: true,
    sortOrder: 3,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  },
  {
    id: "cat_utilities",
    name: "Utilities & Bills",
    icon: "Zap",
    color: "#EC4899",
    type: "expense",
    isSystem: true,
    sortOrder: 4,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  },
  {
    id: "cat_transport",
    name: "Transport & Fuel",
    icon: "Car",
    color: "#3B82F6",
    type: "expense",
    isSystem: true,
    sortOrder: 5,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  },
  {
    id: "cat_shopping",
    name: "Shopping",
    icon: "ShoppingBag",
    color: "#8B5CF6",
    type: "expense",
    isSystem: true,
    sortOrder: 6,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  },
  {
    id: "cat_health_medical",
    name: "Health & Medical",
    icon: "HeartPulse",
    color: "#EF4444",
    type: "expense",
    isSystem: true,
    sortOrder: 7,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  },
  {
    id: "cat_entertainment",
    name: "Entertainment",
    icon: "Film",
    color: "#F97316",
    type: "expense",
    isSystem: true,
    sortOrder: 8,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  },
  {
    id: "cat_travel",
    name: "Travel & Leisure",
    icon: "Plane",
    color: "#06B6D4",
    type: "expense",
    isSystem: true,
    sortOrder: 9,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  },
  {
    id: "cat_investments",
    name: "Investments & Savings",
    icon: "TrendingUp",
    color: "#10B981",
    type: "expense",
    isSystem: true,
    sortOrder: 10,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  },
  {
    id: "cat_other_expense",
    name: "Other Expense",
    icon: "CircleDollarSign",
    color: "#64748B",
    type: "expense",
    isSystem: true,
    sortOrder: 11,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  },

  // Income Categories
  {
    id: "cat_salary",
    name: "Salary & Wages",
    icon: "Briefcase",
    color: "#10B981",
    type: "income",
    isSystem: true,
    sortOrder: 12,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  },
  {
    id: "cat_business",
    name: "Business & Freelance",
    icon: "Laptop",
    color: "#059669",
    type: "income",
    isSystem: true,
    sortOrder: 13,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  },
  {
    id: "cat_dividends",
    name: "Dividends & Returns",
    icon: "LineChart",
    color: "#047857",
    type: "income",
    isSystem: true,
    sortOrder: 14,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  },
  {
    id: "cat_other_income",
    name: "Other Income",
    icon: "Wallet",
    color: "#6EE7B7",
    type: "income",
    isSystem: true,
    sortOrder: 15,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  },

  // Transfer Category
  {
    id: "cat_transfer",
    name: "Account Transfer",
    icon: "ArrowLeftRight",
    color: "#64748B",
    type: "transfer",
    isSystem: true,
    sortOrder: 16,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  },
];

/**
 * Executes schema migration for Version 1
 */
export function migrateToV1(db: IDBDatabase, transaction: IDBTransaction): void {
  // 1. Accounts store
  if (!db.objectStoreNames.contains("accounts")) {
    const accStore = db.createObjectStore("accounts", { keyPath: "id" });
    accStore.createIndex("status", "status", { unique: false });
    accStore.createIndex("accountType", "accountType", { unique: false });
    accStore.createIndex("name", "name", { unique: false });
  }

  // 2. Transactions store
  if (!db.objectStoreNames.contains("transactions")) {
    const txnStore = db.createObjectStore("transactions", { keyPath: "id" });
    txnStore.createIndex("accountId", "accountId", { unique: false });
    txnStore.createIndex("occurredAt", "occurredAt", { unique: false });
    txnStore.createIndex("categoryId", "categoryId", { unique: false });
    txnStore.createIndex("status", "status", { unique: false });
    txnStore.createIndex("transferGroupId", "transferGroupId", { unique: false });
    txnStore.createIndex("externalId", "externalId", { unique: false });
    txnStore.createIndex("direction", "direction", { unique: false });
  }

  // 3. Categories store
  if (!db.objectStoreNames.contains("categories")) {
    const catStore = db.createObjectStore("categories", { keyPath: "id" });
    catStore.createIndex("type", "type", { unique: false });
    catStore.createIndex("parentId", "parentId", { unique: false });

    // Seed default categories
    for (const cat of DEFAULT_FINANCE_CATEGORIES) {
      catStore.put(cat);
    }
  }

  // 4. Savings Goals store
  if (!db.objectStoreNames.contains("savings_goals")) {
    const goalsStore = db.createObjectStore("savings_goals", { keyPath: "id" });
    goalsStore.createIndex("status", "status", { unique: false });
  }

  // 5. Audit Log store
  if (!db.objectStoreNames.contains("audit_log")) {
    const auditStore = db.createObjectStore("audit_log", { keyPath: "id" });
    auditStore.createIndex("entityId", "entityId", { unique: false });
    auditStore.createIndex("performedAt", "performedAt", { unique: false });
  }

  // 6. Sync Outbox store
  if (!db.objectStoreNames.contains("sync_outbox")) {
    const outboxStore = db.createObjectStore("sync_outbox", { keyPath: "id" });
    outboxStore.createIndex("status", "status", { unique: false });
    outboxStore.createIndex("timestamp", "timestamp", { unique: false });
    outboxStore.createIndex("idempotencyKey", "idempotencyKey", { unique: false });
  }

  // 7. Settings store
  if (!db.objectStoreNames.contains("settings")) {
    db.createObjectStore("settings", { keyPath: "key" });
  }
}

/**
 * Executes schema migration for Version 2: adds dedicated Budgets store
 */
export function migrateToV2(db: IDBDatabase, _transaction: IDBTransaction): void {
  // 8. Budgets store
  if (!db.objectStoreNames.contains("budgets")) {
    const budgetStore = db.createObjectStore("budgets", { keyPath: "id" });
    budgetStore.createIndex("period", "period", { unique: false });
    budgetStore.createIndex("startDate", "startDate", { unique: false });
  }
}

export const DEFAULT_CATEGORIZATION_RULES: CategorizationRule[] = [
  // Groceries
  {
    id: "rule_blinkit",
    name: "Blinkit",
    matchType: "contains",
    pattern: "blinkit",
    categoryId: "cat_groceries",
    direction: "outflow",
    priority: 10,
    isSystem: true,
    isActive: true,
    explanation: "Matches Blinkit quick commerce grocery deliveries",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  },
  {
    id: "rule_zepto",
    name: "Zepto",
    matchType: "contains",
    pattern: "zepto",
    categoryId: "cat_groceries",
    direction: "outflow",
    priority: 10,
    isSystem: true,
    isActive: true,
    explanation: "Matches Zepto grocery and daily essentials orders",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  },
  {
    id: "rule_instamart",
    name: "Swiggy Instamart",
    matchType: "contains",
    pattern: "instamart",
    categoryId: "cat_groceries",
    direction: "outflow",
    priority: 10,
    isSystem: true,
    isActive: true,
    explanation: "Matches Swiggy Instamart grocery purchases",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  },
  {
    id: "rule_bigbasket",
    name: "BigBasket",
    matchType: "contains",
    pattern: "bigbasket",
    categoryId: "cat_groceries",
    direction: "outflow",
    priority: 10,
    isSystem: true,
    isActive: true,
    explanation: "Matches BigBasket online grocery deliveries",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  },
  {
    id: "rule_dmart",
    name: "DMart",
    matchType: "contains",
    pattern: "dmart",
    categoryId: "cat_groceries",
    direction: "outflow",
    priority: 10,
    isSystem: true,
    isActive: true,
    explanation: "Matches DMart supermarket retail purchases",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  },

  // Food & Dining
  {
    id: "rule_swiggy",
    name: "Swiggy",
    matchType: "contains",
    pattern: "swiggy",
    categoryId: "cat_food_dining",
    direction: "outflow",
    priority: 20,
    isSystem: true,
    isActive: true,
    explanation: "Matches Swiggy food ordering transactions",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  },
  {
    id: "rule_zomato",
    name: "Zomato",
    matchType: "contains",
    pattern: "zomato",
    categoryId: "cat_food_dining",
    direction: "outflow",
    priority: 20,
    isSystem: true,
    isActive: true,
    explanation: "Matches Zomato dining and delivery transactions",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  },
  {
    id: "rule_starbucks",
    name: "Starbucks",
    matchType: "contains",
    pattern: "starbucks",
    categoryId: "cat_food_dining",
    direction: "outflow",
    priority: 20,
    isSystem: true,
    isActive: true,
    explanation: "Matches Starbucks cafe transactions",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  },
  {
    id: "rule_mcdonalds",
    name: "McDonalds",
    matchType: "contains",
    pattern: "mcdonald",
    categoryId: "cat_food_dining",
    direction: "outflow",
    priority: 20,
    isSystem: true,
    isActive: true,
    explanation: "Matches McDonald's fast food purchases",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  },

  // Transport & Fuel
  {
    id: "rule_uber",
    name: "Uber",
    matchType: "contains",
    pattern: "uber",
    categoryId: "cat_transport",
    direction: "outflow",
    priority: 15,
    isSystem: true,
    isActive: true,
    explanation: "Matches Uber ride hailing rides",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  },
  {
    id: "rule_ola",
    name: "Ola Cabs",
    matchType: "contains",
    pattern: "ola cab",
    categoryId: "cat_transport",
    direction: "outflow",
    priority: 15,
    isSystem: true,
    isActive: true,
    explanation: "Matches Ola mobility services",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  },
  {
    id: "rule_rapido",
    name: "Rapido",
    matchType: "contains",
    pattern: "rapido",
    categoryId: "cat_transport",
    direction: "outflow",
    priority: 15,
    isSystem: true,
    isActive: true,
    explanation: "Matches Rapido bike taxi payments",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  },
  {
    id: "rule_fuel_petrol",
    name: "Fuel & Petrol Pumps",
    matchType: "contains",
    pattern: "petrol",
    categoryId: "cat_transport",
    direction: "outflow",
    priority: 20,
    isSystem: true,
    isActive: true,
    explanation: "Matches petrol stations, IOCL, BPCL, HPCL",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  },
  {
    id: "rule_irctc",
    name: "IRCTC Train Bookings",
    matchType: "contains",
    pattern: "irctc",
    categoryId: "cat_transport",
    direction: "outflow",
    priority: 15,
    isSystem: true,
    isActive: true,
    explanation: "Matches Indian Railways transit reservations",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  },

  // Utilities & Bills
  {
    id: "rule_airtel",
    name: "Airtel",
    matchType: "contains",
    pattern: "airtel",
    categoryId: "cat_utilities",
    direction: "outflow",
    priority: 25,
    isSystem: true,
    isActive: true,
    explanation: "Matches Airtel mobile, DTH and broadband bills",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  },
  {
    id: "rule_jio",
    name: "Reliance Jio",
    matchType: "contains",
    pattern: "jio",
    categoryId: "cat_utilities",
    direction: "outflow",
    priority: 25,
    isSystem: true,
    isActive: true,
    explanation: "Matches Jio telecom services and fiber recharge",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  },
  {
    id: "rule_bescom",
    name: "Electricity / BESCOM",
    matchType: "contains",
    pattern: "bescom",
    categoryId: "cat_utilities",
    direction: "outflow",
    priority: 25,
    isSystem: true,
    isActive: true,
    explanation: "Matches electricity utility payments",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  },

  // Entertainment & Subscriptions
  {
    id: "rule_netflix",
    name: "Netflix",
    matchType: "contains",
    pattern: "netflix",
    categoryId: "cat_entertainment",
    direction: "outflow",
    priority: 15,
    isSystem: true,
    isActive: true,
    explanation: "Matches Netflix video streaming subscription",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  },
  {
    id: "rule_spotify",
    name: "Spotify",
    matchType: "contains",
    pattern: "spotify",
    categoryId: "cat_entertainment",
    direction: "outflow",
    priority: 15,
    isSystem: true,
    isActive: true,
    explanation: "Matches Spotify music streaming subscription",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  },
  {
    id: "rule_hotstar",
    name: "Disney+ Hotstar",
    matchType: "contains",
    pattern: "hotstar",
    categoryId: "cat_entertainment",
    direction: "outflow",
    priority: 15,
    isSystem: true,
    isActive: true,
    explanation: "Matches Hotstar entertainment subscription",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  },

  // Shopping
  {
    id: "rule_amazon",
    name: "Amazon Shopping",
    matchType: "contains",
    pattern: "amazon",
    categoryId: "cat_shopping",
    direction: "outflow",
    priority: 30,
    isSystem: true,
    isActive: true,
    explanation: "Matches Amazon e-commerce purchases",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  },
  {
    id: "rule_flipkart",
    name: "Flipkart",
    matchType: "contains",
    pattern: "flipkart",
    categoryId: "cat_shopping",
    direction: "outflow",
    priority: 30,
    isSystem: true,
    isActive: true,
    explanation: "Matches Flipkart shopping transactions",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  },

  // Health & Medical
  {
    id: "rule_apollo",
    name: "Apollo Pharmacy",
    matchType: "contains",
    pattern: "apollo",
    categoryId: "cat_health_medical",
    direction: "outflow",
    priority: 20,
    isSystem: true,
    isActive: true,
    explanation: "Matches Apollo pharmacy, clinic and healthcare expenses",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  },
  {
    id: "rule_1mg",
    name: "Tata 1mg",
    matchType: "contains",
    pattern: "1mg",
    categoryId: "cat_health_medical",
    direction: "outflow",
    priority: 20,
    isSystem: true,
    isActive: true,
    explanation: "Matches 1mg pharmacy orders and lab tests",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  },

  // Income / Salary
  {
    id: "rule_salary",
    name: "Salary Credit",
    matchType: "contains",
    pattern: "salary",
    categoryId: "cat_salary",
    direction: "inflow",
    priority: 10,
    isSystem: true,
    isActive: true,
    explanation: "Matches employer payroll and direct salary credits",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  },
];

/**
 * Executes schema migration for Version 3: adds categorization_rules and recurring_rules
 */
export function migrateToV3(db: IDBDatabase, _transaction: IDBTransaction): void {
  // 9. Categorization Rules store
  if (!db.objectStoreNames.contains("categorization_rules")) {
    const rulesStore = db.createObjectStore("categorization_rules", { keyPath: "id" });
    rulesStore.createIndex("pattern", "pattern", { unique: false });
    rulesStore.createIndex("categoryId", "categoryId", { unique: false });
    rulesStore.createIndex("isActive", "isActive", { unique: false });
    rulesStore.createIndex("priority", "priority", { unique: false });

    // Seed default categorization rules
    for (const rule of DEFAULT_CATEGORIZATION_RULES) {
      rulesStore.put(rule);
    }
  }

  // 10. Recurring Rules store
  if (!db.objectStoreNames.contains("recurring_rules")) {
    const recurringStore = db.createObjectStore("recurring_rules", { keyPath: "id" });
    recurringStore.createIndex("accountId", "accountId", { unique: false });
    recurringStore.createIndex("categoryId", "categoryId", { unique: false });
    recurringStore.createIndex("status", "status", { unique: false });
    recurringStore.createIndex("frequency", "frequency", { unique: false });
    recurringStore.createIndex("nextDueDate", "nextDueDate", { unique: false });
  }
}

/**
 * Executes schema migration for Version 4: adds sync_conflicts store and outbox indexes
 */
export function migrateToV4(db: IDBDatabase, transaction: IDBTransaction): void {
  // 11. Sync Conflicts store
  if (!db.objectStoreNames.contains("sync_conflicts")) {
    const conflictStore = db.createObjectStore("sync_conflicts", { keyPath: "id" });
    conflictStore.createIndex("entityId", "entityId", { unique: false });
    conflictStore.createIndex("resolution", "resolution", { unique: false });
    conflictStore.createIndex("createdAt", "createdAt", { unique: false });
  }

  // 12. Add index for nextRetryAt on sync_outbox if missing
  if (db.objectStoreNames.contains("sync_outbox")) {
    const outboxStore = transaction.objectStore("sync_outbox");
    if (!outboxStore.indexNames.contains("nextRetryAt")) {
      outboxStore.createIndex("nextRetryAt", "nextRetryAt", { unique: false });
    }
  }
}


