/**
 * Life Atlas Finance: Module Public API
 */

// Domain models & types
export * from "./domain/models";
export * from "./domain/errors";
export * from "./domain/money";
export * from "./domain/validation";
export * from "./domain/ledger";

// Storage interfaces & implementations
export * from "./storage/interfaces";
export * from "./storage/secureStorageAdapter";
export * from "./storage/indexeddb/database";
export * from "./storage/indexeddb/migrations";
export * from "./storage/indexeddb/accountRepo";
export * from "./storage/indexeddb/transactionRepo";
export * from "./storage/indexeddb/categoryRepo";
export * from "./storage/indexeddb/savingsGoalRepo";
export * from "./storage/indexeddb/budgetRepo";
export * from "./storage/indexeddb/categorizationRuleRepo";
export * from "./storage/indexeddb/recurringRuleRepo";
export * from "./storage/indexeddb/conflictRepo";
export * from "./storage/indexeddb/auditRepo";
export * from "./storage/indexeddb/outboxRepo";
export * from "./storage/indexeddb/unitOfWork";

// Application services
export * from "./application/accountService";
export * from "./application/transactionService";
export * from "./application/balanceService";
export * from "./application/budgetService";
export * from "./application/savingsGoalService";
export * from "./application/categorizationService";
export * from "./application/recurringService";
export * from "./application/importService";
export * from "./application/forecastService";
export * from "./application/runwayService";
export * from "./application/budgetProjectionService";
export * from "./application/syncOutboxService";

// Infrastructure interfaces & parsers
export * from "./infrastructure/interfaces";
export * from "./infrastructure/statementParser";
export * from "./infrastructure/syncProtocol";

