# Track Studio

Open **Settings & Tools → Draw a new track**, or the same link beneath the circuit selector. The direct entry is `track-editor.html`.

- Draw a continuous loop with a mouse, pen or finger, or click to place corners. The editor simplifies freehand input and uses the same closed Catmull–Rom road geometry as the race.
- Drag blue points to reshape corners. Select a point and choose **Start here** to move the start/finish line. **Reverse direction** keeps the start point and reverses driving direction.
- **Undo** reverses drawing and point edits. **Clear** empties the canvas and can be undone. **New circuit** starts a separate blank draft.
- Name the circuit, then choose **Save circuit** or **Save & race**. Up to 12 circuits appear in the local library and the game's circuit selector. Opening an existing circuit edits its saved layout.
- The editor retains its draft across refreshes. Circuits and drafts are stored in this browser and origin; localhost and the live site have separate libraries.

The road uses the standard 84-unit width. Saving requires 4–80 points, 1,000–6,500 units of track length, enough turning room, a road inside the drawing boundary, and no crossings or overlapping road sections. Validation checks the smoothed road as well as the input points.

Switching to a custom circuit retains the trained population and generation but clears measurements belonging to the previous circuit. Editing a saved circuit also invalidates its previous layout's records on the next load. Training saves include the exact control points so a changed or deleted circuit cannot inherit incompatible records. Champion validation sends the custom geometry to its worker rather than assuming a built-in track.

Keyboard drawing: focus the canvas, move the cursor using arrow keys (50 units, or 10 with Shift), and press Space or Enter to place a point. Delete removes the selected point; Ctrl/Cmd+Z undoes an edit.
