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
    // Bootstrap card gives us the bordered, rounded container.
    // flex-grow-1   — expand to fill remaining height in the App flex column
    // d-flex flex-column — stack header / message list / input bar vertically
    // overflow-hidden — clip any overflow so the inner scroll works correctly
    <div className="card flex-grow-1 d-flex flex-column overflow-hidden">
      {/* card-header styles the top strip.
          border-warning adds the gold accent line under the header. */}
      <div className="card-header border-warning">
        {/* text-warning is Bootstrap's amber/gold colour — fits the MTG theme.
            fw-bold makes it heavy; mb-0 removes the default h5 bottom margin. */}
        <h5 className="mb-0 fw-bold text-warning">⚔ MTG Judge</h5>
        <p className="mb-0 mt-1 small text-secondary">
          Ask rules questions about Magic: The Gathering
        </p>
      </div>

      {/* MessageList renders the conversation history */}
      <MessageList messages={messages} />

      {/* InputBar handles user input — sendMessage is passed as the onSend callback */}
      <InputBar onSend={sendMessage} isLoading={isLoading} />
    </div>
  )
}
