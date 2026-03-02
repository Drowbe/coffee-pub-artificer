// ==================================================================
// ===== JOURNAL COVER PAGE PARSER ==================================
// ==================================================================
// Recipe journals can have a page named "Cover" with metadata.
// Same format as recipes: <p><strong>Label:</strong> value</p>.
// Used for filtering (Skill) and for display (Author, Description, image as book cover).

import { normalizePunctuationForStorage } from '../utils/helpers.js';

/** Page name that identifies the cover page (case-insensitive). */
export const COVER_PAGE_NAME = 'Cover';

/**
 * Parse HTML content of a Cover page.
 * - Skills: one label, value can be comma-separated (e.g. "Herbalism, Alchemy")
 * - Author, Description: single value each
 * - First <img> in the page is used as the book cover image
 * @param {string} htmlContent - Raw or enriched HTML from JournalEntryPage.text.content
 * @returns {{ skillIds: string[], author: string, description: string, coverImage: string }}
 */
export function parseJournalCover(htmlContent) {
    const skillIds = [];
    let author = '';
    let description = '';
    let coverImage = '';
    if (!htmlContent || typeof htmlContent !== 'string') {
        return { skillIds, author, description, coverImage };
    }

    try {
        const parser = new DOMParser();
        const doc = parser.parseFromString(htmlContent, 'text/html');
        const paragraphs = doc.querySelectorAll('p');

        for (const p of paragraphs) {
            const strong = p.querySelector('strong');
            if (!strong) continue;

            let label = (strong.textContent ?? '').trim();
            if (label.endsWith(':')) label = label.slice(0, -1);
            const labelLower = label.toLowerCase();
            const value = (p.textContent ?? '').replace(strong.textContent ?? '', '').trim();

            if (labelLower === 'skills') {
                const parts = value.split(',').map((s) => normalizePunctuationForStorage(s.trim())).filter(Boolean);
                for (const part of parts) {
                    if (part) skillIds.push(part.toLowerCase());
                }
            } else if (labelLower === 'author') {
                if (value) author = normalizePunctuationForStorage(value).trim();
            } else if (labelLower === 'description') {
                if (value) description = normalizePunctuationForStorage(value).trim();
            }
        }

        const firstImg = doc.querySelector('img[src]');
        if (firstImg?.getAttribute('src')) {
            coverImage = firstImg.getAttribute('src').trim();
        }

        const seen = new Set();
        const out = [];
        for (const id of skillIds) {
            if (seen.has(id)) continue;
            seen.add(id);
            out.push(id);
        }
        return { skillIds: out, author, description, coverImage };
    } catch (_e) {
        return { skillIds: [], author: '', description: '', coverImage: '' };
    }
}

/**
 * Get full cover data from a journal's Cover page (page named "Cover").
 * @param {JournalEntry} journal - Loaded journal
 * @returns {Promise<{ skillIds: string[], author: string, description: string, coverImage: string }>}
 */
export async function getJournalCoverData(journal) {
    if (!journal?.pages) return { skillIds: [], author: '', description: '', coverImage: '' };
    const pages = journal.pages.contents ?? [];
    const coverPage = pages.find((p) => (p.name ?? '').trim().toLowerCase() === COVER_PAGE_NAME.toLowerCase());
    if (!coverPage?.text?.content) return { skillIds: [], author: '', description: '', coverImage: '' };
    return parseJournalCover(coverPage.text.content);
}

/**
 * Get skill ids from a journal's Cover page (convenience).
 * @param {JournalEntry} journal - Loaded journal
 * @returns {Promise<string[]>} Skill ids (lowercased), or [] if no Cover page / no Skills
 */
export async function getJournalCoverSkills(journal) {
    const data = await getJournalCoverData(journal);
    return data.skillIds;
}
