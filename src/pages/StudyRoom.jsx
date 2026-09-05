
import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import VoiceChat from "./VoiceChat";

function StudyRoom({ setPage, sessionId, onBack }) {
  const [session, setSession] = useState(null);
  const [members, setMembers] = useState([]);
  const [currentUser, setCurrentUser] = useState(null);

  const [loading, setLoading] = useState(true);
  const [leaving, setLeaving] = useState(false);
  const [error, setError] = useState("");

  const [messages, setMessages] = useState([]);
  const [messageText, setMessageText] = useState("");
  const [sendingMessage, setSendingMessage] = useState(false);

  const [studyStatus, setStudyStatus] = useState("Studying");

  useEffect(() => {
    if (!sessionId) {
      onBack();
      return;
    }

    initialise();

    const roomChannel = supabase
      .channel(`study-room-${sessionId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "study_sessions",
          filter: `id=eq.${sessionId}`,
        },
        () => {
          loadRoom();
        }
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "study_session_members",
          filter: `session_id=eq.${sessionId}`,
        },
        () => {
          loadMembers();
        }
      )
      .subscribe();

    const messageChannel = supabase
      .channel(`study-room-messages-${sessionId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "study_session_messages",
          filter: `session_id=eq.${sessionId}`,
        },
        () => {
          loadMessages();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(roomChannel);
      supabase.removeChannel(messageChannel);
    };
  }, [sessionId]);

  async function initialise() {
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
        loadRoom(),
        loadMembers(),
        loadMessages(),
      ]);
    } catch (err) {
      console.error(
        "Study Room initialisation:",
        err
      );

      setError(
        err?.message ||
          "Could not load the study room."
      );
    } finally {
      setLoading(false);
    }
  }

  async function loadRoom() {
    try {
      const {
        data,
        error: roomError,
      } = await supabase
        .from("study_sessions")
        .select(`
          id,
          name,
          subject,
          subject_id,
          description,
          host_id,
          created_by,
          max_members,
          is_active,
          created_at
        `)
        .eq("id", sessionId)
        .single();

      if (roomError) {
        throw roomError;
      }

      if (!data || !data.is_active) {
        setError(
          "This study room is no longer active."
        );
        return;
      }

      setSession(data);
    } catch (err) {
      console.error(
        "Could not load study room:",
        err
      );

      setError(
        err?.message ||
          "Could not load the study room."
      );
    }
  }

  async function loadMembers() {
    try {
      const {
        data,
        error: membersError,
      } = await supabase
        .from("study_session_members")
        .select(`
          id,
          user_id,
          joined_at,
          left_at
        `)
        .eq("session_id", sessionId)
        .is("left_at", null)
        .order("joined_at", {
          ascending: true,
        });

      if (membersError) {
        throw membersError;
      }

      setMembers(data || []);
    } catch (err) {
      console.error(
        "Could not load room members:",
        err
      );

      setError(
        err?.message ||
          "Could not load room members."
      );
    }
  }

  async function loadMessages() {
    try {
      const {
        data,
        error: messagesError,
      } = await supabase
        .from("study_session_messages")
        .select(`
          id,
          session_id,
          sender_id,
          content,
          created_at
        `)
        .eq("session_id", sessionId)
        .order("created_at", {
          ascending: true,
        });

      if (messagesError) {
        throw messagesError;
      }

      setMessages(data || []);
    } catch (err) {
      console.error(
        "Could not load messages:",
        err
      );

      setMessages([]);

      setError(
        err?.message ||
          "Could not load room messages."
      );
    }
  }

  async function sendMessage(event) {
    event.preventDefault();

    if (!currentUser) {
      setError(
        "You must be logged in to send a message."
      );
      return;
    }

    const text = messageText.trim();

    if (!text) {
      return;
    }

    try {
      setSendingMessage(true);
      setError("");

      const {
        error: messageError,
      } = await supabase
        .from("study_session_messages")
        .insert({
          session_id: sessionId,
          sender_id: currentUser.id,
          content: text,
        });

      if (messageError) {
        throw messageError;
      }

      setMessageText("");

      await loadMessages();
    } catch (err) {
      console.error(
        "Could not send message:",
        err
      );

      setError(
        err?.message ||
          "Could not send your message."
      );
    } finally {
      setSendingMessage(false);
    }
  }

  async function leaveRoom() {
    if (!currentUser) {
      return;
    }

    try {
      setLeaving(true);
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

      if (countError) {
        throw countError;
      }

      if (count === 0) {
        await supabase
          .from("study_sessions")
          .update({
            is_active: false,
          })
          .eq("id", sessionId);
      }

      onBack();
    } catch (err) {
      console.error(
        "Could not leave study room:",
        err
      );

      setError(
        err?.message ||
          "Could not leave the study room."
      );
    } finally {
      setLeaving(false);
    }
  }

  function isHost() {
    if (!currentUser || !session) {
      return false;
    }

    return session.host_id === currentUser.id;
  }

  function formatTime(timestamp) {
    if (!timestamp) {
      return "";
    }

    const date = new Date(timestamp);

    return date.toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  function formatDuration(createdAt) {
    if (!createdAt) {
      return "Just started";
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

    if (minutes === 0) {
      return "Just started";
    }

    return `${minutes}m`;
  }

  if (loading) {
    return (
      <div className="study-hub">
        <div className="no-subjects">
          <div className="no-subjects-icon">
            🧠
          </div>

          <h2>
            Entering Study Room...
          </h2>

          <p>
            Getting everything ready.
          </p>
        </div>
      </div>
    );
  }

  if (!session) {
    return (
      <div className="study-hub">
        <div className="no-subjects">
          <div className="no-subjects-icon">
            😕
          </div>

          <h2>
            Study Room unavailable
          </h2>

          <p>
            {error ||
              "This study room could not be found."}
          </p>

          <button
            type="button"
            className="primary-card-button"
            onClick={onBack}
          >
            ← Back to Study Hub
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="study-hub">

      {/* HEADER */}

      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          gap: "20px",
          marginBottom: "25px",
        }}
      >
        <div>
          <button
            type="button"
            onClick={onBack}
            style={{
              border: "none",
              background: "transparent",
              padding: 0,
              marginBottom: "12px",
              cursor: "pointer",
              fontWeight: 600,
            }}
          >
            ← Back to Study Hub
          </button>

          <p className="card-eyebrow">
            LIVE STUDY ROOM
          </p>

          <h2>
            {session.name} 🧠
          </h2>

          {session.subject && (
            <p className="revision-description">
              📚 {session.subject}
            </p>
          )}
        </div>

        <button
          type="button"
          className="primary-card-button"
          onClick={leaveRoom}
          disabled={leaving}
        >
          {leaving
            ? "Leaving..."
            : "🚪 Leave Room"}
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

      {/* LIVE ROOM STATUS */}

      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "8px",
          marginBottom: "25px",
          fontSize: "14px",
          opacity: 0.75,
        }}
      >
        <span
          style={{
            width: "9px",
            height: "9px",
            borderRadius: "50%",
            background: "#22c55e",
            display: "inline-block",
          }}
        />

        Live · {members.length}/
        {session.max_members} studying
      </div>

      {/* MAIN GRID */}

      <div
        style={{
          display: "grid",
          gridTemplateColumns:
            "minmax(0, 1.5fr) minmax(300px, 1fr)",
          gap: "25px",
          alignItems: "start",
        }}
      >

        {/* LEFT */}

        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "25px",
          }}
        >

          {/* STUDY FOCUS */}

          <div
            style={{
              background: "white",
              borderRadius: "20px",
              border: "1px solid #e2e8f0",
              padding: "25px",
            }}
          >
            <p className="card-eyebrow">
              STUDY FOCUS
            </p>

            <h3>
              📚 What everyone is studying
            </h3>

            {session.description ? (
              <p
                style={{
                  color: "#64748b",
                  lineHeight: 1.6,
                }}
              >
                {session.description}
              </p>
            ) : (
              <p
                style={{
                  color: "#94a3b8",
                }}
              >
                No study focus has been added
                yet.
              </p>
            )}

            <div
              style={{
                display: "grid",
                gridTemplateColumns:
                  "1fr 1fr",
                gap: "12px",
                marginTop: "20px",
              }}
            >
              <div
                style={{
                  padding: "14px",
                  borderRadius: "12px",
                  background: "#f8fafc",
                }}
              >
                <div
                  style={{
                    fontSize: "12px",
                    opacity: 0.6,
                  }}
                >
                  ROOM ACTIVE
                </div>

                <strong>
                  ⏱️{" "}
                  {formatDuration(
                    session.created_at
                  )}
                </strong>
              </div>

              <div
                style={{
                  padding: "14px",
                  borderRadius: "12px",
                  background: "#f8fafc",
                }}
              >
                <div
                  style={{
                    fontSize: "12px",
                    opacity: 0.6,
                  }}
                >
                  YOUR STATUS
                </div>

                <strong>
                  🟢 {studyStatus}
                </strong>
              </div>
            </div>
          </div>

          {/* VOICE CHAT */}

          <VoiceChat
            sessionId={sessionId}
            currentUser={currentUser}
          />

          {/* STATUS */}

          <div
            style={{
              background: "white",
              borderRadius: "20px",
              border: "1px solid #e2e8f0",
              padding: "25px",
            }}
          >
            <p className="card-eyebrow">
              YOUR STUDY STATUS
            </p>

            <h3>
              What are you doing?
            </h3>

            <div
              style={{
                display: "flex",
                flexWrap: "wrap",
                gap: "10px",
                marginTop: "15px",
              }}
            >
              {[
                "Studying",
                "Taking a break",
                "Doing questions",
                "Reading",
                "Revising",
              ].map((status) => (
                <button
                  key={status}
                  type="button"
                  onClick={() =>
                    setStudyStatus(status)
                  }
                  style={{
                    border:
                      studyStatus === status
                        ? "2px solid #4f46e5"
                        : "1px solid #e2e8f0",
                    background:
                      studyStatus === status
                        ? "#eef2ff"
                        : "white",
                    borderRadius: "999px",
                    padding: "9px 14px",
                    cursor: "pointer",
                    fontWeight:
                      studyStatus === status
                        ? 700
                        : 500,
                  }}
                >
                  {status}
                </button>
              ))}
            </div>
          </div>

          {/* CHAT */}

          <div
            style={{
              background: "white",
              borderRadius: "20px",
              border: "1px solid #e2e8f0",
              padding: "25px",
            }}
          >
            <p className="card-eyebrow">
              ROOM CHAT
            </p>

            <h3>
              💬 Study Chat
            </h3>

            <div
              style={{
                minHeight: "260px",
                maxHeight: "400px",
                overflowY: "auto",
                marginTop: "15px",
                padding: "10px",
                background: "#f8fafc",
                borderRadius: "14px",
              }}
            >
              {messages.length === 0 ? (
                <div
                  style={{
                    height: "240px",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    textAlign: "center",
                    color: "#94a3b8",
                  }}
                >
                  <div>
                    <div
                      style={{
                        fontSize: "30px",
                        marginBottom: "8px",
                      }}
                    >
                      💬
                    </div>

                    <strong>
                      No messages yet
                    </strong>

                    <p>
                      Start the conversation.
                    </p>
                  </div>
                </div>
              ) : (
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: "10px",
                  }}
                >
                  {messages.map((message) => {
                    const own =
                      message.sender_id ===
                      currentUser?.id;

                    return (
                      <div
                        key={message.id}
                        style={{
                          display: "flex",
                          justifyContent:
                            own
                              ? "flex-end"
                              : "flex-start",
                        }}
                      >
                        <div
                          style={{
                            maxWidth: "75%",
                            padding:
                              "10px 13px",
                            borderRadius:
                              "14px",
                            background: own
                              ? "#4f46e5"
                              : "white",
                            color: own
                              ? "white"
                              : "#0f172a",
                            boxShadow:
                              "0 1px 3px rgba(0,0,0,0.05)",
                          }}
                        >
                          <div
                            style={{
                              fontSize:
                                "13px",
                            }}
                          >
                            {own
                              ? "You"
                              : "Student"}
                          </div>

                          <div
                            style={{
                              marginTop:
                                "3px",
                            }}
                          >
                            {message.content}
                          </div>

                          <div
                            style={{
                              marginTop:
                                "5px",
                              fontSize:
                                "10px",
                              opacity: 0.6,
                            }}
                          >
                            {formatTime(
                              message.created_at
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <form
              onSubmit={sendMessage}
              style={{
                display: "flex",
                gap: "10px",
                marginTop: "15px",
              }}
            >
              <input
                type="text"
                placeholder="Type a message..."
                value={messageText}
                onChange={(event) =>
                  setMessageText(
                    event.target.value
                  )
                }
                style={{
                  flex: 1,
                }}
              />

              <button
                type="submit"
                className="primary-card-button"
                disabled={
                  sendingMessage ||
                  !messageText.trim()
                }
              >
                {sendingMessage
                  ? "..."
                  : "➤"}
              </button>
            </form>
          </div>
        </div>

        {/* RIGHT */}

        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "25px",
          }}
        >

          {/* PEOPLE */}

          <div
            style={{
              background: "white",
              borderRadius: "20px",
              border: "1px solid #e2e8f0",
              padding: "25px",
            }}
          >
            <p className="card-eyebrow">
              LIVE PRESENCE
            </p>

            <h3>
              👥 People Studying
            </h3>

            <p
              style={{
                color: "#64748b",
              }}
            >
              {members.length} of{" "}
              {session.max_members} places
              occupied
            </p>

            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: "10px",
                marginTop: "18px",
              }}
            >
              {members.map((member) => {
                const own =
                  member.user_id ===
                  currentUser?.id;

                const memberIsHost =
                  member.user_id ===
                  session.host_id;

                return (
                  <div
                    key={member.id}
                    style={{
                      display: "flex",
                      alignItems:
                        "center",
                      gap: "12px",
                      padding: "11px",
                      borderRadius: "12px",
                      background: own
                        ? "#eef2ff"
                        : "#f8fafc",
                    }}
                  >
                    <div
                      style={{
                        width: "36px",
                        height: "36px",
                        borderRadius:
                          "50%",
                        background:
                          "#e0e7ff",
                        display: "flex",
                        alignItems:
                          "center",
                        justifyContent:
                          "center",
                      }}
                    >
                      👤
                    </div>

                    <div
                      style={{
                        flex: 1,
                      }}
                    >
                      <strong>
                        {own
                          ? "You"
                          : "Student"}
                      </strong>

                      <div
                        style={{
                          fontSize:
                            "12px",
                          color:
                            "#64748b",
                        }}
                      >
                        🟢{" "}
                        {own
                          ? studyStatus
                          : "Studying"}
                      </div>
                    </div>

                    {memberIsHost && (
                      <span
                        style={{
                          fontSize:
                            "12px",
                          padding:
                            "4px 7px",
                          borderRadius:
                            "999px",
                          background:
                            "#fef3c7",
                          color:
                            "#92400e",
                        }}
                      >
                        👑 Host
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* ROOM DETAILS */}

          <div
            style={{
              background: "white",
              borderRadius: "20px",
              border: "1px solid #e2e8f0",
              padding: "25px",
            }}
          >
            <p className="card-eyebrow">
              ROOM DETAILS
            </p>

            <h3>
              ℹ️ About this room
            </h3>

            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: "13px",
                marginTop: "18px",
              }}
            >
              <div>
                <div
                  style={{
                    fontSize: "12px",
                    opacity: 0.6,
                  }}
                >
                  SUBJECT
                </div>

                <strong>
                  {session.subject ||
                    "General study"}
                </strong>
              </div>

              <div>
                <div
                  style={{
                    fontSize: "12px",
                    opacity: 0.6,
                  }}
                >
                  MAXIMUM SIZE
                </div>

                <strong>
                  {session.max_members}{" "}
                  students
                </strong>
              </div>

              <div>
                <div
                  style={{
                    fontSize: "12px",
                    opacity: 0.6,
                  }}
                >
                  STARTED
                </div>

                <strong>
                  {formatDuration(
                    session.created_at
                  )}{" "}
                  ago
                </strong>
              </div>

              {isHost() && (
                <div
                  style={{
                    padding: "12px",
                    borderRadius: "12px",
                    background: "#fef3c7",
                    color: "#92400e",
                    fontSize: "13px",
                  }}
                >
                  👑 You are the host of
                  this study room.
                </div>
              )}
            </div>
          </div>

          {/* QUICK RULES */}

          <div
            style={{
              background:
                "linear-gradient(135deg, #eef2ff, #f8fafc)",
              borderRadius: "20px",
              border:
                "1px solid #e0e7ff",
              padding: "25px",
            }}
          >
            <p className="card-eyebrow">
              STUDY TOGETHER
            </p>

            <h3>
              🎯 Stay focused
            </h3>

            <ul
              style={{
                paddingLeft: "20px",
                marginBottom: 0,
                color: "#475569",
                lineHeight: 1.7,
              }}
            >
              <li>
                Keep the room focused on
                studying.
              </li>

              <li>
                Use the chat for questions
                and encouragement.
              </li>

              <li>
                Let everyone work at their
                own pace.
              </li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}

export default StudyRoom;
