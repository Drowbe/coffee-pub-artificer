/**
 * Artificer: Set Component Skill Level by Rarity
 *
 * Crawls the "Artificer items" folder (and subfolders) and sets each item's
 * Artificer skill level from its D&D rarity:
 *   Common:    0–3  (if skill is already 0, leave 0; else set to 1)
 *   Uncommon:  4–9  → 6
 *   Rare:      10–14 → 12
 *   Very rare: 15–19 → 17
 *   Legendary: 20   → 20
 *
 * Only items with Artificer flags (Component, Creation, Tool) are updated.
 * World items only.
 *
 * 1. Back up your world before running.
 * 2. Ensure you have a folder named "Artificer items" (or set FOLDER_NAME below).
 * 3. Create a Macro (Script), paste this script, run as GM.
 *
 * Set dryRun: true to preview without updating.
 */

const MODULE_ID = 'coffee-pub-artificer';

/** Folder name to crawl (exact match). Items in this folder and all subfolders are processed. */
const FOLDER_NAME = 'Artificer';

/** Set true to log changes without updating. */
const dryRun = true;

/** Rarity → skill level. Common 0–3: keep 0 if current is 0, else 1; others use midpoint of range. */
function getSkillLevelForRarity(rarity, currentSkillLevel) {
    const r = (rarity || 'common').toLowerCase().trim();
    if (r === 'common') {
        if (currentSkillLevel === 0) return 0;
        return 1;
    }
    if (r === 'uncommon') return 6;
    if (r === 'rare') return 12;
    if (r === 'very rare') return 17;
    if (r === 'legendary') return 20;
    return currentSkillLevel;
}

/** Return folder id and all descendant folder ids for type Item. */
function getFolderIdAndDescendantIds(folderId, documentType = 'Item') {
    const allowed = new Set([folderId]);
    if (!folderId || !game.folders) return allowed;
    const folders = game.folders.filter((f) => f.type === documentType);
    let added;
    do {
        added = 0;
        for (const f of folders) {
            const parentId = f.folder?.id ?? f.folder;
            if (parentId && allowed.has(parentId) && !allowed.has(f.id)) {
                allowed.add(f.id);
                added++;
            }
        }
    } while (added > 0);
    return allowed;
}

const artificerFolder = game.folders?.find(
    (f) => f.type === 'Item' && (f.name || '').trim() === FOLDER_NAME
);

if (!artificerFolder) {
    ui.notifications.error(
        `No Item folder named "${FOLDER_NAME}" found. Create the folder or change FOLDER_NAME in the macro.`
    );
} else {
    const allowedFolderIds = getFolderIdAndDescendantIds(artificerFolder.id);
    let updated = 0;
    let skipped = 0;
    const errors = [];

    for (const item of game.items) {
        const folderId = item.folder?.id ?? item.folder;
        if (!folderId || !allowedFolderIds.has(folderId)) {
            skipped++;
            continue;
        }

        const flags = item.flags?.[MODULE_ID] ?? item.flags?.artificer;
        const typeVal = flags?.artificerType ?? flags?.type;
        if (!flags || !typeVal) {
            skipped++;
            continue;
        }

        const currentSl = flags.artificerSkillLevel ?? flags.skillLevel;
        const currentNum = currentSl != null ? Math.max(0, Math.min(20, parseInt(currentSl, 10) || 0)) : 1;
        const rarity = (item.system?.rarity ?? 'common').toLowerCase().trim();
        const newSl = getSkillLevelForRarity(rarity, currentNum);

        if (newSl === currentNum) {
            skipped++;
            continue;
        }

        if (dryRun) {
            console.log(
                `${MODULE_ID} [dry run] ${item.name}: rarity=${rarity || 'common'} current=${currentNum} → new=${newSl}`
            );
            updated++;
            continue;
        }

        try {
            const flagKey = item.flags[MODULE_ID] ? MODULE_ID : 'artificer';
            const slKey = flagKey === MODULE_ID ? 'artificerSkillLevel' : 'skillLevel';
            await item.update({ [`flags.${flagKey}.${slKey}`]: newSl });
            updated++;
        } catch (e) {
            errors.push(`${item.name} (${item.uuid}): ${e.message}`);
        }
    }

    const msg = dryRun
        ? `Dry run: would update ${updated} items, ${skipped} skipped.`
        : `Skill-by-rarity: ${updated} items updated, ${skipped} skipped.`;
    ui.notifications.info(msg);
    if (errors.length) {
        console.warn(`${MODULE_ID} set-skill-by-rarity errors:`, errors);
        ui.notifications.warn(`${errors.length} errors (see console).`);
    }
    console.log(`${MODULE_ID} set-skill-by-rarity:`, { updated, skipped, errors: errors.length });
}
