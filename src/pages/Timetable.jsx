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

/*
  Day numbers are stored as:
  Monday = 1
  Tuesday = 2
  Wednesday = 3
  Thursday = 4
  Friday = 5

  This matches the Friends timetable viewer.
*/
const dayIndexes = {
  Monday: 1,
  Tuesday: 2,
  Wednesday: 3,
  Thursday: 4,
  Friday: 5,
};

const dayShortNames = {
  Monday: "MON",
  Tuesday: "TUE",
  Wednesday: "WED",
  Thursday: "THU",
  Friday: "FRI",
};

/*
  The school day is split into the individual lesson slots shown
  on the school timetable.

  Breaks and lunch are fixed display rows and are NOT stored in
  Supabase.

  Form and Extra-curricular ARE editable so each student can enter
  their own activity/location.
*/
const periods = [
  {
    name: "Form",
    label: "Form",
    time: "8:30 – 8:45",
    start: "08:30",
    end: "08:45",
  },
  {
    name: "L1",
    label: "L1",
    time: "8:45 – 9:20",
    start: "08:45",
    end: "09:20",
  },
  {
    name: "L2",
    label: "L2",
    time: "9:20 – 9:55",
    start: "09:20",
    end: "09:55",
  },
  {
    name: "Break 1",
    label: "Break",
    time: "9:55 – 10:15",
    start: "09:55",
    end: "10:15",
    break: true,
  },
  {
    name: "L3",
    label: "L3",
    time: "10:15 – 10:50",
    start: "10:15",
    end: "10:50",
  },
  {
    name: "L4",
    label: "L4",
    time: "10:50 – 11:25",
    start: "10:50",
    end: "11:25",
  },
  {
    name: "Break 2",
    label: "Break",
    time: "11:25 – 11:45",
    start: "11:25",
    end: "11:45",
    break: true,
  },
  {
    name: "L5",
    label: "L5",
    time: "11:45 – 12:20",
    start: "11:45",
    end: "12:20",
  },
  {
    name: "L6",
    label: "L6",
    time: "12:20 – 12:55",
    start: "12:20",
    end: "12:55",
  },
  {
    name: "Lunch",
    label: "Lunch",
    time: "12:55 – 13:55",
    start: "12:55",
    end: "13:55",
    break: true,
    lunch: true,
  },
  {
    name: "L7",
    label: "L7",
    time: "13:55 – 14:30",
    start: "13:55",
    end: "14:30",
  },
  {
    name: "L8",
    label: "L8",
    time: "14:30 – 15:05",
    start: "14:30",
    end: "15:05",
  },
  {
    name: "L9",
    label: "L9",
    time: "15:05 – 15:40",
    start: "15:05",
    end: "15:40",
  },
  {
    name: "L10",
    label: "L10",
    time: "15:40 – 16:15",
    start: "15:40",
    end: "16:15",
  },
  {
    name: "Break 3",
    label: "Break",
    time: "16:15 – 16:30",
    start: "16:15",
    end: "16:30",
    break: true,
  },
  {
    name: "Extra-curricular",
    label: "Extra-curricular",
    time: "16:30 – 17:25",
    start: "16:30",
    end: "17:25",
  },
];

