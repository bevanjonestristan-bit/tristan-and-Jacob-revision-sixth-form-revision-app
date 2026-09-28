import { useEffect, useRef, useState } from "react";
import { supabase } from "../lib/supabase";

import * as pdfjsLib from "pdfjs-dist";
import pdfWorker from "pdfjs-dist/build/pdf.worker.min.mjs?url";

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorker;

function AssignmentWorkspace({
  assignmentRecipientId,
  onBack,
}) {
  /* =========================================================
     REFS
     ========================================================= */

  const pdfCanvasRef = useRef(null);
  const drawingCanvasRef = useRef(null);
  const markingCanvasRef = useRef(null);

  const drawingRef = useRef(false);
  const currentStrokeRef = useRef(null);

  const pageNumberRef = useRef(1);
  const scaleRef = useRef(1.25);

  const annotationsRef = useRef([]);

  const expiryHandledRef = useRef(false);

  /* =========================================================
     ASSIGNMENT STATE
     ========================================================= */

  const [recipient, setRecipient] = useState(null);
  const [assignment, setAssignment] = useState(null);
  const [submission, setSubmission] = useState(null);

  const [returnedFeedback, setReturnedFeedback] =
    useState(null);

  const [markingAnnotations, setMarkingAnnotations] =
    useState([]);

  /* =========================================================
     PDF STATE
     ========================================================= */

  const [pdfDocument, setPdfDocument] = useState(null);
  const [pageNumber, setPageNumber] = useState(1);
  const [pageCount, setPageCount] = useState(0);
  const [scale, setScale] = useState(1.25);

  const [loading, setLoading] = useState(true);
  const [pdfLoading, setPdfLoading] = useState(false);
  const [pageReady, setPageReady] = useState(false);

  /* =========================================================
     DRAWING STATE
     ========================================================= */

  const [tool, setTool] = useState("pen");
  const [penColour, setPenColour] =
    useState("#2563eb");

  const [penSize, setPenSize] = useState(3);

  const [annotations, setAnnotations] =
    useState([]);

  const [saving, setSaving] = useState(false);

  /* =========================================================
     TIMER / SUBMISSION
     ========================================================= */

  const [secondsLeft, setSecondsLeft] =
    useState(null);

  const [starting, setStarting] = useState(false);

  const [submitting, setSubmitting] =
    useState(false);

  const [error, setError] = useState("");

  /* =========================================================
     KEEP REFS SYNCHRONISED
     ========================================================= */

  useEffect(() => {
    pageNumberRef.current = pageNumber;
  }, [pageNumber]);

  useEffect(() => {
    scaleRef.current = scale;
  }, [scale]);

  useEffect(() => {
    annotationsRef.current = annotations;
  }, [annotations]);

  /* =========================================================
     LOAD ASSIGNMENT
     ========================================================= */

  async function loadAssignment() {
    try {
      setLoading(true);
      setError("");

      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError || !user) {
        throw new Error(
          "You must be logged in to open an assignment."
        );
      }

      const {
        data,
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
        .eq("recipient_id", user.id)
        .single();

      if (recipientError) {
        throw recipientError;
      }

      if (!data) {
        throw new Error(
          "This assignment could not be found."
        );
      }

      setRecipient(data);
      setAssignment(data.assignments);

      if (data.started_at) {
        await loadSubmission(data.id);
      }

      if (data.status === "returned") {
        await loadReturnedFeedback(data.id);
      } else {
        setReturnedFeedback(null);
      }
    } catch (err) {
      console.error(
        "Could not load assignment:",
        err
      );

      setError(
        err?.message ||
          "Could not load this assignment."
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!assignmentRecipientId) {
      return;
    }

    loadAssignment();
  }, [assignmentRecipientId]);

  /* =========================================================
     LOAD PRIVATE SUBMISSION
     ========================================================= */

  async function loadSubmission(recipientId) {
    const {
      data,
      error: submissionError,
    } = await supabase
      .from("assignment_submissions")
      .select(
        "id, assignment_recipient_id, student_id, created_at, updated_at"
      )
      .eq(
        "assignment_recipient_id",
        recipientId
      )
      .maybeSingle();

    if (submissionError) {
      throw submissionError;
    }

    setSubmission(data || null);

    return data || null;
  }

  /* =========================================================
     LOAD RETURNED MARK / GRADE / FEEDBACK
     ========================================================= */

  async function loadReturnedFeedback(recipientId) {
    const {
      data,
      error: feedbackError,
    } = await supabase
      .from("assignment_feedback")
      .select(
        "id, assignment_recipient_id, mark, mark_out_of, grade, feedback, created_at, updated_at"
      )
      .eq("assignment_recipient_id", recipientId)
      .maybeSingle();

    if (feedbackError) {
      throw feedbackError;
    }

    setReturnedFeedback(data || null);

    return data || null;
  }

  /* =========================================================
     START ASSIGNMENT
     ========================================================= */

  async function startAssignment() {
    if (!recipient?.id) {
      return;
    }

    const timerText =
      assignment?.duration_minutes
        ? `This will permanently start your ${assignment.duration_minutes}-minute timer.`
        : "This will start your assignment.";

    const confirmed = window.confirm(
      `${timerText}\n\nAre you ready to begin?`
    );

    if (!confirmed) {
      return;
    }

    try {
      setStarting(true);
      setError("");

      const {
        data,
        error: startError,
      } = await supabase.rpc(
        "start_assignment",
        {
          p_assignment_recipient_id:
            recipient.id,
        }
      );

      if (startError) {
        throw startError;
      }

      const result =
        Array.isArray(data) && data.length > 0
          ? data[0]
          : data;

      const updatedRecipient = {
        ...recipient,
        status:
          result?.status || "in_progress",
        started_at:
          result?.started_at ||
          recipient.started_at,
        expires_at:
          result?.expires_at ||
          recipient.expires_at,
        submitted_at:
          result?.submitted_at ||
          recipient.submitted_at,
      };

      setRecipient(updatedRecipient);

      await loadSubmission(recipient.id);
    } catch (err) {
      console.error(
        "Could not start assignment:",
        err
      );

      setError(
        err?.message ||
          "Could not start the assignment."
      );
    } finally {
      setStarting(false);
    }
  }

  /* =========================================================
     HAND IN
     ========================================================= */

  async function handInAssignment(
    automatic = false
  ) {
    if (
      !recipient?.id ||
      submitting ||
      recipient.status === "submitted" ||
      recipient.status === "returned"
    ) {
      return;
    }

    if (!automatic) {
      const confirmed = window.confirm(
        "Hand in your assignment now?\n\nYou will not be able to change your answers afterwards."
      );

      if (!confirmed) {
        return;
      }
    }

    try {
      setSubmitting(true);
      setError("");

      const {
        error: submitError,
      } = await supabase.rpc(
        "submit_assignment",
        {
          p_assignment_recipient_id:
            recipient.id,
        }
      );

      if (submitError) {
        throw submitError;
      }

      setRecipient((current) => ({
        ...current,
        status: "submitted",
        submitted_at:
          current?.submitted_at ||
          new Date().toISOString(),
      }));

      setSecondsLeft(0);
    } catch (err) {
      console.error(
        "Could not submit assignment:",
        err
      );

      setError(
        err?.message ||
          "Could not hand in the assignment."
      );
    } finally {
      setSubmitting(false);
    }
  }

  /* =========================================================
     TIMER
     ========================================================= */

  useEffect(() => {
    if (
      !recipient ||
      recipient.status !== "in_progress"
    ) {
      return;
    }

    expiryHandledRef.current = false;

    function calculateRemainingTime() {
      const possibleEndTimes = [];

      if (recipient.expires_at) {
        possibleEndTimes.push(
          new Date(
            recipient.expires_at
          ).getTime()
        );
      }

      if (assignment?.due_at) {
        possibleEndTimes.push(
          new Date(
            assignment.due_at
          ).getTime()
        );
      }

      if (possibleEndTimes.length === 0) {
        setSecondsLeft(null);
        return;
      }

      const endTime = Math.min(
        ...possibleEndTimes
      );

      const remaining = Math.max(
        0,
        Math.ceil(
          (endTime - Date.now()) / 1000
        )
      );

      setSecondsLeft(remaining);

      if (
        remaining <= 0 &&
        !expiryHandledRef.current
      ) {
        expiryHandledRef.current = true;

        handInAssignment(true);
      }
    }

    calculateRemainingTime();

    const interval = window.setInterval(
      calculateRemainingTime,
      1000
    );

    return () => {
      window.clearInterval(interval);
    };
  }, [
    recipient?.id,
    recipient?.status,
    recipient?.expires_at,
    assignment?.due_at,
  ]);

  /* =========================================================
     CAN EDIT?
     ========================================================= */

  function canEdit() {
    if (!recipient) {
      return false;
    }

    if (recipient.status !== "in_progress") {
      return false;
    }

    if (
      secondsLeft !== null &&
      secondsLeft <= 0
    ) {
      return false;
    }

    return true;
  }

  /* =========================================================
     LOAD PDF
     ========================================================= */

  useEffect(() => {
    if (
      !assignment?.file_path ||
      !recipient?.started_at
    ) {
      return;
    }

    let cancelled = false;

    async function loadPdf() {
      try {
        setPdfLoading(true);
        setError("");

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
          throw new Error(
            "Could not download the assignment PDF."
          );
        }

        const arrayBuffer =
          await data.arrayBuffer();

        const loadingTask =
          pdfjsLib.getDocument({
            data: new Uint8Array(
              arrayBuffer
            ),
          });

        const pdf =
          await loadingTask.promise;

        if (cancelled) {
          return;
        }

        setPdfDocument(pdf);
        setPageCount(pdf.numPages);

        setPageNumber(1);
        pageNumberRef.current = 1;
      } catch (err) {
        if (cancelled) {
          return;
        }

        console.error(
          "Could not load assignment PDF:",
          err
        );

        setError(
          err?.message ||
            "Could not load the assignment PDF."
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
  }, [
    assignment?.file_path,
    recipient?.started_at,
  ]);

  /* =========================================================
     LOAD ANNOTATIONS FOR PAGE
     ========================================================= */

  async function loadAnnotationsForPage(
    targetPage
  ) {
    if (!submission?.id) {
      return [];
    }

    try {
      const {
        data,
        error: annotationError,
      } = await supabase
        .from("assignment_annotations")
        .select(
          "id, submission_id, student_id, page_number, annotation_data, created_at, updated_at"
        )
        .eq(
          "submission_id",
          submission.id
        )
        .eq("page_number", targetPage)
        .order("created_at", {
          ascending: true,
        });

      if (annotationError) {
        throw annotationError;
      }

      return data || [];
    } catch (err) {
      console.error(
        "Could not load assignment annotations:",
        err
      );

      setError(
        err?.message ||
          "Could not load your saved answers."
      );

      return [];
    }
  }

  /* =========================================================
     LOAD RETURNED MARKING ANNOTATIONS FOR PAGE
     ========================================================= */

  async function loadMarkingAnnotationsForPage(
    targetPage
  ) {
    if (
      !recipient?.id ||
      recipient.status !== "returned"
    ) {
      return [];
    }

    try {
      const {
        data,
        error: annotationError,
      } = await supabase
        .from("assignment_marking_annotations")
        .select(
          "id, assignment_recipient_id, marker_id, page_number, annotation_data, created_at, updated_at"
        )
        .eq(
          "assignment_recipient_id",
          recipient.id
        )
        .eq("page_number", targetPage)
        .order("created_at", {
          ascending: true,
        });

      if (annotationError) {
        throw annotationError;
      }

      return data || [];
    } catch (err) {
      console.error(
        "Could not load marking annotations:",
        err
      );

      setError(
        err?.message ||
          "Could not load the marker's corrections."
      );

      return [];
    }
  }

  /* =========================================================
     RENDER PDF PAGE
     ========================================================= */

  useEffect(() => {
    if (
      !pdfDocument ||
      !submission?.id
    ) {
      return;
    }

    let cancelled = false;

    async function renderCurrentPage() {
      try {
        setPageReady(false);

        const currentPage =
          pageNumberRef.current;

        const page =
          await pdfDocument.getPage(
            currentPage
          );

        if (cancelled) {
          return;
        }

        const viewport =
          page.getViewport({
            scale: scaleRef.current,
          });

        const pdfCanvas =
          pdfCanvasRef.current;

        const drawingCanvas =
          drawingCanvasRef.current;

        const markingCanvas =
          markingCanvasRef.current;

        if (
          !pdfCanvas ||
          !drawingCanvas ||
          !markingCanvas
        ) {
          return;
        }

        const pdfContext =
          pdfCanvas.getContext("2d");

        pdfCanvas.width =
          Math.ceil(viewport.width);

        pdfCanvas.height =
          Math.ceil(viewport.height);

        drawingCanvas.width =
          Math.ceil(viewport.width);

        drawingCanvas.height =
          Math.ceil(viewport.height);

        markingCanvas.width =
          Math.ceil(viewport.width);

        markingCanvas.height =
          Math.ceil(viewport.height);

        pdfCanvas.style.width =
          `${viewport.width}px`;

        pdfCanvas.style.height =
          `${viewport.height}px`;

        drawingCanvas.style.width =
          `${viewport.width}px`;

        drawingCanvas.style.height =
          `${viewport.height}px`;

        markingCanvas.style.width =
          `${viewport.width}px`;

        markingCanvas.style.height =
          `${viewport.height}px`;

        clearDrawingCanvas();
        clearMarkingCanvas();

        await page.render({
          canvasContext: pdfContext,
          viewport,
        }).promise;

        if (cancelled) {
          return;
        }

        const [
          loaded,
          loadedMarking,
        ] = await Promise.all([
          loadAnnotationsForPage(
            currentPage
          ),
          loadMarkingAnnotationsForPage(
            currentPage
          ),
        ]);

        if (cancelled) {
          return;
        }

        setAnnotations(loaded);
        annotationsRef.current = loaded;

        setMarkingAnnotations(
          loadedMarking
        );

        drawAllAnnotations(loaded);
        drawAllMarkingAnnotations(
          loadedMarking
        );

        setPageReady(true);
      } catch (err) {
        if (cancelled) {
          return;
        }

        console.error(
          "Could not render assignment page:",
          err
        );

        setError(
          "Could not render this page."
        );
      }
    }

    renderCurrentPage();

    return () => {
      cancelled = true;
    };
  }, [
    pdfDocument,
    submission?.id,
    pageNumber,
    scale,
    recipient?.status,
  ]);

  /* =========================================================
     CLEAR DRAWING CANVAS
     ========================================================= */

  function clearDrawingCanvas() {
    const canvas =
      drawingCanvasRef.current;

    if (!canvas) {
      return;
    }

    const context =
      canvas.getContext("2d");

    context.clearRect(
      0,
      0,
      canvas.width,
      canvas.height
    );

    context.globalAlpha = 1;

    context.globalCompositeOperation =
      "source-over";
  }

  /* =========================================================
     DRAW SAVED STROKE
     ========================================================= */

  function drawStroke(
    context,
    stroke,
    canvas
  ) {
    if (
      !stroke ||
      !Array.isArray(stroke.points) ||
      stroke.points.length === 0
    ) {
      return;
    }

    const points = stroke.points;

    const currentTool =
      stroke.tool || "pen";

    const colour =
      stroke.colour || "#2563eb";

    const size =
      Number(stroke.size || 3);

    context.lineCap = "round";
    context.lineJoin = "round";

    if (currentTool === "eraser") {
      context.globalCompositeOperation =
        "destination-out";

      context.globalAlpha = 1;
      context.lineWidth = size * 5;
    } else if (
      currentTool === "highlighter"
    ) {
      context.globalCompositeOperation =
        "source-over";

      context.strokeStyle = colour;
      context.globalAlpha = 0.3;
      context.lineWidth = size * 5;
    } else {
      context.globalCompositeOperation =
        "source-over";

      context.strokeStyle = colour;
      context.globalAlpha = 1;
      context.lineWidth = size;
    }

    context.beginPath();

    const first = points[0];

    context.moveTo(
      first.x * canvas.width,
      first.y * canvas.height
    );

    for (
      let index = 1;
      index < points.length;
      index += 1
    ) {
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

    context.globalCompositeOperation =
      "source-over";
  }

  /* =========================================================
     DRAW ALL ANNOTATIONS
     ========================================================= */

  function drawAllAnnotations(
    annotationList
  ) {
    const canvas =
      drawingCanvasRef.current;

    if (!canvas) {
      return;
    }

    clearDrawingCanvas();

    const context =
      canvas.getContext("2d");

    annotationList.forEach(
      (annotation) => {
        drawStroke(
          context,
          annotation.annotation_data,
          canvas
        );
      }
    );
  }

  /* =========================================================
     RETURNED MARKING CANVAS
     ========================================================= */

  function clearMarkingCanvas() {
    const canvas =
      markingCanvasRef.current;

    if (!canvas) {
      return;
    }

    const context =
      canvas.getContext("2d");

    context.clearRect(
      0,
      0,
      canvas.width,
      canvas.height
    );

    context.globalAlpha = 1;

    context.globalCompositeOperation =
      "source-over";
  }

  function drawAllMarkingAnnotations(
    annotationList
  ) {
    const canvas =
      markingCanvasRef.current;

    if (!canvas) {
      return;
    }

    clearMarkingCanvas();

    const context =
      canvas.getContext("2d");

    annotationList.forEach(
      (annotation) => {
        drawStroke(
          context,
          annotation.annotation_data,
          canvas
        );
      }
    );
  }

  /* =========================================================
     POINTER POSITION
     ========================================================= */

  function getPointerPosition(event) {
    const canvas =
      drawingCanvasRef.current;

    if (!canvas) {
      return null;
    }

    const rect =
      canvas.getBoundingClientRect();

    if (
      rect.width === 0 ||
      rect.height === 0
    ) {
      return null;
    }

    return {
      x:
        (event.clientX - rect.left) *
        (canvas.width / rect.width),

      y:
        (event.clientY - rect.top) *
        (canvas.height / rect.height),
    };
  }

  /* =========================================================
     CONFIGURE DRAWING TOOL
     ========================================================= */

  function configureContext(context) {
    context.lineCap = "round";
    context.lineJoin = "round";

    if (tool === "eraser") {
      context.globalCompositeOperation =
        "destination-out";

      context.globalAlpha = 1;

      context.lineWidth =
        penSize * 5;
    } else if (
      tool === "highlighter"
    ) {
      context.globalCompositeOperation =
        "source-over";

      context.strokeStyle =
        penColour;

      context.globalAlpha = 0.3;

      context.lineWidth =
        penSize * 5;
    } else {
      context.globalCompositeOperation =
        "source-over";

      context.strokeStyle =
        penColour;

      context.globalAlpha = 1;

      context.lineWidth =
        penSize;
    }
  }

  /* =========================================================
     START DRAWING
     ========================================================= */

  function startDrawing(event) {
    if (
      !pageReady ||
      !canEdit()
    ) {
      return;
    }

    event.preventDefault();

    const position =
      getPointerPosition(event);

    const canvas =
      drawingCanvasRef.current;

    if (
      !position ||
      !canvas
    ) {
      return;
    }

    try {
      canvas.setPointerCapture(
        event.pointerId
      );
    } catch {
      // Pointer capture is optional.
    }

    const normalizedPoint = {
      x:
        position.x /
        canvas.width,

      y:
        position.y /
        canvas.height,
    };

    currentStrokeRef.current = {
      tool,
      colour: penColour,
      size: penSize,

      points: [
        normalizedPoint,
      ],
    };

    drawingRef.current = true;

    const context =
      canvas.getContext("2d");

    configureContext(context);

    context.beginPath();

    context.moveTo(
      position.x,
      position.y
    );
  }

  /* =========================================================
     DRAW
     ========================================================= */

  function draw(event) {
    if (
      !drawingRef.current ||
      !canEdit()
    ) {
      return;
    }

    event.preventDefault();

    const position =
      getPointerPosition(event);

    const canvas =
      drawingCanvasRef.current;

    if (
      !position ||
      !canvas
    ) {
      return;
    }

    const context =
      canvas.getContext("2d");

    configureContext(context);

    context.lineTo(
      position.x,
      position.y
    );

    context.stroke();

    context.beginPath();

    context.moveTo(
      position.x,
      position.y
    );

    const normalizedPoint = {
      x:
        position.x /
        canvas.width,

      y:
        position.y /
        canvas.height,
    };

    if (currentStrokeRef.current) {
      currentStrokeRef.current.points.push(
        normalizedPoint
      );
    }
  }

  /* =========================================================
     STOP DRAWING
     ========================================================= */

  async function stopDrawing() {
    if (!drawingRef.current) {
      return;
    }

    drawingRef.current = false;

    const stroke =
      currentStrokeRef.current;

    currentStrokeRef.current = null;

    const canvas =
      drawingCanvasRef.current;

    if (canvas) {
      const context =
        canvas.getContext("2d");

      context.beginPath();

      context.globalAlpha = 1;

      context.globalCompositeOperation =
        "source-over";
    }

    if (
      !stroke ||
      !stroke.points?.length
    ) {
      return;
    }

    if (!canEdit()) {
      drawAllAnnotations(
        annotationsRef.current
      );

      return;
    }

    await saveStroke(stroke);
  }

  /* =========================================================
     SAVE STROKE
     ========================================================= */

  async function saveStroke(stroke) {
    if (
      !submission?.id ||
      !canEdit()
    ) {
      return;
    }

    try {
      setSaving(true);
      setError("");

      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError || !user) {
        throw new Error(
          "You must be logged in."
        );
      }

      const {
        data,
        error: insertError,
      } = await supabase
        .from("assignment_annotations")
        .insert({
          submission_id:
            submission.id,

          student_id:
            user.id,

          page_number:
            pageNumberRef.current,

          annotation_data:
            stroke,
        })
        .select(
          "id, submission_id, student_id, page_number, annotation_data, created_at, updated_at"
        )
        .single();

      if (insertError) {
        throw insertError;
      }

      setAnnotations(
        (current) => [
          ...current,
          data,
        ]
      );

      annotationsRef.current = [
        ...annotationsRef.current,
        data,
      ];
    } catch (err) {
      console.error(
        "Could not save answer:",
        err
      );

      setError(
        err?.message ||
          "Could not save your answer."
      );

      /*
       * If Supabase rejected the write
       * because time expired, redraw only
       * the strokes that were actually saved.
       */

      drawAllAnnotations(
        annotationsRef.current
      );
    } finally {
      setSaving(false);
    }
  }

  /* =========================================================
     UNDO
     ========================================================= */

  async function undo() {
    if (
      !canEdit() ||
      annotationsRef.current.length === 0
    ) {
      return;
    }

    const latest =
      annotationsRef.current[
        annotationsRef.current.length - 1
      ];

    try {
      setSaving(true);
      setError("");

      const {
        error: deleteError,
      } = await supabase
        .from("assignment_annotations")
        .delete()
        .eq("id", latest.id);

      if (deleteError) {
        throw deleteError;
      }

      const remaining =
        annotationsRef.current.filter(
          (annotation) =>
            annotation.id !== latest.id
        );

      setAnnotations(remaining);

      annotationsRef.current =
        remaining;

      drawAllAnnotations(remaining);
    } catch (err) {
      console.error(
        "Could not undo:",
        err
      );

      setError(
        "Could not undo that answer."
      );
    } finally {
      setSaving(false);
    }
  }

  /* =========================================================
     CLEAR PAGE
     ========================================================= */

  async function clearPage() {
    if (
      !canEdit() ||
      annotationsRef.current.length === 0
    ) {
      return;
    }

    const confirmed =
      window.confirm(
        "Clear all of your writing from this page?"
      );

    if (!confirmed) {
      return;
    }

    try {
      setSaving(true);
      setError("");

      const ids =
        annotationsRef.current.map(
          (annotation) =>
            annotation.id
        );

      const {
        error: deleteError,
      } = await supabase
        .from("assignment_annotations")
        .delete()
        .in("id", ids);

      if (deleteError) {
        throw deleteError;
      }

      setAnnotations([]);

      annotationsRef.current = [];

      clearDrawingCanvas();
    } catch (err) {
      console.error(
        "Could not clear page:",
        err
      );

      setError(
        "Could not clear this page."
      );
    } finally {
      setSaving(false);
    }
  }

  /* =========================================================
     PAGE CONTROLS
     ========================================================= */

  function previousPage() {
    if (pageNumber <= 1) {
      return;
    }

    setPageNumber(
      pageNumber - 1
    );
  }

  function nextPage() {
    if (
      pageNumber >= pageCount
    ) {
      return;
    }

    setPageNumber(
      pageNumber + 1
    );
  }

  /* =========================================================
     ZOOM
     ========================================================= */

  function zoomIn() {
    setScale((value) => {
      const newValue =
        Math.min(
          3,
          value + 0.15
        );

      scaleRef.current =
        newValue;

      return newValue;
    });
  }

  function zoomOut() {
    setScale((value) => {
      const newValue =
        Math.max(
          0.5,
          value - 0.15
        );

      scaleRef.current =
        newValue;

      return newValue;
    });
  }

  /* =========================================================
     FORMATTING
     ========================================================= */

  function formatDate(value) {
    if (!value) {
      return "No deadline";
    }

    return new Date(
      value
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

  function formatTimer(value) {
    if (value === null) {
      return "";
    }

    const hours =
      Math.floor(
        value / 3600
      );

    const minutes =
      Math.floor(
        (value % 3600) / 60
      );

    const seconds =
      value % 60;

    if (hours > 0) {
      return `${String(
        hours
      ).padStart(
        2,
        "0"
      )}:${String(
        minutes
      ).padStart(
        2,
        "0"
      )}:${String(
        seconds
      ).padStart(
        2,
        "0"
      )}`;
    }

    return `${String(
      minutes
    ).padStart(
      2,
      "0"
    )}:${String(
      seconds
    ).padStart(
      2,
      "0"
    )}`;
  }

  /* =========================================================
     LOADING
     ========================================================= */

  if (loading) {
    return (
      <div style={centreCard}>
        <div style={{ fontSize: "38px" }}>
          📝
        </div>

        <h2>
          Opening assignment...
        </h2>

        <p>
          Loading your private attempt.
        </p>
      </div>
    );
  }

  /* =========================================================
     ERROR
     ========================================================= */

  if (
    !recipient ||
    !assignment
  ) {
    return (
      <div style={centreCard}>
        <div style={{ fontSize: "38px" }}>
          ⚠️
        </div>

        <h2>
          Assignment unavailable
        </h2>

        <p>
          {error ||
            "This assignment could not be opened."}
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
     START SCREEN
     ========================================================= */

  if (
    !recipient.started_at &&
    recipient.status === "assigned"
  ) {
    return (
      <div
        style={{
          maxWidth: "800px",
          margin: "0 auto",
          padding: "20px",
        }}
      >
        <button
          type="button"
          onClick={onBack}
          style={secondaryButton}
        >
          ← Back to Assignments
        </button>

        <div style={startCard}>
          <div
            style={{
              fontSize: "48px",
            }}
          >
            📝
          </div>

          <div style={eyebrow}>
            ASSIGNMENT READY
          </div>

          <h1
            style={{
              margin:
                "5px 0 10px",
            }}
          >
            {assignment.title}
          </h1>

          {assignment.instructions && (
            <div style={instructionsBox}>
              <strong>
                Instructions
              </strong>

              <p
                style={{
                  margin:
                    "7px 0 0",
                  whiteSpace:
                    "pre-wrap",
                  lineHeight: 1.6,
                }}
              >
                {
                  assignment.instructions
                }
              </p>
            </div>
          )}

          <div style={infoGrid}>
            <InfoCard
              icon="📄"
              label="Paper"
              value={
                assignment.file_name ||
                "Assignment PDF"
              }
            />

            <InfoCard
              icon="⏱️"
              label="Time allowed"
              value={
                assignment.duration_minutes
                  ? `${assignment.duration_minutes} minutes`
                  : "Untimed"
              }
            />

            <InfoCard
              icon="📅"
              label="Deadline"
              value={formatDate(
                assignment.due_at
              )}
            />
          </div>

          {assignment.duration_minutes && (
            <div style={timerWarning}>
              <strong>
                ⏱️ Important
              </strong>

              <p
                style={{
                  margin:
                    "6px 0 0",
                }}
              >
                Your timer begins
                permanently when you
                press Start Assignment.
                Refreshing, closing the
                browser or signing in on
                another device will not
                reset it.
              </p>
            </div>
          )}

          {error && (
            <div style={errorBox}>
              {error}
            </div>
          )}

          <button
            type="button"
            onClick={startAssignment}
            disabled={starting}
            style={{
              ...primaryButton,
              width: "100%",
              marginTop: "15px",
              padding: "14px",
              fontSize: "16px",
            }}
          >
            {starting
              ? "Starting..."
              : "Start Assignment →"}
          </button>
        </div>
      </div>
    );
  }

  /* =========================================================
     WORKSPACE
     ========================================================= */

  const locked =
    recipient.status ===
      "submitted" ||
    recipient.status ===
      "returned";

  return (
    <div style={workspace}>
      {/* =====================================================
          TOP TOOLBAR
          ===================================================== */}

      <div style={toolbar}>
        <div style={toolbarGroup}>
          <button
            type="button"
            onClick={onBack}
            style={secondaryButton}
          >
            ← Back
          </button>

          <div>
            <strong>
              {assignment.title}
            </strong>

            <div style={smallText}>
              Page {pageNumber} of{" "}
              {pageCount || "..."}
            </div>
          </div>
        </div>

        <div style={toolbarGroup}>
          <button
            type="button"
            onClick={() =>
              setTool("pen")
            }
            disabled={locked}
            style={toolButton(
              tool === "pen"
            )}
          >
            ✏️ Pen
          </button>

          <button
            type="button"
            onClick={() =>
              setTool(
                "highlighter"
              )
            }
            disabled={locked}
            style={toolButton(
              tool ===
                "highlighter"
            )}
          >
            🖍️ Highlighter
          </button>

          <button
            type="button"
            onClick={() =>
              setTool("eraser")
            }
            disabled={locked}
            style={toolButton(
              tool === "eraser"
            )}
          >
            🧽 Eraser
          </button>

          <button
            type="button"
            onClick={undo}
            disabled={
              locked ||
              annotations.length === 0
            }
            style={secondaryButton}
          >
            ↩️ Undo
          </button>

          <button
            type="button"
            onClick={clearPage}
            disabled={
              locked ||
              annotations.length === 0
            }
            style={secondaryButton}
          >
            🗑️ Clear
          </button>
        </div>

        <div style={toolbarGroup}>
          <button
            type="button"
            onClick={zoomOut}
            style={secondaryButton}
          >
            −
          </button>

          <span>
            {Math.round(
              scale * 100
            )}
            %
          </span>

          <button
            type="button"
            onClick={zoomIn}
            style={secondaryButton}
          >
            +
          </button>

          <span style={smallText}>
            {saving
              ? "Saving..."
              : "✓ Saved"}
          </span>
        </div>
      </div>

      {/* =====================================================
          EXAM STATUS BAR
          ===================================================== */}

      <div style={examBar}>
        <div>
          <strong>
            {locked
              ? recipient.status ===
                "returned"
                ? "✅ Assignment returned"
                : "📤 Assignment handed in"
              : "✍️ Assignment in progress"}
          </strong>

          <div style={smallText}>
            Deadline:{" "}
            {formatDate(
              assignment.due_at
            )}
          </div>
        </div>

        {secondsLeft !== null &&
          !locked && (
            <div
              style={timerDisplay(
                secondsLeft <= 300
              )}
            >
              ⏱️{" "}
              {formatTimer(
                secondsLeft
              )}
            </div>
          )}

        {!locked && (
          <button
            type="button"
            onClick={() =>
              handInAssignment(
                false
              )
            }
            disabled={
              submitting ||
              saving
            }
            style={handInButton}
          >
            {submitting
              ? "Handing in..."
              : "Hand In Assignment"}
          </button>
        )}
      </div>

      {/* =====================================================
          RETURNED RESULT
          ===================================================== */}

      {recipient.status === "returned" && (
        <div style={resultCard}>
          <div style={resultHeader}>
            <div>
              <div style={resultEyebrow}>
                MARKING COMPLETE
              </div>

              <h2 style={resultTitle}>
                Your result
              </h2>
            </div>

            <div style={returnedBadge}>
              ✅ Returned
            </div>
          </div>

          {returnedFeedback ? (
            <>
              <div style={resultStats}>
                <ResultStat
                  label="Mark"
                  value={
                    returnedFeedback.mark !== null &&
                    returnedFeedback.mark !== undefined
                      ? returnedFeedback.mark_out_of !== null &&
                        returnedFeedback.mark_out_of !== undefined
                        ? `${returnedFeedback.mark} / ${returnedFeedback.mark_out_of}`
                        : String(returnedFeedback.mark)
                      : "—"
                  }
                />

                <ResultStat
                  label="Percentage"
                  value={
                    returnedFeedback.mark !== null &&
                    returnedFeedback.mark !== undefined &&
                    returnedFeedback.mark_out_of
                      ? `${(
                          (Number(returnedFeedback.mark) /
                            Number(returnedFeedback.mark_out_of)) *
                          100
                        ).toFixed(1)}%`
                      : "—"
                  }
                />

                <ResultStat
                  label="Grade"
                  value={
                    returnedFeedback.grade ||
                    "—"
                  }
                />
              </div>

              <div style={feedbackBox}>
                <strong>
                  Marker feedback
                </strong>

                <p style={feedbackText}>
                  {returnedFeedback.feedback ||
                    "No written feedback was added."}
                </p>
              </div>

              <div style={correctionNote}>
                🖊️ The marker's corrections are shown
                directly over your submitted paper below.
              </div>
            </>
          ) : (
            <div style={feedbackBox}>
              Your assignment has been returned, but no
              mark or written feedback has been added.
            </div>
          )}
        </div>
      )}

      {/* =====================================================
          LOCKED BANNER
          ===================================================== */}

      {locked && (
        <div style={lockedBanner}>
          🔒 This attempt is
          locked. Your submitted
          answers are read-only.
        </div>
      )}

      {/* =====================================================
          ERROR
          ===================================================== */}

      {error && (
        <div
          style={{
            ...errorBox,
            margin: "14px",
          }}
        >
          {error}
        </div>
      )}

      {/* =====================================================
          PDF
          ===================================================== */}

      {pdfLoading ? (
        <div style={centreCard}>
          <div
            style={{
              fontSize: "35px",
            }}
          >
            📄
          </div>

          <h3>
            Opening your paper...
          </h3>
        </div>
      ) : (
        <>
          <PageControls
            pageNumber={pageNumber}
            pageCount={pageCount}
            previousPage={
              previousPage
            }
            nextPage={nextPage}
          />

          <div style={canvasArea}>
            <div
              style={{
                position:
                  "relative",
                display:
                  "inline-block",
                boxShadow:
                  "0 8px 30px rgba(15, 23, 42, 0.15)",
              }}
            >
              <canvas
                ref={pdfCanvasRef}
                style={{
                  display: "block",
                  background:
                    "#ffffff",
                }}
              />

              <canvas
                ref={
                  drawingCanvasRef
                }
                onPointerDown={
                  startDrawing
                }
                onPointerMove={draw}
                onPointerUp={
                  stopDrawing
                }
                onPointerCancel={
                  stopDrawing
                }
                onPointerLeave={
                  stopDrawing
                }
                style={{
                  position:
                    "absolute",
                  inset: 0,
                  touchAction:
                    "none",

                  cursor: locked
                    ? "default"
                    : tool ===
                        "eraser"
                      ? "cell"
                      : "crosshair",

                  pointerEvents:
                    locked
                      ? "none"
                      : "auto",
                }}
              />

              <canvas
                ref={
                  markingCanvasRef
                }
                style={{
                  position:
                    "absolute",
                  inset: 0,
                  pointerEvents:
                    "none",
                }}
              />
            </div>
          </div>

          <PageControls
            pageNumber={pageNumber}
            pageCount={pageCount}
            previousPage={
              previousPage
            }
            nextPage={nextPage}
          />
        </>
      )}
    </div>
  );
}

/* ===========================================================
   SMALL COMPONENTS
   =========================================================== */

function InfoCard({
  icon,
  label,
  value,
}) {
  return (
    <div style={infoCard}>
      <div
        style={{
          fontSize: "23px",
        }}
      >
        {icon}
      </div>

      <div style={smallText}>
        {label}
      </div>

      <strong>
        {value}
      </strong>
    </div>
  );
}

function ResultStat({
  label,
  value,
}) {
  return (
    <div style={resultStat}>
      <div style={smallText}>
        {label}
      </div>

      <strong style={resultStatValue}>
        {value}
      </strong>
    </div>
  );
}

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
        Page {pageNumber} /{" "}
        {pageCount || "..."}
      </strong>

      <button
        type="button"
        onClick={nextPage}
        disabled={
          pageNumber >= pageCount
        }
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

const toolbar = {
  position: "sticky",
  top: 0,
  zIndex: 50,

  display: "flex",
  alignItems: "center",
  justifyContent:
    "space-between",

  gap: "12px",

  padding: "12px 16px",

  background: "#ffffff",

  borderBottom:
    "1px solid #dfe3e8",

  flexWrap: "wrap",
};

const toolbarGroup = {
  display: "flex",
  alignItems: "center",
  gap: "8px",
  flexWrap: "wrap",
};

const examBar = {
  display: "flex",
  alignItems: "center",

  justifyContent:
    "space-between",

  gap: "15px",

  padding: "12px 18px",

  background: "#f5f3ff",

  borderBottom:
    "1px solid #ddd6fe",

  flexWrap: "wrap",
};

const canvasArea = {
  overflow: "auto",

  padding: "20px",

  textAlign: "center",
};

const pageControls = {
  display: "flex",

  justifyContent:
    "center",

  alignItems: "center",

  gap: "15px",

  padding: "14px",

  flexWrap: "wrap",
};

const centreCard = {
  padding: "40px 20px",

  textAlign: "center",

  color: "#475569",
};

const startCard = {
  marginTop: "18px",

  padding: "28px",

  borderRadius: "22px",

  background: "#ffffff",

  border:
    "1px solid #e5e7eb",

  boxShadow:
    "0 12px 35px rgba(15, 23, 42, 0.08)",
};

const eyebrow = {
  marginTop: "10px",

  color: "#7c3aed",

  fontSize: "12px",

  fontWeight: 900,

  letterSpacing: "0.08em",
};

const instructionsBox = {
  marginTop: "18px",

  padding: "15px",

  borderRadius: "13px",

  background: "#f8fafc",

  color: "#475569",
};

const infoGrid = {
  display: "grid",

  gridTemplateColumns:
    "repeat(auto-fit, minmax(160px, 1fr))",

  gap: "10px",

  margin: "20px 0",
};

const infoCard = {
  padding: "15px",

  borderRadius: "13px",

  background: "#f8fafc",

  display: "grid",

  gap: "5px",
};

const timerWarning = {
  padding: "15px",

  borderRadius: "13px",

  background: "#fff7ed",

  border:
    "1px solid #fed7aa",

  color: "#9a3412",
};

const resultCard = {
  margin: "16px",

  padding: "20px",

  borderRadius: "18px",

  background: "#ffffff",

  border:
    "1px solid #c4b5fd",

  boxShadow:
    "0 8px 24px rgba(91, 33, 182, 0.08)",
};

const resultHeader = {
  display: "flex",

  alignItems: "center",

  justifyContent:
    "space-between",

  gap: "12px",

  flexWrap: "wrap",
};

const resultEyebrow = {
  color: "#7c3aed",

  fontSize: "11px",

  fontWeight: 900,

  letterSpacing: "0.08em",
};

const resultTitle = {
  margin: "4px 0 0",
};

const returnedBadge = {
  padding: "7px 11px",

  borderRadius: "999px",

  background: "#dcfce7",

  color: "#166534",

  fontSize: "12px",

  fontWeight: 900,
};

const resultStats = {
  display: "grid",

  gridTemplateColumns:
    "repeat(auto-fit, minmax(130px, 1fr))",

  gap: "10px",

  marginTop: "16px",
};

const resultStat = {
  padding: "14px",

  borderRadius: "13px",

  background: "#f5f3ff",

  border:
    "1px solid #ddd6fe",
};

const resultStatValue = {
  display: "block",

  marginTop: "5px",

  color: "#5b21b6",

  fontSize: "22px",
};

const feedbackBox = {
  marginTop: "14px",

  padding: "15px",

  borderRadius: "13px",

  background: "#f8fafc",

  color: "#334155",

  lineHeight: 1.6,
};

const feedbackText = {
  margin: "7px 0 0",

  whiteSpace: "pre-wrap",
};

const correctionNote = {
  marginTop: "12px",

  padding: "11px 13px",

  borderRadius: "11px",

  background: "#fff7ed",

  color: "#9a3412",

  fontSize: "13px",

  fontWeight: 700,
};

const errorBox = {
  padding: "12px",

  borderRadius: "11px",

  background: "#fef2f2",

  border:
    "1px solid #fecaca",

  color: "#b91c1c",

  marginTop: "14px",
};

const lockedBanner = {
  padding: "12px",

  textAlign: "center",

  background: "#ecfdf5",

  color: "#166534",

  fontWeight: 800,

  borderBottom:
    "1px solid #bbf7d0",
};

const smallText = {
  marginTop: "3px",

  color: "#64748b",

  fontSize: "12px",
};

const primaryButton = {
  border: "none",

  borderRadius: "11px",

  padding: "10px 16px",

  background: "#7c3aed",

  color: "#ffffff",

  fontWeight: 900,

  cursor: "pointer",
};

const secondaryButton = {
  border:
    "1px solid #dbe1e8",

  borderRadius: "9px",

  padding: "8px 11px",

  background: "#ffffff",

  color: "#334155",

  fontWeight: 700,

  cursor: "pointer",
};

const handInButton = {
  border: "none",

  borderRadius: "11px",

  padding: "11px 17px",

  background: "#16a34a",

  color: "#ffffff",

  fontWeight: 900,

  cursor: "pointer",
};

function toolButton(active) {
  return {
    ...secondaryButton,

    background: active
      ? "#ede9fe"
      : "#ffffff",

    border: active
      ? "1px solid #8b5cf6"
      : "1px solid #dbe1e8",

    color: active
      ? "#6d28d9"
      : "#334155",
  };
}

function timerDisplay(urgent) {
  return {
    padding: "9px 15px",

    borderRadius: "11px",

    background: urgent
      ? "#fee2e2"
      : "#ede9fe",

    color: urgent
      ? "#b91c1c"
      : "#5b21b6",

    fontWeight: 900,

    fontSize: "18px",

    fontVariantNumeric:
      "tabular-nums",
  };
}

export default AssignmentWorkspace;