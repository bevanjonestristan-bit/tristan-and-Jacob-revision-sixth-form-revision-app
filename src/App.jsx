import { useEffect, useMemo, useState } from "react";
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
import PastPapers from "./pages/PastPapers";
import Notifications from "./pages/Notifications";
import Assignments from "./pages/Assignments";
import Notes from "./pages/Notes";

import "./styles/design-v2.css";

const NAV_GROUPS = [
  { label: "Workspace", items: [
    { page: "home", label: "Home", icon: "home" },
    { page: "revision", label: "Revision", icon: "book" },
    { page: "pastPapers", label: "Past Papers", icon: "paper" },
    { page: "assignments", label: "Assignments", icon: "assignment" },
    { page: "notes", label: "Notes", icon: "notes" },
  ]},
  { label: "Connect", items: [
    { page: "studyHub", label: "Study Hub", icon: "brain" },
    { page: "friends", label: "Friends", icon: "users" },
    { page: "messages", label: "Messages", icon: "message" },
    { page: "notifications", label: "Notifications", icon: "bell" },
  ]},
  { label: "Organise", items: [
    { page: "timetable", label: "Timetable", icon: "calendar" },
    { page: "subjectSelection", label: "Manage Subjects", icon: "settings" },
  ]},
];

const PAGE_TITLES = {
  home: "Dashboard",
  revision: "Revision",
  pastPapers: "Past Papers",
  assignments: "Assignments",
  notes: "Notes",
  studyHub: "Study Hub",
  friends: "Friends",
  messages: "Messages",
  notifications: "Notifications",
  timetable: "Timetable",
  subjectSelection: "Manage Subjects",
  subjectResources: "Subject Resources",
};

function Icon({ name, size = 20 }) {
  const common = {
    width: size, height: size, viewBox: "0 0 24 24", fill: "none",
    stroke: "currentColor", strokeWidth: 1.9, strokeLinecap: "round",
    strokeLinejoin: "round", "aria-hidden": "true"
  };
  const paths = {
    home: <><path d="M3 11.5 12 4l9 7.5"/><path d="M5.5 10.5V20h13v-9.5"/><path d="M9.5 20v-6h5v6"/></>,
    book: <><path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H11v16H6.5A2.5 2.5 0 0 0 4 21.5z"/><path d="M20 5.5A2.5 2.5 0 0 0 17.5 3H13v16h4.5a2.5 2.5 0 0 1 2.5 2.5z"/></>,
    paper: <><path d="M6 2.5h8l4 4V21.5H6z"/><path d="M14 2.5v4h4"/><path d="M9 11h6M9 15h6"/></>,
    assignment: <><rect x="5" y="3" width="14" height="18" rx="2"/><path d="M9 3.5h6v3H9zM9 11h6M9 15h4"/></>,
    notes: <><path d="M5 4.5h14v15H5z"/><path d="M8 8h8M8 12h8M8 16h5"/></>,
    brain: <><path d="M9.5 4A3.5 3.5 0 0 0 6 7.5v.4A3.5 3.5 0 0 0 4 11v1a3.5 3.5 0 0 0 2.5 3.35V17A3 3 0 0 0 9.5 20V4Z"/><path d="M14.5 4A3.5 3.5 0 0 1 18 7.5v.4a3.5 3.5 0 0 1 2 3.1v1a3.5 3.5 0 0 1-2.5 3.35V17a3 3 0 0 1-3 3V4Z"/></>,
    users: <><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/></>,
    message: <><path d="M4 5h16v11H8l-4 4z"/><path d="M8 9h8M8 12h5"/></>,
    bell: <><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9"/><path d="M10 21h4"/></>,
    calendar: <><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M16 3v4M8 3v4M3 10h18"/></>,
    settings: <><circle cx="12" cy="12" r="3"/><path d="M19 12a7 7 0 0 0-.1-1.2l2-1.5-2-3.4-2.4 1a7 7 0 0 0-2-1.2L14.2 3h-4.4l-.4 2.7a7 7 0 0 0-2 1.2l-2.4-1-2 3.4 2 1.5A7 7 0 0 0 5 12c0 .4 0 .8.1 1.2l-2 1.5 2 3.4 2.4-1a7 7 0 0 0 2 1.2l.4 2.7h4.4l.4-2.7a7 7 0 0 0 2-1.2l2.4 1 2-3.4-2-1.5c.1-.4.1-.8.1-1.2Z"/></>,
    logout: <><path d="M10 17l5-5-5-5"/><path d="M15 12H3"/><path d="M14 3h5a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-5"/></>,
    menu: <><path d="M4 7h16M4 12h16M4 17h16"/></>,
    close: <><path d="M6 6l12 12M18 6 6 18"/></>,
    spark: <><path d="m12 3 1.2 3.8L17 8l-3.8 1.2L12 13l-1.2-3.8L7 8l3.8-1.2L12 3Z"/></>,
  };
  return <svg {...common}>{paths[name]}</svg>;
}

