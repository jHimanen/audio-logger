import fi from './locales/fi.json'

export type MessageKey = keyof typeof fi

const messages: Record<MessageKey, string> = fi

export function t(key: MessageKey, vars?: Record<string, string | number>): string {
  const template = messages[key]
  if (!vars) return template
  return template.replace(/\{(\w+)\}/g, (match, name: string) =>
    name in vars ? String(vars[name]) : match,
  )
}
