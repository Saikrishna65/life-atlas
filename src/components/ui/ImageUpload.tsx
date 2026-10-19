"use client";

import { useState } from 'react';
import { X, Loader2, Image as ImageIcon } from 'lucide-react';
import Image from 'next/image';

interface ImageUploadProps {
  value: string;
  onChange: (url: string) => void;
  disabled?: boolean;
  theme?: "light" | "dark";
}

export function ImageUpload({
  value,
  onChange,
  disabled,
  theme = "light",
}: ImageUploadProps) {
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isDark = theme === "dark";

  const onUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    try {
      const file = e.target.files?.[0];
      if (!file) return;

      setIsUploading(true);
      setError(null);

      const formData = new FormData();
      formData.append('file', file);

      const response = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        throw new Error('Upload failed');
      }

      const data = await response.json();
      onChange(data.url);
    } catch (err) {
      console.error(err);
      setError('Failed to upload image. Please try again.');
    } finally {
      setIsUploading(false);
    }
  };

  if (value) {
    return (
      <div className={`relative w-full h-44 md:h-56 rounded-xl overflow-hidden group border ${isDark ? 'border-white/10 bg-[#0d1017]' : 'border-muted bg-surface'}`}>
        <Image
          fill
          unoptimized
          src={value}
          alt="Upload preview"
          className="object-cover transition-transform duration-300 group-hover:scale-105"
        />
        <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center justify-center">
          <button
            type="button"
            onClick={() => onChange("")}
            className="p-2.5 bg-rose-600/90 text-white rounded-full hover:bg-rose-500 transition-colors shadow-lg active:scale-95"
            aria-label="Remove image"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full space-y-2.5">
      <label 
        className={`flex flex-col items-center justify-center w-full h-36 md:h-44 border-2 border-dashed rounded-xl cursor-pointer transition-all duration-200 
          ${isDark 
            ? (disabled || isUploading ? 'opacity-50 cursor-not-allowed bg-white/[0.02] border-white/10' : 'bg-[#10141d]/70 hover:bg-[#141a26] border-white/10 hover:border-amber-400/40')
            : (disabled || isUploading ? 'opacity-50 cursor-not-allowed bg-muted' : 'hover:bg-muted/50 border-muted-foreground/25 hover:border-accent')
          }`}
      >
        <div className="flex flex-col items-center justify-center pt-4 pb-5 px-4 text-center">
          {isUploading ? (
            <Loader2 className={`w-8 h-8 mb-2.5 animate-spin ${isDark ? 'text-amber-400/80' : 'text-muted-foreground'}`} />
          ) : (
            <ImageIcon className={`w-8 h-8 mb-2.5 ${isDark ? 'text-neutral-500 group-hover:text-amber-400' : 'text-muted-foreground'}`} />
          )}
          <p className="mb-0.5 text-xs font-sans font-medium">
            {isUploading ? (
              <span className={isDark ? 'text-amber-300' : 'text-muted-foreground'}>Uploading media to archive...</span>
            ) : (
              <span className={isDark ? 'text-[#f5f2eb]' : 'text-foreground'}>Click to upload photo</span>
            )}
          </p>
          <p className={`text-[11px] font-sans ${isDark ? 'text-neutral-500' : 'text-muted-foreground/75'}`}>
            PNG, JPG, WEBP, GIF
          </p>
        </div>
        <input 
          type="file" 
          className="hidden" 
          accept="image/*"
          onChange={onUpload}
          disabled={disabled || isUploading}
        />
      </label>

      <div className="flex items-center gap-2">
        <span className={`text-[10px] uppercase tracking-wider font-sans shrink-0 ${isDark ? 'text-neutral-500' : 'text-muted-foreground'}`}>
          or URL:
        </span>
        <input
          type="url"
          placeholder="https://images.unsplash.com/photo-..."
          className={`flex-1 px-3 py-2 text-xs rounded-lg outline-none transition-colors ${
            isDark 
              ? 'bg-[#10141d] border border-white/10 text-[#f5f2eb] placeholder:text-neutral-600 focus:border-amber-400/40' 
              : 'bg-surface border border-muted focus:border-foreground'
          }`}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              const val = (e.currentTarget.value || '').trim();
              if (val) onChange(val);
            }
          }}
          onBlur={(e) => {
            const val = (e.currentTarget.value || '').trim();
            if (val) onChange(val);
          }}
          disabled={disabled || isUploading}
        />
      </div>

      {error && (
        <p className="mt-1.5 text-xs text-rose-400 font-sans">
          {error}
        </p>
      )}
    </div>
  );
}
