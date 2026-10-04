import { createTrip } from "../../actions";

export default function NewTripPage() {
  return (
    <div className="max-w-2xl">
      <h1 className="font-display text-4xl mb-8">Add New Trip</h1>
      
      <form action={createTrip} className="space-y-6 flex flex-col font-body bg-surface p-8 border border-muted rounded-sm shadow-sm">
        
        <div className="flex flex-col gap-2">
          <label className="text-xs font-bold uppercase tracking-widest text-muted-foreground" htmlFor="title">Trip Title *</label>
          <input required type="text" id="title" name="title" className="p-3 bg-background border border-muted focus:border-foreground outline-none transition-colors rounded-sm" placeholder="e.g. Summer in Kyoto" />
        </div>
        
        <div className="flex flex-col gap-2">
          <label className="text-xs font-bold uppercase tracking-widest text-muted-foreground" htmlFor="destination">Destination *</label>
          <input required type="text" id="destination" name="destination" className="p-3 bg-background border border-muted focus:border-foreground outline-none transition-colors rounded-sm" placeholder="e.g. Kyoto, Japan" />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="flex flex-col gap-2">
            <label className="text-xs font-bold uppercase tracking-widest text-muted-foreground" htmlFor="startDate">Start Date *</label>
            <input required type="date" id="startDate" name="startDate" className="p-3 bg-background border border-muted focus:border-foreground outline-none transition-colors rounded-sm text-foreground" />
          </div>
          <div className="flex flex-col gap-2">
            <label className="text-xs font-bold uppercase tracking-widest text-muted-foreground" htmlFor="endDate">End Date</label>
            <input type="date" id="endDate" name="endDate" className="p-3 bg-background border border-muted focus:border-foreground outline-none transition-colors rounded-sm text-foreground" />
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <label className="text-xs font-bold uppercase tracking-widest text-muted-foreground" htmlFor="duration">Duration (Text)</label>
          <input type="text" id="duration" name="duration" className="p-3 bg-background border border-muted focus:border-foreground outline-none transition-colors rounded-sm" placeholder="e.g. 14 Days" />
        </div>

        <div className="flex flex-col gap-2">
          <label className="text-xs font-bold uppercase tracking-widest text-muted-foreground" htmlFor="description">Description</label>
          <textarea id="description" name="description" rows={4} className="p-3 bg-background border border-muted focus:border-foreground outline-none transition-colors rounded-sm resize-none" placeholder="Write a short summary..."></textarea>
        </div>
        
        <div className="flex flex-col gap-2">
          <label className="text-xs font-bold uppercase tracking-widest text-muted-foreground" htmlFor="coverImage">Cover Image URL</label>
          <input type="url" id="coverImage" name="coverImage" className="p-3 bg-background border border-muted focus:border-foreground outline-none transition-colors rounded-sm" placeholder="https://..." />
        </div>

        <button type="submit" className="mt-4 bg-foreground text-background py-4 px-8 font-sans uppercase tracking-widest text-sm hover:bg-accent transition-colors self-start rounded-sm shadow-md">
          Save Trip
        </button>
      </form>
    </div>
  );
}
