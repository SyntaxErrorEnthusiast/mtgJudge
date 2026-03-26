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
