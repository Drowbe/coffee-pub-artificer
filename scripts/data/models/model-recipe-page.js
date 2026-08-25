// ==================================================================
// ===== ARTIFICER RECIPE PAGE DATA MODEL ===========================
// ==================================================================
// The journal page subtype that replaces recipes-as-parsed-HTML.
//
// WHY THIS EXISTS. Recipes are stored today as `type: 'text'` pages whose
// HTML is BOTH the rendered output and the storage format: buildRecipePageHtml
// writes `<p><strong>Label:</strong> value</p>` and RecipeParser reads it back
// by matching those labels. That makes the template a schema — renaming a
// label silently drops a field from every recipe in every world, with no error.
//
// With a real schema the fields live in `page.system` and nothing is parsed
// from HTML. The page's native text.content holds the free-form description,
// edited with ProseMirror through the standard journal machinery — the same
// split Librarian's CodexPageModel uses for Expanded Details.
//
// Registered at `init` in artificer.js -- it must be `init`, because a page
// whose type nobody has registered fails validation at world load, one console
// error per page, and will not render. NOTHING IS CONVERTED YET: existing
// recipes are all `text` pages and still read through RecipeParser. See
// documentation/plans/plan-recipe-data-model.md for the sequence.
// ==================================================================

import { MODULE } from '../../const.js';
import { ITEM_TYPES, PROCESS_TYPES, SKILL_LEVEL_MIN, SKILL_LEVEL_MAX, HEAT_MAX } from '../../schema-recipes.js';

/**
 * The page subtype id. MUST agree exactly with the module.json documentTypes
 * entry or every recipe page fails validation at world load — one source of
 * truth is the point.
 */
export const RECIPE_PAGE_TYPE = `${MODULE.ID}.recipe`;

/** D&D 5e rarities, lowercase as stored. Null means "not stated". */
export const RECIPE_RARITIES = ['common', 'uncommon', 'rare', 'very rare', 'legendary'];

/**
 * Data model for Artificer recipe journal pages.
 *
 * Field-for-field with ArtificerRecipe (scripts/data/models/model-recipe.js)
 * minus the three that are document identity rather than recipe data: `id`,
 * `journalPageId`, and `source`-as-journal-UUID. The authored `source` string
 * (a sourcebook or homebrew credit) is a real field and is kept.
 */
