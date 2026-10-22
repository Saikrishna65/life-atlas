/**
 * Life Atlas: Android Trip Vault Data Models
 * Strict, reusable TypeScript schemas for all 15 Trip Vault pillars.
 */

export type ID = string;
export type ISODateString = string; // e.g. "2026-10-21T10:00:00.000Z"

// -----------------------------------------------------------------------------
// Common Enums & Primitives
// -----------------------------------------------------------------------------

export type TripStatus = "DRAFT" | "PLANNING" | "ACTIVE" | "COMPLETED" | "ARCHIVED";

export type TravelStyle =
  | "MOTORCYCLE"
  | "BACKPACKING"
  | "ROADTRIP"
  | "LEISURE"
  | "TREKKING"
  | "CYCLING"
  | "OTHER";

export type ActivityTimeSlot = "MORNING" | "AFTERNOON" | "EVENING" | "NIGHT";

export type DepartureTravelSlot = "MORNING" | "AFTERNOON" | "EVENING" | "NIGHT" | "OVERNIGHT";
export type ReturnTravelSlot = "EARLY_MORNING" | "MORNING" | "AFTERNOON" | "EVENING" | "NIGHT";

export type ActivityStatus = "PLANNED" | "IN_PROGRESS" | "COMPLETED" | "SKIPPED";

export type BookingCategory = "TRANSPORT" | "ACCOMMODATION";

export type TransportType = "TRAIN" | "FLIGHT" | "BUS" | "CAB" | "FERRY" | "SELF_DRIVE";

export type AccommodationType = "HOTEL" | "HOMESTAY" | "HOSTEL" | "CAMP" | "RESORT" | "OTHER";

export type BookingStatus = "CONFIRMED" | "WAITLISTED" | "TENTATIVE" | "CANCELLED";

export type DocumentFileType = "PDF" | "IMAGE" | "OTHER";

export type VehicleType = "MOTORCYCLE" | "SCOOTER" | "CAR" | "SUV" | "BICYCLE" | "OTHER";

export type DepositRefundStatus = "PENDING" | "REFUNDED" | "DEDUCTED";

export type FoodType = "SPECIALTY_DISH" | "RESTAURANT";

export type MealSlot = "BREAKFAST" | "LUNCH" | "DINNER" | "CAFE_CHAI" | "SNACK";

export type DietaryTag = "VEG" | "NON_VEG" | "VEGAN" | "JAIN" | "EGG";

export type ExpenseCategory =
  | "TRANSPORT"
  | "ACCOMMODATION"
  | "FOOD"
  | "RENTAL"
  | "FUEL"
  | "ACTIVITIES"
  | "PERMITS"
  | "SHOPPING"
  | "EMERGENCY"
  | "MISC";

export type PaymentMode = "CASH" | "UPI" | "CARD" | "NET_BANKING" | "OTHER";

export type PackingCategory =
  | "DOCUMENTS"
  | "CLOTHING"
  | "RIDING_GEAR"
  | "ELECTRONICS"
  | "TOILETRIES"
  | "FIRST_AID"
  | "CAMPING"
  | "MISC";

export type SafetyRole =
  | "POLICE"
  | "HOSPITAL"
  | "MOUNTAIN_RESCUE"
  | "EMBASSY"
  | "HOTEL_STAFF"
  | "PERSONAL_ICE"
  | "MECHANIC"
  | "OTHER";

export type WaypointCategory =
  | "VIEWPOINT"
  | "PASS"
  | "FUEL_PUMP"
  | "MECHANIC"
  | "MEDICAL"
  | "STAY"
  | "FOOD"
  | "CHECKPOST"
  | "HAZARD";

// -----------------------------------------------------------------------------
// Store 1: Trips
// -----------------------------------------------------------------------------

export interface DestinationStop {
  id: ID;
  name: string;
  region?: string;
  latitude?: number;
  longitude?: number;
  stayNights?: number;
  orderIndex: number;
}

export interface TripRecord {
  id: ID;
  title: string;
  subtitle?: string;
  destination: string;
  destinations?: DestinationStop[];
  startDate: ISODateString;
  endDate?: ISODateString;
  departureSlot?: DepartureTravelSlot;
  returnSlot?: ReturnTravelSlot;
  effectiveDays?: number;
  status: TripStatus;
  travelStyle: TravelStyle;
  coverImage?: string;
  budgetTotal: number;
  currency: string;
  companions?: string[];
  notes?: string;
  categoryBudgets?: Partial<Record<ExpenseCategory, number>>;
  waypoints?: WaypointRecord[];
  routeSegments?: RouteSegment[];
  medicalCard?: MedicalCardInfo;
  contingencies?: ContingencyPlan[];
  memories?: TripMemoryRecord[];
  completedAt?: ISODateString;
  createdAt: ISODateString;
  updatedAt: ISODateString;
}

// -----------------------------------------------------------------------------
// Store 2: Itineraries & Activities
// -----------------------------------------------------------------------------

