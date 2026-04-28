import { useEffect } from "react";
import { motion } from "motion/react";
import { Navigate, useNavigate } from "react-router-dom";
import { RasterIcon } from "@/components/RasterIcon";
import { CreateAccountOrLogin } from "@/components/CreateAccountOrLogin";
import { useSession } from "@/contexts/SessionContext";

export default function Login() {
  const { isAuthenticated, isLoading } = useSession();
  const navigate = useNavigate();

  // Once the session flips to authenticated (after a successful login), bounce
  // back to the home page rather than sitting on /login.
  useEffect(() => {
    if (!isLoading && isAuthenticated) {
      navigate("/", { replace: true });
    }
  }, [isAuthenticated, isLoading, navigate]);

  if (isLoading) return null;
  if (isAuthenticated) return <Navigate to="/" replace />;

  return (
    <main className="standard-page-container">
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <h1 className="text-4xl font-bold mb-2 flex items-center gap-3">
          <RasterIcon name="user" size={36} />
          Log In
        </h1>
        <p className="text-cyan-medium mb-8">
          <mark className="highlighted-text">
            Enter your Account ID to continue
          </mark>
        </p>
      </motion.div>

      <div className="mt-12">
        <CreateAccountOrLogin loginOnly />
      </div>
    </main>
  );
}
