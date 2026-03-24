# MTG Judge Frontend Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a modular React (Vite) frontend with a chat interface that sends questions to the MTG Judge FastAPI backend, with a stubbed feature-request form.

**Architecture:** Feature-folder structure under `frontend/src/features/`. All API calls live in `src/api/client.js`. Logic lives in custom hooks (`useChat`, `useRequests`); components are focused purely on rendering. Auth is handled entirely by Authentik at the reverse-proxy layer — no auth code in the frontend.

**Tech Stack:** React 19, Vite 8, Vitest, @testing-library/react, plain CSS

---

## File Map

| File | Responsibility |
|---|---|
| `frontend/vite.config.js` | Vite config + dev proxy + Vitest config |
| `frontend/src/test-setup.js` | Vitest global setup (jest-dom matchers) |
| `frontend/index.html` | HTML shell — mounts the React root |
| `frontend/src/main.jsx` | React entry point |
| `frontend/src/App.jsx` | Root component — renders ChatWindow + RequestForm toggle |
| `frontend/src/App.css` | Stub app-level CSS |
| `frontend/src/index.css` | Stub global CSS |
| `frontend/src/api/client.js` | All fetch() calls: `askAgent`, `trackUsage`, `submitRequest` (stub) |
| `frontend/src/features/chat/useChat.js` | Hook: owns `messages[]`, `isLoading`; calls `client.js` |
| `frontend/src/features/chat/Message.jsx` | Renders a single message bubble (role-aware) |
| `frontend/src/features/chat/MessageList.jsx` | Scrollable list of Message components |
| `frontend/src/features/chat/InputBar.jsx` | Text input + send button |
| `frontend/src/features/chat/ChatWindow.jsx` | Shell: wires useChat + MessageList + InputBar |
| `frontend/src/features/requests/useRequests.js` | Hook: form state + stubbed submit |
| `frontend/src/features/requests/RequestForm.jsx` | Feature request form (title + description) |

---

## Task 1: Scaffold the Vite + React project

**Files:**
- Create: `frontend/` (entire directory via Vite scaffolding)
- Modify: `frontend/vite.config.js`
- Create: `frontend/src/test-setup.js`

- [ ] **Step 1: Scaffold the project**

Run from the `mtgJudge/` root:
```bash
npm create vite@latest frontend -- --template react
```
Expected: Vite creates `frontend/` with `src/`, `index.html`, `package.json`, etc.

- [ ] **Step 2: Install dependencies**

```bash
cd frontend
npm install
npm install -D vitest @testing-library/react @testing-library/jest-dom @testing-library/user-event jsdom
```
Expected: `node_modules/` populated, no errors.

- [ ] **Step 3: Replace `vite.config.js` with proxy + Vitest config**

Replace the contents of `frontend/vite.config.js` with:
```js
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// vite.config.js — Vite configuration file.
//
// Vite is both a dev server and a build tool.
// This file configures:
//   1. Which plugins to use (React JSX transformation)
//   2. The dev server proxy (so /api/* hits your FastAPI)
//   3. Vitest (the test runner) settings

export default defineConfig({
  plugins: [react()],

  server: {
    // The proxy rewrites any request starting with /api
    // to your FastAPI backend running on port 8000.
    //
    // Example: fetch('/api/ask') in your React code becomes
    //          http://localhost:8000/ask behind the scenes.
    //
    // Why? Browsers block cross-origin requests (CORS) unless
    // the server explicitly allows them. The proxy sidesteps this
    // in development by making both frontend and API appear to
    // come from the same origin (localhost:5173).
    proxy: {
      '/api': {
        target: 'http://localhost:8000',
        changeOrigin: true,
        // Strip the /api prefix before forwarding.
        // /api/ask → /ask (which FastAPI handles)
        rewrite: (path) => path.replace(/^\/api/, ''),
      },
    },
  },

  // Vitest configuration — the test runner for Vite projects.
  // Vitest uses the same config as Vite, so you don't need a separate file.
  test: {
    // jsdom simulates a browser DOM environment for testing React components.
    // Without this, document.getElementById() and similar calls would fail.
    environment: 'jsdom',

    // globals: true lets you use describe/it/expect without importing them.
    // It mimics Jest's global API — fewer imports in every test file.
    globals: true,

    // Run this file before every test suite (before each test file).
    setupFiles: './src/test-setup.js',
  },
})
```

- [ ] **Step 4: Create `src/test-setup.js`**

Create `frontend/src/test-setup.js`:
```js
// test-setup.js — runs before every test file.
//
// @testing-library/jest-dom adds extra matchers to Vitest's expect():
//   expect(element).toBeInTheDocument()
//   expect(element).toBeDisabled()
//   expect(element).toHaveValue('...')
//   ...and many more.
//
// Without this, you'd only have basic Vitest matchers like toBe() and toEqual().
import '@testing-library/jest-dom'
```

- [ ] **Step 5: Verify the dev server starts**

```bash
npm run dev
```
Expected: `VITE v5.x ready on http://localhost:5173`. Open in browser — should show Vite's default React starter page. Stop with Ctrl+C.

- [ ] **Step 6: Verify tests can run**

```bash
npm run test -- --run
```
Expected: Vitest runs (zero test files yet) and exits with no errors.

- [ ] **Step 7: Commit**

```bash
cd ..
git add frontend/
git commit -m "feat: scaffold React+Vite frontend with proxy and Vitest"
```

---

## Task 2: API client

**Files:**
- Create: `frontend/src/api/client.js`
- Create: `frontend/src/api/client.test.js`

- [ ] **Step 1: Write the failing tests**

