/**
 * Life Atlas Finance: Notification Tracking Domain Models & Types
 * 
 * Defines contracts for Android native notification capture,
 * deterministic transaction parsing, and triple-source deduplication.
 */

import { ID, Paise, TransactionDirection, ISODateString } from "./models";

export type NotificationSourceType = "kotak_app" | "sms" | "truecaller";

/**
 * Raw notification payload captured by native Android NotificationListenerService
 */
export interface RawNotificationEvent {
  id: string;
  packageName: string;
  sender: string;
  title: string;
  text: string;
  postTime: number;
  postTimeIso: string;
  notificationKey?: string;
}

/**
 * Deterministically parsed transaction details extracted from notification text
 */
export interface ParsedNotificationTransaction {
  rawEventId: string;
  sourcePackage: string;
  sourceType: NotificationSourceType;
  amountPaise: Paise;
  direction: TransactionDirection;
  occurredAt: ISODateString;
  merchantOrBeneficiary: string;
  accountMask?: string; // Last 4 digits of account / card if present
  referenceNumber?: string; // UTR, RRN, or UPI/IMPS reference
  balanceAfterPaise?: Paise; // Optional reported available balance
  rawNotificationTitle: string;
  normalizedFingerprint: string;
  isAmbiguous: boolean;
  ambiguityReason?: string;
}

/**
 * Staged item in the review queue when account mapping or parsing confidence is low
 */
export interface NotificationReviewItem {
  id: string;
  rawEventId: string;
  parsedTransaction: ParsedNotificationTransaction;
  candidateAccountIds: ID[];
  suggestedCategoryId?: ID;
  reason: string;
  createdAt: ISODateString;
  status: "pending" | "approved" | "dismissed";
}

/**
 * Status information surfaced to UI and settings
 */
export interface NotificationTrackingStatus {
  enabled: boolean;
  permissionGranted: boolean;
  isNativeAndroid: boolean;
  lastEventTime: string | null;
  lastTransactionTime: string | null;
  lastError: string | null;
  eventsReceivedCount: number;
  duplicatesIgnoredCount: number;
  pendingCount: number;
  pendingReviewCount: number;
}

