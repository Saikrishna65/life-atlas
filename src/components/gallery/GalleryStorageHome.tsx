"use client";
import Link from "next/link";
import {
  ArrowUpRight,
  Cloud,
  LockKeyhole,
  RefreshCw,
  Trash2,
  Download,
  Upload,
  Sparkles,
} from "lucide-react";
import type { StorageSummary } from "@/lib/r2/types";
export default function GalleryStorageHome({
  summary,
  pending,
  onPublic,
  onTransfers,
  onSmartSearch,
  onRecovery,
}: {
  summary?: StorageSummary;
  pending: number;
  onPublic: () => void;
  onTransfers: () => void;
  onSmartSearch: () => void;
  onRecovery: () => void;
}) {
  return (
    <section className="gs-home" aria-label="Backup and cloud">
      <div className="gc-intro">
        <span>YOUR ORIGINALS. STILL YOURS.</span>
        <h1>
          Keep them
          <br />
          close. And safe.
        </h1>
        <p>
          Phone files stay on your phone. Cloud copies are always a separate
          choice.
        </p>
      </div>
      <Link className="gs-private" href="/secret/gallery/library#backup">
        <LockKeyhole size={34} />
        <div>
          <small>ENCRYPTED PRIVATE BACKUP</small>
          <h2>A second home for your photos.</h2>
          <p>
            {summary?.private.configured
              ? "Private storage configured. Review your backup preferences."
              : "Connect private storage and choose the albums you want to protect."}
          </p>
          <b>
            Manage private backup <ArrowUpRight size={18} />
          </b>
        </div>
      </Link>
      <div className="gs-actions">
        <button onClick={onRecovery}>
          <LockKeyhole />
          <span>
            <strong>Save names & organisation</strong>
            <small>
              Encrypted recovery for your photo analysis and corrections
            </small>
          </span>
          <ArrowUpRight />
        </button>
        <button onClick={onSmartSearch}>
          <Sparkles />
          <span>
            <strong>Smart photo search</strong>
            <small>Find scenes and words, privately on your phone</small>
          </span>
          <ArrowUpRight />
        </button>
        <Link href="/secret/gallery/library#library">
          <LockKeyhole />
          <span>
            <strong>Private cloud library</strong>
            <small>Unlock and browse encrypted copies</small>
          </span>
          <ArrowUpRight />
        </Link>
        <button onClick={onPublic}>
          <Cloud />
          <span>
            <strong>Public cloud files</strong>
            <small>Media approved for public storage</small>
          </span>
          <ArrowUpRight />
        </button>
        <button onClick={onTransfers}>
          <Upload />
          <span>
            <strong>Transfers</strong>
            <small>
              {pending
                ? `${pending} uploads or downloads need attention`
                : "View uploads, downloads and retries"}
            </small>
          </span>
          <ArrowUpRight />
        </button>
        <Link href="/secret/gallery/library#trash">
          <Trash2 />
          <span>
            <strong>Trash & restore</strong>
            <small>Separate phone and cloud recovery</small>
          </span>
          <ArrowUpRight />
        </Link>
        <Link href="/secret/gallery/library#import">
          <Download />
          <span>
            <strong>Import Google Photos</strong>
            <small>Bring your Takeout ZIP archives</small>
          </span>
          <ArrowUpRight />
        </Link>
        <Link href="/secret/control-room">
          <RefreshCw />
          <span>
            <strong>Storage connection</strong>
            <small>Credentials, recovery kit and connection tests</small>
          </span>
          <ArrowUpRight />
        </Link>
      </div>
    </section>
  );
}
