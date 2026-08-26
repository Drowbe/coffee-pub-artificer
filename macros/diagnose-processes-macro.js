/**
 * Artificer: Why is my Process not resolving?
 *
 * Reports, for every Process item it can find, whether the ITEM has the flags and
 * whether the CACHE RECORD carries them through. Those are different failures:
 * the item can be perfect and the record stale, which is invisible from the sheet.
 *
 * Read-only. Run as GM.
 */

const MODULE_ID = 'coffee-pub-artificer';

const { getAllRecordsFromCache, getCacheStatus } = await import(`/modules/${MODULE_ID}/scripts/cache/cache-items.js`);
const { getAllProcesses } = await import(`/modules/${MODULE_ID}/scripts/systems/process-definitions.js`);

const readFlags = (doc) => doc.flags?.[MODULE_ID] ?? doc.flags?.artificer ?? {};

/** Every world item that claims to be a Process, by its own flags. */
const worldProcesses = game.items.filter(i => {
    const f = readFlags(i);
    return (f.artificerFamily ?? f.family) === 'Process';
}).map(i => ({
    name: i.name,
    uuid: i.uuid,
    // The cache reads `flags.artificer` FIRST, so an empty legacy object wins over
    // the real namespace. Worth seeing which one the item actually has.
    hasLegacyFlagObject: Boolean(i.flags?.artificer),
    artificerType: readFlags(i).artificerType ?? readFlags(i).type ?? null,
    artificerFamily: readFlags(i).artificerFamily ?? readFlags(i).family ?? null,
    levelCount: (readFlags(i).artificerProcessLevels ?? []).length,
    animation: readFlags(i).artificerProcessAnimation ?? null
}));

/** What the CACHE thinks those same items are. */
const records = getAllRecordsFromCache();
const cachedProcesses = records
    .filter(r => r?.family === 'Process' || r?.artificerType === 'Tool')
    .filter(r => worldProcesses.some(w => w.name === r.name) || r.family === 'Process')
    .map(r => ({
        name: r.name,
        artificerType: r.artificerType,
        family: r.family,
        // If this is undefined the record predates the field: the cache needs a
        // genuine REBUILD, not a reload from the persisted copy.
        processLevels: r.processLevels === undefined ? 'FIELD ABSENT (stale record)' : (r.processLevels?.length ?? 0),
        processAnimation: r.processAnimation ?? null
    }));

console.log(`${MODULE_ID} | PROCESS DIAGNOSTIC`);
console.log('  cache status:', getCacheStatus?.());
console.log(`  total cache records: ${records.length}`);
console.log(`  world items flagged as Process: ${worldProcesses.length}`, worldProcesses);
console.log(`  cache records seen as Process: ${cachedProcesses.length}`, cachedProcesses);
console.log('  processes getProcess() can resolve:', getAllProcesses().map(p => p.id));

const staleRecords = cachedProcesses.filter(r => typeof r.processLevels === 'string').length;
const missingFromCache = worldProcesses.filter(w => !records.some(r => r.name === w.name)).map(w => w.name);

let verdict;
if (!records.length) verdict = 'The cache is EMPTY. Rebuild it.';
else if (missingFromCache.length) verdict = `Not in the cache at all: ${missingFromCache.join(', ')}. Rebuild it.`;
else if (staleRecords) verdict = `${staleRecords} cached record(s) predate the process fields. Rebuild the cache — a reload from the persisted copy will not add them.`;
else if (!worldProcesses.length) verdict = 'No world item carries artificerFamily "Process".';
else verdict = 'Items and records both look correct — the failure is downstream of the cache.';

console.log(`  VERDICT: ${verdict}`);
ui.notifications.info(`Artificer process diagnostic: ${verdict} Detail in the console.`);
