// ================================================================== 
// ===== MODULE IMPORTS =============================================
// ================================================================== 

import { MODULE } from './const.js';
import { registerSettings } from './settings.js';
import { getAPI } from './api-artificer.js';
import { ArtificerItemForm } from './window-artificer-item.js';
import { registerItemSheetIntegration } from './item-sheet-artificer.js';
import { ArtificerImportWindow } from './window-artificer-import.js';
import { CraftingExperimentPanel } from './panel-crafting-experiment.js';

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
        'modules/coffee-pub-artificer/templates/import-items.hbs',
        'modules/coffee-pub-artificer/templates/panel-crafting-experiment.hbs',
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
        
        // Register module with Blacksmith
        if (typeof BlacksmithModuleManager !== 'undefined') {
            BlacksmithModuleManager.registerModule(MODULE.ID, {
                name: MODULE.NAME,
                version: MODULE.VERSION
            });
            console.log(`✅ ${MODULE.NAME}: Registered with Blacksmith successfully`);
        } else {
            console.warn(`⚠️ ${MODULE.NAME}: Blacksmith not available`);
        }
        
        // Initialize module API
        const api = getAPI();
        await api.initialize();
        
        // Expose API globally for external access
        game.modules.get(MODULE.ID).api = api;
        
        // Initialize module features
        initializeModule();
        
    } catch (error) {
        console.error(`❌ ${MODULE.NAME}: Error during initialization:`, error);
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

    console.log(`${MODULE.NAME}: Module initialized`);
}

/**
 * Register menubar tool and secondary bar with Blacksmith
 */
function registerMenubarIntegration() {
    const blacksmith = game.modules.get('coffee-pub-blacksmith')?.api;
    
    if (!blacksmith) {
        console.warn(`⚠️ ${MODULE.NAME}: Blacksmith API not available for menubar integration`);
        return;
    }
    
    // Register secondary bar type first
    const barType = 'artificer-crafting';
    const barRegistered = blacksmith.registerSecondaryBarType(barType, {
        name: 'Artificer Crafting',
        title: 'Artificer Crafting Station',
        icon: 'fa-solid fa-hammer',
        height: 100, // 100px height as requested
        persistence: 'manual', // Stay open until user closes
        moduleId: MODULE.ID
    });
    
    if (!barRegistered) {
        console.warn(`⚠️ ${MODULE.NAME}: Failed to register secondary bar type`);
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
        console.warn(`⚠️ ${MODULE.NAME}: Failed to register menubar tool`);
        return;
    }
    
    // Register secondary bar item for experimentation (crafting prototype)
    const experimentItemId = 'artificer-experiment';
    const experimentRegistered = blacksmith.registerSecondaryBarItem(barType, experimentItemId, {
        icon: 'fa-solid fa-flask',
        title: 'Experiment',
        moduleId: MODULE.ID,
        visible: true,
        onClick: function() {
            const panel = new CraftingExperimentPanel();
            panel.render(true);
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
    
    // Register secondary bar item for importing items
    const importItemItemId = 'artificer-import-items';
    const importItemRegistered = blacksmith.registerSecondaryBarItem(barType, importItemItemId, {
        icon: 'fa-solid fa-file-import',
        title: 'Import Items',
        moduleId: MODULE.ID,
        visible: true,
        onClick: function() {
            const importWindow = new ArtificerImportWindow();
            importWindow.render(true);
        }
    });
    
    if (experimentRegistered && createItemRegistered && importItemRegistered) {
        console.log(`✅ ${MODULE.NAME}: Menubar tool, secondary bar, and crafting buttons registered successfully`);
    } else {
        console.warn(`⚠️ ${MODULE.NAME}: Failed to register some buttons (create: ${createItemRegistered}, import: ${importItemRegistered})`);
    }
}

