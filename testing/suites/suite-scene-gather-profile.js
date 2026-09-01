// ==================================================================
// ===== SUITE: SCENE GATHER PROFILE ================================
// ==================================================================
// One resolver decides what a scene effectively gathers, and both the Scene
// Config tab and the gather path read it.
//
// WHY THIS SUITE EXISTS. They used to compute defaults separately and DISAGREE:
// the form fell back to every component family when the flag was empty, the
// gather path fell back to nothing. So an unconfigured scene displayed all six
// families ticked and found none of them -- and neither side reported anything,
// because "no components here" is a legitimate answer that looks identical to a
// broken one. That is the defect this asserts against, and it was invisible from
// the console in both directions.
// ==================================================================

import { settingRow } from '../harness-lib.js';

const PROFILE = '/modules/coffee-pub-artificer/scripts/systems/scene-gather-profile.js';
const GATHER = '/modules/coffee-pub-artificer/scripts/manager-gather.js';

/** A scene carrying habitats, which is the only real precondition for gathering. */
function sceneWithHabitat() {
    const geography = game.modules.get('coffee-pub-blacksmith')?.api?.geography;
    if (typeof geography?.getHabitats !== 'function') return null;
    return [...(game.scenes ?? [])].find((s) => geography.getHabitats(s).length) ?? null;
}

export default {
    id: 'scene-gather-profile',
    label: 'Scene Gather Profile',
    icon: 'fa-solid fa-sliders',

    settings: () => {
        const scene = sceneWithHabitat();
        return [
            settingRow('Test scene', scene ? scene.name : 'NONE WITH HABITATS'),
            settingRow('Opt-in model', 'every scene with a habitat gathers; no per-scene enable')
        ];
    },

    checks: [
        {
            id: 'unconfigured-scene-yields-everything',
            label: 'An unconfigured scene resolves to every component family',
            tier: 'headless',
            group: 'Defaults',
            note: 'The regression this suite exists for. If this returns empty, the gather path is back to its old fallback and a scene with a habitat silently finds nothing.',
            run: async ({ expect }) => {
                const { resolveSceneGatherProfile, defaultComponentTypes } = await import(PROFILE);
                // A bare object standing in for a scene with no Artificer flags at all.
                const bare = { getFlag: () => ({}) };
                const profile = resolveSceneGatherProfile(bare, ['Herbalism']);
                expect('component types default to all of them',
                    profile.componentTypes, defaultComponentTypes());
                expect.ok('and that is not empty', profile.componentTypes.length > 0);
                expect('harvesting skills fall back to what the caller supplied',
                    profile.harvestingSkills, ['Herbalism']);
            }
        },
        {
            id: 'stored-values-win',
            label: 'A configured scene keeps exactly what the GM set',
            tier: 'headless',
            group: 'Defaults',
            note: 'A default that overrides a deliberate choice is worse than no default.',
            run: async ({ expect }) => {
                const { resolveSceneGatherProfile } = await import(PROFILE);
                const configured = {
                    getFlag: () => ({ componentTypes: ['Plant'], harvestDC: 17, gatherSpots: 9 })
                };
                const profile = resolveSceneGatherProfile(configured, ['Herbalism']);
                expect('component types', profile.componentTypes, ['Plant']);
                expect('harvest DC', profile.harvestDC, 17);
                expect('gather spots', profile.gatherSpots, 9);
            }
        },
        {
            id: 'checkbox-nulls-do-not-count-as-configuration',
            label: 'A flag of nulls resolves to the default, not to junk',
            tier: 'headless',
            group: 'Defaults',
            note: 'Foundry writes one null per unticked box. Stringifying those produced literal "null" entries that read as a populated flag.',
            run: async ({ expect }) => {
                const { resolveSceneGatherProfile, defaultComponentTypes } = await import(PROFILE);
                const junk = { getFlag: () => ({ componentTypes: [null, null, null, null, null, null] }) };
                const profile = resolveSceneGatherProfile(junk, []);
                expect('nulls fall through to the default',
                    profile.componentTypes, defaultComponentTypes());
                expect.ok('and the scene does not read as tuned', profile.isTuned === false);
            }
        },
        {
            id: 'no-enabled-flag',
            label: 'Nothing consults a per-scene enable any more',
            tier: 'headless',
            group: 'Opt-in',
            note: 'Installing the module is the opt-in. A leftover read would gate gathering on a flag no form writes, which cannot be fixed from the UI at all.',
            run: async ({ expect }) => {
                const files = [
                    'scripts/manager-scene.js',
                    'scripts/manager-pins.js',
                    'scripts/manager-gather.js'
                ];
                for (const file of files) {
                    const source = await fetch(`/modules/coffee-pub-artificer/${file}`).then((r) => r.text());
                    const code = source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
                    expect.ok(`${file} does not read a scene enabled flag`,
                        !/(sceneFlags|flags)\s*\.\s*enabled\b/.test(code));
                }
            }
        },
        {
            id: 'form-and-engine-agree',
            label: 'What the tab shows is what gathering uses',
            tier: 'headless',
            group: 'One resolver',
            note: 'The two used to be computed separately. This asserts the resolved profile actually selects components, rather than merely looking right.',
            run: async ({ expect, log }) => {
                const scene = sceneWithHabitat();
                if (!scene) {
                    log('No scene carries habitats. Set some on a Geography tab and re-run.');
                    expect.ok('a scene with habitats exists to test with', false);
                    return;
                }
                const { resolveSceneGatherProfile } = await import(PROFILE);
                const { getEligibleGatherRecords } = await import(GATHER);
                const profile = resolveSceneGatherProfile(scene, []);
                log(`${scene.name}: ${profile.habitats.join(', ')} / ${profile.componentTypes.join(', ')}`);

                expect.ok('the scene is gatherable on habitat alone', profile.isConfigurable);
                // The end of the chain: the families the tab would show, run through the
                // real pool, must actually select components.
                const records = getEligibleGatherRecords(profile.habitats, profile.componentTypes);
                expect.ok(`the resolved profile yields components (${records.length})`, records.length > 0);
            }
        },
        {
            id: 'tuned-is-not-configurable',
            label: 'Tuned and gatherable are separate questions',
            tier: 'headless',
            group: 'One resolver',
            note: 'The directory badge answers "has a GM touched this", not "can this gather" -- which is now almost every scene and would mean nothing.',
            run: async ({ expect }) => {
                const { resolveSceneGatherProfile } = await import(PROFILE);
                const untouched = { getFlag: () => ({}) };
                const tuned = { getFlag: () => ({ componentTypes: ['Plant'] }) };
                expect.ok('an untouched scene is not tuned',
                    !resolveSceneGatherProfile(untouched, []).isTuned);
                expect.ok('a scene with a stored choice is tuned',
                    resolveSceneGatherProfile(tuned, []).isTuned);
            }
        }
    ]
};
