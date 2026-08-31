// ==================================================================
// ===== ARTIFICER ITEM FIELD GROUP =================================
// ==================================================================
// Our flag block, declared to Blacksmith's importer as a FIELD GROUP.
//
// WHY A GROUP AND NOT A PROFILE. Artificer flags are orthogonal to the D&D
// type: an Artificer item IS a loot, or a consumable, or a tool, with our
// block added. A profile would compete with the eight Item profiles rather
// than compose with them, and declaring the block eight times duplicates it
// and still could not be opted into per import.
//
// THIS FILE IS DATA. Blacksmith derives the JSON template, the authoring
// guide, the prompt, validation and construction from it. Every `guidance`
// string is the ONLY authoring text for its field -- between them and
// `preamble`, the two prompt files Blacksmith hosts for us are fully
// accounted for and can be deleted from their repo.
//
// Reference: coffee-pub-blacksmith/documentation/api/api-importer.md
// Reasoning: documentation/plans/declaration-artificer-field-group.md
// ==================================================================

import { MODULE } from '../const.js';
import {
    ARTIFICER_TYPES,
    FAMILIES_BY_TYPE,
    PROCESS_FAMILY,
    ARTIFICER_FLAG_KEYS
} from '../schema-artificer-item.js';
import { getBiomeKeys } from '../schema-ingredients.js';
import { ESSENCE_AFFINITIES } from '../schema-essences.js';

/** Every flag we write lives under this path. */
const FLAG_PATH = `flags.${MODULE.ID}`;

/**
 * Prompt text that does not reduce to per-field guidance.
 *
 * Two paragraphs, and the second is the mistake authors actually make.
 */
const PREAMBLE = [
    'An item may be both a crafting material and a usable D&D 5e item. Many are: a healing herb',
    'can be chewed for minor healing, a natural poison can be applied, a magical crystal may have',
    'a Use activity. Do not reduce these to trinkets -- if the item has a healing, poison, or',
    'magical use effect, give it the item type and activities that effect needs. Raw ores and pure',
    'reagents with no use effect are correctly plain loot.',
    '',
    `Artificer classification lives only in flags["${MODULE.ID}"]. Never put Component, Creation,`,
    'or Tool in the item type -- those are the D&D 5e types, and the two vocabularies are unrelated.'
].join(' ');

/**
 * Build the field group.
 *
 * A FUNCTION, NOT A CONSTANT, and the reason is the habitat `values` list. The
 * vocabulary now resolves from `api.geography.HABITATS`, which does not exist when
 * this module is evaluated -- so a module-scope object literal would capture the
 * FALLBACK vocabulary permanently and register a `values` list in the wrong case. That
 * registers cleanly and then rejects legitimate content, with nothing to see in the
 * console. Built at `ready` instead, where the API is up.
 *
 * @returns {object} The field group, resolved against the live vocabulary.
 */
