import type { TagDef } from './types'

const STORAGE_KEY = 'chewclue_custom_tags'

function normalizeLabel(label: string): string {
  return label.trim().replace(/\s+/g, ' ')
}

function buildCustomTag(label: string): TagDef {
  const normalized = normalizeLabel(label)
  const slug = normalized
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')

  return {
    id: 'custom_' + (slug || 'tag'),
    label: normalized,
    emoji: '🏷️',
  }
}

function dedupeTags(tags: TagDef[]): TagDef[] {
  const seen = new Set<string>()
  const deduped: TagDef[] = []

  for (const tag of tags) {
    const normalized = normalizeLabel(tag.label)
    if (!normalized) continue

    const next = buildCustomTag(normalized)
    if (seen.has(next.id)) continue

    seen.add(next.id)
    deduped.push(next)
  }

  return deduped
}

export function getCustomTags(): TagDef[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? dedupeTags(JSON.parse(raw)) : []
  } catch {
    return []
  }
}

export function saveCustomTags(tags: TagDef[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(tags))
  } catch {
    /* Safari private mode / storage blocked */
  }
}

export function addCustomTag(label: string): TagDef {
  const newTag = buildCustomTag(label)
  const tags = dedupeTags([...getCustomTags(), newTag])
  saveCustomTags(tags)
  return tags.find((tag) => tag.id === newTag.id) ?? newTag
}

export function removeCustomTag(id: string): void {
  const tags = getCustomTags().filter((t) => t.id !== id)
  saveCustomTags(tags)
}

export function clearCustomTags(): void {
  saveCustomTags([])
}
