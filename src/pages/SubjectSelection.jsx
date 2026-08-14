import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";

function SubjectSelection({ setPage }) {
  const [subjects, setSubjects] = useState([]);
  const [selectedSubjects, setSelectedSubjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    loadSubjects();
  }, []);

  async function loadSubjects() {
    try {
      setLoading(true);
      setMessage("");
      setError("");

      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError || !user) {
        setPage("login");
        return;
      }

      const { data: subjectData, error: subjectError } =
        await supabase
          .from("subjects")
          .select("id, name, description, icon")
          .order("name");

      if (subjectError) {
        throw subjectError;
      }

      setSubjects(subjectData || []);

      const {
        data: selectedData,
        error: selectedError,
      } = await supabase
        .from("student_subjects")
        .select("subject_id")
        .eq("student_id", user.id);

      if (selectedError) {
        throw selectedError;
      }

      setSelectedSubjects(
        (selectedData || []).map(
          (item) => item.subject_id
        )
      );
    } catch (err) {
      console.error(
        "Could not load subjects:",
        err
      );

      setError(
        err?.message ||
          "Could not load your subjects."
      );
    } finally {
      setLoading(false);
    }
  }

  function toggleSubject(subjectId) {
    setSelectedSubjects((current) => {
      if (current.includes(subjectId)) {
        return current.filter(
          (id) => id !== subjectId
        );
      }

      return [...current, subjectId];
    });

    setMessage("");
    setError("");
  }

  async function saveSubjects() {
    try {
      setSaving(true);
      setMessage("");
      setError("");

      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError || !user) {
        setPage("login");
        return;
      }

      const {
        error: deleteError,
      } = await supabase
        .from("student_subjects")
        .delete()
        .eq("student_id", user.id);

      if (deleteError) {
        throw deleteError;
      }

      if (selectedSubjects.length > 0) {
        const rows = selectedSubjects.map(
          (subjectId) => ({
            student_id: user.id,
            subject_id: subjectId,
          })
        );

        const {
          error: insertError,
        } = await supabase
          .from("student_subjects")
          .insert(rows);

        if (insertError) {
          throw insertError;
        }
      }

      setMessage(
        "Your subjects have been updated successfully! ✓"
      );

      /*
       * Give the success message a moment
       * before returning home.
       */

      setTimeout(() => {
        setPage("home");
      }, 900);
    } catch (err) {
      console.error(
        "Could not save subjects:",
        err
      );

      setError(
        err?.message ||
          "Could not save your subjects."
      );
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="page-content">

        <div className="no-subjects">

          <div className="no-subjects-icon">
            📚
          </div>

          <h3>
            Loading your subjects...
          </h3>

          <p>
            Getting your current subjects.
          </p>

        </div>

      </div>
    );
  }

  return (
    <div className="page-content">

      {/* BACK */}

      <button
        type="button"
        className="back-button"
        onClick={() => setPage("home")}
      >
        ← Back to home
      </button>


      {/* HEADER */}

      <div className="subject-selection-header">

        <p className="card-eyebrow">
          MY SIXTH FORM
        </p>

        <h2>
          Manage Subjects
        </h2>

        <p>
          Choose the subjects you are studying.
          Your selections will appear across
          your Revision Hub and dashboard.
        </p>

      </div>


      {/* SUCCESS */}

      {message && (
        <div className="auth-success">
          {message}
        </div>
      )}


      {/* ERROR */}

      {error && (
        <div className="auth-error">
          {error}
        </div>
      )}


      {/* SUBJECTS */}

      {subjects.length === 0 ? (

        <div className="no-subjects">

          <div className="no-subjects-icon">
            📚
          </div>

          <h3>
            No subjects available
          </h3>

          <p>
            There aren't any subjects in the
            database yet.
          </p>

        </div>

      ) : (

        <div className="subject-grid">

          {subjects.map((subject) => {

            const selected =
              selectedSubjects.includes(
                subject.id
              );

            return (
              <button
                key={subject.id}
                type="button"
                className={`subject-option ${
                  selected
                    ? "selected"
                    : ""
                }`}
                onClick={() =>
                  toggleSubject(subject.id)
                }
              >

                <div className="subject-option-icon">
                  {subject.icon || "📚"}
                </div>

                <div
                  style={{
                    textAlign: "left",
                  }}
                >

                  <h3>
                    {subject.name}
                  </h3>

                  <p>
                    {subject.description ||
                      "Sixth form subject"}
                  </p>

                </div>

                <div
                  style={{
                    marginLeft: "auto",
                    fontSize: "22px",
                    flexShrink: 0,
                  }}
                >
                  {selected
                    ? "☑️"
                    : "⬜"}
                </div>

              </button>
            );
          })}

        </div>
      )}


      {/* BOTTOM BAR */}

      <div
        style={{
          marginTop: "30px",
          padding: "18px 20px",
          borderRadius: "16px",
          background: "#f8fafc",
          border: "1px solid #e2e8f0",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: "20px",
          flexWrap: "wrap",
        }}
      >

        <div>

          <strong>
            {selectedSubjects.length}
          </strong>

          {" "}

          subject
          {selectedSubjects.length === 1
            ? ""
            : "s"} selected

        </div>


        <button
          type="button"
          className="primary-card-button"
          onClick={saveSubjects}
          disabled={saving}
        >
          {saving
            ? "Saving..."
            : "Save Subjects"}
        </button>

      </div>

    </div>
  );
}

export default SubjectSelection;