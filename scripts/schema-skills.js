// ================================================================== 
// ===== SKILL SCHEMA DEFINITIONS ===================================
// ================================================================== 

/**
 * @typedef {Object} ArtificerSkill
 * @property {string} skill - Skill name (Herbalism, Metallurgy, Artifice, Alchemy, MonsterHandling)
 * @property {number} level - Current skill level (0-100)
 * @property {number} xp - Current XP in this level
 * @property {number} xpToNextLevel - XP required for next level
 */

/**
 * Skill data stored per actor in flags
 * @typedef {Object} ActorSkillData
 * @property {Object<string, ArtificerSkill>} skills - Map of skill names to skill data
 * @property {Object<string, Object<string, string[]>>} tagDiscoveries - Map of ingredient IDs to discovered tags per actor
 * @property {string[]} unlockedRecipes - Array of recipe UUIDs unlocked by this actor
 * @property {Object<string, Object>} blueprintProgress - Map of blueprint UUIDs to progress data
 */

