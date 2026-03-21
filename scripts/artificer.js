// ================================================================== 
// ===== MODULE IMPORTS =============================================
// ================================================================== 

import { MODULE } from './const.js';
import { registerSettings } from './settings.js';
import { loadSkillsDetails } from './skills-rules.js';
import { getAPI } from './api-artificer.js';
import { loadTranslationFromFile } from './cache/cache-items.js';
import { ArtificerItemForm } from './window-artificer-item.js';
import { registerItemSheetIntegration } from './item-sheet-artificer.js';
import { ArtificerRecipeImportWindow } from './window-artificer-recipe-import.js';
import { CraftingWindow } from './window-crafting.js';
import { RecipeBrowserWindow } from './window-recipes.js';
import { SkillsWindow } from './window-skills.js';
import { GatherWindow } from './window-gather.js';
import { requestGatherAndHarvestFromScene } from './manager-gather.js';
import { requestDiscoverGatherSpotsFromScene } from './manager-gather.js';
import { clearGatheringSpotsForScene } from './manager-gather.js';
import { populateGatheringSpotsForScene } from './manager-gather.js';
import { initializeGatherSockets } from './manager-gather.js';
import { SceneManager } from './manager-scene.js';
import { PinsManager } from './manager-pins.js';

// ================================================================== 
// ===== BLACKSMITH API INTEGRATION =================================
// ================================================================== 

// Import Blacksmith API bridge
import { BlacksmithAPI } from '/modules/coffee-pub-blacksmith/api/blacksmith-api.js';

// ================================================================== 
// ===== MODULE INITIALIZATION ======================================
// ================================================================== 

Hooks.once('init', async () => {
    // Preload templates (v13+: global loadTemplates deprecated; removed in v15)
    await foundry.applications.handlebars.loadTemplates([
        'modules/coffee-pub-artificer/templates/item-form.hbs',
        'modules/coffee-pub-artificer/templates/import-recipes.hbs',
        'modules/coffee-pub-artificer/templates/panel-crafting-experiment.hbs',
        'modules/coffee-pub-artificer/templates/window-crafting.hbs',
        'modules/coffee-pub-artificer/templates/window-recipes.hbs',
        'modules/coffee-pub-artificer/templates/window-skills.hbs',
        'modules/coffee-pub-artificer/templates/window-gather.hbs',
        'modules/coffee-pub-artificer/templates/card-results-gather.hbs',
        'modules/coffee-pub-artificer/templates/card-results-craft.hbs',
        'modules/coffee-pub-artificer/templates/partials/form-field.hbs',
        'modules/coffee-pub-artificer/templates/partials/toggle.hbs'
    ]);
    
    // Register Handlebars partials - templates are already loaded, just register them
    try {
        // Get the raw template content (not compiled)
        const formFieldResponse = await fetch('modules/coffee-pub-artificer/templates/partials/form-field.hbs');
        const formFieldTemplate = await formFieldResponse.text();
        
        const toggleResponse = await fetch('modules/coffee-pub-artificer/templates/partials/toggle.hbs');
        const toggleTemplate = await toggleResponse.text();
        
        Handlebars.registerPartial('partials/form-field', formFieldTemplate);
        Handlebars.registerPartial('partials/toggle', toggleTemplate);
    } catch (error) {
        // Error will be handled/logged in ready hook if needed
        throw error;
    }
});

