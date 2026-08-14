import React, { useState } from "react";
import { supabase } from "../lib/supabase";

function Signup({ setPage }) {
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [yearGroup, setYearGroup] = useState("Year 12");

  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSignup = async (event) => {
    event.preventDefault();

    setError("");
    setSuccess("");
    setLoading(true);

    try {
      if (!fullName.trim()) {
        throw new Error("Please enter your full name.");
      }

      if (!email.trim()) {
        throw new Error("Please enter your school email.");
      }

      if (password.length < 6) {
        throw new Error(
          "Your password must be at least 6 characters."
        );
      }

      /*
       * CREATE SUPABASE AUTH ACCOUNT
       */

      const {
        data,
        error: signupError,
      } = await supabase.auth.signUp({
        email: email.trim(),
        password: password,
        options: {
          data: {
            full_name: fullName.trim(),
            year_group: yearGroup,
          },
        },
      });

      if (signupError) {
        throw signupError;
      }

      /*
       * Supabase may return a user without
       * creating an active session when
       * email confirmation is enabled.
       */

      if (!data?.user) {
        throw new Error(
          "The account could not be created. Please try again."
        );
      }

      /*
       * CREATE PROFILE
       *
       * This only runs if we have an active
       * session. If email confirmation is
       * required, the profile can be created
       * after the user confirms their email.
       */

      if (data.session) {
        const {
          error: profileError,
        } = await supabase
          .from("profiles")
          .upsert({
            id: data.user.id,
            full_name: fullName.trim(),
            school_email: email.trim(),
            year_group: yearGroup,
          });

        if (profileError) {
          console.error(
            "Profile creation error:",
            profileError
          );
        }
      }

      /*
       * SHOW CORRECT SUCCESS MESSAGE
       */

      setSuccess(
        "Account created! Please check your email to verify your account."
      );

    } catch (err) {
      console.error("Signup error:", err);

      setError(
        err?.message ||
          "Something went wrong while creating your account."
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page">

      <div className="auth-card">

        {/* BACK BUTTON */}

        <button
          type="button"
          className="back-button"
          onClick={() => setPage("login")}
        >
          ← Back to login
        </button>


        {/* LOGO */}

        <div className="auth-logo">

          <img
            src="/monmouth-logo.webp"
            alt="Monmouth Sixth Form logo"
          />

        </div>


        {/* HEADING */}

        <div className="auth-heading">

          <h1>
            Monmouth Sixth Form
          </h1>

          <h2>
            Revision App
          </h2>

          <p>
            Create your account
          </p>

          <span>
            Join the Monmouth Sixth Form
            Revision App.
          </span>

        </div>


        {/* SIGNUP FORM */}

        <form
          onSubmit={handleSignup}
          className="auth-form"
        >

          {/* FULL NAME */}

          <label>

            Full name

            <input
              type="text"
              value={fullName}
              onChange={(event) =>
                setFullName(event.target.value)
              }
              placeholder="Your full name"
              required
            />

          </label>


          {/* EMAIL */}

          <label>

            School email

            <input
              type="email"
              value={email}
              onChange={(event) =>
                setEmail(event.target.value)
              }
              placeholder="your.name@..."
              required
            />

          </label>


          {/* PASSWORD */}

          <label>

            Password

            <input
              type="password"
              value={password}
              onChange={(event) =>
                setPassword(event.target.value)
              }
              placeholder="Create a password"
              minLength={6}
              required
            />

          </label>


          {/* YEAR GROUP */}

          <label>

            Year group

            <select
              value={yearGroup}
              onChange={(event) =>
                setYearGroup(event.target.value)
              }
            >

              <option value="Year 12">
                Year 12
              </option>

              <option value="Year 13">
                Year 13
              </option>

            </select>

          </label>


          {/* ERROR */}

          {error && (
            <div className="auth-error">
              {error}
            </div>
          )}


          {/* SUCCESS */}

          {success && (
            <div className="auth-success">
              {success}
            </div>
          )}


          {/* SUBMIT */}

          <button
            type="submit"
            className="auth-submit"
            disabled={loading}
          >

            {loading
              ? "Creating account..."
              : "Create account"}

          </button>

        </form>


        {/* FOOTER */}

        <div className="auth-footer">

          <span>
            Already have an account?
          </span>

          <button
            type="button"
            onClick={() => setPage("login")}
          >
            Log in
          </button>

        </div>

      </div>

    </div>
  );
}

export default Signup;