// ================================================================== 
// ===== GENERAL UTILITIES ==========================================
// ================================================================== 

/**
 * Get or create a journal entry
 * @param {string} name - Journal name
 * @param {Object} options - Options
 * @returns {Promise<JournalEntry>} Journal entry
 */
export async function getOrCreateJournal(name, options = {}) {
    // Check if journal exists
    let journal = game.journal?.find(j => j.name === name);
    
    if (!journal) {
        // Create new journal
        journal = await JournalEntry.create({
            name: name,
            ...options
        });
    }
    
    return journal;
}

/**
 * Generate hash-based number from UUID (for recipe/blueprint numbering)
 * @param {string} uuid - UUID string
 * @param {string} prefix - Prefix (e.g., "R" for recipes, "B" for blueprints)
 * @returns {string} Numbered reference (e.g., "R1", "R2", "B1")
 */
export function hashString(uuid, prefix = '') {
    if (!uuid) return '';
    
    let hash = 0;
    for (let i = 0; i < uuid.length; i++) {
        hash = ((hash << 5) - hash) + uuid.charCodeAt(i);
        hash = hash & hash; // Convert to 32-bit integer
    }
    const number = Math.abs(hash) % 1000 + 1; // Numbers 1-1000
    return prefix ? `${prefix}${number}` : number.toString();
}
