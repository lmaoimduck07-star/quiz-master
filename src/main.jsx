import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import { storageV2 } from './utils/storageV2.js'

// Khởi chạy ngầm DB Migration sang cấu trúc NoSQL mới (Subcollections)
storageV2.runMigrationOnce().catch(console.error);

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
