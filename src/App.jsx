import { useEffect, useState } from "react";
import { supabase } from "./lib/supabase";

import Home from "./pages/Home";
import Login from "./pages/Login";
import Signup from "./pages/Signup";
import Revision from "./pages/Revision";
import SubjectResources from "./pages/SubjectResources";
import SubjectSelection from "./pages/SubjectSelection";
import Timetable from "./pages/Timetable";
import Friends from "./pages/Friends";
import Messages from "./pages/Messages";
import StudyHub from "./pages/StudyHub";
import StudyRoom from "./pages/StudyRoom";
import PastPapers from "./pages/PastPapers";

function App() {
  const [page, setPage] = useState("home");
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedSubject, setSelectedSubject] = useState(null);

  // Study room currently being opened
  const [studyRoomSessionId, setStudyRoomSessionId] =
    useState(null);

  useEffect(() => {
    loadSession();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(
      (_event, newSession) => {
        setSession(newSession);

        if (!newSession) {
          setPage("login");
          setStudyRoomSessionId(null);
        }
      }
    );

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  async function loadSession() {
    try {
      const {
        data: { session: currentSession },
      } = await supabase.auth.getSession();

      setSession(currentSession);

      if (!currentSession) {
        setPage("login");
      } else {
        setPage("home");
      }
    } catch (error) {
      console.error(
        "Could not load session:",
        error
      );
    } finally {
      setLoading(false);
    }
  }

  async function handleLogout() {
    try {
      await supabase.auth.signOut();
    } catch (error) {
      console.error(
        "Could not log out:",
        error
      );
    }

    setSession(null);
    setStudyRoomSessionId(null);
    setPage("login");
  }

  function openSubject(subject) {
    setSelectedSubject(subject);
    setPage("subjectResources");
  }

  function openManageSubjects() {
    setPage("subjectSelection");
  }

  /*
   * OPEN STUDY ROOM
   *
   * StudyHub calls this function with the
   * Supabase study session ID.
   */
  function openStudyRoom(sessionId) {
    if (!sessionId) {
      console.error(
        "Cannot open study room: no session ID."
      );

      return;
    }

    setStudyRoomSessionId(sessionId);
    setPage("studyRoom");
  }

  /*
   * RETURN TO STUDY HUB
   */
  function backToStudyHub() {
    setStudyRoomSessionId(null);
    setPage("studyHub");
  }

  if (loading) {
    return (
      <div className="app-loading">
        Loading...
      </div>
    );
  }

  if (!session) {
    if (page === "signup") {
      return <Signup setPage={setPage} />;
    }

    return <Login setPage={setPage} />;
  }

  return (
    <div className="app">

      {/* SIDEBAR */}

      <aside className="sidebar">

        <div className="sidebar-logo">
          <img
            src="/monmouth-logo.webp"
            alt="Monmouth Sixth Form"
          />
        </div>

        <nav className="sidebar-nav">

          {/* HOME */}

          <button
            type="button"
            className={
              page === "home"
                ? "sidebar-link active"
                : "sidebar-link"
            }
            onClick={() =>
              setPage("home")
            }
          >
            <span>🏠</span>
            <span>Home</span>
          </button>

          {/* REVISION */}

          <button
            type="button"
            className={
              page === "revision"
                ? "sidebar-link active"
                : "sidebar-link"
            }
            onClick={() =>
              setPage("revision")
            }
          >
            <span>📚</span>
            <span>Revision</span>
          </button>

          {/* PAST PAPERS */}

          <button
            type="button"
            className={
              page === "pastPapers"
                ? "sidebar-link active"
                : "sidebar-link"
            }
            onClick={() =>
              setPage("pastPapers")
            }
          >
            <span>📄</span>
            <span>Past Papers</span>
          </button>

          {/* STUDY HUB */}

          <button
            type="button"
            className={
              page === "studyHub" ||
              page === "studyRoom"
                ? "sidebar-link active"
                : "sidebar-link"
            }
            onClick={() =>
              setPage("studyHub")
            }
          >
            <span>🧠</span>
            <span>Study Hub</span>
          </button>

          {/* FRIENDS */}

          <button
            type="button"
            className={
              page === "friends"
                ? "sidebar-link active"
                : "sidebar-link"
            }
            onClick={() =>
              setPage("friends")
            }
          >
            <span>👥</span>
            <span>Friends</span>
          </button>

          {/* MESSAGES */}

          <button
            type="button"
            className={
              page === "messages"
                ? "sidebar-link active"
                : "sidebar-link"
            }
            onClick={() =>
              setPage("messages")
            }
          >
            <span>💬</span>
            <span>Messages</span>
          </button>

          {/* TIMETABLE */}

          <button
            type="button"
            className={
              page === "timetable"
                ? "sidebar-link active"
                : "sidebar-link"
            }
            onClick={() =>
              setPage("timetable")
            }
          >
            <span>🗓️</span>
            <span>Timetable</span>
          </button>

          {/* MANAGE SUBJECTS */}

          <button
            type="button"
            className={
              page === "subjectSelection"
                ? "sidebar-link active"
                : "sidebar-link"
            }
            onClick={
              openManageSubjects
            }
          >
            <span>⚙️</span>
            <span>Manage Subjects</span>
          </button>

        </nav>

        {/* LOGOUT */}

        <div className="sidebar-bottom">

          <button
            type="button"
            className="sidebar-link"
            onClick={handleLogout}
          >
            <span>🚪</span>
            <span>Log out</span>
          </button>

        </div>

      </aside>

      {/* MAIN CONTENT */}

      <main className="main-content">

        {/* HEADER */}

        <header className="top-header">

          <h1>

            {page === "home" &&
              "Welcome back 👋"}

            {page === "revision" &&
              "Revision 📚"}

            {page === "pastPapers" &&
              "Past Papers 📄"}

            {page === "studyHub" &&
              "Study Hub 🧠"}

            {page === "studyRoom" &&
              "Study Room 🧠"}

            {page === "friends" &&
              "Friends 👥"}

            {page === "messages" &&
              "Messages 💬"}

            {page === "timetable" &&
              "Timetable 🗓️"}

            {page === "subjectSelection" &&
              "Manage Subjects ⚙️"}

            {page === "subjectResources" &&
              (
                selectedSubject?.name ||
                "Subject Resources"
              )}

          </h1>

        </header>

        {/* HOME */}

        {page === "home" && (
          <Home
            setPage={setPage}
          />
        )}

        {/* REVISION */}

        {page === "revision" && (
          <Revision
            setPage={setPage}
            onSelectSubject={
              openSubject
            }
          />
        )}

        {/* PAST PAPERS */}

        {page === "pastPapers" && (
          <PastPapers
            setPage={setPage}
          />
        )}

        {/* STUDY HUB */}

        {page === "studyHub" && (
          <StudyHub
            setPage={setPage}
            onOpenStudyRoom={
              openStudyRoom
            }
          />
        )}

        {/* STUDY ROOM */}

        {page === "studyRoom" && (
          <StudyRoom
            setPage={setPage}
            sessionId={
              studyRoomSessionId
            }
            onBack={
              backToStudyHub
            }
          />
        )}

        {/* FRIENDS */}

        {page === "friends" && (
          <Friends
            setPage={setPage}
          />
        )}

        {/* MESSAGES */}

        {page === "messages" && (
          <Messages
            setPage={setPage}
          />
        )}

        {/* TIMETABLE */}

        {page === "timetable" && (
          <Timetable
            setPage={setPage}
          />
        )}

        {/* MANAGE SUBJECTS */}

        {page === "subjectSelection" && (
          <SubjectSelection
            setPage={setPage}
          />
        )}

        {/* SUBJECT RESOURCES */}

        {page === "subjectResources" && (
          <SubjectResources
            subject={selectedSubject}
            setPage={setPage}
          />
        )}

      </main>

    </div>
  );
}

export default App;