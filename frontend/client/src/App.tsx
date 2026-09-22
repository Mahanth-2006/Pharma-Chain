import { Route, Switch, Redirect } from "wouter";
import { AuthProvider } from "./auth/AuthContext";
import ProtectedRoute from "./auth/ProtectedRoute";
import Login from "./pages/Login";
import ManufacturerDashboard from "./pages/ManufacturerDashboard";
import DistributorDashboard from "./pages/DistributorDashboard";
import PharmacyDashboard from "./pages/PharmacyDashboard";
import GlobalTextEffect from "./components/GlobalTextEffect";

export default function App() {
  return (
    <AuthProvider>
      <GlobalTextEffect>
        <Switch>
          <Route path="/login" component={Login} />
          <Route path="/manufacturer">
            <ProtectedRoute roles={["manufacturer"]}>
              <ManufacturerDashboard />
            </ProtectedRoute>
          </Route>
          <Route path="/distributor">
            <ProtectedRoute roles={["distributor"]}>
              <DistributorDashboard />
            </ProtectedRoute>
          </Route>
          <Route path="/pharmacy">
            <ProtectedRoute roles={["pharmacy"]}>
              <PharmacyDashboard />
            </ProtectedRoute>
          </Route>
          <Route path="/">
            <Redirect to="/login" />
          </Route>
          <Route>
            <Redirect to="/login" />
          </Route>
        </Switch>
      </GlobalTextEffect>
    </AuthProvider>
  );
}
