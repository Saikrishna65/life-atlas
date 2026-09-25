export default function Footer() {
  return (
    <footer className="py-12 md:py-24 px-6 md:px-12 border-t border-muted/20">
      <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-start md:items-end gap-12">
        <div>
          <h2 className="font-display text-2xl md:text-3xl mb-4">LIFE ATLAS</h2>
          <p className="font-body text-muted-foreground max-w-sm">
            A place for the moments I want to remember. Travels, places, people, food, films and everything in between.
          </p>
        </div>
        
        <div className="flex flex-col gap-2 font-sans text-sm text-muted-foreground">
          <p>&copy; {new Date().getFullYear()} Life Atlas.</p>
          <p>Personal archive.</p>
        </div>
      </div>
    </footer>
  );
}
