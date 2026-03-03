import './App.css'
import { NavLink, Route, Routes } from 'react-router-dom'
import HomePage from './pages/HomePage'
import SalesKpisPage from './pages/SalesKpisPage'

function App() {

  return (
    <div className="app">
      <header className="navbar">
        <NavLink
          to="/"
          end
          className="navbar-brand"
        >
          ahitool
        </NavLink>
        <nav className="navbar-links">
          <NavLink
            to="/sales-kpis"
            className={({ isActive }: { isActive: boolean }) =>
              `nav-link ${isActive ? 'active' : ''}`
            }
          >
            Sales KPIs
          </NavLink>
        </nav>
      </header>

      <main className="main-content">
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/sales-kpis" element={<SalesKpisPage />} />
        </Routes>
      </main>
    </div>
  )
}

export default App
