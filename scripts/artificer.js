// ================================================================== 
// ===== MODULE IMPORTS =============================================
// ================================================================== 

import { MODULE } from './const.js';
import { registerSettings } from './settings.js';
import { getAPI } from './api-artificer.js';

// ================================================================== 
// ===== BLACKSMITH API INTEGRATION =================================
// ================================================================== 

// Import Blacksmith API bridge
import { BlacksmithAPI } from '/modules/coffee-pub-blacksmith/api/blacksmith-api.js';

// ================================================================== 
// ===== MODULE INITIALIZATION ======================================
// ================================================================== 

Hooks.once('ready', async () => {
    try {
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
        persistence: 'auto', // Auto-close after delay
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
        zone: 'middle',
        order: 5,
        moduleId: MODULE.ID,
        gmOnly: false,
        leaderOnly: false,
        visible: true,
        onClick: function() {
            // Toggle the secondary bar
            blacksmith.toggleSecondaryBar(barType);
        }
    });
    
    if (toolRegistered) {
        console.log(`✅ ${MODULE.NAME}: Menubar tool and secondary bar registered successfully`);
    } else {
        console.warn(`⚠️ ${MODULE.NAME}: Failed to register menubar tool`);
    }
}

