import { useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabase";
import AssignmentWorkspace from "./AssignmentWorkspace";
import AssignmentManager from "./AssignmentManager";
import AssignmentMarkingWorkspace from "./AssignmentMarkingWorkspace";

function Assignments({ setPage }) {
  /* =========================================================
     MAIN STATE
     ========================================================= */

  const [user, setUser] = useState(null);

  const [activeTab, setActiveTab] =
    useState("assigned");

  const [
    receivedAssignments,
    setReceivedAssignments,
  ] = useState([]);

  const [
    createdAssignments,
    setCreatedAssignments,
  ] = useState([]);

  const [friends, setFriends] =
    useState([]);

  const [loading, setLoading] =
    useState(true);

  const [message, setMessage] =
    useState("");

  /* =========================================================
     WORKSPACE
     ========================================================= */

  const [
    openAssignmentRecipientId,
    setOpenAssignmentRecipientId,
  ] = useState(null);

  const [
    managedAssignmentId,
    setManagedAssignmentId,
  ] = useState(null);

  const [
    markingAssignmentRecipientId,
    setMarkingAssignmentRecipientId,
  ] = useState(null);

  /* =========================================================
     CREATE ASSIGNMENT MODAL
     ========================================================= */

  const [showCreate, setShowCreate] =
    useState(false);

  const [creating, setCreating] =
    useState(false);

  const [title, setTitle] =
    useState("");

  const [
    instructions,
    setInstructions,
  ] = useState("");

  const [paperFile, setPaperFile] =
    useState(null);

  const [
    selectedFriends,
    setSelectedFriends,
  ] = useState([]);

  const [
    useDeadline,
    setUseDeadline,
  ] = useState(false);

  const [deadline, setDeadline] =
    useState("");

  const [useTimer, setUseTimer] =
    useState(false);

  const [
    durationMinutes,
    setDurationMinutes,
  ] = useState("");

  /* =========================================================
     INITIAL LOAD
     ========================================================= */

  useEffect(() => {
    loadPage();
  }, []);

  async function loadPage() {
    try {
      setLoading(true);
      setMessage("");

      const {
        data: { user: currentUser },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError) {
        throw userError;
      }

      if (!currentUser) {
        throw new Error(
          "You must be logged in."
        );
      }

      setUser(currentUser);

      await Promise.all([
        loadAssignments(
          currentUser.id
        ),

        loadFriends(
          currentUser.id
        ),
      ]);
    } catch (error) {
      console.error(
        "Could not load assignments:",
        error
      );

      setMessage(
        error?.message ||
          "Could not load assignments."
      );
    } finally {
      setLoading(false);
    }
  }

  /* =========================================================
     LOAD ASSIGNMENTS
     ========================================================= */

  async function loadAssignments(
    userId
  ) {
    /* -------------------------------------------------------
       ASSIGNMENTS RECEIVED
       ------------------------------------------------------- */

    const {
      data: receivedData,
      error: receivedError,
    } = await supabase
      .from(
        "assignment_recipients"
      )
      .select(`
        id,
        assignment_id,
        recipient_id,
        status,
        assigned_at,
        started_at,
        expires_at,
        submitted_at,
        submission_reason,
        returned_at,
        assignments (
          id,
          creator_id,
          title,
          instructions,
          file_path,
          file_name,
          file_type,
          duration_minutes,
          due_at,
          created_at
        )
      `)
      .eq(
        "recipient_id",
        userId
      )
      .order(
        "assigned_at",
        {
          ascending: false,
        }
      );

    if (receivedError) {
      throw receivedError;
    }

    setReceivedAssignments(
      receivedData || []
    );

    /* -------------------------------------------------------
       ASSIGNMENTS CREATED
       ------------------------------------------------------- */

    const {
      data: createdData,
      error: createdError,
    } = await supabase
      .from("assignments")
      .select(`
        id,
        creator_id,
        title,
        instructions,
        file_path,
        file_name,
        file_type,
        duration_minutes,
        due_at,
        created_at,
        assignment_recipients (
          id,
          recipient_id,
          status,
          assigned_at,
          started_at,
          expires_at,
          submitted_at,
          submission_reason,
          returned_at
        )
      `)
      .eq(
        "creator_id",
        userId
      )
      .order(
        "created_at",
        {
          ascending: false,
        }
      );

    if (createdError) {
      throw createdError;
    }

    setCreatedAssignments(
      createdData || []
    );
  }

  /* =========================================================
     LOAD FRIENDS
     ========================================================= */

  async function loadFriends(
    userId
  ) {
    const {
      data: relationships,
      error: relationshipError,
    } = await supabase
      .from("friend_requests")
      .select(
        "id, sender_id, receiver_id, status"
      )
      .eq(
        "status",
        "accepted"
      )
      .or(
        `sender_id.eq.${userId},receiver_id.eq.${userId}`
      );

    if (relationshipError) {
      throw relationshipError;
    }

    const friendIds = [
      ...new Set(
        (relationships || [])
          .map(
            (relationship) =>
              relationship.sender_id ===
              userId
                ? relationship.receiver_id
                : relationship.sender_id
          )
          .filter(Boolean)
      ),
    ];

    if (
      friendIds.length === 0
    ) {
      setFriends([]);
      return;
    }

    const {
      data: profiles,
      error: profileError,
    } = await supabase
      .from("profiles")
      .select(
        "id, full_name, school_email, year_group"
      )
      .in(
        "id",
        friendIds
      )
      .order(
        "full_name",
        {
          ascending: true,
        }
      );

    if (profileError) {
      throw profileError;
    }

    setFriends(
      profiles || []
    );
  }

  /* =========================================================
     COUNTERS
     ========================================================= */

  const counts = useMemo(() => {
    const result = {
      todo: 0,
      inProgress: 0,
      submitted: 0,
      returned: 0,
    };

    receivedAssignments.forEach(
      (item) => {
        if (
          item.status === "assigned"
        ) {
          result.todo += 1;
        }

        if (
          item.status ===
          "in_progress"
        ) {
          result.inProgress += 1;
        }

        if (
          item.status ===
          "submitted"
        ) {
          result.submitted += 1;
        }

        if (
          item.status ===
          "returned"
        ) {
          result.returned += 1;
        }
      }
    );

    return result;
  }, [receivedAssignments]);

  /* =========================================================
     FORMAT DATE
     ========================================================= */

  function formatDate(date) {
    if (!date) {
      return "No deadline";
    }

    return new Date(
      date
    ).toLocaleString(
      "en-GB",
      {
        day: "numeric",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      }
    );
  }

  /* =========================================================
     STATUS
     ========================================================= */

  function statusLabel(status) {
    const labels = {
      assigned: "📌 To do",

      in_progress:
        "⏱️ In progress",

      submitted:
        "📤 Submitted",

      returned:
        "✅ Returned",
    };

    return (
      labels[status] ||
      status
    );
  }

  /* =========================================================
     FRIEND SELECTION
     ========================================================= */

  function toggleFriend(friendId) {
    setSelectedFriends(
      (current) => {
        if (
          current.includes(
            friendId
          )
        ) {
          return current.filter(
            (id) =>
              id !== friendId
          );
        }

        return [
          ...current,
          friendId,
        ];
      }
    );
  }

  function selectAllFriends() {
    if (
      selectedFriends.length ===
      friends.length
    ) {
      setSelectedFriends([]);
      return;
    }

    setSelectedFriends(
      friends.map(
        (friend) =>
          friend.id
      )
    );
  }

  /* =========================================================
     RESET CREATE FORM
     ========================================================= */

  function resetCreateForm() {
    setTitle("");

    setInstructions("");

    setPaperFile(null);

    setSelectedFriends([]);

    setUseDeadline(false);

    setDeadline("");

    setUseTimer(false);

    setDurationMinutes("");
  }

  /* =========================================================
     FILE
     ========================================================= */

  function handleFileChange(
    event
  ) {
    const file =
      event.target.files?.[0];

    if (!file) {
      setPaperFile(null);
      return;
    }

    if (
      file.type !==
      "application/pdf"
    ) {
      setMessage(
        "Please choose a PDF file."
      );

      event.target.value = "";

      return;
    }

    if (
      file.size >
      50 * 1024 * 1024
    ) {
      setMessage(
        "The PDF must be smaller than 50 MB."
      );

      event.target.value = "";

      return;
    }

    setMessage("");

    setPaperFile(file);
  }

  /* =========================================================
     CREATE ASSIGNMENT
     ========================================================= */

  async function createAssignment(
    event
  ) {
    event.preventDefault();

    if (!user?.id) {
      return;
    }

    /* -------------------------------------------------------
       VALIDATION
       ------------------------------------------------------- */

    if (!title.trim()) {
      setMessage(
        "Please enter an assignment title."
      );

      return;
    }

    if (!paperFile) {
      setMessage(
        "Please upload the exam PDF."
      );

      return;
    }

    if (
      selectedFriends.length === 0
    ) {
      setMessage(
        "Please choose at least one recipient."
      );

      return;
    }

    let duration = null;

    if (useTimer) {
      duration =
        Number(
          durationMinutes
        );

      if (
        !Number.isInteger(
          duration
        ) ||
        duration <= 0
      ) {
        setMessage(
          "Please enter a valid timer in minutes."
        );

        return;
      }
    }

    let dueAt = null;

    if (useDeadline) {
      if (!deadline) {
        setMessage(
          "Please choose a deadline."
        );

        return;
      }

      const parsed =
        new Date(deadline);

      if (
        Number.isNaN(
          parsed.getTime()
        ) ||
        parsed.getTime() <=
          Date.now()
      ) {
        setMessage(
          "The deadline must be a future date and time."
        );

        return;
      }

      dueAt =
        parsed.toISOString();
    }

    /* -------------------------------------------------------
       CREATE
       ------------------------------------------------------- */

    let assignmentId = null;

    let uploadedPath = null;

    try {
      setCreating(true);

      setMessage(
        "Creating assignment..."
      );

      const {
        data: assignment,
        error:
          assignmentError,
      } = await supabase
        .from("assignments")
        .insert({
          creator_id:
            user.id,

          title:
            title.trim(),

          instructions:
            instructions.trim() ||
            null,

          duration_minutes:
            duration,

          due_at:
            dueAt,

          file_name:
            paperFile.name,

          file_type:
            paperFile.type,
        })
        .select()
        .single();

      if (assignmentError) {
        throw assignmentError;
      }

      assignmentId =
        assignment.id;

      /* -----------------------------------------------------
         UPLOAD PDF
         ----------------------------------------------------- */

      uploadedPath =
        `${user.id}/${assignmentId}/paper.pdf`;

      setMessage(
        "Uploading exam PDF..."
      );

      const {
        error: uploadError,
      } = await supabase.storage
        .from("assignments")
        .upload(
          uploadedPath,
          paperFile,
          {
            cacheControl:
              "3600",

            upsert: false,

            contentType:
              "application/pdf",
          }
        );

      if (uploadError) {
        throw uploadError;
      }

      /* -----------------------------------------------------
         SAVE FILE PATH
         ----------------------------------------------------- */

      const {
        error: pathError,
      } = await supabase
        .from("assignments")
        .update({
          file_path:
            uploadedPath,
        })
        .eq(
          "id",
          assignmentId
        );

      if (pathError) {
        throw pathError;
      }

      /* -----------------------------------------------------
         SEND TO RECIPIENTS
         ----------------------------------------------------- */

      setMessage(
        "Sending assignment..."
      );

      const {
        error: sendError,
      } = await supabase.rpc(
        "send_assignment",
        {
          p_assignment_id:
            assignmentId,

          p_recipient_ids:
            selectedFriends,
        }
      );

      if (sendError) {
        throw sendError;
      }

      /* -----------------------------------------------------
         FINISHED
         ----------------------------------------------------- */

      resetCreateForm();

      setShowCreate(false);

      setActiveTab("created");

      await loadAssignments(
        user.id
      );

      setMessage(
        "Assignment created and sent successfully! 🎉"
      );
    } catch (error) {
      console.error(
        "Could not create assignment:",
        error
      );

      /*
       * If something failed halfway
       * through, clean up the partial
       * assignment.
       */

      if (uploadedPath) {
        try {
          await supabase.storage
            .from(
              "assignments"
            )
            .remove([
              uploadedPath,
            ]);
        } catch (
          cleanupError
        ) {
          console.error(
            cleanupError
          );
        }
      }

      if (assignmentId) {
        try {
          await supabase
            .from(
              "assignments"
            )
            .delete()
            .eq(
              "id",
              assignmentId
            );
        } catch (
          cleanupError
        ) {
          console.error(
            cleanupError
          );
        }
      }

      setMessage(
        error?.message ||
          "Could not create the assignment."
      );
    } finally {
      setCreating(false);
    }
  }

  /* =========================================================
     OPEN ASSIGNMENT
     ========================================================= */

  function openAssignment(
    assignmentRecipientId
  ) {
    setMessage("");

    setOpenAssignmentRecipientId(
      assignmentRecipientId
    );
  }

  /* =========================================================
     CLOSE WORKSPACE
     ========================================================= */

  async function closeWorkspace() {
    setOpenAssignmentRecipientId(
      null
    );

    if (!user?.id) {
      return;
    }

    try {
      await loadAssignments(
        user.id
      );
    } catch (error) {
      console.error(
        "Could not refresh assignments:",
        error
      );
    }
  }

  /* =========================================================
     CREATOR MANAGEMENT / MARKING
     ========================================================= */

  function openManager(assignmentId) {
    setMessage("");
    setMarkingAssignmentRecipientId(null);
    setManagedAssignmentId(assignmentId);
  }

  async function closeManager() {
    setManagedAssignmentId(null);
    setMarkingAssignmentRecipientId(null);

    if (!user?.id) return;

    try {
      await loadAssignments(user.id);
    } catch (error) {
      console.error("Could not refresh assignments:", error);
    }
  }

  function openMarkingWorkspace(assignmentRecipientId) {
    setMessage("");
    setMarkingAssignmentRecipientId(assignmentRecipientId);
  }

  function closeMarkingWorkspace() {
    setMarkingAssignmentRecipientId(null);
  }

  if (markingAssignmentRecipientId) {
    return (
      <AssignmentMarkingWorkspace
        assignmentRecipientId={markingAssignmentRecipientId}
        onBack={closeMarkingWorkspace}
      />
    );
  }

  if (managedAssignmentId) {
    return (
      <AssignmentManager
        assignmentId={managedAssignmentId}
        onBack={closeManager}
        onMarkPaper={openMarkingWorkspace}
      />
    );
  }

  /* =========================================================
     SHOW ASSIGNMENT WORKSPACE
     ========================================================= */

  if (
    openAssignmentRecipientId
  ) {
    return (
      <AssignmentWorkspace
        assignmentRecipientId={
          openAssignmentRecipientId
        }
        onBack={
          closeWorkspace
        }
      />
    );
  }

  /* =========================================================
     LOADING
     ========================================================= */

  if (loading) {
    return (
      <div
        style={{
          padding: "30px",
          textAlign: "center",
        }}
      >
        <div
          style={{
            fontSize: "35px",
          }}
        >
          📝
        </div>

        <h3>
          Loading assignments...
        </h3>
      </div>
    );
  }

  /* =========================================================
     MAIN PAGE
     ========================================================= */

  return (
    <div
      style={{
        paddingBottom: "40px",
      }}
    >
      {/* =====================================================
          HERO
          ===================================================== */}

      <section style={hero}>
        <div>
          <div style={eyebrow}>
            ASSIGNMENT CENTRE
          </div>

          <h2
            style={{
              margin: 0,
              fontSize: "28px",
            }}
          >
            Assignments 📚
          </h2>

          <p
            style={{
              margin:
                "8px 0 0",
              opacity: 0.9,
            }}
          >
            Complete work sent
            to you or create
            private assignments
            for friends.
          </p>
        </div>

        <button
          type="button"
          onClick={() => {
            setMessage("");

            setShowCreate(
              true
            );
          }}
          style={heroButton}
        >
          ＋ Create Assignment
        </button>
      </section>

      {/* =====================================================
          MESSAGE
          ===================================================== */}

      {message && (
        <div style={messageBox}>
          {message}
        </div>
      )}

      {/* =====================================================
          STATS
          ===================================================== */}

      <div style={statsGrid}>
        <StatCard
          icon="📌"
          label="To Do"
          number={counts.todo}
        />

        <StatCard
          icon="⏱️"
          label="In Progress"
          number={
            counts.inProgress
          }
        />

        <StatCard
          icon="📤"
          label="Submitted"
          number={
            counts.submitted
          }
        />

        <StatCard
          icon="✅"
          label="Returned"
          number={
            counts.returned
          }
        />
      </div>

      {/* =====================================================
          TABS
          ===================================================== */}

      <div style={tabs}>
        <TabButton
          active={
            activeTab ===
            "assigned"
          }
          onClick={() =>
            setActiveTab(
              "assigned"
            )
          }
        >
          📥 Assigned to Me
        </TabButton>

        <TabButton
          active={
            activeTab ===
            "created"
          }
          onClick={() =>
            setActiveTab(
              "created"
            )
          }
        >
          📝 Created by Me
        </TabButton>
      </div>

      {/* =====================================================
          ASSIGNED TO ME
          ===================================================== */}

      {activeTab ===
        "assigned" && (
        <>
          {receivedAssignments.length ===
          0 ? (
            <EmptyState
              icon="📭"
              title="No assignments yet"
              text="Assignments sent to you will appear here."
            />
          ) : (
            <div
              style={{
                display: "grid",
                gap: "14px",
              }}
            >
              {receivedAssignments.map(
                (item) => {
                  const assignment =
                    item.assignments;

                  return (
                    <div
                      key={
                        item.id
                      }
                      style={card}
                    >
                      <div
                        style={
                          cardRow
                        }
                      >
                        <div
                          style={{
                            flex: 1,
                          }}
                        >
                          <div
                            style={
                              statusText
                            }
                          >
                            {statusLabel(
                              item.status
                            )}
                          </div>

                          <h3
                            style={{
                              margin:
                                "0 0 7px",
                            }}
                          >
                            {assignment?.title ||
                              "Assignment"}
                          </h3>

                          {assignment?.instructions && (
                            <p
                              style={
                                description
                              }
                            >
                              {
                                assignment.instructions
                              }
                            </p>
                          )}

                          <div
                            style={
                              metaRow
                            }
                          >
                            <span>
                              📅{" "}
                              {formatDate(
                                assignment?.due_at
                              )}
                            </span>

                            {assignment?.duration_minutes && (
                              <span>
                                ⏱️{" "}
                                {
                                  assignment.duration_minutes
                                }{" "}
                                minutes
                              </span>
                            )}

                            {assignment?.file_name && (
                              <span>
                                📄{" "}
                                {
                                  assignment.file_name
                                }
                              </span>
                            )}
                          </div>

                          {item.status ===
                            "in_progress" &&
                            item.expires_at && (
                              <div
                                style={
                                  progressWarning
                                }
                              >
                                ⏱️ Your
                                timer has
                                already
                                started.
                                Opening the
                                assignment
                                will
                                continue
                                your
                                existing
                                attempt.
                              </div>
                            )}

                          {item.status ===
                            "submitted" && (
                            <div
                              style={
                                submittedNotice
                              }
                            >
                              📤 Handed
                              in{" "}
                              {item.submitted_at
                                ? formatDate(
                                    item.submitted_at
                                  )
                                : ""}
                            </div>
                          )}
                        </div>

                        <button
                          type="button"
                          onClick={() =>
                            openAssignment(
                              item.id
                            )
                          }
                          style={
                            primaryButton
                          }
                        >
                          {item.status ===
                          "returned"
                            ? "View Result"
                            : item.status ===
                                "submitted"
                              ? "View Submission"
                              : item.status ===
                                  "in_progress"
                                ? "Continue →"
                                : "Open →"}
                        </button>
                      </div>
                    </div>
                  );
                }
              )}
            </div>
          )}
        </>
      )}

      {/* =====================================================
          CREATED BY ME
          ===================================================== */}

      {activeTab ===
        "created" && (
        <>
          {createdAssignments.length ===
          0 ? (
            <EmptyState
              icon="📝"
              title="You haven't created an assignment yet"
              text="Create an assignment, upload an exam and send it privately."
            />
          ) : (
            <div
              style={{
                display: "grid",
                gap: "14px",
              }}
            >
              {createdAssignments.map(
                (assignment) => {
                  const recipients =
                    assignment.assignment_recipients ||
                    [];

                  const submitted =
                    recipients.filter(
                      (
                        recipient
                      ) =>
                        recipient.status ===
                          "submitted" ||
                        recipient.status ===
                          "returned"
                    ).length;

                  const inProgress =
                    recipients.filter(
                      (
                        recipient
                      ) =>
                        recipient.status ===
                        "in_progress"
                    ).length;

                  return (
                    <div
                      key={
                        assignment.id
                      }
                      style={card}
                    >
                      <div
                        style={
                          cardRow
                        }
                      >
                        <div
                          style={{
                            flex: 1,
                          }}
                        >
                          <div
                            style={
                              statusText
                            }
                          >
                            📝 CREATED
                          </div>

                          <h3
                            style={{
                              margin:
                                "0 0 7px",
                            }}
                          >
                            {
                              assignment.title
                            }
                          </h3>

                          {assignment.instructions && (
                            <p
                              style={
                                description
                              }
                            >
                              {
                                assignment.instructions
                              }
                            </p>
                          )}

                          <div
                            style={
                              metaRow
                            }
                          >
                            <span>
                              👥{" "}
                              {
                                recipients.length
                              }{" "}
                              assigned
                            </span>

                            <span>
                              ⏱️{" "}
                              {
                                inProgress
                              }{" "}
                              working
                            </span>

                            <span>
                              📤{" "}
                              {
                                submitted
                              }{" "}
                              handed in
                            </span>

                            <span>
                              📅{" "}
                              {formatDate(
                                assignment.due_at
                              )}
                            </span>

                            {assignment.duration_minutes && (
                              <span>
                                ⏱️{" "}
                                {
                                  assignment.duration_minutes
                                }{" "}
                                minutes
                              </span>
                            )}
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={() =>
                            openManager(
                              assignment.id
                            )
                          }
                          style={
                            secondaryButton
                          }
                        >
                          Manage
                        </button>
                      </div>
                    </div>
                  );
                }
              )}
            </div>
          )}
        </>
      )}

      {/* =====================================================
          CREATE MODAL
          ===================================================== */}

      {showCreate && (
        <div
          style={
            modalBackdrop
          }
          onMouseDown={(
            event
          ) => {
            if (
              event.target ===
                event.currentTarget &&
              !creating
            ) {
              setShowCreate(
                false
              );
            }
          }}
        >
          <div style={modal}>
            {/* =================================================
                MODAL HEADER
                ================================================= */}

            <div
              style={
                modalHeader
              }
            >
              <div>
                <h2
                  style={{
                    margin: 0,
                  }}
                >
                  Create Assignment
                  📝
                </h2>

                <p
                  style={{
                    margin:
                      "5px 0 0",

                    color:
                      "#64748b",

                    fontSize:
                      "14px",
                  }}
                >
                  Upload a PDF
                  and send
                  independent,
                  private
                  attempts.
                </p>
              </div>

              <button
                type="button"
                disabled={
                  creating
                }
                onClick={() =>
                  setShowCreate(
                    false
                  )
                }
                style={
                  closeButton
                }
              >
                ✕
              </button>
            </div>

            {/* =================================================
                FORM
                ================================================= */}

            <form
              onSubmit={
                createAssignment
              }
              style={{
                padding:
                  "24px",
              }}
            >
              {/* ===============================================
                  DETAILS
                  =============================================== */}

              <Section title="Assignment details">
                <label
                  style={
                    labelStyle
                  }
                >
                  Title *
                </label>

                <input
                  value={title}
                  onChange={(
                    event
                  ) =>
                    setTitle(
                      event
                        .target
                        .value
                    )
                  }
                  disabled={
                    creating
                  }
                  placeholder="e.g. AS Maths Practice Paper"
                  style={
                    inputStyle
                  }
                />

                <label
                  style={{
                    ...labelStyle,
                    marginTop:
                      "15px",
                  }}
                >
                  Instructions
                </label>

                <textarea
                  value={
                    instructions
                  }
                  onChange={(
                    event
                  ) =>
                    setInstructions(
                      event
                        .target
                        .value
                    )
                  }
                  disabled={
                    creating
                  }
                  rows={4}
                  placeholder="e.g. Complete every question and show all working."
                  style={{
                    ...inputStyle,

                    resize:
                      "vertical",

                    fontFamily:
                      "inherit",
                  }}
                />
              </Section>

              {/* ===============================================
                  PDF
                  =============================================== */}

              <Section title="Exam PDF">
                <label
                  style={
                    uploadBox
                  }
                >
                  <div
                    style={{
                      fontSize:
                        "30px",
                    }}
                  >
                    📄
                  </div>

                  <strong>
                    {paperFile
                      ? paperFile.name
                      : "Choose PDF"}
                  </strong>

                  <div
                    style={{
                      color:
                        "#64748b",

                      fontSize:
                        "12px",

                      marginTop:
                        "4px",
                    }}
                  >
                    PDF only •
                    maximum 50 MB
                  </div>

                  <input
                    type="file"
                    accept="application/pdf,.pdf"
                    onChange={
                      handleFileChange
                    }
                    disabled={
                      creating
                    }
                    style={{
                      display:
                        "none",
                    }}
                  />
                </label>
              </Section>

              {/* ===============================================
                  RECIPIENTS
                  =============================================== */}

              <Section title="Assign to">
                {friends.length ===
                0 ? (
                  <div
                    style={
                      emptyMini
                    }
                  >
                    You don't
                    currently
                    have any
                    accepted
                    friends to
                    assign this
                    to.
                  </div>
                ) : (
                  <>
                    <div
                      style={
                        selectHeader
                      }
                    >
                      <strong>
                        {
                          selectedFriends.length
                        }{" "}
                        selected
                      </strong>

                      <button
                        type="button"
                        onClick={
                          selectAllFriends
                        }
                        disabled={
                          creating
                        }
                        style={
                          linkButton
                        }
                      >
                        {selectedFriends.length ===
                        friends.length
                          ? "Clear all"
                          : "Select all"}
                      </button>
                    </div>

                    <div
                      style={{
                        display:
                          "grid",

                        gap:
                          "8px",
                      }}
                    >
                      {friends.map(
                        (
                          friend
                        ) => {
                          const selected =
                            selectedFriends.includes(
                              friend.id
                            );

                          return (
                            <button
                              key={
                                friend.id
                              }
                              type="button"
                              disabled={
                                creating
                              }
                              onClick={() =>
                                toggleFriend(
                                  friend.id
                                )
                              }
                              style={friendButton(
                                selected
                              )}
                            >
                              <div
                                style={
                                  avatar
                                }
                              >
                                {(
                                  friend.full_name ||
                                  "?"
                                )
                                  .charAt(
                                    0
                                  )
                                  .toUpperCase()}
                              </div>

                              <div
                                style={{
                                  flex: 1,
                                }}
                              >
                                <strong>
                                  {friend.full_name ||
                                    "Student"}
                                </strong>

                                <div
                                  style={{
                                    fontSize:
                                      "12px",

                                    color:
                                      "#64748b",
                                  }}
                                >
                                  {friend.year_group ||
                                    "Sixth Form"}
                                </div>
                              </div>

                              <div
                                style={checkBox(
                                  selected
                                )}
                              >
                                {selected
                                  ? "✓"
                                  : ""}
                              </div>
                            </button>
                          );
                        }
                      )}
                    </div>
                  </>
                )}
              </Section>

              {/* ===============================================
                  DEADLINE
                  =============================================== */}

              <Section title="Deadline">
                <Toggle
                  checked={
                    useDeadline
                  }
                  onChange={
                    setUseDeadline
                  }
                  title="Set a deadline"
                  disabled={
                    creating
                  }
                />

                {useDeadline && (
                  <input
                    type="datetime-local"
                    value={
                      deadline
                    }
                    onChange={(
                      event
                    ) =>
                      setDeadline(
                        event
                          .target
                          .value
                      )
                    }
                    disabled={
                      creating
                    }
                    style={{
                      ...inputStyle,

                      marginTop:
                        "12px",
                    }}
                  />
                )}
              </Section>

              {/* ===============================================
                  TIMER
                  =============================================== */}

              <Section title="Timed assignment">
                <Toggle
                  checked={
                    useTimer
                  }
                  onChange={
                    setUseTimer
                  }
                  title="Use a timer"
                  disabled={
                    creating
                  }
                />

                {useTimer && (
                  <div
                    style={{
                      marginTop:
                        "12px",
                    }}
                  >
                    <label
                      style={
                        labelStyle
                      }
                    >
                      Time allowed
                      (minutes)
                    </label>

                    <input
                      type="number"
                      min="1"
                      step="1"
                      value={
                        durationMinutes
                      }
                      onChange={(
                        event
                      ) =>
                        setDurationMinutes(
                          event
                            .target
                            .value
                        )
                      }
                      disabled={
                        creating
                      }
                      placeholder="e.g. 90"
                      style={
                        inputStyle
                      }
                    />

                    <div
                      style={{
                        display:
                          "flex",

                        gap:
                          "7px",

                        flexWrap:
                          "wrap",

                        marginTop:
                          "8px",
                      }}
                    >
                      {[
                        30,
                        45,
                        60,
                        90,
                        120,
                      ].map(
                        (
                          minutes
                        ) => (
                          <button
                            key={
                              minutes
                            }
                            type="button"
                            onClick={() =>
                              setDurationMinutes(
                                String(
                                  minutes
                                )
                              )
                            }
                            disabled={
                              creating
                            }
                            style={
                              quickButton
                            }
                          >
                            {
                              minutes
                            }
                            m
                          </button>
                        )
                      )}
                    </div>

                    <div
                      style={
                        timerInfo
                      }
                    >
                      ⏱️ The
                      timer will
                      start only
                      when the
                      recipient
                      presses{" "}
                      <strong>
                        Start
                        Assignment
                      </strong>
                      .
                    </div>
                  </div>
                )}
              </Section>

              {/* ===============================================
                  BUTTONS
                  =============================================== */}

              <div
                style={{
                  display:
                    "flex",

                  justifyContent:
                    "flex-end",

                  gap:
                    "9px",

                  flexWrap:
                    "wrap",
                }}
              >
                <button
                  type="button"
                  onClick={() =>
                    setShowCreate(
                      false
                    )
                  }
                  disabled={
                    creating
                  }
                  style={
                    secondaryButton
                  }
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={
                    creating ||
                    friends.length ===
                      0
                  }
                  style={
                    primaryButton
                  }
                >
                  {creating
                    ? "Creating..."
                    : "Assign & Send 🚀"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

/* ===========================================================
   COMPONENTS
   =========================================================== */

function StatCard({
  icon,
  label,
  number,
}) {
  return (
    <div style={statCard}>
      <div
        style={{
          fontSize: "21px",
        }}
      >
        {icon}
      </div>

      <strong
        style={{
          fontSize: "24px",
        }}
      >
        {number}
      </strong>

      <span
        style={{
          color: "#64748b",
          fontSize: "13px",
          fontWeight: 700,
        }}
      >
        {label}
      </span>
    </div>
  );
}

function TabButton({
  active,
  onClick,
  children,
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={tabButton(
        active
      )}
    >
      {children}
    </button>
  );
}

function EmptyState({
  icon,
  title,
  text,
}) {
  return (
    <div style={emptyState}>
      <div
        style={{
          fontSize: "36px",
        }}
      >
        {icon}
      </div>

      <h3
        style={{
          margin:
            "8px 0 5px",
        }}
      >
        {title}
      </h3>

      <p
        style={{
          margin: 0,
          color: "#64748b",
        }}
      >
        {text}
      </p>
    </div>
  );
}

function Section({
  title,
  children,
}) {
  return (
    <section
      style={{
        marginBottom:
          "24px",
      }}
    >
      <h3
        style={{
          margin:
            "0 0 11px",

          fontSize:
            "16px",
        }}
      >
        {title}
      </h3>

      {children}
    </section>
  );
}

function Toggle({
  checked,
  onChange,
  title,
  disabled,
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={() =>
        onChange(!checked)
      }
      style={toggleButton(
        checked
      )}
    >
      <div
        style={toggleTrack(
          checked
        )}
      >
        <div
          style={toggleDot}
        />
      </div>

      <strong>
        {title}
      </strong>
    </button>
  );
}

/* ===========================================================
   STYLES
   =========================================================== */

const hero = {
  background:
    "linear-gradient(135deg, #6d28d9, #8b5cf6)",

  color: "white",

  padding: "28px",

  borderRadius: "22px",

  marginBottom: "22px",

  display: "flex",

  justifyContent:
    "space-between",

  alignItems: "center",

  gap: "20px",

  flexWrap: "wrap",
};

const eyebrow = {
  fontSize: "12px",

  fontWeight: 900,

  opacity: 0.8,

  letterSpacing: "0.08em",

  marginBottom: "7px",
};

const heroButton = {
  border: "none",

  borderRadius: "12px",

  padding: "12px 18px",

  background: "white",

  color: "#6d28d9",

  fontWeight: 900,

  cursor: "pointer",
};

const messageBox = {
  padding: "12px 15px",

  borderRadius: "12px",

  background: "#f3e8ff",

  color: "#6b21a8",

  marginBottom: "18px",

  fontWeight: 700,
};

const statsGrid = {
  display: "grid",

  gridTemplateColumns:
    "repeat(auto-fit, minmax(150px, 1fr))",

  gap: "12px",

  marginBottom: "22px",
};

const statCard = {
  background: "white",

  border:
    "1px solid #e5e7eb",

  borderRadius: "16px",

  padding: "17px",

  display: "grid",

  gap: "3px",
};

const tabs = {
  display: "flex",

  gap: "8px",

  marginBottom: "20px",

  flexWrap: "wrap",
};

const card = {
  background: "white",

  border:
    "1px solid #e5e7eb",

  borderRadius: "18px",

  padding: "20px",

  boxShadow:
    "0 3px 10px rgba(15, 23, 42, 0.03)",
};

const cardRow = {
  display: "flex",

  justifyContent:
    "space-between",

  alignItems:
    "flex-start",

  gap: "16px",

  flexWrap: "wrap",
};

const statusText = {
  fontSize: "12px",

  fontWeight: 900,

  color: "#7c3aed",

  marginBottom: "5px",
};

const description = {
  margin: "0 0 12px",

  color: "#64748b",

  lineHeight: 1.5,

  whiteSpace: "pre-wrap",
};

const metaRow = {
  display: "flex",

  gap: "14px",

  flexWrap: "wrap",

  color: "#64748b",

  fontSize: "13px",
};

const progressWarning = {
  marginTop: "12px",

  padding: "10px 12px",

  background: "#fff7ed",

  border:
    "1px solid #fed7aa",

  color: "#9a3412",

  borderRadius: "10px",

  fontSize: "13px",

  fontWeight: 700,
};

const submittedNotice = {
  marginTop: "12px",

  padding: "10px 12px",

  background: "#ecfdf5",

  border:
    "1px solid #bbf7d0",

  color: "#166534",

  borderRadius: "10px",

  fontSize: "13px",

  fontWeight: 700,
};

const primaryButton = {
  border: "none",

  borderRadius: "11px",

  padding: "10px 16px",

  background: "#7c3aed",

  color: "white",

  fontWeight: 900,

  cursor: "pointer",
};

const secondaryButton = {
  border:
    "1px solid #ddd6fe",

  borderRadius: "11px",

  padding: "10px 16px",

  background: "#f5f3ff",

  color: "#6d28d9",

  fontWeight: 900,

  cursor: "pointer",
};

const emptyState = {
  background: "white",

  border:
    "1px dashed #d8b4fe",

  borderRadius: "18px",

  padding: "38px 20px",

  textAlign: "center",
};

const modalBackdrop = {
  position: "fixed",

  inset: 0,

  background:
    "rgba(15, 23, 42, 0.55)",

  zIndex: 1000,

  display: "flex",

  alignItems: "center",

  justifyContent:
    "center",

  padding: "20px",
};

const modal = {
  width: "100%",

  maxWidth: "760px",

  maxHeight: "90vh",

  overflowY: "auto",

  background: "white",

  borderRadius: "22px",

  boxShadow:
    "0 24px 70px rgba(15, 23, 42, 0.28)",
};

const modalHeader = {
  padding: "22px 24px",

  borderBottom:
    "1px solid #e5e7eb",

  display: "flex",

  justifyContent:
    "space-between",

  gap: "15px",
};

const closeButton = {
  width: "38px",

  height: "38px",

  borderRadius: "50%",

  border:
    "1px solid #e5e7eb",

  background: "white",

  cursor: "pointer",
};

const labelStyle = {
  display: "block",

  fontSize: "13px",

  fontWeight: 800,

  color: "#334155",

  marginBottom: "6px",
};

const inputStyle = {
  width: "100%",

  boxSizing:
    "border-box",

  border:
    "1px solid #cbd5e1",

  borderRadius: "11px",

  padding: "11px 12px",

  fontSize: "14px",

  outline: "none",
};

const uploadBox = {
  display: "block",

  border:
    "2px dashed #c4b5fd",

  background: "#faf5ff",

  borderRadius: "15px",

  padding: "22px",

  textAlign: "center",

  cursor: "pointer",
};

const emptyMini = {
  padding: "15px",

  background: "#f8fafc",

  borderRadius: "12px",

  color: "#64748b",
};

const selectHeader = {
  display: "flex",

  justifyContent:
    "space-between",

  marginBottom: "9px",
};

const linkButton = {
  border: "none",

  background:
    "transparent",

  color: "#7c3aed",

  fontWeight: 900,

  cursor: "pointer",
};

const avatar = {
  width: "38px",

  height: "38px",

  borderRadius: "50%",

  background: "#ede9fe",

  color: "#6d28d9",

  display: "flex",

  alignItems: "center",

  justifyContent:
    "center",

  fontWeight: 900,

  flexShrink: 0,
};

const quickButton = {
  border:
    "1px solid #ddd6fe",

  background: "#faf5ff",

  color: "#6d28d9",

  borderRadius: "9px",

  padding: "7px 10px",

  fontWeight: 800,

  cursor: "pointer",
};

const timerInfo = {
  marginTop: "10px",

  padding: "10px",

  background: "#f8fafc",

  borderRadius: "10px",

  color: "#64748b",

  fontSize: "12px",
};

/* ===========================================================
   DYNAMIC STYLES
   =========================================================== */

function tabButton(active) {
  return {
    border: active
      ? "1px solid #7c3aed"
      : "1px solid #e5e7eb",

    background: active
      ? "#ede9fe"
      : "white",

    color: active
      ? "#6d28d9"
      : "#475569",

    borderRadius: "11px",

    padding: "10px 15px",

    fontWeight: 900,

    cursor: "pointer",
  };
}

function friendButton(
  selected
) {
  return {
    width: "100%",

    textAlign: "left",

    display: "flex",

    alignItems: "center",

    gap: "12px",

    padding: "12px 14px",

    borderRadius: "13px",

    border: selected
      ? "1px solid #8b5cf6"
      : "1px solid #e5e7eb",

    background: selected
      ? "#f5f3ff"
      : "white",

    cursor: "pointer",
  };
}

function checkBox(selected) {
  return {
    width: "24px",

    height: "24px",

    borderRadius: "7px",

    background: selected
      ? "#7c3aed"
      : "#f1f5f9",

    color: "white",

    display: "flex",

    alignItems: "center",

    justifyContent:
      "center",

    fontWeight: 900,

    flexShrink: 0,
  };
}

function toggleButton(
  checked
) {
  return {
    width: "100%",

    display: "flex",

    alignItems: "center",

    gap: "12px",

    textAlign: "left",

    border: checked
      ? "1px solid #8b5cf6"
      : "1px solid #e5e7eb",

    background: checked
      ? "#faf5ff"
      : "white",

    borderRadius: "13px",

    padding: "13px",

    cursor: "pointer",
  };
}

function toggleTrack(
  checked
) {
  return {
    width: "42px",

    height: "24px",

    borderRadius: "999px",

    background: checked
      ? "#7c3aed"
      : "#cbd5e1",

    padding: "3px",

    display: "flex",

    justifyContent:
      checked
        ? "flex-end"
        : "flex-start",

    boxSizing:
      "border-box",

    flexShrink: 0,
  };
}

const toggleDot = {
  width: "18px",

  height: "18px",

  background: "white",

  borderRadius: "50%",
};

export default Assignments;