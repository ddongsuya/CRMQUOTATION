/**
 * 마스터(426항목)·규칙(33룰) 로더. data/*.json 을 1회 읽어 캐시.
 * (추후 DataBlob overlay 연동 가능 — 지금은 파일만.)
 */
import fs from 'node:fs';
import path from 'node:path';
import type { MasterItem } from './types';

let itemCache: MasterItem[] | null = null;
let rulesCache: Record<string, unknown> | null = null;

function dataDir() { return path.resolve(process.cwd(), 'data'); }

export function loadMaster(): MasterItem[] {
  if (itemCache) return itemCache;
  const j = JSON.parse(fs.readFileSync(path.join(dataDir(), 'master_items.v2.json'), 'utf8'));
  itemCache = (j.items ?? []) as MasterItem[];
  return itemCache;
}

export function loadRules(): Record<string, unknown> {
  if (rulesCache) return rulesCache;
  const r = JSON.parse(fs.readFileSync(path.join(dataDir(), 'rules_catalog.v1.json'), 'utf8')) as Record<string, unknown>;
  rulesCache = r;
  return r;
}

export function getItem(id: string): MasterItem | undefined {
  return loadMaster().find(it => it.id === id);
}

export function itemsByCategory(category: string): MasterItem[] {
  return loadMaster().filter(it => it.category === category);
}
