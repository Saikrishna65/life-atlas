# Atlas Gallery 2.2.6

Includes the 2.2.5 mosaic and compositor transition work described in
[gallery-2.2.5.md](gallery-2.2.5.md). A final uncovered path now applies the one-time
stage fade to photos without an available grid thumbnail, as well as videos.
This does not reintroduce the dialog entrance animation at image handoff.
Failed thumbnails retry locally without broadcasting a reset of other instances’
retry guards, preventing unbounded retries when a preview remains unavailable.

The grid uses bounded square cells, occasional two-cell wide tiles and four-cell
squares, with a four-column phone default. No media is rewritten. New background
thumbnail work pauses while the viewer is open; purposeful near-end navigation
continues to fetch more media.

Final validation and signed release evidence follow after completion. Physical
Android frame pacing is not measured in this environment.
