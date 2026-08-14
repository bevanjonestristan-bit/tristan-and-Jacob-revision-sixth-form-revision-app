import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";

function Home({ setPage }) {
  const [profile, setProfile] = useState(null);
  const [subjects, setSubjects] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadDashboard();
  }, []);

  async function loadDashboard() {
    try {
      setLoading(true);

      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError || !user) {
        setPage("login");
        return;
      }

      /* LOAD PROFILE */

      const {
        data: profileData,
        error: profileError,
      } = await supabase
        .from("profiles")
        .select(
          "full_name, school_email, year_group"
        )
        .eq("id", user.id)
        .maybeSingle();

      if (profileError) {
        console.error(
          "Could not load profile:",
          profileError
        );
      }

      setProfile(profileData);

      /* LOAD SUBJECTS */

      const {
        data: subjectData,
        error: subjectError,
      } = await supabase
        .from("student_subjects")
        .select(`
          subject_id,
          subjects (
            id,
            name,
            description,
            icon
          )
        `)
        .eq("student_id", user.id);

      if (subjectError) {
        console.error(
          "Could not load subjects:",
          subjectError
        );
      } else {
        const formattedSubjects =
          (subjectData || [])
            .map((item) => item.subjects)
            .filter(Boolean);

        setSubjects(formattedSubjects);
      }
    } catch (error) {
      console.error(
        "Could not load dashboard:",
        error
      );
    } finally {
      setLoading(false);
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
            Loading your dashboard...
          </h3>

          <p>
            Getting everything ready for you.
          </p>
        </div>
      </div>
    );
  }

  const firstName =
    profile?.full_name
      ?.trim()
      ?.split(" ")[0] || "Student";

  return (
    <div className="page-content">

      {/* ==========================================
          WELCOME
      ========================================== */}

      <section className="dashboard-welcome">

        <p className="card-eyebrow">
          MONMOUTH SIXTH FORM
        </p>

        <h2>
          Welcome back, {firstName}! 👋
        </h2>

        <p>
          Your sixth form revision hub is ready.
          Keep track of your subjects, revision,
          timetable and study sessions all in one
          place.
        </p>

      </section>


      {/* ==========================================
          QUICK ACTIONS
      ========================================== */}

      <section
        style={{
          marginTop: "25px",
          display: "grid",
          gridTemplateColumns:
            "repeat(auto-fit, minmax(200px, 1fr))",
          gap: "15px",
        }}
      >

        {/* REVISION */}

        <button
          type="button"
          className="primary-card-button"
          onClick={() => setPage("revision")}
          style={{
            minHeight: "100px",
            textAlign: "left",
          }}
        >
          <div
            style={{
              fontSize: "28px",
              marginBottom: "8px",
            }}
          >
            📚
          </div>

          <strong>
            Revision
          </strong>

          <div
            style={{
              fontSize: "13px",
              marginTop: "5px",
              opacity: 0.8,
            }}
          >
            Revise your subjects
          </div>
        </button>


        {/* STUDY HUB */}

        <button
          type="button"
          className="primary-card-button"
          onClick={() => setPage("studyHub")}
          style={{
            minHeight: "100px",
            textAlign: "left",
          }}
        >
          <div
            style={{
              fontSize: "28px",
              marginBottom: "8px",
            }}
          >
            🧠
          </div>

          <strong>
            Study Hub
          </strong>

          <div
            style={{
              fontSize: "13px",
              marginTop: "5px",
              opacity: 0.8,
            }}
          >
            Study with other students
          </div>
        </button>


        {/* TIMETABLE */}

        <button
          type="button"
          className="primary-card-button"
          onClick={() => setPage("timetable")}
          style={{
            minHeight: "100px",
            textAlign: "left",
          }}
        >
          <div
            style={{
              fontSize: "28px",
              marginBottom: "8px",
            }}
          >
            🗓️
          </div>

          <strong>
            Timetable
          </strong>

          <div
            style={{
              fontSize: "13px",
              marginTop: "5px",
              opacity: 0.8,
            }}
          >
            View your timetable
          </div>
        </button>

      </section>


      {/* ==========================================
          SUBJECTS
      ========================================== */}

      <section
        style={{
          marginTop: "35px",
        }}
      >

        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: "15px",
            flexWrap: "wrap",
            marginBottom: "18px",
          }}
        >

          <div>

            <p className="card-eyebrow">
              YOUR STUDIES
            </p>

            <h2
              style={{
                margin: 0,
              }}
            >
              My Subjects
            </h2>

          </div>


          {/* MANAGE SUBJECTS */}

          <button
            type="button"
            className="primary-card-button"
            onClick={() =>
              setPage("subjectSelection")
            }
          >
            ⚙️ Manage Subjects
          </button>

        </div>


        {/* SUBJECT LIST */}

        {subjects.length === 0 ? (

          <div className="no-subjects">

            <div className="no-subjects-icon">
              📚
            </div>

            <h3>
              No subjects selected yet
            </h3>

            <p>
              Choose the subjects you're studying
              to personalise your Revision Hub.
            </p>

            <button
              type="button"
              className="primary-card-button"
              onClick={() =>
                setPage("subjectSelection")
              }
              style={{
                marginTop: "15px",
              }}
            >
              Choose My Subjects
            </button>

          </div>

        ) : (

          <div className="subject-grid">

            {subjects.map((subject) => (

              <button
                key={subject.id}
                type="button"
                className="subject-option selected"
                onClick={() => {
                  setPage("subjectResources");
                }}
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
                    fontSize: "18px",
                  }}
                >
                  →
                </div>

              </button>

            ))}

          </div>

        )}

      </section>


      {/* ==========================================
          PROFILE
      ========================================== */}

      <section
        style={{
          marginTop: "35px",
        }}
      >

        <div
          style={{
            padding: "22px",
            borderRadius: "18px",
            background: "#f8fafc",
            border: "1px solid #e2e8f0",
          }}
        >

          <p className="card-eyebrow">
            MY ACCOUNT
          </p>

          <h3>
            {profile?.full_name ||
              "Your account"}
          </h3>

          {profile?.school_email && (
            <p>
              {profile.school_email}
            </p>
          )}

          {profile?.year_group && (
            <p>
              {profile.year_group}
            </p>
          )}

        </div>

      </section>

    </div>
  );
}

export default Home;
