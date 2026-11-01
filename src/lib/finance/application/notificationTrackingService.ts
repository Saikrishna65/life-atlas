/**
 * Life Atlas Finance: Kotak Notification Tracking Application Service
 * 
 * Bridges native Android notification listener with Life Atlas Finance ledger:
 * - Drains durable native pending queue when app starts or resumes.
 * - Handles triple-source deduplication across Kotak App, SMS, and Truecaller.
 * - Matches transactions to active Kotak accounts.
 * - Categorizes and records transactions in the double-entry integer-paise ledger.
 * - Manages review queue for ambiguous or unmapped accounts.
 * - Zero cloud transmission; completely local and private.
 */

import { Capacitor, registerPlugin } from "@capacitor/core";
import { IUnitOfWork } from "../storage/interfaces";
import { TransactionService } from "./transactionService";
import { CategorizationService } from "./categorizationService";
import {
  RawNotificationEvent,
  ParsedNotificationTransaction,
  NotificationReviewItem,
  NotificationTrackingStatus,
} from "../domain/notificationModels";
import { KotakNotificationParser } from "../infrastructure/kotakNotificationParser";
import { ID, FinanceAccount, Transaction } from "../domain/models";

export interface ParseAlertResult {
  success: boolean;
  parsed?: ParsedNotificationTransaction;
  matchedAccount?: FinanceAccount | null;
  suggestedCategory?: { categoryId: string; categoryName: string } | null;
  isDuplicate?: boolean;
  duplicateReason?: string;
  error?: string;
}

// Capacitor Plugin Interface Contract
export interface IKotakNativePlugin {
  isNotificationAccessGranted(): Promise<{ granted: boolean }>;
  requestNotificationAccess(): Promise<{ opened: boolean }>;
  getTrackingStatus(): Promise<{
    enabled: boolean;
    permissionGranted: boolean;
    lastEventTime: string | null;
    lastTransactionTime: string | null;
    lastError: string | null;
    eventsReceivedCount: number;
    duplicatesIgnoredCount: number;
    pendingCount: number;
  }>;
  setTrackingEnabled(options: { enabled: boolean }): Promise<{ enabled: boolean }>;
  getPendingNotifications(): Promise<{ notifications: RawNotificationEvent[]; count: number }>;
  acknowledgeNotifications(options: { ids: string[] }): Promise<{ success: boolean; remainingCount: number }>;
  recordTransactionProcessed(options: { timestamp: string }): Promise<{ success: boolean }>;
  recordDuplicateIgnored(): Promise<{ success: boolean; count: number }>;
  clearTrackingData(): Promise<{ success: boolean }>;
  requestReviewNotifications?(): Promise<{ granted: boolean }>;
  addListener(eventName: "notificationReceived", listener: (event: RawNotificationEvent) => void): Promise<{ remove: () => void }>;
}

let nativePluginInstance: IKotakNativePlugin | null = null;

function getNativePlugin(): IKotakNativePlugin | null {
  if (nativePluginInstance) return nativePluginInstance;
  if (Capacitor.isNativePlatform() && Capacitor.getPlatform() === "android" && Capacitor.isPluginAvailable("KotakNotificationTracker")) {
    try {
      nativePluginInstance = registerPlugin<IKotakNativePlugin>("KotakNotificationTracker");
      return nativePluginInstance;
    } catch (e) {
      console.warn("KotakNotificationTracker plugin registration failed:", e);
      return null;
    }
  }
  return null;
}

export class NotificationTrackingService {
  private processedFingerprints = new Set<string>();
  private reviewQueue: NotificationReviewItem[] = [];
  private operationQueue: Promise<unknown> = Promise.resolve();
  private listener: { remove: () => void } | null = null;
  private isListening = false;
  private lifecycle = 0;

  constructor(
    private readonly uow: IUnitOfWork,
    private readonly transactionService: TransactionService,
    private readonly categorizationService: CategorizationService,
    private readonly nativePluginOverride?: IKotakNativePlugin
  ) {}

  /**
   * Initializes real-time listener and drains pending offline queue
   */
  async initialize(): Promise<void> {
    const plugin = this.nativePluginOverride ?? getNativePlugin();
    if (!plugin) return;

    // Attach real-time listener once
    if (!this.isListening) {
      const lifecycle = this.lifecycle;
      this.isListening = true;
      try {
        const listener = await plugin.addListener("notificationReceived", () => {
          this.drainPendingNotifications().catch((error) => console.warn("Bank alert import failed", error));
        });
        if (lifecycle !== this.lifecycle) { await listener.remove(); return; }
        this.listener = listener;
      } catch (e) {
        this.isListening = false;
        console.warn("Could not register live notification listener:", e);
      }
    }

    // Drain queued events captured while app was closed
    await this.drainPendingNotifications();
  }

