# Recipe journal Cover page

Recipe journals can include a **Cover** page with metadata: which skill(s) the book is for (used for filtering), plus author, description, and an optional image used as the book cover in the crafting UI.

## Page name

- Add a journal page whose **name** is exactly **Cover Page** (case-insensitive). Using "Cover Page" (not "Cover") avoids conflicting with a recipe that might be named "Cover".

## Format (same as recipes)

Use the same visible, label-based format as recipe pages: paragraphs with **bold label** followed by the value. The parser looks for `<p><strong>Label:</strong> value</p>` in the page HTML (so in the editor, bold the label and put the value after it).

## Data to include

| Label   | Value | Notes |
|--------|--------|--------|
| **Skills:**  | One or more skill names, comma-separated (e.g. `Herbalism` or `Herbalism, Alchemy`) | Used for filtering when “Show only recipes for skills I have the kit for” is on. |
| **Author:** | Author name | Shown in the crafting window when a recipe from this journal is selected. |
| **Description:** | Short description of the book | Shown in the crafting window when a recipe from this journal is selected. |
| *(image)* | Any image on the Cover page | The **first** `<img>` in the Cover page HTML is used as the book cover in the crafting window (shown next to the journal name when a recipe is selected). |

Skill names should match the artificer skill ids (e.g. from your skills ruleset JSON / `skills-mapping.json`), such as: Herbalism, Alchemy, Poisoncraft, Cooking, Smithing, Leatherworking, Tinkering, Cartography, Inscription, Enchanting, Gemcraft, Tailoring, Masonry.

## Example (in the journal editor)

Type the following. Bold the labels (**Skills:**, **Author:**, **Description:**) and leave the rest normal text:

**Skills:** Herbalism, Alchemy

**Author:** M. Sage

**Description:** A practical guide to herbs and simple alchemy.

*(Add an image block or paste an image on the Cover page; it will be used as the book cover.)*

---

### Copy-paste HTML (page content)

If you need to paste HTML into the journal page (e.g. via "Edit HTML" or similar), use this as the page **content**. Replace the image `src` with your own image path, or remove the `<img>` line if you don't want a cover image.

```html
<p><strong>Skills:</strong> Herbalism, Alchemy</p>
<p><strong>Author:</strong> M. Sage</p>
<p><strong>Description:</strong> A practical guide to herbs and simple alchemy.</p>
<p><img src="path/to/your/cover-image.png" alt="Book cover" width="200" height="300" /></p>
<p><em>Herbalism &amp; Alchemy — Collected recipes for the aspiring crafter.</em></p>
```

Remember to name the journal page **Cover Page** (page title/name), not the journal itself.

The rest of the Cover page can be normal text; only the labels above and the first image are read.

## Behaviour

- **Filtering:** If a journal has **no** Cover page, or the Cover has no **Skills** line, the journal is **always** shown in the dropdown (backward compatible). If the Cover lists one or more skills (comma-separated on the **Skills:** line), the journal is only shown when “Show only recipes for skills I have the kit for” is on **and** the actor has the required kit for **at least one** of those skills.
- **Display:** When a recipe from this journal is selected in the crafting window, the journal name is shown; if the Cover page has **Author**, **Description**, or an image, those are shown as the “book cover” (image, author, description) below the journal name.
