// ================================================================== 
// ===== RECIPE PARSER ==============================================
// ================================================================== 

import { MODULE } from '../const.js';
import { extractNameFromUuidLink } from '../utils/helpers.js';
import { ArtificerRecipe } from '../data/models/model-recipe.js';
import { ITEM_TYPES, CRAFTING_SKILLS, HEAT_MAX, PROCESS_TYPES, SKILL_LEVEL_MIN, SKILL_LEVEL_MAX } from '../schema-recipes.js';
import { ARTIFICER_TYPES, LEGACY_TYPE_TO_ARTIFICER_TYPE, FAMILIES_BY_TYPE } from '../schema-artificer-item.js';

/**
 * Parser for Recipe journal entries
 * Parses HTML journal content into ArtificerRecipe objects
 */
export class RecipeParser {
    /**
     * Parse a single journal page into an ArtificerRecipe
     * @param {JournalEntryPage} page - Journal page
     * @param {string} enrichedHtml - Enriched HTML content
     * @param {JournalEntry} [journal] - Parent journal (ensures source is set)
     * @returns {Promise<ArtificerRecipe|null>} Parsed recipe or null if invalid
     */
    static async parseSinglePage(page, enrichedHtml, journal = null) {
        if (!page || !enrichedHtml) return null;
        
        try {
            // Use DOMParser for safe HTML parsing
            const parser = new DOMParser();
            const doc = parser.parseFromString(enrichedHtml, 'text/html');
            
            const journalUuid = journal?.uuid ?? page.parent?.uuid ?? '';
            const data = {
                id: page.uuid,
                name: page.name,
                source: journalUuid,
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
                
                if (labelLower === 'name') {
                    if (value.trim()) data.name = value.trim();
                } else if (labelLower === 'type') {
                    data.type = value;
                } else if (labelLower === 'category') {
                    data.category = value;
                } else if (labelLower === 'skill') {
                    data.skill = value;
                } else if (labelLower === 'skill level') {
                    const num = parseInt(value, 10);
                    data.skillLevel = (!isNaN(num) && num >= SKILL_LEVEL_MIN && num <= SKILL_LEVEL_MAX) ? num : 1;
                } else if (labelLower === 'process type') {
                    const v = (value || '').toString().trim().toLowerCase();
                    if (PROCESS_TYPES.includes(v)) data.processType = v;
                } else if (labelLower === 'process level') {
                    const str = (value || '').toString().trim().toLowerCase();
                    const num = parseInt(value, 10);
                    if (!isNaN(num) && num >= 0 && num <= HEAT_MAX) data.processLevel = num;
                    else if (['off', 'low', 'medium', 'high'].includes(str)) data.processLevel = { off: 0, low: 1, medium: 2, high: 3 }[str];
                    else if (['coarse', 'fine'].includes(str)) data.processLevel = { coarse: 1, fine: 3 }[str];
                    else if (!isNaN(num) && num <= 100) data.processLevel = Math.min(HEAT_MAX, Math.round((num / 100) * HEAT_MAX));
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
                } else if (labelLower === 'tool' || labelLower === 'skill kit') {
                    if (value.trim()) data.skillKit = value.trim();
                } else if (labelLower === 'gold cost') {
                    const num = parseInt(value, 10);
                    if (!isNaN(num) && num >= 0) data.goldCost = num;
                } else if (labelLower === 'work hours') {
                    const num = parseFloat(value);
                    if (!isNaN(num) && num >= 0) data.workHours = num;
                } else if (labelLower === 'result') {
                    const uuidMatch = value.match(/@UUID\[(.*?)\]{(.*?)}/);
                    if (uuidMatch) {
                        data.resultItemName = uuidMatch[2].trim(); // Use label, not UUID (portable)
                    } else if (value.trim()) {
                        data.resultItemName = value.trim();
                    }
                } else if (labelLower === 'tags' || labelLower === 'traits') {
                    // Parse comma-separated traits (journal may still say "Tags:" for display)
                    const list = value.split(',').map(t => t.trim()).filter(t => t);
                    data.traits = data.traits ?? [];
                    data.traits.push(...list);
                } else if (labelLower === 'description') {
                    const descDiv = p.nextElementSibling;
                    data.description = (descDiv?.classList?.contains('recipe-description') ? descDiv.innerHTML : value) || value;
                } else if (labelLower === 'source') {
                    if (value.trim()) data.source = value.trim();
                } else if (labelLower === 'license') {
                    if (value.trim()) data.license = value.trim();
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
                BlacksmithUtils.postConsoleAndNotification(MODULE.NAME, `Recipe "${data.name}" failed validation`, null, true, false);
                return null;
            }
            
            return recipe;
            
        } catch (error) {
            BlacksmithUtils.postConsoleAndNotification(MODULE.NAME, `Error parsing recipe from page "${page.name}"`, error?.message ?? String(error), true, false);
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
     * Parse ingredients from a <ul> element. Label maps to TYPE (Component|Creation|Tool) + optional FAMILY.
     * @param {HTMLUListElement} ul - Unordered list element
     * @returns {Array<{type: string, family: string, name: string, quantity: number}>} Parsed ingredients
     */
    static _parseIngredients(ul) {
        const allFamilies = (FAMILIES_BY_TYPE[ARTIFICER_TYPES.COMPONENT] || [])
            .concat(FAMILIES_BY_TYPE[ARTIFICER_TYPES.CREATION] || [])
            .concat(FAMILIES_BY_TYPE[ARTIFICER_TYPES.TOOL] || []);
        const ingredients = [];
        const items = ul.querySelectorAll('li');
        for (const item of items) {
            const text = item.textContent.trim();
            const match = text.match(/^([^:]+):\s*([^(]+)\s*\((\d+)\)/);
            if (match) {
                const [, label, name, quantity] = match;
                const { type, family } = this._labelToTypeAndFamily(label.trim(), allFamilies);
                ingredients.push({ type, family, name: extractNameFromUuidLink(name), quantity: parseInt(quantity) || 1 });
            } else {
                const simpleMatch = text.match(/^([^:]+):\s*(.+)$/);
                if (simpleMatch) {
                    const [, label, name] = simpleMatch;
                    const { type, family } = this._labelToTypeAndFamily(label.trim(), allFamilies);
                    ingredients.push({ type, family, name: extractNameFromUuidLink(name), quantity: 1 });
                }
            }
        }
        return ingredients;
    }

    /**
     * Map journal label to TYPE + optional FAMILY (architecture: TYPE > FAMILY > TRAITS).
     * @param {string} label - Raw label (e.g. "Herb", "Essence", "Component")
     * @param {string[]} allFamilies - Valid family names
     * @returns {{ type: string, family: string }}
     */
    static _labelToTypeAndFamily(label, allFamilies) {
        const lower = label.toLowerCase();
        const normalizedType = LEGACY_TYPE_TO_ARTIFICER_TYPE[lower] || (Object.values(ARTIFICER_TYPES).includes(label) ? label : null);
        const type = normalizedType || ARTIFICER_TYPES.COMPONENT;
        const family = allFamilies.find((f) => f.toLowerCase() === lower) ?? '';
        return { type, family };
    }
}