  /**
   * Drains and processes all pending notifications stored by native service
   */
  async drainPendingNotifications(): Promise<{ processed: number; duplicates: number }> {
    return this.serialize(async () => {
      const plugin = this.nativePluginOverride ?? getNativePlugin();
      if (!plugin) return { processed: 0, duplicates: 0 };
      const pending = await plugin.getPendingNotifications();
      const result = await this.processEvents(pending.notifications || []);
      if (typeof window !== "undefined") window.dispatchEvent(new Event("finance-notifications-updated"));
      return result;
    });
  }

  private serialize<T>(operation: () => Promise<T>): Promise<T> {
    const result = this.operationQueue.then(operation);
    this.operationQueue = result.catch(() => undefined);
    return result;
  }

  async dispose(): Promise<void> {
    this.lifecycle++;
    const listener = this.listener;
    this.listener = null;
    this.isListening = false;
    await listener?.remove();
  }

  /**
   * Deterministically parses a pasted Kotak SMS or notification alert text,
   * performs duplicate detection, matches accounts, and suggests categories.
   */
  async parseAlertText(text: string): Promise<ParseAlertResult> {
    if (!text || !text.trim()) {
      return {
        success: false,
        error: "Please enter or paste a valid Kotak transaction alert message.",
      };
    }

    const raw: RawNotificationEvent = {
      id: `manual_paste_${Date.now()}`,
      packageName: "com.msf.kbank.mobile",
      sender: "Kotak Bank",
      title: "Kotak Alert",
      text: text.trim(),
      postTime: Date.now(),
      postTimeIso: new Date().toISOString(),
    };

    const parseResult = KotakNotificationParser.parse(raw);
    if (!parseResult.success || !parseResult.transaction) {
      return {
        success: false,
        error:
          parseResult.rejectedReason ||
          "Could not detect transaction details. Please check the text format and ensure amounts and debit/credit are present.",
      };
    }

    const parsed = parseResult.transaction;
    const isDuplicate = await this.checkExistingLedgerDuplicate(parsed);
    const matchedAccount = await this.matchKotakAccount(parsed.accountMask);

    let suggestedCategory: { categoryId: string; categoryName: string } | null = null;
    try {
      const catResult = await this.categorizationService.suggestCategory({
        description: text.trim(),
        merchant: parsed.merchantOrBeneficiary,
        amountPaise: parsed.amountPaise,
        direction: parsed.direction,
      });
      if (catResult) {
        const allCats = await this.uow.categories.getAll();
        const catObj = allCats.find((c) => c.id === catResult.categoryId);
        suggestedCategory = {
          categoryId: catResult.categoryId,
          categoryName: catObj?.name || "Auto-categorized",
        };
      }
    } catch {
      // Categorization suggestion failure should not abort parsing
    }

    return {
      success: true,
      parsed,
      matchedAccount,
      suggestedCategory,
      isDuplicate,
      duplicateReason: isDuplicate
        ? parsed.referenceNumber
          ? `Transaction with reference "${parsed.referenceNumber}" is already recorded in the ledger.`
          : `A matching transaction with the same amount and merchant already exists on this date.`
        : undefined,
    };
  }

  /**
   * Commits a parsed and user-reviewed transaction into the official ledger
   */
  async confirmParsedTransaction(options: {
    parsed: ParsedNotificationTransaction;
    accountId: string;
    categoryId?: string;
    description?: string;
  }): Promise<Transaction> {
    return this.serialize(() => this.recordConfirmedTransaction(options));
  }

  private async recordConfirmedTransaction(options: {
    parsed: ParsedNotificationTransaction;
    accountId: string;
    categoryId?: string;
    description?: string;
  }): Promise<Transaction> {
    const { parsed, accountId, categoryId, description } = options;
    if (await this.checkExistingLedgerDuplicate(parsed)) throw new Error("This bank transaction is already recorded.");

    const recorded = await this.transactionService.recordTransaction({
      accountId,
      amountPaise: parsed.amountPaise,
      direction: parsed.direction,
      description: description?.trim() || parsed.merchantOrBeneficiary,
      merchant: parsed.merchantOrBeneficiary,
      categoryId,
      source: "manual",
      externalId: parsed.referenceNumber ? `kotak_notif_${parsed.referenceNumber}` : undefined,
      occurredAt: parsed.occurredAt,
      status: "posted",
      reviewRequired: parsed.isAmbiguous,
      notes: `[Kotak Smart Assistant] ${
        parsed.referenceNumber ? `Ref: ${parsed.referenceNumber}` : ""
      }`,
    });

    this.processedFingerprints.add(parsed.normalizedFingerprint);
    return recorded;
  }

