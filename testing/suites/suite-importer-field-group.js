// ==================================================================
// ===== SUITE: IMPORTER FIELD GROUP ================================
// ==================================================================
// Asserts that Artificer's flag block reaches Blacksmith's importer as a
// registered field group, and that the two behaviours a consumer can get wrong
// actually hold: Process fields gate on FAMILY, and a payload that never
// mentions Artificer is unaffected.
//
// WHY THIS SUITE EXISTS. Registration reports success in the console and
// nothing else. Every failure mode here is silent -- a group that did not
// register, a gate keyed on the wrong field, a rule that never fires. None of
// them throws, and all of them look exactly like working code.
// ==================================================================

import { blacksmithApi, settingRow, MODULE_ID } from '../harness-lib.js';

/** Our group as the importer holds it, or null. */
function registeredGroup() {
    const importer = blacksmithApi()?.importer;
    if (typeof importer?.listFieldGroups !== 'function') return null;
    return importer.listFieldGroups().find(g => g.module === MODULE_ID) ?? null;
}

/** One field from the registered group, by name. */
function groupField(name) {
    return registeredGroup()?.fields?.find(f => f.name === name) ?? null;
}

export default {
    id: 'importer-field-group',
    label: 'Importer Field Group',
    icon: 'fa-solid fa-file-import',

    settings: () => {
        const importer = blacksmithApi()?.importer;
        const group = registeredGroup();
        return [
            settingRow('Blacksmith importer', importer ? 'available' : 'ABSENT'),
            settingRow('registerFieldGroup', typeof importer?.registerFieldGroup === 'function' ? 'available' : 'ABSENT'),
            settingRow('Artificer group', group ? `registered (${group.fields?.length ?? 0} fields)` : 'NOT REGISTERED'),
            settingRow('Applies to', group?.appliesTo ?? '—')
        ];
    },

    checks: [
        // ---- Registration ------------------------------------------------
        {
            id: 'registered',
            label: 'The group is registered with the importer',
            tier: 'headless',
            group: 'Registration',
            note: 'Registration only logs. A group that silently failed to register looks identical to one that worked.',
            run: async ({ expect }) => {
                const importer = blacksmithApi()?.importer;
                expect.ok('Blacksmith importer API is present', Boolean(importer));
                expect.ok('registerFieldGroup exists', typeof importer?.registerFieldGroup === 'function');
                const group = registeredGroup();
                expect.ok('a group is registered for this module', Boolean(group));
                expect('group id', group?.id, 'artificer');
                expect('group kind', group?.kind, 'item');
                expect('group option id', group?.option?.id, 'artificerItem');
            }
        },
        {
            id: 'field-set',
            label: 'Every declared field reached the importer',
            tier: 'headless',
            group: 'Registration',
            run: async ({ expect }) => {
                const expected = [
                    'artificerType', 'artificerFamily', 'artificerTraits', 'artificerSkillLevel',
                    'artificerBiomes', 'artificerQuirk', 'artificerAffinity',
                    'artificerProcessLevels', 'artificerProcessAnimation',
                    'artificerProcessSound', 'artificerProcessUnstableAtMax'
                ];
                const actual = (registeredGroup()?.fields ?? []).map(f => f.name);
                for (const name of expected) {
                    expect.ok(`${name} is declared`, actual.includes(name));
                }
                expect('no unexpected extras', actual.length, expected.length);
            }
        },
        {
            id: 'paths-namespaced',
            label: 'Every field writes inside our flag namespace',
            tier: 'headless',
            group: 'Registration',
            note: 'A path outside flags["coffee-pub-artificer"] would write into someone else\'s data.',
            run: async ({ expect }) => {
                const prefix = `flags.${MODULE_ID}.`;
                for (const field of registeredGroup()?.fields ?? []) {
                    expect.ok(`${field.name} -> ${field.path}`, String(field.path ?? '').startsWith(prefix));
                }
            }
        },

        // ---- The gate ----------------------------------------------------
        {
            id: 'process-gates-on-family',
            label: 'Process fields gate on FAMILY, not type',
            tier: 'headless',
            group: 'Gating',
            note: 'Process is a Tool family. Gating on artificerType would never fire -- and a gate that never fires emits nothing at all.',
            run: async ({ expect }) => {
                const processFields = [
                    'artificerProcessLevels', 'artificerProcessAnimation',
                    'artificerProcessSound', 'artificerProcessUnstableAtMax'
                ];
                for (const name of processFields) {
                    expect(`${name} gates on family`, groupField(name)?.requiresWhen, 'artificerFamily:Process');
                }
                expect('affinity gates on family', groupField('artificerAffinity')?.requiresWhen, 'artificerFamily:Essence');
            }
        },
        {
            id: 'gate-value-is-real',
            label: 'Each gate names a value the gated field can actually see',
            tier: 'headless',
            group: 'Gating',
            note: 'The check that would have caught the wrong-field bug: does the gated field exist, and is its value in that field\'s own vocabulary?',
            run: async ({ expect }) => {
                const fields = registeredGroup()?.fields ?? [];
                for (const field of fields.filter(f => f.requiresWhen)) {
                    const [gateName, gateValue] = String(field.requiresWhen).split(':');
                    const gate = fields.find(f => f.name === gateName);
                    expect.ok(`${field.name}: gate field "${gateName}" is declared`, Boolean(gate));
                    // A gate whose field carries a closed vocabulary must name a
                    // member of it. artificerFamily deliberately has none -- its
                    // vocabulary depends on artificerType -- so it is skipped.
                    if (gate?.values) {
                        expect.ok(`${field.name}: "${gateValue}" is in ${gateName}'s values`, gate.values.includes(gateValue));
                    }
                }
            }
        },

        // ---- Rules -------------------------------------------------------
        {
            id: 'rules-declared',
            label: 'Both enforcement rules registered',
            tier: 'headless',
            group: 'Rules',
            note: 'These reject JSON that used to import. A rule that silently failed to register would let it through again.',
            run: async ({ expect }) => {
                const rules = registeredGroup()?.rules ?? [];
                const has = (when, then) => rules.some(r =>
                    r.kind === 'requires' && r.when === when && (r.then ?? []).includes(then));
                expect.ok('Component requires biomes', has('artificerType:Component', 'artificerBiomes'));
                expect.ok('Essence requires affinity', has('artificerFamily:Essence', 'artificerAffinity'));
            }
        },
        {
            id: 'rules-reference-declared-fields',
            label: 'Every rule references a field the group declares',
            tier: 'headless',
            group: 'Rules',
            note: 'A rule over an undeclared field is inert, and an inert rule reads as enforced while enforcing nothing.',
            run: async ({ expect }) => {
                const group = registeredGroup();
                const names = new Set((group?.fields ?? []).map(f => f.name));
                for (const rule of group?.rules ?? []) {
                    const refs = [rule.when, ...(rule.then ?? []), ...(rule.fields ?? []), rule.field]
                        .filter(Boolean)
                        .map(r => String(r).split(':')[0]);
                    for (const ref of refs) {
                        expect.ok(`rule ${rule.kind} references declared field "${ref}"`, names.has(ref));
                    }
                }
            }
        },

        // ---- Derived output ----------------------------------------------
        // NOTE ON SHAPE. The derived template is FLAT and keyed by each field's
        // authoring `name` -- `artificerType`, not `flags["coffee-pub-artificer"]
        // .artificerType`. `path` says where import LANDS the value; the template
        // says what an author types. Asserting the flag shape here failed against
        // a working importer, which is its own lesson.
        {
            id: 'template-includes-group',
            label: 'Ungated fields appear in a derived template; gated ones do not',
            tier: 'headless',
            group: 'Derived output',
            note: 'The end-to-end check: a group can register cleanly and still not compose into a profile.',
            run: async ({ expect }) => {
                const importer = blacksmithApi()?.importer;
                if (typeof importer?.getJsonTemplateObject !== 'function') {
                    expect.ok('getJsonTemplateObject is available', false);
                    return;
                }
                const template = importer.getJsonTemplateObject('item', 'loot', { artificerItem: true });
                expect.ok('artificerType is offered', 'artificerType' in (template ?? {}));
                expect.ok('artificerFamily is offered', 'artificerFamily' in (template ?? {}));
                expect.ok('artificerTraits is offered', 'artificerTraits' in (template ?? {}));
                // Value-gated fields are OMITTED, and this assertion has been both ways.
                // Blacksmith originally offered them and let the rules reject what did
                // not belong; they now omit them, because a template is a single
                // starting point and including a gated field produces a contradictory
                // example -- a Plant carrying the fields only a Process has. The guide
                // and prompt state the condition instead, which is where a condition can
                // be expressed. The harness caught the change; do not "fix" this by
                // flipping it back without reading manager-declarations.js first.
                expect.ok('artificerProcessLevels is NOT offered ungated',
                    !('artificerProcessLevels' in (template ?? {})));
                expect.ok('artificerAffinity is NOT offered ungated',
                    !('artificerAffinity' in (template ?? {})));
            }
        },
        {
            id: 'template-gates-on-the-option',
            label: 'Without the option ticked, none of our fields are offered',
            tier: 'headless',
            group: 'Derived output',
            note: 'The group is opt-in per import. Fields leaking into a template nobody asked for is how a plain weapon starts demanding an Artificer type.',
            run: async ({ expect }) => {
                const importer = blacksmithApi()?.importer;
                if (typeof importer?.getJsonTemplateObject !== 'function') {
                    expect.ok('getJsonTemplateObject is available', false);
                    return;
                }
                const ours = new Set((registeredGroup()?.fields ?? []).map(f => f.name));
                for (const profileId of ['loot', 'weapon']) {
                    const template = importer.getJsonTemplateObject('item', profileId) ?? {};
                    const leaked = Object.keys(template).filter(k => ours.has(k));
                    expect(`${profileId} template offers no Artificer fields`, leaked, []);
                }
            }
        },
        {
            id: 'group-reaches-every-profile',
            label: 'The group attaches to every Item profile',
            tier: 'headless',
            group: 'Derived output',
            note: 'appliesTo is "*" because our flags are orthogonal to the D&D type. A flagged weapon is a legitimate crafted result.',
            run: async ({ expect }) => {
                const importer = blacksmithApi()?.importer;
                if (typeof importer?.getFieldGroupsFor !== 'function') {
                    expect.ok('getFieldGroupsFor is available', false);
                    return;
                }
                const profiles = ['loot', 'weapon', 'equipment', 'tool', 'container', 'feature', 'spell', 'consumable'];
                for (const profileId of profiles) {
                    const attached = importer.getFieldGroupsFor('item', profileId) ?? [];
                    expect.ok(`attached to item.${profileId}`, attached.some(g => g.module === MODULE_ID));
                }
            }
        },

        // ---- Interactive --------------------------------------------------
        {
            id: 'author-a-process',
            label: 'Author a Process through the importer',
            tier: 'interactive',
            group: 'By hand',
            note: 'Open the JSON importer, tick Artificer Item, and check the template: the four Process fields should appear only once artificerFamily is Process.',
            run: async ({ log }) => {
                const importer = blacksmithApi()?.importer;
                if (typeof importer?.openWindow === 'function') {
                    importer.openWindow({ kind: 'item' });
                    log('Importer opened. Tick "Artificer Item" and inspect the template.');
                } else {
                    log('importer.openWindow is unavailable; open the JSON importer from the menubar instead.');
                }
            }
        }
    ]
};
