import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";

function Progress({ setPage }) {
  const [progress, setProgress] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    loadProgress();
  }, []);

  async function loadProgress() {
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

      let { data, error: progressError } =
        await supabase
          .from("student_progress")
          .select("*")
          .eq("user_id", user.id)
          .maybeSingle();

      if (progressError) {
        throw progressError;
      }

      /*
       * Create a progress row if the student
       * does not have one yet.
       */

      if (!data) {
        const { data: newProgress, error: createError } =
          await supabase
            .from("student_progress")
            .insert({
              user_id: user.id,
              xp: 0,
              questions_answered: 0,
              questions_correct: 0,
              current_streak: 0,
              best_streak: 0,
            })
            .select()
            .single();

        if (createError) {
          throw createError;
        }

        data = newProgress;
      }

      setProgress(data);
    } catch (err) {
      console.error(
        "Could not load progress:",
        err
      );

      setError(
        err?.message ||
          "Could not load your progress."
      );
    } finally {
      setLoading(false);
    }
  }

  function getLevel(xp) {
    return Math.floor(xp / 500) + 1;
  }

  function getCurrentLevelXP(xp) {
    return xp % 500;
  }

  function getXPToNextLevel(xp) {
    return 500 - (xp % 500);
  }

  function getAccuracy() {
    if (
      !progress ||
      progress.questions_answered === 0
    ) {
      return 0;
    }

    return Math.round(
      (progress.questions_correct /
        progress.questions_answered) *
        100
    );
  }

  function getAchievements() {
    if (!progress) {
      return [];
    }

    return [
      {
        icon: "🥉",
        title: "First Steps",
        description:
          "Complete your first quiz.",
        unlocked:
          progress.questions_answered >= 1,
      },
      {
        icon: "🧠",
        title: "Knowledge Seeker",
        description:
          "Answer 100 questions.",
        unlocked:
          progress.questions_answered >= 100,
      },
      {
        icon: "💯",
        title: "Perfect Score",
        description:
          "Get 20 questions correct in a quiz.",
        unlocked: false,
      },
      {
        icon: "🔥",
        title: "On Fire",
        description:
          "Get 10 questions correct in a row.",
        unlocked:
          progress.best_streak >= 10,
      },
      {
        icon: "⚡",
        title: "Speed Demon",
        description:
          "Finish a quiz with plenty of time left.",
        unlocked: false,
      },
      {
        icon: "📚",
        title: "Subject Master",
        description:
          "Answer 100 questions on one topic.",
        unlocked: false,
      },
    ];
  }

  if (loading) {
    return (
      <div className="no-subjects">
        <div className="no-subjects-icon">
          🏆
        </div>

        <h2>
          Loading your progress...
        </h2>

        <p>
          Getting your XP and achievements.
        </p>
      </div>
    );
  }

  if (!progress) {
    return (
      <div className="no-subjects">
        <div className="no-subjects-icon">
          😕
        </div>

        <h3>
          Progress unavailable
        </h3>

        <p>
          {error ||
            "Could not load your progress."}
        </p>
      </div>
    );
  }

  const level = getLevel(progress.xp);
  const currentLevelXP =
    getCurrentLevelXP(progress.xp);
  const xpToNextLevel =
    getXPToNextLevel(progress.xp);

  const progressPercentage =
    (currentLevelXP / 500) * 100;

  const accuracy = getAccuracy();

  const achievements =
    getAchievements();

  return (
    <div className="study-hub">

      {/* HEADER */}

      <div
        className="revision-header"
        style={{
          marginBottom: "25px",
        }}
      >
        <div>
          <p className="card-eyebrow">
            YOUR PROGRESS
          </p>

          <h2>
            Progress 🏆
          </h2>

          <p className="revision-description">
            Keep revising, earn XP and level up.
          </p>
        </div>
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

      {/* LEVEL CARD */}

      <div
        style={{
          background:
            "linear-gradient(135deg, #4f46e5, #6366f1)",
          color: "white",
          borderRadius: "24px",
          padding: "30px",
          marginBottom: "25px",
          boxShadow:
            "0 15px 40px rgba(79,70,229,0.25)",
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent:
              "space-between",
            alignItems: "center",
            gap: "20px",
          }}
        >
          <div>
            <div
              style={{
                fontSize: "14px",
                opacity: 0.8,
                fontWeight: 600,
              }}
            >
              CURRENT LEVEL
            </div>

            <div
              style={{
                fontSize: "48px",
                fontWeight: 800,
                marginTop: "5px",
              }}
            >
              {level}
            </div>

            <div
              style={{
                fontSize: "18px",
                marginTop: "5px",
                fontWeight: 600,
              }}
            >
              ⭐ {progress.xp} XP
            </div>
          </div>

          <div
            style={{
              fontSize: "65px",
            }}
          >
            🏆
          </div>
        </div>

        {/* XP BAR */}

        <div
          style={{
            marginTop: "25px",
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent:
                "space-between",
              fontSize: "13px",
              marginBottom: "8px",
              opacity: 0.9,
            }}
          >
            <span>
              {currentLevelXP} / 500 XP
            </span>

            <span>
              {xpToNextLevel} XP to Level{" "}
              {level + 1}
            </span>
          </div>

          <div
            style={{
              height: "12px",
              background:
                "rgba(255,255,255,0.25)",
              borderRadius: "999px",
              overflow: "hidden",
            }}
          >
            <div
              style={{
                width:
                  `${progressPercentage}%`,
                height: "100%",
                background: "white",
                borderRadius: "999px",
                transition:
                  "width 0.4s ease",
              }}
            />
          </div>
        </div>
      </div>

      {/* STATISTICS */}

      <div
        className="revision-subject-grid"
        style={{
          marginBottom: "30px",
        }}
      >

        <div className="revision-subject-card">
          <div className="revision-subject-top">
            <div className="revision-subject-icon">
              ⭐
            </div>
          </div>

          <div className="revision-subject-content">
            <p className="card-eyebrow">
              TOTAL XP
            </p>

            <h3>
              {progress.xp}
            </h3>

            <p>
              XP earned
            </p>
          </div>
        </div>

        <div className="revision-subject-card">
          <div className="revision-subject-top">
            <div className="revision-subject-icon">
              🧠
            </div>
          </div>

          <div className="revision-subject-content">
            <p className="card-eyebrow">
              QUESTIONS
            </p>

            <h3>
              {progress.questions_answered}
            </h3>

            <p>
              Questions answered
            </p>
          </div>
        </div>

        <div className="revision-subject-card">
          <div className="revision-subject-top">
            <div className="revision-subject-icon">
              🎯
            </div>
          </div>

          <div className="revision-subject-content">
            <p className="card-eyebrow">
              ACCURACY
            </p>

            <h3>
              {accuracy}%
            </h3>

            <p>
              Correct answers
            </p>
          </div>
        </div>

        <div className="revision-subject-card">
          <div className="revision-subject-top">
            <div className="revision-subject-icon">
              🔥
            </div>
          </div>

          <div className="revision-subject-content">
            <p className="card-eyebrow">
              STREAK
            </p>

            <h3>
              {progress.current_streak}
            </h3>

            <p>
              Current correct streak
            </p>
          </div>
        </div>

      </div>

      {/* ACHIEVEMENTS */}

      <div className="revision-section-heading">
        <div>
          <h3>
            🏅 Achievements
          </h3>

          <p>
            Keep studying to unlock them all.
          </p>
        </div>
      </div>

      <div
        className="revision-subject-grid"
        style={{
          marginBottom: "30px",
        }}
      >
        {achievements.map(
          (achievement) => (
            <div
              key={achievement.title}
              className="revision-subject-card"
              style={{
                opacity:
                  achievement.unlocked
                    ? 1
                    : 0.55,
              }}
            >
              <div className="revision-subject-top">
                <div
                  className="revision-subject-icon"
                  style={{
                    filter:
                      achievement.unlocked
                        ? "none"
                        : "grayscale(1)",
                  }}
                >
                  {achievement.icon}
                </div>

                <div>
                  {achievement.unlocked
                    ? "✅"
                    : "🔒"}
                </div>
              </div>

              <div className="revision-subject-content">
                <h3>
                  {achievement.title}
                </h3>

                <p>
                  {achievement.description}
                </p>

                <p
                  style={{
                    marginTop: "10px",
                    fontWeight: 700,
                    color:
                      achievement.unlocked
                        ? "#16a34a"
                        : "#94a3b8",
                  }}
                >
                  {achievement.unlocked
                    ? "Unlocked!"
                    : "Locked"}
                </p>
              </div>
            </div>
          )
        )}
      </div>

      {/* MOTIVATION */}

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
          KEEP GOING
        </p>

        <h3>
          🎯 Your next goal
        </h3>

        <p
          style={{
            color: "#475569",
            lineHeight: 1.6,
          }}
        >
          You need{" "}
          <strong>
            {xpToNextLevel} XP
          </strong>{" "}
          to reach Level{" "}
          <strong>
            {level + 1}
          </strong>
          .
        </p>

        <button
          type="button"
          className="primary-card-button"
          onClick={() =>
            setPage("revision")
          }
        >
          🧠 Start Revising
        </button>
      </div>

    </div>
  );
}

export default Progress;