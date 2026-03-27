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
    // message-list handles overflow-y scroll and flex layout (see index.css).
    // flex-grow-1 (Bootstrap) makes it expand to fill the card's remaining space
    // between the header and the input bar.
    <div className="message-list flex-grow-1" ref={listRef}>
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
