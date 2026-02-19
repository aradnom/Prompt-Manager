import { Navigate } from "react-router-dom";
import { useSession } from "@/contexts/SessionContext";

export function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading } = useSession();

  if (isLoading) return null;
  if (!isAuthenticated) return <Navigate to="/" replace />;

  return children;
}
