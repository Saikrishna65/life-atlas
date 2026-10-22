"use client";

import { useState } from "react";
import { 
  createTrip, 
  createPlace, 
  createPhoto, 
  createMemory, 
  createTimelineEvent 
} from "./actions";
import { ImageUpload } from "@/components/ui/ImageUpload";
import { Select } from "@/components/ui/Select";
import { CheckCircle2, AlertCircle } from "lucide-react";

type Tab = "trips" | "places" | "photos" | "memories" | "timeline";

interface StudioProps {
  variant?: "default" | "journal";
}

export default function Studio({ variant = "default" }: StudioProps) {
  const [activeTab, setActiveTab] = useState<Tab>("trips");
  const [status, setStatus] = useState<{ type: 'success' | 'error' | null, message: string }>({ type: null, message: '' });

  const [tripCoverUrl, setTripCoverUrl] = useState("");
  const [placeCoverUrl, setPlaceCoverUrl] = useState("");
  const [photoUrl, setPhotoUrl] = useState("");

  const isJournal = variant === "journal";

  const tabs: { id: Tab, label: string, subtitle: string }[] = [
    { id: "trips", label: "Trips", subtitle: "Log a journey" },
    { id: "places", label: "Places", subtitle: "Add destination" },
    { id: "photos", label: "Photos", subtitle: "Upload visual" },
    { id: "memories", label: "Memories", subtitle: "Capture moment" },
    { id: "timeline", label: "Timeline", subtitle: "Record milestone" },
  ];

  async function handleSubmit(action: (formData: FormData) => Promise<void>, e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setStatus({ type: null, message: '' });
    const formData = new FormData(e.currentTarget);
    try {
      await action(formData);
      setStatus({ type: 'success', message: 'Successfully inscribed in Atlas.' });
      (e.target as HTMLFormElement).reset();
      
      // Reset image states
      if (activeTab === "trips") setTripCoverUrl("");
      if (activeTab === "places") setPlaceCoverUrl("");
      if (activeTab === "photos") setPhotoUrl("");
      
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'An error occurred while saving entry.';
      setStatus({ type: 'error', message });
    }
  }

  // -------------------------------------------------------------
  // EDITORIAL TRAVEL JOURNAL VARIANT (Mobile-first, Life Atlas Light Theme)
  // -------------------------------------------------------------
  if (isJournal) {
    const inputClasses = "w-full bg-surface border border-muted text-foreground placeholder:text-muted-foreground/60 rounded-xl px-3.5 py-3 text-sm focus:border-accent focus:bg-background focus:ring-1 focus:ring-accent/20 outline-none transition-all duration-200 [color-scheme:light]";
    const labelClasses = "text-xs font-sans font-medium text-foreground/80 tracking-wide";

    return (
      <div className="rounded-2xl border border-muted bg-background shadow-soft overflow-hidden">
        {/* Mobile-Friendly Editorial Tab Strip */}
        <div className="p-2 sm:p-2.5 bg-surface border-b border-muted flex items-center gap-1.5 overflow-x-auto [scrollbar-width:none] [-ms-overflow-style:none]">
          {tabs.map((tab) => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => {
                  setActiveTab(tab.id);
                  setStatus({ type: null, message: '' });
                }}
                className={`px-4 py-2.5 rounded-xl text-xs font-sans tracking-wider uppercase transition-all duration-200 shrink-0 select-none ${
                  isActive
                    ? "bg-background text-foreground border border-muted shadow-xs font-semibold"
                    : "text-muted-foreground hover:text-foreground hover:bg-surface-hover border border-transparent font-medium"
                }`}
              >
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* Form Body */}
        <div className="p-5 sm:p-8 md:p-10 max-w-3xl">
          <header className="mb-8">
            <h2 className="font-display text-2xl sm:text-3xl text-foreground tracking-tight font-normal">
              {tabs.find((t) => t.id === activeTab)?.label}
            </h2>
            <p className="font-sans text-xs text-muted-foreground mt-1">
              {tabs.find((t) => t.id === activeTab)?.subtitle}
            </p>
          </header>

          {/* Feedback Banner */}
          {status.type && (
            <div
              className={`p-3.5 mb-6 rounded-xl text-xs font-sans flex items-center gap-2.5 ${
                status.type === 'success'
                  ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                  : 'bg-rose-50 text-rose-800 border border-rose-200'
              }`}
            >
              {status.type === 'success' ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              ) : (
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
              )}
              <span>{status.message}</span>
            </div>
          )}

          {/* TRIPS FORM */}
          {activeTab === "trips" && (
            <form onSubmit={(e) => handleSubmit(createTrip, e)} className="space-y-5">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5 sm:col-span-2">
                  <label className={labelClasses}>Trip Title *</label>
                  <input required type="text" name="title" placeholder="e.g. Autumn in Kyoto" className={inputClasses} />
                </div>
                <div className="space-y-1.5 sm:col-span-2">
                  <label className={labelClasses}>Destination *</label>
                  <input required type="text" name="destination" placeholder="e.g. Kyoto, Japan" className={inputClasses} />
                </div>
                <div className="space-y-1.5">
                  <label className={labelClasses}>Start Date *</label>
                  <input required type="date" name="startDate" className={inputClasses} />
                </div>
                <div className="space-y-1.5">
                  <label className={labelClasses}>End Date</label>
                  <input type="date" name="endDate" className={inputClasses} />
                </div>
                <div className="space-y-1.5 sm:col-span-2">
                  <label className={labelClasses}>Duration</label>
                  <input type="text" name="duration" placeholder="e.g. 12 Days" className={inputClasses} />
                </div>
              </div>
              <div className="space-y-1.5">
                <label className={labelClasses}>Description & Reflections</label>
                <textarea name="description" rows={3} placeholder="Notes from this expedition..." className={inputClasses} />
              </div>
              <div className="space-y-1.5">
                <label className={labelClasses}>Cover Photograph</label>
                <ImageUpload value={tripCoverUrl} onChange={setTripCoverUrl} />
                <input type="hidden" name="coverImage" value={tripCoverUrl} />
              </div>
              <button
                type="submit"
                className="mt-2 bg-foreground hover:bg-accent text-background font-sans font-semibold text-xs tracking-wider uppercase py-3.5 px-6 rounded-xl transition-all duration-200 shadow-sm active:scale-[0.98]"
              >
                Save Trip Entry
              </button>
            </form>
          )}

          {/* PLACES FORM */}
          {activeTab === "places" && (
            <form onSubmit={(e) => handleSubmit(createPlace, e)} className="space-y-5">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5 sm:col-span-2">
                  <label className={labelClasses}>Place Name *</label>
                  <input required type="text" name="name" placeholder="e.g. Lake Como" className={inputClasses} />
                </div>
                <div className="space-y-1.5">
                  <label className={labelClasses}>Country *</label>
                  <input required type="text" name="country" placeholder="e.g. Italy" className={inputClasses} />
                </div>
                <div className="space-y-1.5">
                  <label className={labelClasses}>Region / State</label>
                  <input type="text" name="region" placeholder="e.g. Lombardy" className={inputClasses} />
                </div>
                <div className="space-y-1.5 sm:col-span-2">
                  <label className={labelClasses}>City / Village</label>
                  <input type="text" name="city" placeholder="e.g. Bellagio" className={inputClasses} />
                </div>
                <div className="space-y-1.5">
                  <label className={labelClasses}>Latitude</label>
                  <input type="number" step="any" name="latitude" placeholder="e.g. 45.9871" className={inputClasses} />
                </div>
                <div className="space-y-1.5">
                  <label className={labelClasses}>Longitude</label>
                  <input type="number" step="any" name="longitude" placeholder="e.g. 9.2625" className={inputClasses} />
                </div>
              </div>
              <div className="space-y-1.5">
                <label className={labelClasses}>Description</label>
                <textarea name="description" rows={3} placeholder="Geographic and sensory impressions..." className={inputClasses} />
              </div>
              <div className="space-y-1.5">
                <label className={labelClasses}>Place Visual</label>
                <ImageUpload value={placeCoverUrl} onChange={setPlaceCoverUrl} />
                <input type="hidden" name="coverImage" value={placeCoverUrl} />
              </div>
              <button
                type="submit"
                className="mt-2 bg-foreground hover:bg-accent text-background font-sans font-semibold text-xs tracking-wider uppercase py-3.5 px-6 rounded-xl transition-all duration-200 shadow-sm active:scale-[0.98]"
              >
                Record Place
              </button>
            </form>
          )}

          {/* PHOTOS FORM */}
          {activeTab === "photos" && (
            <form onSubmit={(e) => handleSubmit(createPhoto, e)} className="space-y-5">
              <div className="space-y-1.5">
                <label className={labelClasses}>Photograph *</label>
                <ImageUpload value={photoUrl} onChange={setPhotoUrl} />
                <input type="hidden" name="url" value={photoUrl} required />
              </div>
              <div className="space-y-1.5">
                <label className={labelClasses}>Caption</label>
                <input type="text" name="caption" placeholder="Visual memory title or note" className={inputClasses} />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className={labelClasses}>Date Captured</label>
                  <input type="date" name="date" className={inputClasses} />
                </div>
                <div className="space-y-1.5">
                  <label className={labelClasses}>Feature in Highlights?</label>
                  <Select name="isFeatured" className={inputClasses}>
                    <option value="false">Standard Gallery</option>
                    <option value="true">Featured Highlight</option>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <label className={labelClasses}>Associated Trip ID (Optional)</label>
                  <input type="text" name="tripId" placeholder="Optional" className={inputClasses} />
                </div>
                <div className="space-y-1.5">
                  <label className={labelClasses}>Associated Place ID (Optional)</label>
                  <input type="text" name="placeId" placeholder="Optional" className={inputClasses} />
                </div>
              </div>
              <button
                type="submit"
                className="mt-2 bg-foreground hover:bg-accent text-background font-sans font-semibold text-xs tracking-wider uppercase py-3.5 px-6 rounded-xl transition-all duration-200 shadow-sm active:scale-[0.98]"
              >
                Archive Photo
              </button>
            </form>
          )}

          {/* MEMORIES FORM */}
          {activeTab === "memories" && (
            <form onSubmit={(e) => handleSubmit(createMemory, e)} className="space-y-5">
              <div className="space-y-1.5">
                <label className={labelClasses}>Memory Title *</label>
                <input required type="text" name="title" placeholder="e.g. Dawn at the ridge" className={inputClasses} />
              </div>
              <div className="space-y-1.5">
                <label className={labelClasses}>Date</label>
                <input type="date" name="date" className={inputClasses} />
              </div>
              <div className="space-y-1.5">
                <label className={labelClasses}>Reflection & Journal Entry</label>
                <textarea name="description" rows={4} placeholder="Write your memory here..." className={inputClasses} />
              </div>
              <button
                type="submit"
                className="mt-2 bg-foreground hover:bg-accent text-background font-sans font-semibold text-xs tracking-wider uppercase py-3.5 px-6 rounded-xl transition-all duration-200 shadow-sm active:scale-[0.98]"
              >
                Inscribe Memory
              </button>
            </form>
          )}

          {/* TIMELINE EVENT FORM */}
          {activeTab === "timeline" && (
            <form onSubmit={(e) => handleSubmit(createTimelineEvent, e)} className="space-y-5">
              <div className="space-y-1.5">
                <label className={labelClasses}>Event Title *</label>
                <input required type="text" name="title" placeholder="e.g. Crossed the Swiss Alps" className={inputClasses} />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className={labelClasses}>Event Category *</label>
                  <Select required name="type" className={inputClasses}>
                    <option value="TRIP">Trip Milestone</option>
                    <option value="MEMORY">Personal Reflection</option>
                    <option value="EXPERIENCE">Unique Experience</option>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <label className={labelClasses}>Date *</label>
                  <input required type="date" name="date" className={inputClasses} />
                </div>
              </div>
              <div className="space-y-1.5">
                <label className={labelClasses}>Chronicle Description</label>
                <textarea name="description" rows={3} placeholder="Details about this timeline marker..." className={inputClasses} />
              </div>
              <div className="space-y-1.5">
                <label className={labelClasses}>Reference ID (Optional)</label>
                <input type="text" name="referenceId" placeholder="Optional link to trip or memory" className={inputClasses} />
              </div>
              <button
                type="submit"
                className="mt-2 bg-foreground hover:bg-accent text-background font-sans font-semibold text-xs tracking-wider uppercase py-3.5 px-6 rounded-xl transition-all duration-200 shadow-sm active:scale-[0.98]"
              >
                Add to Timeline
              </button>
            </form>
          )}
        </div>
      </div>
    );
  }

  // -------------------------------------------------------------
  // DEFAULT VARIANT (Used on public /admin page to preserve website)
  // -------------------------------------------------------------
  return (
    <div className="flex flex-col lg:flex-row min-h-[calc(100vh-8rem)] rounded-md overflow-hidden shadow-2xl border border-muted bg-surface/50 backdrop-blur-xl">
      {/* Sidebar / Mobile Tabs */}
      <div className="lg:w-64 bg-surface/80 border-b lg:border-b-0 lg:border-r border-muted p-4 sm:p-6 flex flex-row lg:flex-col gap-2 overflow-x-auto lg:overflow-x-visible">
        <h2 className="hidden lg:block font-sans text-[10px] uppercase tracking-widest text-muted-foreground mb-4">Studio Control</h2>
        {tabs.map(tab => (
          <button 
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`text-left p-3 sm:p-4 rounded-sm transition-all duration-300 shrink-0 lg:shrink min-w-[110px] lg:min-w-0 ${activeTab === tab.id ? 'bg-background border-b-2 lg:border-b-0 lg:border-l-2 border-foreground shadow-sm' : 'hover:bg-muted/30 border-b-2 lg:border-b-0 lg:border-l-2 border-transparent'}`}
          >
            <h3 className={`font-display text-base sm:text-lg ${activeTab === tab.id ? 'text-foreground' : 'text-foreground/70'}`}>{tab.label}</h3>
            <p className="font-sans text-[9px] uppercase tracking-wider text-muted-foreground mt-0.5 sm:mt-1">{tab.subtitle}</p>
          </button>
        ))}
      </div>

      {/* Main Content Area */}
      <div className="flex-1 p-8 lg:p-12 overflow-y-auto relative bg-background/50">
        <div className="max-w-2xl">
          <h1 className="font-display text-4xl lg:text-5xl mb-2">{tabs.find(t => t.id === activeTab)?.label}</h1>
          <p className="font-sans text-xs uppercase tracking-widest text-muted-foreground mb-12">
            Add a new entry to the database
          </p>

          {status.type && (
            <div className={`p-4 mb-8 rounded-sm text-sm font-sans tracking-wide ${status.type === 'success' ? 'bg-green-500/10 text-green-700 dark:text-green-400 border border-green-500/20' : 'bg-red-500/10 text-red-700 dark:text-red-400 border border-red-500/20'}`}>
              {status.message}
            </div>
          )}

          {/* TRIPS FORM */}
          {activeTab === "trips" && (
            <form onSubmit={(e) => handleSubmit(createTrip, e)} className="space-y-6 flex flex-col font-body animate-fade-in-up">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="flex flex-col gap-2">
                  <label className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Trip Title *</label>
                  <input required type="text" name="title" className="p-3 bg-surface border border-muted focus:border-foreground outline-none transition-colors rounded-sm" />
                </div>
                <div className="flex flex-col gap-2">
                  <label className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Destination *</label>
                  <input required type="text" name="destination" className="p-3 bg-surface border border-muted focus:border-foreground outline-none transition-colors rounded-sm" />
                </div>
                <div className="flex flex-col gap-2">
                  <label className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Start Date *</label>
                  <input required type="date" name="startDate" className="p-3 bg-surface border border-muted focus:border-foreground outline-none transition-colors rounded-sm" />
                </div>
                <div className="flex flex-col gap-2">
                  <label className="text-xs font-bold uppercase tracking-widest text-muted-foreground">End Date</label>
                  <input type="date" name="endDate" className="p-3 bg-surface border border-muted focus:border-foreground outline-none transition-colors rounded-sm" />
                </div>
                <div className="flex flex-col gap-2 md:col-span-2">
                  <label className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Duration String</label>
                  <input type="text" name="duration" placeholder="e.g. 14 Days" className="p-3 bg-surface border border-muted focus:border-foreground outline-none transition-colors rounded-sm" />
                </div>
              </div>
              <div className="flex flex-col gap-2">
                <label className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Description</label>
                <textarea name="description" rows={3} className="p-3 bg-surface border border-muted focus:border-foreground outline-none transition-colors rounded-sm resize-none"></textarea>
              </div>
              <div className="flex flex-col gap-2">
                <label className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Cover Image</label>
                <ImageUpload value={tripCoverUrl} onChange={setTripCoverUrl} />
                <input type="hidden" name="coverImage" value={tripCoverUrl} />
              </div>
              <button type="submit" className="mt-4 bg-foreground text-background py-4 px-8 font-sans uppercase tracking-widest text-sm hover:bg-accent transition-colors self-start rounded-sm shadow-md">Submit Trip</button>
            </form>
          )}

          {/* PLACES FORM */}
          {activeTab === "places" && (
            <form onSubmit={(e) => handleSubmit(createPlace, e)} className="space-y-6 flex flex-col font-body animate-fade-in-up">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="flex flex-col gap-2 md:col-span-2">
                  <label className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Place Name *</label>
                  <input required type="text" name="name" className="p-3 bg-surface border border-muted focus:border-foreground outline-none transition-colors rounded-sm" />
                </div>
                <div className="flex flex-col gap-2">
                  <label className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Country *</label>
                  <input required type="text" name="country" className="p-3 bg-surface border border-muted focus:border-foreground outline-none transition-colors rounded-sm" />
                </div>
                <div className="flex flex-col gap-2">
                  <label className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Region / State</label>
                  <input type="text" name="region" className="p-3 bg-surface border border-muted focus:border-foreground outline-none transition-colors rounded-sm" />
                </div>
                <div className="flex flex-col gap-2">
                  <label className="text-xs font-bold uppercase tracking-widest text-muted-foreground">City</label>
                  <input type="text" name="city" className="p-3 bg-surface border border-muted focus:border-foreground outline-none transition-colors rounded-sm" />
                </div>
                <div className="flex flex-col gap-2">
                  <label className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Cover Image</label>
                  <ImageUpload value={placeCoverUrl} onChange={setPlaceCoverUrl} />
                  <input type="hidden" name="coverImage" value={placeCoverUrl} />
                </div>
                <div className="flex flex-col gap-2">
                  <label className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Latitude</label>
                  <input type="number" step="any" name="latitude" className="p-3 bg-surface border border-muted focus:border-foreground outline-none transition-colors rounded-sm" placeholder="e.g. 48.8566" />
                </div>
                <div className="flex flex-col gap-2">
                  <label className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Longitude</label>
                  <input type="number" step="any" name="longitude" className="p-3 bg-surface border border-muted focus:border-foreground outline-none transition-colors rounded-sm" placeholder="e.g. 2.3522" />
                </div>
              </div>
              <div className="flex flex-col gap-2">
                <label className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Description</label>
                <textarea name="description" rows={3} className="p-3 bg-surface border border-muted focus:border-foreground outline-none transition-colors rounded-sm resize-none"></textarea>
              </div>
              <button type="submit" className="mt-4 bg-foreground text-background py-4 px-8 font-sans uppercase tracking-widest text-sm hover:bg-accent transition-colors self-start rounded-sm shadow-md">Submit Place</button>
            </form>
          )}

          {/* PHOTOS FORM */}
          {activeTab === "photos" && (
            <form onSubmit={(e) => handleSubmit(createPhoto, e)} className="space-y-6 flex flex-col font-body animate-fade-in-up">
              <div className="flex flex-col gap-2">
                <label className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Image *</label>
                <ImageUpload value={photoUrl} onChange={setPhotoUrl} />
                <input type="hidden" name="url" value={photoUrl} required />
              </div>
              <div className="flex flex-col gap-2">
                <label className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Caption</label>
                <input type="text" name="caption" className="p-3 bg-surface border border-muted focus:border-foreground outline-none transition-colors rounded-sm" />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="flex flex-col gap-2">
                  <label className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Date Taken</label>
                  <input type="date" name="date" className="p-3 bg-surface border border-muted focus:border-foreground outline-none transition-colors rounded-sm" />
                </div>
                <div className="flex flex-col gap-2">
                  <label className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Feature on Homepage?</label>
                  <Select name="isFeatured" className="p-3 bg-surface border border-muted focus:border-foreground outline-none transition-colors rounded-sm">
                    <option value="false">No</option>
                    <option value="true">Yes</option>
                  </Select>
                </div>
              </div>
              <div className="flex flex-col gap-2">
                <label className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Link to Trip ID (Optional)</label>
                <input type="text" name="tripId" className="p-3 bg-surface border border-muted focus:border-foreground outline-none transition-colors rounded-sm" />
              </div>
              <div className="flex flex-col gap-2">
                <label className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Link to Place ID (Optional)</label>
                <input type="text" name="placeId" className="p-3 bg-surface border border-muted focus:border-foreground outline-none transition-colors rounded-sm" />
              </div>
              <button type="submit" className="mt-4 bg-foreground text-background py-4 px-8 font-sans uppercase tracking-widest text-sm hover:bg-accent transition-colors self-start rounded-sm shadow-md">Submit Photo</button>
            </form>
          )}

          {/* MEMORIES FORM */}
          {activeTab === "memories" && (
            <form onSubmit={(e) => handleSubmit(createMemory, e)} className="space-y-6 flex flex-col font-body animate-fade-in-up">
              <div className="flex flex-col gap-2">
                <label className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Title *</label>
                <input required type="text" name="title" className="p-3 bg-surface border border-muted focus:border-foreground outline-none transition-colors rounded-sm" />
              </div>
              <div className="flex flex-col gap-2">
                <label className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Description</label>
                <textarea name="description" rows={3} className="p-3 bg-surface border border-muted focus:border-foreground outline-none transition-colors rounded-sm resize-none"></textarea>
              </div>
              <div className="flex flex-col gap-2 md:w-1/2">
                <label className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Date</label>
                <input type="date" name="date" className="p-3 bg-surface border border-muted focus:border-foreground outline-none transition-colors rounded-sm" />
              </div>
              <button type="submit" className="mt-4 bg-foreground text-background py-4 px-8 font-sans uppercase tracking-widest text-sm hover:bg-accent transition-colors self-start rounded-sm shadow-md">Submit Memory</button>
            </form>
          )}

          {/* TIMELINE EVENT FORM */}
          {activeTab === "timeline" && (
            <form onSubmit={(e) => handleSubmit(createTimelineEvent, e)} className="space-y-6 flex flex-col font-body animate-fade-in-up">
              <div className="flex flex-col gap-2">
                <label className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Event Title *</label>
                <input required type="text" name="title" className="p-3 bg-surface border border-muted focus:border-foreground outline-none transition-colors rounded-sm" />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="flex flex-col gap-2">
                  <label className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Event Type *</label>
                  <Select required name="type" className="p-3 bg-surface border border-muted focus:border-foreground outline-none transition-colors rounded-sm">
                    <option value="TRIP">Trip</option>
                    <option value="MEMORY">Memory</option>
                    <option value="EXPERIENCE">Experience</option>
                  </Select>
                </div>
                <div className="flex flex-col gap-2">
                  <label className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Date *</label>
                  <input required type="date" name="date" className="p-3 bg-surface border border-muted focus:border-foreground outline-none transition-colors rounded-sm" />
                </div>
              </div>
              <div className="flex flex-col gap-2">
                <label className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Description</label>
                <textarea name="description" rows={3} className="p-3 bg-surface border border-muted focus:border-foreground outline-none transition-colors rounded-sm resize-none"></textarea>
              </div>
              <div className="flex flex-col gap-2">
                <label className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Reference ID (Optional Trip/Memory ID)</label>
                <input type="text" name="referenceId" className="p-3 bg-surface border border-muted focus:border-foreground outline-none transition-colors rounded-sm" />
              </div>
              <button type="submit" className="mt-4 bg-foreground text-background py-4 px-8 font-sans uppercase tracking-widest text-sm hover:bg-accent transition-colors self-start rounded-sm shadow-md">Submit Timeline Event</button>
            </form>
          )}

        </div>
      </div>
    </div>
  );
}
