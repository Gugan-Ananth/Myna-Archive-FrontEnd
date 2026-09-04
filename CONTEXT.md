# Myna Archive (frontend)

Personal image archive — store, display, and search images you love. Companion API: **Myna-Archive-Backend**.

## Language

**Archive Item**:
A single archived media entry (image, video, story, or comic) with metadata.
_Avoid_: post, asset (unless talking about a binary file)

**Story character**:
A named speaker in a written story chapter, with an optional portrait shown beside dialogue in the reader. Detected from `Name: "dialogue"` in the chapter body. Stored on the Archive Item, not as an Original Character.
_Avoid_: OC, cast, actor

**Dialogue**:
Quoted speech in a story chapter, rendered as a chat bubble. Consecutive lines from the same story character stay on the same side.
_Avoid_: quote (the stored markup), message (unless describing the chat layout)

**Original Character**:
A standalone OC sheet in the OC collection — not a story character.
_Avoid_: using OC for speakers inside a story
