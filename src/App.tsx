import { NavLink, Route, Routes } from 'react-router-dom';
import { ApiKeyModalProvider } from './contexts/ApiKeyModalContext';
import { JobNimbusDataProvider } from './contexts/JobNimbusDataContext';
import { ApiKeyModal } from './components/ApiKeyModal';
import HomePage from './pages/HomePage';
import SalesKpisPage from './pages/SalesKpisPage';

function App() {
  return (
    <ApiKeyModalProvider>
      <JobNimbusDataProvider>
        <div className="min-h-screen flex flex-col bg-slate-50">
          <ApiKeyModal />

          <header className="flex items-center justify-between px-6 py-3 bg-slate-900 text-slate-50 shadow">
            <NavLink
              to="/"
              end
              className="text-base font-semibold tracking-[0.2em] uppercase"
            >
              ahitool
            </NavLink>
            <nav className="flex gap-3">
              <NavLink
                to="/sales-kpis"
                className={({ isActive }: { isActive: boolean }) =>
                  isActive ? 'nav-link nav-link-active' : 'nav-link'
                }
              >
                Sales KPIs
              </NavLink>
            </nav>
          </header>

          <main className="flex-1 max-w-3xl w-full mx-auto my-8 mb-12 px-6">
            <Routes>
              <Route path="/" element={<HomePage />} />
              <Route path="/sales-kpis" element={<SalesKpisPage />} />
            </Routes>
          </main>
        </div>
      </JobNimbusDataProvider>
    </ApiKeyModalProvider>
  );
}

export default App;
