// ==================================================================
// ===== JOURNAL COVER PAGE PARSER ==================================
// ==================================================================
// Recipe journals can have a page named "Cover Page" with metadata.
// Same format as recipes: <p><strong>Label:</strong> value</p>.
// Used for filtering (Skill) and for display (Author, Description, image as book cover).

import { normalizePunctuationForStorage } from '../utils/helpers.js';

function getPageTitle(page) {
    // Different Foundry versions/sources may populate different title fields.
    return String(
        page?.name ??
        page?.title ??
        page?.text?.title ??
        ''
    ).replace(/\s+/g, ' ').trim();
}

/** Page name that identifies the cover page (case-insensitive). */
function isCoverPage(page) {
    const name = getPageTitle(page).toLowerCase();
    // Strict naming with optional numeric prefix (e.g. "0 Cover Page").
    return /^\d*\s*cover page$/.test(name);
}

/**
 * Parse HTML content of a Cover page.
 * - Skills: one label, value can be comma-separated (e.g. "Herbalism, Alchemy")
 * - Author, Description: single value each
 * - First <img> in the page is used as the book cover image
 * @param {string} htmlContent - Raw or enriched HTML from JournalEntryPage.text.content
 * @returns {{ skillIds: string[], author: string, description: string, coverImage: string, hasCoverPage: boolean }}
 */
export function parseJournalCover(htmlContent) {
    const skillIds = [];
    let author = '';
    let description = '';
    let coverImage = '';
    if (!htmlContent || typeof htmlContent !== 'string') {
        return { skillIds, author, description, coverImage, hasCoverPage: true };
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

        // Fallback: support plain-text labels (no <strong>) like "Skills: Herbalism, Alchemy".
        if (!skillIds.length || !author || !description) {
            const text = (doc.body?.textContent ?? '').replace(/\s+/g, ' ').trim();
            const lines = text
                .split(/\r?\n/)
                .map((s) => s.trim())
                .filter(Boolean);
            for (const line of lines) {
                const m = /^([A-Za-z ]+)\s*:\s*(.+)$/.exec(line);
                if (!m) continue;
                const labelLower = m[1].trim().toLowerCase();
                const value = normalizePunctuationForStorage(m[2].trim());
                if (!value) continue;
                if (labelLower === 'skills' && !skillIds.length) {
                    const parts = value.split(',').map((s) => normalizePunctuationForStorage(s.trim())).filter(Boolean);
                    for (const part of parts) {
                        if (part) skillIds.push(part.toLowerCase());
                    }
                } else if (labelLower === 'author' && !author) {
                    author = value;
                } else if (labelLower === 'description' && !description) {
                    description = value;
                }
            }

            // Inline-label fallback for dense text where labels are on one line/block.
            if (!skillIds.length) {
                const mSkills = /skills\s*:\s*([\s\S]*?)(?=\bauthor\s*:|\bdescription\s*:|$)/i.exec(text);
                const skillsRaw = mSkills?.[1]?.trim() ?? '';
                if (skillsRaw) {
                    const parts = skillsRaw.split(',').map((s) => normalizePunctuationForStorage(s.trim())).filter(Boolean);
                    for (const part of parts) {
                        if (part) skillIds.push(part.toLowerCase());
                    }
                }
            }
            if (!author) {
                const mAuthor = /author\s*:\s*([\s\S]*?)(?=\bskills\s*:|\bdescription\s*:|$)/i.exec(text);
                const authorRaw = mAuthor?.[1]?.trim() ?? '';
                if (authorRaw) author = normalizePunctuationForStorage(authorRaw);
            }
            if (!description) {
                const mDesc = /description\s*:\s*([\s\S]*?)(?=\bskills\s*:|\bauthor\s*:|$)/i.exec(text);
                const descRaw = mDesc?.[1]?.trim() ?? '';
                if (descRaw) description = normalizePunctuationForStorage(descRaw);
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
        return { skillIds: out, author, description, coverImage, hasCoverPage: true };
    } catch (_e) {
        return { skillIds: [], author: '', description: '', coverImage: '', hasCoverPage: true };
    }
}

/**
 * Get full cover data from a journal's Cover page.
 * Uses the same journal/pages/content access as recipe storage (storage-recipes.js):
 * journal.pages?.contents ?? [] and page.text?.content ?? page.text?.markdown ?? ''.
 * @param {JournalEntry} journal - Loaded journal (same doc we use for recipes)
 * @returns {Promise<{ skillIds: string[], author: string, description: string, coverImage: string, hasCoverPage: boolean }>}
 */
export async function getJournalCoverData(journal) {
    if (!journal?.pages) return { skillIds: [], author: '', description: '', coverImage: '', hasCoverPage: false };
    // Same as RecipeStorage._loadFromJournals: journal.pages?.contents ?? []
    const pages = journal.pages?.contents ?? [];
    // A valid Cover Page requires Skills. We first match by page title, then (if needed)
    // by explicit "Cover Page" heading in text content.
    const bySort = [...pages].slice().sort((a, b) => (a?.sort ?? 0) - (b?.sort ?? 0));
    const isCoverPageTextByContent = (raw) => {
        if (!raw || typeof raw !== 'string') return false;
        try {
            const parser = new DOMParser();
            const html = parser.parseFromString(raw, 'text/html');
            const txt = (html.body?.textContent ?? '').replace(/\s+/g, ' ').trim().toLowerCase();
            return /\bcover\s*page\b/i.test(txt);
        } catch (_e) {
            const txt = String(raw ?? '').replace(/\s+/g, ' ').trim().toLowerCase();
            return /\bcover\s*page\b/i.test(txt);
        }
    };
    for (const page of bySort) {
        if (page?.type !== 'text') continue;
        const rawContent = page?.text?.content ?? page?.text?.markdown ?? '';
        if (!rawContent || typeof rawContent !== 'string') continue;
        const titleMatch = isCoverPage(page);
        const contentMatch = isCoverPageTextByContent(rawContent);
        if (!titleMatch && !contentMatch) continue;
        const parsed = parseJournalCover(rawContent);
        const hasRequiredSkills = (parsed.skillIds?.length ?? 0) > 0;
        if (!hasRequiredSkills) continue;
        return {
            skillIds: parsed.skillIds ?? [],
            author: parsed.author ?? '',
            description: parsed.description ?? '',
            coverImage: parsed.coverImage ?? '',
            hasCoverPage: true
        };
    }
    return { skillIds: [], author: '', description: '', coverImage: '', hasCoverPage: false };
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
