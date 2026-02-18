import { BrowserRouter, Routes, Route } from "react-router-dom";
import { ServerConfigProvider } from "./contexts/ServerConfigContext";
import { LLMStatusProvider } from "./contexts/LLMStatusContext";
import { ClientLLMProvider } from "./contexts/ClientLLMContext";
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
import LMStudioCors from "./pages/LMStudioCors";
import Snapshots from "./pages/Snapshots";
import Templates from "./pages/Templates";
import NotFound from "./pages/NotFound";

function App() {
  return (
    <BrowserRouter>
      <ServerConfigProvider>
        <SessionProvider>
          <UserStateProvider>
            <LLMStatusProvider>
              <ClientLLMProvider>
                <ErrorProvider>
                  <TypesProvider>
                    <ActiveStackProvider>
                      <Layout>
                        <Routes>
                          <Route path="/" element={<Home />} />
                          <Route path="/prompts" element={<Stacks />} />
                          <Route
                            path="/prompts/:displayId"
                            element={<Stacks />}
                          />
                          <Route path="/snapshots" element={<Snapshots />} />
                          <Route path="/templates" element={<Templates />} />
                          <Route
                            path="/templates/:id"
                            element={<Templates />}
                          />
                          <Route path="/blocks" element={<Blocks />} />
                          <Route path="/wildcards" element={<Wildcards />} />
                          <Route
                            path="/what-is-this"
                            element={<WhatIsThis />}
                          />
                          <Route path="/account" element={<Account />} />
                          <Route
                            path="/lm-studio-cors"
                            element={<LMStudioCors />}
                          />
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
              </ClientLLMProvider>
            </LLMStatusProvider>
          </UserStateProvider>
        </SessionProvider>
      </ServerConfigProvider>
    </BrowserRouter>
  );
}

export default App;