  /**
   * Processes a batch of raw notification events with deduplication and ledger recording
   */
  async processRawEvents(
    events: RawNotificationEvent[]
  ): Promise<{ processed: number; duplicates: number }> {
    return this.serialize(() => this.processEvents(events));
  }

  private async processEvents(events: RawNotificationEvent[]): Promise<{ processed: number; duplicates: number }> {
    const plugin = this.nativePluginOverride ?? getNativePlugin();
    const ackIds: string[] = [];
    let processedCount = 0;
    let duplicateCount = 0;

    for (const raw of events) {
      const parseResult = KotakNotificationParser.parse(raw);

      if (!parseResult.success || !parseResult.transaction) {
        // Not a valid transaction (e.g. OTP, promotional, or unrecognized) -> ack and skip
        ackIds.push(raw.id);
        continue;
      }

      const parsed = parseResult.transaction;
      const fp = parsed.normalizedFingerprint;

      // 1. Triple-Source Deduplication Check
      // Check in-memory processed set
      if (this.processedFingerprints.has(fp)) {
        duplicateCount++;
        if (plugin) await plugin.recordDuplicateIgnored();
        ackIds.push(raw.id);
        continue;
      }

      // Check existing ledger records by externalId or fingerprint
      const isDuplicate = await this.checkExistingLedgerDuplicate(parsed);
      if (isDuplicate) {
        this.processedFingerprints.add(fp);
        duplicateCount++;
        if (plugin) await plugin.recordDuplicateIgnored();
        ackIds.push(raw.id);
        continue;
      }

      const staged = this.reviewQueue.find((item) => item.status === "pending" && item.parsedTransaction.normalizedFingerprint === fp);
      if (staged) {
        if (staged.rawEventId !== raw.id) { duplicateCount++; ackIds.push(raw.id); }
        continue;
      }

      const matchedAccount = await this.matchKotakAccount(parsed.accountMask);
      let categoryId: ID | undefined;
      let explanation = "No merchant rule matched. Please check the category.";
      try {
        const suggestion = await this.categorizationService.suggestCategory({
          description: raw.text, merchant: parsed.merchantOrBeneficiary,
          amountPaise: parsed.amountPaise, direction: parsed.direction,
        });
        if (suggestion) { categoryId = suggestion.categoryId; explanation = suggestion.ruleMatched ? `Rule matched: ${suggestion.ruleMatched}` : "Matched a merchant rule"; }
      } catch { /* Review remains available when categorisation fails. */ }
      if (!categoryId) categoryId = parsed.direction === "outflow" ? "cat_other_expense" : "cat_other_income";
      this.stageInReviewQueue(parsed,
        !matchedAccount ? "Choose the account, check the category, then approve." : "Check the suggested category before approving.",
        matchedAccount ? [matchedAccount.id] : [], categoryId, explanation);
      // Every SMS requires approval. Keep its durable native event until that decision.
      processedCount++;

    }

    // Acknowledge processed notifications from native queue
    if (plugin && ackIds.length > 0) {
      try {
        await plugin.acknowledgeNotifications({ ids: ackIds });
      } catch (e) {
        console.warn("Failed to acknowledge native notification IDs:", e);
      }
    }

    return { processed: processedCount, duplicates: duplicateCount };
  }

  /**
   * Matches candidate Kotak accounts in user's ledger
   */
  async matchKotakAccount(accountMask?: string): Promise<FinanceAccount | null> {
    const allAccounts = await this.uow.accounts.getAll("active");
    const bankAccounts = allAccounts.filter((a) =>
      (a.accountType === "bank" || a.accountType === "savings") &&
      (!a.metadata?.institutionName || a.metadata.institutionName.toLowerCase().includes("kotak"))
    );

    if (bankAccounts.length === 0) return null;

    // 1. Try matching by mask if account number / mask is known
    if (accountMask) {
      const matches = bankAccounts.filter((a) => {
        const metaMask = (a.metadata as Record<string, unknown> | undefined)?.accountNumberLast4 || 
                         (a.metadata as Record<string, unknown> | undefined)?.accountNumberMask;
        const nameHasMask = a.name.includes(accountMask);
        return (typeof metaMask === "string" && metaMask.endsWith(accountMask)) || nameHasMask;
      });
      // An explicit but unknown mask must never fall back to a different account.
      return matches.length === 1 ? matches[0] : null;
    }

    // 2. Try matching by name containing "Kotak" or institution "Kotak"
    const kotakAccounts = bankAccounts.filter((a) => {
      const nameMatch = a.name.toLowerCase().includes("kotak");
      const instMatch = a.metadata?.institutionName?.toLowerCase().includes("kotak");
      return nameMatch || instMatch;
    });

    if (kotakAccounts.length === 1) {
      return kotakAccounts[0];
    }

    // If multiple Kotak accounts exist and mask couldn't distinguish, return null to prompt review
    return null;
  }

