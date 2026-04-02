import { useState } from 'react'
import { Routes, Route, NavLink } from 'react-router-dom'
import { ChatWindow } from './features/chat/ChatWindow'
import { RulesPage } from './features/rules/RulesPage'
import { RequestForm } from './features/requests/RequestForm'
import './App.css'

export default function App() {
  const [isRequestFormOpen, setIsRequestFormOpen] = useState(false)

  return (
    <div className="app d-flex flex-column vh-100 mx-auto px-3 py-3 gap-2">
      {/* Nav tabs */}
      <nav className="app-nav d-flex gap-2">
        <NavLink
          to="/"
          end
          className={({ isActive }) =>
            `app-nav__tab btn btn-sm ${isActive ? 'btn-warning' : 'btn-outline-secondary'}`
          }
        >
          Chat
        </NavLink>
        <NavLink
          to="/rules"
          className={({ isActive }) =>
            `app-nav__tab btn btn-sm ${isActive ? 'btn-warning' : 'btn-outline-secondary'}`
          }
        >
          Rules
        </NavLink>
      </nav>

      <Routes>
        <Route path="/" element={<ChatWindow />} />
        <Route path="/rules" element={<RulesPage />} />
      </Routes>

      <button
        className="btn btn-outline-secondary btn-sm align-self-end"
        onClick={() => setIsRequestFormOpen(true)}
      >
        Submit Feature Request
      </button>

      {isRequestFormOpen && (
        <RequestForm onClose={() => setIsRequestFormOpen(false)} />
      )}
    </div>
  )
}
