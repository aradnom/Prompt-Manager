import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { ActiveStackProvider } from './contexts/ActiveStackContext'
import { TypesProvider } from './contexts/TypesContext'
import { ErrorProvider } from './contexts/ErrorContext'
import { Layout } from './components/Layout'
import Home from './pages/Home'
import Stacks from './pages/Stacks'
import Blocks from './pages/Blocks'
import Wildcards from './pages/Wildcards'
import DeveloperSettings from './pages/DeveloperSettings'

function App() {
  return (
    <BrowserRouter>
      <ErrorProvider>
        <TypesProvider>
          <ActiveStackProvider>
            <Layout>
              <Routes>
                <Route path="/" element={<Home />} />
                <Route path="/stacks" element={<Stacks />} />
                <Route path="/blocks" element={<Blocks />} />
                <Route path="/wildcards" element={<Wildcards />} />
                <Route path="/developer-settings" element={<DeveloperSettings />} />
              </Routes>
            </Layout>
          </ActiveStackProvider>
        </TypesProvider>
      </ErrorProvider>
    </BrowserRouter>
  )
}

export default App