  /**
   * Checks whether the transaction was already recorded in the ledger
   */
  private async checkExistingLedgerDuplicate(parsed: ParsedNotificationTransaction): Promise<boolean> {
    // 1. Check by external reference ID
    if (parsed.referenceNumber) {
      const existing = await this.uow.transactions.getByExternalId(`kotak_notif_${parsed.referenceNumber}`);
      if (existing) return true;
    }

    // 2. Check same-day matching amount & merchant
    const dayPrefix = parsed.occurredAt.split("T")[0];
    const sameDayTxns = await this.uow.transactions.query({
      startDate: `${dayPrefix}T00:00:00.000Z`,
      endDate: `${dayPrefix}T23:59:59.999Z`,
      direction: parsed.direction,
      minAmountPaise: parsed.amountPaise,
      maxAmountPaise: parsed.amountPaise,
    });

    for (const txn of sameDayTxns) {
      // Distinct bank references identify separate payments even for the same amount/payee.
      if (parsed.referenceNumber && txn.externalId?.startsWith("kotak_notif_") && txn.externalId !== `kotak_notif_${parsed.referenceNumber}`) continue;
      if (
        txn.merchant?.toLowerCase() === parsed.merchantOrBeneficiary.toLowerCase() ||
        txn.description.toLowerCase().includes(parsed.merchantOrBeneficiary.toLowerCase())
      ) {
        return true;
      }
    }

    return false;
  }

