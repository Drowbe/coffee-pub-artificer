// ================================================================== 
// ===== IMPORTS ====================================================
// ================================================================== 

// -- Import MODULE variables --
import { MODULE } from './const.js';


// ================================================================== 
// ===== CONSTANTS ====================================================
// ================================================================== 

/**
 * WROKFLOW GROUPS
 * Use workflow groups to organize settings into visual sections
 * This will allow the global CSS rules to style the settings window.
 */
const WORKFLOW_GROUPS = {
    GETTING_STARTED: 'getting-started',
    COMMON_SETTINGS: 'common-settings',
};


// ================================================================== 
// ===== HELPER FUNCTIONS ===========================================
// ================================================================== 

/**
 * Helper function to register headers with reduced verbosity while preserving CSS styling
 * @param {string} id - Unique identifier for the header
 * @param {string} labelKey - Localization key for the label
 * @param {string} hintKey - Localization key for the hint
 * @param {string} level - Header level (H1, H2, H3, H4)
 * @param {string} group - Workflow group for collapsible sections
 */
function registerHeader(id, labelKey, hintKey, level = 'H2', group = null) {
    game.settings.register(MODULE.ID, `heading${level}${id}`, {
        name: MODULE.ID + `.${labelKey}`,
        hint: MODULE.ID + `.${hintKey}`,
        scope: "world",
        config: true,
        default: "",
        type: String,
        group: group
    });
}

/**
 * Get journal choices for dropdowns (world journals only)
 * @returns {Object} Object mapping journal UUID to display label
 */
function getJournalChoices() {
    const choices = { "": "-- None --" };
    if (!game.journal) return choices;
    for (const journal of game.journal) {
        choices[journal.uuid] = journal.name;
    }
    return choices;
}

/**
 * Get compendium choices for dropdowns
 * @returns {Object} Object mapping compendium IDs to display labels
 */
function getCompendiumChoices() {
    const choices = { "none": "-- None --" };
    
    // Get all Item compendiums
    const itemPacks = game.packs.filter(pack => pack.documentName === 'Item');
    
    for (const pack of itemPacks) {
        // Create readable label: "Package: Compendium Name"
        const packageLabel = pack.metadata.packageLabel || pack.metadata.package || pack.metadata.packageName || "Unknown";
        const label = `${packageLabel}: ${pack.metadata.label}`;
        choices[pack.metadata.id] = label;
    }
    
    return choices;
}

/**
 * Register ingredient compendium priority settings
 * @param {number} numCompendiums - Number of priority slots to register
 */
function registerIngredientCompendiumSettings(numCompendiums = 1) {
    const choices = getCompendiumChoices();
    
    // Register priority settings
    for (let i = 1; i <= numCompendiums; i++) {
        const settingKey = `ingredientCompendium${i}`;
        
        // Skip if already registered
        if (game.settings.settings.has(`${MODULE.ID}.${settingKey}`)) {
            continue;
        }
        
        game.settings.register(MODULE.ID, settingKey, {
            name: `Ingredients: Priority ${i}`,
            hint: null,
            scope: 'world',
            config: true,
            default: 'none',
            type: String,
            choices: choices,
            group: WORKFLOW_GROUPS.COMMON_SETTINGS
        });
    }
}


// ================================================================== 
// ===== SETTINGS REGISTRATION ======================================
// ================================================================== 

/**
 * STYLING AND FORMATTING
 * Use registerHeader() to register headers with reduced verbosity while preserving CSS styling
 * This function will register the header with the following parameters:
 * - id: Unique identifier for the header
 * - labelKey: Localization key for the label
 * - hintKey: Localization key for the hint
 * - level: Header level (H1, H2, H3, H4, or HR)
 * - group: Workflow group for collapsible sections
 * Example: registerHeader('ExampleSubheader', 'headingH3ExampleSubheader-Label', 'headingH3ExampleSubheader-Hint', 'H3', WORKFLOW_GROUPS.COMMON_SETTINGS);
 * This will register the header with the following parameters:
 * - id: ExampleSubheader
 * - labelKey: headingH3ExampleSubheader-Label
 * - hintKey: headingH3ExampleSubheader-Hint
 * - level: H3
 * - group: COMMON_SETTINGS
 */



/**
 * Register all module settings
 * Called during the 'ready' phase when Foundry is ready
 */
