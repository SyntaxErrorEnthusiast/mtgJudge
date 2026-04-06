// useChat.test.js
//
// We test custom hooks using renderHook() from @testing-library/react.
// renderHook() mounts the hook in a minimal React environment so we can
// observe its state and call its functions.
//
// act() is required whenever a hook call triggers a state update.
// Without it, React won't flush the state update before we assert.
//
// We mock client.js using vi.spyOn() so tests don't make real network calls.

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useChat } from './useChat'
import * as client from '../../api/client'

describe('useChat', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('starts with empty messages and isLoading false', () => {
    const { result } = renderHook(() => useChat())
    expect(result.current.messages).toEqual([])
    expect(result.current.isLoading).toBe(false)
  })

  it('adds user message to messages immediately on sendMessage', async () => {
    vi.spyOn(client, 'askAgent').mockResolvedValue({ response: 'The agent response', retrieved_rules: [] })

    const { result } = renderHook(() => useChat())

    await act(async () => {
      await result.current.sendMessage('Can I respond to a spell?')
    })

    expect(result.current.messages[0]).toMatchObject({
      role: 'user',
      text: 'Can I respond to a spell?',
    })
  })

  it('appends agent response as second message after success', async () => {
    vi.spyOn(client, 'askAgent').mockResolvedValue({ response: 'Yes, during priority.', retrieved_rules: [] })

    const { result } = renderHook(() => useChat())

    await act(async () => {
      await result.current.sendMessage('Can I respond?')
    })

    expect(result.current.messages[1]).toMatchObject({
      role: 'agent',
      text: 'Yes, during priority.',
    })
  })

  it('appends an error message when the API call fails', async () => {
    vi.spyOn(client, 'askAgent').mockRejectedValue(new Error('network'))

    const { result } = renderHook(() => useChat())

    await act(async () => {
      await result.current.sendMessage('What is trample?')
    })

    expect(result.current.messages[1]).toMatchObject({
      role: 'error',
      text: 'Something went wrong. Please try again.',
    })
  })

  it('resets isLoading to false after completion', async () => {
    vi.spyOn(client, 'askAgent').mockResolvedValue({ response: 'answer', retrieved_rules: [] })

    const { result } = renderHook(() => useChat())

    await act(async () => {
      await result.current.sendMessage('test')
    })

    expect(result.current.isLoading).toBe(false)
  })

  it('does not call askAgent for whitespace-only messages', async () => {
    const mockAsk = vi.spyOn(client, 'askAgent')

    const { result } = renderHook(() => useChat())

    await act(async () => {
      await result.current.sendMessage('   ')
    })

    expect(mockAsk).not.toHaveBeenCalled()
    expect(result.current.messages).toHaveLength(0)
  })

  it('accumulates retrieved rules across multiple responses', async () => {
    const firstRules = [{ rule_number: '100.1', text: 'The game begins.' }]
    const secondRules = [{ rule_number: '101.1', text: 'A two-player game.' }]
    vi.spyOn(client, 'askAgent')
      .mockResolvedValueOnce({ response: 'First answer.', retrieved_rules: firstRules })
      .mockResolvedValueOnce({ response: 'Second answer.', retrieved_rules: secondRules })

    const { result } = renderHook(() => useChat())

    await act(async () => { await result.current.sendMessage('first question') })
    await act(async () => { await result.current.sendMessage('second question') })

    expect(result.current.allRetrievedRules).toEqual([...firstRules, ...secondRules])
  })

  it('does not duplicate rules already in allRetrievedRules', async () => {
    const rule = { rule_number: '100.1', text: 'The game begins.' }
    vi.spyOn(client, 'askAgent').mockResolvedValue({ response: 'answer', retrieved_rules: [rule] })

    const { result } = renderHook(() => useChat())

    await act(async () => { await result.current.sendMessage('first') })
    await act(async () => { await result.current.sendMessage('second') })

    expect(result.current.allRetrievedRules).toHaveLength(1)
  })
})
