// ================================================================== 
// ===== MODULE IMPORTS =============================================
// ================================================================== 

import { MODULE } from './const.js';
import { registerSettings } from './settings.js';
import { getAPI } from './api-artificer.js';
import { loadTranslationFromFile } from './cache/cache-items.js';
import { ArtificerItemForm } from './window-artificer-item.js';
import { registerItemSheetIntegration } from './item-sheet-artificer.js';
import { ArtificerRecipeImportWindow } from './window-artificer-recipe-import.js';
import { CraftingWindow } from './window-crafting.js';
import { SkillsWindow } from './window-skills.js';

// ================================================================== 
// ===== BLACKSMITH API INTEGRATION =================================
// ================================================================== 

// Import Blacksmith API bridge
import { BlacksmithAPI } from '/modules/coffee-pub-blacksmith/api/blacksmith-api.js';

// ================================================================== 
// ===== MODULE INITIALIZATION ======================================
// ================================================================== 

Hooks.once('init', async () => {
    // Preload templates
    await loadTemplates([
        'modules/coffee-pub-artificer/templates/item-form.hbs',
        'modules/coffee-pub-artificer/templates/import-recipes.hbs',
        'modules/coffee-pub-artificer/templates/panel-crafting-experiment.hbs',
        'modules/coffee-pub-artificer/templates/window-crafting.hbs',
        'modules/coffee-pub-artificer/templates/window-skills.hbs',
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

        // Pre-load item translation (alias → canonical) for cache
        await loadTranslationFromFile();
        
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
        
        // Initialize module API
        const api = getAPI();
        await api.initialize();
        
        // Expose API globally for external access
        game.modules.get(MODULE.ID).api = api;
        
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
        height: 40, // height
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
        buttonNormalTint: "rgba(3, 43, 18, 0.9)",
        buttonSelectedTint: null
    });
    
    if (!toolRegistered) {
        if (typeof BlacksmithUtils !== 'undefined' && BlacksmithUtils.postConsoleAndNotification) {
            BlacksmithUtils.postConsoleAndNotification(MODULE.NAME, `${MODULE.NAME}: Failed to register menubar tool`, null, true, false);
        }
        return;
    }
    
    // Register secondary bar item for crafting
    const craftingItemId = 'artificer-crafting';
    const craftingRegistered = blacksmith.registerSecondaryBarItem(barType, craftingItemId, {
        icon: 'fa-solid fa-hammer',
        title: 'Craft',
        moduleId: MODULE.ID,
        visible: true,
        onClick: function() {
            const win = new CraftingWindow();
            win.render(true);
        }
    });

    // Register secondary bar item for creating items
    const createItemItemId = 'artificer-create-item';
    const createItemRegistered = blacksmith.registerSecondaryBarItem(barType, createItemItemId, {
        icon: 'fa-solid fa-plus-circle',
        title: 'Create Item',
        moduleId: MODULE.ID,
        visible: true,
        onClick: function() {
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
    
    // Register secondary bar item for importing recipes
    const importRecipeItemId = 'artificer-import-recipes';
    const importRecipeRegistered = blacksmith.registerSecondaryBarItem(barType, importRecipeItemId, {
        icon: 'fa-solid fa-book-open',
        title: 'Import Recipes',
        moduleId: MODULE.ID,
        visible: true,
        onClick: function() {
            const win = new ArtificerRecipeImportWindow();
            win.render(true);
        }
    });

    // Register secondary bar item for skills window
    const skillsItemId = 'artificer-skills';
    const skillsRegistered = blacksmith.registerSecondaryBarItem(barType, skillsItemId, {
        icon: 'fa-solid fa-star',
        title: 'Skills',
        moduleId: MODULE.ID,
        visible: true,
        onClick: function() {
            const win = new SkillsWindow();
            win.render(true);
        }
    });
    
    if (craftingRegistered && createItemRegistered && importRecipeRegistered && skillsRegistered) {
        if (typeof BlacksmithUtils !== 'undefined' && BlacksmithUtils.postConsoleAndNotification) {
            BlacksmithUtils.postConsoleAndNotification(MODULE.NAME, `${MODULE.NAME}: Menubar tool, secondary bar, and crafting/import buttons registered successfully`, null, false, false);
        }
    } else {
        if (typeof BlacksmithUtils !== 'undefined' && BlacksmithUtils.postConsoleAndNotification) {
            BlacksmithUtils.postConsoleAndNotification(MODULE.NAME, `${MODULE.NAME}: Failed to register some buttons`, `create: ${createItemRegistered}, import-recipes: ${importRecipeRegistered}, skills: ${skillsRegistered}`, true, false);
        }
    }
}

