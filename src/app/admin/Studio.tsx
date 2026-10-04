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

type Tab = "trips" | "places" | "photos" | "memories" | "timeline";

export default function Studio() {
  const [activeTab, setActiveTab] = useState<Tab>("trips");
  const [status, setStatus] = useState<{ type: 'success' | 'error' | null, message: string }>({ type: null, message: '' });

  const [tripCoverUrl, setTripCoverUrl] = useState("");
  const [placeCoverUrl, setPlaceCoverUrl] = useState("");
  const [photoUrl, setPhotoUrl] = useState("");

  const tabs: { id: Tab, label: string, subtitle: string }[] = [
    { id: "trips", label: "Trips", subtitle: "Log a new journey" },
    { id: "places", label: "Places", subtitle: "Add a destination" },
    { id: "photos", label: "Photos", subtitle: "Upload a memory" },

    { id: "memories", label: "Memories", subtitle: "Capture a moment" },
    { id: "timeline", label: "Timeline", subtitle: "Log a major event" },
  ];

  async function handleSubmit(action: (formData: FormData) => Promise<void>, e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setStatus({ type: null, message: '' });
    const formData = new FormData(e.currentTarget);
    try {
      await action(formData);
      setStatus({ type: 'success', message: 'Successfully added to Atlas.' });
      (e.target as HTMLFormElement).reset();
      
      // Reset image states
      if (activeTab === "trips") setTripCoverUrl("");
      if (activeTab === "places") setPlaceCoverUrl("");
      if (activeTab === "photos") setPhotoUrl("");
      
    } catch (err: any) {
      setStatus({ type: 'error', message: err.message || 'An error occurred.' });
    }
  }

  return (
    <div className="flex flex-col lg:flex-row min-h-[calc(100vh-8rem)] rounded-md overflow-hidden shadow-2xl border border-muted bg-surface/50 backdrop-blur-xl">
      {/* Sidebar */}
      <div className="lg:w-64 bg-surface/80 border-b lg:border-b-0 lg:border-r border-muted p-6 flex flex-col gap-2">
        <h2 className="font-sans text-[10px] uppercase tracking-widest text-muted-foreground mb-4">Studio Control</h2>
        {tabs.map(tab => (
          <button 
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`text-left p-4 rounded-sm transition-all duration-300 ${activeTab === tab.id ? 'bg-background border-l-2 border-foreground shadow-sm' : 'hover:bg-muted/30 border-l-2 border-transparent'}`}
          >
            <h3 className={`font-display text-lg ${activeTab === tab.id ? 'text-foreground' : 'text-foreground/70'}`}>{tab.label}</h3>
            <p className="font-sans text-[9px] uppercase tracking-wider text-muted-foreground mt-1">{tab.subtitle}</p>
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
                  <select name="isFeatured" className="p-3 bg-surface border border-muted focus:border-foreground outline-none transition-colors rounded-sm">
                    <option value="false">No</option>
                    <option value="true">Yes</option>
                  </select>
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
                  <select required name="type" className="p-3 bg-surface border border-muted focus:border-foreground outline-none transition-colors rounded-sm">
                    <option value="TRIP">Trip</option>
                    <option value="MEMORY">Memory</option>

                    <option value="EXPERIENCE">Experience</option>
                  </select>
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
