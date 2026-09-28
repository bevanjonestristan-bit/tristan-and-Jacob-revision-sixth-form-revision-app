import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";

function AssignmentManager({
  assignmentId,
  onBack,
  onMarkPaper,
}) {
  const [assignment, setAssignment] = useState(null);
  const [recipients, setRecipients] = useState([]);
  const [profiles, setProfiles] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  /* =========================================================
     LOAD
     ========================================================= */

  useEffect(() => {
    if (!assignmentId) return;

    loadManager();
  }, [assignmentId]);

  async function loadManager() {
    try {
      setLoading(true);
      setError("");

      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError || !user) {
        throw new Error(
          "You must be logged in to manage an assignment."
        );
      }

      /* -------------------------------------------------------
         LOAD MASTER ASSIGNMENT
         ------------------------------------------------------- */

      const {
        data: assignmentData,
        error: assignmentError,
      } = await supabase
        .from("assignments")
        .select(`
          id,
          creator_id,
          title,
          instructions,
          file_name,
          duration_minutes,
          due_at,
          created_at
        `)
        .eq("id", assignmentId)
        .eq("creator_id", user.id)
        .single();

      if (assignmentError) {
        throw assignmentError;
      }

      if (!assignmentData) {
        throw new Error(
          "Assignment not found or you do not have permission to manage it."
        );
      }

      setAssignment(assignmentData);

      /* -------------------------------------------------------
         LOAD RECIPIENTS
         ------------------------------------------------------- */

      const {
        data: recipientData,
        error: recipientError,
      } = await supabase
        .from("assignment_recipients")
        .select(`
          id,
          assignment_id,
          recipient_id,
          status,
          assigned_at,
          started_at,
          expires_at,
          submitted_at,
          submission_reason,
          returned_at
        `)
        .eq("assignment_id", assignmentId)
        .order("assigned_at", {
          ascending: true,
        });

      if (recipientError) {
        throw recipientError;
      }

      const rows = recipientData || [];

      setRecipients(rows);

      /* -------------------------------------------------------
         LOAD RECIPIENT PROFILES
         ------------------------------------------------------- */

      const profileIds = [
        ...new Set(
          rows
            .map((row) => row.recipient_id)
            .filter(Boolean)
        ),
      ];

      if (profileIds.length === 0) {
        setProfiles({});
        return;
      }

      const {
        data: profileData,
        error: profileError,
      } = await supabase
        .from("profiles")
        .select(
          "id, full_name, school_email, year_group"
        )
        .in("id", profileIds);

      if (profileError) {
        throw profileError;
      }

      const profileMap = {};

      (profileData || []).forEach((profile) => {
        profileMap[profile.id] = profile;
      });

      setProfiles(profileMap);
    } catch (err) {
      console.error(
        "Could not load assignment manager:",
        err
      );

      setError(
        err?.message ||
          "Could not load this assignment."
      );
    } finally {
      setLoading(false);
    }
  }

  /* =========================================================
     FORMATTING
     ========================================================= */

  function formatDate(value) {
    if (!value) return "—";

    return new Date(value).toLocaleString("en-GB", {
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  function getStatusDetails(status) {
    switch (status) {
      case "assigned":
        return {
          label: "Not started",
          icon: "📌",
          background: "#f1f5f9",
          colour: "#475569",
        };

      case "in_progress":
        return {
          label: "In progress",
          icon: "⏱️",
          background: "#fff7ed",
          colour: "#9a3412",
        };

      case "submitted":
        return {
          label: "Submitted",
          icon: "📤",
          background: "#eff6ff",
          colour: "#1d4ed8",
        };

      case "returned":
        return {
          label: "Returned",
          icon: "✅",
          background: "#ecfdf5",
          colour: "#166534",
        };

      default:
        return {
          label: status || "Unknown",
          icon: "•",
          background: "#f8fafc",
          colour: "#475569",
        };
    }
  }

  /* =========================================================
     COUNTS
     ========================================================= */

  const total = recipients.length;

  const notStarted = recipients.filter(
    (recipient) => recipient.status === "assigned"
  ).length;

  const inProgress = recipients.filter(
    (recipient) => recipient.status === "in_progress"
  ).length;

  const submitted = recipients.filter(
    (recipient) => recipient.status === "submitted"
  ).length;

  const returned = recipients.filter(
    (recipient) => recipient.status === "returned"
  ).length;

  /* =========================================================
     LOADING
     ========================================================= */

  if (loading) {
    return (
      <div style={centre}>
        <div style={{ fontSize: "40px" }}>📝</div>

        <h2>Loading assignment...</h2>

        <p style={{ color: "#64748b" }}>
          Getting each student's private attempt.
        </p>
      </div>
    );
  }

  /* =========================================================
     ERROR
     ========================================================= */

  if (error || !assignment) {
    return (
      <div style={centre}>
        <div style={{ fontSize: "40px" }}>⚠️</div>

        <h2>Couldn't open assignment</h2>

        <p style={{ color: "#64748b" }}>
          {error || "Assignment unavailable."}
        </p>

        <button
          type="button"
          onClick={onBack}
          style={primaryButton}
        >
          ← Back
        </button>
      </div>
    );
  }

  /* =========================================================
     PAGE
     ========================================================= */

  return (
    <div style={{ paddingBottom: "40px" }}>
      {/* =====================================================
          HEADER
          ===================================================== */}

      <section style={hero}>
        <div>
          <button
            type="button"
            onClick={onBack}
            style={backButton}
          >
            ← Back to Assignments
          </button>

          <div style={eyebrow}>MANAGE ASSIGNMENT</div>

          <h2
            style={{
              margin: "4px 0 7px",
              fontSize: "28px",
            }}
          >
            {assignment.title}
          </h2>

          <p
            style={{
              margin: 0,
              opacity: 0.9,
            }}
          >
            {total}{" "}
            {total === 1 ? "student" : "students"} assigned
          </p>
        </div>

        <div style={heroDetails}>
          {assignment.duration_minutes && (
            <span>
              ⏱️ {assignment.duration_minutes} minutes
            </span>
          )}

          <span>
            📅{" "}
            {assignment.due_at
              ? formatDate(assignment.due_at)
              : "No deadline"}
          </span>
        </div>
      </section>

      {/* =====================================================
          STATS
          ===================================================== */}

      <div style={statsGrid}>
        <Stat
          icon="👥"
          number={total}
          label="Assigned"
        />

        <Stat
          icon="📌"
          number={notStarted}
          label="Not Started"
        />

        <Stat
          icon="⏱️"
          number={inProgress}
          label="In Progress"
        />

        <Stat
          icon="📤"
          number={submitted}
          label="Ready to Mark"
        />

        <Stat
          icon="✅"
          number={returned}
          label="Returned"
        />
      </div>

      {/* =====================================================
          INSTRUCTIONS
          ===================================================== */}

      {assignment.instructions && (
        <div style={instructionsBox}>
          <strong>Assignment instructions</strong>

          <p
            style={{
              margin: "7px 0 0",
              whiteSpace: "pre-wrap",
              lineHeight: 1.6,
            }}
          >
            {assignment.instructions}
          </p>
        </div>
      )}

      {/* =====================================================
          STUDENTS
          ===================================================== */}

      <div style={sectionHeader}>
        <div>
          <h3 style={{ margin: 0 }}>
            Student attempts
          </h3>

          <p style={sectionDescription}>
            Each student has their own private copy of the
            assignment.
          </p>
        </div>

        <button
          type="button"
          onClick={loadManager}
          style={secondaryButton}
        >
          ↻ Refresh
        </button>
      </div>

      {recipients.length === 0 ? (
        <div style={emptyState}>
          <div style={{ fontSize: "38px" }}>📭</div>

          <h3>No students assigned</h3>

          <p style={{ color: "#64748b" }}>
            There are currently no recipients for this
            assignment.
          </p>
        </div>
      ) : (
        <div style={studentList}>
          {recipients.map((recipient) => {
            const profile =
              profiles[recipient.recipient_id];

            const status = getStatusDetails(
              recipient.status
            );

            const canMark =
              recipient.status === "submitted" ||
              recipient.status === "returned";

            return (
              <div
                key={recipient.id}
                style={studentCard}
              >
                {/* ===========================================
                    STUDENT
                    =========================================== */}

                <div style={studentIdentity}>
                  <div style={avatar}>
                    {(profile?.full_name || "S")
                      .charAt(0)
                      .toUpperCase()}
                  </div>

                  <div>
                    <h3
                      style={{
                        margin: 0,
                        fontSize: "17px",
                      }}
                    >
                      {profile?.full_name || "Student"}
                    </h3>

                    <div style={studentMeta}>
                      {profile?.year_group || "Sixth Form"}

                      {profile?.school_email
                        ? ` • ${profile.school_email}`
                        : ""}
                    </div>
                  </div>
                </div>

                {/* ===========================================
                    STATUS
                    =========================================== */}

                <div style={attemptInfo}>
                  <span
                    style={{
                      ...statusBadge,
                      background: status.background,
                      color: status.colour,
                    }}
                  >
                    {status.icon} {status.label}
                  </span>

                  {recipient.status === "assigned" && (
                    <div style={dateText}>
                      Assigned:{" "}
                      {formatDate(recipient.assigned_at)}
                    </div>
                  )}

                  {recipient.status === "in_progress" && (
                    <>
                      <div style={dateText}>
                        Started:{" "}
                        {formatDate(recipient.started_at)}
                      </div>

                      {recipient.expires_at && (
                        <div style={dateText}>
                          Timer ends:{" "}
                          {formatDate(recipient.expires_at)}
                        </div>
                      )}
                    </>
                  )}

                  {(recipient.status === "submitted" ||
                    recipient.status === "returned") && (
                    <div style={dateText}>
                      Submitted:{" "}
                      {formatDate(recipient.submitted_at)}
                    </div>
                  )}

                  {recipient.status === "returned" && (
                    <div style={dateText}>
                      Returned:{" "}
                      {formatDate(recipient.returned_at)}
                    </div>
                  )}
                </div>

                {/* ===========================================
                    ACTION
                    =========================================== */}

                <div style={actionArea}>
                  {canMark ? (
                    <button
                      type="button"
                      onClick={() =>
                        onMarkPaper(recipient.id)
                      }
                      style={primaryButton}
                    >
                      {recipient.status === "returned"
                        ? "Review Marking →"
                        : "Mark Paper →"}
                    </button>
                  ) : (
                    <button
                      type="button"
                      disabled
                      style={disabledButton}
                    >
                      {recipient.status === "in_progress"
                        ? "Still working"
                        : "Not submitted"}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* =====================================================
          PRIVACY NOTE
          ===================================================== */}

      <div style={privacyBox}>
        <div style={{ fontSize: "22px" }}>🔒</div>

        <div>
          <strong>Private attempts</strong>

          <p
            style={{
              margin: "4px 0 0",
              color: "#64748b",
              lineHeight: 1.5,
            }}
          >
            Each submission is stored separately. Students
            cannot use this dashboard to view another
            student's answers.
          </p>
        </div>
      </div>
    </div>
  );
}

/* ===========================================================
   SMALL COMPONENT
   =========================================================== */

function Stat({ icon, number, label }) {
  return (
    <div style={statCard}>
      <div style={{ fontSize: "21px" }}>{icon}</div>

      <strong style={{ fontSize: "24px" }}>
        {number}
      </strong>

      <span style={statLabel}>{label}</span>
    </div>
  );
}

/* ===========================================================
   STYLES
   =========================================================== */

const centre = {
  padding: "45px 20px",
  textAlign: "center",
};

const hero = {
  padding: "25px",
  borderRadius: "21px",
  background:
    "linear-gradient(135deg, #6d28d9, #8b5cf6)",
  color: "#ffffff",

  display: "flex",
  justifyContent: "space-between",
  alignItems: "flex-end",
  gap: "20px",
  flexWrap: "wrap",

  marginBottom: "20px",
};

const backButton = {
  border: "none",
  background: "rgba(255,255,255,0.15)",
  color: "#ffffff",
  padding: "8px 11px",
  borderRadius: "9px",
  cursor: "pointer",
  fontWeight: 800,
  marginBottom: "15px",
};

const eyebrow = {
  fontSize: "11px",
  fontWeight: 900,
  letterSpacing: "0.09em",
  opacity: 0.8,
};

const heroDetails = {
  display: "grid",
  gap: "7px",
  fontSize: "13px",
  fontWeight: 700,
};

const statsGrid = {
  display: "grid",
  gridTemplateColumns:
    "repeat(auto-fit, minmax(130px, 1fr))",
  gap: "10px",
  marginBottom: "20px",
};

const statCard = {
  background: "#ffffff",
  border: "1px solid #e5e7eb",
  borderRadius: "15px",
  padding: "15px",
  display: "grid",
  gap: "2px",
};

const statLabel = {
  fontSize: "12px",
  color: "#64748b",
  fontWeight: 700,
};

const instructionsBox = {
  background: "#faf5ff",
  border: "1px solid #e9d5ff",
  borderRadius: "15px",
  padding: "16px",
  marginBottom: "22px",
  color: "#475569",
};

const sectionHeader = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: "12px",
  flexWrap: "wrap",
  marginBottom: "12px",
};

const sectionDescription = {
  margin: "4px 0 0",
  color: "#64748b",
  fontSize: "13px",
};

const studentList = {
  display: "grid",
  gap: "11px",
};

const studentCard = {
  background: "#ffffff",
  border: "1px solid #e5e7eb",
  borderRadius: "16px",
  padding: "16px",

  display: "grid",
  gridTemplateColumns:
    "minmax(210px, 1fr) minmax(190px, 1fr) auto",
  alignItems: "center",
  gap: "16px",
};

const studentIdentity = {
  display: "flex",
  alignItems: "center",
  gap: "11px",
  minWidth: 0,
};

const avatar = {
  width: "42px",
  height: "42px",
  borderRadius: "50%",
  background: "#ede9fe",
  color: "#6d28d9",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  fontWeight: 900,
  flexShrink: 0,
};

const studentMeta = {
  marginTop: "3px",
  color: "#64748b",
  fontSize: "12px",
  overflowWrap: "anywhere",
};

const attemptInfo = {
  display: "grid",
  justifyItems: "start",
  gap: "5px",
};

const statusBadge = {
  padding: "6px 9px",
  borderRadius: "999px",
  fontSize: "12px",
  fontWeight: 900,
};

const dateText = {
  color: "#64748b",
  fontSize: "11px",
};

const actionArea = {
  display: "flex",
  justifyContent: "flex-end",
};

const primaryButton = {
  border: "none",
  borderRadius: "10px",
  padding: "10px 14px",
  background: "#7c3aed",
  color: "#ffffff",
  fontWeight: 900,
  cursor: "pointer",
  whiteSpace: "nowrap",
};

const secondaryButton = {
  border: "1px solid #ddd6fe",
  borderRadius: "10px",
  padding: "9px 13px",
  background: "#f5f3ff",
  color: "#6d28d9",
  fontWeight: 900,
  cursor: "pointer",
};

const disabledButton = {
  border: "1px solid #e2e8f0",
  borderRadius: "10px",
  padding: "10px 14px",
  background: "#f8fafc",
  color: "#94a3b8",
  fontWeight: 800,
  cursor: "not-allowed",
  whiteSpace: "nowrap",
};

const emptyState = {
  padding: "35px 20px",
  textAlign: "center",
  background: "#ffffff",
  border: "1px dashed #d8b4fe",
  borderRadius: "17px",
};

const privacyBox = {
  marginTop: "20px",
  padding: "14px",
  background: "#f8fafc",
  border: "1px solid #e2e8f0",
  borderRadius: "14px",
  display: "flex",
  alignItems: "flex-start",
  gap: "11px",
};

export default AssignmentManager;