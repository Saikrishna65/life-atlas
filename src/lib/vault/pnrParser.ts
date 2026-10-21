/**
 * Life Atlas: Intelligent PNR & Booking Confirmation Parser
 * 100% Offline-First Regex & Natural Language Extraction Engine.
 * Supports IRCTC Train SMS/Email, Flight Confirmations (IndiGo, Air India, SpiceJet),
 * and Bus/Stay vouchers.
 */

import { PNRParseResult, BookingCategory, TransportType } from "./types";

export interface SampleConfirmationText {
  id: string;
  label: string;
  type: string;
  text: string;
}

export const SAMPLE_CONFIRMATION_TEXTS: SampleConfirmationText[] = [
  {
    id: "sample_irctc_train",
    label: "IRCTC Train SMS (Shatabdi Express)",
    type: "TRAIN",
    text: `PNR:2458901234, TRAIN:12004/LKO SHTBDI EXP, DOCT:18-Nov-2026, 3A, NDLS(06:10) to LKO(12:40), 1.SAI KRISHNA(M26) CNF/B3/42/SL, FARE:Rs.1465, Enjoy free WiFi on board - IRCTC`,
  },
  {
    id: "sample_indigo_flight",
    label: "IndiGo Flight Confirmation",
    type: "FLIGHT",
    text: `IndiGo Booking Confirmed!
Booking Reference (PNR): W47K9X
Flight: 6E-205 from New Delhi (DEL) to Leh Kushok Bakula (IXL)
Date: 12-Oct-2026, Departure: 05:45 AM, Terminal: T1
Passenger: Sai Krishna, Seat: 14A, Class: Economy
Total Paid: INR 6,850. Gate closes 25 mins prior to departure.`,
  },
  {
    id: "sample_bus_booking",
    label: "Zingbus Volvo 9600 SMS",
    type: "BUS",
    text: `Zingbus Booking Confirmed! Ticket/PNR: ZB-9871234.
Bus: Volvo 9600 Luxury Sleeper (HR-38-A-9988)
From: Majnu Ka Tila, Delhi (21:30 hrs, 20-Oct-2026)
To: Private Bus Stand, Manali (08:30 hrs)
Seat: 4 (Lower Single Sleeper). Total Amount: Rs. 1650. Helpline: 011-45678900.`,
  },
  {
    id: "sample_hotel_stay",
    label: "Zostel / Stay Voucher",
    type: "STAY",
    text: `Booking Confirmed at Zostel Spiti Valley (Kaza)!
Booking ID: ZOS-SPITI-84729
Check-in: 15-Jun-2026 from 12:00 PM
Check-out: 18-Jun-2026 until 10:00 AM
Room: 6-Bed Mixed Dormitory (Bed 3)
Address: Village Kaza, Spiti Valley, Himachal Pradesh - 172114
Total Amount: Rs. 2,850 (Deposit Paid: Rs. 1,000, Balance Due: Rs. 1,850). Phone: +91 98160 55443.`,
  },
];

/**
 * Parses raw SMS, WhatsApp, or email confirmation text into structured booking parameters.
 */
