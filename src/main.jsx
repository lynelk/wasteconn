import React from 'react'
import ReactDOM from 'react-dom/client'
import App from '@/App.jsx'
import '@/index.css'
import { initErrorReporter } from '@/lib/errorReporter'

initErrorReporter()

ReactDOM.createRoot(document.getElementById('root')).render(
  <App />
)
