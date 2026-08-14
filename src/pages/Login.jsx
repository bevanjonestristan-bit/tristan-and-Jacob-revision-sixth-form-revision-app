import { useState } from "react";
import { supabase } from "../lib/supabase";

function Login({ setPage }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  async function handleLogin(event) {
    event.preventDefault();

    setMessage("");
    setLoading(true);

    try {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        throw error;
      }

      setPage("home");
    } catch (err) {
      console.error("Login error:", err);

      setMessage(
        err.message || "Unable to log in. Please check your details."
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="auth-page">

      <div className="auth-background-shape auth-shape-one" />
      <div className="auth-background-shape auth-shape-two" />

      <div className="auth-card login-card">

        {/* BRAND */}

        <div className="auth-brand">

          <div className="school-crest">
            <img
              src="/monmouth-logo.webp.webp"
              alt="Haberdashers' Monmouth School logo"
            />
          </div>

          <div className="school-brand-text">
            <strong>
              Haberdashers' Monmouth
            </strong>

            <span>
              Sixth Form
            </span>
          </div>

        </div>


        {/* HEADING */}

        <div className="auth-heading">

          <p className="auth-eyebrow">
            REVISION APP
          </p>

          <h1>
            Welcome back 👋
          </h1>

          <p>
            Log in to continue your revision journey.
          </p>

        </div>


        {/* FORM */}

        <form
          className="auth-form"
          onSubmit={handleLogin}
        >

          <div className="auth-field">

            <label htmlFor="login-email">
              School email
            </label>

            <input
              id="login-email"
              type="email"
              placeholder="Enter your school email"
              value={email}
              onChange={(event) =>
                setEmail(event.target.value)
              }
              autoComplete="email"
              required
            />

          </div>


          <div className="auth-field">

            <label htmlFor="login-password">
              Password
            </label>

            <input
              id="login-password"
              type="password"
              placeholder="Enter your password"
              value={password}
              onChange={(event) =>
                setPassword(event.target.value)
              }
              autoComplete="current-password"
              required
            />

          </div>


          {message && (
            <div className="auth-message">
              {message}
            </div>
          )}


          <button
            type="submit"
            className="auth-submit"
            disabled={loading}
          >
            {loading ? "Logging in..." : "Log in"}
          </button>

        </form>


        {/* FOOTER */}

        <div className="auth-footer">

          <span>
            Don't have an account?
          </span>

          <button
            type="button"
            onClick={() => setPage("signup")}
          >
            Create an account
          </button>

        </div>

      </div>

    </div>
  );
}

export default Login;