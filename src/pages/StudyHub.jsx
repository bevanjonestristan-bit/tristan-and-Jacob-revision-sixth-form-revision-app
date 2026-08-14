import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";

function StudyHub({ setPage, onOpenStudyRoom }) {
  const [sessions, setSessions] = useState([]);
  const [friends, setFriends] = useState([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState("");

  const [showCreate, setShowCreate] = useState(false);
  const [sessionName, setSessionName] = useState("");
  const [sessionSubject, setSessionSubject] = useState("");
  const [sessionDescription, setSessionDescription] = useState("");

  const [currentUser, setCurrentUser] = useState(null);
  const [joinedSessionId, setJoinedSessionId] = useState(null);

  useEffect(() => {
    loadStudyHub();

    const sessionChannel = supabase
      .channel("study-hub-sessions")

      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "study_sessions",
        },
        () => {
          loadSessions();
        }
      )

      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "study_session_members",
        },
        () => {
          loadSessions();
        }
      )

      .subscribe();

    const interval = setInterval(() => {
      loadSessions();
    }, 10000);

    return () => {
      clearInterval(interval);
      supabase.removeChannel(sessionChannel);
    };
  }, []);

  async function loadStudyHub() {
    try {
      setLoading(true);
      setError("");

      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError || !user) {
        setPage("login");
        return;
      }

      setCurrentUser(user);

      await Promise.all([
        loadSessions(),
        loadFriends(user.id),
      ]);
    } catch (err) {
      console.error("Study Hub error:", err);

      setError(
        "Something went wrong while loading the Study Hub."
      );
    } finally {
      setLoading(false);
    }
  }

  async function loadSessions() {
    try {
      const {
        data,
        error: sessionsError,
      } = await supabase
        .from("study_sessions")
        .select(`
          id,
          name,
          subject,
          description,
          created_at,
          created_by,
          host_id,
          max_members,
          is_active,
          study_session_members (
            id,
            user_id,
            joined_at,
            left_at
          )
        `)
        .eq("is_active", true)
        .order("created_at", {
          ascending: false,
        });

      if (sessionsError) {
        throw sessionsError;
      }

      const activeSessions = [];

      for (const session of data || []) {
        const members = (
          session.study_session_members || []
        ).filter(
          (member) => member.left_at === null
        );

        /*
         * If nobody is currently in the session,
         * deactivate it.
         */

        if (members.length === 0) {
          await supabase
            .from("study_sessions")
            .update({
              is_active: false,
            })
            .eq("id", session.id);

          continue;
        }

        activeSessions.push({
          ...session,
          members,
        });
      }

      setSessions(activeSessions);

      if (currentUser) {
        const joined = activeSessions.find(
          (session) =>
            session.members.some(
              (member) =>
                member.user_id === currentUser.id
            )
        );

        setJoinedSessionId(
          joined ? joined.id : null
        );
      }
    } catch (err) {
      console.error(
        "Could not load study sessions:",
        err
      );

      setError(
        "Could not load study sessions."
      );
    }
  }

  async function loadFriends(userId) {
    try {
      const {
        data,
        error: friendsError,
      } = await supabase
        .from("friends")
        .select("*")
        .or(
          `user_id.eq.${userId},friend_id.eq.${userId}`
        );

      if (friendsError) {
        console.warn(
          "Could not load friends:",
          friendsError.message
        );

        setFriends([]);
        return;
      }

      setFriends(data || []);
    } catch (err) {
      console.warn(
        "Friends loading error:",
        err
      );

      setFriends([]);
    }
  }

  async function createSession(event) {
    event.preventDefault();

    if (!currentUser) {
      return;
    }

    if (!sessionName.trim()) {
      setError(
        "Please enter a session name."
      );
      return;
    }

    try {
      setCreating(true);
      setError("");

      const {
        data: session,
        error: createError,
      } = await supabase
        .from("study_sessions")
        .insert({
          name: sessionName.trim(),
          subject:
            sessionSubject.trim() || null,
          description:
            sessionDescription.trim() || null,
          created_by: currentUser.id,
          host_id: currentUser.id,
          max_members: 10,
          is_active: true,
        })
        .select()
        .single();

      if (createError) {
        throw createError;
      }

      /*
       * Creator automatically joins their own session.
       */

      const {
        error: memberError,
      } = await supabase
        .from("study_session_members")
        .insert({
          session_id: session.id,
          user_id: currentUser.id,
        });

      if (memberError) {
        await supabase
          .from("study_sessions")
          .delete()
          .eq("id", session.id);

        throw memberError;
      }

      setSessionName("");
      setSessionSubject("");
      setSessionDescription("");
      setShowCreate(false);

      await loadSessions();

      /*
       * Automatically open the newly created room.
       */

      if (onOpenStudyRoom) {
        onOpenStudyRoom(session.id);
      }
    } catch (err) {
      console.error(
        "Could not create study session:",
        err
      );

      setError(
        err?.message ||
          "Could not create study session."
      );
    } finally {
      setCreating(false);
    }
  }

  async function joinSession(sessionId) {
    if (!currentUser) {
      return;
    }

    try {
      setError("");

      /*
       * Leave any other active session first.
       */

      if (joinedSessionId) {
        await supabase
          .from("study_session_members")
          .update({
            left_at: new Date().toISOString(),
          })
          .eq("user_id", currentUser.id)
          .is("left_at", null);
      }

      const {
        error: joinError,
      } = await supabase
        .from("study_session_members")
        .insert({
          session_id: sessionId,
          user_id: currentUser.id,
        });

      if (joinError) {
        throw joinError;
      }

      setJoinedSessionId(sessionId);

      await loadSessions();
    } catch (err) {
      console.error(
        "Could not join study session:",
        err
      );

      setError(
        err?.message ||
          "Could not join study session."
      );
    }
  }

  async function leaveSession(sessionId) {
    if (!currentUser) {
      return;
    }

    try {
      setError("");

      const {
        error: leaveError,
      } = await supabase
        .from("study_session_members")
        .update({
          left_at: new Date().toISOString(),
        })
        .eq("session_id", sessionId)
        .eq("user_id", currentUser.id)
        .is("left_at", null);

      if (leaveError) {
        throw leaveError;
      }

      setJoinedSessionId(null);

      /*
       * Check whether anyone remains.
       */

      const {
        count,
        error: countError,
      } = await supabase
        .from("study_session_members")
        .select("*", {
          count: "exact",
          head: true,
        })
        .eq("session_id", sessionId)
        .is("left_at", null);

      if (!countError && count === 0) {
        await supabase
          .from("study_sessions")
          .update({
            is_active: false,
          })
          .eq("id", sessionId);
      }

      await loadSessions();
    } catch (err) {
      console.error(
        "Could not leave study session:",
        err
      );

      setError(
        err?.message ||
          "Could not leave study session."
      );
    }
  }

  function openStudyRoom(sessionId) {
    if (!sessionId) {
      return;
    }

    if (onOpenStudyRoom) {
      onOpenStudyRoom(sessionId);
    } else {
      console.error(
        "StudyHub: onOpenStudyRoom was not provided."
      );
    }
  }

  function formatDuration(createdAt) {
    if (!createdAt) {
      return "0m";
    }

    const start = new Date(createdAt);
    const now = new Date();

    const difference = Math.max(
      0,
      now - start
    );

    const totalMinutes = Math.floor(
      difference / 60000
    );

    const hours = Math.floor(
      totalMinutes / 60
    );

    const minutes =
      totalMinutes % 60;

    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    }

    return `${minutes}m`;
  }

  function isJoined(session) {
    if (!currentUser) {
      return false;
    }

    return session.members.some(
      (member) =>
        member.user_id === currentUser.id
    );
  }

  if (loading) {
    return (
      <div className="no-subjects">
        <div className="no-subjects-icon">
          🧠
        </div>

        <h2>
          Loading Study Hub...
        </h2>

        <p>
          Finding active study sessions.
        </p>
      </div>
    );
  }

  return (
    <div className="study-hub">

      {/* HEADER */}

      <div className="revision-header">

        <div>
          <p className="card-eyebrow">
            STUDY TOGETHER
          </p>

          <h2>
            Study Hub 🧠
          </h2>

          <p className="revision-description">
            Join other students, study together
            and stay focused.
          </p>
        </div>

        <button
          type="button"
          className="manage-subjects-button"
          onClick={() =>
            setShowCreate(true)
          }
        >
          ➕ Create Session
        </button>

      </div>

      {/* ERROR */}

      {error && (
        <div className="revision-information">
          <div className="revision-information-icon">
            ⚠️
          </div>

          <div>
            <strong>
              Something went wrong
            </strong>

            <p>
              {error}
            </p>
          </div>
        </div>
      )}

      {/* ACTIVE SESSIONS */}

      <div className="revision-section-heading">

        <div>
          <h3>
            🟢 Active Study Sessions
          </h3>

          <p>
            {sessions.length === 0
              ? "No one is studying right now."
              : `${sessions.length} active ${
                  sessions.length === 1
                    ? "session"
                    : "sessions"
                }`}
          </p>
        </div>

      </div>

      {sessions.length === 0 ? (

        <div className="no-subjects">

          <div className="no-subjects-icon">
            📚
          </div>

          <h3>
            No active sessions
          </h3>

          <p>
            Start a study session and invite
            your friends to join you.
          </p>

          <button
            type="button"
            className="primary-card-button"
            onClick={() =>
              setShowCreate(true)
            }
          >
            ➕ Create Study Session
          </button>

        </div>

      ) : (

        <div className="revision-subject-grid">

          {sessions.map((session) => {

            const joined =
              isJoined(session);

            return (
              <div
                key={session.id}
                className="revision-subject-card"
              >

                <div className="revision-subject-top">

                  <div className="revision-subject-icon">
                    🧠
                  </div>

                  <div className="revision-subject-arrow">
                    {joined ? "🟢" : "→"}
                  </div>

                </div>

                <div className="revision-subject-content">

                  <h3>
                    {session.name}
                  </h3>

                  {session.subject && (
                    <p>
                      📚 {session.subject}
                    </p>
                  )}

                  {session.description && (
                    <p>
                      {session.description}
                    </p>
                  )}

                </div>

                {/* SESSION INFO */}

                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: "8px",
                    marginTop: "15px",
                  }}
                >

                  <div>
                    ⏱️{" "}
                    <strong>
                      {formatDuration(
                        session.created_at
                      )}
                    </strong>
                  </div>

                  <div>
                    👥{" "}
                    <strong>
                      {session.members.length}
                    </strong>{" "}
                    {session.members.length === 1
                      ? "person"
                      : "people"}{" "}
                    studying
                  </div>

                </div>

                {/* MEMBERS */}

                <div
                  style={{
                    marginTop: "15px",
                  }}
                >

                  <strong>
                    People in session
                  </strong>

                  <div
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      gap: "6px",
                      marginTop: "8px",
                    }}
                  >

                    {session.members.map(
                      (member) => (
                        <div
                          key={member.id}
                          style={{
                            display: "flex",
                            alignItems:
                              "center",
                            gap: "8px",
                          }}
                        >
                          <span>
                            🟢
                          </span>

                          <span>
                            {member.user_id ===
                            currentUser?.id
                              ? "You"
                              : "Student"}
                          </span>
                        </div>
                      )
                    )}

                  </div>

                </div>

                {/* JOIN / OPEN / LEAVE */}

                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: "10px",
                    marginTop: "15px",
                  }}
                >

                  {joined ? (

                    <>
                      <button
                        type="button"
                        className="primary-card-button"
                        onClick={() =>
                          openStudyRoom(
                            session.id
                          )
                        }
                      >
                        🚀 Open Study Room
                      </button>

                      <button
                        type="button"
                        className="primary-card-button"
                        onClick={() =>
                          leaveSession(
                            session.id
                          )
                        }
                      >
                        🚪 Leave Session
                      </button>
                    </>

                  ) : (

                    <button
                      type="button"
                      className="primary-card-button"
                      onClick={() =>
                        joinSession(
                          session.id
                        )
                      }
                    >
                      👥 Join Session
                    </button>

                  )}

                </div>

              </div>
            );
          })}

        </div>

      )}

      {/* CREATE SESSION MODAL */}

      {showCreate && (

        <div
          style={{
            position: "fixed",
            inset: 0,
            background:
              "rgba(0, 0, 0, 0.55)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1000,
            padding: "20px",
          }}
        >

          <div
            style={{
              width: "100%",
              maxWidth: "500px",
              background: "white",
              borderRadius: "20px",
              padding: "30px",
              boxShadow:
                "0 20px 60px rgba(0,0,0,0.25)",
            }}
          >

            <h2>
              Create Study Session
            </h2>

            <p>
              Start a session and let other
              students join you.
            </p>

            <form
              onSubmit={createSession}
            >

              <input
                type="text"
                placeholder="Session name"
                value={sessionName}
                onChange={(event) =>
                  setSessionName(
                    event.target.value
                  )
                }
                required
              />

              <input
                type="text"
                placeholder="Subject (optional)"
                value={sessionSubject}
                onChange={(event) =>
                  setSessionSubject(
                    event.target.value
                  )
                }
              />

              <textarea
                placeholder="What are you studying? (optional)"
                value={sessionDescription}
                onChange={(event) =>
                  setSessionDescription(
                    event.target.value
                  )
                }
                rows={4}
              />

              <div
                style={{
                  display: "flex",
                  gap: "10px",
                  marginTop: "15px",
                }}
              >

                <button
                  type="button"
                  className="primary-card-button"
                  onClick={() =>
                    setShowCreate(false)
                  }
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  className="primary-card-button"
                  disabled={creating}
                >
                  {creating
                    ? "Creating..."
                    : "Create Session"}
                </button>

              </div>

            </form>

          </div>

        </div>

      )}

    </div>
  );
}

export default StudyHub;