export function buildArtificerItemFieldGroup() {
    return {
        id: 'artificer',
        module: MODULE.ID,
        kind: 'item',
        // All eight. The flags are orthogonal to the D&D type by design, which is the
        // whole reason this is a group. A flagged weapon is a legitimate crafted result.
        appliesTo: '*',
        option: { id: 'artificerItem', label: 'Artificer Item' },
        preamble: PREAMBLE,

        fields: [
            {
                name: ARTIFICER_FLAG_KEYS.TYPE,
                path: `${FLAG_PATH}.${ARTIFICER_FLAG_KEYS.TYPE}`,
                type: 'string',
                required: true,
                values: Object.values(ARTIFICER_TYPES),
                // Legacy, READ-ONLY. `getArtificerTypeFromFlags` still accepts a bare
                // `type` key inside our namespace. Accept it so old payloads import;
                // never emit it. Writer retires, reader keeps the fallback.
                acceptsKeys: ['type'],
                example: 'Component',
                guidance: 'The Artificer classification: Component for raw materials found in the world, Creation for crafted results, Tool for the apparatus, containers and processes that make them.'
            },
            {
                name: ARTIFICER_FLAG_KEYS.FAMILY,
                path: `${FLAG_PATH}.${ARTIFICER_FLAG_KEYS.FAMILY}`,
                type: 'string',
                required: true,
                // NO `values` LIST. The allowed set is chosen by artificerType, which the
                // rule vocabulary cannot yet express -- Blacksmith is designing one
                // mechanism against this and three other dynamic-vocabulary cases. Until
                // it lands, `validateArtificerData` keeps this check. Temporary.
                example: 'Plant',
                guidance: 'The family within the Artificer type. Component: CreaturePart, Environmental, Essence, Gem, Mineral, Plant. Creation: Food, Material, Poison, Potion. Tool: Apparatus, Container, Process.'
            },
            {
                name: ARTIFICER_FLAG_KEYS.TRAITS,
                path: `${FLAG_PATH}.${ARTIFICER_FLAG_KEYS.TRAITS}`,
                type: 'array',
                required: true,
                example: ['Herb', 'Medicinal'],
                guidance: 'Two to five traits describing what the item is good for. These drive recipe matching, so choose them as data rather than flavour, and do not repeat the type or family here. At most 20.'
            },
            {
                name: ARTIFICER_FLAG_KEYS.SKILL_LEVEL,
                path: `${FLAG_PATH}.${ARTIFICER_FLAG_KEYS.SKILL_LEVEL}`,
                type: 'integer',
                required: false,
                default: 1,
                example: 1,
                // Minimum 1, NOT 0. Recipes allow 0 and our own prompt text used to say
                // so, but `validateArtificerData` throws below 1 for items.
                guidance: 'Crafting difficulty, 1 to 20. 1-3 common, 4-9 uncommon, 10-14 rare, 15-19 very rare, 20 legendary.'
            },
            {
                name: ARTIFICER_FLAG_KEYS.BIOMES,
                path: `${FLAG_PATH}.${ARTIFICER_FLAG_KEYS.BIOMES}`,
                type: 'array',
                required: false,
                default: [],
                example: ['FOREST', 'SWAMP'],
                values: getBiomeKeys(),
                guidance: 'Where a Component naturally occurs. Required for Components, empty for everything else.'
            },
            {
                name: ARTIFICER_FLAG_KEYS.QUIRK,
                path: `${FLAG_PATH}.${ARTIFICER_FLAG_KEYS.QUIRK}`,
                type: 'string',
                required: false,
                default: '',
                example: '',
                guidance: 'An optional note on a Component that changes how it is found or kept, such as "Degrades in sunlight". Usually blank.'
            },
            {
                name: ARTIFICER_FLAG_KEYS.AFFINITY,
                path: `${FLAG_PATH}.${ARTIFICER_FLAG_KEYS.AFFINITY}`,
                type: 'string',
                required: false,
                default: '',
                example: '',
                values: Object.values(ESSENCE_AFFINITIES),
                requiresWhen: `${ARTIFICER_FLAG_KEYS.FAMILY}:Essence`,
                guidance: 'The elemental affinity of an Essence.'
            },

            // ---- Process family only -------------------------------------------
            // Gated on FAMILY, not type: a Process is a Tool whose family is Process.
            // These are `requiresWhen`'s first real use.
            {
                name: ARTIFICER_FLAG_KEYS.PROCESS_LEVELS,
                path: `${FLAG_PATH}.${ARTIFICER_FLAG_KEYS.PROCESS_LEVELS}`,
                type: 'array',
                required: false,
                default: [],
                requiresWhen: `${ARTIFICER_FLAG_KEYS.FAMILY}:${PROCESS_FAMILY}`,
                example: [
                    { label: 'Off', color: '#7a5a3a' },
                    { label: 'Low', color: '#c98a4b' },
                    { label: 'Medium', color: '#ffb45a' },
                    { label: 'High', color: '#ff8c2e' }
                ],
                fields: [
                    { name: 'label', type: 'string', guidance: 'What this level is called, such as Simmer or Coarse.' },
                    { name: 'color', type: 'string', guidance: 'CSS colour the crafting animation paints with at this level.' }
                ],
                guidance: 'Exactly four intensity positions for a Process, from off to full. Position 0 is always the off state. The names are the process\'s own vocabulary: Off/Low/Medium/High for heat, Off/Coarse/Medium/Fine for a grind.'
            },
            {
                name: ARTIFICER_FLAG_KEYS.PROCESS_ANIMATION,
                path: `${FLAG_PATH}.${ARTIFICER_FLAG_KEYS.PROCESS_ANIMATION}`,
                type: 'string',
                required: false,
                default: 'none',
                example: 'pulse',
                requiresWhen: `${ARTIFICER_FLAG_KEYS.FAMILY}:${PROCESS_FAMILY}`,
                // NO `values` LIST, deliberately. The vocabulary is
                // resources/process-animations.json, which an art pack extends by
                // shipping CSS plus an entry -- so the allowed set is not knowable at
                // declaration time, and not answerable from the world either.
                guidance: 'The crafting-bench motion this Process plays: none, pulse, shake, strike, swirl, sweep, shimmer, settle, ring or blur. Names describe the MOTION, not the process, so a ferment can pulse and a sieve can shake.'
            },
            {
                name: ARTIFICER_FLAG_KEYS.PROCESS_SOUND,
                path: `${FLAG_PATH}.${ARTIFICER_FLAG_KEYS.PROCESS_SOUND}`,
                type: 'string',
                required: false,
                default: '',
                example: '',
                requiresWhen: `${ARTIFICER_FLAG_KEYS.FAMILY}:${PROCESS_FAMILY}`,
                guidance: 'Sound played while a craft using this Process runs. Blank for silence.'
            },
            {
                name: ARTIFICER_FLAG_KEYS.PROCESS_UNSTABLE,
                path: `${FLAG_PATH}.${ARTIFICER_FLAG_KEYS.PROCESS_UNSTABLE}`,
                type: 'boolean',
                required: false,
                default: false,
                example: false,
                requiresWhen: `${ARTIFICER_FLAG_KEYS.FAMILY}:${PROCESS_FAMILY}`,
                guidance: 'Whether full intensity destabilises and flickers. True for open flame; a ferment held at maximum is not unstable.'
            }
        ],

        rules: [
            // DELIBERATE BREAK. Both have always been prose in our authoring prompt and
            // enforced nowhere, so payloads carrying neither imported cleanly and made
            // content that could never be gathered or matched. Declaring them rejects
            // JSON that used to import. That is intended, and it is in our CHANGELOG
            // under the release that introduces it -- this comment is here because it
            // is what someone reads when the failure surfaces.
            {
                kind: 'requires',
                when: `${ARTIFICER_FLAG_KEYS.TYPE}:${ARTIFICER_TYPES.COMPONENT}`,
                then: [ARTIFICER_FLAG_KEYS.BIOMES]
            },
            {
                kind: 'requires',
                when: `${ARTIFICER_FLAG_KEYS.FAMILY}:Essence`,
                then: [ARTIFICER_FLAG_KEYS.AFFINITY]
            }
        ]
    };
}

/**
 * Register the group, if Blacksmith's importer offers the API.
 *
 * Called from `ready`: the importer registry's placeholders are cleared during
 * Blacksmith's `init`, so registering earlier can hit a stub. Absence is not an
 * error -- an older Blacksmith simply has no field groups, and Artificer keeps
 * working without importer integration.
 *
 * @param {object} blacksmithApi
 * @returns {boolean} Whether the group registered.
 */
export function registerArtificerItemFieldGroup(blacksmithApi) {
    const register = blacksmithApi?.importer?.registerFieldGroup;
    if (typeof register !== 'function') return false;
    blacksmithApi.importer.registerFieldGroup(buildArtificerItemFieldGroup());
    return true;
}

/** The families allowed for a given Artificer type. Exported for the temporary check. */
export const FAMILY_VOCABULARY = FAMILIES_BY_TYPE;
