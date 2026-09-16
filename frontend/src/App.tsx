import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";

import { AuthProvider } from "./auth/AuthProvider";
import { RequireAuth } from "./auth/RequireAuth";
import { NavBar } from "./components/NavBar";
import { HomePage } from "./pages/HomePage";
import { LoginPage } from "./pages/LoginPage";
import { MyCardsPage } from "./pages/MyCardsPage";
import { MyNetworkPage } from "./pages/MyNetworkPage";
import { RequestsPage } from "./pages/RequestsPage";

function SignedInLayout({ children }: { children: React.ReactNode }) {
  return (
    <RequireAuth>
      <NavBar />
      <main id="main-content" tabIndex={-1}>{children}</main>
    </RequireAuth>
  );
}

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route
            path="/"
            element={
              <SignedInLayout>
                <HomePage />
              </SignedInLayout>
            }
          />
          <Route
            path="/cards"
            element={
              <SignedInLayout>
                <MyCardsPage />
              </SignedInLayout>
            }
          />
          <Route
            path="/network"
            element={
              <SignedInLayout>
                <MyNetworkPage />
              </SignedInLayout>
            }
          />
          <Route
            path="/requests"
            element={
              <SignedInLayout>
                <RequestsPage />
              </SignedInLayout>
            }
          />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}

export { App };