function App() {
  const [page, setPage] = useState("home");
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedSubject, setSelectedSubject] = useState(null);
  const [unreadNotifications, setUnreadNotifications] = useState(0);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  function pageFromUrl() {
    const params = new URLSearchParams(window.location.search);
    return params.get("noteQr") && params.get("token") ? "notes" : "home";
  }

  useEffect(() => {
    loadSession();
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
      if (!newSession) {
        setPage("login");
      } else {
        const params = new URLSearchParams(window.location.search);
        if (params.get("noteQr") && params.get("token")) setPage("notes");
      }
    });
    return () => subscription.unsubscribe();
  }, []);

  async function loadSession() {
    try {
      const { data: { session: currentSession } } = await supabase.auth.getSession();
      setSession(currentSession);
      if (!currentSession) setPage("login");
      else setPage(pageFromUrl());
    } catch (error) {
      console.error("Could not load session:", error);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!session?.user?.id) {
      setUnreadNotifications(0);
      return;
    }

    const userId = session.user.id;
    let channel = null;

    async function loadUnread() {
      try {
        const { count, error } = await supabase
          .from("notifications")
          .select("id", { count: "exact", head: true })
          .eq("user_id", userId)
          .eq("is_read", false);
        if (error) throw error;
        setUnreadNotifications(count || 0);
      } catch (error) {
        console.error("Could not load unread notifications:", error);
      }
    }

    loadUnread();
    channel = supabase
      .channel(`app-notifications-${userId}`)
      .on("postgres_changes", {
        event: "*", schema: "public", table: "notifications",
        filter: `user_id=eq.${userId}`,
      }, loadUnread)
      .subscribe();

    return () => {
      if (channel) supabase.removeChannel(channel);
    };
  }, [session?.user?.id]);

  async function handleLogout() {
    try {
      await supabase.auth.signOut();
    } catch (error) {
      console.error("Could not log out:", error);
    }
    setSession(null);
    setUnreadNotifications(0);
    setPage("login");
  }

  function navigate(nextPage) {
    setPage(nextPage);
    setSidebarOpen(false);
  }

  function openSubject(subject) {
    setSelectedSubject(subject);
    navigate("subjectResources");
  }

  const userLabel = useMemo(() => {
    const email = session?.user?.email || "";
    return email.split("@")[0] || "Student";
  }, [session?.user?.email]);

  const currentTitle = page === "subjectResources"
    ? selectedSubject?.name || "Subject Resources"
    : PAGE_TITLES[page] || "Tristan Revision";

  if (loading) {
    return (
      <div className="v2-loading-screen">
        <div className="v2-loading-orb" />
        <img src="/tristan-revision-logo.png" alt="" />
        <span>Preparing your workspace...</span>
      </div>
    );
  }

  if (!session) {
    if (page === "signup") return <Signup setPage={setPage} />;
    return <Login setPage={setPage} />;
  }

  return (
    <div className="v2-app">
      <div className={`v2-sidebar-backdrop ${sidebarOpen ? "is-open" : ""}`} onClick={() => setSidebarOpen(false)} />

      <aside className={`v2-sidebar ${sidebarOpen ? "is-open" : ""}`}>
        <div className="v2-brand">
          <div className="v2-brand-mark">
            <img src="/tristan-revision-logo.png" alt="Tristan Sixth Form Revision" />
          </div>
          <div className="v2-brand-copy">
            <strong>Tristan</strong>
            <span>Sixth Form Revision</span>
          </div>
          <button className="v2-mobile-close" type="button" onClick={() => setSidebarOpen(false)} aria-label="Close menu">
            <Icon name="close" />
          </button>
        </div>

        <div className="v2-sidebar-highlight">
          <span className="v2-highlight-icon"><Icon name="spark" size={18} /></span>
          <div><strong>Your study space</strong><span>Everything in one place</span></div>
        </div>

        <nav className="v2-nav">
          {NAV_GROUPS.map((group) => (
            <div className="v2-nav-group" key={group.label}>
              <div className="v2-nav-label">{group.label}</div>
              {group.items.map((item) => {
                const active = page === item.page;
                return (
                  <button
                    key={item.page}
                    type="button"
                    className={`v2-nav-item ${active ? "active" : ""}`}
                    onClick={() => navigate(item.page)}
                  >
                    <span className="v2-nav-icon"><Icon name={item.icon} /></span>
                    <span className="v2-nav-text">{item.label}</span>
                    {item.page === "notifications" && unreadNotifications > 0 && (
                      <span className="v2-notification-badge">
                        {unreadNotifications > 99 ? "99+" : unreadNotifications}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          ))}
        </nav>

        <div className="v2-sidebar-bottom">
          <div className="v2-mini-profile">
            <div className="v2-mini-avatar">{userLabel.slice(0,1).toUpperCase()}</div>
            <div className="v2-mini-profile-copy">
              <strong>{userLabel}</strong><span>Student account</span>
            </div>
          </div>
          <button className="v2-logout" type="button" onClick={handleLogout}>
            <Icon name="logout" /><span>Log out</span>
          </button>
        </div>
      </aside>

      <main className="v2-main">
        <header className="v2-topbar">
          <div className="v2-topbar-left">
            <button className="v2-mobile-menu" type="button" onClick={() => setSidebarOpen(true)} aria-label="Open menu">
              <Icon name="menu" />
            </button>
            <div>
              <div className="v2-breadcrumb">TRISTAN REVISION / {currentTitle.toUpperCase()}</div>
              <h1>{currentTitle}</h1>
            </div>
          </div>
          <div className="v2-topbar-actions">
            <button className="v2-topbar-icon-button" type="button" onClick={() => navigate("notifications")} aria-label="Notifications">
              <Icon name="bell" />
              {unreadNotifications > 0 && <span className="v2-dot" />}
            </button>
            <button className="v2-topbar-avatar" type="button" onClick={() => navigate("subjectSelection")} title="Manage subjects">
              {userLabel.slice(0,1).toUpperCase()}
            </button>
          </div>
        </header>

        <div className="v2-page-shell">
          {page === "home" && <Home setPage={navigate} onSelectSubject={openSubject} unreadNotifications={unreadNotifications} />}
          {page === "revision" && <Revision setPage={navigate} onSelectSubject={openSubject} />}
          {page === "pastPapers" && <PastPapers setPage={navigate} />}
          {page === "assignments" && <Assignments setPage={navigate} />}
          {page === "notes" && <Notes setPage={navigate} />}
          {page === "studyHub" && <StudyHub setPage={navigate} />}
          {page === "friends" && <Friends setPage={navigate} />}
          {page === "messages" && <Messages setPage={navigate} />}
          {page === "notifications" && (
            <Notifications setPage={navigate} onUnreadCountChange={setUnreadNotifications} />
          )}
          {page === "timetable" && <Timetable setPage={navigate} />}
          {page === "subjectSelection" && <SubjectSelection setPage={navigate} />}
          {page === "subjectResources" && <SubjectResources subject={selectedSubject} setPage={navigate} />}
        </div>
      </main>
    </div>
  );
}

export default App;
