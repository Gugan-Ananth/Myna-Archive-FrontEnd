# Myna Archive (frontend)

Personal image archive — store, display, and search images you love. Companion API: **Myna-Archive-Backend**.

## Language

**Image preview**:
A stored WebP still under 1 MB (`thumbnailUrl`, `{uuid}-preview.webp`) used on grids. The original upload stays on `mediaUrl` for the detail view.
_Avoid_: treating Optimizer query-string thumbs as a separate file

**Archive Item**:
A single archived media entry (image, video, story, or comic) with metadata.
_Avoid_: post, asset (unless talking about a binary file)

**Story character**:
A named speaker in a written story chapter, with an optional portrait shown beside dialogue in the reader. Detected from `Name: "dialogue"` in the chapter body. Stored on the Archive Item, not as an Original Character.
_Avoid_: OC, cast, actor

**Dialogue**:
Quoted speech in a story chapter, rendered as a chat bubble. Consecutive lines from the same story character stay on the same side.
_Avoid_: quote (the stored markup), message (unless describing the chat layout)

**Story sound**:
A marked span of story text that plays a catalog clip (rope, chain, gag, …) when the reader clicks it. The words stay in place; a light highlight marks that it is playable.
_Avoid_: interaction, cue, hotspot, sound effect (unless talking about the clip file)

**Original Character**:
A standalone OC sheet in the OC collection — not a story character.
_Avoid_: using OC for speakers inside a story