export class RecipePageModel extends foundry.abstract.TypeDataModel {
    static defineSchema() {
        const fields = foundry.data.fields;
        return {
            // ----- Core -------------------------------------------------
            // The item this recipe produces, BY NAME. Deliberately not a UUID:
            // recipes resolve against compendia then world at runtime, so a
            // recipe for an item that does not exist yet stays valid and starts
            // working the moment that item is added. Same reasoning as the
            // `related` field on Librarian's CodexPageModel.
            // Blank-permitting on purpose. A page created from the Create Page dialog
            // has no fields yet, and a schema that refuses to hold an incomplete recipe
            // cannot be used to author one. "Required" belongs to the IMPORTER, which
            // rejects a payload without it, not to the model, which has to be able to
            // represent a half-written page.
            resultItemName: new fields.StringField({ required: false, blank: true, initial: '' }),

            // Modifier traits driving recipe/ingredient matching. NOT the shared
            // tags fragment — a wrong trait breaks crafting rather than
            // mis-filing an entry. Do not repeat type or family here.
            traits: new fields.ArrayField(new fields.StringField(), { initial: [] }),

            // ----- Preparation ------------------------------------------
            // Artificer ingredients match on TYPE + optional FAMILY + name;
            // plain D&D items with no Artificer flags match on name only. So
            // `family` narrows and `type` gates — neither is decoration.
            ingredients: new fields.ArrayField(new fields.SchemaField({
                type: new fields.StringField({ required: false, blank: true, initial: 'Component' }),
                family: new fields.StringField({ required: false, blank: true, initial: '' }),
                // Blank for the same reason: "Add ingredient" appends an empty row for
                // the author to fill in, and a required name would reject it on click.
                name: new fields.StringField({ required: false, blank: true, initial: '' }),
                quantity: new fields.NumberField({ required: false, integer: false, min: 0, initial: 1 })
            }), { initial: [] }),

            processType: new fields.StringField({
                required: false, blank: true, initial: 'heat', choices: [...PROCESS_TYPES, '']
            }),
            // 0-3. Meaning depends on processType: heat is Off/Low/Medium/High,
            // grind is Off/Coarse/Medium/Fine.
            processLevel: new fields.NumberField({
                required: false, integer: true, min: 0, max: HEAT_MAX, initial: 0
            }),
            // SECONDS of process time. Distinct from workHours and not a
            // translation of it — one is the machine running, the other is the
            // crafter's day.
            time: new fields.NumberField({ required: false, integer: false, min: 0, max: 120, initial: null, nullable: true }),

            // Vessel crafted IN (beaker, mortar, crucible). Resolved by name.
            apparatusName: new fields.StringField({ required: false, blank: true, initial: '' }),
            // Vessel the result goes INTO (vial, flask, herb bag). Resolved by name.
            // These two were once one field, which is the source of the
            // container-becomes-apparatus round-trip bug in the HTML parser.
            // Keeping them separate here is most of that fix.
            containerName: new fields.StringField({ required: false, blank: true, initial: '' }),

            goldCost: new fields.NumberField({ required: false, min: 0, initial: null, nullable: true }),
            workHours: new fields.NumberField({ required: false, min: 0, initial: null, nullable: true }),
            successDC: new fields.NumberField({ required: false, integer: true, min: 1, max: 30, initial: null, nullable: true }),

            // ----- Classification ---------------------------------------
            type: new fields.StringField({
                required: false, blank: false, initial: ITEM_TYPES.CONSUMABLE,
                choices: Object.values(ITEM_TYPES)
            }),
            category: new fields.StringField({ required: false, blank: true, initial: '' }),
            // Blank means "not stated". Deliberately NOT nullable with a null initial:
            // null is not in `choices`, so the field would fail its own validation on a
            // freshly created page -- the same trap as the required fields above.
            rarity: new fields.StringField({
                required: false, blank: true, initial: '', choices: [...RECIPE_RARITIES, '']
            }),

            // NO `choices` HERE, DELIBERATELY. Valid crafting skill ids come from
            // a user-configurable skills mapping JSON read at runtime, so the
            // allowed set differs per world and changes while a world is live.
            // A fixed choices list would make legitimate recipes fail validation
            // in any world with custom skills. Checked against
            // getEnabledCraftingSkillIds() at use, not at write.
            skill: new fields.StringField({ required: false, blank: true, initial: '' }),
            // 0-20. Note the floor is 0 here and 1 on item flags — recipes and
            // items genuinely differ, this is not a copy error.
            skillLevel: new fields.NumberField({
                required: false, integer: true, min: SKILL_LEVEL_MIN, max: SKILL_LEVEL_MAX, initial: 1
            }),
            // Required kit the actor must hold (Alchemist's Supplies, Herbalism Kit).
            skillKit: new fields.StringField({ required: false, blank: true, initial: '' }),

            // ----- Provenance -------------------------------------------
            // Authored credit. NEVER defaulted to "Artificer" — a default may
            // supply a zero, never an attribution.
            source: new fields.StringField({ required: false, blank: true, initial: '' }),
            license: new fields.StringField({ required: false, blank: true, initial: '' })
        };
    }

    /**
     * The recipe description. Free-form prose, so it lives in the page's native
     * text.content and is edited with ProseMirror rather than through a field.
     * @returns {string}
     */
    get description() {
        const content = this.parent?.text?.content;
        return typeof content === 'string' ? content : '';
    }

    /**
     * The recipe name is the page name — one source of truth, and it keeps the
     * sidebar and the recipe list from ever disagreeing.
     * @returns {string}
     */
    get name() {
        return this.parent?.name ?? '';
    }

    /**
     * Whether this recipe names a container distinct from its apparatus.
     * @returns {boolean}
     */
    get hasSeparateContainer() {
        const apparatus = (this.apparatusName || '').trim();
        const container = (this.containerName || '').trim();
        return Boolean(container) && container !== apparatus;
    }
}
