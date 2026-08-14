import {
  useEffect,
  useRef,
  useState,
} from "react";

import { supabase } from "../lib/supabase";

import * as pdfjsLib from "pdfjs-dist";
import pdfWorker from "pdfjs-dist/build/pdf.worker.min.mjs?url";

pdfjsLib.GlobalWorkerOptions.workerSrc =
  pdfWorker;

function PaperWorkspace({ paper, setPage }) {
  /* =========================================================
     REFS
     ========================================================= */

  const pdfCanvasRef = useRef(null);
  const drawingCanvasRef = useRef(null);

  const collaborationChannelRef = useRef(null);
  const roomRef = useRef(null);

  const clientIdRef = useRef(
    `${Date.now()}-${Math.random()
      .toString(36)
      .slice(2)}`
  );

  const drawingRef = useRef(false);
  const currentStrokeRef = useRef(null);

  const toolRef = useRef("pen");
  const penColourRef = useRef("#2563eb");
  const penSizeRef = useRef(3);

  const pageNumberRef = useRef(1);
  const scaleRef = useRef(1.25);

  const collaboratingRef = useRef(false);
  const collaborationStatusRef = useRef("offline");

  const annotationsRef = useRef([]);

  /* =========================================================
     PDF STATE
     ========================================================= */

  const [pdfDocument, setPdfDocument] = useState(null);
  const [pageNumber, setPageNumber] = useState(1);
  const [pageCount, setPageCount] = useState(0);
  const [scale, setScale] = useState(1.25);

  const [loading, setLoading] = useState(true);
  const [pageReady, setPageReady] = useState(false);
  const [error, setError] = useState("");

  /* =========================================================
     DRAWING STATE
     ========================================================= */

  const [tool, setTool] = useState("pen");
  const [penColour, setPenColour] = useState("#2563eb");
  const [penSize, setPenSize] = useState(3);
  const [drawing, setDrawing] = useState(false);
  const [saving, setSaving] = useState(false);

  /* =========================================================
     ANNOTATIONS
     ========================================================= */

  const [annotations, setAnnotations] = useState([]);

  /* =========================================================
     COLLABORATION
     ========================================================= */

  const [collaborating, setCollaborating] = useState(false);

  const [
    collaborationStatus,
    setCollaborationStatus,
  ] = useState("offline");

  const [participantCount, setParticipantCount] =
    useState(0);

  const [participantIds, setParticipantIds] =
    useState([]);

  const [roomCode, setRoomCode] = useState("");
  const [roomLoading, setRoomLoading] = useState(false);

  /* =========================================================
     FRIEND INVITATIONS
     ========================================================= */

  const [friends, setFriends] = useState([]);

  const [
    showInviteFriends,
    setShowInviteFriends,
  ] = useState(false);

  const [inviteLoading, setInviteLoading] =
    useState(null);

  const [invitedFriends, setInvitedFriends] =
    useState([]);

  /* =========================================================
     KEEP REFS SYNCHRONISED
     ========================================================= */

  useEffect(() => {
    toolRef.current = tool;
  }, [tool]);

  useEffect(() => {
    penColourRef.current = penColour;
  }, [penColour]);

  useEffect(() => {
    penSizeRef.current = penSize;
  }, [penSize]);

  useEffect(() => {
    pageNumberRef.current = pageNumber;
  }, [pageNumber]);

  useEffect(() => {
    scaleRef.current = scale;
  }, [scale]);

  useEffect(() => {
    collaboratingRef.current = collaborating;
  }, [collaborating]);

  useEffect(() => {
    collaborationStatusRef.current =
      collaborationStatus;
  }, [collaborationStatus]);

  useEffect(() => {
    annotationsRef.current = annotations;
  }, [annotations]);

  /* =========================================================
     LOAD FRIENDS
     ========================================================= */

  async function loadFriends() {
    try {
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError || !user) {
        return;
      }

      const {
        data: acceptedRequests,
        error: requestError,
      } = await supabase
        .from("friend_requests")
        .select(
          "id, sender_id, receiver_id, status"
        )
        .or(
          `sender_id.eq.${user.id},receiver_id.eq.${user.id}`
        )
        .eq("status", "accepted");

      if (requestError) {
        throw requestError;
      }

      const friendIds = [];

      (acceptedRequests || []).forEach(
        (request) => {
          if (request.sender_id === user.id) {
            friendIds.push(request.receiver_id);
          }

          if (request.receiver_id === user.id) {
            friendIds.push(request.sender_id);
          }
        }
      );

      if (friendIds.length === 0) {
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
        .in("id", friendIds)
        .order("full_name");

      if (profileError) {
        throw profileError;
      }

      setFriends(profiles || []);
    } catch (err) {
      console.error(
        "Could not load friends:",
        err
      );

      setError(
        "Could not load your friends."
      );
    }
  }

  useEffect(() => {
    loadFriends();
  }, []);

  /* =========================================================
     ROOM CODE
     ========================================================= */

  function generateRoomCode() {
    return Math.random()
      .toString(36)
      .substring(2, 8)
      .toUpperCase();
  }

  /* =========================================================
     GET OR CREATE ROOM
     ========================================================= */

  async function getOrCreateRoom() {
    if (!paper?.id) {
      throw new Error(
        "No past paper was selected."
      );
    }

    setRoomLoading(true);

    try {
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError || !user) {
        throw new Error(
          "You must be logged in to collaborate."
        );
      }

      const {
        data: existingRoom,
        error: existingRoomError,
      } = await supabase
        .from("past_paper_rooms")
        .select("*")
        .eq("paper_id", paper.id)
        .maybeSingle();

      if (existingRoomError) {
        throw existingRoomError;
      }

      if (existingRoom) {
        roomRef.current = existingRoom;
        setRoomCode(existingRoom.room_code);
        return existingRoom;
      }

      let newRoom = null;
      let attempts = 0;

      while (!newRoom && attempts < 5) {
        attempts += 1;

        const generatedCode =
          generateRoomCode();

        const {
          data,
          error: createError,
        } = await supabase
          .from("past_paper_rooms")
          .insert({
            paper_id: paper.id,
            room_code: generatedCode,
            created_by: user.id,
          })
          .select("*")
          .single();

        if (!createError) {
          newRoom = data;
          break;
        }

        if (createError.code !== "23505") {
          throw createError;
        }
      }

      if (!newRoom) {
        throw new Error(
          "Could not create a collaboration room."
        );
      }

      roomRef.current = newRoom;
      setRoomCode(newRoom.room_code);

      return newRoom;
    } finally {
      setRoomLoading(false);
    }
  }

  /* =========================================================
     INVITE FRIEND
     ========================================================= */

  async function inviteFriend(friendId) {
    if (!roomRef.current?.id) {
      setError(
        "Start the live room before inviting friends."
      );

      return;
    }

    try {
      setInviteLoading(friendId);
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
        data: existingInvitation,
        error: existingError,
      } = await supabase
        .from("past_paper_invitations")
        .select("id, status")
        .eq(
          "room_id",
          roomRef.current.id
        )
        .eq("receiver_id", friendId)
        .maybeSingle();

      if (existingError) {
        throw existingError;
      }

      if (existingInvitation) {
        const { error: updateError } =
          await supabase
            .from("past_paper_invitations")
            .update({
              sender_id: user.id,
              status: "pending",
            })
            .eq(
              "id",
              existingInvitation.id
            );

        if (updateError) {
          throw updateError;
        }
      } else {
        const { error: invitationError } =
          await supabase
            .from("past_paper_invitations")
            .insert({
              room_id: roomRef.current.id,
              sender_id: user.id,
              receiver_id: friendId,
              status: "pending",
            });

        if (invitationError) {
          throw invitationError;
        }
      }

      setInvitedFriends((current) => {
        if (current.includes(friendId)) {
          return current;
        }

        return [...current, friendId];
      });

      setTimeout(() => {
        setInvitedFriends((current) =>
          current.filter(
            (id) => id !== friendId
          )
        );
      }, 2000);
    } catch (err) {
      console.error(
        "Could not invite friend:",
        err
      );

      setError(
        err.message ||
          "Could not send invitation."
      );
    } finally {
      setInviteLoading(null);
    }
  }

  /* =========================================================
     LOAD PDF
     ========================================================= */

  useEffect(() => {
    let cancelled = false;

    async function loadPaper() {
      try {
        setLoading(true);
        setError("");
        setPageReady(false);

        const {
          data,
          error: downloadError,
        } = await supabase.storage
          .from("past-papers")
          .download(paper.file_path);

        if (downloadError) {
          throw downloadError;
        }

        if (!data) {
          throw new Error(
            "Could not download this PDF."
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

        if (!pdf || pdf.numPages < 1) {
          throw new Error(
            "This PDF does not contain any pages."
          );
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
          "Could not load PDF:",
          err
        );

        setError(
          err?.message ||
            "Could not load the PDF."
        );
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    loadPaper();

    return () => {
      cancelled = true;
    };
  }, [paper.id, paper.file_path]);

  /* =========================================================
     REALTIME CHANNEL
     ========================================================= */

  useEffect(() => {
    if (!paper?.id) {
      return;
    }

    const channelName =
      `past-paper-${paper.id}`;

    const channel = supabase.channel(
      channelName,
      {
        config: {
          broadcast: {
            self: false,
          },

          presence: {
            key: clientIdRef.current,
          },
        },
      }
    );

    collaborationChannelRef.current =
      channel;

    /* -------------------------------------------------------
       REMOTE STROKE
       ------------------------------------------------------- */

    channel.on(
      "broadcast",
      { event: "draw" },
      ({ payload }) => {
        if (!payload) {
          return;
        }

        if (
          payload.clientId ===
          clientIdRef.current
        ) {
          return;
        }

        if (
          Number(payload.pageNumber) !==
          pageNumberRef.current
        ) {
          return;
        }

        drawRemoteStroke(payload);
      }
    );

    /* -------------------------------------------------------
       REMOTE STROKE COMPLETE
       ------------------------------------------------------- */

    channel.on(
      "broadcast",
      { event: "stroke-created" },
      ({ payload }) => {
        if (!payload) {
          return;
        }

        if (
          payload.clientId ===
          clientIdRef.current
        ) {
          return;
        }

        if (
          Number(payload.pageNumber) !==
          pageNumberRef.current
        ) {
          return;
        }

        if (!payload.annotation) {
          return;
        }

        addRemoteAnnotation(
          payload.annotation
        );
      }
    );

    /* -------------------------------------------------------
       REMOTE DELETE
       ------------------------------------------------------- */

    channel.on(
      "broadcast",
      { event: "annotation-deleted" },
      ({ payload }) => {
        if (!payload) {
          return;
        }

        if (
          payload.clientId ===
          clientIdRef.current
        ) {
          return;
        }

        removeAnnotationLocally(
          payload.annotationId
        );
      }
    );

    /* -------------------------------------------------------
       REMOTE CLEAR
       ------------------------------------------------------- */

    channel.on(
      "broadcast",
      { event: "annotations-cleared" },
      ({ payload }) => {
        if (!payload) {
          return;
        }

        if (
          payload.clientId ===
          clientIdRef.current
        ) {
          return;
        }

        const deletedIds =
          payload.annotationIds || [];

        if (deletedIds.length === 0) {
          return;
        }

        setAnnotations((current) =>
          current.filter(
            (annotation) =>
              !deletedIds.includes(
                annotation.id
              )
          )
        );

        annotationsRef.current =
          annotationsRef.current.filter(
            (annotation) =>
              !deletedIds.includes(
                annotation.id
              )
          );

        setTimeout(() => {
          drawAllAnnotations(
            annotationsRef.current
          );
        }, 0);
      }
    );

    /* -------------------------------------------------------
       REMOTE PAGE CHANGE
       ------------------------------------------------------- */

    channel.on(
      "broadcast",
      { event: "page-change" },
      ({ payload }) => {
        if (!payload) {
          return;
        }

        if (
          payload.clientId ===
          clientIdRef.current
        ) {
          return;
        }

        const newPage =
          Number(payload.pageNumber);

        if (
          !Number.isInteger(newPage) ||
          newPage < 1 ||
          newPage > pageCount
        ) {
          return;
        }

        setPageNumber(newPage);
        pageNumberRef.current =
          newPage;
      }
    );

    /* -------------------------------------------------------
       PRESENCE
       ------------------------------------------------------- */

    channel.on(
      "presence",
      { event: "sync" },
      () => {
        updatePresenceCount(channel);
      }
    );

    channel.on(
      "presence",
      { event: "join" },
      () => {
        updatePresenceCount(channel);
      }
    );

    channel.on(
      "presence",
      { event: "leave" },
      () => {
        updatePresenceCount(channel);
      }
    );

    /* -------------------------------------------------------
       SUBSCRIBE
       ------------------------------------------------------- */

    channel.subscribe(async (status) => {
      if (status === "SUBSCRIBED") {
        setCollaborationStatus(
          "connected"
        );

        collaborationStatusRef.current =
          "connected";

        try {
          await channel.track({
            online: true,
            joinedAt:
              new Date().toISOString(),
            clientId:
              clientIdRef.current,
          });

          updatePresenceCount(channel);
        } catch (presenceError) {
          console.error(
            "Presence error:",
            presenceError
          );
        }
      }

      if (status === "CHANNEL_ERROR") {
        setCollaborationStatus("error");

        collaborationStatusRef.current =
          "error";
      }

      if (status === "TIMED_OUT") {
        setCollaborationStatus("timeout");

        collaborationStatusRef.current =
          "timeout";
      }
    });

    return () => {
      collaborationChannelRef.current =
        null;

      collaboratingRef.current = false;

      setCollaborating(false);
      setParticipantCount(0);
      setParticipantIds([]);
      setCollaborationStatus("offline");

      supabase.removeChannel(channel);
    };
  }, [paper?.id, pageCount]);

  /* =========================================================
     PRESENCE
     ========================================================= */

  function updatePresenceCount(channel) {
    try {
      const state =
        channel.presenceState();

      const ids = Object.keys(state);

      setParticipantIds(ids);
      setParticipantCount(ids.length);
    } catch (err) {
      console.error(
        "Could not update presence:",
        err
      );
    }
  }

  /* =========================================================
     LOAD ANNOTATIONS
     ========================================================= */

  async function loadAnnotationsForPage(
    targetPage
  ) {
    if (!paper?.id) {
      return [];
    }

    try {
      const {
        data,
        error: annotationError,
      } = await supabase
        .from("past_paper_annotations")
        .select(
          "id, paper_id, user_id, page_number, stroke, created_at"
        )
        .eq("paper_id", paper.id)
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
        "Could not load annotations:",
        err
      );

      setError(
        err.message ||
          "Could not load your annotations."
      );

      return [];
    }
  }

  async function loadAnnotations() {
    const loaded =
      await loadAnnotationsForPage(
        pageNumberRef.current
      );

    setAnnotations(loaded);
    annotationsRef.current = loaded;

    drawAllAnnotations(loaded);

    return loaded;
  }

  /* =========================================================
     RENDER PDF PAGE
     ========================================================= */

  useEffect(() => {
    if (!pdfDocument) {
      return;
    }

    let cancelled = false;

    async function renderCurrentPage() {
      try {
        setPageReady(false);
        setError("");

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

        if (
          !pdfCanvas ||
          !drawingCanvas
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

        pdfCanvas.style.width =
          `${viewport.width}px`;

        pdfCanvas.style.height =
          `${viewport.height}px`;

        drawingCanvas.style.width =
          `${viewport.width}px`;

        drawingCanvas.style.height =
          `${viewport.height}px`;

        clearDrawingCanvas();

        await page.render({
          canvasContext: pdfContext,
          viewport,
        }).promise;

        if (cancelled) {
          return;
        }

        /*
         * IMPORTANT:
         *
         * Once the PDF has rendered, retrieve the
         * annotations for this exact page from
         * Supabase and redraw them.
         *
         * This is what makes annotations persist
         * when changing pages or reopening the paper.
         */

        const loaded =
          await loadAnnotationsForPage(
            currentPage
          );

        if (cancelled) {
          return;
        }

        setAnnotations(loaded);
        annotationsRef.current = loaded;

        drawAllAnnotations(loaded);

        setPageReady(true);
      } catch (err) {
        if (cancelled) {
          return;
        }

        console.error(
          "Could not render page:",
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
    pageNumber,
    scale,
  ]);

  /* =========================================================
     CLEAR CANVAS
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
     DRAW ONE STROKE
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

    context.lineCap = "round";
    context.lineJoin = "round";

    const currentTool =
      stroke.tool || "pen";

    const colour =
      stroke.colour || "#2563eb";

    const size =
      Number(stroke.size || 3);

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
          annotation.stroke,
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
     START DRAWING
     ========================================================= */

  function startDrawing(event) {
    if (!pageReady) {
      return;
    }

    event.preventDefault();

    const position =
      getPointerPosition(event);

    if (!position) {
      return;
    }

    const canvas =
      drawingCanvasRef.current;

    try {
      canvas.setPointerCapture(
        event.pointerId
      );
    } catch {
      // Ignore pointer capture errors.
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
      tool: toolRef.current,
      colour: penColourRef.current,
      size: penSizeRef.current,

      points: [
        normalizedPoint,
      ],
    };

    drawingRef.current = true;
    setDrawing(true);

    const context =
      canvas.getContext("2d");

    context.beginPath();

    context.moveTo(
      position.x,
      position.y
    );

    broadcastDraw({
      phase: "start",
      x: normalizedPoint.x,
      y: normalizedPoint.y,
    });
  }

  /* =========================================================
     DRAW
     ========================================================= */

  function draw(event) {
    if (!drawingRef.current) {
      return;
    }

    event.preventDefault();

    const position =
      getPointerPosition(event);

    if (!position) {
      return;
    }

    const canvas =
      drawingCanvasRef.current;

    const context =
      canvas.getContext("2d");

    const currentTool =
      toolRef.current;

    const currentColour =
      penColourRef.current;

    const currentSize =
      penSizeRef.current;

    context.lineCap = "round";
    context.lineJoin = "round";

    if (currentTool === "eraser") {
      context.globalCompositeOperation =
        "destination-out";

      context.globalAlpha = 1;

      context.lineWidth =
        currentSize * 5;
    } else if (
      currentTool === "highlighter"
    ) {
      context.globalCompositeOperation =
        "source-over";

      context.strokeStyle =
        currentColour;

      context.globalAlpha = 0.3;

      context.lineWidth =
        currentSize * 5;
    } else {
      context.globalCompositeOperation =
        "source-over";

      context.strokeStyle =
        currentColour;

      context.globalAlpha = 1;

      context.lineWidth =
        currentSize;
    }

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

    broadcastDraw({
      phase: "move",
      x: normalizedPoint.x,
      y: normalizedPoint.y,
    });
  }

  /* =========================================================
     STOP DRAWING
     ========================================================= */

  async function stopDrawing() {
    if (!drawingRef.current) {
      return;
    }

    drawingRef.current = false;
    setDrawing(false);

    const stroke =
      currentStrokeRef.current;

    currentStrokeRef.current = null;

    const canvas =
      drawingCanvasRef.current;

    if (!canvas || !stroke) {
      return;
    }

    const context =
      canvas.getContext("2d");

    context.beginPath();

    context.globalAlpha = 1;

    context.globalCompositeOperation =
      "source-over";

    broadcastDraw({
      phase: "end",
    });

    /*
     * THIS IS THE IMPORTANT PART:
     *
     * Every completed stroke is inserted into
     * past_paper_annotations.
     */

    await saveStroke(stroke);
  }

  /* =========================================================
     BROADCAST LIVE DRAWING
     ========================================================= */

  async function broadcastDraw(
    drawingData
  ) {
    if (!collaboratingRef.current) {
      return;
    }

    const channel =
      collaborationChannelRef.current;

    if (!channel) {
      return;
    }

    if (
      collaborationStatusRef.current !==
      "connected"
    ) {
      return;
    }

    try {
      await channel.send({
        type: "broadcast",
        event: "draw",

        payload: {
          ...drawingData,

          clientId:
            clientIdRef.current,

          pageNumber:
            pageNumberRef.current,

          tool:
            toolRef.current,

          colour:
            penColourRef.current,

          size:
            penSizeRef.current,
        },
      });
    } catch (err) {
      console.error(
        "Could not broadcast drawing:",
        err
      );
    }
  }

  /* =========================================================
     DRAW REMOTE LIVE STROKE
     ========================================================= */

  function drawRemoteStroke(payload) {
    const canvas =
      drawingCanvasRef.current;

    if (!canvas) {
      return;
    }

    if (
      typeof payload.x !== "number" ||
      typeof payload.y !== "number"
    ) {
      return;
    }

    const context =
      canvas.getContext("2d");

    const x =
      payload.x * canvas.width;

    const y =
      payload.y * canvas.height;

    context.lineCap = "round";
    context.lineJoin = "round";

    if (payload.tool === "eraser") {
      context.globalCompositeOperation =
        "destination-out";

      context.globalAlpha = 1;

      context.lineWidth =
        Number(payload.size || 3) *
        5;
    } else if (
      payload.tool === "highlighter"
    ) {
      context.globalCompositeOperation =
        "source-over";

      context.strokeStyle =
        payload.colour || "#2563eb";

      context.globalAlpha = 0.3;

      context.lineWidth =
        Number(payload.size || 3) *
        5;
    } else {
      context.globalCompositeOperation =
        "source-over";

      context.strokeStyle =
        payload.colour || "#2563eb";

      context.globalAlpha = 1;

      context.lineWidth =
        Number(payload.size || 3);
    }

    if (payload.phase === "start") {
      context.beginPath();
      context.moveTo(x, y);
    } else if (
      payload.phase === "move"
    ) {
      context.lineTo(x, y);
      context.stroke();

      context.beginPath();
      context.moveTo(x, y);
    } else if (
      payload.phase === "end"
    ) {
      context.beginPath();

      context.globalAlpha = 1;

      context.globalCompositeOperation =
        "source-over";
    }
  }

  /* =========================================================
     SAVE STROKE
     ========================================================= */

  async function saveStroke(stroke) {
    if (
      !paper?.id ||
      !stroke?.points?.length
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
          "You must be logged in to save annotations."
        );
      }

      const pageToSave =
        pageNumberRef.current;

      /*
       * Insert the annotation into Supabase.
       */

      const {
        data,
        error: insertError,
      } = await supabase
        .from("past_paper_annotations")
        .insert({
          paper_id: paper.id,
          user_id: user.id,
          page_number: pageToSave,
          stroke: stroke,
        })
        .select(
          "id, paper_id, user_id, page_number, stroke, created_at"
        )
        .single();

      if (insertError) {
        throw insertError;
      }

      /*
       * Add the saved database row to local state.
       */

      setAnnotations((current) => [
        ...current,
        data,
      ]);

      annotationsRef.current = [
        ...annotationsRef.current,
        data,
      ];

      /*
       * Tell other people in the room that the
       * annotation has been permanently saved.
       */

      if (
        collaboratingRef.current &&
        collaborationChannelRef.current &&
        collaborationStatusRef.current ===
          "connected"
      ) {
        await collaborationChannelRef.current.send(
          {
            type: "broadcast",

            event: "stroke-created",

            payload: {
              clientId:
                clientIdRef.current,

              pageNumber:
                pageToSave,

              annotation:
                data,
            },
          }
        );
      }
    } catch (err) {
      console.error(
        "Could not save stroke:",
        err
      );

      setError(
        err?.message ||
          "Could not save your annotation."
      );
    } finally {
      setSaving(false);
    }
  }

  /* =========================================================
     ADD REMOTE ANNOTATION
     ========================================================= */

  function addRemoteAnnotation(annotation) {
    setAnnotations((current) => {
      if (
        current.some(
          (item) =>
            item.id === annotation.id
        )
      ) {
        return current;
      }

      return [
        ...current,
        annotation,
      ];
    });

    annotationsRef.current = [
      ...annotationsRef.current,
      annotation,
    ];

    setTimeout(() => {
      drawAllAnnotations(
        annotationsRef.current
      );
    }, 0);
  }

  /* =========================================================
     REMOVE ANNOTATION LOCALLY
     ========================================================= */

  function removeAnnotationLocally(
    annotationId
  ) {
    setAnnotations((current) =>
      current.filter(
        (annotation) =>
          annotation.id !== annotationId
      )
    );

    annotationsRef.current =
      annotationsRef.current.filter(
        (annotation) =>
          annotation.id !== annotationId
      );

    setTimeout(() => {
      drawAllAnnotations(
        annotationsRef.current
      );
    }, 0);
  }

  /* =========================================================
     UNDO
     ========================================================= */

  async function undo() {
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return;
    }

    const ownAnnotations =
      annotationsRef.current.filter(
        (annotation) =>
          annotation.user_id === user.id
      );

    if (ownAnnotations.length === 0) {
      return;
    }

    const latest =
      ownAnnotations[
        ownAnnotations.length - 1
      ];

    try {
      setSaving(true);
      setError("");

      const {
        error: deleteError,
      } = await supabase
        .from("past_paper_annotations")
        .delete()
        .eq("id", latest.id)
        .eq("user_id", user.id);

      if (deleteError) {
        throw deleteError;
      }

      removeAnnotationLocally(
        latest.id
      );

      if (
        collaboratingRef.current &&
        collaborationChannelRef.current
      ) {
        await collaborationChannelRef.current.send(
          {
            type: "broadcast",

            event:
              "annotation-deleted",

            payload: {
              clientId:
                clientIdRef.current,

              annotationId:
                latest.id,
            },
          }
        );
      }
    } catch (err) {
      console.error(
        "Could not undo annotation:",
        err
      );

      setError(
        "Could not undo that annotation."
      );
    } finally {
      setSaving(false);
    }
  }

  /* =========================================================
     CLEAR MY PAGE ANNOTATIONS
     ========================================================= */

  async function clearPage() {
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

      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError || !user) {
        throw new Error(
          "You must be logged in."
        );
      }

      const ownAnnotations =
        annotationsRef.current.filter(
          (annotation) =>
            annotation.user_id ===
              user.id &&
            Number(
              annotation.page_number
            ) ===
              pageNumberRef.current
        );

      if (ownAnnotations.length === 0) {
        return;
      }

      const annotationIds =
        ownAnnotations.map(
          (annotation) =>
            annotation.id
        );

      const {
        error: deleteError,
      } = await supabase
        .from("past_paper_annotations")
        .delete()
        .in("id", annotationIds)
        .eq("user_id", user.id);

      if (deleteError) {
        throw deleteError;
      }

      setAnnotations((current) =>
        current.filter(
          (annotation) =>
            !annotationIds.includes(
              annotation.id
            )
        )
      );

      annotationsRef.current =
        annotationsRef.current.filter(
          (annotation) =>
            !annotationIds.includes(
              annotation.id
            )
        );

      drawAllAnnotations(
        annotationsRef.current
      );

      if (
        collaboratingRef.current &&
        collaborationChannelRef.current
      ) {
        await collaborationChannelRef.current.send(
          {
            type: "broadcast",

            event:
              "annotations-cleared",

            payload: {
              clientId:
                clientIdRef.current,

              annotationIds,
            },
          }
        );
      }
    } catch (err) {
      console.error(
        "Could not clear annotations:",
        err
      );

      setError(
        "Could not clear your annotations."
      );
    } finally {
      setSaving(false);
    }
  }

  /* =========================================================
     TOGGLE COLLABORATION
     ========================================================= */

  async function toggleCollaboration() {
    if (collaboratingRef.current) {
      collaboratingRef.current = false;

      setCollaborating(false);
      setShowInviteFriends(false);

      return;
    }

    if (
      collaborationStatusRef.current !==
      "connected"
    ) {
      setError(
        "The live collaboration connection is not ready yet. Please try again in a moment."
      );

      return;
    }

    try {
      setError("");

      await getOrCreateRoom();

      collaboratingRef.current = true;
      setCollaborating(true);

      const channel =
        collaborationChannelRef.current;

      if (!channel) {
        throw new Error(
          "The collaboration channel is unavailable."
        );
      }

      await channel.send({
        type: "broadcast",

        event: "user-joined",

        payload: {
          clientId:
            clientIdRef.current,

          pageNumber:
            pageNumberRef.current,

          roomCode:
            roomRef.current?.room_code ||
            "",
        },
      });
    } catch (err) {
      console.error(
        "Could not start collaboration:",
        err
      );

      collaboratingRef.current = false;
      setCollaborating(false);

      setError(
        err?.message ||
          "Could not start the collaboration room."
      );
    }
  }

  /* =========================================================
     PAGE SYNCHRONISATION
     ========================================================= */

  async function broadcastPageChange(
    newPage
  ) {
    if (!collaboratingRef.current) {
      return;
    }

    const channel =
      collaborationChannelRef.current;

    if (!channel) {
      return;
    }

    try {
      await channel.send({
        type: "broadcast",

        event: "page-change",

        payload: {
          clientId:
            clientIdRef.current,

          pageNumber: newPage,
        },
      });
    } catch (err) {
      console.error(
        "Could not synchronise page:",
        err
      );
    }
  }

  /* =========================================================
     PREVIOUS PAGE
     ========================================================= */

  function previousPage() {
    if (pageNumber <= 1) {
      return;
    }

    const newPage =
      pageNumber - 1;

    setPageNumber(newPage);
    pageNumberRef.current = newPage;

    broadcastPageChange(newPage);
  }

  /* =========================================================
     NEXT PAGE
     ========================================================= */

  function nextPage() {
    if (pageNumber >= pageCount) {
      return;
    }

    const newPage =
      pageNumber + 1;

    setPageNumber(newPage);
    pageNumberRef.current = newPage;

    broadcastPageChange(newPage);
  }

  /* =========================================================
     ZOOM
     ========================================================= */

  function zoomIn() {
    setScale((value) => {
      const newValue =
        Math.min(3, value + 0.15);

      scaleRef.current = newValue;

      return newValue;
    });
  }

  function zoomOut() {
    setScale((value) => {
      const newValue =
        Math.max(0.5, value - 0.15);

      scaleRef.current = newValue;

      return newValue;
    });
  }

  /* =========================================================
     COPY ROOM CODE
     ========================================================= */

  async function copyRoomCode() {
    if (!roomCode) {
      return;
    }

    try {
      await navigator.clipboard.writeText(
        roomCode
      );

      setError(
        "Room code copied to clipboard."
      );

      setTimeout(() => {
        setError("");
      }, 2000);
    } catch {
      setError(
        `Room code: ${roomCode}`
      );
    }
  }

  /* =========================================================
     LOADING
     ========================================================= */

  if (loading) {
    return (
      <div className="study-hub">
        <div className="no-subjects">
          <div className="no-subjects-icon">
            📄
          </div>

          <h2>
            Opening paper...
          </h2>

          <p>
            Loading your digital workspace.
          </p>
        </div>
      </div>
    );
  }

  /* =========================================================
     WORKSPACE
     ========================================================= */

  return (
    <div
      className="paper-workspace"
      style={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        background: "#eef1f5",
      }}
    >
      {/* =====================================================
          TOOLBAR
          ===================================================== */}

      <div
        className="paper-toolbar"
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: "15px",
          padding: "12px 18px",
          background: "#ffffff",
          borderBottom:
            "1px solid #dfe3e8",
          position: "sticky",
          top: 0,
          zIndex: 50,
          flexWrap: "wrap",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "15px",
          }}
        >
          <button
            type="button"
            onClick={() =>
              setPage("pastPapers")
            }
          >
            ← Back
          </button>

          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: "3px",
            }}
          >
            <strong>
              {paper.name}
            </strong>

            <small>
              Page {pageNumber} of{" "}
              {pageCount}
            </small>
          </div>
        </div>

        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "7px",
            flexWrap: "wrap",
          }}
        >
          <button
            type="button"
            className={
              tool === "pen"
                ? "paper-tool active"
                : "paper-tool"
            }
            onClick={() =>
              setTool("pen")
            }
          >
            ✏️ Pen
          </button>

          <button
            type="button"
            className={
              tool === "highlighter"
                ? "paper-tool active"
                : "paper-tool"
            }
            onClick={() =>
              setTool("highlighter")
            }
          >
            🖍️ Highlighter
          </button>

          <button
            type="button"
            className={
              tool === "eraser"
                ? "paper-tool active"
                : "paper-tool"
            }
            onClick={() =>
              setTool("eraser")
            }
          >
            🧽 Eraser
          </button>

          <button
            type="button"
            onClick={undo}
            disabled={
              !annotations.some(
                (annotation) =>
                  annotation.user_id
              )
            }
          >
            ↩️ Undo
          </button>

          <button
            type="button"
            onClick={clearPage}
          >
            🗑️ Clear My Writing
          </button>
        </div>

        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "8px",
            flexWrap: "wrap",
          }}
        >
          <button
            type="button"
            onClick={zoomOut}
          >
            −
          </button>

          <span>
            {Math.round(scale * 100)}%
          </span>

          <button
            type="button"
            onClick={zoomIn}
          >
            +
          </button>

          <span
            style={{
              fontSize: "13px",
              marginLeft: "5px",
            }}
          >
            {saving
              ? "Saving..."
              : "✓ Saved"}
          </span>
        </div>
      </div>

      {/* =====================================================
          LIVE COLLABORATION
          ===================================================== */}

      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: "15px",
          padding: "10px 18px",
          background: collaborating
            ? "#ecfdf5"
            : "#f8fafc",
          borderBottom:
            "1px solid #e2e8f0",
          flexWrap: "wrap",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "12px",
          }}
        >
          <span
            style={{
              fontSize: "20px",
            }}
          >
            🧑‍🤝‍🧑
          </span>

          <div>
            <strong>
              Live Collaboration
            </strong>

            <div
              style={{
                fontSize: "12px",
                color: "#64748b",
                marginTop: "2px",
              }}
            >
              {collaborationStatus ===
              "connected" ? (
                <>
                  🟢 Connected
                  {" • "}
                  {participantCount}{" "}
                  {participantCount === 1
                    ? "person"
                    : "people"}{" "}
                  in room
                </>
              ) : collaborationStatus ===
                "error" ? (
                "🔴 Connection error"
              ) : collaborationStatus ===
                "timeout" ? (
                "🟠 Connection timed out"
              ) : (
                "⚪ Connecting..."
              )}
            </div>
          </div>
        </div>

        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "10px",
            flexWrap: "wrap",
          }}
        >
          {roomCode &&
            collaborating && (
              <button
                type="button"
                onClick={copyRoomCode}
                style={{
                  border:
                    "1px solid #cbd5e1",
                  borderRadius: "10px",
                  background: "white",
                  padding: "8px 12px",
                  fontWeight: "600",
                  cursor: "pointer",
                }}
              >
                🔑 {roomCode} 📋
              </button>
            )}

          {collaborating && (
            <button
              type="button"
              onClick={() => {
                loadFriends();
                setShowInviteFriends(true);
              }}
              style={{
                border: "none",
                borderRadius: "10px",
                padding: "9px 15px",
                fontWeight: "600",
                cursor: "pointer",
                background: "#7c3aed",
                color: "white",
              }}
            >
              👥 Invite Friends
            </button>
          )}

          <button
            type="button"
            onClick={
              toggleCollaboration
            }
            disabled={
              collaborationStatus !==
                "connected" ||
              roomLoading
            }
            style={{
              border: "none",
              borderRadius: "10px",
              padding: "9px 15px",
              fontWeight: "600",
              cursor:
                collaborationStatus ===
                  "connected" &&
                !roomLoading
                  ? "pointer"
                  : "not-allowed",
              background: collaborating
                ? "#dc2626"
                : "#2563eb",
              color: "white",
              opacity:
                collaborationStatus ===
                  "connected" &&
                !roomLoading
                  ? 1
                  : 0.6,
            }}
          >
            {roomLoading
              ? "Creating room..."
              : collaborating
              ? "🔴 Leave Live Room"
              : "🧑‍🤝‍🧑 Start Live Room"}
          </button>
        </div>
      </div>

      {/* =====================================================
          ROOM CODE
          ===================================================== */}

      {collaborating && roomCode && (
        <div
          style={{
            padding: "10px 18px",
            background: "#eff6ff",
            borderBottom:
              "1px solid #dbeafe",
            color: "#1e3a8a",
            fontSize: "13px",
          }}
        >
          <strong>
            Collaboration room:
          </strong>{" "}
          Share the code{" "}
          <strong>{roomCode}</strong>{" "}
          with the people you want to
          study with.
        </div>
      )}

      {/* =====================================================
          PARTICIPANTS
          ===================================================== */}

      {collaborating && (
        <div
          style={{
            padding: "8px 18px",
            background: "#ffffff",
            borderBottom:
              "1px solid #e2e8f0",
            fontSize: "13px",
            color: "#475569",
          }}
        >
          <strong>Live now:</strong>{" "}

          {participantIds.length > 0
            ? participantIds.map(
                (id, index) => (
                  <span
                    key={id}
                    style={{
                      display:
                        "inline-flex",
                      alignItems:
                        "center",
                      gap: "4px",
                      marginLeft: "8px",
                      padding: "4px 8px",
                      borderRadius:
                        "999px",
                      background:
                        "#f1f5f9",
                    }}
                  >
                    🟢{" "}
                    {id ===
                    clientIdRef.current
                      ? "You"
                      : `Student ${
                          index + 1
                        }`}
                  </span>
                )
              )
            : "Nobody else is currently connected."}
        </div>
      )}

      {/* =====================================================
          TOOL SETTINGS
          ===================================================== */}

      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "20px",
          padding: "10px 18px",
          background: "#f8fafc",
          borderBottom:
            "1px solid #e2e8f0",
          flexWrap: "wrap",
        }}
      >
        <label
          style={{
            display: "flex",
            alignItems: "center",
            gap: "8px",
          }}
        >
          Colour

          <input
            type="color"
            value={penColour}
            onChange={(event) =>
              setPenColour(
                event.target.value
              )
            }
          />
        </label>

        <label
          style={{
            display: "flex",
            alignItems: "center",
            gap: "8px",
          }}
        >
          Pen size

          <input
            type="range"
            min="1"
            max="20"
            value={penSize}
            onChange={(event) =>
              setPenSize(
                Number(
                  event.target.value
                )
              )
            }
          />

          <span>
            {penSize}px
          </span>
        </label>

        <span
          style={{
            fontSize: "13px",
            opacity: 0.65,
          }}
        >
          🖊️ Use a stylus, finger or
          mouse to write directly on
          the paper.
        </span>

        {collaborating && (
          <span
            style={{
              fontSize: "13px",
              fontWeight: "600",
              color: "#059669",
            }}
          >
            📡 Live drawing enabled
          </span>
        )}
      </div>

      {/* =====================================================
          ERROR
          ===================================================== */}

      {error && (
        <div
          style={{
            margin: "12px 18px",
            padding: "12px 15px",
            borderRadius: "10px",
            background: "#fff1f2",
            color: "#991b1b",
            border:
              "1px solid #fecaca",
          }}
        >
          ⚠️ {error}
        </div>
      )}

      {/* =====================================================
          PAPER
          ===================================================== */}

      <div
        style={{
          flex: 1,
          overflow: "auto",
          padding: "30px",
          display: "flex",
          justifyContent: "center",
          alignItems: "flex-start",
        }}
      >
        <div
          style={{
            position: "relative",
            display: "inline-block",
            background: "#ffffff",
            boxShadow:
              "0 8px 30px rgba(0,0,0,0.15)",
            lineHeight: 0,
          }}
        >
          <canvas
            ref={pdfCanvasRef}
            style={{
              display: "block",
            }}
          />

          <canvas
            ref={drawingCanvasRef}
            onPointerDown={
              startDrawing
            }
            onPointerMove={draw}
            onPointerUp={stopDrawing}
            onPointerCancel={
              stopDrawing
            }
            onPointerLeave={
              stopDrawing
            }
            style={{
              position: "absolute",
              left: 0,
              top: 0,
              touchAction: "none",
              cursor:
                tool === "eraser"
                  ? "cell"
                  : "crosshair",
            }}
          />
        </div>
      </div>

      {/* =====================================================
          PAGE NAVIGATION
          ===================================================== */}

      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: "25px",
          padding: "15px",
          background: "#ffffff",
          borderTop:
            "1px solid #dfe3e8",
          position: "sticky",
          bottom: 0,
          zIndex: 50,
        }}
      >
        <button
          type="button"
          onClick={previousPage}
          disabled={pageNumber <= 1}
        >
          ← Previous
        </button>

        <div>
          Page{" "}
          <strong>{pageNumber}</strong>{" "}
          of{" "}
          <strong>{pageCount}</strong>
        </div>

        <button
          type="button"
          onClick={nextPage}
          disabled={
            pageNumber >= pageCount
          }
        >
          Next →
        </button>
      </div>

      {/* =====================================================
          INVITE FRIENDS MODAL
          ===================================================== */}

      {showInviteFriends && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background:
              "rgba(0, 0, 0, 0.5)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1000,
            padding: "20px",
          }}
        >
          <div
            style={{
              width: "100%",
              maxWidth: "450px",
              maxHeight: "80vh",
              overflow: "auto",
              background: "white",
              borderRadius: "20px",
              padding: "25px",
              boxShadow:
                "0 20px 60px rgba(0,0,0,0.25)",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent:
                  "space-between",
                marginBottom: "20px",
              }}
            >
              <div>
                <h2
                  style={{
                    margin: 0,
                  }}
                >
                  Invite Friends
                </h2>

                <p
                  style={{
                    margin: "6px 0 0",
                    color: "#64748b",
                    fontSize: "14px",
                  }}
                >
                  Invite your friends to
                  study on this paper
                  with you.
                </p>
              </div>

              <button
                type="button"
                onClick={() =>
                  setShowInviteFriends(
                    false
                  )
                }
                style={{
                  border: "none",
                  background: "#f1f5f9",
                  borderRadius: "10px",
                  width: "36px",
                  height: "36px",
                  cursor: "pointer",
                  fontSize: "18px",
                }}
              >
                ×
              </button>
            </div>

            {friends.length === 0 ? (
              <div
                style={{
                  padding: "25px",
                  textAlign: "center",
                  background:
                    "#f8fafc",
                  borderRadius: "14px",
                  color: "#64748b",
                }}
              >
                <div
                  style={{
                    fontSize: "30px",
                    marginBottom: "8px",
                  }}
                >
                  👥
                </div>

                <strong>
                  You don't have any
                  friends yet.
                </strong>

                <p>
                  Add some friends from
                  the Friends page
                  first.
                </p>
              </div>
            ) : (
              <div
                style={{
                  display: "flex",
                  flexDirection:
                    "column",
                  gap: "10px",
                }}
              >
                {friends.map(
                  (friend) => {
                    const recentlyInvited =
                      invitedFriends.includes(
                        friend.id
                      );

                    return (
                      <div
                        key={friend.id}
                        style={{
                          display:
                            "flex",
                          alignItems:
                            "center",
                          justifyContent:
                            "space-between",
                          gap: "12px",
                          padding: "12px",
                          borderRadius:
                            "12px",
                          background:
                            "#f8fafc",
                        }}
                      >
                        <div
                          style={{
                            display:
                              "flex",
                            alignItems:
                              "center",
                            gap: "10px",
                          }}
                        >
                          <div
                            style={{
                              width: "42px",
                              height: "42px",
                              borderRadius:
                                "50%",
                              background:
                                "#e0e7ff",
                              display:
                                "flex",
                              alignItems:
                                "center",
                              justifyContent:
                                "center",
                              fontSize:
                                "20px",
                            }}
                          >
                            👤
                          </div>

                          <div>
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
                                marginTop:
                                  "2px",
                              }}
                            >
                              {friend.year_group ||
                                "Sixth Form"}
                            </div>
                          </div>
                        </div>

                        <button
                          type="button"
                          disabled={
                            inviteLoading ===
                            friend.id
                          }
                          onClick={() =>
                            inviteFriend(
                              friend.id
                            )
                          }
                          style={{
                            border: "none",
                            borderRadius:
                              "9px",
                            padding:
                              "8px 12px",
                            fontWeight:
                              "600",
                            cursor:
                              inviteLoading ===
                              friend.id
                                ? "default"
                                : "pointer",
                            background:
                              recentlyInvited
                                ? "#dcfce7"
                                : "#7c3aed",
                            color:
                              recentlyInvited
                                ? "#166534"
                                : "white",
                          }}
                        >
                          {inviteLoading ===
                          friend.id
                            ? "Sending..."
                            : recentlyInvited
                            ? "✓ Sent"
                            : "Invite"}
                        </button>
                      </div>
                    );
                  }
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default PaperWorkspace;