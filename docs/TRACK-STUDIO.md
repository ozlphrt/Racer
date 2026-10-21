# Track Studio

Open **Settings & Tools → Draw a new track**, or the same link beneath the circuit selector. The direct entry is `track-editor.html`.

- Draw a continuous loop with a mouse, pen or finger, or click to place corners. The editor simplifies freehand input and uses the same closed Catmull–Rom road geometry as the race.
- Click to insert a new point into the nearest section of the smoothed track. Drag blue points to reshape corners. Right-click a point and choose **Remove point** to delete it; removal supports Undo. Select a point and choose **Start here** to move the start/finish line. **Reverse direction** keeps the start point and reverses driving direction.
- **Undo** reverses drawing and point edits. **Clear** empties the canvas and can be undone. **New circuit** starts a separate blank draft.
- Name the circuit, then choose **Save circuit** or **Save & race**. Up to 12 circuits appear in the local library and the game's circuit selector. Choose **Load · name** to open an existing circuit for editing.
- **Save JSON** downloads a portable track file. **Load JSON** opens that file in the editor without saving it to the library; choose **Save circuit** when you want to keep it there.
- Opening or refreshing the editor starts with a blank canvas. Drawings are saved only when requested. The browser library persists across reloads; localhost and the live site have separate libraries, and JSON files can transfer tracks between them.
- Custom race tracks also load only when requested through **Save & race** or the circuit selector. A normal game refresh returns to Grand Prix if the previous circuit was custom. Built-in circuit selections keep their existing resume behavior, and the trained population and generation are retained.

The road uses the standard 84-unit width. Saving requires 4–80 points, 1,000–6,500 units of track length, enough turning room, a road inside the drawing boundary, and no crossings or overlapping road sections. Validation checks the smoothed road as well as the input points.

Switching to a custom circuit retains the trained population and generation but clears measurements belonging to the previous circuit. Editing a saved circuit also invalidates its previous layout's records on the next load. Training saves include the exact control points so a changed or deleted circuit cannot inherit incompatible records. Champion validation sends the custom geometry to its worker rather than assuming a built-in track.

Keyboard drawing: focus the canvas, move the cursor using arrow keys (50 units, or 10 with Shift), and press Space or Enter to place a point. Delete removes the selected point; Ctrl/Cmd+Z undoes an edit. Shift+F10 opens the selected point's removal menu; Escape dismisses it.
