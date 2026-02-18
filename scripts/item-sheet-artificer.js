// ==================================================================
// ===== ITEM SHEET ARTIFICER INTEGRATION ===========================
// ==================================================================

import { MODULE } from './const.js';
import { ArtificerItemForm } from './window-artificer-item.js';
import {
    isArtificerItem,
    getArtificerTypeFromFlags,
    getFamilyFromFlags,
    getTraitsFromFlags
} from './utility-artificer-item.js';
import { ARTIFICER_TYPES } from './schema-artificer-item.js';
import { FAMILY_LABELS } from './schema-artificer-item.js';

/**
 * Inject Artificer section into all item sheets. If the item has artificer flags, show properties + Edit.
 * If not, show "Convert to Artificer item" so users can add Artificer data without duplicating the item editor.
 * - renderItemSheet: legacy AppV1 Item sheets
 * - renderDocumentSheetV2: v13 DocumentSheetV2 (Item, Actor, Image, Journal, etc.) - we must guard for Item only
 */
function registerItemSheetIntegration() {
    Hooks.on('renderItemSheet', onRenderItemSheet);
    Hooks.on('renderDocumentSheetV2', onRenderDocumentSheetV2);
    document.body.addEventListener('click', onDocumentClick, true);
}

/** Strict guard: only run for Item documents. Prevents affecting Actor, Image, Journal, Tile, etc. */
function onRenderDocumentSheetV2(app, html) {
    if (app.document?.documentName !== 'Item') return;
    onRenderItemSheet(app, html);
}

function onDocumentClick(event) {
    const target = event.target.closest('[data-action="edit-artificer"], [data-action="convert-artificer"]');
    if (!target) return;
    const uuid = target.getAttribute('data-item-uuid');
    if (!uuid) return;
    event.preventDefault();
    event.stopPropagation();
    const item = foundry.utils.fromUuidSync(uuid);
    if (item) openEditForm(item);
}

/**
 * Detect config/sub-sheets (Configure Source, Sheet Configuration, On-Use Macros, etc.) — skip injection.
 * Only inject into the main item sheet's Description tab.
 * @param {Application} app
 * @returns {boolean}
 */
function isConfigOrSubSheet(app) {
    const title = (app.options?.window?.title ?? app.title ?? '').toLowerCase();
    const id = (app.id ?? app.options?.id ?? '').toLowerCase();
    const className = (app.constructor?.name ?? '').toLowerCase();
    return (
        title.includes('configure source') ||
        title.includes('sheet configuration') ||
        id.includes('source-config') ||
        id.includes('sourceconfig') ||
        id.includes('sheet-config') ||
        className.includes('sourceconfig') ||
        className.includes('sheetconfig')
    );
}

/**
 * @param {DocumentSheetV2} app - The sheet application
 * @param {HTMLElement} html - The rendered HTML element
 */
function onRenderItemSheet(app, html) {
    const item = app.object ?? app.document ?? app.item;
    if (!item) return;
    if (app.document?.documentName && app.document.documentName !== 'Item') return;
    if (isConfigOrSubSheet(app)) return;

    const element = html instanceof HTMLElement ? html : html[0];
    if (!element) return;

    // Avoid double-injection
    if (element.querySelector('.artificer-item-sheet-section')) return;

    const flags = item.flags?.[MODULE.ID] ?? item.flags?.artificer ?? {};
    const artificerType = getArtificerTypeFromFlags(flags);
    const hasArtificerData = !!artificerType;
    const canEdit = item.canUserModify?.(game.user, 'update') ?? app.options?.editable ?? game.user.isGM;
    const section = hasArtificerData
        ? buildArtificerSection(item, flags, !!canEdit)
        : buildConvertSection(item, !!canEdit);
    const descriptionTab = findDescriptionTab(element);
    if (descriptionTab) {
        descriptionTab.appendChild(section);
    }
}

/**
 * Find the Description tab content container. Only inject here so Artificer Properties
 * appears solely on the Description tab of the main item sheet.
 * @param {HTMLElement} root
 * @returns {HTMLElement|null}
 */
function findDescriptionTab(root) {
    // Tidy5e: data-tidy-sheet-part="description"
    const tidyDesc = root.querySelector('[data-tidy-sheet-part="description"]');
    if (tidyDesc) return tidyDesc;

    // Default dnd5e: .tab[data-tab="description"] (the Description tab panel)
    const descTab = root.querySelector('.tab[data-tab="description"]');
    if (descTab) return descTab;

    return null;
}

/**
 * Build the "Convert to Artificer item" section for items without Artificer flags
 * @param {Item} item
 * @param {boolean} editable
 * @returns {HTMLElement}
 */
