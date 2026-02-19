/**
 * Artificer: Migrate Biomes to Official D&D 5e Habitats
 *
 * Maps legacy biome values to official biomes (MOUNTAIN, ARCTIC, etc.)
 * and adds descriptive quirks where appropriate.
 *
 * 1. Back up your world before running.
 * 2. Create a new Macro in Foundry (Script type), name e.g. "Artificer: Migrate Biomes".
 * 3. Paste this script and run as GM.
 *
 * World items only.
 */

const MODULE_ID = 'coffee-pub-artificer';

const MIGRATION_MAP = {
    battlefield: { biomes: ['MOUNTAIN', 'COASTAL', 'SWAMP', 'DESERT', 'UNDERDARK', 'FOREST', 'GRASSLAND', 'URBAN', 'HILL'], quirk: 'Found in Battlefields' },
    graveyard: { biomes: ['MOUNTAIN', 'DESERT', 'FOREST', 'GRASSLAND', 'HILL'], quirk: 'Found in Graveyards' },
    'plague site': { biomes: ['FOREST', 'GRASSLAND', 'URBAN', 'HILL'], quirk: 'Found in Plague Site' },
    volcano: { biomes: ['MOUNTAIN'], quirk: 'Found in Volcanos' },
    cavern: { biomes: ['MOUNTAIN'], quirk: 'Found in Caverns' },
    caverns: { biomes: ['MOUNTAIN'], quirk: 'Found in Caverns' },
    alpine: { biomes: ['MOUNTAIN', 'ARCTIC'], quirk: 'Found in Alps' },
    alps: { biomes: ['MOUNTAIN', 'ARCTIC'], quirk: 'Found in Alps' },
    meadow: { biomes: ['FOREST', 'GRASSLAND', 'HILL'], quirk: null }
};

const OFFICIAL_BIOMES = new Set([
    'ARCTIC', 'COASTAL', 'DESERT', 'FOREST', 'GRASSLAND',
    'HILL', 'MOUNTAIN', 'PLANAR', 'SWAMP', 'UNDERDARK', 'UNDERWATER', 'URBAN'
]);

let migrated = 0;
let skipped = 0;
const errors = [];

for (const item of game.items) {
    const flags = item.flags?.[MODULE_ID] ?? item.flags?.artificer;
    if (!flags || !Array.isArray(flags.biomes) || flags.biomes.length === 0) {
        skipped++;
        continue;
    }

    const rawBiomes = flags.biomes;
    const allOfficial = rawBiomes.every(b => OFFICIAL_BIOMES.has(String(b).toUpperCase()));
    if (allOfficial) {
        skipped++;
        continue;
    }

    const newBiomes = new Set();
    let quirkToAdd = flags.quirk ? [flags.quirk] : [];

    for (const b of rawBiomes) {
        const key = String(b).toLowerCase().trim();
        const mapping = MIGRATION_MAP[key];
        if (mapping) {
            mapping.biomes.forEach(nb => newBiomes.add(nb));
            if (mapping.quirk && !quirkToAdd.includes(mapping.quirk)) {
                quirkToAdd.push(mapping.quirk);
            }
        } else if (OFFICIAL_BIOMES.has(key.toUpperCase())) {
            newBiomes.add(key.toUpperCase());
        }
    }

    const finalBiomes = Array.from(newBiomes);
    const finalQuirk = quirkToAdd.length > 0 ? quirkToAdd.join('; ') : (flags.quirk || '');

    try {
        const flagKey = item.flags[MODULE_ID] ? MODULE_ID : 'artificer';
        const updateData = { [`flags.${flagKey}.biomes`]: finalBiomes };
        if (finalQuirk) updateData[`flags.${flagKey}.quirk`] = finalQuirk;
        await item.update(updateData);
        migrated++;
    } catch (e) {
        errors.push(`${item.name} (${item.uuid}): ${e.message}`);
    }
}

const msg = `Biome migration complete: ${migrated} items migrated, ${skipped} skipped.`;
ui.notifications.info(msg);
if (errors.length) {
    console.warn(`${MODULE_ID} biome migration errors:`, errors);
    ui.notifications.warn(`${errors.length} errors (see console).`);
}
console.log(`${MODULE_ID} biome migration report:`, { migrated, skipped, errors });