Create `frontend/src/api/client.test.js`:
```js
// client.test.js — tests for the API client module.
//
// We test client.js by mocking globalThis.fetch — the browser's built-in
// HTTP function. This lets us simulate API responses without a real server.
//
// vi.fn() creates a "mock function" that we can program with fake behavior.
// vi.restoreAllMocks() resets all mocks between tests so they don't bleed over.

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { askAgent, trackUsage } from './client'

describe('askAgent', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('POSTs the message and returns the response string', async () => {
    // mockResolvedValue makes fetch() return a resolved Promise with this value.
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ response: 'You can respond to a spell.' }),
    })

    const result = await askAgent('Can I respond to a spell?')

    expect(fetch).toHaveBeenCalledWith('/api/ask', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: 'Can I respond to a spell?' }),
    })
    expect(result).toBe('You can respond to a spell.')
  })

  it('throws when the response is not ok', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({ ok: false, status: 500 })

    // rejects.toThrow() asserts that the promise rejects with a matching error.
    await expect(askAgent('test')).rejects.toThrow('API error: 500')
  })
})

describe('trackUsage', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('fires a POST to /api/usage and returns undefined (fire-and-forget)', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({ ok: true })

    const result = trackUsage('2026-03-23T10:00:00Z')

    // trackUsage is fire-and-forget — it does NOT return a Promise.
    expect(result).toBeUndefined()

    // Wait one microtask tick for the internal async IIFE to fire.
    await new Promise(r => setTimeout(r, 0))

    expect(fetch).toHaveBeenCalledWith('/api/usage', expect.objectContaining({
      method: 'POST',
      body: JSON.stringify({ timestamp: '2026-03-23T10:00:00Z' }),
    }))
  })

  it('does not throw when fetch rejects', async () => {
    globalThis.fetch = vi.fn().mockRejectedValue(new Error('network error'))

    // This should not throw — errors are silently swallowed inside client.js.
    expect(() => trackUsage('2026-03-23T10:00:00Z')).not.toThrow()

    // Wait a tick and confirm no uncaught rejection either.
    await new Promise(r => setTimeout(r, 0))
  })
})
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
cd frontend && npm run test -- --run src/api/client.test.js
```
Expected: FAIL — `Cannot find module './client'`

- [ ] **Step 3: Create `src/api/client.js`**

Create `frontend/src/api/client.js`:
```js
// client.js — the single place where all HTTP calls to the backend live.
//
// Why centralise API calls here?
//   - If the backend URL or auth headers change, you update ONE file.
//   - Components and hooks never need to know about fetch(), JSON, or HTTP status codes.
//   - Easy to mock in tests — import this file and replace its exports with vi.spyOn().

// BASE_URL is empty in development because Vite's proxy rewrites /api/* for us.
// In production on the NAS, Authentik/Nginx handles routing — still no change needed.
const BASE_URL = ''

// ---------------------------------------------------------------------------
// askAgent — send a question to the MTG Judge agent
// ---------------------------------------------------------------------------

/**
 * POST /api/ask
 *
 * Sends the user's message to the LangGraph agent and returns the text response.
 *
 * @param {string} message - The user's rules question
 * @returns {Promise<string>} - The agent's answer
 * @throws {Error} - If the server returns a non-2xx status
 */
export async function askAgent(message) {
  const response = await fetch(`${BASE_URL}/api/ask`, {
    method: 'POST',
    // Content-Type: application/json tells the server we're sending JSON.
    // Without this header, FastAPI won't parse the body correctly.
    headers: { 'Content-Type': 'application/json' },
    // JSON.stringify() converts the JS object to a JSON string for the request body.
    body: JSON.stringify({ message }),
  })

  if (!response.ok) {
    // response.ok is true for 2xx status codes.
    // We throw here so callers can catch and handle errors in one place.
    throw new Error(`API error: ${response.status}`)
  }

  // response.json() parses the JSON response body into a JS object.
  const data = await response.json()
  return data.response
}

// ---------------------------------------------------------------------------
// trackUsage — fire-and-forget usage ping
// ---------------------------------------------------------------------------

/**
 * POST /api/usage
 *
 * Tracks that a user sent a message. This is "fire-and-forget":
 *   - We do NOT await it (the caller doesn't wait for it to finish)
 *   - Errors are caught and silently ignored inside this function
 *   - A broken usage ping must NEVER interrupt the user's chat experience
 *
 * NOTE: The /usage backend endpoint does not exist yet.
 * Once it's built, this function will start sending real data automatically.
 *
 * @param {string} timestamp - ISO 8601 string of when the user sent their message
 */
export function trackUsage(timestamp) {
  // We use an async IIFE (Immediately Invoked Function Expression) so we can
  // use async/await inside without making trackUsage itself return a Promise.
  // The semicolon before (async... prevents ASI (Automatic Semicolon Insertion)
  // issues if this file is ever minified.
  ;(async () => {
    try {
      await fetch(`${BASE_URL}/api/usage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ timestamp }),
      })
    } catch {
      // Silently swallow all errors.
      // Real failures will appear in server-side logs once the backend is built.
    }
  })()
  // trackUsage returns undefined — callers don't need to await or handle this.
}

// ---------------------------------------------------------------------------
// submitRequest — STUBBED, backend not yet implemented
// ---------------------------------------------------------------------------

/**
 * POST /api/requests
 *
 * STUBBED: This function is defined but NOT called yet.
 * The /requests backend endpoint does not exist.
 *
 * When the backend is ready:
 *   1. Remove the stub error below
 *   2. Uncomment the real fetch call
 *   3. Wire useRequests.js to call this function instead of its internal stub
 *
 * @param {{ title: string, description: string }} data
 * @returns {Promise<void>}
 */
export async function submitRequest(data) {
  // STUB: Remove this error and uncomment below when backend is ready.
  throw new Error('submitRequest: /api/requests backend not implemented yet')

  // const response = await fetch(`${BASE_URL}/api/requests`, {
  //   method: 'POST',
  //   headers: { 'Content-Type': 'application/json' },
  //   body: JSON.stringify(data),
  // })
  // if (!response.ok) throw new Error(`API error: ${response.status}`)
}
```

- [ ] **Step 4: Run tests to confirm they pass**

```bash
npm run test -- --run src/api/client.test.js
```
Expected: PASS — 4 tests passing.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/api/
git commit -m "feat: add API client with askAgent and fire-and-forget trackUsage"
```

