import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { useNavigate } from "react-router-dom";

import { useAuth } from "../auth/AuthContext";

function LoginPage() {
  const { session, profile, signIn, signUp } = useAuth();
  const navigate = useNavigate();
  const [mode, setMode] = useState<"sign-in" | "sign-up">("sign-in");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    if (session || profile) {
      navigate("/", { replace: true });
    }
  }, [session, profile, navigate]);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    setFormError(null);

    try {
      if (mode === "sign-in") {
        await signIn(email, password);
      } else {
        await signUp(email, password, displayName);
      }

      navigate("/", { replace: true });
    } catch (error) {
      setFormError(error instanceof Error ? error.message : "Something went wrong");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="auth-page">
      <h1>Card Crew</h1>
      <p>Find help from people you trust.</p>

      <form onSubmit={handleSubmit} className="auth-form">
        {mode === "sign-up" && (
          <label>
            Display name
            <input
              autoComplete="name"
              value={displayName}
              onChange={(event) => setDisplayName(event.target.value)}
              required
            />
          </label>
        )}
        <label>
          Email
          <input
            type="email"
            autoComplete={mode === "sign-in" ? "username" : "email"}
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            required
          />
        </label>
        <div className="password-field">
          <label>
            Password
            <input
              type={showPassword ? "text" : "password"}
              autoComplete={mode === "sign-in" ? "current-password" : "new-password"}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              minLength={8}
              required
            />
          </label>
          {/* Outside the <label> deliberately: <button> is itself labelable, so nesting it
              inside the label merged both into one accessible name ("Password Show password"). */}
          <button
            type="button"
            className="password-toggle"
            onClick={() => setShowPassword((current) => !current)}
            aria-label={showPassword ? "Hide password" : "Show password"}
          >
            {showPassword ? "Hide" : "Show"}
          </button>
        </div>

        {formError && <p className="form-error" role="alert">{formError}</p>}

        <button type="submit" disabled={submitting}>
          {mode === "sign-in" ? "Sign in" : "Create account"}
        </button>
      </form>

      <button
        type="button"
        className="link-button"
        onClick={() => setMode(mode === "sign-in" ? "sign-up" : "sign-in")}
      >
        {mode === "sign-in" ? "New here? Create an account" : "Already have an account? Sign in"}
      </button>

      <div style={{ marginTop: "1.25rem", paddingTop: "1rem", borderTop: "1px dashed var(--paper-200)", textAlign: "center" }}>
        <button
          type="button"
          className="button-secondary"
          style={{ width: "100%", minHeight: "40px", fontSize: "0.85rem", fontWeight: 700 }}
          onClick={async () => {
            setSubmitting(true);
            setFormError(null);
            try {
              try {
                await signIn("teja@cardcrew.local", "password123");
              } catch (signErr: any) {
                if (signErr?.message?.includes("does not exist") || signErr?.status === 404) {
                  await signUp("teja@cardcrew.local", "password123", "Teja");
                } else {
                  throw signErr;
                }
              }
              navigate("/", { replace: true });
            } catch (err: any) {
              setFormError(err instanceof Error ? err.message : "Quick login failed");
            } finally {
              setSubmitting(false);
            }
          }}
        >
          ⚡ Instant Local Demo Sign-in (Teja)
        </button>
      </div>
    </div>
  );
}

export { LoginPage };