export function parseBookingText(rawText: string): PNRParseResult {
  const text = (rawText || "").trim();
  if (!text) {
    return {
      pnrNumber: "",
      carrier: "",
      trainOrFlightNumber: "",
      category: "TRANSPORT",
      rawText: "",
      confidenceScore: 0,
    };
  }

  let pnrNumber = "";
  let carrier = "";
  let trainOrFlightNumber = "";
  let category: BookingCategory = "TRANSPORT";
  let transportType: TransportType | undefined = undefined;
  let departureDate: string | undefined = undefined;
  let departureTime: string | undefined = undefined;
  let arrivalDate: string | undefined = undefined;
  let arrivalTime: string | undefined = undefined;
  let departureStation: string | undefined = undefined;
  let arrivalStation: string | undefined = undefined;
  let coachBerthDetails: string | undefined = undefined;
  const passengers: string[] = [];
  let totalFare: number | undefined = undefined;
  let seatNumbers: string | undefined = undefined;
  let confidencePoints = 0;

  // 1. PNR Number Extraction
  // IRCTC 10-digit PNR
  const irctcMatch = text.match(/(?:PNR|pnr)\s*[:\s-]?\s*([0-9]{3}[-\s]?[0-9]{7}|[0-9]{10})\b/i);
  if (irctcMatch) {
    pnrNumber = irctcMatch[1].replace(/[-\s]/g, "");
    confidencePoints += 3;
    transportType = "TRAIN";
  } else {
    // Flight / Bus Alpha-numeric PNR (e.g. W47K9X or ZB-9871234 or Booking ID: ZOS-84729)
    const flightMatch = text.match(
      /(?:(?:Booking\s+(?:Reference|Ref|ID|Id|Code)(?:\s*\([A-Za-z0-9]+\))?)|(?:Ticket(?:\/PNR)?)|(?:PNR(?:\s+Number|\s+No\.?)?))\s*[:\s-]?\s*([A-Za-z0-9_-]{5,15})\b/i
    );
    if (flightMatch) {
      pnrNumber = flightMatch[1].trim();
      confidencePoints += 3;
    }
  }

  // 2. Identify Category & Carrier
  const lower = text.toLowerCase();
  if (lower.includes("irctc") || lower.includes("train") || lower.includes("shtbdi") || lower.includes("exp") || lower.includes("berth")) {
    category = "TRANSPORT";
    transportType = "TRAIN";
    carrier = "Indian Railways (IRCTC)";
    confidencePoints += 2;
  } else if (lower.includes("flight") || lower.includes("indigo") || lower.includes("air india") || lower.includes("spicejet") || lower.includes("vistara") || lower.includes("terminal")) {
    category = "TRANSPORT";
    transportType = "FLIGHT";
    confidencePoints += 2;
    if (lower.includes("indigo")) carrier = "IndiGo Airlines";
    else if (lower.includes("air india")) carrier = "Air India";
    else if (lower.includes("spicejet")) carrier = "SpiceJet";
    else if (lower.includes("vistara")) carrier = "Vistara";
    else carrier = "Airlines Flight";
  } else if (lower.includes("bus") || lower.includes("zingbus") || lower.includes("redbus") || lower.includes("sleeper") || lower.includes("volvo")) {
    category = "TRANSPORT";
    transportType = "BUS";
    confidencePoints += 2;
    if (lower.includes("zingbus")) carrier = "Zingbus";
    else if (lower.includes("redbus")) carrier = "redBus Operator";
    else carrier = "Intercity Bus";
  } else if (lower.includes("check-in") || lower.includes("hotel") || lower.includes("resort") || lower.includes("zostel") || lower.includes("dorm")) {
    category = "ACCOMMODATION";
    confidencePoints += 2;
    if (lower.includes("zostel")) carrier = "Zostel";
    else carrier = "Hotel / Homestay";
  }

  // 3. Train or Flight Number
  // e.g. TRAIN:12004/LKO SHTBDI EXP or Flight: 6E-205 or Bus: Volvo 9600
  const trainMatch = text.match(/(?:TRAIN|Train|Train No\.?)\s*[:\s-]?\s*([0-9]{5}(?:\s*\/[A-Za-z0-9\s]+)?)/i);
  if (trainMatch) {
    trainOrFlightNumber = trainMatch[1].trim();
    confidencePoints += 2;
  } else {
    const flightNoMatch = text.match(/(?:Flight|FLIGHT)\s*[:\s-]?\s*([A-Za-z0-9]{2}\s*[-]?\s*[0-9]{3,4})/i);
    if (flightNoMatch) {
      trainOrFlightNumber = flightNoMatch[1].trim();
      confidencePoints += 2;
    } else {
      const busMatch = text.match(/(?:Bus|BUS)\s*[:\s-]?\s*([A-Za-z0-9\s-]{4,25}?)(?=\n|From|Seat|,)/i);
      if (busMatch) {
        trainOrFlightNumber = busMatch[1].trim();
        confidencePoints += 1;
      }
    }
  }

  // 4. Stations / Route extraction
  // e.g. NDLS(06:10) to LKO(12:40) or from New Delhi (DEL) to Leh Kushok Bakula (IXL)
  const routeMatch = text.match(
    /(?:From|from|FROM)\s*[:\s-]?\s*([A-Za-z0-9\s,()-]+?)\s+(?:to|TO|To)\s+([A-Za-z0-9\s,()-]+?)(?=\n|,|\.|\s*(?:Date|Departure|Seat|DOCT|1\.))/i
  );
  if (routeMatch) {
    departureStation = routeMatch[1].trim();
    arrivalStation = routeMatch[2].trim();
    confidencePoints += 2;
  } else {
    const shortRoute = text.match(/([A-Z]{3,4})\s*(?:\([0-9:]+\))?\s*(?:to|-)\s*([A-Z]{3,4})/);
    if (shortRoute) {
      departureStation = shortRoute[1];
      arrivalStation = shortRoute[2];
      confidencePoints += 1;
    }
  }

  // 5. Departure Date & Time extraction
  // Date match: 18-Nov-2026, 12/11/2026, 2026-10-12
  const dateMatch = text.match(
    /(?:Date|DOCT|Check-in|DOJ|Departure Date)\s*[:\s-]?\s*([0-9]{1,2}[-/][0-9A-Za-z]{2,9}[-/][0-9]{2,4}|[0-9]{4}[-/][0-9]{2}[-/][0-9]{2})/i
  );
  if (dateMatch) {
    departureDate = dateMatch[1];
    confidencePoints += 2;
  }

  const arrDateMatch = text.match(
    /(?:Check-out|Arrival Date|Arr Date)\s*[:\s-]?\s*([0-9]{1,2}[-/][0-9A-Za-z]{2,9}[-/][0-9]{2,4}|[0-9]{4}[-/][0-9]{2}[-/][0-9]{2})/i
  );
  if (arrDateMatch) {
    arrivalDate = arrDateMatch[1];
  }

  // Time match: 06:10, 05:45 AM, 21:30 hrs
  const timeMatch = text.match(
    /(?:Dep|Departure|Time|at)\s*[:\s-]?\s*([0-9]{1,2}:[0-9]{2}(?:\s*(?:AM|PM|hrs|HRS))?)/i
  );
  if (timeMatch) {
    departureTime = timeMatch[1].trim();
    confidencePoints += 1;
  }

  // Arrival Time match: e.g. LKO(12:40) or Arr: 08:30 hrs
  const arrTimeMatch = text.match(/(?:to\s+[A-Za-z0-9]+\s*\(([0-9]{1,2}:[0-9]{2})\)|(?:Arr|Arrival)\s*[:\s-]?\s*([0-9]{1,2}:[0-9]{2}))/i);
  if (arrTimeMatch) {
    arrivalTime = (arrTimeMatch[1] || arrTimeMatch[2]).trim();
  }

  // 6. Coach / Seat / Berth details
  // e.g. CNF/B3/42/SL or Seat: 14A or Coach: B3, Berth: 42
  const cnfMatch = text.match(/CNF\s*\/\s*([A-Z0-9]+)\s*\/\s*([0-9]+)\s*(?:\/\s*([A-Za-z]+))?/i);
  if (cnfMatch) {
    coachBerthDetails = `Coach ${cnfMatch[1]}, Berth ${cnfMatch[2]}${cnfMatch[3] ? ` (${cnfMatch[3]})` : ""}`;
    seatNumbers = `${cnfMatch[1]}-${cnfMatch[2]}`;
    confidencePoints += 2;
  } else {
    const seatMatch = text.match(/(?:Seat|Berth|Room)\s*[:\s-]?\s*([A-Za-z0-9\s,-]+?)(?=\n|,|\.|\s*(?:Class|Total|Fare|Helpline))/i);
    if (seatMatch) {
      coachBerthDetails = seatMatch[1].trim();
      seatNumbers = seatMatch[1].trim();
      confidencePoints += 1;
    }
  }

  // 7. Total Fare / Cost
  // e.g. FARE:Rs.1465 or Total Paid: INR 6,850 or Total Amount: Rs. 2,850
  const fareMatch = text.match(/(?:FARE|Fare|Total\s*Paid|Total\s*Amount|Amount|Price)\s*[:\s-]?\s*(?:Rs\.?|INR|₹)?\s*([0-9,]+(?:\.[0-9]{2})?)/i);
  if (fareMatch) {
    const cleanFare = fareMatch[1].replace(/,/g, "");
    totalFare = parseFloat(cleanFare);
    confidencePoints += 1;
  }

  // 8. Passenger Names
  // e.g. 1.SAI KRISHNA(M26) or Passenger: Sai Krishna
  const pNameMatch = text.match(/(?:Passenger|Name|1\.)\s*[:\s-]?\s*([A-Za-z\s]+?)(?=\s*\([MF0-9]+\)|\n|,|\.|\s*(?:CNF|Seat|Class|Enjoy))/i);
  if (pNameMatch) {
    passengers.push(pNameMatch[1].trim());
    confidencePoints += 1;
  }

  const confidenceScore = Math.min(1.0, Math.round((confidencePoints / 12) * 100) / 100);

  return {
    pnrNumber,
    carrier,
    trainOrFlightNumber,
    category,
    transportType,
    departureDate,
    departureTime,
    arrivalDate,
    arrivalTime,
    departureStation,
    arrivalStation,
    coachBerthDetails,
    passengers,
    totalFare,
    seatNumbers,
    rawText: text,
    confidenceScore,
  };
}
