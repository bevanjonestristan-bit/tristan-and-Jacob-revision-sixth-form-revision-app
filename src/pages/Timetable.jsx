import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import "./Timetable.css";

const days = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
];

const periods = [
  {
    name: "Registration",
    time: "8:30 – 8:40",
    start: "08:30",
    end: "08:40",
  },
  {
    name: "Period 1",
    time: "8:45 – 9:55",
    start: "08:45",
    end: "09:55",
  },
  {
    name: "Break",
    time: "9:55 – 10:15",
    start: "09:55",
    end: "10:15",
    break: true,
  },
  {
    name: "Period 2",
    time: "10:15 – 11:25",
    start: "10:15",
    end: "11:25",
  },
  {
    name: "Break",
    time: "11:25 – 11:45",
    start: "11:25",
    end: "11:45",
    break: true,
  },
  {
    name: "Period 3",
    time: "11:45 – 12:55",
    start: "11:45",
    end: "12:55",
  },
  {
    name: "Lunch",
    time: "12:55 – 1:55",
    start: "12:55",
    end: "13:55",
    break: true,
  },
  {
    name: "Period 4",
    time: "1:55 – 3:05",
    start: "13:55",
    end: "15:05",
  },
  {
    name: "Period 5",
    time: "3:05 – 4:15",
    start: "15:05",
    end: "16:15",
  },
];

const dayIndexes = {
  Monday: 0,
  Tuesday: 1,
  Wednesday: 2,
  Thursday: 3,
  Friday: 4,
};

const dayShortNames = {
  Monday: "MON",
  Tuesday: "TUE",
  Wednesday: "WED",
  Thursday: "THU",
  Friday: "FRI",
};