---

## Task 3: useChat hook

**Files:**
- Create: `frontend/src/features/chat/useChat.js`
- Create: `frontend/src/features/chat/useChat.test.js`

- [ ] **Step 1: Write the failing tests**

Create `frontend/src/features/chat/useChat.test.js`:
```js
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
    vi.spyOn(client, 'askAgent').mockResolvedValue('The agent response')
    vi.spyOn(client, 'trackUsage').mockImplementation(() => {})

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
    vi.spyOn(client, 'askAgent').mockResolvedValue('Yes, during priority.')
    vi.spyOn(client, 'trackUsage').mockImplementation(() => {})

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
    vi.spyOn(client, 'trackUsage').mockImplementation(() => {})

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
    vi.spyOn(client, 'askAgent').mockResolvedValue('answer')
    vi.spyOn(client, 'trackUsage').mockImplementation(() => {})

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

  it('calls trackUsage with the pre-send timestamp', async () => {
    vi.spyOn(client, 'askAgent').mockResolvedValue('ok')
    const mockTrack = vi.spyOn(client, 'trackUsage').mockImplementation(() => {})

    const { result } = renderHook(() => useChat())
    const before = new Date().toISOString()

    await act(async () => {
      await result.current.sendMessage('test')
    })

    const after = new Date().toISOString()

    expect(mockTrack).toHaveBeenCalledOnce()
    const calledWith = mockTrack.mock.calls[0][0]
    // The timestamp should be between before and after
    expect(calledWith >= before).toBe(true)
    expect(calledWith <= after).toBe(true)
  })
})
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
npm run test -- --run src/features/chat/useChat.test.js
```
Expected: FAIL — `Cannot find module './useChat'`

- [ ] **Step 3: Create `src/features/chat/useChat.js`**

Create `frontend/src/features/chat/useChat.js`:
```js
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

      // Fire-and-forget usage tracking.
      // trackUsage does NOT return a Promise we need to await.
      // If it fails, the error is silently swallowed inside client.js.
      trackUsage(timestamp)

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
```

- [ ] **Step 4: Run tests to confirm they pass**

```bash
npm run test -- --run src/features/chat/useChat.test.js
```
Expected: PASS — 7 tests passing.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/features/chat/useChat.js frontend/src/features/chat/useChat.test.js
git commit -m "feat: add useChat hook with optimistic updates and error handling"
```

---

## Task 4: Message component

**Files:**
- Create: `frontend/src/features/chat/Message.jsx`
- Create: `frontend/src/features/chat/Message.test.jsx`

- [ ] **Step 1: Write the failing tests**

Create `frontend/src/features/chat/Message.test.jsx`:
```jsx
// Message.test.jsx
//
// render() mounts a React component into a virtual DOM.
// screen.getByText() finds elements by their text content.
// screen.queryByText() is like getByText but returns null instead of throwing.
// toHaveClass() checks that an element has a specific CSS class.

import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { Message } from './Message'

const TIMESTAMP = '2026-03-23T10:05:00.000Z'

