// ================================================================== 
// ===== RECIPE PARSER ==============================================
// ================================================================== 

import { MODULE } from '../const.js';
import { postDebug, postError } from '../utils/helpers.js';
import { ArtificerRecipe } from '../data/models/model-recipe.js';
import { ITEM_TYPES, CRAFTING_SKILLS, HEAT_MAX } from '../schema-recipes.js';

/**
 * Parser for Recipe journal entries
 * Parses HTML journal content into ArtificerRecipe objects
 */
export class RecipeParser {
    /**
     * Parse a single journal page into an ArtificerRecipe
     * @param {JournalEntryPage} page - Journal page
     * @param {string} enrichedHtml - Enriched HTML content
     * @returns {Promise<ArtificerRecipe|null>} Parsed recipe or null if invalid
     */
    static async parseSinglePage(page, enrichedHtml) {
        if (!page || !enrichedHtml) return null;
        
        try {
            // Use DOMParser for safe HTML parsing
            const parser = new DOMParser();
            const doc = parser.parseFromString(enrichedHtml, 'text/html');
            
            // Extract data from structured HTML
            const data = {
                id: page.uuid,
                name: page.name,
                source: page.parent?.uuid ?? '',
                journalPageId: page.id
            };
            
            // Parse all paragraphs
            const paragraphs = doc.querySelectorAll('p');
            for (const p of paragraphs) {
                const strong = p.querySelector('strong');
                if (!strong) continue;
                
                let label = strong.textContent.trim();
                // Remove trailing colon if present
                if (label.endsWith(':')) {
                    label = label.slice(0, -1);
                }
                
                // Get value (text after the strong tag)
                const value = p.textContent.replace(strong.textContent, '').trim();
                
                // Parse based on label (case-insensitive)
                const labelLower = label.toLowerCase();
                
                if (labelLower === 'type') {
                    data.type = value;
                } else if (labelLower === 'category') {
                    data.category = value;
                } else if (labelLower === 'skill') {
                    data.skill = value;
                } else if (labelLower === 'skill level') {
                    data.skillLevel = parseInt(value) || 0;
                } else if (labelLower === 'workstation') {
                    data.workstation = value || null;
                } else if (labelLower === 'heat') {
                    const str = (value || '').toString().trim().toLowerCase();
                    const num = parseInt(value, 10);
                    if (!isNaN(num) && num >= 0 && num <= HEAT_MAX) data.heat = num;
                    else if (['off', 'low', 'medium', 'high'].includes(str)) data.heat = { off: 0, low: 1, medium: 2, high: 3 }[str];
                    else if (!isNaN(num) && num <= 100) data.heat = Math.min(HEAT_MAX, Math.round((num / 100) * HEAT_MAX));
                } else if (labelLower === 'time') {
                    const sec = this._parseTimeToSeconds(value);
                    if (sec != null) data.time = sec;
                } else if (labelLower === 'apparatus') {
                    const uuidMatch = value.match(/@UUID\[(.*?)\]{(.*?)}/);
                    if (uuidMatch) {
                        data.apparatusName = uuidMatch[2].trim();
                    } else if (value.trim()) {
                        data.apparatusName = value.trim();
                    }
                } else if (labelLower === 'container') {
                    const uuidMatch = value.match(/@UUID\[(.*?)\]{(.*?)}/);
                    const val = uuidMatch ? uuidMatch[2].trim() : value.trim();
                    if (val) {
                        if (!data.apparatusName) data.apparatusName = val;
                        else data.containerName = val;
                    }
                } else if (labelLower === 'tool') {
                    if (value.trim()) data.toolName = value.trim();
                } else if (labelLower === 'result') {
                    const uuidMatch = value.match(/@UUID\[(.*?)\]{(.*?)}/);
                    if (uuidMatch) {
                        data.resultItemName = uuidMatch[2].trim(); // Use label, not UUID (portable)
                    } else if (value.trim()) {
                        data.resultItemName = value.trim();
                    }
                } else if (labelLower === 'tags') {
                    // Parse comma-separated tags
                    data.tags = value.split(',').map(t => t.trim()).filter(t => t);
                } else if (labelLower === 'description') {
                    data.description = value;
                } else if (labelLower === 'ingredients') {
                    // Ingredients are in a following <ul> element
                    const ul = p.nextElementSibling;
                    if (ul && ul.tagName === 'UL') {
                        data.ingredients = this._parseIngredients(ul);
                    }
                }
            }
            
            // Require resultItemName (name-based, no world UUIDs)
            if (!data.resultItemName) {
                data.resultItemName = data.name; // Fallback to recipe name
            }
            
            // Create recipe object
            const recipe = new ArtificerRecipe(data);
            if (!recipe.validate()) {
                postDebug(MODULE.NAME, `Recipe "${data.name}" failed validation`);
                return null;
            }
            
            return recipe;
            
        } catch (error) {
            postError(MODULE.NAME, `Error parsing recipe from page "${page.name}"`, error?.message ?? String(error));
            return null;
        }
    }
    
    /**
     * Parse time string to seconds (e.g. "30", "30 sec", "2 min")
     * @param {string} value
     * @returns {number|null}
     */
    static _parseTimeToSeconds(value) {
        if (!value || typeof value !== 'string') return null;
        const s = value.trim();
        const num = parseInt(s);
        if (!isNaN(num) && num >= 0) return num;
        const minMatch = s.match(/^(\d+)\s*(?:min|minute)/i);
        if (minMatch) return (parseInt(minMatch[1]) || 0) * 60;
        const secMatch = s.match(/^(\d+)\s*(?:sec|second)/i);
        if (secMatch) return parseInt(secMatch[1]) || 0;
        return null;
    }

    /**
     * Parse ingredients from a <ul> element
     * @param {HTMLUListElement} ul - Unordered list element
     * @returns {Array<{type: string, name: string, quantity: number}>} Parsed ingredients
     */
    static _parseIngredients(ul) {
        const ingredients = [];
        const items = ul.querySelectorAll('li');
        
        for (const item of items) {
            const text = item.textContent.trim();
            
            // Parse format: "Type: Name (quantity)"
            // Example: "Herb: Lavender (2)" or "Essence: Life (1)"
            const match = text.match(/^([^:]+):\s*([^(]+)\s*\((\d+)\)/);
            if (match) {
                const [, type, name, quantity] = match;
                ingredients.push({
                    type: type.trim().toLowerCase(),
                    name: name.trim(),
                    quantity: parseInt(quantity) || 1
                });
            } else {
                // Fallback: try to parse without parentheses
                const simpleMatch = text.match(/^([^:]+):\s*(.+)$/);
                if (simpleMatch) {
                    const [, type, name] = simpleMatch;
                    ingredients.push({
                        type: type.trim().toLowerCase(),
                        name: name.trim(),
                        quantity: 1
                    });
                }
            }
        }
        
        return ingredients;
    }
}
