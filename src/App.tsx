import { BrowserRouter, Routes, Route } from "react-router-dom";
import { ServerConfigProvider } from "./contexts/ServerConfigContext";
import { LLMStatusProvider } from "./contexts/LLMStatusContext";
import { ClientLLMProvider } from "./contexts/ClientLLMContext";
import { SessionProvider } from "./contexts/SessionContext";
import { UserEventsProvider } from "./contexts/UserEventsContext";
import { SyncProvider } from "./contexts/SyncContext";
import { UserStateProvider } from "./contexts/UserStateContext";
import { ActiveStackProvider } from "./contexts/ActiveStackContext";
import { TypesProvider } from "./contexts/TypesContext";
import { ErrorProvider } from "./contexts/ErrorContext";
import { Layout } from "./components/Layout";
import { ProtectedRoute } from "./components/ProtectedRoute";
import Home from "./pages/Home";
import Stacks from "./pages/Stacks";
import Blocks from "./pages/Blocks";
import Wildcards from "./pages/Wildcards";
import Account from "./pages/Account";
import DeveloperSettings from "./pages/DeveloperSettings";
import LMStudioCors from "./pages/LMStudioCors";
import Snapshots from "./pages/Snapshots";
import Templates from "./pages/Templates";
import Features from "./pages/Features";
import NotFound from "./pages/NotFound";

function App() {
  return (
    <BrowserRouter>
      <ServerConfigProvider>
        <SessionProvider>
          <UserEventsProvider>
            <SyncProvider>
              <UserStateProvider>
                <LLMStatusProvider>
                  <ClientLLMProvider>
                    <ErrorProvider>
                      <TypesProvider>
                        <ActiveStackProvider>
                          <Layout>
                            <Routes>
                              <Route path="/" element={<Home />} />
                              <Route
                                path="/prompts"
                                element={
                                  <ProtectedRoute>
                                    <Stacks />
                                  </ProtectedRoute>
                                }
                              />
                              <Route
                                path="/prompts/:displayId"
                                element={
                                  <ProtectedRoute>
                                    <Stacks />
                                  </ProtectedRoute>
                                }
                              />
                              <Route
                                path="/snapshots"
                                element={
                                  <ProtectedRoute>
                                    <Snapshots />
                                  </ProtectedRoute>
                                }
                              />
                              <Route
                                path="/templates"
                                element={
                                  <ProtectedRoute>
                                    <Templates />
                                  </ProtectedRoute>
                                }
                              />
                              <Route
                                path="/templates/:id"
                                element={
                                  <ProtectedRoute>
                                    <Templates />
                                  </ProtectedRoute>
                                }
                              />
                              <Route
                                path="/blocks"
                                element={
                                  <ProtectedRoute>
                                    <Blocks />
                                  </ProtectedRoute>
                                }
                              />
                              <Route
                                path="/blocks/new"
                                element={
                                  <ProtectedRoute>
                                    <Blocks />
                                  </ProtectedRoute>
                                }
                              />
                              <Route
                                path="/wildcards"
                                element={
                                  <ProtectedRoute>
                                    <Wildcards />
                                  </ProtectedRoute>
                                }
                              />
                              <Route path="/features" element={<Features />} />
                              <Route
                                path="/account"
                                element={
                                  <ProtectedRoute>
                                    <Account />
                                  </ProtectedRoute>
                                }
                              />
                              <Route
                                path="/lm-studio-cors"
                                element={<LMStudioCors />}
                              />
                              <Route
                                path="/developer-settings"
                                element={
                                  <ProtectedRoute>
                                    <DeveloperSettings />
                                  </ProtectedRoute>
                                }
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
            </SyncProvider>
          </UserEventsProvider>
        </SessionProvider>
      </ServerConfigProvider>
    </BrowserRouter>
  );
}

export default App;