export const registerSettings = () => {
   
	// ==================================================================================================================== 
	// ==================================================================================================================== 
	// == H1: GETTING STARTED
	// ==================================================================================================================== 
	// ==================================================================================================================== 
	registerHeader('GettingStarted', 'headingH1GettingStarted-Label', 'headingH1GettingStarted-Hint', 'H1', WORKFLOW_GROUPS.GETTING_STARTED);

	// --------------------------------------
	// -- H4: INTRODUCTION
	// --------------------------------------
	registerHeader('Introduction', 'headingH4Introduction-Label', 'headingH4Introduction-Hint', 'H4', WORKFLOW_GROUPS.GETTING_STARTED);


	// ==================================================================================================================== 
	// ===== HR Visual Divider
	// ==================================================================================================================== 
	game.settings.register(MODULE.ID, "headingHR", {
		name: "",
		hint: "",
		scope: "world",
		config: true,
		default: "",
		type: String,
	});


	// --------------------------------------
	// -- H2: COMMON SETTINGS
	// --------------------------------------
	registerHeader('CommonSettings', 'headingH2CommonSettings-Label', 'headingH2CommonSettings-Hint', 'H2', WORKFLOW_GROUPS.COMMON_SETTINGS);

    // --------------------------------------
	// -- H3: JOURNAL SETTINGS
	// --------------------------------------
	registerHeader('JournalSettings', 'headingH3JournalSettings-Label', 'headingH3JournalSettings-Hint', 'H3', WORKFLOW_GROUPS.COMMON_SETTINGS);

    // -- Recipe Journal Setting --
	game.settings.register(MODULE.ID, 'recipeJournal', {
        name: MODULE.ID + '.recipeJournal-Label',
        hint: MODULE.ID + '.recipeJournal-Hint',
        scope: 'world',
        config: true,
        default: '',
        type: String,
        choices: getJournalChoices(),
		group: WORKFLOW_GROUPS.COMMON_SETTINGS
	});

    // -- Blueprint Journal Setting --
	game.settings.register(MODULE.ID, 'blueprintJournal', {
        name: MODULE.ID + '.blueprintJournal-Label',
        hint: MODULE.ID + '.blueprintJournal-Hint',
        scope: 'world',
        config: true,
        default: '',
        type: String,
        choices: getJournalChoices(),
		group: WORKFLOW_GROUPS.COMMON_SETTINGS
	});

    // --------------------------------------
	// -- H3: COMPENDIUM SETTINGS
	// --------------------------------------
	registerHeader('CompendiumSettings', 'headingH3CompendiumSettings-Label', 'headingH3CompendiumSettings-Hint', 'H3', WORKFLOW_GROUPS.COMMON_SETTINGS);

    // -- Item Lookup Order (result items, containers) --
	game.settings.register(MODULE.ID, 'itemLookupOrder', {
        name: MODULE.ID + '.itemLookupOrder-Label',
        hint: MODULE.ID + '.itemLookupOrder-Hint',
        scope: 'world',
        config: true,
        default: 'compendia-first',
        type: String,
        choices: {
            'compendia-first': 'Compendia first, world fallback',
            'world-first': 'World first, compendia fallback',
            'compendia-only': 'Compendia only (no world)'
        },
		group: WORKFLOW_GROUPS.COMMON_SETTINGS
	});

    // -- Ingredient Storage Source --
	game.settings.register(MODULE.ID, 'ingredientStorageSource', {
        name: MODULE.ID + '.ingredientStorageSource-Label',
        hint: MODULE.ID + '.ingredientStorageSource-Hint',
        scope: 'world',
        config: true,
        default: 'compendia-only',
        type: String,
        choices: {
            'compendia-only': 'Compendia only',
            'world-only': 'World only',
            'compendia-then-world': 'Compendia first, then world',
            'world-then-compendia': 'World first, then compendia'
        },
        requiresReload: true,
		group: WORKFLOW_GROUPS.COMMON_SETTINGS
	});

    // -- Number of Ingredient Compendiums --
	game.settings.register(MODULE.ID, 'numIngredientCompendiums', {
        name: MODULE.ID + '.numIngredientCompendiums-Label',
        hint: MODULE.ID + '.numIngredientCompendiums-Hint',
        scope: 'world',
        config: true,
        default: 1,
        type: Number,
        range: { min: 0, max: 30, step: 1 },
        requiresReload: true,
		group: WORKFLOW_GROUPS.COMMON_SETTINGS
	});

    // Register ingredient compendium priority settings
    // Use default of 1 for initial registration (user can increase and reload)
    let numCompendiums = 1;
    try {
        numCompendiums = game.settings.get(MODULE.ID, 'numIngredientCompendiums') ?? 1;
    } catch (error) {
        // Setting not accessible yet (first load), use default
        numCompendiums = 1;
    }
    registerIngredientCompendiumSettings(numCompendiums);

    // -- Item Cache (persisted, GM-built) - not shown in config UI --
    game.settings.register(MODULE.ID, 'itemCache', {
        name: 'Item Cache (persisted)',
        hint: 'Stores built item cache for fast lookup. Managed by Refresh Cache in Crafting Station.',
        scope: 'world',
        config: false,
        default: null,
        type: Object
    });

    // Add more settings here as needed
    



    // *** REPORT SETTINGS LOADED ***
    // Note: BlacksmithUtils is available globally after importing BlacksmithAPI in the main file
    if (typeof BlacksmithUtils !== 'undefined' && BlacksmithUtils.postConsoleAndNotification) {
        BlacksmithUtils.postConsoleAndNotification(MODULE.NAME, `${MODULE.NAME}: Settings registered.`, null, false, false);
    } else {
        console.log(`${MODULE.NAME}: Settings registered.`);
    }
};