describe('Message', () => {
  it('renders the message text', () => {
    render(<Message role="user" text="Hello there!" timestamp={TIMESTAMP} />)
    expect(screen.getByText('Hello there!')).toBeInTheDocument()
  })

  it('applies message--user class for user role', () => {
    const { container } = render(<Message role="user" text="hi" timestamp={TIMESTAMP} />)
    expect(container.firstChild).toHaveClass('message--user')
  })

  it('applies message--agent class for agent role', () => {
    const { container } = render(<Message role="agent" text="hi" timestamp={TIMESTAMP} />)
    expect(container.firstChild).toHaveClass('message--agent')
  })

  it('applies message--error class for error role', () => {
    const { container } = render(<Message role="error" text="oops" timestamp={TIMESTAMP} />)
    expect(container.firstChild).toHaveClass('message--error')
  })

  it('renders a formatted time (not raw ISO string)', () => {
    render(<Message role="user" text="hi" timestamp={TIMESTAMP} />)
    // The raw ISO string should not appear — it should be formatted
    expect(screen.queryByText(TIMESTAMP)).not.toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
npm run test -- --run src/features/chat/Message.test.jsx
```
Expected: FAIL — `Cannot find module './Message'`

- [ ] **Step 3: Create `src/features/chat/Message.jsx`**

Create `frontend/src/features/chat/Message.jsx`:
```jsx
// Message.jsx — renders a single chat message bubble.
//
// Props:
//   role      — "user" | "agent" | "error"
//   text      — the message content
//   timestamp — ISO 8601 string (e.g. "2026-03-23T10:00:00Z")
//
// The role prop drives both alignment (via CSS class) and meaning:
//   user  → right-aligned, the human's message
//   agent → left-aligned, the AI's response
//   error → highlighted, something went wrong

/**
 * @param {{ role: string, text: string, timestamp: string }} props
 */
export function Message({ role, text, timestamp }) {
  // Format the ISO timestamp into a short, readable time like "10:05 AM".
  // toLocaleTimeString uses the browser's locale settings automatically.
  const formattedTime = new Date(timestamp).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
  })

  // The CSS class is dynamic: message--user, message--agent, or message--error.
  // This drives all visual differences (alignment, colour) through CSS,
  // keeping the component logic clean and making restyling easy later.
  return (
    <div className={`message message--${role}`}>
      <p className="message__text">{text}</p>
      <span className="message__time">{formattedTime}</span>
    </div>
  )
}
```

- [ ] **Step 4: Run tests to confirm they pass**

```bash
npm run test -- --run src/features/chat/Message.test.jsx
```
Expected: PASS — 5 tests passing.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/features/chat/Message.jsx frontend/src/features/chat/Message.test.jsx
git commit -m "feat: add Message component with role-based CSS classes"
```

---

## Task 5: MessageList component

**Files:**
- Create: `frontend/src/features/chat/MessageList.jsx`
- Create: `frontend/src/features/chat/MessageList.test.jsx`

- [ ] **Step 1: Write the failing tests**

Create `frontend/src/features/chat/MessageList.test.jsx`:
```jsx
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MessageList } from './MessageList'

const MESSAGES = [
  { id: 1, role: 'user',  text: 'Hello',    timestamp: '2026-03-23T10:00:00Z' },
  { id: 2, role: 'agent', text: 'Hi there', timestamp: '2026-03-23T10:01:00Z' },
  { id: 3, role: 'error', text: 'Oops',     timestamp: '2026-03-23T10:02:00Z' },
]

describe('MessageList', () => {
  it('renders all messages', () => {
    render(<MessageList messages={MESSAGES} />)
    expect(screen.getByText('Hello')).toBeInTheDocument()
    expect(screen.getByText('Hi there')).toBeInTheDocument()
    expect(screen.getByText('Oops')).toBeInTheDocument()
  })

  it('renders without crashing when messages is empty', () => {
    const { container } = render(<MessageList messages={[]} />)
    expect(container.firstChild).toBeInTheDocument()
  })

  it('renders messages in order', () => {
    render(<MessageList messages={MESSAGES} />)
    const texts = screen.getAllByRole('paragraph').map(el => el.textContent)
    expect(texts[0]).toBe('Hello')
    expect(texts[1]).toBe('Hi there')
  })
})
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
npm run test -- --run src/features/chat/MessageList.test.jsx
```
Expected: FAIL — `Cannot find module './MessageList'`

- [ ] **Step 3: Create `src/features/chat/MessageList.jsx`**

Create `frontend/src/features/chat/MessageList.jsx`:
```jsx
// MessageList.jsx — the scrollable container for all chat messages.
//
// Props:
//   messages — array of { id, role, text, timestamp }
//
// Auto-scroll behaviour:
//   We scroll to the bottom when a new message arrives, BUT only
//   if the user is already within 100px of the bottom.
//   This way we don't yank users back down if they're scrolling up
//   to re-read an earlier response.

import { useEffect, useRef } from 'react'
import { Message } from './Message'

/**
 * @param {{ messages: Array<{id: number, role: string, text: string, timestamp: string}> }} props
 */
export function MessageList({ messages }) {
  // useRef holds a reference to the scrollable <div> DOM element.
  // We use it to read scrollTop/scrollHeight for the auto-scroll logic.
  const listRef = useRef(null)

  // bottomRef is attached to an invisible <div> at the end of the list.
  // We call scrollIntoView() on it to scroll to the bottom.
  const bottomRef = useRef(null)

  useEffect(() => {
    // This effect runs every time the messages array changes.
    const list = listRef.current
    if (!list) return

    // Calculate how far the user is from the bottom of the scroll container:
    //   scrollTop    — pixels scrolled from the top
    //   scrollHeight — total height of scrollable content (including overflow)
    //   clientHeight — visible height of the container
    //
    //   distanceFromBottom = scrollHeight - scrollTop - clientHeight
    //   When distanceFromBottom = 0, the user is exactly at the bottom.
    const distanceFromBottom = list.scrollHeight - list.scrollTop - list.clientHeight

    // Only auto-scroll if the user is within 100px of the bottom.
    // If they've scrolled up to read earlier messages, we respect that.
    if (distanceFromBottom <= 100) {
      // scrollIntoView({ behavior: 'smooth' }) animates the scroll.
      // The ?. is optional chaining — safe if bottomRef.current is null.
      bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
    }
  }, [messages]) // Re-run whenever messages changes (new message added)

  return (
    <div className="message-list" ref={listRef}>
      {/* Map each message to a Message component.
          key={msg.id} is required by React to efficiently update the list.
          Using the message's unique ID as the key is correct — don't use index. */}
      {messages.map(msg => (
        <Message
          key={msg.id}
          role={msg.role}
          text={msg.text}
          timestamp={msg.timestamp}
        />
      ))}

      {/* Invisible sentinel element. We scroll to this when auto-scrolling.
          It's always at the bottom of the list. */}
      <div ref={bottomRef} aria-hidden="true" />
    </div>
  )
}
```

- [ ] **Step 4: Run tests to confirm they pass**

```bash
npm run test -- --run src/features/chat/MessageList.test.jsx
```
Expected: PASS — 3 tests passing.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/features/chat/MessageList.jsx frontend/src/features/chat/MessageList.test.jsx
git commit -m "feat: add MessageList with smart auto-scroll"
```

---

## Task 6: InputBar component

**Files:**
- Create: `frontend/src/features/chat/InputBar.jsx`
- Create: `frontend/src/features/chat/InputBar.test.jsx`

- [ ] **Step 1: Write the failing tests**

Create `frontend/src/features/chat/InputBar.test.jsx`:
```jsx
// InputBar.test.jsx
//
// userEvent from @testing-library/user-event simulates real user interactions
// (typing, clicking, pressing Enter). It's more realistic than fireEvent.

import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { InputBar } from './InputBar'

describe('InputBar', () => {
  it('calls onSend with the trimmed input text when Send is clicked', async () => {
    const onSend = vi.fn()
    render(<InputBar onSend={onSend} isLoading={false} />)

    await userEvent.type(screen.getByRole('textbox'), 'What is trample?')
    await userEvent.click(screen.getByRole('button', { name: /send/i }))

    expect(onSend).toHaveBeenCalledWith('What is trample?')
  })

  it('calls onSend when Enter key is pressed', async () => {
    const onSend = vi.fn()
    render(<InputBar onSend={onSend} isLoading={false} />)

    await userEvent.type(screen.getByRole('textbox'), 'test message{Enter}')

    expect(onSend).toHaveBeenCalledWith('test message')
  })

  it('clears the input after sending', async () => {
    render(<InputBar onSend={vi.fn()} isLoading={false} />)
    const input = screen.getByRole('textbox')

    await userEvent.type(input, 'Hello')
    await userEvent.click(screen.getByRole('button', { name: /send/i }))

    expect(input).toHaveValue('')
  })

  it('disables the input and button when isLoading is true', () => {
    render(<InputBar onSend={vi.fn()} isLoading={true} />)

    expect(screen.getByRole('textbox')).toBeDisabled()
    expect(screen.getByRole('button')).toBeDisabled()
  })

  it('shows "Thinking..." button text when isLoading is true', () => {
    render(<InputBar onSend={vi.fn()} isLoading={true} />)
    expect(screen.getByRole('button')).toHaveTextContent('Thinking...')
  })

  it('disables the send button when input is empty', () => {
    render(<InputBar onSend={vi.fn()} isLoading={false} />)
    // Input starts empty — button should be disabled
    expect(screen.getByRole('button', { name: /send/i })).toBeDisabled()
  })

  it('does not call onSend for whitespace-only input', async () => {
    const onSend = vi.fn()
    render(<InputBar onSend={onSend} isLoading={false} />)

    await userEvent.type(screen.getByRole('textbox'), '   {Enter}')

    expect(onSend).not.toHaveBeenCalled()
  })
})
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
npm run test -- --run src/features/chat/InputBar.test.jsx
```
Expected: FAIL — `Cannot find module './InputBar'`

- [ ] **Step 3: Create `src/features/chat/InputBar.jsx`**

Create `frontend/src/features/chat/InputBar.jsx`:
```jsx
// InputBar.jsx — the text input and Send button at the bottom of the chat.
//
// Props:
//   onSend    — called with the message text when the user submits
//   isLoading — true while waiting for the agent response
//
// Why is inputText local state here instead of in useChat?
//   What the user is currently typing is only relevant to this component.
//   Lifting it up to useChat would couple two unrelated concerns.
//   Keep state as local as possible — only lift it up when other components need it.

import { useState } from 'react'

/**
 * @param {{ onSend: (text: string) => void, isLoading: boolean }} props
 */
export function InputBar({ onSend, isLoading }) {
  // inputText is the controlled value of the <input> element.
  // "Controlled" means React owns the value — the input always reflects this state.
  const [inputText, setInputText] = useState('')

  function handleSubmit(e) {
    // Prevent the browser's default form submit behaviour (which would reload the page).
    e.preventDefault()

    const trimmed = inputText.trim()

    // Guard: don't send blank messages.
    // The button is also disabled for this case, but a double-check here is harmless.
    if (!trimmed) return

    onSend(trimmed)    // Pass the text up to the parent (useChat via ChatWindow)
    setInputText('')   // Clear the input field after sending
  }

  return (
    // Using <form> + onSubmit means both button clicks AND the Enter key trigger handleSubmit.
    // This is standard HTML behaviour — no extra key listener needed.
    <form className="input-bar" onSubmit={handleSubmit}>
      <input
        className="input-bar__input"
        type="text"
        value={inputText}
        onChange={e => setInputText(e.target.value)}
        placeholder="Ask a rules question..."
        disabled={isLoading}
        aria-label="Message input"
      />
      <button
        className="input-bar__button"
        type="submit"
        // Disabled when loading (waiting for response) OR when input is blank.
        disabled={isLoading || !inputText.trim()}
        aria-label="Send message"
      >
        {/* Show "Thinking..." while loading, "Send" otherwise */}
        {isLoading ? 'Thinking...' : 'Send'}
      </button>
    </form>
  )
}
```

- [ ] **Step 4: Run tests to confirm they pass**

```bash
npm run test -- --run src/features/chat/InputBar.test.jsx
```
Expected: PASS — 7 tests passing.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/features/chat/InputBar.jsx frontend/src/features/chat/InputBar.test.jsx
git commit -m "feat: add InputBar with loading state and form submit"
```

---

## Task 7: ChatWindow component

**Files:**
- Create: `frontend/src/features/chat/ChatWindow.jsx`
- Create: `frontend/src/features/chat/ChatWindow.test.jsx`

- [ ] **Step 1: Write the failing tests**

Create `frontend/src/features/chat/ChatWindow.test.jsx`:
```jsx
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ChatWindow } from './ChatWindow'
import * as client from '../../api/client'

describe('ChatWindow', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('renders the MTG Judge header', () => {
    render(<ChatWindow />)
    expect(screen.getByRole('heading', { name: /MTG Judge/i })).toBeInTheDocument()
  })

  it('renders the message input', () => {
    render(<ChatWindow />)
    expect(screen.getByRole('textbox')).toBeInTheDocument()
  })

  it('shows user message in the chat after submitting', async () => {
    vi.spyOn(client, 'askAgent').mockResolvedValue('You can respond.')
    vi.spyOn(client, 'trackUsage').mockImplementation(() => {})

    render(<ChatWindow />)

    await userEvent.type(screen.getByRole('textbox'), 'Can I cast a spell?')
    await userEvent.click(screen.getByRole('button', { name: /send/i }))

    expect(screen.getByText('Can I cast a spell?')).toBeInTheDocument()
  })

  it('shows agent response after the API resolves', async () => {
    vi.spyOn(client, 'askAgent').mockResolvedValue('Yes, you can.')
    vi.spyOn(client, 'trackUsage').mockImplementation(() => {})

    render(<ChatWindow />)

    await userEvent.type(screen.getByRole('textbox'), 'Can I cast?')
    await userEvent.click(screen.getByRole('button', { name: /send/i }))

    expect(screen.getByText('Yes, you can.')).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
npm run test -- --run src/features/chat/ChatWindow.test.jsx
```
Expected: FAIL — `Cannot find module './ChatWindow'`

- [ ] **Step 3: Create `src/features/chat/ChatWindow.jsx`**

Create `frontend/src/features/chat/ChatWindow.jsx`:
```jsx
// ChatWindow.jsx — the main chat container.
//
// This is a "container component" — it wires together the hook and the
// presentational components, but owns no state or logic itself.
//
// Pattern: "smart container + dumb components"
//   - useChat (smart): owns state, talks to the API
//   - MessageList, InputBar (dumb): receive props, render UI
//   - ChatWindow (connector): calls the hook, passes props down
//
// This separation makes each piece independently testable and replaceable.

import { useChat } from './useChat'
import { MessageList } from './MessageList'
import { InputBar } from './InputBar'

export function ChatWindow() {
  // Destructure exactly what we need from the hook.
  // useChat encapsulates everything — this component doesn't need to know
  // how messages are stored or how the API is called.
  const { messages, isLoading, sendMessage } = useChat()

  return (
    <div className="chat-window">
      <header className="chat-window__header">
        <h1>MTG Judge</h1>
        <p>Ask rules questions about Magic: The Gathering</p>
      </header>

      {/* MessageList renders the conversation history */}
      <MessageList messages={messages} />

      {/* InputBar handles user input — sendMessage is passed as the onSend callback */}
      <InputBar onSend={sendMessage} isLoading={isLoading} />
    </div>
  )
}
```

- [ ] **Step 4: Run tests to confirm they pass**

```bash
npm run test -- --run src/features/chat/ChatWindow.test.jsx
```
Expected: PASS — 4 tests passing.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/features/chat/ChatWindow.jsx frontend/src/features/chat/ChatWindow.test.jsx
git commit -m "feat: add ChatWindow connecting useChat, MessageList, and InputBar"
```

---

## Task 8: useRequests hook (stubbed)

**Files:**
- Create: `frontend/src/features/requests/useRequests.js`
- Create: `frontend/src/features/requests/useRequests.test.js`

- [ ] **Step 1: Write the failing tests**

Create `frontend/src/features/requests/useRequests.test.js`:
```js
import { describe, it, expect } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useRequests } from './useRequests'

describe('useRequests', () => {
  it('starts with all state false', () => {
    const { result } = renderHook(() => useRequests())
    expect(result.current.isSubmitting).toBe(false)
    expect(result.current.submitted).toBe(false)
    expect(result.current.error).toBe(false)
  })

  it('sets submitted to true after stubbed submit completes', async () => {
    const { result } = renderHook(() => useRequests())

    await act(async () => {
      await result.current.submit({ title: 'Dark mode', description: 'Please add it' })
    })

    expect(result.current.submitted).toBe(true)
    expect(result.current.isSubmitting).toBe(false)
    expect(result.current.error).toBe(false)
  })
})
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
npm run test -- --run src/features/requests/useRequests.test.js
```
Expected: FAIL — `Cannot find module './useRequests'`

- [ ] **Step 3: Create `src/features/requests/useRequests.js`**

Create `frontend/src/features/requests/useRequests.js`:
```js
// useRequests.js — manages feature request form state.
//
// STUBBED: The /requests backend endpoint does not exist yet.
//
// What "stubbed" means here:
//   submit() simulates a successful API call (waits 500ms, then sets submitted=true).
//   This lets the full UI work end-to-end during development without a real backend.
//
// When the backend is ready:
//   1. Import submitRequest from '../../api/client'
//   2. Replace the stub block in submit() with: await submitRequest({ title, description })
//   3. Remove the console.log and fake timeout
//   4. The rest of the hook stays the same

import { useState } from 'react'

/**
 * useRequests — manages feature request form state.
 *
 * Returns:
 *   submit      — async function to submit { title, description }
 *   isSubmitting — true while the submit is in-flight
 *   submitted   — true after a successful submit
 *   error       — true if the submit failed
 */
export function useRequests() {
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitted, setSubmitted]       = useState(false)
  const [error, setError]               = useState(false)

  /**
   * Submit a feature request.
   * Currently stubbed — replace with real API call when backend is ready.
   *
   * @param {{ title: string, description: string }} data
   */
  async function submit({ title, description }) {
    setIsSubmitting(true)
    setError(false)

    try {
      // -------------------------------------------------------
      // STUB — remove this block when /api/requests is built
      console.log('[useRequests] Stub: feature request received:', { title, description })
      await new Promise(resolve => setTimeout(resolve, 500))
      // -------------------------------------------------------

      // REAL API CALL — uncomment when backend is ready:
      // import { submitRequest } from '../../api/client'
      // await submitRequest({ title, description })

      setSubmitted(true)

    } catch {
      // On real API failure, set error so RequestForm can show the error message.
      // submitted stays false so the user can try again.
      setError(true)
    } finally {
      setIsSubmitting(false)
    }
  }

  return { submit, isSubmitting, submitted, error }
}
```

- [ ] **Step 4: Run tests to confirm they pass**

```bash
npm run test -- --run src/features/requests/useRequests.test.js
```
Expected: PASS — 2 tests passing.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/features/requests/useRequests.js frontend/src/features/requests/useRequests.test.js
git commit -m "feat: add useRequests hook (stubbed until /requests backend is ready)"
```

