import Studio from "./Studio";

export default function AdminDashboard() {
  return (
    <div className="p-6 md:p-12 md:pt-32 min-h-screen bg-background">
      <div className="max-w-7xl mx-auto">
        <h1 className="font-display text-5xl md:text-7xl mb-4 text-foreground">Creator Studio</h1>
        <p className="font-body text-muted-foreground mb-12 max-w-2xl text-lg">
          Welcome to the control center. Use this creative suite to document new journeys, log memories, write journal entries, and expand your atlas.
        </p>
        
        <Studio />
      </div>
    </div>
  );
}
