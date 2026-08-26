/**
 * Artificer: Create Heat and Grind as Process items.
 *
 * A Process is a Tool whose family is "Process". It carries four intensity
 * positions (label + colour), the named animation the crafting bench plays, a
 * sound, and whether full intensity destabilises.
 *
 * Heat and Grind are hardcoded fallbacks in scripts/systems/process-definitions.js.
 * This macro creates them as real, editable items so a GM can change their level
 * names and colours, and so the recipe sheet's Process slot has something to drop.
 * Drag the results into the Tools compendium under Processes when you are happy.
 *
 * SAFE TO RE-RUN: an existing world item with the same name is skipped, never
 * overwritten -- re-running must not discard a GM's edits.
 *
 * Run as GM.
 */

const MODULE_ID = 'coffee-pub-artificer';

/**
 * Colours are the values the crafting bench CSS used to hardcode, lifted out
 * verbatim so a seeded process looks exactly like the built-in it replaces.
 * Level 0 is always "off" and is fully transparent.
 */
const PROCESSES = [
    {
        name: 'Heat',
        img: 'icons/magic/fire/flame-burning-campfire-yellow.webp',
        animation: 'pulse',
        sound: `modules/${MODULE_ID}/sounds/fire-boil-01.mp3`,
        // Heat is the one that runs away; a ferment held at maximum is not unstable.
        unstableAtMax: true,
        levels: [
            { label: 'Off', color: '#ffb45a' },
            { label: 'Low', color: '#ffb45a' },
            { label: 'Medium', color: '#ffb45a' },
            { label: 'High', color: '#ffb45a' }
        ]
    },
    {
        name: 'Grind',
        img: 'icons/tools/smithing/mortar-and-pestle-brown.webp',
        animation: 'shake',
        sound: `modules/${MODULE_ID}/sounds/grind-stone-01.mp3`,
        unstableAtMax: false,
        levels: [
            { label: 'Off', color: '#ebe1cd' },
            { label: 'Coarse', color: '#ebe1cd' },
            { label: 'Medium', color: '#ebe1cd' },
            { label: 'Fine', color: '#ebe1cd' }
        ]
    }
];

if (!game.user.isGM) {
    ui.notifications.warn('Only a GM can create Process items.');
} else {
    const created = [];
    const skipped = [];

    for (const process of PROCESSES) {
        const existing = game.items.find(i => (i.name || '').trim() === process.name);
        if (existing) {
            skipped.push(process.name);
            continue;
        }

        created.push({
            name: process.name,
            // `tool` because a Process lives in the Tools bucket. The Artificer
            // family is what actually identifies it.
            type: 'tool',
            img: process.img,
            system: {
                description: {
                    value: `<p>A crafting process. Its intensity positions are `
                        + `${process.levels.map(l => l.label).join(', ')}.</p>`
                },
                source: { value: 'Artificer', custom: 'Artificer', license: '' }
            },
            flags: {
                [MODULE_ID]: {
                    artificerType: 'Tool',
                    artificerFamily: 'Process',
                    // A process is never an ingredient and is never crafted, so it
                    // carries no traits. Skill level is written because the schema
                    // requires a minimum of 1, not because anything reads it.
                    artificerTraits: [],
                    artificerSkillLevel: 1,
                    artificerProcessLevels: process.levels,
                    artificerProcessAnimation: process.animation,
                    artificerProcessSound: process.sound,
                    artificerProcessUnstableAtMax: process.unstableAtMax
                }
            }
        });
    }

    if (created.length) await Item.createDocuments(created);

    const madeMsg = created.length ? `Created: ${created.map(i => i.name).join(', ')}.` : 'Created nothing.';
    const skipMsg = skipped.length ? ` Already present, left untouched: ${skipped.join(', ')}.` : '';
    ui.notifications.info(`Artificer processes. ${madeMsg}${skipMsg}`);
    console.log(`${MODULE_ID} | Seed processes:`, { created: created.map(i => i.name), skipped });
}
