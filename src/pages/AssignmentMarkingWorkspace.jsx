import { useEffect, useRef, useState } from "react";
import { supabase } from "../lib/supabase";

import * as pdfjsLib from "pdfjs-dist";
import pdfWorker from "pdfjs-dist/build/pdf.worker.min.mjs?url";

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorker;

function AssignmentMarkingWorkspace({
  assignmentRecipientId,
  onBack,
}) {
  /* =========================================================
     REFS
     ========================================================= */

  const pdfCanvasRef = useRef(null);
  const studentCanvasRef = useRef(null);
  const markingCanvasRef = useRef(null);

  const drawingRef = useRef(false);
  const currentStrokeRef = useRef(null);

  const pageNumberRef = useRef(1);
  const scaleRef = useRef(1.25);

  const markingAnnotationsRef = useRef([]);

  /* =========================================================
     DATA
     ========================================================= */

  const [recipient, setRecipient] = useState(null);
  const [assignment, setAssignment] = useState(null);
  const [studentProfile, setStudentProfile] = useState(null);
  const [submission, setSubmission] = useState(null);

  const [feedbackRecord, setFeedbackRecord] = useState(null);

  /* =========================================================
     PDF
     ========================================================= */

  const [pdfDocument, setPdfDocument] = useState(null);
  const [pageNumber, setPageNumber] = useState(1);
  const [pageCount, setPageCount] = useState(0);
  const [scale, setScale] = useState(1.25);

  const [pageReady, setPageReady] = useState(false);
  const [pdfLoading, setPdfLoading] = useState(false);

  /* =========================================================
     ANNOTATIONS
     ========================================================= */

  const [studentAnnotations, setStudentAnnotations] =
    useState([]);

  const [markingAnnotations, setMarkingAnnotations] =
    useState([]);

  const [tool, setTool] = useState("pen");
  const [colour, setColour] = useState("#dc2626");
  const [size, setSize] = useState(3);

  const [savingAnnotation, setSavingAnnotation] =
    useState(false);

  /* =========================================================
     MARK / FEEDBACK
     ========================================================= */

  const [mark, setMark] = useState("");
  const [markOutOf, setMarkOutOf] = useState("");
  const [grade, setGrade] = useState("");
  const [feedback, setFeedback] = useState("");

  const [returning, setReturning] = useState(false);

  /* =========================================================
     GENERAL
     ========================================================= */

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  /* =========================================================
     KEEP REFS UPDATED
     ========================================================= */

  useEffect(() => {
    pageNumberRef.current = pageNumber;
  }, [pageNumber]);

  useEffect(() => {
    scaleRef.current = scale;
  }, [scale]);

  useEffect(() => {
    markingAnnotationsRef.current = markingAnnotations;
  }, [markingAnnotations]);

  /* =========================================================
     LOAD MARKING WORKSPACE
     ========================================================= */

  useEffect(() => {
    if (!assignmentRecipientId) return;

    loadWorkspace();
  }, [assignmentRecipientId]);

  async function loadWorkspace() {
    try {
      setLoading(true);
      setError("");
      setMessage("");

      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError || !user) {
        throw new Error(
          "You must be logged in to mark an assignment."
        );
      }

      /* -------------------------------------------------------
         RECIPIENT + ASSIGNMENT
         ------------------------------------------------------- */

      const {
        data: recipientData,
        error: recipientError,
      } = await supabase
        .from("assignment_recipients")
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
        .eq("id", assignmentRecipientId)
        .single();

      if (recipientError) {
        throw recipientError;
      }

      if (!recipientData) {
        throw new Error("Submission not found.");
      }

      if (recipientData.assignments?.creator_id !== user.id) {
        throw new Error(
          "Only the assignment creator can mark this paper."
        );
      }

      if (
        recipientData.status !== "submitted" &&
        recipientData.status !== "returned"
      ) {
        throw new Error(
          "This student has not submitted the assignment yet."
        );
      }

      setRecipient(recipientData);
      setAssignment(recipientData.assignments);

      /* -------------------------------------------------------
         STUDENT PROFILE
         ------------------------------------------------------- */

      const {
        data: profileData,
        error: profileError,
      } = await supabase
        .from("profiles")
        .select("id, full_name, school_email, year_group")
        .eq("id", recipientData.recipient_id)
        .maybeSingle();

      if (profileError) {
        throw profileError;
      }

      setStudentProfile(profileData || null);

      /* -------------------------------------------------------
         PRIVATE SUBMISSION
         ------------------------------------------------------- */

      const {
        data: submissionData,
        error: submissionError,
      } = await supabase
        .from("assignment_submissions")
        .select(`
          id,
          assignment_recipient_id,
          student_id,
          created_at,
          updated_at
        `)
        .eq("assignment_recipient_id", recipientData.id)
        .single();

      if (submissionError) {
        throw submissionError;
      }

      setSubmission(submissionData);

      /* -------------------------------------------------------
         EXISTING FEEDBACK
         ------------------------------------------------------- */

      const {
        data: existingFeedback,
        error: feedbackError,
      } = await supabase
        .from("assignment_feedback")
        .select(`
          id,
          assignment_recipient_id,
          marker_id,
          mark,
          mark_out_of,
          grade,
          feedback,
          created_at,
          updated_at
        `)
        .eq("assignment_recipient_id", recipientData.id)
        .maybeSingle();

      if (feedbackError) {
        throw feedbackError;
      }

      if (existingFeedback) {
        setFeedbackRecord(existingFeedback);

        setMark(
          existingFeedback.mark === null
            ? ""
            : String(existingFeedback.mark)
        );

        setMarkOutOf(
          existingFeedback.mark_out_of === null
            ? ""
            : String(existingFeedback.mark_out_of)
        );

        setGrade(existingFeedback.grade || "");
        setFeedback(existingFeedback.feedback || "");
      }
    } catch (err) {
      console.error("Could not load marking workspace:", err);

      setError(
        err?.message ||
          "Could not open this submitted assignment."
      );
    } finally {
      setLoading(false);
    }
  }

  /* =========================================================
     LOAD PDF
     ========================================================= */

  useEffect(() => {
    if (!assignment?.file_path || !submission?.id) return;

    let cancelled = false;

    async function loadPdf() {
      try {
        setPdfLoading(true);

        const {
          data,
          error: downloadError,
        } = await supabase.storage
          .from("assignments")
          .download(assignment.file_path);

        if (downloadError) {
          throw downloadError;
        }

        if (!data) {
          throw new Error("Could not download assignment PDF.");
        }

        const arrayBuffer = await data.arrayBuffer();

        const loadingTask = pdfjsLib.getDocument({
          data: new Uint8Array(arrayBuffer),
        });

        const pdf = await loadingTask.promise;

        if (cancelled) return;

        setPdfDocument(pdf);
        setPageCount(pdf.numPages);

        setPageNumber(1);
        pageNumberRef.current = 1;
      } catch (err) {
        if (cancelled) return;

        console.error("Could not load PDF:", err);

        setError(
          err?.message || "Could not load the submitted paper."
        );
      } finally {
        if (!cancelled) {
          setPdfLoading(false);
        }
      }
    }

    loadPdf();

    return () => {
      cancelled = true;
    };
  }, [assignment?.file_path, submission?.id]);

  /* =========================================================
     LOAD STUDENT ANNOTATIONS
     ========================================================= */

  async function loadStudentAnnotations(targetPage) {
    if (!submission?.id) return [];

    const {
      data,
      error: annotationError,
    } = await supabase
      .from("assignment_annotations")
      .select(`
        id,
        submission_id,
        student_id,
        page_number,
        annotation_data,
        created_at
      `)
      .eq("submission_id", submission.id)
      .eq("page_number", targetPage)
      .order("created_at", {
        ascending: true,
      });

    if (annotationError) {
      throw annotationError;
    }

    return data || [];
  }

  /* =========================================================
     LOAD MARKING ANNOTATIONS
     ========================================================= */

  async function loadMarkingAnnotations(targetPage) {
    const {
      data,
      error: annotationError,
    } = await supabase
      .from("assignment_marking_annotations")
      .select(`
        id,
        assignment_recipient_id,
        marker_id,
        page_number,
        annotation_data,
        created_at,
        updated_at
      `)
      .eq("assignment_recipient_id", assignmentRecipientId)
      .eq("page_number", targetPage)
      .order("created_at", {
        ascending: true,
      });

    if (annotationError) {
      throw annotationError;
    }

    return data || [];
  }

  /* =========================================================
     RENDER PAGE
     ========================================================= */

  useEffect(() => {
    if (!pdfDocument || !submission?.id) return;

    let cancelled = false;

    async function renderPage() {
      try {
        setPageReady(false);
        setError("");

        const page = await pdfDocument.getPage(
          pageNumberRef.current
        );

        if (cancelled) return;

        const viewport = page.getViewport({
          scale: scaleRef.current,
        });

        const pdfCanvas = pdfCanvasRef.current;
        const studentCanvas = studentCanvasRef.current;
        const markingCanvas = markingCanvasRef.current;

        if (!pdfCanvas || !studentCanvas || !markingCanvas) {
          return;
        }

        const width = Math.ceil(viewport.width);
        const height = Math.ceil(viewport.height);

        [pdfCanvas, studentCanvas, markingCanvas].forEach(
          (canvas) => {
            canvas.width = width;
            canvas.height = height;

            canvas.style.width = `${viewport.width}px`;
            canvas.style.height = `${viewport.height}px`;
          }
        );

        clearCanvas(studentCanvas);
        clearCanvas(markingCanvas);

        const pdfContext = pdfCanvas.getContext("2d");

        await page.render({
          canvasContext: pdfContext,
          viewport,
        }).promise;

        if (cancelled) return;

        const [studentStrokes, markerStrokes] =
          await Promise.all([
            loadStudentAnnotations(pageNumberRef.current),
            loadMarkingAnnotations(pageNumberRef.current),
          ]);

        if (cancelled) return;

        setStudentAnnotations(studentStrokes);
        setMarkingAnnotations(markerStrokes);

        markingAnnotationsRef.current = markerStrokes;

        drawAnnotationList(studentCanvas, studentStrokes);
        drawAnnotationList(markingCanvas, markerStrokes);

        setPageReady(true);
      } catch (err) {
        if (cancelled) return;

        console.error("Could not render marked page:", err);

        setError(
          err?.message || "Could not render this page."
        );
      }
    }

    renderPage();

    return () => {
      cancelled = true;
    };
  }, [
    pdfDocument,
    submission?.id,
    pageNumber,
    scale,
    assignmentRecipientId,
  ]);

  /* =========================================================
     CANVAS HELPERS
     ========================================================= */

  function clearCanvas(canvas) {
    if (!canvas) return;

    const context = canvas.getContext("2d");

    context.clearRect(0, 0, canvas.width, canvas.height);

    context.globalAlpha = 1;
    context.globalCompositeOperation = "source-over";
  }

  function drawAnnotationList(canvas, list) {
    if (!canvas) return;

    clearCanvas(canvas);

    const context = canvas.getContext("2d");

    list.forEach((annotation) => {
      drawStroke(context, annotation.annotation_data, canvas);
    });
  }

  function drawStroke(context, stroke, canvas) {
    if (
      !stroke ||
      !Array.isArray(stroke.points) ||
      stroke.points.length === 0
    ) {
      return;
    }

    const points = stroke.points;

    const strokeTool = stroke.tool || "pen";
    const strokeColour = stroke.colour || "#dc2626";
    const strokeSize = Number(stroke.size || 3);

    context.lineCap = "round";
    context.lineJoin = "round";

    if (strokeTool === "eraser") {
      context.globalCompositeOperation = "destination-out";
      context.globalAlpha = 1;
      context.lineWidth = strokeSize * 5;
    } else if (strokeTool === "highlighter") {
      context.globalCompositeOperation = "source-over";
      context.strokeStyle = strokeColour;
      context.globalAlpha = 0.3;
      context.lineWidth = strokeSize * 5;
    } else {
      context.globalCompositeOperation = "source-over";
      context.strokeStyle = strokeColour;
      context.globalAlpha = 1;
      context.lineWidth = strokeSize;
    }

    context.beginPath();

    const first = points[0];

    context.moveTo(
      first.x * canvas.width,
      first.y * canvas.height
    );

    for (let index = 1; index < points.length; index += 1) {
      const point = points[index];

      context.lineTo(
        point.x * canvas.width,
        point.y * canvas.height
      );
    }

    if (points.length === 1) {
      context.lineTo(
        first.x * canvas.width + 0.01,
        first.y * canvas.height + 0.01
      );
    }

    context.stroke();
    context.beginPath();

    context.globalAlpha = 1;
    context.globalCompositeOperation = "source-over";
  }

  /* =========================================================
     POINTER
     ========================================================= */

  function getPointerPosition(event) {
    const canvas = markingCanvasRef.current;

    if (!canvas) return null;

    const rect = canvas.getBoundingClientRect();

    if (!rect.width || !rect.height) return null;

    return {
      x:
        (event.clientX - rect.left) *
        (canvas.width / rect.width),

      y:
        (event.clientY - rect.top) *
        (canvas.height / rect.height),
    };
  }

  function configureMarkerContext(context) {
    context.lineCap = "round";
    context.lineJoin = "round";

    if (tool === "eraser") {
      context.globalCompositeOperation = "destination-out";
      context.globalAlpha = 1;
      context.lineWidth = size * 5;
    } else if (tool === "highlighter") {
      context.globalCompositeOperation = "source-over";
      context.strokeStyle = colour;
      context.globalAlpha = 0.3;
      context.lineWidth = size * 5;
    } else {
      context.globalCompositeOperation = "source-over";
      context.strokeStyle = colour;
      context.globalAlpha = 1;
      context.lineWidth = size;
    }
  }

  /* =========================================================
     START MARKING
     ========================================================= */

  function startDrawing(event) {
    if (!pageReady) return;

    event.preventDefault();

    const canvas = markingCanvasRef.current;
    const position = getPointerPosition(event);

    if (!canvas || !position) return;

    try {
      canvas.setPointerCapture(event.pointerId);
    } catch {
      // Pointer capture is optional.
    }

    drawingRef.current = true;

    currentStrokeRef.current = {
      tool,
      colour,
      size,
      points: [
        {
          x: position.x / canvas.width,
          y: position.y / canvas.height,
        },
      ],
    };

    const context = canvas.getContext("2d");

    configureMarkerContext(context);

    context.beginPath();
    context.moveTo(position.x, position.y);
  }

  function draw(event) {
    if (!drawingRef.current) return;

    event.preventDefault();

    const canvas = markingCanvasRef.current;
    const position = getPointerPosition(event);

    if (!canvas || !position) return;

    const context = canvas.getContext("2d");

    configureMarkerContext(context);

    context.lineTo(position.x, position.y);
    context.stroke();

    context.beginPath();
    context.moveTo(position.x, position.y);

    currentStrokeRef.current?.points.push({
      x: position.x / canvas.width,
      y: position.y / canvas.height,
    });
  }

  async function stopDrawing() {
    if (!drawingRef.current) return;

    drawingRef.current = false;

    const stroke = currentStrokeRef.current;
    currentStrokeRef.current = null;

    const canvas = markingCanvasRef.current;

    if (canvas) {
      const context = canvas.getContext("2d");

      context.beginPath();
      context.globalAlpha = 1;
      context.globalCompositeOperation = "source-over";
    }

    if (!stroke?.points?.length) return;

    await saveMarkingStroke(stroke);
  }

  /* =========================================================
     SAVE MARKING STROKE
     ========================================================= */

  async function saveMarkingStroke(stroke) {
    try {
      setSavingAnnotation(true);
      setError("");

      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError || !user) {
        throw new Error("You must be logged in.");
      }

      const {
        data,
        error: insertError,
      } = await supabase
        .from("assignment_marking_annotations")
        .insert({
          assignment_recipient_id: assignmentRecipientId,
          marker_id: user.id,
          page_number: pageNumberRef.current,
          annotation_data: stroke,
        })
        .select(`
          id,
          assignment_recipient_id,
          marker_id,
          page_number,
          annotation_data,
          created_at,
          updated_at
        `)
        .single();

      if (insertError) {
        throw insertError;
      }

      const updated = [
        ...markingAnnotationsRef.current,
        data,
      ];

      markingAnnotationsRef.current = updated;
      setMarkingAnnotations(updated);
    } catch (err) {
      console.error("Could not save correction:", err);

      setError(
        err?.message || "Could not save that correction."
      );

      drawAnnotationList(
        markingCanvasRef.current,
        markingAnnotationsRef.current
      );
    } finally {
      setSavingAnnotation(false);
    }
  }

  /* =========================================================
     UNDO MARKING
     ========================================================= */

  async function undoMarking() {
    if (markingAnnotationsRef.current.length === 0) return;

    const latest =
      markingAnnotationsRef.current[
        markingAnnotationsRef.current.length - 1
      ];

    try {
      setSavingAnnotation(true);
      setError("");

      const { error: deleteError } = await supabase
        .from("assignment_marking_annotations")
        .delete()
        .eq("id", latest.id);

      if (deleteError) {
        throw deleteError;
      }

      const remaining = markingAnnotationsRef.current.filter(
        (annotation) => annotation.id !== latest.id
      );

      markingAnnotationsRef.current = remaining;
      setMarkingAnnotations(remaining);

      drawAnnotationList(
        markingCanvasRef.current,
        remaining
      );
    } catch (err) {
      console.error("Could not undo correction:", err);

      setError(
        err?.message || "Could not undo that correction."
      );
    } finally {
      setSavingAnnotation(false);
    }
  }

  /* =========================================================
     CLEAR MARKING FROM CURRENT PAGE
     ========================================================= */

  async function clearMarkingPage() {
    if (markingAnnotationsRef.current.length === 0) return;

    const confirmed = window.confirm(
      "Remove all of your marking annotations from this page?"
    );

    if (!confirmed) return;

    try {
      setSavingAnnotation(true);
      setError("");

      const ids = markingAnnotationsRef.current.map(
        (annotation) => annotation.id
      );

      const { error: deleteError } = await supabase
        .from("assignment_marking_annotations")
        .delete()
        .in("id", ids);

      if (deleteError) {
        throw deleteError;
      }

      markingAnnotationsRef.current = [];
      setMarkingAnnotations([]);

      clearCanvas(markingCanvasRef.current);
    } catch (err) {
      console.error("Could not clear marking:", err);

      setError(
        err?.message ||
          "Could not clear the corrections from this page."
      );
    } finally {
      setSavingAnnotation(false);
    }
  }

  /* =========================================================
     RETURN PAPER
     ========================================================= */

  async function returnToStudent() {
    const numericMark =
      mark.trim() === "" ? null : Number(mark);

    const numericOutOf =
      markOutOf.trim() === "" ? null : Number(markOutOf);

    if (
      numericMark !== null &&
      (!Number.isFinite(numericMark) || numericMark < 0)
    ) {
      setError("Please enter a valid mark.");
      return;
    }

    if (
      numericOutOf !== null &&
      (!Number.isFinite(numericOutOf) || numericOutOf <= 0)
    ) {
      setError("Please enter a valid maximum mark.");
      return;
    }

    if (numericMark !== null && numericOutOf === null) {
      setError(
        "Please enter the maximum mark as well."
      );
      return;
    }

    if (
      numericMark !== null &&
      numericOutOf !== null &&
      numericMark > numericOutOf
    ) {
      setError(
        "The mark cannot be greater than the maximum mark."
      );
      return;
    }

    const confirmed = window.confirm(
      recipient?.status === "returned"
        ? "Update this student's returned mark and feedback?"
        : "Return this marked assignment to the student? They will be able to see your corrections, mark, grade and feedback."
    );

    if (!confirmed) return;

    try {
      setReturning(true);
      setError("");
      setMessage("");

      const { error: returnError } = await supabase.rpc(
        "return_marked_assignment",
        {
          p_assignment_recipient_id:
            assignmentRecipientId,

          p_mark: numericMark,

          p_mark_out_of: numericOutOf,

          p_grade: grade.trim() || null,

          p_feedback: feedback.trim() || null,
        }
      );

      if (returnError) {
        throw returnError;
      }

      setRecipient((current) => ({
        ...current,
        status: "returned",
        returned_at: new Date().toISOString(),
      }));

      setMessage(
        recipient?.status === "returned"
          ? "Mark and feedback updated successfully. ✅"
          : "Assignment returned to the student successfully! ✅"
      );

      await reloadFeedback();
    } catch (err) {
      console.error("Could not return assignment:", err);

      setError(
        err?.message ||
          "Could not return the marked assignment."
      );
    } finally {
      setReturning(false);
    }
  }

  /* =========================================================
     RELOAD FEEDBACK
     ========================================================= */

  async function reloadFeedback() {
    const {
      data,
      error: feedbackError,
    } = await supabase
      .from("assignment_feedback")
      .select(`
        id,
        assignment_recipient_id,
        marker_id,
        mark,
        mark_out_of,
        grade,
        feedback,
        created_at,
        updated_at
      `)
      .eq("assignment_recipient_id", assignmentRecipientId)
      .maybeSingle();

    if (feedbackError) {
      console.error(feedbackError);
      return;
    }

    setFeedbackRecord(data || null);
  }

  /* =========================================================
     PAGE / ZOOM
     ========================================================= */

  function previousPage() {
    if (pageNumber <= 1) return;

    setPageNumber(pageNumber - 1);
  }

  function nextPage() {
    if (pageNumber >= pageCount) return;

    setPageNumber(pageNumber + 1);
  }

  function zoomIn() {
    setScale((current) => {
      const next = Math.min(3, current + 0.15);

      scaleRef.current = next;

      return next;
    });
  }

  function zoomOut() {
    setScale((current) => {
      const next = Math.max(0.5, current - 0.15);

      scaleRef.current = next;

      return next;
    });
  }

  /* =========================================================
     FORMAT
     ========================================================= */

  function formatDate(value) {
    if (!value) return "—";

    return new Date(value).toLocaleString("en-GB", {
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  /* =========================================================
     LOADING
     ========================================================= */

  if (loading) {
    return (
      <div style={centre}>
        <div style={{ fontSize: "40px" }}>🖊️</div>

        <h2>Opening marking workspace...</h2>

        <p style={{ color: "#64748b" }}>
          Loading the student's submitted paper.
        </p>
      </div>
    );
  }

  /* =========================================================
     ERROR BEFORE LOAD
     ========================================================= */

  if (!recipient || !assignment || !submission) {
    return (
      <div style={centre}>
        <div style={{ fontSize: "40px" }}>⚠️</div>

        <h2>Paper unavailable</h2>

        <p style={{ color: "#64748b" }}>
          {error ||
            "The submitted paper could not be opened."}
        </p>

        <button
          type="button"
          onClick={onBack}
          style={primaryButton}
        >
          ← Back
        </button>
      </div>
    );
  }

  /* =========================================================
     WORKSPACE
     ========================================================= */

  return (
    <div style={workspace}>
      {/* =====================================================
          HEADER
          ===================================================== */}

      <div style={topBar}>
        <div style={topBarGroup}>
          <button
            type="button"
            onClick={onBack}
            style={secondaryButton}
          >
            ← Back
          </button>

          <div>
            <strong>{assignment.title}</strong>

            <div style={smallText}>
              Marking{" "}
              {studentProfile?.full_name || "Student"}
            </div>
          </div>
        </div>

        <div style={topBarGroup}>
          <span
            style={{
              ...statusBadge,
              background:
                recipient.status === "returned"
                  ? "#dcfce7"
                  : "#dbeafe",

              color:
                recipient.status === "returned"
                  ? "#166534"
                  : "#1d4ed8",
            }}
          >
            {recipient.status === "returned"
              ? "✅ Returned"
              : "📤 Submitted"}
          </span>

          <span style={smallText}>
            Submitted {formatDate(recipient.submitted_at)}
          </span>
        </div>
      </div>

      {/* =====================================================
          DRAWING TOOLBAR
          ===================================================== */}

      <div style={markingToolbar}>
        <div style={topBarGroup}>
          <strong>Marking tools:</strong>

          <button
            type="button"
            onClick={() => setTool("pen")}
            style={toolButton(tool === "pen")}
          >
            ✏️ Pen
          </button>

          <button
            type="button"
            onClick={() => setTool("highlighter")}
            style={toolButton(tool === "highlighter")}
          >
            🖍️ Highlighter
          </button>

          <button
            type="button"
            onClick={() => setTool("eraser")}
            style={toolButton(tool === "eraser")}
          >
            🧽 Eraser
          </button>

          <input
            type="color"
            value={colour}
            onChange={(event) =>
              setColour(event.target.value)
            }
            title="Marking colour"
            style={colourInput}
          />

          <select
            value={size}
            onChange={(event) =>
              setSize(Number(event.target.value))
            }
            style={selectStyle}
          >
            <option value={2}>Fine</option>
            <option value={3}>Normal</option>
            <option value={5}>Thick</option>
            <option value={8}>Very thick</option>
          </select>

          <button
            type="button"
            onClick={undoMarking}
            disabled={markingAnnotations.length === 0}
            style={secondaryButton}
          >
            ↩️ Undo
          </button>

          <button
            type="button"
            onClick={clearMarkingPage}
            disabled={markingAnnotations.length === 0}
            style={secondaryButton}
          >
            🗑️ Clear Marking
          </button>

          <span style={smallText}>
            {savingAnnotation
              ? "Saving correction..."
              : "✓ Corrections saved"}
          </span>
        </div>

        <div style={topBarGroup}>
          <button
            type="button"
            onClick={zoomOut}
            style={secondaryButton}
          >
            −
          </button>

          <strong>{Math.round(scale * 100)}%</strong>

          <button
            type="button"
            onClick={zoomIn}
            style={secondaryButton}
          >
            +
          </button>
        </div>
      </div>

      {/* =====================================================
          MESSAGE
          ===================================================== */}

      {message && (
        <div style={successBox}>
          {message}
        </div>
      )}

      {error && (
        <div style={errorBox}>
          {error}
        </div>
      )}

      {/* =====================================================
          MAIN AREA
          ===================================================== */}

      <div style={mainGrid}>
        {/* ===================================================
            PAPER
            =================================================== */}

        <div style={paperSection}>
          <PageControls
            pageNumber={pageNumber}
            pageCount={pageCount}
            previousPage={previousPage}
            nextPage={nextPage}
          />

          {pdfLoading ? (
            <div style={centre}>
              <h3>Loading paper...</h3>
            </div>
          ) : (
            <div style={canvasArea}>
              <div style={canvasStack}>
                {/* PDF */}

                <canvas
                  ref={pdfCanvasRef}
                  style={{
                    display: "block",
                    background: "#ffffff",
                  }}
                />

                {/* STUDENT ANSWERS - READ ONLY */}

                <canvas
                  ref={studentCanvasRef}
                  style={{
                    position: "absolute",
                    inset: 0,
                    pointerEvents: "none",
                  }}
                />

                {/* MARKER CORRECTIONS */}

                <canvas
                  ref={markingCanvasRef}
                  onPointerDown={startDrawing}
                  onPointerMove={draw}
                  onPointerUp={stopDrawing}
                  onPointerCancel={stopDrawing}
                  onPointerLeave={stopDrawing}
                  style={{
                    position: "absolute",
                    inset: 0,
                    touchAction: "none",

                    cursor:
                      tool === "eraser"
                        ? "cell"
                        : "crosshair",
                  }}
                />
              </div>
            </div>
          )}

          <PageControls
            pageNumber={pageNumber}
            pageCount={pageCount}
            previousPage={previousPage}
            nextPage={nextPage}
          />
        </div>

        {/* ===================================================
            MARK PANEL
            =================================================== */}

        <aside style={markPanel}>
          <div>
            <div style={panelEyebrow}>
              STUDENT
            </div>

            <h2
              style={{
                margin: "3px 0 4px",
              }}
            >
              {studentProfile?.full_name || "Student"}
            </h2>

            <div style={smallText}>
              {studentProfile?.year_group || "Sixth Form"}
            </div>
          </div>

          <div style={divider} />

          <div>
            <label style={labelStyle}>
              Mark
            </label>

            <div style={markRow}>
              <input
                type="number"
                min="0"
                step="0.5"
                value={mark}
                onChange={(event) =>
                  setMark(event.target.value)
                }
                placeholder="e.g. 62"
                style={inputStyle}
              />

              <span
                style={{
                  fontWeight: 900,
                  color: "#64748b",
                }}
              >
                /
              </span>

              <input
                type="number"
                min="0.5"
                step="0.5"
                value={markOutOf}
                onChange={(event) =>
                  setMarkOutOf(event.target.value)
                }
                placeholder="e.g. 80"
                style={inputStyle}
              />
            </div>
          </div>

          <div>
            <label style={labelStyle}>
              Grade
            </label>

            <input
              value={grade}
              onChange={(event) =>
                setGrade(event.target.value)
              }
              placeholder="e.g. A"
              style={inputStyle}
            />
          </div>

          <div>
            <label style={labelStyle}>
              Feedback
            </label>

            <textarea
              value={feedback}
              onChange={(event) =>
                setFeedback(event.target.value)
              }
              rows={8}
              placeholder="Write feedback for the student..."
              style={{
                ...inputStyle,
                resize: "vertical",
                fontFamily: "inherit",
                lineHeight: 1.5,
              }}
            />
          </div>

          {mark !== "" &&
            markOutOf !== "" &&
            Number(markOutOf) > 0 && (
              <div style={percentageBox}>
                <span>Percentage</span>

                <strong>
                  {(
                    (Number(mark) /
                      Number(markOutOf)) *
                    100
                  ).toFixed(1)}
                  %
                </strong>
              </div>
            )}

          {feedbackRecord && (
            <div style={existingFeedbackBox}>
              <strong>
                ✓ Previously returned
              </strong>

              <div style={smallText}>
                You can update the marking and return it
                again.
              </div>
            </div>
          )}

          <button
            type="button"
            onClick={returnToStudent}
            disabled={
              returning || savingAnnotation
            }
            style={returnButton}
          >
            {returning
              ? "Returning..."
              : recipient.status === "returned"
                ? "Update Returned Work"
                : "Return to Student →"}
          </button>

          <div style={privacyNote}>
            🔒 The student's submitted answers are frozen.
            Your corrections are stored on a separate marking
            layer.
          </div>
        </aside>
      </div>
    </div>
  );
}

/* ===========================================================
   SMALL COMPONENT
   =========================================================== */

function PageControls({
  pageNumber,
  pageCount,
  previousPage,
  nextPage,
}) {
  return (
    <div style={pageControls}>
      <button
        type="button"
        onClick={previousPage}
        disabled={pageNumber <= 1}
        style={secondaryButton}
      >
        ← Previous
      </button>

      <strong>
        Page {pageNumber} / {pageCount || "..."}
      </strong>

      <button
        type="button"
        onClick={nextPage}
        disabled={pageNumber >= pageCount}
        style={secondaryButton}
      >
        Next →
      </button>
    </div>
  );
}

/* ===========================================================
   STYLES
   =========================================================== */

const workspace = {
  minHeight: "100vh",
  background: "#eef1f5",
};

const topBar = {
  position: "sticky",
  top: 0,
  zIndex: 60,

  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: "12px",
  flexWrap: "wrap",

  padding: "12px 16px",

  background: "#ffffff",
  borderBottom: "1px solid #e2e8f0",
};

const topBarGroup = {
  display: "flex",
  alignItems: "center",
  gap: "8px",
  flexWrap: "wrap",
};

const markingToolbar = {
  position: "sticky",
  top: "65px",
  zIndex: 50,

  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",

  gap: "10px",
  flexWrap: "wrap",

  padding: "10px 16px",

  background: "#fff7ed",
  borderBottom: "1px solid #fed7aa",
};

const mainGrid = {
  display: "grid",
  gridTemplateColumns:
    "minmax(0, 1fr) minmax(280px, 340px)",
  alignItems: "start",
};

const paperSection = {
  minWidth: 0,
};

const canvasArea = {
  padding: "20px",
  overflow: "auto",
  textAlign: "center",
};

const canvasStack = {
  position: "relative",
  display: "inline-block",

  boxShadow:
    "0 8px 30px rgba(15, 23, 42, 0.16)",
};

const markPanel = {
  position: "sticky",
  top: "130px",

  margin: "18px 18px 18px 0",
  padding: "20px",

  background: "#ffffff",

  border: "1px solid #e2e8f0",
  borderRadius: "18px",

  boxShadow:
    "0 5px 18px rgba(15, 23, 42, 0.06)",

  display: "grid",
  gap: "18px",
};

const panelEyebrow = {
  color: "#dc2626",
  fontSize: "11px",
  fontWeight: 900,
  letterSpacing: "0.08em",
};

const divider = {
  height: "1px",
  background: "#e2e8f0",
};

const markRow = {
  display: "grid",
  gridTemplateColumns: "1fr auto 1fr",
  alignItems: "center",
  gap: "7px",
};

const labelStyle = {
  display: "block",
  marginBottom: "6px",

  color: "#334155",

  fontSize: "13px",
  fontWeight: 900,
};

const inputStyle = {
  width: "100%",
  boxSizing: "border-box",

  padding: "10px 11px",

  border: "1px solid #cbd5e1",
  borderRadius: "10px",

  fontSize: "14px",
  outline: "none",
};

const selectStyle = {
  padding: "8px 9px",

  border: "1px solid #d1d5db",
  borderRadius: "9px",

  background: "#ffffff",
};

const colourInput = {
  width: "38px",
  height: "34px",

  border: "1px solid #d1d5db",
  borderRadius: "8px",

  background: "#ffffff",
  cursor: "pointer",
};

const pageControls = {
  display: "flex",
  justifyContent: "center",
  alignItems: "center",

  gap: "14px",
  flexWrap: "wrap",

  padding: "13px",
};

const centre = {
  padding: "45px 20px",
  textAlign: "center",
};

const smallText = {
  marginTop: "3px",
  color: "#64748b",
  fontSize: "12px",
};

const statusBadge = {
  padding: "6px 10px",
  borderRadius: "999px",
  fontSize: "12px",
  fontWeight: 900,
};

const successBox = {
  margin: "12px 16px 0",
  padding: "11px 13px",

  background: "#ecfdf5",
  border: "1px solid #bbf7d0",
  borderRadius: "11px",

  color: "#166534",
  fontWeight: 800,
};

const errorBox = {
  margin: "12px 16px 0",
  padding: "11px 13px",

  background: "#fef2f2",
  border: "1px solid #fecaca",
  borderRadius: "11px",

  color: "#b91c1c",
  fontWeight: 700,
};

const percentageBox = {
  padding: "12px",

  borderRadius: "11px",

  background: "#f8fafc",

  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
};

const existingFeedbackBox = {
  padding: "12px",

  borderRadius: "11px",

  background: "#ecfdf5",
  border: "1px solid #bbf7d0",

  color: "#166534",
};

const privacyNote = {
  padding: "11px",

  background: "#f8fafc",
  borderRadius: "10px",

  color: "#64748b",
  fontSize: "11px",
  lineHeight: 1.5,
};

const primaryButton = {
  border: "none",
  borderRadius: "10px",

  padding: "10px 15px",

  background: "#7c3aed",
  color: "#ffffff",

  fontWeight: 900,
  cursor: "pointer",
};

const secondaryButton = {
  border: "1px solid #dbe1e8",
  borderRadius: "9px",

  padding: "8px 11px",

  background: "#ffffff",
  color: "#334155",

  fontWeight: 800,
  cursor: "pointer",
};

const returnButton = {
  border: "none",
  borderRadius: "11px",

  padding: "13px",

  background: "#16a34a",
  color: "#ffffff",

  fontWeight: 900,
  fontSize: "14px",

  cursor: "pointer",
};

function toolButton(active) {
  return {
    ...secondaryButton,

    background: active ? "#fee2e2" : "#ffffff",

    border: active
      ? "1px solid #ef4444"
      : "1px solid #dbe1e8",

    color: active ? "#b91c1c" : "#334155",
  };
}

export default AssignmentMarkingWorkspace;