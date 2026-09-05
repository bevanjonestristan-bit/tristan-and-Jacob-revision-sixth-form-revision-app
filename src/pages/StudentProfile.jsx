
import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";

function StudentProfile({ setPage, studentId, onBack }) {
  const [student, setStudent] = useState(null);
  const [subjects, setSubjects] = useState([]);
  const [timetable, setTimetable] = useState([]);

  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (studentId) {
      loadStudentProfile();
    }
  }, [studentId]);

  // =========================================================
  // LOAD STUDENT PROFILE
  // =========================================================

  async function loadStudentProfile() {
    try {
      setLoading(true);
      setMessage("");

      // -------------------------------------------------------
      // CHECK CURRENT USER
      // -------------------------------------------------------

      const {
        data: { user: currentUser },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError || !currentUser) {
        setPage("login");
        return;
      }

      // -------------------------------------------------------
      // LOAD PROFILE
      // -------------------------------------------------------

      const {
        data: profile,
        error: profileError,
      } = await supabase
        .from("profiles")
        .select(
          "id, full_name, school_email, year_group"
        )
        .eq("id", studentId)
        .single();

      if (profileError) {
        throw profileError;
      }

      setStudent(profile);

      // -------------------------------------------------------
      // LOAD SUBJECTS
      // -------------------------------------------------------

      const {
        data: subjectData,
        error: subjectError,
      } = await supabase
        .from("subjects")
        .select("*")
        .eq("user_id", studentId);

      if (subjectError) {
        console.warn(
          "Could not load subjects:",
          subjectError.message
        );

        setSubjects([]);
      } else {
        setSubjects(subjectData || []);
      }

      // -------------------------------------------------------
      // LOAD TIMETABLE
      //
      // IMPORTANT:
      // The actual table is timetable_entries.
      // -------------------------------------------------------

      const {
        data: timetableData,
        error: timetableError,
      } = await supabase
        .from("timetable_entries")
        .select(`
          id,
          user_id,
          day,
          subject,
          start_time,
          end_time,
          room,
          teacher,
          created_at,
          updated_at,
          week,
          period_name
        `)
        .eq("user_id", studentId)
        .order("day", {
          ascending: true,
        })
        .order("start_time", {
          ascending: true,
        });

      if (timetableError) {
        console.warn(
          "Could not load timetable:",
          timetableError.message
        );

        setTimetable([]);
      } else {
        setTimetable(timetableData || []);
      }
    } catch (error) {
      console.error(
        "Could not load student profile:",
        error
      );

      setMessage(
        error.message ||
          "Could not load this student's profile."
      );
    } finally {
      setLoading(false);
    }
  }

  // =========================================================
  // FORMAT TIME
  // =========================================================

  function formatTime(time) {
    if (!time) {
      return "";
    }

    const parts = String(time).split(":");

    if (parts.length < 2) {
      return String(time);
    }

    const hours = Number(parts[0]);
    const minutes = String(parts[1]).padStart(2, "0");

    const suffix = hours >= 12 ? "PM" : "AM";

    const displayHour =
      hours % 12 === 0
        ? 12
        : hours % 12;

    return `${displayHour}:${minutes} ${suffix}`;
  }

  // =========================================================
  // DAY NAME
  //
  // Assumes:
  // 1 = Monday
  // 2 = Tuesday
  // 3 = Wednesday
  // 4 = Thursday
  // 5 = Friday
  // =========================================================

  function getDayName(day) {
    const dayNumber = Number(day);

    const days = {
      1: "Monday",
      2: "Tuesday",
      3: "Wednesday",
      4: "Thursday",
      5: "Friday",
    };

    return days[dayNumber] || `Day ${dayNumber}`;
  }

  // =========================================================
  // GET TIMETABLE FOR A DAY
  // =========================================================

  function getTimetableDay(dayNumber) {
    return timetable
      .filter(function (item) {
        return Number(item.day) === dayNumber;
      })
      .sort(function (a, b) {
        return String(a.start_time || "").localeCompare(
          String(b.start_time || "")
        );
      });
  }

  // =========================================================
  // LOADING
  // =========================================================

  if (loading) {
    return (
      <div className="no-subjects">
        <div className="no-subjects-icon">
          👤
        </div>

        <h3>
          Loading profile...
        </h3>

        <p>
          Getting their subjects and timetable.
        </p>
      </div>
    );
  }

  // =========================================================
  // STUDENT NOT FOUND
  // =========================================================

  if (!student) {
    return (
      <div className="no-subjects">
        <div className="no-subjects-icon">
          😕
        </div>

        <h3>
          Student not found
        </h3>

        <p>
          This student's profile could not be
          found.
        </p>

        <button
          type="button"
          className="primary-card-button"
          onClick={onBack}
        >
          ← Back to Friends
        </button>
      </div>
    );
  }

  // =========================================================
  // DAYS
  // =========================================================

  const days = [
    {
      number: 1,
      name: "Monday",
    },
    {
      number: 2,
      name: "Tuesday",
    },
    {
      number: 3,
      name: "Wednesday",
    },
    {
      number: 4,
      name: "Thursday",
    },
    {
      number: 5,
      name: "Friday",
    },
  ];

  // =========================================================
  // PAGE
  // =========================================================

  return (
    <div>

      {/* =====================================================
          HEADER
          ===================================================== */}

      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "15px",
          marginBottom: "25px",
          flexWrap: "wrap",
        }}
      >

        <button
          type="button"
          onClick={onBack}
          style={{
            border: "1px solid #dbe3ef",
            background: "white",
            borderRadius: "10px",
            padding: "10px 14px",
            cursor: "pointer",
            fontSize: "14px",
          }}
        >
          ← Back
        </button>

        <div>
          <p className="card-eyebrow">
            FRIEND PROFILE
          </p>

          <h2 style={{ margin: 0 }}>
            {student.full_name || "Student"} 👤
          </h2>
        </div>

      </div>

      {/* =====================================================
          ERROR
          ===================================================== */}

      {message && (
        <div
          className="revision-information"
          style={{
            marginBottom: "25px",
          }}
        >
          <div className="revision-information-icon">
            ⚠️
          </div>

          <div>
            <strong>
              Something went wrong
            </strong>

            <p>
              {message}
            </p>
          </div>
        </div>
      )}

      {/* =====================================================
          PROFILE CARD
          ===================================================== */}

      <div
        style={{
          background: "white",
          borderRadius: "20px",
          border: "1px solid #e2e8f0",
          padding: "25px",
          marginBottom: "30px",
        }}
      >

        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "20px",
          }}
        >

          <div
            style={{
              width: "75px",
              height: "75px",
              borderRadius: "50%",
              background: "#e0e7ff",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: "34px",
              flexShrink: 0,
            }}
          >
            👤
          </div>

          <div>

            <h2 style={{ margin: 0 }}>
              {student.full_name || "Student"}
            </h2>

            <p
              style={{
                margin: "6px 0 0",
                color: "#64748b",
              }}
            >
              {student.year_group || "Sixth Form"}
            </p>

            {student.school_email && (
              <p
                style={{
                  margin: "4px 0 0",
                  color: "#64748b",
                  fontSize: "14px",
                }}
              >
                {student.school_email}
              </p>
            )}

          </div>

        </div>

      </div>

      {/* =====================================================
          SUBJECTS
          ===================================================== */}

      <div className="revision-section-heading">

        <div>

          <h3>
            Subjects 📚
          </h3>

          <p>
            The subjects this student takes.
          </p>

        </div>

      </div>

      {subjects.length > 0 ? (

        <div
          className="revision-subject-grid"
          style={{
            marginBottom: "35px",
          }}
        >

          {subjects.map(function (
            subject,
            index
          ) {

            return (
              <div
                key={
                  subject.id ||
                  subject.subject_id ||
                  subject.name ||
                  index
                }
                className="revision-subject-card"
              >

                <div className="revision-subject-top">

                  <div className="revision-subject-icon">
                    📚
                  </div>

                </div>

                <div className="revision-subject-content">

                  <h3>
                    {subject.name ||
                      subject.subject_name ||
                      subject.title ||
                      "Subject"}
                  </h3>

                  {subject.exam_board && (
                    <p>
                      {subject.exam_board}
                    </p>
                  )}

                  {subject.level && (
                    <p>
                      {subject.level}
                    </p>
                  )}

                </div>

              </div>
            );
          })}

        </div>

      ) : (

        <div
          style={{
            padding: "25px",
            borderRadius: "16px",
            background: "#f8fafc",
            color: "#64748b",
            textAlign: "center",
            marginBottom: "35px",
          }}
        >

          <div
            style={{
              fontSize: "30px",
              marginBottom: "8px",
            }}
          >
            📚
          </div>

          <strong>
            No subjects available
          </strong>

          <p>
            This student has not added their
            subjects yet.
          </p>

        </div>
      )}

      {/* =====================================================
          TIMETABLE
          ===================================================== */}

      <div className="revision-section-heading">

        <div>

          <h3>
            Timetable 🗓️
          </h3>

          <p>
            See this student's weekly timetable.
          </p>

        </div>

      </div>

      {timetable.length > 0 ? (

        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "20px",
            marginBottom: "30px",
          }}
        >

          {days.map(function (day) {

            const dayLessons =
              getTimetableDay(day.number);

            return (
              <div
                key={day.number}
                style={{
                  background: "white",
                  borderRadius: "18px",
                  border: "1px solid #e2e8f0",
                  overflow: "hidden",
                }}
              >

                {/* DAY HEADER */}

                <div
                  style={{
                    padding: "15px 20px",
                    background: "#f8fafc",
                    borderBottom:
                      "1px solid #e2e8f0",
                  }}
                >

                  <h3 style={{ margin: 0 }}>
                    {day.name}
                  </h3>

                </div>

                {/* LESSONS */}

                {dayLessons.length > 0 ? (

                  <div
                    style={{
                      padding: "15px",
                      display: "flex",
                      flexDirection: "column",
                      gap: "10px",
                    }}
                  >

                    {dayLessons.map(function (
                      lesson,
                      index
                    ) {

                      return (
                        <div
                          key={
                            lesson.id ||
                            `${day.number}-${lesson.start_time}-${index}`
                          }
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: "15px",
                            padding: "14px",
                            borderRadius: "12px",
                            background: "#f8fafc",
                            flexWrap: "wrap",
                          }}
                        >

                          {/* TIME */}

                          <div
                            style={{
                              minWidth: "120px",
                              fontWeight: "600",
                              color: "#4f46e5",
                              fontSize: "13px",
                            }}
                          >

                            {formatTime(
                              lesson.start_time
                            )}

                            {lesson.end_time && (
                              <span>
                                {" - "}
                                {formatTime(
                                  lesson.end_time
                                )}
                              </span>
                            )}

                          </div>

                          {/* LESSON INFO */}

                          <div
                            style={{
                              flex: 1,
                              minWidth: "180px",
                            }}
                          >

                            <strong
                              style={{
                                fontSize: "15px",
                              }}
                            >
                              {lesson.subject ||
                                "Lesson"}
                            </strong>

                            {lesson.period_name && (
                              <div
                                style={{
                                  fontSize: "13px",
                                  color: "#64748b",
                                  marginTop: "3px",
                                }}
                              >
                                {lesson.period_name}
                              </div>
                            )}

                            {(lesson.teacher ||
                              lesson.room) && (

                              <div
                                style={{
                                  fontSize: "13px",
                                  color: "#64748b",
                                  marginTop: "5px",
                                }}
                              >

                                {lesson.teacher && (
                                  <span>
                                    👨‍🏫{" "}
                                    {lesson.teacher}
                                  </span>
                                )}

                                {lesson.teacher &&
                                  lesson.room && (
                                    <span>
                                      {" • "}
                                    </span>
                                  )}

                                {lesson.room && (
                                  <span>
                                    📍{" "}
                                    {lesson.room}
                                  </span>
                                )}

                              </div>
                            )}

                          </div>

                        </div>
                      );
                    })}

                  </div>

                ) : (

                  <div
                    style={{
                      padding: "18px",
                      color: "#94a3b8",
                      fontSize: "14px",
                    }}
                  >
                    No lessons scheduled.
                  </div>

                )}

              </div>
            );
          })}

        </div>

      ) : (

        <div
          style={{
            padding: "30px",
            borderRadius: "18px",
            background: "#f8fafc",
            color: "#64748b",
            textAlign: "center",
            marginBottom: "30px",
          }}
        >

          <div
            style={{
              fontSize: "40px",
              marginBottom: "10px",
            }}
          >
            🗓️
          </div>

          <strong>
            No timetable available
          </strong>

          <p>
            This student has not added their
            timetable yet.
          </p>

        </div>

      )}

    </div>
  );
}

export default StudentProfile;