export interface ItineraryActivity {
  id: ID;
  timeSlot: ActivityTimeSlot;
  startTime?: string; // "09:00"
  endTime?: string;   // "11:30"
  title: string;
  location?: string;
  latitude?: number;
  longitude?: number;
  estimatedCost?: number;
  status: ActivityStatus;
  notes?: string;
}

export interface ItineraryDayRecord {
  id: ID;
  tripId: ID;
  dayIndex: number; // 1, 2, 3...
  date: ISODateString;
  title: string;
  description?: string;
  weatherNote?: string;
  intensity?: "RELAXED" | "MODERATE" | "CHALLENGING";
  activities: ItineraryActivity[];
  createdAt: ISODateString;
  updatedAt: ISODateString;
}

// -----------------------------------------------------------------------------
// Store 3: Transport & Accommodation Bookings
// -----------------------------------------------------------------------------

export interface BookingRecord {
  id: ID;
  tripId: ID;
  category: BookingCategory;
  type: TransportType | AccommodationType;
  title: string;
  bookingReference?: string;
  pnrNumber?: string;
  carrierOrVendor?: string; // "IRCTC 12004", "IndiGo 6E-205", "Zostel Manali"
  seatOrRoomDetails?: string; // "Coach B3, Berth 42 (Side Lower)", "Deluxe Room 204"
  departureOrCheckInTime?: ISODateString;
  arrivalOrCheckOutTime?: ISODateString;
  departureOrPropertyAddress?: string;
  arrivalAddress?: string;
  totalCost: number;
  currency: string;
  depositPaid: number;
  balanceDue: number;
  status: BookingStatus;
  contactPhone?: string;
  notes?: string;
  documentIds?: ID[]; // Links to Store 4 (documents)
  createdAt: ISODateString;
  updatedAt: ISODateString;
}

// -----------------------------------------------------------------------------
// Store 4: Documents & PDF Attachments
// -----------------------------------------------------------------------------

export interface DocumentAttachmentRecord {
  id: ID;
  tripId: ID;
  bookingId?: ID; // Optional direct relation to BookingRecord
  title: string;
  fileType: DocumentFileType;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  blobData: Blob | ArrayBuffer;
  thumbnailDataUrl?: string; // Small low-res preview data URL
  createdAt: ISODateString;
  updatedAt: ISODateString;
}

// -----------------------------------------------------------------------------
// Store 5: Bike & Scooter Rentals
// -----------------------------------------------------------------------------

export interface VehicleRentalRecord {
  id: ID;
  tripId: ID;
  vehicleType: VehicleType;
  vehicleModel: string; // "Royal Enfield Himalayan 450"
  vehicleRegNumber: string; // "HP-01-AB-1234"
  vendorName: string;
  vendorPhone: string;
  pickupLocation: string;
  pickupTime: ISODateString;
  dropoffLocation: string;
  dropoffTime: ISODateString;
  startOdometerKm: number;
  endOdometerKm?: number;
  dailyRate: number;
  securityDeposit: number;
  depositPaymentMode: PaymentMode;
  depositRefundStatus: DepositRefundStatus;
  depositRefundedDate?: ISODateString;
  conditionNotes?: string;
  gearIncluded: string[]; // ["Helmet x2", "Bungee Cords", "Panniers"]
  inspectionPhotos: string[]; // Thumbnail / Data URLs of pre-existing scratches
  createdAt: ISODateString;
  updatedAt: ISODateString;
}

// -----------------------------------------------------------------------------
// Store 6: Food & Restaurant Planner
// -----------------------------------------------------------------------------

export interface FoodPlannerRecord {
  id: ID;
  tripId: ID;
  name: string;
  type: FoodType;
  cuisine?: string;
  location?: string;
  mealSlot: MealSlot;
  priceLevel: 1 | 2 | 3 | 4; // ₹, ₹₹, ₹₹₹, ₹₹₹₹
  dietaryTags: DietaryTag[];
  status: "TO_TRY" | "VISITED" | "SKIPPED";
  rating?: number; // 1 to 5
  reviewNotes?: string;
  mustOrderDish?: string;
  createdAt: ISODateString;
  updatedAt: ISODateString;
}

// -----------------------------------------------------------------------------
// Store 7: Budget & Expenses
// -----------------------------------------------------------------------------

export interface ExpenseRecord {
  id: ID;
  tripId: ID;
  title: string;
  amount: number;
  currency: string;
  category: ExpenseCategory;
  paidBy: string;
  paymentMode: PaymentMode;
  date: ISODateString;
  isDeposit: boolean;
  depositRefundStatus?: DepositRefundStatus;
  refundAmount?: number;
  splitWith?: string[];
  receiptDocumentId?: ID;
  notes?: string;
  createdAt: ISODateString;
  updatedAt: ISODateString;
}

// -----------------------------------------------------------------------------
// Store 8: Packing Lists & Equipment Checklists
// -----------------------------------------------------------------------------

export interface PackingItemRecord {
  id: ID;
  tripId: ID;
  category: PackingCategory;
  name: string;
  quantity: number;
  isEssential: boolean;
  isPacked: boolean;
  notes?: string;
  createdAt: ISODateString;
  updatedAt: ISODateString;
}