---

## Task 9: RequestForm component

**Files:**
- Create: `frontend/src/features/requests/RequestForm.jsx`
- Create: `frontend/src/features/requests/RequestForm.test.jsx`

- [ ] **Step 1: Write the failing tests**

Create `frontend/src/features/requests/RequestForm.test.jsx`:
```jsx
// RequestForm.test.jsx
//
// waitFor() retries the assertion until it passes or times out.
// We use it for async state changes (like the success message appearing
// after the 500ms stub delay).

import { describe, it, expect, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { RequestForm } from './RequestForm'

describe('RequestForm', () => {
  it('renders title and description fields', () => {
    render(<RequestForm onClose={vi.fn()} />)
    expect(screen.getByLabelText('Title')).toBeInTheDocument()
    expect(screen.getByLabelText('Description')).toBeInTheDocument()
  })

  it('renders a Close button', () => {
    render(<RequestForm onClose={vi.fn()} />)
    expect(screen.getByRole('button', { name: /close/i })).toBeInTheDocument()
  })

  it('calls onClose when Close is clicked', async () => {
    const onClose = vi.fn()
    render(<RequestForm onClose={onClose} />)
    await userEvent.click(screen.getByRole('button', { name: /close/i }))
    expect(onClose).toHaveBeenCalled()
  })

  it('shows success message after form is submitted', async () => {
    render(<RequestForm onClose={vi.fn()} />)

    await userEvent.type(screen.getByLabelText('Title'), 'Dark mode')
    await userEvent.type(screen.getByLabelText('Description'), 'Please add it')
    await userEvent.click(screen.getByRole('button', { name: /^submit$/i }))

    await waitFor(() => {
      expect(screen.getByText('Request submitted! Thank you.')).toBeInTheDocument()
    })
  })
})
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
npm run test -- --run src/features/requests/RequestForm.test.jsx
```
Expected: FAIL — `Cannot find module './RequestForm'`

