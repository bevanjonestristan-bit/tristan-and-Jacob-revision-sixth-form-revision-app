import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";

function StudySession({ sessionId, setPage }) {
const [studySession, setStudySession] = useState(null);
const [members, setMembers] = useState([]);
const [loading, setLoading] = useState(true);
const [error, setError] = useState("");
const [currentUser, setCurrentUser] = useState(null);
const [duration, setDuration] = useState("0m");

useEffect(() => {
loadSession();

```
const interval = setInterval(() => {
  updateDuration();
  loadMembers();
}, 10000);

return () => clearInterval(interval);
```

}, [sessionId]);

async function loadSession() {
try {
setLoading(true);
setError("");

```
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    setPage("login");
    return;
  }

  setCurrentUser(user);

  const { data, error: sessionError } = await supabase
    .from("study_sessions")
    .select(`
      id,
      name,
      subject,
      description,
      created_at
    `)
    .eq("id", sessionId)
    .single();

  if (sessionError) {
    throw sessionError;
  }

  setStudySession(data);

  await loadMembers();
  updateDuration();
} catch (err) {
  console.error("Could not load study session:", err);
  setError(
    err.message || "Could not load the study session."
  );
} finally {
  setLoading(false);
}
```

}

async function loadMembers() {
try {
const { data, error: membersError } = await supabase
.from("study_session_members")
.select(`           id,
          user_id,
          profiles (
            id,
            username,
            full_name,
            avatar_url
          )
        `)
.eq("session_id", sessionId);

```
  if (membersError) {
    console.error(
      "Could not load session members:",
      membersError
    );
    return;
  }

  setMembers(data || []);
} catch (err) {
  console.error("Member loading error:", err);
}
```

}

function updateDuration() {
if (!studySession?.created_at) {
return;
}

```
const start = new Date(
  studySession.created_at
).getTime();

const difference = Math.max(
  0,
  Date.now() - start
);

const totalMinutes = Math.floor(
  difference / 60000
);

const hours = Math.floor(
  totalMinutes / 60
);

const minutes = totalMinutes % 60;

if (hours > 0) {
  setDuration(
    `${hours}h ${minutes}m`
  );
} else {
  setDuration(
    `${minutes}m`
  );
}
```

}

async function leaveSession() {
if (!currentUser) {
return;
}

```
try {
  const { error: leaveError } =
    await supabase
      .from("study_session_members")
      .delete()
      .eq("session_id", sessionId)
      .eq("user_id", currentUser.id);

  if (leaveError) {
    throw leaveError;
  }

  setPage("studyHub");
} catch (err) {
  console.error(
    "Could not leave session:",
    err
  );

  setError(
    err.message ||
      "Could not leave the session."
  );
}
```

}

if (loading) {
return ( <div className="no-subjects"> <div className="no-subjects-icon">
🧠 </div>

```
    <h2>
      Joining study session...
    </h2>

    <p>
      Getting everyone together.
    </p>
  </div>
);
```

}

if (error) {
return ( <div className="no-subjects"> <div className="no-subjects-icon">
⚠️ </div>

```
    <h2>
      Something went wrong
    </h2>

    <p>
      {error}
    </p>

    <button
      type="button"
      className="primary-card-button"
      onClick={() => setPage("studyHub")}
    >
      Back to Study Hub
    </button>
  </div>
);
```

}

if (!studySession) {
return null;
}

return ( <div className="study-session-page">

```
  <div className="revision-header">

    <div>

      <p className="card-eyebrow">
        LIVE STUDY SESSION
      </p>

      <h2>
        {studySession.name}
      </h2>

      {studySession.subject && (
        <p className="revision-description">
          📚 {studySession.subject}
        </p>
      )}

      {studySession.description && (
        <p className="revision-description">
          {studySession.description}
        </p>
      )}

    </div>

    <button
      type="button"
      className="primary-card-button"
      onClick={leaveSession}
    >
      🚪 Leave Session
    </button>

  </div>

  <div className="revision-subject-grid">

    <div className="revision-subject-card">

      <div className="revision-subject-top">

        <div className="revision-subject-icon">
          ⏱️
        </div>

      </div>

      <div className="revision-subject-content">

        <h3>
          Session Duration
        </h3>

        <p>
          {duration}
        </p>

      </div>

    </div>


    <div className="revision-subject-card">

      <div className="revision-subject-top">

        <div className="revision-subject-icon">
          👥
        </div>

      </div>

      <div className="revision-subject-content">

        <h3>
          People Studying
        </h3>

        <p>
          {members.length}{" "}
          {members.length === 1
            ? "person"
            : "people"}{" "}
          currently here
        </p>

      </div>

    </div>


    <div className="revision-subject-card">

      <div className="revision-subject-top">

        <div className="revision-subject-icon">
          🎙️
        </div>

      </div>

      <div className="revision-subject-content">

        <h3>
          Voice Chat
        </h3>

        <p>
          Voice chat is ready to be
          connected.
        </p>

      </div>

      <button
        type="button"
        className="primary-card-button"
        onClick={() =>
          alert(
            "Voice chat will be connected next."
          )
        }
      >
        🎙️ Join Voice Chat
      </button>

    </div>

  </div>


  <div className="revision-section-heading">

    <div>

      <h3>
        👥 Everyone in the Session
      </h3>

      <p>
        These people are currently
        studying together.
      </p>

    </div>

  </div>


  {members.length === 0 ? (

    <div className="no-subjects">

      <div className="no-subjects-icon">
        👤
      </div>

      <h3>
        Nobody else is here
      </h3>

      <p>
        Invite your friends to join
        the session.
      </p>

    </div>

  ) : (

    <div className="revision-subject-grid">

      {members.map((member) => {

        const profile =
          member.profiles;

        return (
          <div
            key={member.id}
            className="revision-subject-card"
          >

            <div className="revision-subject-top">

              <div className="revision-subject-icon">
                {profile?.avatar_url ? (
                  <img
                    src={
                      profile.avatar_url
                    }
                    alt=""
                    style={{
                      width: "45px",
                      height: "45px",
                      borderRadius: "50%",
                      objectFit: "cover",
                    }}
                  />
                ) : (
                  "👤"
                )}
              </div>

            </div>

            <div className="revision-subject-content">

              <h3>
                {profile?.full_name ||
                  profile?.username ||
                  "Student"}
              </h3>

              {profile?.username && (
                <p>
                  @{profile.username}
                </p>
              )}

              {member.user_id ===
                currentUser?.id && (
                <p>
                  🟢 You
                </p>
              )}

            </div>

          </div>
        );
      })}

    </div>

  )}

</div>
```

);
}

export default StudySession;