// -----------------------------------------------------------------------------
// Store 9: Safety Contacts & Emergency Medical Info
// -----------------------------------------------------------------------------

export interface MedicalCardInfo {
  bloodGroup: string;
  allergies: string[];
  emergencyMedications: string[];
  insuranceProvider?: string;
  insurancePolicyNumber?: string;
  cashlessHotline?: string;
  specialInstructions?: string;
}

export interface ContingencyPlan {
  id: ID;
  tripId: ID;
  title: string; // "Rohtang Pass Closure Backup"
  triggerCondition: string; // "Heavy snowfall or landslide"
  backupPlan: string; // "Route through Atal Tunnel or overnight at Sissu"
  alternateRouteNotes?: string;
  createdAt: ISODateString;
}

export interface SafetyContactRecord {
  id: ID;
  tripId: ID;
  name: string;
  role: SafetyRole;
  phone: string;
  alternatePhone?: string;
  address?: string;
  isEmergency: boolean;
  notes?: string;
  medicalInfo?: MedicalCardInfo;
  createdAt: ISODateString;
  updatedAt: ISODateString;
}

// -----------------------------------------------------------------------------
// Store 10: Local Notification Reminders
// -----------------------------------------------------------------------------

export interface ReminderRecord {
  id: ID;
  tripId: ID;
  title: string;
  body: string;
  triggerTime: ISODateString;
  relatedType?: "TRANSPORT" | "ACCOMMODATION" | "RENTAL" | "CUSTOM";
  relatedEntityId?: ID;
  nativeNotificationId?: number;
  isTriggered: boolean;
  isCancelled: boolean;
  createdAt: ISODateString;
  updatedAt: ISODateString;
}

// -----------------------------------------------------------------------------
// Supporting Models: Waypoints, Memories & AI Assistant
export interface RouteSegment {
  id: ID;
  tripId: ID;
  fromStop: string;
  toStop: string;
  distanceKm: number;
  estimatedHours: number;
  terrainType: "HIGH_ALTITUDE_PASS" | "MOUNTAIN_TWISTIES" | "DESERT_HIGHWAY" | "COASTAL_ROAD" | "OFF_ROAD_TRAIL" | "EXPRESSWAY";
  roadCondition: "EXCELLENT" | "PAVED_GOOD" | "POTHOLES" | "GRAVEL_UNPAVED" | "WATER_CROSSING" | "EXTREME";
  highestElevationMeters?: number;
  passNames?: string[];
  advisoryNotes?: string;
  orderIndex: number;
  createdAt: ISODateString;
}

export interface WaypointRecord {
  id: ID;
  tripId: ID;
  title: string;
  category: WaypointCategory;
  latitude: number;
  longitude: number;
  elevationMeters?: number;
  notes?: string;
  createdAt: ISODateString;
}

export interface TripMemoryRecord {
  id: ID;
  tripId: ID;
  title: string;
  date: ISODateString;
  location?: string;
  caption?: string;
  imageDataUrl?: string;
  isHighlight: boolean;
  rating?: number;
  createdAt: ISODateString;
}

export interface AIPendingActivity {
  timeSlot: ActivityTimeSlot;
  startTime?: string;
  title: string;
  notes?: string;
}

export interface AIPendingDay {
  dayNumber: number;
  title: string;
  highlights: string[];
  suggestedStayArea?: string;
  intensity?: "RELAXED" | "MODERATE" | "CHALLENGING";
  activities?: AIPendingActivity[];
}

export interface AIPendingPlan {
  destination: string;
  durationDays: number;
  travelStyle: TravelStyle;
  budgetEstimate: number;
  generatedDays: AIPendingDay[];
  suggestedGear: string[];
  localAdvisories: string[];
  isOfflineFallback?: boolean;
}

export interface PNRParseResult {
  pnrNumber: string;
  carrier: string;
  trainOrFlightNumber: string;
  category: BookingCategory;
  transportType?: TransportType;
  accommodationType?: AccommodationType;
  departureDate?: string;
  departureTime?: string;
  arrivalDate?: string;
  arrivalTime?: string;
  departureStation?: string;
  arrivalStation?: string;
  coachBerthDetails?: string;
  passengers?: string[];
  totalFare?: number;
  seatNumbers?: string;
  rawText?: string;
  confidenceScore?: number;
}

// -----------------------------------------------------------------------------
// Store Name Mapping Type
// -----------------------------------------------------------------------------

export type VaultStoreName =
  | "trips"
  | "itineraries"
  | "bookings"
  | "documents"
  | "rentals"
  | "food_items"
  | "expenses"
  | "packing_items"
  | "safety_contacts"
  | "reminders";

export interface VaultStoreMap {
  trips: TripRecord;
  itineraries: ItineraryDayRecord;
  bookings: BookingRecord;
  documents: DocumentAttachmentRecord;
  rentals: VehicleRentalRecord;
  food_items: FoodPlannerRecord;
  expenses: ExpenseRecord;
  packing_items: PackingItemRecord;
  safety_contacts: SafetyContactRecord;
  reminders: ReminderRecord;
}