Hooks.once('ready', async () => {
    try {
        // Log that templates/partials were loaded (BlacksmithUtils available after ready)
        BlacksmithUtils.postConsoleAndNotification(MODULE.NAME, `${MODULE.NAME}: Templates and partials registered successfully`, null, false, false);
        
        // Register settings FIRST during the ready phase
        registerSettings();

        try {
            await loadSkillsDetails();
        } catch {
            /* Strict loader posts GM-facing error; continue boot so settings can be fixed */
        }

        try {
            const gi = await import('./manager-gathering-images.js');
            await gi.preloadGatheringMapping?.();
        } catch {
            /* Gathering ruleset strict loader notifies GM; runtime defaults fall back to builtins until fixed */
        }

        // Pre-load item translation (alias → canonical) for cache
        try {
            await loadTranslationFromFile();
        } catch {
            /* Strict loader posts GM-facing error; continue boot so settings can be fixed */
        }
        
        // Register module with Blacksmith
        if (typeof BlacksmithModuleManager !== 'undefined') {
            BlacksmithModuleManager.registerModule(MODULE.ID, {
                name: MODULE.NAME,
                version: MODULE.VERSION
            });
            if (typeof BlacksmithUtils !== 'undefined' && BlacksmithUtils.postConsoleAndNotification) {
                BlacksmithUtils.postConsoleAndNotification(MODULE.NAME, `${MODULE.NAME}: Registered with Blacksmith successfully`, null, false, false);
            }
        } else {
            if (typeof BlacksmithUtils !== 'undefined' && BlacksmithUtils.postConsoleAndNotification) {
                BlacksmithUtils.postConsoleAndNotification(MODULE.NAME, `${MODULE.NAME}: Blacksmith not available`, null, true, false);
            }
        }
        
        // Create and expose API so macros and external callers can use it even if init fails later
        const api = getAPI();
        game.modules.get(MODULE.ID).api = api;

        await api.initialize();
        
        // Initialize module features
        initializeModule();
        
    } catch (error) {
        if (typeof BlacksmithUtils !== 'undefined' && BlacksmithUtils.postConsoleAndNotification) {
            BlacksmithUtils.postConsoleAndNotification(MODULE.NAME, `${MODULE.NAME}: Error during initialization`, error?.message ?? String(error), true, true);
        }
    }
});

// ================================================================== 
// ===== MODULE FUNCTIONS ===========================================
// ================================================================== 

/**
 * Initialize module features
 */
function initializeModule() {
    initializeGatherSockets().catch((error) => {
        BlacksmithUtils.postConsoleAndNotification(MODULE.NAME, `${MODULE.NAME}: Gather sockets failed to initialize`, error?.message ?? String(error), true, false);
    });
    SceneManager.initialize().catch((error) => {
        BlacksmithUtils.postConsoleAndNotification(MODULE.NAME, `${MODULE.NAME}: Scene manager failed to initialize`, error?.message ?? String(error), true, false);
    });
    PinsManager.initialize().catch((error) => {
        BlacksmithUtils.postConsoleAndNotification(MODULE.NAME, `${MODULE.NAME}: Pins manager failed to initialize`, error?.message ?? String(error), true, false);
    });
    // Register menubar tool and secondary bar
    registerMenubarIntegration();
    // Inject Artificer section into item sheets + Edit button
    registerItemSheetIntegration();
    BlacksmithUtils.postConsoleAndNotification(MODULE.NAME, `${MODULE.NAME}: Module initialized`, null, false, false);
}

/**
 * Register menubar tool and secondary bar with Blacksmith
 */
