import { BrowserRouter, Routes, Route } from "react-router-dom";
import { SessionProvider } from "./contexts/SessionContext";
import { UserStateProvider } from "./contexts/UserStateContext";
import { ActiveStackProvider } from "./contexts/ActiveStackContext";
import { TypesProvider } from "./contexts/TypesContext";
import { ErrorProvider } from "./contexts/ErrorContext";
import { Layout } from "./components/Layout";
import Home from "./pages/Home";
import Stacks from "./pages/Stacks";
import Blocks from "./pages/Blocks";
import Wildcards from "./pages/Wildcards";
import WhatIsThis from "./pages/WhatIsThis";
import Account from "./pages/Account";
import DeveloperSettings from "./pages/DeveloperSettings";
import NotFound from "./pages/NotFound";

function App() {
  return (
    <BrowserRouter>
      <SessionProvider>
        <UserStateProvider>
          <ErrorProvider>
            <TypesProvider>
              <ActiveStackProvider>
                <Layout>
                  <Routes>
                    <Route path="/" element={<Home />} />
                    <Route path="/prompts" element={<Stacks />} />
                    <Route path="/prompts/:displayId" element={<Stacks />} />
                    <Route path="/blocks" element={<Blocks />} />
                    <Route path="/wildcards" element={<Wildcards />} />
                    <Route path="/what-is-this" element={<WhatIsThis />} />
                    <Route path="/account" element={<Account />} />
                    <Route
                      path="/developer-settings"
                      element={<DeveloperSettings />}
                    />
                    <Route path="*" element={<NotFound />} />
                  </Routes>
                </Layout>
              </ActiveStackProvider>
            </TypesProvider>
          </ErrorProvider>
        </UserStateProvider>
      </SessionProvider>
    </BrowserRouter>
  );
}

export default App;