  private stageInReviewQueue(parsed: ParsedNotificationTransaction, reason: string, candidateAccountIds: ID[] = [], suggestedCategoryId?: ID, categoryExplanation?: string): void {
    if (this.reviewQueue.some((item) => item.status === "pending" && item.parsedTransaction.normalizedFingerprint === parsed.normalizedFingerprint)) return;
    const item: NotificationReviewItem = {
      id: `rev_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      rawEventId: parsed.rawEventId,
      parsedTransaction: parsed,
      candidateAccountIds,
      suggestedCategoryId,
      categoryExplanation,
      reason,
      createdAt: new Date().toISOString(),
      status: "pending",
    };
    this.reviewQueue.push(item);
  }

  /**
   * Returns current tracking status across Android settings and review items
   */
  async getStatus(): Promise<NotificationTrackingStatus> {
    const plugin = this.nativePluginOverride ?? getNativePlugin();
    const isNativeAndroid = Boolean(plugin && Capacitor.isNativePlatform() && Capacitor.getPlatform() === "android");

    if (plugin) {
      try {
        const nativeStatus = await plugin.getTrackingStatus();
        return {
          enabled: nativeStatus.enabled,
          permissionGranted: nativeStatus.permissionGranted,
          isNativeAndroid,
          lastEventTime: nativeStatus.lastEventTime,
          lastTransactionTime: nativeStatus.lastTransactionTime,
          lastError: nativeStatus.lastError,
          eventsReceivedCount: nativeStatus.eventsReceivedCount,
          duplicatesIgnoredCount: nativeStatus.duplicatesIgnoredCount,
          pendingCount: nativeStatus.pendingCount,
          pendingReviewCount: this.reviewQueue.filter((i) => i.status === "pending").length,
        };
      } catch (err: unknown) {
        console.warn("Failed to fetch native tracking status:", err);
      }
    }

    // Fallback status for web / non-Android environment
    return {
      enabled: false,
      permissionGranted: false,
      isNativeAndroid,
      lastEventTime: null,
      lastTransactionTime: null,
      lastError: isNativeAndroid ? null : "Notification tracking requires a native Android device installation.",
      eventsReceivedCount: 0,
      duplicatesIgnoredCount: 0,
      pendingCount: 0,
      pendingReviewCount: this.reviewQueue.filter((i) => i.status === "pending").length,
    };
  }

  /**
   * Toggles tracking enabled status in native Android preferences
   */
  async setTrackingEnabled(enabled: boolean): Promise<boolean> {
    const plugin = this.nativePluginOverride ?? getNativePlugin();
    if (!plugin) return false;
    const res = await plugin.setTrackingEnabled({ enabled });
    return res.enabled;
  }

  /**
   * Opens Android Notification Access system settings
   */
  async requestNotificationAccess(): Promise<void> {
    const plugin = this.nativePluginOverride ?? getNativePlugin();
    if (!plugin) return;
    await plugin.requestNotificationAccess();
  }

  async requestReviewNotifications(): Promise<boolean> {
    const plugin = this.nativePluginOverride ?? getNativePlugin();
    try { return (await plugin?.requestReviewNotifications?.())?.granted || false; }
    catch { return false; }
  }

  /**
   * Returns pending items in review queue
   */
  getReviewQueue(): NotificationReviewItem[] {
    return this.reviewQueue.filter((i) => i.status === "pending");
  }

  /**
   * Resolves a review queue item by assigning an account and category
   */
  async resolveReviewItem(
    itemId: string,
    accountId: ID,
    categoryId?: ID
  ): Promise<void> {
    return this.serialize(() => this.recordReviewedItem(itemId, accountId, categoryId));
  }

  private async recordReviewedItem(itemId: string, accountId: ID, categoryId?: ID): Promise<void> {
    const item = this.reviewQueue.find((i) => i.id === itemId);
    if (!item || item.status !== "pending") return;

    if (await this.checkExistingLedgerDuplicate(item.parsedTransaction)) {
      item.status = "approved";
      await this.acknowledgeFingerprint(item);
      this.announceUpdate();
      return;
    }
    const approvedCategory = categoryId || item.suggestedCategoryId;
    if (!approvedCategory) throw new Error("Select a category before approval.");
    await this.transactionService.recordTransaction({
      accountId,
      amountPaise: item.parsedTransaction.amountPaise,
      direction: item.parsedTransaction.direction,
      description: item.parsedTransaction.merchantOrBeneficiary,
      merchant: item.parsedTransaction.merchantOrBeneficiary,
      categoryId: approvedCategory,
      source: "notification",
      externalId: item.parsedTransaction.referenceNumber
        ? `kotak_notif_${item.parsedTransaction.referenceNumber}`
        : undefined,
      occurredAt: item.parsedTransaction.occurredAt,
      status: "posted",
      reviewRequired: false,
      notes: `[Auto-tracked from ${item.parsedTransaction.sourceType.toUpperCase()} - User Approved]`,
    });

    item.status = "approved";
    this.processedFingerprints.add(item.parsedTransaction.normalizedFingerprint);
    const plugin = this.nativePluginOverride ?? getNativePlugin();
    await plugin?.recordTransactionProcessed({ timestamp: new Date().toISOString() });
    await this.acknowledgeFingerprint(item);
    this.announceUpdate();
  }

  /**
   * Dismisses a review queue item without recording in ledger
   */
  async dismissReviewItem(itemId: string): Promise<void> {
    return this.serialize(() => this.dismissItem(itemId));
  }

  private async dismissItem(itemId: string): Promise<void> {
    const item = this.reviewQueue.find((i) => i.id === itemId);
    if (item?.status === "pending") {
      item.status = "dismissed";
      this.processedFingerprints.add(item.parsedTransaction.normalizedFingerprint);
      await this.acknowledgeFingerprint(item);
      this.announceUpdate();
    }
  }

  private async acknowledgeFingerprint(item: NotificationReviewItem): Promise<void> {
    const plugin = this.nativePluginOverride ?? getNativePlugin();
    if (!plugin) return;
    const pending = await plugin.getPendingNotifications();
    const ids = pending.notifications.filter((event) => {
      const result = KotakNotificationParser.parse(event);
      return result.transaction?.normalizedFingerprint === item.parsedTransaction.normalizedFingerprint;
    }).map((event) => event.id);
    await plugin.acknowledgeNotifications({ ids: ids.length ? ids : [item.rawEventId] });
  }

  private announceUpdate(): void {
    if (typeof window !== "undefined") window.dispatchEvent(new Event("finance-notifications-updated"));
  }

  /**
   * Clears tracking metadata and resets queue
   */
  async clearTrackingData(): Promise<void> {
    const plugin = this.nativePluginOverride ?? getNativePlugin();
    if (plugin) {
      await plugin.clearTrackingData();
    }
    this.processedFingerprints.clear();
    this.reviewQueue = [];
  }
}