- [ ] **Step 3: Create `src/features/requests/RequestForm.jsx`**

Create `frontend/src/features/requests/RequestForm.jsx`:
```jsx
// RequestForm.jsx — form for submitting feature requests.
//
// Props:
//   onClose — called when the form should close
//
// This component is currently wired to a stubbed submit function.
// The full UI works: you can fill in the form and see a success message.
// It just doesn't reach a real backend yet.
//
// Note on unmounting vs hiding:
//   App.jsx conditionally renders this component (not just hides it with CSS).
//   When isRequestFormOpen becomes false, React unmounts this component entirely.
//   That means React automatically discards all local state (title, description).
//   When it reopens, it mounts fresh — no manual reset needed.

import { useEffect, useState } from 'react'
import { useRequests } from './useRequests'

/**
 * @param {{ onClose: () => void }} props
 */
export function RequestForm({ onClose }) {
  const { submit, isSubmitting, submitted, error } = useRequests()

  // These are controlled inputs — React owns their values.
  const [title, setTitle]           = useState('')
  const [description, setDescription] = useState('')

  // Auto-close after 1500ms once submitted successfully.
  // useEffect with [submitted, onClose] runs whenever submitted or onClose changes.
  useEffect(() => {
    if (!submitted) return

    // setTimeout returns a timer ID we can use to cancel it.
    const timer = setTimeout(onClose, 1500)

    // The cleanup function runs if the component unmounts before the timer fires.
    // Without this, calling onClose on an unmounted component would cause a React warning.
    return () => clearTimeout(timer)
  }, [submitted, onClose])

  function handleSubmit(e) {
    e.preventDefault()
    submit({ title, description })
  }

  return (
    // Overlay: covers the screen behind the form
    <div className="request-form-overlay">
      <div className="request-form">
        <h2>Submit a Feature Request</h2>

        {submitted ? (
          // Show this instead of the form once submitted.
          // The component will auto-close after 1500ms (see useEffect above).
          <p className="request-form__success">Request submitted! Thank you.</p>
        ) : (
          <form onSubmit={handleSubmit}>
            {/* htmlFor on <label> and id on <input> must match.
                This links them so clicking the label focuses the input,
                and screen readers know which label describes which input. */}
            <label htmlFor="req-title">Title</label>
            <input
              id="req-title"
              type="text"
              value={title}
              onChange={e => setTitle(e.target.value)}
              required
              disabled={isSubmitting}
            />

            <label htmlFor="req-description">Description</label>
            <textarea
              id="req-description"
              value={description}
              onChange={e => setDescription(e.target.value)}
              required
              disabled={isSubmitting}
            />

            <button type="submit" disabled={isSubmitting}>
              {isSubmitting ? 'Submitting...' : 'Submit'}
            </button>

            {/* Error message — only rendered when error is true.
                Lives below the submit button as specified in the design. */}
            {error && (
              <p className="request-form__error">Failed to submit. Please try again.</p>
            )}
          </form>
        )}

        <button className="request-form__close" onClick={onClose}>
          Close
        </button>
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Run tests to confirm they pass**

```bash
npm run test -- --run src/features/requests/RequestForm.test.jsx
```
Expected: PASS — 4 tests passing.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/features/requests/RequestForm.jsx frontend/src/features/requests/RequestForm.test.jsx
git commit -m "feat: add RequestForm with stubbed submit and auto-close on success"
```

