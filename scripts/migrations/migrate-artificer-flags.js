// ==================================================================
// ===== ONE-TIME MIGRATION: Legacy flags → TYPE > FAMILY > TRAITS ===
// ==================================================================
// Run once after updating to the new data model. Back up your world first.
// Exposed via API: game.modules.get('coffee-pub-artificer').api.runMigration()
// ==================================================================

import { MODULE } from '../const.js';
import {
    ARTIFICER_TYPES,
    LEGACY_TYPE_TO_ARTIFICER_TYPE,
    LEGACY_FAMILY_TO_FAMILY,
    FAMILIES_BY_TYPE
} from '../schema-artificer-item.js';

/**
 * Check if item flags look like legacy (have primaryTag or secondaryTags or quirk).
 * @param {Object} flags
 * @returns {boolean}
 */
function isLegacyFlags(flags) {
    if (!flags || typeof flags !== 'object') return false;
    return (
        flags.primaryTag !== undefined ||
        (Array.isArray(flags.secondaryTags) && flags.secondaryTags.length > 0) ||
        (flags.secondaryTags !== undefined && flags.secondaryTags !== null) ||
        (flags.quirk !== undefined && flags.quirk !== null && flags.quirk !== '')
    );
}

/**
 * Compute new type from legacy type.
 * @param {string} legacyType
 * @returns {string}
 */
function toNewType(legacyType) {
    return LEGACY_TYPE_TO_ARTIFICER_TYPE[legacyType] ?? ARTIFICER_TYPES.COMPONENT;
}

/**
 * Compute new family from legacy family/type/primaryTag/affinity.
 * @param {Object} flags
 * @param {string} newType
 * @returns {string}
 */
function toNewFamily(flags, newType) {
    const families = FAMILIES_BY_TYPE[newType];
    if (!families?.length) return '';

    let family = flags.family ?? '';
    family = LEGACY_FAMILY_TO_FAMILY[family] ?? family;

    if (family && families.includes(family)) return family;

    if (newType === ARTIFICER_TYPES.COMPONENT) {
        if (flags.affinity) return 'Essence';
        if (flags.primaryTag) {
            const p = (flags.primaryTag || '').toLowerCase();
            if (['herb', 'floral', 'medicinal', 'toxic'].some(t => p.includes(t))) return 'Plant';
            if (['metal', 'ore', 'alloy'].some(t => p.includes(t))) return 'Mineral';
            if (['crystal', 'arcane', 'resonant'].some(t => p.includes(t))) return 'Gem';
            if (['monster', 'bone', 'venom', 'scale'].some(t => p.includes(t))) return 'CreaturePart';
            if (['water', 'fire', 'earth', 'air'].some(t => p.includes(t))) return 'Environmental';
        }
    }

    if (newType === ARTIFICER_TYPES.TOOL) {
        const legacy = flags.type;
        if (legacy === 'apparatus' || legacy === 'container') return legacy === 'apparatus' ? 'Apparatus' : 'Container';
        if (legacy === 'resultContainer') return 'Container';
    }

    return family || families[0] || '';
}

/**
 * Build traits array from primaryTag, secondaryTags, quirk; dedupe and remove family.
 * @param {Object} flags
 * @param {string} newFamily
 * @returns {string[]}
 */
function toTraits(flags, newFamily) {
    const primary = flags.primaryTag ? [flags.primaryTag] : [];
    const secondary = Array.isArray(flags.secondaryTags) ? flags.secondaryTags : [];
    const quirk = flags.quirk ? [flags.quirk] : [];
    const combined = [...primary, ...secondary, ...quirk].filter(Boolean);
    const seen = new Set();
    const familyNorm = (newFamily || '').toLowerCase();
    return combined.filter(t => {
        const n = (t || '').trim();
        if (!n) return false;
        const lower = n.toLowerCase();
        if (lower === familyNorm) return false;
        if (seen.has(lower)) return false;
        seen.add(lower);
        return true;
    });
}

/**
 * Run migration on a single item. Mutates updatePayload; does not call item.update.
 * @param {Item} item
 * @param {Object} updatePayload - Object to assign updates to (flags key)
 * @returns {boolean} true if item was migrated
 */
function migrateItem(item, updatePayload) {
    const flags = item.flags?.[MODULE.ID] ?? item.flags?.artificer;
    if (!flags || !isLegacyFlags(flags)) return false;

    const newType = toNewType(flags.type);
    const newFamily = toNewFamily(flags, newType);
    const traits = toTraits(flags, newFamily);

    const newFlags = {
        ...flags,
        type: newType,
        family: newFamily,
        traits
    };
    delete newFlags.primaryTag;
    delete newFlags.secondaryTags;
    delete newFlags.quirk;

    updatePayload[`flags.${MODULE.ID}`] = newFlags;
    return true;
}

/**
 * Run migration on all world items. Optionally include compendium packs.
 * @param {Object} options - { includeCompendia: string[] | false }
 * @returns {Promise<{ migrated: number, errors: string[], skipped: number }>}
 */
export async function runArtificerMigration(options = {}) {
    const includeCompendia = options.includeCompendia ?? false;
    const report = { migrated: 0, errors: [], skipped: 0 };

    const worldItems = game.items?.contents ?? [];
    for (const item of worldItems) {
        const payload = {};
        try {
            if (migrateItem(item, payload)) {
                await item.update(payload);
                report.migrated++;
            } else {
                report.skipped++;
            }
        } catch (e) {
            report.errors.push(`${item.name} (${item.uuid}): ${e.message}`);
        }
    }

    if (Array.isArray(includeCompendia) && includeCompendia.length > 0) {
        for (const packId of includeCompendia) {
            const pack = game.packs.get(packId);
            if (!pack || pack.documentName !== 'Item') continue;
            const docs = await pack.getDocuments();
            for (const item of docs) {
                const payload = {};
                try {
                    if (migrateItem(item, payload)) {
                        await item.update(payload);
                        report.migrated++;
                    } else {
                        report.skipped++;
                    }
                } catch (e) {
                    report.errors.push(`${item.name} (${packId}): ${e.message}`);
                }
            }
        }
    }

    return report;
}
