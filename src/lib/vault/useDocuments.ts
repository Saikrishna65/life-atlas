"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import {
  DocumentAttachmentRecord,
  DocumentFileType,
  ID,
} from "./types";
import {
  getDocumentsForTrip,
  saveDocument,
  deleteDocument as deleteDocStorage,
  isIndexedDBAvailable,
} from "./storage";
import { notifyVaultChange } from "./useTripVault";

export function useDocuments(tripId: string) {
  const [documents, setDocuments] = useState<DocumentAttachmentRecord[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const loadDocuments = useCallback(async () => {
    if (!tripId || !isIndexedDBAvailable()) {
      setIsLoading(false);
      return;
    }

    try {
      setError(null);
      const data = await getDocumentsForTrip(tripId);
      // Sort newest first
      data.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      setDocuments(data);
    } catch (err) {
      console.error("Failed loading documents from vault:", err);
      setError("Unable to load offline document vault.");
    } finally {
      setIsLoading(false);
    }
  }, [tripId]);

  useEffect(() => {
    let mounted = true;
    if (!tripId) return;

    (async () => {
      try {
        const data = await getDocumentsForTrip(tripId);
        if (mounted) {
          data.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
          setDocuments(data);
          setError(null);
        }
      } catch (err) {
        if (mounted) {
          console.error("Failed initial documents fetch:", err);
          setError("Failed to load documents.");
        }
      } finally {
        if (mounted) {
          setIsLoading(false);
        }
      }
    })();

    return () => {
      mounted = false;
    };
  }, [tripId]);

  // Upload a local file and store as binary Blob in IndexedDB
  const uploadDocument = useCallback(
    async (
      file: File,
      title: string,
      bookingId?: ID
    ): Promise<DocumentAttachmentRecord> => {
      const now = new Date().toISOString();
      const mimeType = file.type || "application/octet-stream";
      let fileType: DocumentFileType = "OTHER";

      if (mimeType === "application/pdf" || file.name.toLowerCase().endsWith(".pdf")) {
        fileType = "PDF";
      } else if (mimeType.startsWith("image/")) {
        fileType = "IMAGE";
      }

      // Generate thumbnail preview if it is an image
      let thumbnailDataUrl: string | undefined = undefined;
      if (fileType === "IMAGE") {
        try {
          thumbnailDataUrl = await new Promise<string>((resolve) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result as string);
            reader.onerror = () => resolve("");
            reader.readAsDataURL(file);
          });
        } catch {
          // Fallback to undefined thumbnail
        }
      }

      const newDoc: DocumentAttachmentRecord = {
        id: `doc-${tripId}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        tripId,
        bookingId: bookingId || undefined,
        title: title.trim() || file.name,
        fileName: file.name,
        fileType,
        mimeType,
        sizeBytes: file.size,
        blobData: file, // File is a subclass of Blob
        thumbnailDataUrl,
        createdAt: now,
        updatedAt: now,
      };

      const saved = await saveDocument(newDoc);
      setDocuments((prev) => [saved, ...prev]);
      notifyVaultChange();
      return saved;
    },
    [tripId]
  );

  // Delete a document
  const removeDocument = useCallback(async (docId: ID): Promise<boolean> => {
    const success = await deleteDocStorage(docId);
    if (success) {
      setDocuments((prev) => prev.filter((d) => d.id !== docId));
      notifyVaultChange();
    }
    return success;
  }, []);

  // Update document metadata (title or booking link)
  const updateDocumentMeta = useCallback(
    async (doc: DocumentAttachmentRecord): Promise<DocumentAttachmentRecord> => {
      const saved = await saveDocument(doc);
      setDocuments((prev) => prev.map((d) => (d.id === saved.id ? saved : d)));
      notifyVaultChange();
      return saved;
    },
    []
  );

  // Stats
  const stats = useMemo(() => {
    const totalCount = documents.length;
    const pdfCount = documents.filter((d) => d.fileType === "PDF").length;
    const imageCount = documents.filter((d) => d.fileType === "IMAGE").length;
    const totalBytes = documents.reduce((sum, d) => sum + (d.sizeBytes || 0), 0);
    return {
      totalCount,
      pdfCount,
      imageCount,
      totalBytes,
    };
  }, [documents]);

  return {
    documents,
    isLoading,
    error,
    stats,
    refreshDocuments: loadDocuments,
    uploadDocument,
    removeDocument,
    updateDocumentMeta,
  };
}