const editablePeriods = periods.filter(
  (period) => !period.break
);

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
    useState("L1");

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
        .order("day", {
          ascending: true,
        })
        .order("start_time", {
          ascending: true,
        });

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
      String(time)
        .split(":")
        .slice(0, 2)
        .map(Number);

    return hours * 60 + minutes;
  }

  function isCurrentPeriod(period) {
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
      dayIndexes[day] === currentDay
    );
  }

  function getEntryType(entry) {
    const text =
      String(entry?.subject || "")
        .trim()
        .toLowerCase();

    if (text.includes("game")) {
      return "games";
    }

    if (text.includes("enrichment")) {
      return "enrichment";
    }

    if (
      text.includes("form") ||
      text.includes("tutor") ||
      text.includes("chapel") ||
      text.includes("assembly") ||
      text.includes("pastoral")
    ) {
      return "routine";
    }

    return "";
  }

  function getEntryIcon(entry) {
    const type = getEntryType(entry);

    if (type === "games") {
      return "🏃";
    }

    if (type === "enrichment") {
      return "✨";
    }

    if (type === "routine") {
      return "🎓";
    }

    if (
      String(entry?.period_name || "") ===
      "Extra-curricular"
    ) {
      return "🌟";
    }

    return "";
  }

  function getDefaultSubject(periodName) {
    if (periodName === "Form") {
      return "Form";
    }

    if (
      periodName ===
      "Extra-curricular"
    ) {
      return "";
    }

    return "";
  }

  function openAddModal(
    day,
    periodName
  ) {
    setEditingEntry(null);
    setSelectedDay(day);
    setSelectedPeriod(periodName);
    setSubject(
      getDefaultSubject(periodName)
    );
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

  function quickFill(value) {
    setSubject(value);
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
          "Please enter a subject or activity."
        );
      }

      const period = periods.find(
        (item) =>
          item.name === selectedPeriod
      );

      if (!period || period.break) {
        throw new Error(
          "Please choose an editable timetable slot."
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

      /*
        Only one saved entry is allowed in each
        Week + Day + Slot for the current user.

        If a duplicate already exists, give a useful message
        rather than creating overlapping lessons.
      */
      const existingEntry = entries.find(
        (entry) =>
          Number(entry.day) === dayIndex &&
          entry.period_name ===
            selectedPeriod &&
          entry.id !== editingEntry?.id
      );

      if (existingEntry) {
        throw new Error(
          `${selectedDay} ${selectedPeriod} already has an entry. Click that slot to edit it.`
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
        "Could not save timetable entry:",
        err
      );

      setError(
        err?.message ||
          "Could not save the timetable entry."
      );
    } finally {
      setSaving(false);
    }
  }

  async function deleteLesson(entry) {
    const confirmed =
      window.confirm(
        `Delete "${entry.subject}" from your timetable?`
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
        "Could not delete timetable entry:",
        err
      );

      setError(
        err?.message ||
          "Could not delete the timetable entry."
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
            Add your own lessons, Games,
            Enrichment, Form and after-school
            activities. Your accepted friends
            can see the timetable you build.
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
            Build your own timetable
          </strong>

          <p>
            Click any empty white slot to add
            what you have there. Breaks and
            lunch are already fixed for you.
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
              ? "entry"
              : "entries"}
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
                  {period.label ||
                    period.name}
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

                const special =
                  entry
                    ? getEntryType(entry)
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

                    {/* BREAK / LUNCH */}

                    {period.break ? (

                      <div className="break-content">

                        <span className="break-icon">
                          {period.lunch
                            ? "🍴"
                            : "☕"}
                        </span>

                        <span>
                          {period.label ||
                            period.name}
                        </span>

                      </div>

                    ) : entry ? (

                      /* SAVED ENTRY */

                      <div className="lesson-content">

                        <div className="lesson-subject">
                          {getEntryIcon(entry) && (
                            <span>
                              {getEntryIcon(entry)}{" "}
                            </span>
                          )}

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

                    ) : (

                      /* EMPTY EDITABLE SLOT */

                      <div className="empty-slot">

                        <span className="empty-plus">
                          +
                        </span>

                        <span>
                          {period.name ===
                          "Form"
                            ? "Add form"
                            : period.name ===
                              "Extra-curricular"
                            ? "Add activity"
                            : "Add lesson"}
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
          Lesson / activity
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
          Form / school routine
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
              Form
            </strong>

            <p>
              Add your own Form entry from
              8:30–8:45 for each day.
            </p>
          </div>

        </div>

        <div className="timetable-info-card">

          <div className="info-icon">
            🏃
          </div>

          <div>
            <strong>
              Games & Enrichment
            </strong>

            <p>
              Add these yourself in whichever
              lesson slots they actually appear
              on your timetable.
            </p>
          </div>

        </div>

        <div className="timetable-info-card">

          <div className="info-icon">
            🌟
          </div>

          <div>
            <strong>
              After school
            </strong>

            <p>
              There is a fixed 16:15–16:30
              break, then you can add your own
              16:30–17:25 activity.
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
                    ? "Edit Timetable Entry"
                    : "Add Timetable Entry"}
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
                  Slot
                </label>

                <select
                  value={
                    selectedPeriod
                  }
                  onChange={(event) => {
                    const nextPeriod =
                      event.target.value;

                    setSelectedPeriod(
                      nextPeriod
                    );

                    if (
                      !subject.trim()
                    ) {
                      setSubject(
                        getDefaultSubject(
                          nextPeriod
                        )
                      );
                    }
                  }}
                >
                  {editablePeriods.map(
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

              {/* QUICK OPTIONS */}

              <div className="timetable-form-group">

                <label>
                  Quick options
                </label>

                <div
                  style={{
                    display: "flex",
                    flexWrap: "wrap",
                    gap: "8px",
                  }}
                >
                  {[
                    "Games",
                    "Enrichment",
                    "Form",
                    "Supervised Study",
                    "Free Period",
                  ].map((value) => (
                    <button
                      key={value}
                      type="button"
                      onClick={() =>
                        quickFill(value)
                      }
                      style={{
                        padding:
                          "8px 10px",
                        borderRadius:
                          "999px",
                        border:
                          "1px solid #dbe3ef",
                        background:
                          "white",
                        cursor:
                          "pointer",
                      }}
                    >
                      {value}
                    </button>
                  ))}
                </div>

              </div>

              <div className="timetable-form-group">

                <label>
                  Subject / Activity *
                </label>

                <input
                  type="text"
                  value={subject}
                  onChange={(event) =>
                    setSubject(
                      event.target.value
                    )
                  }
                  placeholder="e.g. History, Games, Enrichment, Choir"
                  required
                  autoFocus
                />

              </div>

              <div className="timetable-form-group">

                <label>
                  Teacher / Staff
                </label>

                <input
                  type="text"
                  value={teacher}
                  onChange={(event) =>
                    setTeacher(
                      event.target.value
                    )
                  }
                  placeholder="e.g. SC History or Mr Jones"
                />

              </div>

              <div className="timetable-form-group">

                <label>
                  Room / Location
                </label>

                <input
                  type="text"
                  value={room}
                  onChange={(event) =>
                    setRoom(
                      event.target.value
                    )
                  }
                  placeholder="e.g. C120, Sports Centre, Sixth Form Cafe"
                />

              </div>

              <div
                style={{
                  padding:
                    "12px 14px",
                  borderRadius:
                    "12px",
                  background:
                    "#f8fafc",
                  marginBottom:
                    "18px",
                  fontSize:
                    "14px",
                }}
              >
                <strong>
                  Time:
                </strong>{" "}
                {
                  periods.find(
                    (period) =>
                      period.name ===
                      selectedPeriod
                  )?.time
                }
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
                      : "Add Entry"}
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