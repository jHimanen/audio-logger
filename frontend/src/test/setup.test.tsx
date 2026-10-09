import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

describe('test setup', () => {
  it('renders into jsdom with jest-dom matchers', () => {
    render(<p>moi</p>)
    expect(screen.getByText('moi')).toBeInTheDocument()
  })

  it('unmounts between tests', () => {
    render(<p>moi</p>)
    expect(screen.getAllByText('moi')).toHaveLength(1)
  })
})
