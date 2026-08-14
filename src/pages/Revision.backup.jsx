import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";

function Revision({ setPage }) {
  const [subjects, setSubjects] = useState([]);
  const [units, setUnits] = useState([]);
  const [topics, setTopics] = useState([]);
  const [subtopics, setSubtopics] = useState([]);
  const [progress, setProgress] = useState([]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [expandedUnits, setExpandedUnits] = useState({});
  const [expandedTopics, setExpandedTopics] = useState({});

  useEffect(() => {
    loadRevision();
  }, []);

  async function loadRevision() {
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

      // =====================================================
      // LOAD STUDENT SUBJECTS
      // =====================================================

      const {
        data: studentSubjects,
        error: studentSubjectsError,
      } = await supabase
        .from("student_subjects")
        .select(`
          subject_id,
          subjects (
            id,
            name,
            description,
            icon
          )
        `)
        .eq("student_id", user.id);

      if (studentSubjectsError) {
        throw studentSubjectsError;
      }

      const formattedSubjects = (studentSubjects || [])
        .map((item) => item.subjects)
        .filter(Boolean);

      setSubjects(formattedSubjects);

      if (formattedSubjects.length === 0) {
        setUnits([]);
        setTopics([]);
        setSubtopics([]);
        setProgress([]);
        return;
      }

      const subjectIds = formattedSubjects.map(
        (subject) => subject.id
      );

      // =====================================================
      // LOAD UNITS
      // =====================================================

      const {
        data: unitData,
        error: unitError,
      } = await supabase
        .from("subject_units")
        .select(`
          id,
          subject_id,
          name,
          description,
          unit_number,
          level,
          unit_code
        `)
        .in("subject_id", subjectIds)
        .order("subject_id")
        .order("unit_number");

      if (unitError) {
        throw unitError;
      }

      setUnits(unitData || []);

      const unitIds = (unitData || []).map(
        (unit) => unit.id
      );

      if (unitIds.length === 0) {
        setTopics([]);
        setSubtopics([]);
        return;
      }

      // =====================================================
      // LOAD TOPICS
      // =====================================================

      const {
        data: topicData,
        error: topicError,
      } = await supabase
        .from("subject_topics")
        .select(`
          id,
          unit_id,
          name,
          description,
          sort_order
        `)
        .in("unit_id", unitIds)
        .order("sort_order");

      if (topicError) {
        throw topicError;
      }

      setTopics(topicData || []);

      const topicIds = (topicData || []).map(
        (topic) => topic.id
      );

      if (topicIds.length === 0) {
        setSubtopics([]);
        return;
      }

      // =====================================================
      // LOAD SUBTOPICS
      // =====================================================

      const {
        data: subtopicData,
        error: subtopicError,
      } = await supabase
        .from("subject_subtopics")
        .select(`
          id,
          topic_id,
          name,
          description,
          sort_order
        `)
        .in("topic_id", topicIds)
        .order("sort_order");

      if (subtopicError) {
        throw subtopicError;
      }

      setSubtopics(subtopicData || []);

      // =====================================================
      // LOAD STUDENT PROGRESS
      // =====================================================

      const {
        data: progressData,
        error: progressError,
      } = await supabase
        .from("student_topic_progress")
        .select(`
          id,
          subtopic_id,
          status
        `)
        .eq("student_id", user.id);

      if (progressError) {
        throw progressError;
      }

      setProgress(progressData || []);
    } catch (err) {
      console.error(
        "Revision loading error:",
        err
      );

      setError(
        err.message ||
          "Something went wrong while loading your revision."
      );
    } finally {
      setLoading(false);
    }
  }

  // =========================================================
  // TOGGLE UNIT
  // =========================================================

  function toggleUnit(unitId) {
    setExpandedUnits((current) => ({
      ...current,
      [unitId]: !current[unitId],
    }));
  }

  // =========================================================
  // TOGGLE TOPIC
  // =========================================================

  function toggleTopic(topicId) {
    setExpandedTopics((current) => ({
      ...current,
      [topicId]: !current[topicId],
    }));
  }

  // =========================================================
  // GET STATUS
  // =========================================================

  function getStatus(subtopicId) {
    const item = progress.find(
      (entry) =>
        entry.subtopic_id === subtopicId
    );

    return item?.status || "not_started";
  }

  // =========================================================
  // SAVE PROGRESS
  // =========================================================

  async function updateProgress(
    subtopicId,
    status
  ) {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        setPage("login");
        return;
      }

      const existing = progress.find(
        (item) =>
          item.subtopic_id === subtopicId
      );

      if (existing) {
        const {
          data,
          error,
        } = await supabase
          .from("student_topic_progress")
          .update({
            status,
            updated_at: new Date().toISOString(),
          })
          .eq("id", existing.id)
          .select()
          .single();

        if (error) {
          throw error;
        }

        setProgress((current) =>
          current.map((item) =>
            item.id === existing.id
              ? data
              : item
          )
        );
      } else {
        const {
          data,
          error,
        } = await supabase
          .from("student_topic_progress")
          .insert({
            student_id: user.id,
            subtopic_id: subtopicId,
            status,
          })
          .select()
          .single();

        if (error) {
          throw error;
        }

        setProgress((current) => [
          ...current,
          data,
        ]);
      }
    } catch (err) {
      console.error(
        "Could not save progress:",
        err
      );

      setError(
        "Could not save your progress."
      );
    }
  }

  // =========================================================
  // CYCLE STATUS
  // =========================================================

  function cycleStatus(subtopicId) {
    const current =
      getStatus(subtopicId);

    let next;

    if (current === "not_started") {
      next = "in_progress";
    } else if (current === "in_progress") {
      next = "completed";
    } else {
      next = "not_started";
    }

    updateProgress(
      subtopicId,
      next
    );
  }

  // =========================================================
  // SUBJECT PROGRESS
  // =========================================================

  function getSubjectProgress(subjectId) {
    const subjectUnits =
      units.filter(
        (unit) =>
          unit.subject_id === subjectId
      );

    const subjectUnitIds =
      subjectUnits.map(
        (unit) => unit.id
      );

    const subjectTopics =
      topics.filter((topic) =>
        subjectUnitIds.includes(
          topic.unit_id
        )
      );

    const subjectTopicIds =
      subjectTopics.map(
        (topic) => topic.id
      );

    const subjectSubtopics =
      subtopics.filter((subtopic) =>
        subjectTopicIds.includes(
          subtopic.topic_id
        )
      );

    if (
      subjectSubtopics.length === 0
    ) {
      return 0;
    }

    const completed =
      subjectSubtopics.filter(
        (subtopic) =>
          getStatus(
            subtopic.id
          ) === "completed"
      ).length;

    return Math.round(
      (completed /
        subjectSubtopics.length) *
        100
    );
  }

  // =========================================================
  // STATUS DISPLAY
  // =========================================================

  function getStatusIcon(status) {
    if (status === "completed") {
      return "â˜‘ï¸";
    }

    if (status === "in_progress") {
      return "ðŸŸ¡";
    }

    return "â¬œ";
  }

  // =========================================================
  // LOADING
  // =========================================================

  if (loading) {
    return (
      <div className="no-subjects">
        <div className="no-subjects-icon">
          ðŸ“š
        </div>

        <h2>
          Loading your revision hub...
        </h2>

        <p>
          Loading your WJEC
          specifications.
        </p>
      </div>
    );
  }

  // =========================================================
  // ERROR
  // =========================================================

  if (error) {
    return (
      <div className="no-subjects">
        <div className="no-subjects-icon">
          âš ï¸
        </div>

        <h2>
          Something went wrong
        </h2>

        <p>{error}</p>

        <button
          type="button"
          className="primary-card-button"
          onClick={loadRevision}
        >
          Try again
        </button>
      </div>
    );
  }

  // =========================================================
  // NO SUBJECTS
  // =========================================================

  if (subjects.length === 0) {
    return (
      <div className="no-subjects">
        <div className="no-subjects-icon">
          ðŸ“š
        </div>

        <h2>
          No subjects selected
        </h2>

        <p>
          Choose your sixth-form
          subjects to build your
          revision hub.
        </p>

        <button
          type="button"
          className="primary-card-button"
          onClick={() =>
            setPage(
              "subjectSelection"
            )
          }
        >
          Choose Subjects
        </button>
      </div>
    );
  }

  // =========================================================
  // MAIN PAGE
  // =========================================================

  return (
    <div>

      {/* HEADER */}

      <div className="revision-header">

        <div>
          <p className="card-eyebrow">
            YOUR REVISION
          </p>

          <h2>
            Revision Hub ðŸ“š
          </h2>

          <p className="revision-description">
            Your WJEC specifications,
            topics and progress all
            in one place.
          </p>
        </div>

        <button
          type="button"
          className="manage-subjects-button"
          onClick={() =>
            setPage(
              "subjectSelection"
            )
          }
        >
          âš™ï¸ Manage Subjects
        </button>

      </div>


      {/* SUBJECTS */}

      {subjects.map((subject) => {

        const subjectUnits =
          units.filter(
            (unit) =>
              unit.subject_id ===
              subject.id
          );

        const percentage =
          getSubjectProgress(
            subject.id
          );

        return (
          <div
            key={subject.id}
            style={{
              marginBottom:
                "35px",
            }}
          >

            {/* SUBJECT HEADER */}

            <div
              className="revision-section-heading"
            >

              <div>

                <h3>
                  {subject.icon ||
                    "ðŸ“š"}{" "}
                  {subject.name}
                </h3>

                <p>
                  {subject.description ||
                    "WJEC sixth-form subject"}
                </p>

              </div>

              <strong>
                {percentage}% complete
              </strong>

            </div>


            {/* PROGRESS BAR */}

            <div
              style={{
                width: "100%",
                height: "8px",
                background:
                  "#e2e8f0",
                borderRadius:
                  "999px",
                overflow:
                  "hidden",
                marginBottom:
                  "20px",
              }}
            >

              <div
                style={{
                  width:
                    `${percentage}%`,
                  height:
                    "100%",
                  background:
                    "#1e3a8a",
                  borderRadius:
                    "999px",
                  transition:
                    "width 0.3s ease",
                }}
              />

            </div>


            {/* UNITS */}

            {subjectUnits.map(
              (unit) => {

                const isExpanded =
                  !!expandedUnits[
                    unit.id
                  ];

                const unitTopics =
                  topics.filter(
                    (topic) =>
                      topic.unit_id ===
                      unit.id
                  );

                return (
                  <div
                    key={unit.id}
                    style={{
                      marginBottom:
                        "15px",
                    }}
                  >

                    {/* UNIT */}

                    <button
                      type="button"
                      onClick={() =>
                        toggleUnit(
                          unit.id
                        )
                      }
                      style={{
                        width: "100%",
                        border: "none",
                        cursor: "pointer",
                        textAlign: "left",
                        padding:
                          "18px 20px",
                        borderRadius:
                          "14px",
                        background:
                          "#f8fafc",
                        display:
                          "flex",
                        justifyContent:
                          "space-between",
                        alignItems:
                          "center",
                        fontSize:
                          "16px",
                        fontWeight:
                          "700",
                      }}
                    >

                      <span>
                        {isExpanded
                          ? "â–¾"
                          : "â–¸"}{" "}
                        Unit{" "}
                        {unit.unit_number}
                        {" â€” "}
                        {unit.name}
                      </span>

                      <span>
                        {unit.level}
                      </span>

                    </button>


                    {/* TOPICS */}

                    {isExpanded && (
                      <div
                        style={{
                          padding:
                            "10px 0 0 15px",
                        }}
                      >

                        {unitTopics.map(
                          (topic) => {

                            const topicExpanded =
                              !!expandedTopics[
                                topic.id
                              ];

                            const topicSubtopics =
                              subtopics.filter(
                                (
                                  subtopic
                                ) =>
                                  subtopic.topic_id ===
                                  topic.id
                              );

                            const completed =
                              topicSubtopics.filter(
                                (
                                  subtopic
                                ) =>
                                  getStatus(
                                    subtopic.id
                                  ) ===
                                  "completed"
                              ).length;

                            return (
                              <div
                                key={
                                  topic.id
                                }
                                style={{
                                  marginBottom:
                                    "8px",
                                }}
                              >

                                {/* TOPIC */}

                                <button
                                  type="button"
                                  onClick={() =>
                                    toggleTopic(
                                      topic.id
                                    )
                                  }
                                  style={{
                                    width:
                                      "100%",
                                    border:
                                      "1px solid #e2e8f0",
                                    cursor:
                                      "pointer",
                                    textAlign:
                                      "left",
                                    padding:
                                      "14px 16px",
                                    borderRadius:
                                      "10px",
                                    background:
                                      "white",
                                    display:
                                      "flex",
                                    justifyContent:
                                      "space-between",
                                    alignItems:
                                      "center",
                                  }}
                                >

                                  <span>
                                    {topicExpanded
                                      ? "â–¾"
                                      : "â–¸"}{" "}
                                    {topic.name}
                                  </span>

                                  <span
                                    style={{
                                      color:
                                        "#64748b",
                                      fontSize:
                                        "13px",
                                    }}
                                  >
                                    {
                                      completed
                                    }
                                    /
                                    {
                                      topicSubtopics.length
                                    }
                                  </span>

                                </button>


                                {/* SUBTOPICS */}

                                {topicExpanded && (
                                  <div
                                    style={{
                                      padding:
                                        "5px 10px",
                                    }}
                                  >

                                    {topicSubtopics.map(
                                      (
                                        subtopic
                                      ) => {

                                        const status =
                                          getStatus(
                                            subtopic.id
                                          );

                                        return (
                                          <button
                                            key={
                                              subtopic.id
                                            }
                                            type="button"
                                            onClick={() =>
                                              cycleStatus(
                                                subtopic.id
                                              )
                                            }
                                            style={{
                                              width:
                                                "100%",
                                              border:
                                                "none",
                                              borderBottom:
                                                "1px solid #f1f5f9",
                                              background:
                                                "transparent",
                                              cursor:
                                                "pointer",
                                              textAlign:
                                                "left",
                                              padding:
                                                "11px 10px",
                                              display:
                                                "flex",
                                              alignItems:
                                                "center",
                                              gap:
                                                "10px",
                                            }}
                                          >

                                            <span>
                                              {getStatusIcon(
                                                status
                                              )}
                                            </span>

                                            <span
                                              style={{
                                                color:
                                                  status ===
                                                  "completed"
                                                    ? "#16a34a"
                                                    : status ===
                                                      "in_progress"
                                                    ? "#ca8a04"
                                                    : "#334155",
                                                textDecoration:
                                                  status ===
                                                  "completed"
                                                    ? "line-through"
                                                    : "none",
                                              }}
                                            >
                                              {
                                                subtopic.name
                                              }
                                            </span>

                                          </button>
                                        );
                                      }
                                    )}

                                  </div>
                                )}

                              </div>
                            );
                          }
                        )}

                      </div>
                    )}

                  </div>
                );
              }
            )}

          </div>
        );
      })}

    </div>
  );
}

export default Revision;
