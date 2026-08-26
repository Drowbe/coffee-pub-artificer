/**
 * Artificer: Create the shipped Process items.
 *
 * A Process is a Tool whose family is "Process". It carries four level positions
 * (name + colour), the named animation the crafting bench plays, a sound, and
 * whether full intensity destabilises.
 *
 * TWO PROCESSES SHOULD DIFFER IN LEVEL NAMES OR IN MOTION. Otherwise they are one
 * process wearing two names, and a recipe author has to guess which a recipe wants
 * -- process must match EXACTLY at the bench, so every near-duplicate is another
 * way for a craft to fail. That test is why write and draw are one Scribe, and why
 * mix, stir and blend are one Stir.
 *
 * SAFE TO RE-RUN: an existing world item with the same name is skipped, never
 * overwritten -- re-running must not discard a GM's edits. Tweak the items in the
 * world, then drag them into the Tools compendium under Processes.
 *
 * Run as GM.
 */

const MODULE_ID = 'coffee-pub-artificer';

/**
 * Colour runs cool at rest and hot at full, so intensity reads without the label.
 * `unstableAtMax` is only for processes that genuinely run away -- open flame --
 * not for everything at maximum.
 */
const PROCESSES = [
    // ----- Heat family: pulse -----------------------------------------------
    {
        name: 'Heat',
        img: 'icons/magic/fire/flame-burning-campfire-yellow.webp',
        animation: 'pulse',
        sound: `modules/${MODULE_ID}/sounds/fire-boil-01.mp3`,
        unstableAtMax: true,
        levels: [
            { label: 'Off', color: '#7a5a3a' },
            { label: 'Low', color: '#c98a4b' },
            { label: 'Medium', color: '#ffb45a' },
            { label: 'High', color: '#ff8c2e' }
        ]
    },
    {
        name: 'Boil',
        img: 'icons/consumables/potions/bottle-round-corked-red.webp',
        animation: 'pulse',
        sound: `modules/${MODULE_ID}/sounds/fire-boil-01.mp3`,
        unstableAtMax: true,
        levels: [
            { label: 'Off', color: '#4a6a7a' },
            { label: 'Simmer', color: '#7ab0c8' },
            { label: 'Rolling', color: '#a8d4e8' },
            { label: 'Furious', color: '#e8f4ff' }
        ]
    },
    {
        name: 'Bake',
        img: 'icons/consumables/food/bread-loaf-boule-rustic-brown.webp',
        animation: 'pulse',
        sound: `modules/${MODULE_ID}/sounds/fire-boil-01.mp3`,
        unstableAtMax: true,
        levels: [
            { label: 'Off', color: '#6a5038' },
            { label: 'Warm', color: '#c79a5e' },
            { label: 'Hot', color: '#e8b070' },
            { label: 'Searing', color: '#ff9a45' }
        ]
    },
    {
        name: 'Steam',
        img: 'icons/magic/air/air-burst-spiral-white.webp',
        animation: 'pulse',
        sound: `modules/${MODULE_ID}/sounds/fire-boil-01.mp3`,
        unstableAtMax: false,
        levels: [
            { label: 'Off', color: '#6a7a80' },
            { label: 'Wisp', color: '#b8c8d0' },
            { label: 'Steady', color: '#dce8ee' },
            { label: 'Billowing', color: '#ffffff' }
        ]
    },

    // ----- Liquid and time: swirl -------------------------------------------
    {
        name: 'Brew',
        img: 'icons/consumables/potions/bottle-conical-corked-brown.webp',
        animation: 'swirl',
        sound: `modules/${MODULE_ID}/sounds/fire-boil-01.mp3`,
        unstableAtMax: false,
        levels: [
            { label: 'Off', color: '#5a4632' },
            { label: 'Slow', color: '#9a7a4e' },
            { label: 'Steady', color: '#c9a463' },
            { label: 'Vigorous', color: '#e8c882' }
        ]
    },
    {
        name: 'Steep',
        img: 'icons/consumables/drinks/tea-fancy-green.webp',
        animation: 'swirl',
        sound: '',
        unstableAtMax: false,
        levels: [
            { label: 'Off', color: '#3f5a42' },
            { label: 'Brief', color: '#6f9a6a' },
            { label: 'Long', color: '#9ac48f' },
            { label: 'Overnight', color: '#c8e8b8' }
        ]
    },
    {
        name: 'Stir',
        img: 'icons/tools/cooking/spoon-simple-wood.webp',
        animation: 'swirl',
        sound: '',
        unstableAtMax: false,
        levels: [
            { label: 'Off', color: '#5a5a6a' },
            { label: 'Gentle', color: '#8f8fa8' },
            { label: 'Brisk', color: '#b8b8d0' },
            { label: 'Whipping', color: '#e0e0f0' }
        ]
    },
    {
        name: 'Tan',
        img: 'icons/commodities/leather/leather-tanned-brown.webp',
        animation: 'swirl',
        sound: '',
        unstableAtMax: false,
        levels: [
            { label: 'Off', color: '#4a3a2a' },
            { label: 'Light', color: '#8a6a48' },
            { label: 'Full', color: '#a87f56' },
            { label: 'Deep', color: '#5a3f28' }
        ]
    },

    // ----- Percussive: strike -----------------------------------------------
    {
        name: 'Forge',
        img: 'icons/tools/smithing/hammer-sledge-steel-grey.webp',
        animation: 'strike',
        sound: '',
        unstableAtMax: false,
        levels: [
            { label: 'Off', color: '#6a4a3a' },
            { label: 'Tap', color: '#c07a4a' },
            { label: 'Strike', color: '#ff9a45' },
            { label: 'Hammer', color: '#ffd08a' }
        ]
    },
    {
        name: 'Assemble',
        img: 'icons/tools/hand/wrench-adjustable-steel.webp',
        animation: 'strike',
        sound: '',
        unstableAtMax: false,
        levels: [
            { label: 'Off', color: '#4a5a6a' },
            { label: 'Fit', color: '#7a90a8' },
            { label: 'Join', color: '#a8c0d8' },
            { label: 'Secure', color: '#d8e8f8' }
        ]
    },

    // ----- Abrasive: shake --------------------------------------------------
    {
        name: 'Grind',
        img: 'icons/tools/smithing/mortar-and-pestle-brown.webp',
        animation: 'shake',
        sound: `modules/${MODULE_ID}/sounds/grind-stone-01.mp3`,
        unstableAtMax: false,
        levels: [
            { label: 'Off', color: '#6a6255' },
            { label: 'Coarse', color: '#a89a80' },
            { label: 'Medium', color: '#cabda0' },
            { label: 'Fine', color: '#ebe1cd' }
        ]
    },
    {
        name: 'Polish',
        img: 'icons/commodities/gems/gem-faceted-round-white.webp',
        animation: 'shake',
        sound: `modules/${MODULE_ID}/sounds/grind-stone-01.mp3`,
        unstableAtMax: false,
        levels: [
            { label: 'Off', color: '#5a5a5a' },
            { label: 'Buff', color: '#9a9a9a' },
            { label: 'Hone', color: '#cacaca' },
            { label: 'Mirror', color: '#ffffff' }
        ]
    },

    // ----- Mark-making: sweep -----------------------------------------------
    {
        name: 'Scribe',
        img: 'icons/tools/scribal/lens-blue.webp',
        animation: 'sweep',
        sound: '',
        unstableAtMax: false,
        levels: [
            { label: 'Off', color: '#3a3a5a' },
            { label: 'Faint', color: '#6a6a9a' },
            { label: 'Steady', color: '#9a9ac8' },
            { label: 'Bold', color: '#d8d8ff' }
        ]
    },
    {
        name: 'Stitch',
        img: 'icons/tools/fasteners/needle-steel-grey.webp',
        animation: 'sweep',
        sound: '',
        unstableAtMax: false,
        levels: [
            { label: 'Off', color: '#5a4a4a' },
            { label: 'Tack', color: '#9a7a7a' },
            { label: 'Run', color: '#c8a8a8' },
            { label: 'Lock', color: '#e8d0d0' }
        ]
    },
    {
        name: 'Bind',
        img: 'icons/commodities/cloth/cloth-bolt-white.webp',
        animation: 'sweep',
        sound: '',
        unstableAtMax: false,
        levels: [
            { label: 'Off', color: '#6a6258' },
            { label: 'Loose', color: '#b0a894' },
            { label: 'Firm', color: '#d8d0bc' },
            { label: 'Tight', color: '#f4eee0' }
        ]
    },

    // ----- Reduction and drying ---------------------------------------------
    {
        name: 'Extract',
        img: 'icons/consumables/potions/vial-cork-tall-green.webp',
        animation: 'blur',
        sound: '',
        unstableAtMax: false,
        levels: [
            { label: 'Off', color: '#3a5a4a' },
            { label: 'Press', color: '#5f9a7a' },
            { label: 'Draw', color: '#8ac8a0' },
            { label: 'Wring', color: '#c0f0d0' }
        ]
    },
    {
        name: 'Dry',
        img: 'icons/magic/air/wind-swirl-gray.webp',
        animation: 'settle',
        sound: '',
        unstableAtMax: false,
        levels: [
            { label: 'Off', color: '#5a5548' },
            { label: 'Airing', color: '#948e78' },
            { label: 'Curing', color: '#c0b89c' },
            { label: 'Bone-dry', color: '#e8e0c8' }
        ]
    },

    // ----- Magical: shimmer and ring ----------------------------------------
    {
        name: 'Imbue',
        img: 'icons/magic/symbols/runes-star-blue.webp',
        animation: 'shimmer',
        sound: '',
        unstableAtMax: false,
        levels: [
            { label: 'Off', color: '#3a3a6a' },
            { label: 'Trace', color: '#6a6ac0' },
            { label: 'Steady', color: '#9a9aff' },
            { label: 'Flooded', color: '#d8d8ff' }
        ]
    },
    {
        name: 'Attune',
        img: 'icons/magic/symbols/circle-star-blue.webp',
        animation: 'ring',
        sound: '',
        unstableAtMax: false,
        levels: [
            { label: 'Off', color: '#3a5a6a' },
            { label: 'Seeking', color: '#5f9ac0' },
            { label: 'Aligned', color: '#8ac8f0' },
            { label: 'Resonant', color: '#d0f0ff' }
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
                    value: `<p>A crafting process. Its levels are `
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
