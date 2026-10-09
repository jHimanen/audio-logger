import { describe, expect, it } from 'vitest'
import { t } from './i18n'

describe('t', () => {
  it('interpolates variables', () => {
    expect(t('transcript.savedTo', { path: 'x' })).toBe('Tallennettu kansioon x')
  })

  it('leaves unknown variables as placeholders', () => {
    expect(t('transcript.savedTo', { other: 'x' })).toBe('Tallennettu kansioon {path}')
  })
})
