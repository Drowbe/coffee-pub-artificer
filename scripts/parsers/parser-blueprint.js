// ================================================================== 
// ===== BLUEPRINT PARSER ===========================================
// ================================================================== 

import { MODULE } from '../const.js';
import { ArtificerBlueprint } from '../data/models/model-blueprint.js';
import { BLUEPRINT_STAGE_STATES } from '../schema-blueprints.js';

/**
 * Parser for Blueprint journal entries
 * Parses HTML journal content into ArtificerBlueprint objects with stage parsing
 */
export class BlueprintParser {
    /**
     * Parse a single journal page into an ArtificerBlueprint
     * @param {JournalEntryPage} page - Journal page
     * @param {string} enrichedHtml - Enriched HTML content
     * @returns {Promise<ArtificerBlueprint|null>} Parsed blueprint or null if invalid
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
                journalPageId: page.id,
                stages: []
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
                
                if (labelLower === 'narrative') {
                    data.narrative = value;
                } else if (labelLower === 'skill') {
                    data.skill = value;
                } else if (labelLower === 'skill level') {
                    data.skillLevel = parseInt(value) || 0;
                } else if (labelLower === 'result') {
                    // Extract UUID from @UUID format
                    const uuidMatch = value.match(/@UUID\[(.*?)\]{(.*?)}/);
                    if (uuidMatch) {
                        data.resultItemUuid = uuidMatch[1].trim();
                    } else {
                        BlacksmithUtils.postConsoleAndNotification(MODULE.NAME, `Blueprint "${data.name}" result does not use @UUID format`, value, true, false);
                    }
                } else if (labelLower === 'tags') {
                    // Parse comma-separated tags
                    data.tags = value.split(',').map(t => t.trim()).filter(t => t);
                } else if (labelLower === 'description') {
                    data.description = value;
                } else if (labelLower === 'stages') {
                    // Stages are in a following <ul> element
                    const ul = p.nextElementSibling;
                    if (ul && ul.tagName === 'UL') {
                        data.stages = this._parseStages(ul);
                    }
                }
            }
            
            // Validate required fields
            if (!data.resultItemUuid) {
                BlacksmithUtils.postConsoleAndNotification(MODULE.NAME, `Blueprint "${data.name}" is missing resultItemUuid`, null, true, false);
                return null;
            }
            
            if (data.stages.length === 0) {
                BlacksmithUtils.postConsoleAndNotification(MODULE.NAME, `Blueprint "${data.name}" has no stages`, null, true, false);
                return null;
            }
            
            // Create blueprint object
            const blueprint = new ArtificerBlueprint(data);
            if (!blueprint.validate()) {
                BlacksmithUtils.postConsoleAndNotification(MODULE.NAME, `Blueprint "${data.name}" failed validation`, null, true, false);
                return null;
            }
            
            return blueprint;
            
        } catch (error) {
            BlacksmithUtils.postConsoleAndNotification(MODULE.NAME, `Error parsing blueprint from page "${page.name}"`, error?.message ?? String(error), true, false);
            return null;
        }
    }
    
    /**
     * Parse stages from a <ul> element
     * Handles state markup: <s> (completed), <code> (failed), <em> (hidden)
     * @param {HTMLUListElement} ul - Unordered list element
     * @returns {Array<BlueprintStage>} Parsed stages
     */
    static _parseStages(ul) {
        const stages = [];
        const items = ul.querySelectorAll('li');
        
        let stageNumber = 1;
        for (const item of items) {
            // Determine stage state from HTML markup
            let state = BLUEPRINT_STAGE_STATES.ACTIVE;
            let content = item.innerHTML;
            
            // Check for completed stage (<s>, <del>, <strike>)
            if (item.querySelector('s, del, strike')) {
                state = BLUEPRINT_STAGE_STATES.COMPLETED;
                // Extract text content, removing strike tags
                content = item.textContent;
            }
            // Check for failed stage (<code>)
            else if (item.querySelector('code')) {
                state = BLUEPRINT_STAGE_STATES.FAILED;
                content = item.textContent;
            }
            // Check for hidden stage (<em>, <i>)
            else if (item.querySelector('em, i')) {
                state = BLUEPRINT_STAGE_STATES.HIDDEN;
                content = item.textContent;
            }
            
            // Parse stage content
            // Format: "Stage Name" followed by requirements
            // Requirements can be in nested <ul> or in paragraph format
            const stageData = this._parseStageContent(item, stageNumber, state);
            
            if (stageData) {
                stages.push(stageData);
                stageNumber++;
            }
        }
        
        return stages;
    }
    
    /**
     * Parse individual stage content
     * @param {HTMLLIElement} item - List item element
     * @param {number} stageNumber - Stage number
     * @param {string} state - Stage state
     * @returns {Object|null} Stage data
     */
    static _parseStageContent(item, stageNumber, state) {
        // Look for paragraph with stage name
        const p = item.querySelector('p');
        if (!p) {
            // No paragraph, try to parse from direct text content
            const text = item.textContent.trim();
            const parts = text.split(':');
            const name = parts[0].trim();
            const description = parts.slice(1).join(':').trim();
            
            return {
                stageNumber,
                name,
                state,
                requirements: [],
                workstation: null,
                description
            };
        }
        
        // Parse stage name from paragraph
        const strong = p.querySelector('strong');
        const stageName = strong ? strong.textContent.trim().replace(':', '') : `Stage ${stageNumber}`;
        
        // Get description (text after strong tag)
        const description = p.textContent.replace(strong?.textContent || '', '').trim();
        
        // Look for nested <ul> with requirements
        const nestedUl = item.querySelector('ul');
        const requirements = nestedUl ? this._parseRequirements(nestedUl) : [];
        
        // Look for workstation requirement in paragraph or nested content
        let workstation = null;
        const workstationMatch = description.match(/workstation[:\s]+([^,.\n]+)/i);
        if (workstationMatch) {
            workstation = workstationMatch[1].trim();
        }
        
        return {
            stageNumber,
            name: stageName,
            state,
            requirements,
            workstation,
            description
        };
    }
    
    /**
     * Parse requirements from a <ul> element
     * @param {HTMLUListElement} ul - Unordered list element
     * @returns {Array<{type: string, name: string, quantity: number}>} Parsed requirements
     */
    static _parseRequirements(ul) {
        const requirements = [];
        const items = ul.querySelectorAll('li');
        
        for (const item of items) {
            const text = item.textContent.trim();
            
            // Parse format: "Type: Name (quantity)"
            // Example: "Component: Iron Ingot (3)" or "Essence: Arcane (1)"
            const match = text.match(/^([^:]+):\s*([^(]+)\s*\((\d+)\)/);
            if (match) {
                const [, type, name, quantity] = match;
                requirements.push({
                    type: type.trim().toLowerCase(),
                    name: name.trim(),
                    quantity: parseInt(quantity) || 1
                });
            } else {
                // Fallback: try to parse without parentheses
                const simpleMatch = text.match(/^([^:]+):\s*(.+)$/);
                if (simpleMatch) {
                    const [, type, name] = simpleMatch;
                    requirements.push({
                        type: type.trim().toLowerCase(),
                        name: name.trim(),
                        quantity: 1
                    });
                }
            }
        }
        
        return requirements;
    }
}
