// ==================================================================
// ===== CHAT CARDS (Blacksmith Chat Cards API) =====================
// ==================================================================
// Every Artificer chat card is posted through Blacksmith's parts
// system: we describe the card as data and Blacksmith owns the
// wrapper, the theme, escaping, enrichment and per-client re-render.
// No card HTML is built in this module.
// Docs: coffee-pub-blacksmith/documentation/api/api-chatcards.md
// ==================================================================

import { MODULE } from '../const.js';
import { getBlacksmithApi, postBlacksmithConsole } from './blacksmith-console.js';

/**
 * @returns {object|null} The Blacksmith chat cards API, or null when unavailable.
 */
export function getChatCardsApi() {
    return getBlacksmithApi()?.chatCards ?? null;
}

/**
 * Neutralise inline-mark characters in consumer text (item, actor and perk names).
 * Card text fields read `**bold**` and `*italic*`, so a stray asterisk in a name
 * would otherwise swallow the rest of the sentence.
 * @param {unknown} value
 * @returns {string}
 */
export function plainText(value) {
    return String(value ?? '').replace(/\*/g, '');
}

/**
 * Post an Artificer chat card.
 * @param {object} options
 * @param {string} options.type - Artificer card type id, stored on the message.
 * @param {Array<object>} options.parts - Blacksmith card composition, in render order.
 * @param {Actor|null} [options.actor] - Speaker actor; omit for the current user.
 * @param {string[]|null} [options.whisper] - User ids; omit for a public card.
 * @returns {Promise<ChatMessage|null>}
 */
export async function postArtificerCard({ type, parts, actor = null, whisper = null } = {}) {
    const chatCards = getChatCardsApi();
    if (!chatCards?.post) {
        postBlacksmithConsole(MODULE.NAME, 'Chat card not posted: Blacksmith chat cards API unavailable', type, false, false);
        return null;
    }
    const options = {
        moduleId: MODULE.ID,
        type,
        parts,
        speaker: actor ? ChatMessage.getSpeaker({ actor }) : ChatMessage.getSpeaker()
    };
    if (whisper?.length) options.whisper = whisper;
    return chatCards.post(options);
}

/**
 * `rows` items for a list of items granted to an actor. Supplying `uuid` makes
 * Blacksmith render a real document link, so nothing is escaped or linked here.
 * @param {Array<{ name?: string, uuid?: string, img?: string }>} items
 * @returns {Array<object>}
 */
export function buildItemRows(items = []) {
    return (items ?? []).map((item) => ({
        label: item?.name ?? '',
        ...(item?.img ? { img: item.img } : {}),
        ...(item?.uuid ? { uuid: item.uuid } : {})
    }));
}

/**
 * The "Perks applied" tail shared by the gather and craft cards: a section
 * divider plus one row per perk, or a prose line when none applied.
 * @param {object} options
 * @param {string} options.icon - Font Awesome class for the divider and rows.
 * @param {Array<{ label: string, sublabel?: string }>} [options.perks]
 * @param {string} options.emptyText - Prose shown when no perks applied.
 * @param {string} [options.label] - Section label.
 * @returns {Array<object>}
 */
export function buildPerkParts({ icon, perks = [], emptyText, label = 'Perks Applied' }) {
    const parts = [{ part: 'section', icon, label }];
    if (perks?.length) {
        parts.push({
            part: 'rows',
            plain: true,
            items: perks.map((perk) => ({
                icon,
                label: plainText(perk?.label),
                ...(perk?.sublabel ? { sublabel: plainText(perk.sublabel) } : {})
            }))
        });
    } else {
        parts.push({ part: 'prose', blocks: [{ type: 'paragraph', text: emptyText }] });
    }
    return parts;
}
