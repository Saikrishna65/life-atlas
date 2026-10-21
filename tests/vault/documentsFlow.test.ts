import { test, describe, before, beforeEach } from "node:test";
import assert from "node:assert/strict";
import "fake-indexeddb/auto";

import {
  saveTrip,
  saveBooking,
  saveDocument,
  getDocument,
  getDocumentsForTrip,
  getDocumentsForBooking,
  deleteDocument,
  deleteTripCascade,
  deleteVaultDB,
} from "../../src/lib/vault/storage";
import {
  TripRecord,
  BookingRecord,
  DocumentAttachmentRecord,
} from "../../src/lib/vault/types";

describe("Trip Vault Phase 5: Offline Documents & PDF Ticket Vault Flow", () => {
  before(async () => {
    await deleteVaultDB();
  });

  beforeEach(async () => {
    await deleteVaultDB();
  });

  test("1. Offline Document Uploader with Binary Blob & MIME Type (REQ-DOC-01)", async () => {
    const trip: TripRecord = {
      id: "trip-doc-test",
      title: "Ladakh Bike Ride 2026",
      destination: "Leh, Ladakh",
      startDate: "2026-07-20T00:00:00.000Z",
      status: "PLANNING",
      travelStyle: "MOTORCYCLE",
      budgetTotal: 45000,
      currency: "INR",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    await saveTrip(trip);

    // Create a mock PDF binary blob
    const pdfContent = "%PDF-1.4\n1 0 obj\n<< /Title (IRCTC E-Ticket) >>\nendobj\ntrailer\n<< /Root 1 0 R >>\n%%EOF";
    const pdfBlob = new Blob([pdfContent], { type: "application/pdf" });

    const pdfDoc: DocumentAttachmentRecord = {
      id: "doc-irctc-pdf",
      tripId: "trip-doc-test",
      title: "IRCTC Kalka Shatabdi Confirmed E-Ticket",
      fileType: "PDF",
      fileName: "IRCTC_Ticket_2849182390.pdf",
      mimeType: "application/pdf",
      sizeBytes: pdfBlob.size,
      blobData: pdfBlob,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const savedDoc = await saveDocument(pdfDoc);
    assert.equal(savedDoc.id, "doc-irctc-pdf");
    assert.equal(savedDoc.fileType, "PDF");
    assert.equal(savedDoc.mimeType, "application/pdf");
    assert.ok(savedDoc.sizeBytes > 0);

    // Verify retrieval
    const retrieved = await getDocument("doc-irctc-pdf");
    assert.ok(retrieved);
    assert.equal(retrieved.title, "IRCTC Kalka Shatabdi Confirmed E-Ticket");
    assert.equal(retrieved.fileName, "IRCTC_Ticket_2849182390.pdf");
    assert.ok(retrieved.blobData);
  });

  test("2. In-App Offline Document Preview & Binary Integrity (REQ-DOC-02)", async () => {
    const pngBytes = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10, 0, 0, 0, 13, 73, 72, 68, 82]);
    const imageBlob = new Blob([pngBytes], { type: "image/png" });

    const imageDoc: DocumentAttachmentRecord = {
      id: "doc-boarding-pass-img",
      tripId: "trip-doc-test",
      title: "IndiGo Boarding Pass Screenshot",
      fileType: "IMAGE",
      fileName: "boarding_pass_6E205.png",
      mimeType: "image/png",
      sizeBytes: imageBlob.size,
      blobData: imageBlob,
      thumbnailDataUrl: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    await saveDocument(imageDoc);

    const doc = await getDocument("doc-boarding-pass-img");
    assert.ok(doc);
    assert.equal(doc.fileType, "IMAGE");
    assert.ok(doc.thumbnailDataUrl?.startsWith("data:image/png"));

    // Verify blob content can be converted without network
    let retrievedBlob: Blob;
    if (doc.blobData instanceof Blob) {
      retrievedBlob = doc.blobData;
    } else {
      retrievedBlob = new Blob([doc.blobData], { type: doc.mimeType });
    }
    const buffer = await retrievedBlob.arrayBuffer();
    assert.equal(buffer.byteLength, pngBytes.length);
  });

  test("3. Booking Association & Filter Query (REQ-DOC-03)", async () => {
    // Create a transport booking
    const booking: BookingRecord = {
      id: "bkg-delhi-flight",
      tripId: "trip-doc-test",
      category: "TRANSPORT",
      type: "FLIGHT",
      title: "Delhi to Leh IndiGo Flight",
      pnrNumber: "6EXY92",
      totalCost: 7500,
      currency: "INR",
      depositPaid: 7500,
      balanceDue: 0,
      status: "CONFIRMED",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    await saveBooking(booking);

    // Save document associated with this booking
    const docBlob = new Blob(["Flight confirmation details"], { type: "application/pdf" });
    const associatedDoc: DocumentAttachmentRecord = {
      id: "doc-flight-ticket",
      tripId: "trip-doc-test",
      bookingId: "bkg-delhi-flight",
      title: "IndiGo E-Ticket PDF",
      fileType: "PDF",
      fileName: "indigo_eticket_6EXY92.pdf",
      mimeType: "application/pdf",
      sizeBytes: docBlob.size,
      blobData: docBlob,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    await saveDocument(associatedDoc);

    // Query documents for this booking
    const bookingDocs = await getDocumentsForBooking("trip-doc-test", "bkg-delhi-flight");
    assert.equal(bookingDocs.length, 1);
    assert.equal(bookingDocs[0].id, "doc-flight-ticket");
    assert.equal(bookingDocs[0].bookingId, "bkg-delhi-flight");

    // All trip documents should include this document
    const allTripDocs = await getDocumentsForTrip("trip-doc-test");
    assert.ok(allTripDocs.some((d) => d.id === "doc-flight-ticket"));
  });

  test("4. Delete Document and Cascade Deletion on Trip Erasure", async () => {
    const singleDocBlob = new Blob(["Temporary doc"], { type: "text/plain" });
    const singleDoc: DocumentAttachmentRecord = {
      id: "doc-to-delete",
      tripId: "trip-doc-test",
      title: "Temporary Pass",
      fileType: "OTHER",
      fileName: "temp.txt",
      mimeType: "text/plain",
      sizeBytes: singleDocBlob.size,
      blobData: singleDocBlob,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    await saveDocument(singleDoc);
    assert.ok(await getDocument("doc-to-delete"));

    // Delete single document
    const deleted = await deleteDocument("doc-to-delete");
    assert.equal(deleted, true);
    assert.equal(await getDocument("doc-to-delete"), null);

    // Cascade delete whole trip
    await deleteTripCascade("trip-doc-test");
    const remainingDocs = await getDocumentsForTrip("trip-doc-test");
    assert.equal(remainingDocs.length, 0);
  });
});
