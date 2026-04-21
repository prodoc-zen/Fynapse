import { Navigate, Route, Routes } from 'react-router-dom'
import Dashboard from './test.jsx'

function NotFoundPage() {
  return <Navigate to="/" replace />
}

function App() {
  return (
    <Routes>
      <Route path="/" element={<Dashboard />} />
      <Route path="/test" element={<Navigate to="/" replace />} />
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  )
}

export default App
