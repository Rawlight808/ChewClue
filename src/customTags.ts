import type { TagDef } from './types'

const STORAGE_KEY = 'chewclue_custom_tags'

export function getCustomTags(): TagDef[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

export function saveCustomTags(tags: TagDef[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(tags))
}

export function addCustomTag(label: string): TagDef {
  const tags = getCustomTags()
  const id = 'custom_' + label.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/_+$/, '')
  const newTag: TagDef = { id, label, emoji: '🏷️' }
  tags.push(newTag)
  saveCustomTags(tags)
  return newTag
}

export function removeCustomTag(id: string): void {
  const tags = getCustomTags().filter((t) => t.id !== id)
  saveCustomTags(tags)
}
