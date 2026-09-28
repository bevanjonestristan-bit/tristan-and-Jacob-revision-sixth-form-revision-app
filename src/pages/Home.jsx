import { useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabase";

const QUICK_ACTIONS = [
  { title: "Start revising", description: "Jump into your subjects and keep momentum going.", icon: "✦", page: "revision", accent: "violet" },
  { title: "Study Hub", description: "Study alongside friends and other students.", icon: "◎", page: "studyHub", accent: "cyan" },
  { title: "My timetable", description: "See what your day and week look like.", icon: "◫", page: "timetable", accent: "amber" },
];

function Home({ setPage, onSelectSubject, unreadNotifications = 0 }) {
  const [profile, setProfile] = useState(null);
  const [subjects, setSubjects] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { loadDashboard(); }, []);

  async function loadDashboard() {
    try {
      setLoading(true);
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError || !user) {
        setPage("login");
        return;
      }

      const { data: profileData, error: profileError } = await supabase
        .from("profiles")
        .select("full_name, school_email, year_group")
        .eq("id", user.id)
        .maybeSingle();

      if (profileError) console.error("Could not load profile:", profileError);
      setProfile(profileData);

      const { data: subjectData, error: subjectError } = await supabase
        .from("student_subjects")
        .select(`subject_id, subjects (id, name, description, icon)`)
        .eq("student_id", user.id);

      if (subjectError) {
        console.error("Could not load subjects:", subjectError);
      } else {
        setSubjects((subjectData || []).map((item) => item.subjects).filter(Boolean));
      }
    } catch (error) {
      console.error("Could not load dashboard:", error);
    } finally {
      setLoading(false);
    }
  }

  const firstName = profile?.full_name?.trim()?.split(" ")[0] || "Student";
  const dateLabel = useMemo(() => new Intl.DateTimeFormat("en-GB", {
    weekday: "long", day: "numeric", month: "long"
  }).format(new Date()), []);
  const greeting = useMemo(() => {
    const hour = new Date().getHours();
    if (hour < 12) return "Good morning";
    if (hour < 18) return "Good afternoon";
    return "Good evening";
  }, []);

  if (loading) {
    return (
      <div className="v2-home-loading">
        <div className="v2-skeleton v2-skeleton-hero" />
        <div className="v2-home-loading-grid">
          <div className="v2-skeleton" /><div className="v2-skeleton" /><div className="v2-skeleton" />
        </div>
      </div>
    );
  }

  return (
    <div className="v2-home">
      <section className="v2-hero">
        <div className="v2-hero-glow v2-hero-glow-one" />
        <div className="v2-hero-glow v2-hero-glow-two" />

        <div className="v2-hero-copy">
          <div className="v2-hero-kicker"><span className="v2-kicker-dot" />{dateLabel}</div>
          <h2>{greeting}, <span>{firstName}.</span></h2>
          <p>Your study space is ready. Pick up where you left off, organise your work, and make this session count.</p>
          <div className="v2-hero-actions">
            <button type="button" className="v2-button v2-button-primary" onClick={() => setPage("revision")}>
              Start revising <span>→</span>
            </button>
            <button type="button" className="v2-button v2-button-ghost" onClick={() => setPage("timetable")}>
              View timetable
            </button>
          </div>
        </div>

        <div className="v2-hero-orbit" aria-hidden="true">
          <div className="v2-orbit-ring v2-orbit-ring-one" />
          <div className="v2-orbit-ring v2-orbit-ring-two" />
          <div className="v2-orbit-core"><span>TR</span></div>
          <div className="v2-orbit-chip v2-orbit-chip-one">A*</div>
          <div className="v2-orbit-chip v2-orbit-chip-two">∞</div>
          <div className="v2-orbit-chip v2-orbit-chip-three">Σ</div>
        </div>
      </section>

      <section className="v2-stat-row">
        <button className="v2-stat-card" type="button" onClick={() => setPage("revision")}>
          <span className="v2-stat-icon violet">↗</span>
          <div><strong>{subjects.length}</strong><span>Subjects selected</span></div>
        </button>
        <button className="v2-stat-card" type="button" onClick={() => setPage("notifications")}>
          <span className="v2-stat-icon rose">•</span>
          <div><strong>{unreadNotifications}</strong><span>Unread notifications</span></div>
        </button>
        <button className="v2-stat-card" type="button" onClick={() => setPage("assignments")}>
          <span className="v2-stat-icon cyan">✓</span>
          <div><strong>Ready</strong><span>Assignment workspace</span></div>
        </button>
        <button className="v2-stat-card" type="button" onClick={() => setPage("notes")}>
          <span className="v2-stat-icon amber">✎</span>
          <div><strong>Notes</strong><span>Your study notebook</span></div>
        </button>
      </section>

      <div className="v2-dashboard-grid">
        <section className="v2-panel v2-actions-panel">
          <div className="v2-section-heading">
            <div><span className="v2-section-eyebrow">QUICK LAUNCH</span><h3>What do you want to do?</h3></div>
            <span className="v2-section-pill">Workspace</span>
          </div>
          <div className="v2-quick-grid">
            {QUICK_ACTIONS.map((action) => (
              <button key={action.page} type="button" className={`v2-quick-card ${action.accent}`} onClick={() => setPage(action.page)}>
                <span className="v2-quick-icon">{action.icon}</span>
                <div><strong>{action.title}</strong><p>{action.description}</p></div>
                <span className="v2-quick-arrow">↗</span>
              </button>
            ))}
          </div>
        </section>

        <section className="v2-panel v2-profile-panel">
          <div className="v2-profile-gradient">
            <div className="v2-profile-avatar">{firstName.slice(0,1).toUpperCase()}</div>
            <div>
              <span>STUDENT PROFILE</span>
              <h3>{profile?.full_name || "Your account"}</h3>
              <p>{profile?.year_group || "Sixth Form"}</p>
            </div>
          </div>
          <div className="v2-profile-details">
            <div><span>School email</span><strong>{profile?.school_email || "Not set"}</strong></div>
            <div><span>Year group</span><strong>{profile?.year_group || "Not set"}</strong></div>
          </div>
          <button type="button" className="v2-profile-button" onClick={() => setPage("subjectSelection")}>
            Manage my subjects <span>→</span>
          </button>
        </section>
      </div>

      <section className="v2-panel v2-subjects-panel">
        <div className="v2-section-heading">
          <div>
            <span className="v2-section-eyebrow">YOUR STUDIES</span>
            <h3>My subjects</h3>
            <p>Everything you're studying, one click away.</p>
          </div>
          <button type="button" className="v2-button v2-button-soft" onClick={() => setPage("subjectSelection")}>
            Manage subjects
          </button>
        </div>

        {subjects.length === 0 ? (
          <div className="v2-empty-state">
            <div className="v2-empty-icon">＋</div>
            <h4>Build your study dashboard</h4>
            <p>Select your A-level subjects and they'll appear here.</p>
            <button type="button" className="v2-button v2-button-primary" onClick={() => setPage("subjectSelection")}>
              Choose my subjects
            </button>
          </div>
        ) : (
          <div className="v2-subject-grid">
            {subjects.map((subject, index) => (
              <button
                key={subject.id}
                type="button"
                className={`v2-subject-card subject-tone-${(index % 4) + 1}`}
                onClick={() => onSelectSubject ? onSelectSubject(subject) : setPage("subjectResources")}
              >
                <div className="v2-subject-top">
                  <div className="v2-subject-icon">{subject.icon || "✦"}</div>
                  <span className="v2-subject-arrow">↗</span>
                </div>
                <div className="v2-subject-copy">
                  <h4>{subject.name}</h4>
                  <p>{subject.description || "Sixth form subject"}</p>
                </div>
                <div className="v2-subject-footer">
                  <span>Open subject</span><span className="v2-subject-line" />
                </div>
              </button>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

export default Home;
