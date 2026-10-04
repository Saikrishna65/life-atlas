"use client";

import { useState } from 'react';
import { Upload, X, Loader2, Image as ImageIcon } from 'lucide-react';
import Image from 'next/image';

interface ImageUploadProps {
  value: string;
  onChange: (url: string) => void;
  disabled?: boolean;
}

export function ImageUpload({
  value,
  onChange,
  disabled
}: ImageUploadProps) {
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
      <div className="relative w-full h-48 md:h-64 rounded-xl overflow-hidden group">
        <Image
          fill
          src={value}
          alt="Upload"
          className="object-cover transition-transform duration-300 group-hover:scale-105"
        />
        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center justify-center">
          <button
            type="button"
            onClick={() => onChange("")}
            className="p-3 bg-red-500 text-white rounded-full hover:bg-red-600 transition-colors shadow-lg"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full">
      <label 
        className={`flex flex-col items-center justify-center w-full h-48 md:h-64 border-2 border-dashed rounded-xl cursor-pointer transition-all duration-200 
          ${disabled || isUploading ? 'opacity-50 cursor-not-allowed bg-muted' : 'hover:bg-muted/50 border-muted-foreground/25 hover:border-accent'}`}
      >
        <div className="flex flex-col items-center justify-center pt-5 pb-6">
          {isUploading ? (
            <Loader2 className="w-10 h-10 mb-3 text-muted-foreground animate-spin" />
          ) : (
            <ImageIcon className="w-10 h-10 mb-3 text-muted-foreground" />
          )}
          <p className="mb-2 text-sm text-muted-foreground font-medium">
            {isUploading ? 'Uploading...' : (
              <span className="font-semibold text-foreground">Click to upload</span>
            )}
          </p>
          <p className="text-xs text-muted-foreground/75">
            SVG, PNG, JPG or GIF (MAX. 800x400px)
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
      {error && (
        <p className="mt-2 text-sm text-red-500 font-medium">
          {error}
        </p>
      )}
    </div>
  );
}
