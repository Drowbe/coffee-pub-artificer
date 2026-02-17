// ==================================================================
// ===== ITEM SHEET ARTIFICER INTEGRATION ===========================
// ==================================================================

import { MODULE } from './const.js';
import { ArtificerItemForm } from './window-artificer-item.js';

/**
 * Inject Artificer tags section into item sheets when the item has artificer flags.
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
    const target = event.target.closest('[data-action="edit-artificer"]');
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

    const flags = item.flags?.[MODULE.ID] ?? item.flags?.artificer ?? {};
    const type = flags.type;
    if (!type || !['ingredient', 'component', 'essence', 'container'].includes(type)) return;

    // Avoid double-injection
    if (element.querySelector('.artificer-item-sheet-section')) return;

    const canEdit = item.canUserModify?.(game.user, 'update') ?? app.options?.editable ?? game.user.isGM;
    const section = buildArtificerSection(item, flags, type, !!canEdit);
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
 * Build the Artificer section DOM
 * @param {Item} item
 * @param {Object} flags
 * @param {string} type
 * @param {boolean} editable
 * @returns {HTMLElement}
 */
function buildArtificerSection(item, flags, type, editable) {
    const section = document.createElement('div');
    section.className = 'artificer-item-sheet-section';

    const primaryTag = flags.primaryTag ?? '';
    const secondaryTags = Array.isArray(flags.secondaryTags) ? flags.secondaryTags : [];
    const secondaryStr = secondaryTags.join(', ');
    const family = flags.family ?? '';
    const tier = flags.tier ?? 1;
    const rarity = flags.rarity ?? 'Common';
    const quirk = flags.quirk ?? '';
    const biomes = Array.isArray(flags.biomes) ? flags.biomes : [];
    const biomesStr = biomes.join(', ');
    const componentType = flags.componentType ?? '';
    const affinity = flags.affinity ?? '';

    const rows = [];
    if (primaryTag) rows.push({ label: 'Primary Tag', value: primaryTag });
    if (secondaryStr) rows.push({ label: 'Secondary Tags', value: secondaryStr });
    if ((type === 'ingredient' || type === 'container') && family) rows.push({ label: 'Family', value: family });
    if (type === 'component' && componentType) rows.push({ label: 'Component Type', value: componentType });
    if (type === 'essence' && affinity) rows.push({ label: 'Affinity', value: affinity });
    rows.push({ label: 'Tier', value: String(tier) });
    rows.push({ label: 'Rarity', value: rarity });
    if ((type === 'ingredient' || type === 'container') && quirk) rows.push({ label: 'Quirk', value: quirk });
    if ((type === 'ingredient' || type === 'container') && biomesStr) rows.push({ label: 'Biomes', value: biomesStr });

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
    const form = new ArtificerItemForm({
        itemData,
        item,
        mode: 'edit',
        itemType: flags.type || 'ingredient'
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
        flags: {
            [MODULE.ID]: { ...flags }
        }
    };
}

export { registerItemSheetIntegration };