---

## Task 10: App.jsx

**Files:**
- Create: `frontend/src/App.jsx` (replace Vite's default)
- Create: `frontend/src/App.test.jsx`
- Create: `frontend/src/App.css` (stub)

- [ ] **Step 1: Write the failing tests**

Create `frontend/src/App.test.jsx`:
```jsx
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import App from './App'
import * as client from './api/client'

describe('App', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    // Stub client calls so App tests don't make real network requests
    vi.spyOn(client, 'askAgent').mockResolvedValue('ok')
    vi.spyOn(client, 'trackUsage').mockImplementation(() => {})
  })

  it('renders the chat window', () => {
    render(<App />)
    expect(screen.getByRole('heading', { name: /MTG Judge/i })).toBeInTheDocument()
  })

  it('renders the Submit Feature Request button', () => {
    render(<App />)
    expect(screen.getByRole('button', { name: /submit feature request/i })).toBeInTheDocument()
  })

  it('shows the RequestForm when Submit Feature Request is clicked', async () => {
    render(<App />)
    await userEvent.click(screen.getByRole('button', { name: /submit feature request/i }))
    expect(screen.getByText('Submit a Feature Request')).toBeInTheDocument()
  })

  it('hides the RequestForm when Close is clicked', async () => {
    render(<App />)
    await userEvent.click(screen.getByRole('button', { name: /submit feature request/i }))
    await userEvent.click(screen.getByRole('button', { name: /close/i }))
    expect(screen.queryByText('Submit a Feature Request')).not.toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
npm run test -- --run src/App.test.jsx
```
Expected: FAIL (App.jsx has Vite's default content, not our components)

- [ ] **Step 3: Replace `src/App.jsx`**

Overwrite `frontend/src/App.jsx`:
```jsx
// App.jsx — the root of the React component tree.
//
// This is the top-level component that everything else lives inside.
// It's intentionally minimal: structural layout only, no business logic.
//
// Responsibilities:
//   1. Render the main chat interface (ChatWindow)
//   2. Own the open/closed state for the feature request form
//   3. Conditionally render RequestForm when open

import { useState } from 'react'
import { ChatWindow } from './features/chat/ChatWindow'
import { RequestForm } from './features/requests/RequestForm'
import './App.css'

export default function App() {
  // isRequestFormOpen controls whether the RequestForm is visible.
  // false = form is not in the DOM at all (unmounted, not just hidden).
  // This means every time it opens, it's a fresh component with reset state.
  const [isRequestFormOpen, setIsRequestFormOpen] = useState(false)

  return (
    <div className="app">
      {/* The main chat interface — always visible */}
      <ChatWindow />

      {/* Button to open the feature request form */}
      <button
        className="app__request-button"
        onClick={() => setIsRequestFormOpen(true)}
      >
        Submit Feature Request
      </button>

      {/* Conditionally render the form.
          When isRequestFormOpen is false, this component is fully unmounted —
          React discards it from the DOM and its state resets automatically.
          {condition && <Component />} is React's idiomatic conditional render. */}
      {isRequestFormOpen && (
        <RequestForm onClose={() => setIsRequestFormOpen(false)} />
      )}
    </div>
  )
}
```

- [ ] **Step 4: Create stub `src/App.css`**

Replace `frontend/src/App.css` with a stub:
```css
/* App.css — top-level layout styles.
   Styling is minimal for now — functionality first.
   Replace this with real styles when you're ready to polish the UI. */

.app {
  display: flex;
  flex-direction: column;
  height: 100vh;
  max-width: 800px;
  margin: 0 auto;
  padding: 1rem;
}

.app__request-button {
  margin-top: 0.5rem;
  align-self: flex-end;
}
```

- [ ] **Step 5: Run tests to confirm they pass**

```bash
npm run test -- --run src/App.test.jsx
```
Expected: PASS — 4 tests passing.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/App.jsx frontend/src/App.css frontend/src/App.test.jsx
git commit -m "feat: add App root component with feature request form toggle"
```

---

## Task 11: Entry point and global CSS stubs

**Files:**
- Modify: `frontend/index.html`
- Modify: `frontend/src/main.jsx`
- Create: `frontend/src/index.css`

- [ ] **Step 1: Update `index.html`**

Replace `frontend/index.html` with:
```html
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>MTG Judge</title>
  </head>
  <body>
    <!--
      React mounts everything into this div.
      ReactDOM.createRoot(document.getElementById('root')) in main.jsx
      finds this element and takes control of its contents.
    -->
    <div id="root"></div>

    <!--
      Vite injects the compiled JS bundle here automatically during build.
      The type="module" tells the browser this is an ES module (modern JS).
    -->
    <script type="module" src="/src/main.jsx"></script>
  </body>
</html>
```

- [ ] **Step 2: Update `src/main.jsx`**

Replace `frontend/src/main.jsx` with:
```jsx
// main.jsx — the entry point for the React application.
//
// This file is the bridge between index.html and your React code.
// Vite compiles everything starting from this file.

import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './index.css'

// ReactDOM.createRoot() creates a React "root" — a managed DOM subtree.
// We pass it the #root div from index.html.
// Everything React renders goes inside that div.
ReactDOM.createRoot(document.getElementById('root')).render(
  // StrictMode is a development-only tool.
  // It intentionally renders components twice to catch side effects
  // that should not happen during rendering (like direct DOM mutations).
  // It has ZERO effect on production builds.
  <React.StrictMode>
    <App />
  </React.StrictMode>
)
```

- [ ] **Step 3: Create stub `src/index.css`**

Replace `frontend/src/index.css` with a stub:
```css
/* index.css — global base styles.
   These apply to the entire page.
   Styling is minimal for now — functionality first. */

*, *::before, *::after {
  box-sizing: border-box;
  margin: 0;
  padding: 0;
}

body {
  font-family: system-ui, sans-serif;
  background: #fff;
  color: #111;
}

/* Placeholder classes used by components — add real styles later */
.chat-window         { display: flex; flex-direction: column; flex: 1; }
.chat-window__header { padding: 0.5rem 0; border-bottom: 1px solid #ddd; }
.message-list        { flex: 1; overflow-y: auto; padding: 1rem 0; }
.message             { margin-bottom: 0.75rem; }
.message--user       { text-align: right; }
.message--agent      { text-align: left; }
.message--error      { color: red; }
.message__time       { font-size: 0.75rem; color: #888; display: block; }
.input-bar           { display: flex; gap: 0.5rem; padding: 0.5rem 0; }
.input-bar__input    { flex: 1; padding: 0.5rem; }
.request-form-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.4); display: flex; align-items: center; justify-content: center; }
.request-form        { background: white; padding: 2rem; border-radius: 8px; min-width: 400px; display: flex; flex-direction: column; gap: 0.75rem; }
.request-form__error  { color: red; }
.request-form__success { color: green; }
```

- [ ] **Step 4: Run all tests**

```bash
npm run test -- --run
```
Expected: ALL PASS — all test files green.

- [ ] **Step 5: Verify the dev server works end-to-end**

In one terminal, start the FastAPI backend:
```bash
cd /c/Users/agper/codeStuff/mtgJudge
uvicorn api.main:app --reload
```

In another terminal, start the Vite dev server:
```bash
cd frontend
npm run dev
```

Open `http://localhost:5173` in a browser. You should see:
- The MTG Judge header
- An empty chat area
- An input bar at the bottom
- A "Submit Feature Request" button

Type a rules question and press Send. The message should appear and "Thinking..." should show while waiting for the response.

- [ ] **Step 6: Commit**

```bash
git add frontend/index.html frontend/src/main.jsx frontend/src/index.css
git commit -m "feat: add entry point and minimal stub CSS to complete MTG Judge frontend"
```

---

## Final verification

- [ ] Run the full test suite one last time:
  ```bash
  cd frontend && npm run test -- --run
  ```
  Expected: All tests pass, zero failures.

- [ ] Check that the proxy is working: with both servers running, open the browser's DevTools Network tab and confirm that the POST to `/api/ask` returns a 200 (not a CORS error or 404).