function Timetable() {
  const [week, setWeek] = useState(1);
  const [entries, setEntries] = useState([]);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const [showModal, setShowModal] = useState(false);
  const [editingEntry, setEditingEntry] = useState(null);

  const [selectedDay, setSelectedDay] =
    useState("Monday");

  const [selectedPeriod, setSelectedPeriod] =
    useState("Period 1");

  const [subject, setSubject] = useState("");
  const [teacher, setTeacher] = useState("");
  const [room, setRoom] = useState("");

  const [currentTime, setCurrentTime] =
    useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 30000);

    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    loadTimetable();
  }, [week]);

  async function loadTimetable() {
    try {
      setLoading(true);
      setError("");

      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError) {
        throw userError;
      }

      if (!user) {
        setError("You must be logged in.");
        return;
      }

      const {
        data,
        error: timetableError,
      } = await supabase
        .from("timetable_entries")
        .select(`
          id,
          user_id,
          week,
          day,
          period_name,
          subject,
          teacher,
          room,
          start_time,
          end_time
        `)
        .eq("user_id", user.id)
        .eq("week", week)
        .order("day")
        .order("start_time");

      if (timetableError) {
        throw timetableError;
      }

      setEntries(data || []);
    } catch (err) {
      console.error(
        "Could not load timetable:",
        err
      );

      setError(
        err?.message ||
          "Could not load your timetable."
      );
    } finally {
      setLoading(false);
    }
  }

  function getEntry(day, periodName) {
    const dayIndex = dayIndexes[day];

    return entries.find(
      (entry) =>
        Number(entry.day) === dayIndex &&
        entry.period_name === periodName
    );
  }

  function timeToMinutes(time) {
    if (!time) {
      return 0;
    }

    const [hours, minutes] =
      time.split(":").map(Number);

    return hours * 60 + minutes;
  }

  function isCurrentPeriod(period) {
    if (period.break) {
      return false;
    }

    const currentDay =
      currentTime.getDay();

    if (
      currentDay < 1 ||
      currentDay > 5
    ) {
      return false;
    }

    const periodStart =
      timeToMinutes(period.start);

    const periodEnd =
      timeToMinutes(period.end);

    const nowMinutes =
      currentTime.getHours() * 60 +
      currentTime.getMinutes();

    return (
      nowMinutes >= periodStart &&
      nowMinutes < periodEnd
    );
  }

  function isCurrentDay(day) {
    const currentDay =
      currentTime.getDay();

    if (
      currentDay < 1 ||
      currentDay > 5
    ) {
      return false;
    }

    return (
      dayIndexes[day] ===
      currentDay - 1
    );
  }

  function getRoutineLabel(
    periodName,
    day
  ) {
    if (
      periodName === "Registration"
    ) {
      if (day === "Monday") {
        return "Chapel / Pastoral";
      }

      if (
        day === "Tuesday" ||
        day === "Wednesday" ||
        day === "Thursday"
      ) {
        return "Tutor Period";
      }

      if (day === "Friday") {
        return "Head's Assembly";
      }
    }

    if (
      periodName === "Period 4" ||
      periodName === "Period 5"
    ) {
      if (
        day === "Tuesday" ||
        day === "Thursday"
      ) {
        return "Games";
      }

      if (day === "Wednesday") {
        return "Enrichment";
      }
    }

    return null;
  }

  function openAddModal(
    day,
    periodName
  ) {
    setEditingEntry(null);
    setSelectedDay(day);
    setSelectedPeriod(periodName);
    setSubject("");
    setTeacher("");
    setRoom("");
    setError("");
    setShowModal(true);
  }

  function openEditModal(
    entry,
    day,
    period
  ) {
    setEditingEntry(entry);
    setSelectedDay(day);
    setSelectedPeriod(period.name);

    setSubject(entry.subject || "");
    setTeacher(entry.teacher || "");
    setRoom(entry.room || "");

    setError("");
    setShowModal(true);
  }

  function closeModal() {
    if (saving) {
      return;
    }

    setShowModal(false);
    setEditingEntry(null);
  }

  async function saveLesson(event) {
    event.preventDefault();

    if (saving) {
      return;
    }

    try {
      setSaving(true);
      setError("");

      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError) {
        throw userError;
      }

      if (!user) {
        throw new Error(
          "You must be logged in."
        );
      }

      const trimmedSubject =
        subject.trim();

      const trimmedTeacher =
        teacher.trim();

      const trimmedRoom =
        room.trim();

      if (!trimmedSubject) {
        throw new Error(
          "Please enter a subject."
        );
      }

      const period = periods.find(
        (item) =>
          item.name === selectedPeriod
      );

      if (!period) {
        throw new Error(
          "Invalid period."
        );
      }

      const dayIndex =
        dayIndexes[selectedDay];

      if (
        typeof dayIndex !== "number"
      ) {
        throw new Error(
          "Invalid day."
        );
      }

      const lessonData = {
        user_id: user.id,
        week,
        day: dayIndex,
        period_name:
          selectedPeriod,
        subject:
          trimmedSubject,
        teacher:
          trimmedTeacher || null,
        room:
          trimmedRoom || null,
        start_time:
          period.start,
        end_time:
          period.end,
      };

      if (editingEntry) {
        const {
          error: updateError,
        } = await supabase
          .from("timetable_entries")
          .update(lessonData)
          .eq(
            "id",
            editingEntry.id
          )
          .eq(
            "user_id",
            user.id
          );

        if (updateError) {
          throw updateError;
        }
      } else {
        const {
          error: insertError,
        } = await supabase
          .from("timetable_entries")
          .insert(lessonData);

        if (insertError) {
          throw insertError;
        }
      }

      setShowModal(false);
      setEditingEntry(null);

      await loadTimetable();
    } catch (err) {
      console.error(
        "Could not save lesson:",
        err
      );

      setError(
        err?.message ||
          "Could not save the lesson."
      );
    } finally {
      setSaving(false);
    }
  }

  async function deleteLesson(entry) {
    const confirmed =
      window.confirm(
        "Delete this lesson?"
      );

    if (!confirmed) {
      return;
    }

    try {
      setError("");

      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError) {
        throw userError;
      }

      if (!user) {
        throw new Error(
          "You must be logged in."
        );
      }

      const {
        error: deleteError,
      } = await supabase
        .from("timetable_entries")
        .delete()
        .eq(
          "id",
          entry.id
        )
        .eq(
          "user_id",
          user.id
        );

      if (deleteError) {
        throw deleteError;
      }

      await loadTimetable();
    } catch (err) {
      console.error(
        "Could not delete lesson:",
        err
      );

      setError(
        err?.message ||
          "Could not delete the lesson."
      );
    }
  }

  if (loading) {
    return (
      <div className="timetable-page">
        <div className="timetable-loading">
          <div className="timetable-loading-icon">
            📅
          </div>

          <h2>
            Loading timetable
          </h2>

          <p>
            Getting your lessons ready...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="timetable-page">

      {/* HEADER */}

      <div className="timetable-top">

        <div className="timetable-heading">

          <div className="timetable-title-row">
            <div className="timetable-title-icon">
              📅
            </div>

            <div>
              <p className="card-eyebrow">
                YOUR WEEK
              </p>

              <h2>
                Timetable
              </h2>
            </div>
          </div>

          <p className="timetable-subtitle">
            Plan your Sixth Form week,
            keep your lessons organised
            and see what's happening next.
          </p>

        </div>

        <div className="timetable-week">

          <button
            type="button"
            className={
              week === 1
                ? "timetable-week-active"
                : ""
            }
            onClick={() =>
              setWeek(1)
            }
          >
            <span>
              WEEK 1
            </span>
          </button>

          <button
            type="button"
            className={
              week === 2
                ? "timetable-week-active"
                : ""
            }
            onClick={() =>
              setWeek(2)
            }
          >
            <span>
              WEEK 2
            </span>
          </button>

        </div>

      </div>

      {/* ERROR */}

      {error && (
        <div className="timetable-error">
          <div className="timetable-error-icon">
            !
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

      {/* NOTICE */}

      <div className="timetable-notice">

        <div className="timetable-notice-icon">
          ✨
        </div>

        <div>
          <strong>
            Build your timetable
          </strong>

          <p>
            Click an empty lesson slot to
            add a lesson. Click an existing
            lesson to edit it.
          </p>
        </div>

        <div className="timetable-notice-right">
          <span>
            WEEK {week}
          </span>

          <strong>
            {entries.length}
          </strong>

          <small>
            {entries.length === 1
              ? "lesson"
              : "lessons"}
          </small>
        </div>

      </div>

      {/* TIMETABLE */}

      <div className="timetable-wrapper">

        <div className="timetable-grid">

          {/* CORNER */}

          <div className="timetable-corner">
            <span>
              TIME
            </span>
          </div>

          {/* DAYS */}

          {days.map((day) => {

            const current =
              isCurrentDay(day);

            return (
              <div
                key={day}
                className={
                  current
                    ? "timetable-day timetable-day-current"
                    : "timetable-day"
                }
              >

                <span className="day-short">
                  {dayShortNames[day]}
                </span>

                <strong>
                  {day}
                </strong>

                {current && (
                  <span className="today-pill">
                    TODAY
                  </span>
                )}

              </div>
            );
          })}

          {/* PERIODS */}

          {periods.map((period) => (

            <div
              key={
                period.name +
                period.time
              }
              className="timetable-row"
              style={{
                display: "contents",
              }}
            >

              {/* TIME */}

              <div
                className={
                  period.break
                    ? "timetable-time timetable-time-break"
                    : "timetable-time"
                }
              >

                <strong>
                  {period.name}
                </strong>

                <span>
                  {period.time}
                </span>

              </div>

              {/* CELLS */}

              {days.map((day) => {

                const entry =
                  getEntry(
                    day,
                    period.name
                  );

                const current =
                  isCurrentPeriod(
                    period
                  ) &&
                  isCurrentDay(day);

                const routine =
                  getRoutineLabel(
                    period.name,
                    day
                  );

                const special =
                  routine === "Games"
                    ? "games"
                    : routine ===
                      "Enrichment"
                    ? "enrichment"
                    : routine
                    ? "routine"
                    : "";

                return (
                  <div
                    key={`${day}-${period.name}`}
                    className={[
                      "timetable-cell",

                      period.break
                        ? "timetable-cell-break"
                        : "",

                      current
                        ? "timetable-cell-current"
                        : "",

                      entry
                        ? "timetable-cell-filled"
                        : "",

                      special
                        ? `timetable-cell-${special}`
                        : "",
                    ]
                      .filter(Boolean)
                      .join(" ")}

                    onClick={() => {

                      if (
                        period.break
                      ) {
                        return;
                      }

                      if (entry) {
                        openEditModal(
                          entry,
                          day,
                          period
                        );
                      } else {
                        openAddModal(
                          day,
                          period.name
                        );
                      }

                    }}
                  >

                    {/* BREAK */}

                    {period.break ? (

                      <div className="break-content">

                        <span className="break-icon">
                          {period.name ===
                          "Lunch"
                            ? "🍴"
                            : "☕"}
                        </span>

                        <span>
                          {period.name}
                        </span>

                      </div>

                    ) : entry ? (

                      /* LESSON */

                      <div className="lesson-content">

                        <div className="lesson-subject">
                          {entry.subject}
                        </div>

                        {entry.teacher && (
                          <div className="lesson-detail">
                            <span>
                              👤
                            </span>

                            {entry.teacher}
                          </div>
                        )}

                        {entry.room && (
                          <div className="lesson-detail">
                            <span>
                              📍
                            </span>

                            {entry.room}
                          </div>
                        )}

                        {current && (
                          <span className="current-lesson-label">
                            ● NOW
                          </span>
                        )}

                        <span className="lesson-edit-hint">
                          Click to edit
                        </span>

                      </div>

                    ) : routine ? (

                      /* ROUTINE */

                      <div className="special-content">

                        <span className="special-icon">
                          {routine ===
                          "Games"
                            ? "🎮"
                            : routine ===
                              "Enrichment"
                            ? "✨"
                            : "🎓"}
                        </span>

                        <strong>
                          {routine}
                        </strong>

                      </div>

                    ) : (

                      /* EMPTY */

                      <div className="empty-slot">

                        <span className="empty-plus">
                          +
                        </span>

                        <span>
                          Add lesson
                        </span>

                      </div>

                    )}

                  </div>
                );
              })}

            </div>
          ))}

        </div>

      </div>

      {/* LEGEND */}

      <div className="timetable-legend">

        <div className="legend-title">
          KEY
        </div>

        <div className="legend-item">
          <span className="legend-dot lesson-dot" />
          Lesson
        </div>

        <div className="legend-item">
          <span className="legend-dot games-dot" />
          Games
        </div>

        <div className="legend-item">
          <span className="legend-dot enrichment-dot" />
          Enrichment
        </div>

        <div className="legend-item">
          <span className="legend-dot routine-dot" />
          Registration
        </div>

        <div className="legend-item">
          <span className="legend-dot current-dot" />
          Current
        </div>

      </div>

      {/* INFO CARDS */}

      <div className="timetable-info-grid">

        <div className="timetable-info-card">

          <div className="info-icon">
            🎓
          </div>

          <div>
            <strong>
              School starts at 8:25am
            </strong>

            <p>
              Registration begins promptly
              at 8:30am.
            </p>
          </div>

        </div>

        <div className="timetable-info-card">

          <div className="info-icon">
            🎮
          </div>

          <div>
            <strong>
              Games
            </strong>

            <p>
              Tuesday and Thursday
              afternoons during Periods
              4 & 5.
            </p>
          </div>

        </div>

        <div className="timetable-info-card">

          <div className="info-icon">
            ✨
          </div>

          <div>
            <strong>
              Wednesday Enrichment
            </strong>

            <p>
              Enrichment runs on Wednesday
              afternoon until 4:30pm.
            </p>
          </div>

        </div>

      </div>

      {/* MODAL */}

      {showModal && (

        <div
          className="timetable-modal-overlay"
          onMouseDown={(event) => {

            if (
              event.target ===
              event.currentTarget
            ) {
              closeModal();
            }

          }}
        >

          <div className="timetable-modal">

            <div className="timetable-modal-header">

              <div>

                <div className="modal-week">
                  WEEK {week}
                </div>

                <h2>
                  {editingEntry
                    ? "Edit Lesson"
                    : "Add Lesson"}
                </h2>

                <p>
                  {selectedDay} ·{" "}
                  {selectedPeriod}
                </p>

              </div>

              <button
                type="button"
                onClick={
                  closeModal
                }
                disabled={saving}
                className="timetable-modal-close"
              >
                ×
              </button>

            </div>

            <form
              onSubmit={saveLesson}
            >

              <div className="timetable-form-group">

                <label>
                  Day
                </label>

                <select
                  value={
                    selectedDay
                  }
                  onChange={(event) =>
                    setSelectedDay(
                      event.target.value
                    )
                  }
                >
                  {days.map(
                    (day) => (
                      <option
                        key={day}
                        value={day}
                      >
                        {day}
                      </option>
                    )
                  )}
                </select>

              </div>

              <div className="timetable-form-group">

                <label>
                  Period
                </label>

                <select
                  value={
                    selectedPeriod
                  }
                  onChange={(event) =>
                    setSelectedPeriod(
                      event.target.value
                    )
                  }
                >
                  {periods
                    .filter(
                      (period) =>
                        !period.break
                    )
                    .map(
                      (period) => (
                        <option
                          key={
                            period.name
                          }
                          value={
                            period.name
                          }
                        >
                          {period.name}{" "}
                          (
                          {
                            period.time
                          }
                          )
                        </option>
                      )
                    )}
                </select>

              </div>

              <div className="timetable-form-group">

                <label>
                  Subject *
                </label>

                <input
                  type="text"
                  value={subject}
                  onChange={(event) =>
                    setSubject(
                      event.target.value
                    )
                  }
                  placeholder="e.g. Mathematics"
                  required
                  autoFocus
                />

              </div>

              <div className="timetable-form-group">

                <label>
                  Teacher
                </label>

                <input
                  type="text"
                  value={teacher}
                  onChange={(event) =>
                    setTeacher(
                      event.target.value
                    )
                  }
                  placeholder="e.g. Mr Jones"
                />

              </div>

              <div className="timetable-form-group">

                <label>
                  Room
                </label>

                <input
                  type="text"
                  value={room}
                  onChange={(event) =>
                    setRoom(
                      event.target.value
                    )
                  }
                  placeholder="e.g. Room 12"
                />

              </div>

              <div className="timetable-modal-actions">

                {editingEntry && (

                  <button
                    type="button"
                    className="timetable-delete-button"
                    onClick={async () => {

                      setShowModal(false);

                      await deleteLesson(
                        editingEntry
                      );

                      setEditingEntry(
                        null
                      );

                    }}
                    disabled={saving}
                  >
                    🗑 Delete
                  </button>

                )}

                <div className="timetable-modal-actions-right">

                  <button
                    type="button"
                    onClick={
                      closeModal
                    }
                    disabled={
                      saving
                    }
                  >
                    Cancel
                  </button>

                  <button
                    type="submit"
                    className="timetable-save-button"
                    disabled={
                      saving
                    }
                  >
                    {saving
                      ? "Saving..."
                      : editingEntry
                      ? "Save Changes"
                      : "Add Lesson"}
                  </button>

                </div>

              </div>

            </form>

          </div>

        </div>

      )}

    </div>
  );
}

export default Timetable;