function buildConvertSection(item, editable) {
    const section = document.createElement('div');
    section.className = 'artificer-item-sheet-section';
    section.innerHTML = `
        <div class="artificer-sheet-header">
            <h4 class="artificer-sheet-title"><i class="fa-solid fa-hammer"></i> Artificer</h4>
        </div>
        <div class="artificer-sheet-body">
            <p class="artificer-sheet-empty">This item is not an Artificer item. Add tags, family, and crafting data.</p>
            ${editable ? `<a class="artificer-sheet-convert-btn" data-action="convert-artificer" data-item-uuid="${escapeHtml(item.uuid)}" href="#"><i class="fa-solid fa-wand-magic-sparkles"></i> Convert to Artificer item</a>` : ''}
        </div>
    `;
    return section;
}

/**
 * Build the Artificer section DOM (TYPE > FAMILY > TRAITS; supports legacy flags).
 * @param {Item} item
 * @param {Object} flags
 * @param {boolean} editable
 * @returns {HTMLElement}
 */
function buildArtificerSection(item, flags, editable) {
    const section = document.createElement('div');
    section.className = 'artificer-item-sheet-section';

    const artificerType = getArtificerTypeFromFlags(flags);
    const family = getFamilyFromFlags(flags);
    const traits = getTraitsFromFlags(flags);
    const familyLabel = family ? (FAMILY_LABELS[family] ?? family) : '';
    const traitsStr = traits.length ? traits.join(', ') : '';
    const rarity = flags.rarity ?? 'Common';
    const biomes = Array.isArray(flags.biomes) ? flags.biomes : [];
    const biomesStr = biomes.join(', ');
    const componentType = flags.componentType ?? '';
    const affinity = flags.affinity ?? '';
    const skillLevel = flags.skillLevel ?? 1;

    const rows = [];
    if (artificerType) rows.push({ label: 'Type', value: artificerType });
    if (familyLabel) rows.push({ label: 'Family', value: familyLabel });
    if (traitsStr) rows.push({ label: 'Traits', value: traitsStr });
    rows.push({ label: 'Skill Level', value: String(skillLevel) });
    rows.push({ label: 'Rarity', value: rarity });
    if (componentType) rows.push({ label: 'Component Type', value: componentType });
    if (affinity) rows.push({ label: 'Affinity', value: affinity });
    if (artificerType === ARTIFICER_TYPES.COMPONENT && biomesStr) rows.push({ label: 'Biomes', value: biomesStr });

    const rowsHtml = rows
        .map((r) => `<div class="artificer-sheet-row"><span class="artificer-sheet-label">${escapeHtml(r.label)}:</span><span class="artificer-sheet-value">${escapeHtml(r.value)}</span></div>`)
        .join('');

    section.innerHTML = `
        <div class="artificer-sheet-header">
            <h4 class="artificer-sheet-title"><i class="fa-solid fa-hammer"></i> Artificer Properties</h4>
            ${editable ? `<a class="artificer-sheet-edit-btn" data-action="edit-artificer" data-item-uuid="${escapeHtml(item.uuid)}" title="Edit" href="#"><i class="fa-solid fa-feather"></i></a>` : ''}
        </div>
        <div class="artificer-sheet-body">
            ${rowsHtml || '<p class="artificer-sheet-empty">No Artificer data.</p>'}
        </div>
    `;

    return section;
}

function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}

/**
 * Open the Artificer form in edit mode for the given item
 * @param {Item} item
 */
function openEditForm(item) {
    const itemData = itemToFormData(item);
    const flags = item.flags?.[MODULE.ID] ?? item.flags?.artificer ?? {};
    const artificerType = getArtificerTypeFromFlags(flags) || ARTIFICER_TYPES.COMPONENT;
    const form = new ArtificerItemForm({
        itemData,
        item,
        mode: 'edit',
        itemType: artificerType
    });
    form.render(true);
}

/**
 * Convert a Foundry Item to the shape expected by ArtificerItemForm
 * @param {Item} item
 * @returns {Object}
 */
export function itemToFormData(item) {
    const flags = item.flags?.[MODULE.ID] ?? item.flags?.artificer ?? {};
    return {
        name: item.name,
        type: item.type,
        weight: item.system?.weight ?? 0,
        price: typeof item.system?.price === 'object' ? item.system.price?.value : item.system?.price ?? 0,
        rarity: item.system?.rarity ?? 'Common',
        description: item.system?.description?.value ?? item.description ?? '',
        img: item.img ?? '',
        system: item.system ?? {},
        flags: {
            [MODULE.ID]: { ...flags }
        }
    };
}

export { registerItemSheetIntegration };
