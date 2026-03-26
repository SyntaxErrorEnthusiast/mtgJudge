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

// jsdom does not implement scrollIntoView — it is a layout API that only
// exists in real browsers. Any component that calls scrollIntoView() will
// throw in tests unless we provide a no-op stub here.
window.HTMLElement.prototype.scrollIntoView = function () {}
