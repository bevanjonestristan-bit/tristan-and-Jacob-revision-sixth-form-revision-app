
import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";

function StudentProfile({ setPage, studentId, onBack }) {
  const [student, setStudent] = useState(null);
  const [subjects, setSubjects] = useState([]);
  const [timetable, setTimetable] = useState([]);
  const [friendStatus, setFriendStatus] = useState("none");
  const [friendSince, setFriendSince] = useState(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (studentId) {
      loadStudentProfile();
    }
  }, [studentId]);

  async function loadStudentProfile() {
    try {
      setLoading(true);
      setMessage("");

      const {
        data: { user: currentUser },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError || !currentUser) {
        setPage("login");
        return;
      }

      /*
       * LOAD PROFILE
       */

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

      /*
       * LOAD SUBJECTS
       */

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

      /*
       * LOAD TIMETABLE
       */

      const {
        data: timetableData,
        error: timetableError,
      } = await supabase
        .from("timetable")
        .select("*")
        .eq("user_id", studentId)
        .order("day")
        .order("start_time");

      if (timetableError) {
        console.warn(
          "Could not load timetable:",
          timetableError.message
        );

        setTimetable([]);
      } else {
        setTimetable(timetableData || []);
      }

      /*
       * LOAD FRIENDSHIP STATUS
       */

      if (currentUser.id === studentId) {
        setFriendStatus("you");
        setFriendSince(null);
      } else {
        const {
          data: friendshipData,
          error: friendshipError,
        } = await supabase
          .from("friend_requests")
          .select(
            "id, sender_id, receiver_id, status, created_at"
          )
          .or(
            `and(sender_id.eq.${currentUser.id},receiver_id.eq.${studentId}),and(sender_id.eq.${studentId},receiver_id.eq.${currentUser.id})`
          )
          .order("created_at", {
            ascending: false,
          });

        if (friendshipError) {
          console.warn(
            "Could not load friendship status:",
            friendshipError.message
          );

          setFriendStatus("none");
          setFriendSince(null);
        } else {
          const relationship =
            friendshipData &&
            friendshipData.length > 0
              ? friendshipData[0]
              : null;

          if (!relationship) {
            setFriendStatus("none");
            setFriendSince(null);
          } else if (
            relationship.status === "accepted"
          ) {
            setFriendStatus("friends");
            setFriendSince(
              relationship.created_at
            );
          } else if (
            relationship.sender_id ===
              currentUser.id &&
            relationship.status === "pending"
          ) {
            setFriendStatus("sent");
            setFriendSince(null);
          } else if (
            relationship.receiver_id ===
              currentUser.id &&
            relationship.status === "pending"
          ) {
            setFriendStatus("incoming");
            setFriendSince(null);
          } else {
            setFriendStatus("none");
            setFriendSince(null);
          }
        }
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

  /*
   * FORMAT TIME
   */

  function formatTime(time) {
    if (!time) {
      return "";
    }

    var parts = String(time).split(":");

    if (parts.length < 2) {
      return String(time);
    }

    var hours = Number(parts[0]);
    var minutes = parts[1];

    var suffix = hours >= 12 ? "PM" : "AM";

    var displayHour =
      hours % 12 === 0
        ? 12
        : hours % 12;

    return (
      String(displayHour) +
      ":" +
      String(minutes) +
      " " +
      suffix
    );
  }

  /*
   * FORMAT FRIENDSHIP DATE
   */

  function formatFriendDate(date) {
    if (!date) {
      return "";
    }

    var parsedDate = new Date(date);

    if (Number.isNaN(parsedDate.getTime())) {
      return "";
    }

    return parsedDate.toLocaleDateString(
      "en-GB",
      {
        day: "numeric",
        month: "long",
        year: "numeric",
      }
    );
  }

  /*
   * GET TIMETABLE DAY
   */

  function getTimetableDay(day) {
    return timetable.filter(function (item) {
      var itemDay = String(
        item.day || ""
      ).toLowerCase();

      return (
        itemDay === day.toLowerCase()
      );
    });
  }

  /*
   * LOADING
   */

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

  /*
   * PROFILE NOT FOUND
   */

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
          This student's profile could not
          be found.
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

  var days = [
    "Monday",
    "Tuesday",
    "Wednesday",
    "Thursday",
    "Friday",
  ];

  return (
    <div>

      {/* HEADER */}

      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "15px",
          marginBottom: "25px",
        }}
      >
        <button
          type="button"
          onClick={onBack}
          style={{
            border:
              "1px solid #dbe3ef",
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
            STUDENT PROFILE
          </p>

          <h2
            style={{
              margin: 0,
            }}
          >
            {student.full_name ||
              "Student"}{" "}
            👤
          </h2>
        </div>
      </div>

      {/* MESSAGE */}

      {message && (
        <div
          className="auth-error"
          style={{
            marginBottom: "20px",
          }}
        >
          {message}
        </div>
      )}

      {/* PROFILE CARD */}

      <div
        style={{
          background: "white",
          borderRadius: "20px",
          border:
            "1px solid #e2e8f0",
          padding: "25px",
          marginBottom: "30px",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "20px",
            flexWrap: "wrap",
          }}
        >

          {/* AVATAR */}

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

          {/* DETAILS */}

          <div
            style={{
              flex: 1,
              minWidth: "200px",
            }}
          >
            <h2
              style={{
                margin: 0,
              }}
            >
              {student.full_name ||
                "Student"}
            </h2>

            <p
              style={{
                margin: "6px 0 0",
                color: "#64748b",
              }}
            >
              {student.year_group ||
                "Sixth Form"}
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

          {/* FRIEND STATUS */}

          <div
            style={{
              minWidth: "150px",
              textAlign: "center",
            }}
          >

            {friendStatus === "you" && (
              <div
                style={{
                  padding: "10px 14px",
                  borderRadius: "12px",
                  background: "#eef2ff",
                  color: "#4f46e5",
                  fontWeight: "600",
                  fontSize: "14px",
                }}
              >
                👤 Your Profile
              </div>
            )}

            {friendStatus === "friends" && (
              <div>
                <div
                  style={{
                    padding: "10px 14px",
                    borderRadius: "12px",
                    background: "#ecfdf5",
                    color: "#047857",
                    fontWeight: "600",
                    fontSize: "14px",
                  }}
                >
                  ✓ Friends
                </div>

                {friendSince && (
                  <p
                    style={{
                      margin:
                        "8px 0 0",
                      fontSize: "12px",
                      color: "#64748b",
                    }}
                  >
                    Friends since{" "}
                    {formatFriendDate(
                      friendSince
                    )}
                  </p>
                )}
              </div>
            )}

            {friendStatus === "sent" && (
              <div
                style={{
                  padding: "10px 14px",
                  borderRadius: "12px",
                  background: "#f1f5f9",
                  color: "#64748b",
                  fontWeight: "600",
                  fontSize: "14px",
                }}
              >
                📤 Request Sent
              </div>
            )}

            {friendStatus === "incoming" && (
              <div
                style={{
                  padding: "10px 14px",
                  borderRadius: "12px",
                  background: "#fff7ed",
                  color: "#c2410c",
                  fontWeight: "600",
                  fontSize: "14px",
                }}
              >
                📥 Friend Request
              </div>
            )}

            {friendStatus === "none" && (
              <div
                style={{
                  padding: "10px 14px",
                  borderRadius: "12px",
                  background: "#f8fafc",
                  color: "#64748b",
                  fontWeight: "600",
                  fontSize: "14px",
                }}
              >
                👥 Student
              </div>
            )}

          </div>
        </div>
      </div>

      {/* QUICK INFORMATION */}

      <div
        style={{
          display: "grid",
          gridTemplateColumns:
            "repeat(auto-fit, minmax(160px, 1fr))",
          gap: "15px",
          marginBottom: "35px",
        }}
      >

        <div
          style={{
            background: "white",
            borderRadius: "16px",
            border:
              "1px solid #e2e8f0",
            padding: "20px",
            textAlign: "center",
          }}
        >
          <div
            style={{
              fontSize: "26px",
              marginBottom: "6px",
            }}
          >
            📚
          </div>

          <strong
            style={{
              fontSize: "22px",
            }}
          >
            {subjects.length}
          </strong>

          <p
            style={{
              margin: "4px 0 0",
              color: "#64748b",
              fontSize: "14px",
            }}
          >
            Subjects
          </p>
        </div>

        <div
          style={{
            background: "white",
            borderRadius: "16px",
            border:
              "1px solid #e2e8f0",
            padding: "20px",
            textAlign: "center",
          }}
        >
          <div
            style={{
              fontSize: "26px",
              marginBottom: "6px",
            }}
          >
            🗓️
          </div>

          <strong
            style={{
              fontSize: "22px",
            }}
          >
            {timetable.length}
          </strong>

          <p
            style={{
              margin: "4px 0 0",
              color: "#64748b",
              fontSize: "14px",
            }}
          >
            Lessons
          </p>
        </div>

        <div
          style={{
            background: "white",
            borderRadius: "16px",
            border:
              "1px solid #e2e8f0",
            padding: "20px",
            textAlign: "center",
          }}
        >
          <div
            style={{
              fontSize: "26px",
              marginBottom: "6px",
            }}
          >
            🤝
          </div>

          <strong
            style={{
              fontSize: "18px",
            }}
          >
            {friendStatus === "friends"
              ? "Friends"
              : friendStatus === "you"
              ? "You"
              : "Not friends"}
          </strong>

          <p
            style={{
              margin: "4px 0 0",
              color: "#64748b",
              fontSize: "14px",
            }}
          >
            Connection
          </p>
        </div>

      </div>

      {/* SUBJECTS */}

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
          {subjects.map(function (subject) {
            return (
              <div
                key={
                  subject.id ||
                  subject.subject_id ||
                  subject.name ||
                  subject.subject_name
                }
                className="revision-subject-card"
              >
                <div className="revision-subject-top">
                  <div className="revision-subject-icon">
                    📚
                  </div>

                  <div className="revision-subject-arrow">
                    →
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
                      📝{" "}
                      {subject.exam_board}
                    </p>
                  )}

                  {subject.level && (
                    <p>
                      🎓{" "}
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

      {/* TIMETABLE */}

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
            var dayLessons =
              getTimetableDay(day);

            return (
              <div
                key={day}
                style={{
                  background: "white",
                  borderRadius: "18px",
                  border:
                    "1px solid #e2e8f0",
                  overflow: "hidden",
                }}
              >
                {/* DAY HEADER */}

                <div
                  style={{
                    padding:
                      "15px 20px",
                    background:
                      "#f8fafc",
                    borderBottom:
                      "1px solid #e2e8f0",
                  }}
                >
                  <h3
                    style={{
                      margin: 0,
                    }}
                  >
                    {day}
                  </h3>
                </div>

                {/* LESSONS */}

                {dayLessons.length > 0 ? (
                  <div
                    style={{
                      padding: "15px",
                      display:
                        "flex",
                      flexDirection:
                        "column",
                      gap: "10px",
                    }}
                  >
                    {dayLessons.map(
                      function (lesson) {
                        return (
                          <div
                            key={
                              lesson.id ||
                              String(day) +
                                String(
                                  lesson.start_time ||
                                    ""
                                )
                            }
                            style={{
                              display:
                                "flex",
                              alignItems:
                                "center",
                              gap: "15px",
                              padding:
                                "14px",
                              borderRadius:
                                "12px",
                              background:
                                "#f8fafc",
                              flexWrap:
                                "wrap",
                            }}
                          >

                            {/* TIME */}

                            <div
                              style={{
                                minWidth:
                                  "95px",
                                fontWeight:
                                  "600",
                                color:
                                  "#4f46e5",
                                fontSize:
                                  "13px",
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

                            {/* LESSON */}

                            <div
                              style={{
                                flex: 1,
                                minWidth:
                                  "180px",
                              }}
                            >
                              <strong>
                                {lesson.subject ||
                                  lesson.subject_name ||
                                  lesson.name ||
                                  "Lesson"}
                              </strong>

                              {(lesson.teacher ||
                                lesson.room) && (
                                <div
                                  style={{
                                    fontSize:
                                      "13px",
                                    color:
                                      "#64748b",
                                    marginTop:
                                      "4px",
                                  }}
                                >

                                  {lesson.teacher && (
                                    <span>
                                      👨‍🏫{" "}
                                      {
                                        lesson.teacher
                                      }
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
                                      {
                                        lesson.room
                                      }
                                    </span>
                                  )}

                                </div>
                              )}
                            </div>

                          </div>
                        );
                      }
                    )}
                  </div>
                ) : (
                  <div
                    style={{
                      padding: "18px",
                      color:
                        "#94a3b8",
                      fontSize:
                        "14px",
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
            padding: "25px",
            borderRadius: "16px",
            background: "#f8fafc",
            color: "#64748b",
            textAlign: "center",
          }}
        >
          <div
            style={{
              fontSize: "30px",
              marginBottom: "8px",
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
