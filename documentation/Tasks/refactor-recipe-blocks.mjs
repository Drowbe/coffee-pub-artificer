#!/usr/bin/env node
/**
 * Refactor recipie-migration.md so each recipe block includes all canonical
 * variables in order, with empty values where missing.
 * Run from repo root: node documentation/Tasks/refactor-recipe-blocks.mjs
 */
import fs from 'fs';
import path from 'path';

const CANONICAL_ORDER = [
  'name', 'resultItemName', 'type', 'category', 'skill', 'skillLevel',
  'workstation', 'toolName', 'apparatusName', 'containerName',
  'processType', 'processLevel', 'heat', 'time', 'goldCost', 'workHours',
  'ingredients', 'tags', 'description', 'source', 'license'
];
const SOURCE_META = ['dc', 'productValue', 'rarity', 'isHomebrew'];
const WORKHOURS_TO_SEC = { 8: 28800, 24: 86400, 80: 288000, 240: 864000 };

function parseBlock(content) {
  const data = {};
  const lines = content.split(/\r?\n/);
  let i = 0;
  let currentKey = null;
  let currentVal = [];

  while (i < lines.length) {
    const line = lines[i];
    const keyVal = line.match(/^([a-zA-Z]+):\s*(.*)$/);
    if (keyVal) {
      if (currentKey) {
        const joined = currentVal.length ? currentVal.join('\n') : '';
        data[currentKey] = joined || (data[currentKey] ?? '');
      }
      currentKey = keyVal[1];
      const rest = keyVal[2].trim();
      currentVal = rest ? [rest] : [];
      i++;
      continue;
    }
    if (currentKey && (line.startsWith('  - ') || (line.startsWith(' ') && currentKey === 'ingredients'))) {
      currentVal.push(line);
      i++;
      continue;
    }
    if (currentKey) {
      data[currentKey] = currentVal.length ? currentVal.join('\n') : (data[currentKey] ?? '');
    }
    currentKey = null;
    currentVal = [];
    i++;
  }
  if (currentKey) data[currentKey] = currentVal.length ? currentVal.join('\n') : (data[currentKey] ?? '');

  if (data.tool && !data.toolName) data.toolName = data.tool;
  if (data.workHours != null && data.workHours !== '' && !data.time) {
    const hrs = Number(data.workHours);
    data.time = WORKHOURS_TO_SEC[hrs] ?? (hrs * 3600);
  }
  return data;
}

function formatBlock(data) {
  const out = [];
  for (const key of CANONICAL_ORDER) {
    const v = data[key];
    if (v === undefined || v === null || v === '') {
      out.push(`${key}:`);
    } else if (key === 'ingredients') {
      out.push('ingredients:');
      out.push(String(v).trim().startsWith('-') ? String(v).trim() : String(v).split('\n').map(l => l.trim().startsWith('-') ? l : `  ${l}`).join('\n'));
    } else {
      out.push(`${key}: ${String(v).trim()}`);
    }
  }
  for (const key of SOURCE_META) {
    if (data[key] !== undefined && data[key] !== null && data[key] !== '') {
      out.push(`${key}: ${data[key]}`);
    }
  }
  return out.join('\n');
}

const filePath = path.join(process.cwd(), 'documentation', 'Tasks', 'recipie-migration.md');
let text = fs.readFileSync(filePath, 'utf8');

const blockRegex = /^```\r?\n([\s\S]*?)\r?\n```/gm;
let match;
const replacements = [];
while ((match = blockRegex.exec(text)) !== null) {
  const inner = match[1].trim();
  if (!inner.startsWith('name:') || !inner.includes('resultItemName:')) continue;
  const data = parseBlock(inner);
  if (!data.name) continue;
  const formatted = formatBlock(data);
  replacements.push({ index: match.index, length: match[0].length, replacement: '```\n' + formatted + '\n```' });
}

// Apply from end so indices stay valid
replacements.reverse().forEach(({ index, length, replacement }) => {
  text = text.slice(0, index) + replacement + text.slice(index + length);
});

fs.writeFileSync(filePath, text, 'utf8');
console.log('Refactored', replacements.length, 'recipe blocks.');