function registerMenubarIntegration() {
    const blacksmith = game.modules.get('coffee-pub-blacksmith')?.api;
    
    if (!blacksmith) {
        if (typeof BlacksmithUtils !== 'undefined' && BlacksmithUtils.postConsoleAndNotification) {
            BlacksmithUtils.postConsoleAndNotification(MODULE.NAME, `${MODULE.NAME}: Blacksmith API not available for menubar integration`, null, true, false);
        }
        return;
    }
    
    // Register secondary bar type first
    const barType = 'artificer-crafting';
    const barRegistered = blacksmith.registerSecondaryBarType(barType, {
        name: 'Artificer Crafting',
        title: 'Artificer Crafting Station',
        icon: 'fa-solid fa-hammer',
        height: 30, // height
        persistence: 'manual', // Stay open until user closes
        moduleId: MODULE.ID
    });
    
    if (!barRegistered) {
        if (typeof BlacksmithUtils !== 'undefined' && BlacksmithUtils.postConsoleAndNotification) {
            BlacksmithUtils.postConsoleAndNotification(MODULE.NAME, `${MODULE.NAME}: Failed to register secondary bar type`, null, true, false);
        }
        return;
    }
    
    // Register menubar tool that opens the secondary bar
    const toolId = 'artificer-menubar-tool';
    const toolRegistered = blacksmith.registerMenubarTool(toolId, {
        icon: 'fa-solid fa-hammer',
        name: 'artificer',
        title: 'Artificer',
        tooltip: "Crafting and Harvesting Tools",
        onClick: function() {
            // Toggle the secondary bar
            blacksmith.toggleSecondaryBar(barType);
        },
        zone: "middle",
        group: "utility",
        groupOrder: null,
        order: 1,
        moduleId: MODULE.ID,  
        gmOnly: false,
        leaderOnly: false,
        visible: true,
        toggleable: true,
        active: false,
        iconColor: null,
        buttonNormalTint: null,
        buttonSelectedTint: "rgba(3, 43, 18, 0.9)"
    });
    
    if (!toolRegistered) {
        if (typeof BlacksmithUtils !== 'undefined' && BlacksmithUtils.postConsoleAndNotification) {
            BlacksmithUtils.postConsoleAndNotification(MODULE.NAME, `${MODULE.NAME}: Failed to register menubar tool`, null, true, false);
        }
        return;
    }
    
    // Register secondary bar item for creating items (GM only)
    const createItemItemId = 'artificer-create-item';
    const createItemRegistered = blacksmith.registerSecondaryBarItem(barType, createItemItemId, {
        icon: 'fa-solid fa-plus-circle',
        label: 'Create Component',
        title: 'Create Component',
        order: 10,
        moduleId: MODULE.ID,
        visible: game.user.isGM,
        onClick: function() {
            if (!game.user.isGM) return;
            // Open the item creation form
            BlacksmithUtils.postConsoleAndNotification(MODULE.NAME, `${MODULE.NAME}: Create Item button clicked`, null, false, false);
            
            try {
                const form = new ArtificerItemForm();
                BlacksmithUtils.postConsoleAndNotification(MODULE.NAME, `${MODULE.NAME}: ArtificerItemForm instance created`, null, false, false);
                
                form.render(true).then(() => {
                    BlacksmithUtils.postConsoleAndNotification(MODULE.NAME, `${MODULE.NAME}: Form rendered successfully`, null, false, false);
                }).catch((error) => {
                    BlacksmithUtils.postConsoleAndNotification(MODULE.NAME, `${MODULE.NAME}: Error rendering form: ${error.message}`, null, true, false);
                });
            } catch (error) {
                BlacksmithUtils.postConsoleAndNotification(MODULE.NAME, `${MODULE.NAME}: Error creating form: ${error.message}`, null, true, false);
            }
        }
    });
    
    // Register secondary bar item for importing recipes (GM only)
    const importRecipeItemId = 'artificer-import-recipes';
    const importRecipeRegistered = blacksmith.registerSecondaryBarItem(barType, importRecipeItemId, {
        icon: 'fa-solid fa-book-open',
        label: 'Import Recipes',
        title: 'Import Recipes',
        order: 20,
        moduleId: MODULE.ID,
        visible: game.user.isGM,
        onClick: function() {
            if (!game.user.isGM) return;
            const win = new ArtificerRecipeImportWindow();
            win.render(true);
        }
    });

    const populateGatherItemId = 'artificer-populate-spots';
    const populateGatherRegistered = blacksmith.registerSecondaryBarItem(barType, populateGatherItemId, {
        icon: 'fa-solid fa-seedling',
        label: 'Populate Gathering Spots',
        title: 'Populate Gathering Spots',
        order: 30,
        moduleId: MODULE.ID,
        visible: game.user.isGM,
        onClick: async function() {
            if (!game.user.isGM) return;
            await populateGatheringSpotsForScene(canvas?.scene ?? null);
        }
    });

    const clearGatherItemId = 'artificer-clear-spots';
    const clearGatherRegistered = blacksmith.registerSecondaryBarItem(barType, clearGatherItemId, {
        icon: 'fa-solid fa-broom',
        label: 'Clear Gathering Spots',
        title: 'Clear Gathering Spots',
        order: 40,
        moduleId: MODULE.ID,
        visible: game.user.isGM,
        onClick: async function() {
            if (!game.user.isGM) return;
            await clearGatheringSpotsForScene(canvas?.scene ?? null);
        }
    });

    // Register secondary bar item for Roll for Components (gather) — GM only
    const gatherItemId = 'artificer-roll-components';
    const gatherRegistered = blacksmith.registerSecondaryBarItem(barType, gatherItemId, {
        icon: 'fa-solid fa-leaf',
        label: 'Request Roll for Components',
        title: 'Request Roll for Components',
        order: 50,
        moduleId: MODULE.ID,
        visible: game.user.isGM,
        onClick: function() {
            if (!game.user.isGM) return;
            const win = new GatherWindow();
            win.render(true);
        }
    });

    // Register secondary bar item for skills window
    const skillsItemId = 'artificer-skills';
    const skillsRegistered = blacksmith.registerSecondaryBarItem(barType, skillsItemId, {
        icon: 'fa-solid fa-seedling',
        label: 'Manage Skills',
        title: 'Manage Skills',
        order: 60,
        moduleId: MODULE.ID,
        visible: true,
        onClick: function() {
            const win = new SkillsWindow();
            win.render(true);
        }
    });

    // Register secondary bar item for crafting
    const recipeBrowserItemId = 'artificer-recipes';
    const recipeBrowserRegistered = blacksmith.registerSecondaryBarItem(barType, recipeBrowserItemId, {
        icon: 'fa-solid fa-book-open',
        label: 'Recipe Browser',
        title: 'Recipe Browser',
        order: 70,
        moduleId: MODULE.ID,
        visible: true,
        onClick: function() {
            const win = new RecipeBrowserWindow();
            win.render(true);
        }
    });

    // Register secondary bar item for crafting
    const craftingItemId = 'artificer-crafting';
    const craftingRegistered = blacksmith.registerSecondaryBarItem(barType, craftingItemId, {
        icon: 'fa-solid fa-hammer',
        label: 'Crafting Station',
        title: 'Crafting Station',
        order: 75,
        moduleId: MODULE.ID,
        visible: true,
        onClick: function() {
            const win = new CraftingWindow();
            win.render(true);
        }
    });

    const discoverGatherItemId = 'artificer-discover-spots';
    const discoverGatherRegistered = blacksmith.registerSecondaryBarItem(barType, discoverGatherItemId, {
        icon: 'fa-solid fa-binoculars',
        label: 'Explore the Area',
        title: 'Explore the Area',
        order: 80,
        moduleId: MODULE.ID,
        visible: true,
        onClick: async function() {
            await requestDiscoverGatherSpotsFromScene();
        }
    });

    // Register secondary bar item for Gather and Harvest (direct roll-based gather; no pin required)
    const gatherHarvestItemId = 'artificer-gather-harvest';
    const gatherHarvestRegistered = blacksmith.registerSecondaryBarItem(barType, gatherHarvestItemId, {
        icon: 'fa-solid fa-seedling',
        label: 'Gather and Harvest',
        title: 'Gather and Harvest',
        order: 90,
        moduleId: MODULE.ID,
        visible: true,
        onClick: async function() {
            await requestGatherAndHarvestFromScene();
        }
    });
    
    if (craftingRegistered && recipeBrowserRegistered && createItemRegistered && importRecipeRegistered && skillsRegistered && gatherRegistered && gatherHarvestRegistered && discoverGatherRegistered && clearGatherRegistered && populateGatherRegistered) {
        if (typeof BlacksmithUtils !== 'undefined' && BlacksmithUtils.postConsoleAndNotification) {
            BlacksmithUtils.postConsoleAndNotification(MODULE.NAME, `${MODULE.NAME}: Menubar tool, secondary bar, and crafting/import buttons registered successfully`, null, false, false);
        }
    } else {
        if (typeof BlacksmithUtils !== 'undefined' && BlacksmithUtils.postConsoleAndNotification) {
            BlacksmithUtils.postConsoleAndNotification(MODULE.NAME, `${MODULE.NAME}: Failed to register some buttons`, `create: ${createItemRegistered}, import-recipes: ${importRecipeRegistered}, recipe-browser: ${recipeBrowserRegistered}, skills: ${skillsRegistered}, gather: ${gatherRegistered}, gather-harvest: ${gatherHarvestRegistered}, discover: ${discoverGatherRegistered}, clear: ${clearGatherRegistered}, populate: ${populateGatherRegistered}`, true, false);
        }
    }
}

