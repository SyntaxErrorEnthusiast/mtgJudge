// useChat.js — the "brain" of the chat feature.
//
// This is a custom React hook. A hook is just a function that:
//   1. Starts with "use" (React's naming convention)
//   2. Can call other hooks (like useState)
//
// By putting all chat logic here, we keep it out of the components.
// Components call useChat() to get everything they need to render.
// This separation means we can test the logic independently of the UI.

import { useState, useRef } from 'react'
import { askAgent, trackUsage } from '../../api/client'

/**
 * useChat — manages the chat conversation state.
 *
 * Returns:
 *   messages    — array of { id, role, text, timestamp }
 *   isLoading   — true while waiting for the agent to respond
 *   sendMessage — function to send a message
 */
export function useChat() {
  // useState([]) initialises messages as an empty array.
  // Every time setMessages is called, React re-renders components that use this hook.
  const [messages, setMessages] = useState([])

  // isLoading controls the "Thinking..." state in InputBar.
  const [isLoading, setIsLoading] = useState(false)

  // useRef gives us a mutable value that persists across renders WITHOUT causing re-renders.
  // We use it as a simple counter for message IDs.
  // (If we used a plain variable, it would reset to 0 on every render.)
  const nextIdRef = useRef(0)

  /**
   * sendMessage — called by InputBar when the user submits a message.
   *
   * @param {string} text - The user's message text
   */
  async function sendMessage(text) {
    // Guard: ignore empty or whitespace-only messages.
    if (!text.trim()) return

    // Capture the timestamp NOW — at the moment the user pressed Send.
    // We pass this same timestamp to trackUsage later so it records
    // when the question was asked, not when the response arrived.
    const timestamp = new Date().toISOString()

    // Build the user's message object.
    // We use a consistent shape for all messages so they're easy to render
    // and easy to persist to a backend later (see "future features" in the spec).
    const userMessage = {
      id: nextIdRef.current++,  // post-increment: use current value, then add 1
      role: 'user',
      text,
      timestamp,
    }

    // Optimistic update: add the user's message to the UI immediately.
    // The user sees their message appear without waiting for the API.
    // We use the functional update form (prev => ...) because React may
    // batch state updates, and we want to work with the latest state.
    setMessages(prev => [...prev, userMessage])
    setIsLoading(true)

    // Fire usage tracking immediately — we want to record every send attempt,
    // not just successful ones. trackUsage is fire-and-forget; if it fails,
    // the error is silently swallowed inside client.js.
    trackUsage(timestamp)

    try {
      // Ask the agent. This awaits the FastAPI response.
      const responseText = await askAgent(text)

      // Append the agent's response to the conversation.
      setMessages(prev => [...prev, {
        id: nextIdRef.current++,
        role: 'agent',
        text: responseText,
        timestamp: new Date().toISOString(),
      }])

    } catch {
      // If the API call fails, show a friendly error in the chat list
      // instead of crashing or showing nothing.
      setMessages(prev => [...prev, {
        id: nextIdRef.current++,
        role: 'error',
        text: 'Something went wrong. Please try again.',
        timestamp: new Date().toISOString(),
      }])
    } finally {
      // finally runs whether try succeeded or catch ran.
      // Always reset isLoading — we're done waiting either way.
      setIsLoading(false)
    }
  }

  // Return only what components need — they don't need to know about
  // nextIdRef, setMessages, or the internal implementation details.
  return { messages, isLoading, sendMessage }
}
