import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import { ensureSeeded } from './utils/storage.js'

// Đảm bảo data mặc định được seed lên Firestore
ensureSeeded();

// Initialize Theme
if (localStorage.getItem('qm_theme') === 'dark' || 
    (!localStorage.getItem('qm_theme') && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
  document.documentElement.classList.add('dark');
} else {
  document.documentElement.classList.remove('dark');
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
