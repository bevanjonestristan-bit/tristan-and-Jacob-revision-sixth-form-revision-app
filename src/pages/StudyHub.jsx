import { useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabase";
import StudyRoom from "./StudyRoom";

function StudyHub({ setPage }) {
  const [currentUser, setCurrentUser] = useState(null);
  const [sessions, setSessions] = useState([]);
  const [profiles, setProfiles] = useState({});
  const [pendingInvites, setPendingInvites] = useState([]);

  const [friendsStudying, setFriendsStudying] =
    useState([]);

  const [friendsStudyingLoading, setFriendsStudyingLoading] =
    useState(true);

  const [selectedSession, setSelectedSession] = useState(null);

  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [joining, setJoining] = useState(null);
  const [error, setError] = useState("");

  const [showCreate, setShowCreate] = useState(false);

  const [sessionName, setSessionName] = useState("");
  const [sessionSubject, setSessionSubject] = useState("");
  const [sessionTopic, setSessionTopic] = useState("");
  const [sessionDescription, setSessionDescription] = useState("");
  const [maxMembers, setMaxMembers] = useState(8);
  const [isPublic, setIsPublic] = useState(false);
  const [timerMinutes, setTimerMinutes] = useState(25);

  useEffect(() => {
    let mounted = true;
    let channel = null;

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

        if (!mounted) {
          return;
        }

        setCurrentUser(user);

        await Promise.all([
          loadSessions(user.id),
          loadInvites(user.id),
          loadFriendsStudying(user.id),
        ]);

        channel = supabase
          .channel(`study-hub-live-${user.id}`)
          .on(
            "postgres_changes",
            {
              event: "*",
              schema: "public",
              table: "study_sessions",
            },
            () => loadSessions(user.id)
          )
          .on(
            "postgres_changes",
            {
              event: "*",
              schema: "public",
              table: "study_session_members",
            },
            () => loadSessions(user.id)
          )
          .on(
            "postgres_changes",
            {
              event: "*",
              schema: "public",
              table: "study_session_invites",
              filter: `receiver_id=eq.${user.id}`,
            },
            () => {
              loadInvites(user.id);
              loadSessions(user.id);
              loadFriendsStudying(user.id);
            }
          )
          .on(
            "postgres_changes",
            {
              event: "*",
              schema: "public",
              table: "study_friend_activity",
            },
            () => {
              loadFriendsStudying(user.id);
            }
          )
          .subscribe();
      } catch (err) {
        console.error("Study Hub initialisation:", err);
        setError(
          err?.message ||
            "Could not load Study Together."
        );
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    }

    initialise();

    return () => {
      mounted = false;

      if (channel) {
        supabase.removeChannel(channel);
      }
    };
  }, []);

  async function loadProfiles(userIds) {
    const ids = [...new Set((userIds || []).filter(Boolean))];

    if (ids.length === 0) {
      return {};
    }

    const {
      data,
      error: profileError,
    } = await supabase
      .from("profiles")
      .select("id, full_name, school_email, year_group")
      .in("id", ids);

    if (profileError) {
      console.warn("Could not load study profiles:", profileError);
      return {};
    }

    const map = {};

    (data || []).forEach((profile) => {
      map[profile.id] = profile;
    });

    setProfiles((current) => ({
      ...current,
      ...map,
    }));

    return map;
  }

  async function loadFriendsStudying(
    userId = currentUser?.id
  ) {
    try {
      if (!userId) {
        return;
      }

      setFriendsStudyingLoading(true);

      const {
        data,
        error,
      } = await supabase
        .from("study_friend_activity")
        .select(`
          user_id,
          session_id,
          room_name,
          subject,
          topic,
          activity,
          member_count,
          max_members,
          is_public,
          host_id,
          updated_at
        `)
        .neq("user_id", userId)
        .order("updated_at", {
          ascending: false,
        });

      if (error) {
        throw error;
      }

      const rows = data || [];

      setFriendsStudying(rows);

      await loadProfiles(
        rows.map((row) => row.user_id)
      );
    } catch (err) {
      console.error(
        "Could not load friends studying now:",
        err
      );

      setFriendsStudying([]);
    } finally {
      setFriendsStudyingLoading(false);
    }
  }

  function getActivityLabel(activity) {
    if (activity === "past_paper") {
      return {
        icon: "📄",
        label: "Shared Past Paper",
      };
    }

    if (activity === "battle") {
      return {
        icon: "⚔️",
        label: "Revision Battle",
      };
    }

    if (activity === "flashcards") {
      return {
        icon: "🃏",
        label: "Multiplayer Flashcards",
      };
    }

    return {
      icon: "✏️",
      label: "Shared Whiteboard",
    };
  }

  function getInviteForSession(sessionId) {
    return pendingInvites.find(
      (invite) =>
        invite.session_id === sessionId &&
        invite.status === "pending"
    );
  }

  function canJoinFriendActivity(activity) {
    if (activity.is_public) {
      return true;
    }

    return Boolean(
      getInviteForSession(
        activity.session_id
      )
    );
  }

  async function joinFriendActivity(activity) {
    if (!activity?.session_id) {
      return;
    }

    const invite =
      getInviteForSession(
        activity.session_id
      );

    if (invite) {
      await acceptInvite(invite);
      return;
    }

    if (!activity.is_public) {
      setError(
        "That friend is in a private room. Ask them to invite you first."
      );
      return;
    }

    const session = {
      id: activity.session_id,
      host_id: activity.host_id,
      created_by: activity.host_id,
      name:
        activity.room_name ||
        "Study Room",
      subject:
        activity.subject || null,
      topic:
        activity.topic || null,
      max_members:
        Number(
          activity.max_members || 8
        ),
      memberCount:
        Number(
          activity.member_count || 0
        ),
      is_public:
        Boolean(
          activity.is_public
        ),
      is_active: true,
      activity:
        activity.activity ||
        "whiteboard",
      activeMembers: [],
    };

    await joinSession(session);
  }

  async function loadSessions(userId = currentUser?.id) {
    try {
      if (!userId) {
        return;
      }

      const {
        data,
        error: sessionsError,
      } = await supabase
        .from("study_sessions")
        .select(`
          id,
          host_id,
          created_by,
          subject_id,
          name,
          subject,
          topic,
          description,
          max_members,
          is_active,
          is_public,
          created_at,
          started_at,
          ended_at,
          timer_started_at,
          timer_duration_seconds,
          timer_is_running,
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

      const formatted = (data || []).map((session) => {
        const activeMembers = (
          session.study_session_members || []
        ).filter((member) => !member.left_at);

        return {
          ...session,
          activeMembers,
          memberCount: activeMembers.length,
        };
      });

      setSessions(formatted);

      const userIds = [];

      formatted.forEach((session) => {
        userIds.push(session.host_id);

        session.activeMembers.forEach((member) => {
          userIds.push(member.user_id);
        });
      });

      await loadProfiles(userIds);
    } catch (err) {
      console.error("Could not load study sessions:", err);
      setError(
        err?.message ||
          "Could not load active study rooms."
      );
    }
  }

  async function loadInvites(userId = currentUser?.id) {
    try {
      if (!userId) {
        return;
      }

      const {
        data,
        error: inviteError,
      } = await supabase
        .from("study_session_invites")
        .select(`
          id,
          session_id,
          sender_id,
          receiver_id,
          status,
          created_at,
          study_sessions (
            id,
            host_id,
            created_by,
            name,
            subject,
            topic,
            description,
            max_members,
            is_active,
            is_public,
            created_at,
            started_at,
            timer_started_at,
            timer_duration_seconds,
            timer_is_running
          )
        `)
        .eq("receiver_id", userId)
        .eq("status", "pending")
        .order("created_at", {
          ascending: false,
        });

      if (inviteError) {
        throw inviteError;
      }

      const activeInvites = (data || []).filter(
        (invite) => invite.study_sessions?.is_active
      );

      setPendingInvites(activeInvites);

      await loadProfiles(
        activeInvites.map((invite) => invite.sender_id)
      );
    } catch (err) {
      console.error("Could not load study invites:", err);
      setPendingInvites([]);
    }
  }

  function isUserInSession(session) {
    return session.activeMembers?.some(
      (member) =>
        member.user_id === currentUser?.id &&
        !member.left_at
    );
  }

  function getMyActiveSession() {
    return sessions.find((session) =>
      isUserInSession(session)
    );
  }

  async function createSession(event) {
    event.preventDefault();

    if (!currentUser) {
      return;
    }

    if (!sessionName.trim()) {
      setError("Please enter a room name.");
      return;
    }

    try {
      setCreating(true);
      setError("");

      const existing = getMyActiveSession();

      if (existing) {
        throw new Error(
          "Leave your current study room before creating another one."
        );
      }

      const safeMax = Math.min(
        20,
        Math.max(2, Number(maxMembers) || 8)
      );

      const safeMinutes = Math.min(
        180,
        Math.max(5, Number(timerMinutes) || 25)
      );

      const now = new Date().toISOString();

      const {
        data: session,
        error: createError,
      } = await supabase
        .from("study_sessions")
        .insert({
          host_id: currentUser.id,
          created_by: currentUser.id,
          name: sessionName.trim(),
          subject: sessionSubject.trim() || null,
          topic: sessionTopic.trim() || null,
          description:
            sessionDescription.trim() || null,
          max_members: safeMax,
          is_active: true,
          is_public: isPublic,
          started_at: now,
          timer_duration_seconds:
            safeMinutes * 60,
          timer_is_running: false,
        })
        .select("*")
        .single();

      if (createError) {
        throw createError;
      }

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

      setShowCreate(false);
      setSessionName("");
      setSessionSubject("");
      setSessionTopic("");
      setSessionDescription("");
      setMaxMembers(8);
      setIsPublic(false);
      setTimerMinutes(25);

      await Promise.all([
        loadSessions(currentUser.id),
        loadFriendsStudying(currentUser.id),
      ]);

      setSelectedSession(session);
    } catch (err) {
      console.error("Could not create study session:", err);
      setError(
        err?.message ||
          "Could not create the study room."
      );
    } finally {
      setCreating(false);
    }
  }

  async function joinSession(session) {
    if (!currentUser || !session?.id) {
      return;
    }

    try {
      setJoining(session.id);
      setError("");

      const activeSession = getMyActiveSession();

      if (
        activeSession &&
        activeSession.id !== session.id
      ) {
        throw new Error(
          "You are already in another study room. Leave it first."
        );
      }

      if (
        Number(session.memberCount || 0) >=
        Number(session.max_members || 8)
      ) {
        throw new Error(
          "This study room is full."
        );
      }

      if (!isUserInSession(session)) {
        const {
          error: joinError,
        } = await supabase
          .from("study_session_members")
          .insert({
            session_id: session.id,
            user_id: currentUser.id,
          });

        if (
          joinError &&
          joinError.code !== "23505"
        ) {
          throw joinError;
        }
      }

      await Promise.all([
        loadSessions(currentUser.id),
        loadFriendsStudying(currentUser.id),
      ]);

      setSelectedSession(session);
    } catch (err) {
      console.error("Could not join study session:", err);
      setError(
        err?.message ||
          "Could not join this study room."
      );
    } finally {
      setJoining(null);
    }
  }

  async function acceptInvite(invite) {
    if (!currentUser || !invite?.id) {
      return;
    }

    try {
      setJoining(invite.session_id);
      setError("");

      const {
        error: memberError,
      } = await supabase
        .from("study_session_members")
        .insert({
          session_id: invite.session_id,
          user_id: currentUser.id,
        });

      if (
        memberError &&
        memberError.code !== "23505"
      ) {
        throw memberError;
      }

      const {
        error: updateError,
      } = await supabase
        .from("study_session_invites")
        .update({
          status: "accepted",
        })
        .eq("id", invite.id)
        .eq("receiver_id", currentUser.id);

      if (updateError) {
        throw updateError;
      }

      await Promise.all([
        loadInvites(currentUser.id),
        loadSessions(currentUser.id),
        loadFriendsStudying(currentUser.id),
      ]);

      setSelectedSession(
        invite.study_sessions
      );
    } catch (err) {
      console.error("Could not accept study invite:", err);
      setError(
        err?.message ||
          "Could not accept the invitation."
      );
    } finally {
      setJoining(null);
    }
  }

  async function declineInvite(invite) {
    if (!currentUser || !invite?.id) {
      return;
    }

    try {
      const {
        error: updateError,
      } = await supabase
        .from("study_session_invites")
        .update({
          status: "declined",
        })
        .eq("id", invite.id)
        .eq("receiver_id", currentUser.id);

      if (updateError) {
        throw updateError;
      }

      await loadInvites(currentUser.id);
    } catch (err) {
      console.error("Could not decline study invite:", err);
      setError(
        err?.message ||
          "Could not decline the invitation."
      );
    }
  }

  async function leaveSession(sessionId) {
    if (!currentUser || !sessionId) {
      return;
    }

    try {
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

      setSelectedSession(null);

      await Promise.all([
        loadSessions(currentUser.id),
        loadFriendsStudying(currentUser.id),
      ]);
    } catch (err) {
      console.error("Could not leave study room:", err);
      setError(
        err?.message ||
          "Could not leave the room."
      );
    }
  }

  const visibleSessions = useMemo(() => {
    return sessions.filter((session) => {
      if (isUserInSession(session)) {
        return true;
      }

      if (session.is_public) {
        return true;
      }

      return pendingInvites.some(
        (invite) =>
          invite.session_id === session.id
      );
    });
  }, [sessions, pendingInvites, currentUser]);

  if (selectedSession) {
    return (
      <StudyRoom
        session={selectedSession}
        setPage={setPage}
        onExit={() => {
          setSelectedSession(null);

          if (currentUser?.id) {
            loadSessions(currentUser.id);
            loadInvites(currentUser.id);
            loadFriendsStudying(
              currentUser.id
            );
          }
        }}
      />
    );
  }

  if (loading) {
    return (
      <div className="study-hub">
        <div className="no-subjects">
          <div className="no-subjects-icon">
            ✨
          </div>

          <h2>
            Loading Study Together...
          </h2>

          <p>
            Finding live study rooms and friends.
          </p>
        </div>
      </div>
    );
  }

  const myActiveSession = getMyActiveSession();

  return (
    <div className="study-hub">
      <div className="revision-header">
        <div>
          <p className="card-eyebrow">
            LIVE REVISION
          </p>

          <h2>
            Study Together ✨
          </h2>

          <p className="revision-description">
            Join friends in live revision rooms with
            chat, a shared whiteboard, focus timers
            and instant invitations.
          </p>
        </div>

        <button
          type="button"
          className="manage-subjects-button"
          onClick={() =>
            setShowCreate(true)
          }
        >
          ＋ Create Live Room
        </button>
      </div>

      {error && (
        <div className="revision-information">
          <div className="revision-information-icon">
            ⚠️
          </div>

          <div>
            <strong>
              Something went wrong
            </strong>

            <p>{error}</p>
          </div>
        </div>
      )}

      {myActiveSession && (
        <div
          style={{
            marginBottom: "24px",
            padding: "18px 20px",
            borderRadius: "18px",
            background:
              "linear-gradient(135deg, #eef2ff, #ecfeff)",
            border:
              "1px solid #c7d2fe",
            display: "flex",
            justifyContent:
              "space-between",
            alignItems: "center",
            gap: "16px",
            flexWrap: "wrap",
          }}
        >
          <div>
            <strong>
              🔴 You're already in a live room
            </strong>

            <div
              style={{
                marginTop: "5px",
              }}
            >
              {myActiveSession.name}
              {myActiveSession.subject
                ? ` • ${myActiveSession.subject}`
                : ""}
            </div>
          </div>

          <button
            type="button"
            className="primary-card-button"
            onClick={() =>
              setSelectedSession(
                myActiveSession
              )
            }
          >
            Rejoin Room →
          </button>
        </div>
      )}

      <div
        style={{
          marginBottom: "30px",
        }}
      >
        <div className="revision-section-heading">
          <div>
            <h3>
              👀 Friends Studying Now
            </h3>

            <p>
              See what your friends are revising and
              jump into rooms you're allowed to join.
            </p>
          </div>

          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "7px",
              padding: "7px 11px",
              borderRadius: "999px",
              background: "#dcfce7",
              color: "#166534",
              fontSize: "12px",
              fontWeight: 900,
            }}
          >
            <span
              style={{
                width: "8px",
                height: "8px",
                borderRadius: "50%",
                background: "#22c55e",
                display: "inline-block",
              }}
            />
            LIVE
          </div>
        </div>

        {friendsStudyingLoading ? (
          <div
            style={{
              padding: "22px",
              borderRadius: "18px",
              background: "white",
              border: "1px solid #e2e8f0",
              color: "#64748b",
              textAlign: "center",
            }}
          >
            Checking who's studying...
          </div>
        ) : friendsStudying.length === 0 ? (
          <div
            style={{
              padding: "26px",
              borderRadius: "18px",
              background:
                "linear-gradient(135deg,#f8fafc,#eef2ff)",
              border: "1px solid #e2e8f0",
              textAlign: "center",
            }}
          >
            <div
              style={{
                fontSize: "38px",
                marginBottom: "8px",
              }}
            >
              🌙
            </div>

            <strong>
              None of your friends are studying right now
            </strong>

            <p
              style={{
                marginTop: "6px",
                color: "#64748b",
              }}
            >
              When a friend joins a Study Together room,
              they'll appear here automatically.
            </p>
          </div>
        ) : (
          <div
            style={{
              display: "grid",
              gridTemplateColumns:
                "repeat(auto-fit,minmax(260px,1fr))",
              gap: "12px",
            }}
          >
            {friendsStudying.map((activity) => {
              const friend =
                profiles[activity.user_id];

              const activityInfo =
                getActivityLabel(
                  activity.activity
                );

              const invite =
                getInviteForSession(
                  activity.session_id
                );

              const joinable =
                canJoinFriendActivity(
                  activity
                );

              const full =
                Number(
                  activity.member_count || 0
                ) >=
                Number(
                  activity.max_members || 8
                );

              return (
                <div
                  key={`${activity.user_id}-${activity.session_id}`}
                  style={{
                    background: "white",
                    border:
                      "1px solid #e2e8f0",
                    borderRadius: "20px",
                    padding: "17px",
                    boxShadow:
                      "0 5px 18px rgba(15,23,42,.05)",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      justifyContent:
                        "space-between",
                      alignItems: "start",
                      gap: "12px",
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        gap: "11px",
                        alignItems: "center",
                      }}
                    >
                      <div
                        style={{
                          width: "44px",
                          height: "44px",
                          borderRadius: "50%",
                          background: "#ecfdf5",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          fontSize: "20px",
                          flexShrink: 0,
                        }}
                      >
                        🟢
                      </div>

                      <div>
                        <strong
                          style={{
                            fontSize: "16px",
                          }}
                        >
                          {friend?.full_name ||
                            "Friend"}
                        </strong>

                        <div
                          style={{
                            marginTop: "2px",
                            color: "#64748b",
                            fontSize: "12px",
                          }}
                        >
                          studying now
                        </div>
                      </div>
                    </div>

                    <span
                      style={{
                        padding: "5px 8px",
                        borderRadius: "999px",
                        background:
                          activity.is_public
                            ? "#dcfce7"
                            : "#ede9fe",
                        color:
                          activity.is_public
                            ? "#166534"
                            : "#5b21b6",
                        fontSize: "11px",
                        fontWeight: 900,
                      }}
                    >
                      {activity.is_public
                        ? "PUBLIC"
                        : "PRIVATE"}
                    </span>
                  </div>

                  <div
                    style={{
                      marginTop: "15px",
                    }}
                  >
                    <div
                      style={{
                        fontWeight: 800,
                        fontSize: "15px",
                      }}
                    >
                      {activity.room_name ||
                        "Study Room"}
                    </div>

                    {(activity.subject ||
                      activity.topic) && (
                      <div
                        style={{
                          color: "#475569",
                          marginTop: "5px",
                          fontSize: "13px",
                        }}
                      >
                        📚{" "}
                        {activity.subject ||
                          "Study"}
                        {activity.topic
                          ? ` • ${activity.topic}`
                          : ""}
                      </div>
                    )}

                    <div
                      style={{
                        marginTop: "9px",
                        display: "flex",
                        gap: "7px",
                        flexWrap: "wrap",
                      }}
                    >
                      <span
                        style={{
                          padding: "6px 8px",
                          borderRadius: "9px",
                          background: "#f1f5f9",
                          fontSize: "12px",
                          fontWeight: 700,
                        }}
                      >
                        {activityInfo.icon}{" "}
                        {activityInfo.label}
                      </span>

                      <span
                        style={{
                          padding: "6px 8px",
                          borderRadius: "9px",
                          background: "#f1f5f9",
                          fontSize: "12px",
                          fontWeight: 700,
                        }}
                      >
                        👥{" "}
                        {activity.member_count}/
                        {activity.max_members}
                      </span>
                    </div>
                  </div>

                  <button
                    type="button"
                    className="primary-card-button"
                    disabled={
                      full ||
                      joining ===
                        activity.session_id ||
                      !joinable
                    }
                    onClick={() =>
                      joinFriendActivity(
                        activity
                      )
                    }
                    style={{
                      width: "100%",
                      marginTop: "15px",
                      opacity:
                        full || !joinable
                          ? 0.65
                          : 1,
                    }}
                  >
                    {joining ===
                    activity.session_id
                      ? "Joining..."
                      : full
                      ? "🔒 Room Full"
                      : invite
                      ? "📩 Accept & Join"
                      : activity.is_public
                      ? "🚀 Join Friend"
                      : "🔒 Invite Required"}
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {pendingInvites.length > 0 && (
        <div
          style={{
            marginBottom: "30px",
          }}
        >
          <div className="revision-section-heading">
            <div>
              <h3>
                📩 Study Invitations
              </h3>

              <p>
                Friends want to revise with you.
              </p>
            </div>
          </div>

          <div
            style={{
              display: "grid",
              gap: "12px",
            }}
          >
            {pendingInvites.map((invite) => {
              const session =
                invite.study_sessions;

              const sender =
                profiles[invite.sender_id];

              return (
                <div
                  key={invite.id}
                  style={{
                    background: "white",
                    border:
                      "1px solid #ddd6fe",
                    borderRadius: "18px",
                    padding: "18px",
                    display: "flex",
                    justifyContent:
                      "space-between",
                    alignItems: "center",
                    gap: "18px",
                    flexWrap: "wrap",
                  }}
                >
                  <div>
                    <strong>
                      👋{" "}
                      {sender?.full_name ||
                        "A friend"}
                    </strong>

                    <div
                      style={{
                        marginTop: "5px",
                      }}
                    >
                      invited you to{" "}
                      <strong>
                        {session?.name ||
                          "a study room"}
                      </strong>
                    </div>

                    {(session?.subject ||
                      session?.topic) && (
                      <div
                        style={{
                          color:
                            "#64748b",
                          marginTop: "4px",
                        }}
                      >
                        {session?.subject || ""}
                        {session?.subject &&
                        session?.topic
                          ? " • "
                          : ""}
                        {session?.topic || ""}
                      </div>
                    )}
                  </div>

                  <div
                    style={{
                      display: "flex",
                      gap: "8px",
                    }}
                  >
                    <button
                      type="button"
                      className="primary-card-button"
                      disabled={
                        joining ===
                        invite.session_id
                      }
                      onClick={() =>
                        acceptInvite(invite)
                      }
                    >
                      {joining ===
                      invite.session_id
                        ? "Joining..."
                        : "✅ Accept & Join"}
                    </button>

                    <button
                      type="button"
                      onClick={() =>
                        declineInvite(invite)
                      }
                      style={{
                        border:
                          "1px solid #fecaca",
                        background:
                          "#fff1f2",
                        color:
                          "#991b1b",
                        borderRadius:
                          "10px",
                        padding:
                          "10px 14px",
                        fontWeight: 700,
                        cursor: "pointer",
                      }}
                    >
                      Decline
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div className="revision-section-heading">
        <div>
          <h3>
            🟢 Live Rooms
          </h3>

          <p>
            {visibleSessions.length === 0
              ? "No rooms are visible right now."
              : `${visibleSessions.length} live ${
                  visibleSessions.length === 1
                    ? "room"
                    : "rooms"
                }`}
          </p>
        </div>
      </div>

      {visibleSessions.length === 0 ? (
        <div className="no-subjects">
          <div className="no-subjects-icon">
            🚀
          </div>

          <h3>
            Start the first live room
          </h3>

          <p>
            Create a room, invite your friends and
            start revising together.
          </p>

          <button
            type="button"
            className="primary-card-button"
            onClick={() =>
              setShowCreate(true)
            }
          >
            ＋ Create Study Room
          </button>
        </div>
      ) : (
        <div className="revision-subject-grid">
          {visibleSessions.map((session) => {
            const joined =
              isUserInSession(session);

            const host =
              profiles[session.host_id];

            const full =
              session.memberCount >=
              session.max_members;

            return (
              <div
                key={session.id}
                className="revision-subject-card"
              >
                <div className="revision-subject-top">
                  <div className="revision-subject-icon">
                    {session.subject
                      ? "📘"
                      : "🧠"}
                  </div>

                  <span
                    style={{
                      fontSize: "12px",
                      fontWeight: 800,
                      padding:
                        "5px 9px",
                      borderRadius:
                        "999px",
                      background:
                        session.is_public
                          ? "#dcfce7"
                          : "#ede9fe",
                      color:
                        session.is_public
                          ? "#166534"
                          : "#5b21b6",
                    }}
                  >
                    {session.is_public
                      ? "PUBLIC"
                      : "FRIENDS"}
                  </span>
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

                  {session.topic && (
                    <p>
                      🎯 {session.topic}
                    </p>
                  )}

                  {session.description && (
                    <p
                      style={{
                        marginTop: "8px",
                      }}
                    >
                      {session.description}
                    </p>
                  )}

                  <div
                    style={{
                      marginTop: "14px",
                      display: "grid",
                      gridTemplateColumns:
                        "1fr 1fr",
                      gap: "8px",
                    }}
                  >
                    <div
                      style={{
                        background:
                          "#f8fafc",
                        padding:
                          "10px",
                        borderRadius:
                          "10px",
                      }}
                    >
                      👥{" "}
                      <strong>
                        {session.memberCount}/
                        {session.max_members}
                      </strong>
                    </div>

                    <div
                      style={{
                        background:
                          "#f8fafc",
                        padding:
                          "10px",
                        borderRadius:
                          "10px",
                      }}
                    >
                      ⏱{" "}
                      <strong>
                        {Math.round(
                          (session.timer_duration_seconds ||
                            1500) /
                            60
                        )}
                        m
                      </strong>
                    </div>
                  </div>

                  <div
                    style={{
                      marginTop: "13px",
                      color:
                        "#64748b",
                      fontSize: "13px",
                    }}
                  >
                    👑{" "}
                    {session.host_id ===
                    currentUser?.id
                      ? "You"
                      : host?.full_name ||
                        "Host"}
                  </div>
                </div>

                <div
                  style={{
                    marginTop: "18px",
                  }}
                >
                  {joined ? (
                    <button
                      type="button"
                      className="primary-card-button"
                      onClick={() =>
                        setSelectedSession(
                          session
                        )
                      }
                    >
                      🔴 Open Live Room
                    </button>
                  ) : (
                    <button
                      type="button"
                      className="primary-card-button"
                      disabled={
                        full ||
                        joining === session.id
                      }
                      onClick={() =>
                        joinSession(session)
                      }
                    >
                      {joining === session.id
                        ? "Joining..."
                        : full
                        ? "🔒 Room Full"
                        : "👥 Join Room"}
                    </button>
                  )}

                  {joined && (
                    <button
                      type="button"
                      onClick={() =>
                        leaveSession(
                          session.id
                        )
                      }
                      style={{
                        width: "100%",
                        marginTop: "8px",
                        border:
                          "1px solid #e2e8f0",
                        borderRadius:
                          "10px",
                        background:
                          "white",
                        padding:
                          "10px",
                        cursor:
                          "pointer",
                      }}
                    >
                      Leave Room
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {showCreate && (
        <div
          onMouseDown={(event) => {
            if (
              event.target ===
              event.currentTarget
            ) {
              setShowCreate(false);
            }
          }}
          style={{
            position: "fixed",
            inset: 0,
            background:
              "rgba(15,23,42,.68)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "20px",
            zIndex: 1000,
          }}
        >
          <form
            onSubmit={createSession}
            style={{
              width: "100%",
              maxWidth: "580px",
              maxHeight:
                "90vh",
              overflowY: "auto",
              background: "white",
              borderRadius: "24px",
              padding: "28px",
              boxShadow:
                "0 30px 90px rgba(0,0,0,.3)",
            }}
          >
            <p className="card-eyebrow">
              STUDY TOGETHER
            </p>

            <h2>
              Create a Live Study Room ✨
            </h2>

            <p
              style={{
                color: "#64748b",
                marginBottom: "22px",
              }}
            >
              Create a room with chat, whiteboard,
              timer and friend invitations.
            </p>

            <div
              style={{
                display: "grid",
                gap: "13px",
              }}
            >
              <input
                type="text"
                placeholder="Room name — e.g. Further Maths Grind"
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
                placeholder="Subject — e.g. Further Mathematics"
                value={sessionSubject}
                onChange={(event) =>
                  setSessionSubject(
                    event.target.value
                  )
                }
              />

              <input
                type="text"
                placeholder="Topic — e.g. Integration"
                value={sessionTopic}
                onChange={(event) =>
                  setSessionTopic(
                    event.target.value
                  )
                }
              />

              <textarea
                rows="3"
                placeholder="What are you working on?"
                value={sessionDescription}
                onChange={(event) =>
                  setSessionDescription(
                    event.target.value
                  )
                }
              />

              <label>
                <strong>
                  Maximum people
                </strong>

                <input
                  type="number"
                  min="2"
                  max="20"
                  value={maxMembers}
                  onChange={(event) =>
                    setMaxMembers(
                      event.target.value
                    )
                  }
                  style={{
                    width: "100%",
                    marginTop: "6px",
                  }}
                />
              </label>

              <label>
                <strong>
                  Focus timer
                </strong>

                <select
                  value={timerMinutes}
                  onChange={(event) =>
                    setTimerMinutes(
                      event.target.value
                    )
                  }
                  style={{
                    width: "100%",
                    marginTop: "6px",
                  }}
                >
                  <option value="15">
                    15 minutes
                  </option>
                  <option value="25">
                    25 minutes
                  </option>
                  <option value="40">
                    40 minutes
                  </option>
                  <option value="50">
                    50 minutes
                  </option>
                  <option value="60">
                    60 minutes
                  </option>
                  <option value="90">
                    90 minutes
                  </option>
                </select>
              </label>

              <label
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "10px",
                  padding: "13px",
                  borderRadius:
                    "12px",
                  background:
                    "#f8fafc",
                }}
              >
                <input
                  type="checkbox"
                  checked={isPublic}
                  onChange={(event) =>
                    setIsPublic(
                      event.target.checked
                    )
                  }
                />

                <span>
                  <strong>
                    Public room
                  </strong>
                  <br />
                  <small>
                    Other students can discover and join it.
                    Leave unticked for invite-only.
                  </small>
                </span>
              </label>
            </div>

            <div
              style={{
                display: "flex",
                justifyContent:
                  "flex-end",
                gap: "10px",
                marginTop: "22px",
              }}
            >
              <button
                type="button"
                onClick={() =>
                  setShowCreate(false)
                }
                disabled={creating}
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
                  : "🚀 Create Room"}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}

export default StudyHub;
