import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import PaperWorkspace from "./PaperWorkspace";

function PastPapers({ setPage }) {
  const [papers, setPapers] = useState([]);
  const [selectedPaper, setSelectedPaper] = useState(null);

  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");

  // =========================================================
  // INVITATIONS
  // =========================================================

  const [invitations, setInvitations] = useState([]);
  const [invitationLoading, setInvitationLoading] = useState(false);

  const [acceptingInvitationId, setAcceptingInvitationId] =
    useState(null);

  const [decliningInvitationId, setDecliningInvitationId] =
    useState(null);

  // =========================================================
  // LOAD PAST PAPERS
  // =========================================================

  async function loadPapers() {
    try {
      setError("");

      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError || !user) {
        setPage("login");
        return;
      }

      const {
        data,
        error: papersError,
      } = await supabase
        .from("past_papers")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", {
          ascending: false,
        });

      if (papersError) {
        throw papersError;
      }

      setPapers(data || []);
    } catch (err) {
      console.error(
        "Could not load past papers:",
        err
      );

      setError(
        err?.message ||
          "Could not load your past papers."
      );
    } finally {
      setLoading(false);
    }
  }

  // =========================================================
  // LOAD INVITATIONS
  // =========================================================

  async function loadInvitations() {
    try {
      setInvitationLoading(true);

      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError || !user) {
        return;
      }

      console.log(
        "Checking invitations for:",
        user.id
      );

      /*
       * IMPORTANT:
       *
       * past_paper_invitations DOES NOT HAVE paper_id.
       *
       * The relationship is:
       *
       * invitation.room_id
       *       ↓
       * past_paper_rooms.id
       *       ↓
       * past_paper_rooms.paper_id
       *       ↓
       * past_papers.id
       *
       * Therefore we get paper_id through the room.
       */

      const {
        data: invitationData,
        error: invitationError,
      } = await supabase
        .from("past_paper_invitations")
        .select(`
          id,
          room_id,
          sender_id,
          receiver_id,
          status,
          created_at,
          past_paper_rooms (
            id,
            room_code,
            paper_id,
            created_by
          )
        `)
        .eq("receiver_id", user.id)
        .eq("status", "pending")
        .order("created_at", {
          ascending: false,
        });

      if (invitationError) {
        throw invitationError;
      }

      console.log(
        "Pending invitations found:",
        invitationData
      );

      if (
        !invitationData ||
        invitationData.length === 0
      ) {
        setInvitations([]);
        return;
      }

      // =====================================================
      // LOAD SENDER PROFILES
      // =====================================================

      const senderIds = [
        ...new Set(
          invitationData
            .map(
              (invitation) =>
                invitation.sender_id
            )
            .filter(Boolean)
        ),
      ];

      let senderProfiles = [];

      if (senderIds.length > 0) {
        const {
          data: profiles,
          error: profileError,
        } = await supabase
          .from("profiles")
          .select(
            "id, full_name, school_email, year_group"
          )
          .in("id", senderIds);

        if (profileError) {
          console.warn(
            "Could not load invitation senders:",
            profileError.message
          );
        } else {
          senderProfiles = profiles || [];
        }
      }

      // =====================================================
      // LOAD INVITED PAPERS
      // =====================================================

      const paperIds = [
        ...new Set(
          invitationData
            .map(
              (invitation) =>
                invitation
                  .past_paper_rooms
                  ?.paper_id
            )
            .filter(Boolean)
        ),
      ];

      let invitedPapers = [];

      if (paperIds.length > 0) {
        const {
          data: paperData,
          error: paperError,
        } = await supabase
          .from("past_papers")
          .select(
            "id, name, file_path, created_at, user_id"
          )
          .in("id", paperIds);

        if (paperError) {
          console.warn(
            "Could not load invited papers:",
            paperError.message
          );
        } else {
          invitedPapers = paperData || [];
        }
      }

      // =====================================================
      // COMBINE DATA
      // =====================================================

      const combinedInvitations =
        invitationData.map(
          (invitation) => {
            const sender =
              senderProfiles.find(
                (profile) =>
                  profile.id ===
                  invitation.sender_id
              );

            const room =
              invitation.past_paper_rooms;

            const invitedPaper =
              invitedPapers.find(
                (paper) =>
                  paper.id ===
                  room?.paper_id
              );

            return {
              ...invitation,
              sender,
              room,
              paper: invitedPaper,
            };
          }
        );

      console.log(
        "Combined invitations:",
        combinedInvitations
      );

      setInvitations(
        combinedInvitations
      );
    } catch (err) {
      console.error(
        "Could not load invitations:",
        err
      );

      setInvitations([]);
    } finally {
      setInvitationLoading(false);
    }
  }

  // =========================================================
  // LOAD EVERYTHING
  // =========================================================

  useEffect(() => {
    loadPapers();
    loadInvitations();

    /*
     * Realtime listener.
     *
     * Whenever an invitation is INSERTED, UPDATED or DELETED,
     * refresh the invitation list.
     */

    const invitationChannel =
      supabase
        .channel(
          "past-paper-invitations-receiver"
        )
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table:
              "past_paper_invitations",
          },
          (payload) => {
            console.log(
              "Past paper invitation changed:",
              payload
            );

            loadInvitations();
          }
        )
        .subscribe((status) => {
          console.log(
            "Invitation realtime status:",
            status
          );
        });

    /*
     * Fallback refresh.
     *
     * This means that even if Realtime misses an event,
     * the page checks again every 3 seconds.
     */

    const interval = setInterval(() => {
      loadInvitations();
    }, 3000);

    return () => {
      clearInterval(interval);

      supabase.removeChannel(
        invitationChannel
      );
    };
  }, []);

  // =========================================================
  // ACCEPT INVITATION
  // =========================================================

  async function acceptInvitation(
    invitation
  ) {
    if (!invitation?.id) {
      return;
    }

    if (acceptingInvitationId) {
      return;
    }

    try {
      setError("");

      setAcceptingInvitationId(
        invitation.id
      );

      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError || !user) {
        setPage("login");
        return;
      }

      if (
        invitation.receiver_id !==
        user.id
      ) {
        throw new Error(
          "This invitation does not belong to you."
        );
      }

      if (
        invitation.status !==
        "pending"
      ) {
        throw new Error(
          "This invitation has already been handled."
        );
      }

      if (!invitation.room_id) {
        throw new Error(
          "This invitation is missing its paper room."
        );
      }

      // =====================================================
      // ADD USER TO ROOM
      // =====================================================

      const {
        error: memberError,
      } = await supabase
        .from(
          "past_paper_room_members"
        )
        .insert({
          room_id:
            invitation.room_id,
          user_id: user.id,
        });

      /*
       * If the user is already a member,
       * Supabase may return a duplicate error.
       *
       * That is safe to ignore.
       */

      if (
        memberError &&
        !String(
          memberError.message || ""
        )
          .toLowerCase()
          .includes("duplicate")
      ) {
        throw memberError;
      }

      // =====================================================
      // MARK INVITATION ACCEPTED
      // =====================================================

      const {
        error: updateError,
      } = await supabase
        .from(
          "past_paper_invitations"
        )
        .update({
          status: "accepted",
        })
        .eq(
          "id",
          invitation.id
        )
        .eq(
          "receiver_id",
          user.id
        );

      if (updateError) {
        throw updateError;
      }

      // =====================================================
      // GET PAPER
      // =====================================================

      let paperToOpen =
        invitation.paper;

      if (!paperToOpen) {
        const {
          data: room,
          error: roomError,
        } = await supabase
          .from(
            "past_paper_rooms"
          )
          .select(
            "id, room_code, paper_id, created_by"
          )
          .eq(
            "id",
            invitation.room_id
          )
          .single();

        if (roomError) {
          throw roomError;
        }

        if (room?.paper_id) {
          const {
            data: paper,
            error: paperError,
          } = await supabase
            .from("past_papers")
            .select("*")
            .eq(
              "id",
              room.paper_id
            )
            .single();

          if (!paperError) {
            paperToOpen = paper;
          }
        }
      }

      /*
       * Remove the accepted invitation
       * from the visible list immediately.
       */

      setInvitations(
        (current) =>
          current.filter(
            (item) =>
              item.id !==
              invitation.id
          )
      );

      await loadInvitations();

      // =====================================================
      // OPEN PAPER
      // =====================================================

      if (paperToOpen) {
        setSelectedPaper(
          paperToOpen
        );
      }
    } catch (err) {
      console.error(
        "Could not accept invitation:",
        err
      );

      setError(
        err?.message ||
          "Could not accept the invitation."
      );
    } finally {
      setAcceptingInvitationId(
        null
      );
    }
  }

  // =========================================================
  // DECLINE INVITATION
  // =========================================================

  async function declineInvitation(
    invitation
  ) {
    if (!invitation?.id) {
      return;
    }

    if (decliningInvitationId) {
      return;
    }

    try {
      setError("");

      setDecliningInvitationId(
        invitation.id
      );

      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError || !user) {
        setPage("login");
        return;
      }

      if (
        invitation.receiver_id !==
        user.id
      ) {
        throw new Error(
          "This invitation does not belong to you."
        );
      }

      // =====================================================
      // MARK DECLINED
      // =====================================================

      const {
        error: updateError,
      } = await supabase
        .from(
          "past_paper_invitations"
        )
        .update({
          status: "declined",
        })
        .eq(
          "id",
          invitation.id
        )
        .eq(
          "receiver_id",
          user.id
        );

      if (updateError) {
        throw updateError;
      }

      /*
       * Remove it immediately from the UI.
       */

      setInvitations(
        (current) =>
          current.filter(
            (item) =>
              item.id !==
              invitation.id
          )
      );

      await loadInvitations();
    } catch (err) {
      console.error(
        "Could not decline invitation:",
        err
      );

      setError(
        err?.message ||
          "Could not decline the invitation."
      );
    } finally {
      setDecliningInvitationId(
        null
      );
    }
  }

  // =========================================================
  // UPLOAD PDF
  // =========================================================

  async function uploadPaper(
    event
  ) {
    const file =
      event.target.files?.[0];

    if (!file) {
      return;
    }

    if (
      file.type !==
        "application/pdf" &&
      !file.name
        .toLowerCase()
        .endsWith(".pdf")
    ) {
      setError(
        "Please select a PDF file."
      );

      event.target.value = "";

      return;
    }

    try {
      setUploading(true);
      setError("");

      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError || !user) {
        setPage("login");
        return;
      }

      const paperName =
        window.prompt(
          "What would you like to call this paper?",
          file.name.replace(
            /\.pdf$/i,
            ""
          )
        );

      if (
        !paperName ||
        !paperName.trim()
      ) {
        event.target.value = "";
        return;
      }

      const safeFileName =
        file.name.replace(
          /[^a-zA-Z0-9._-]/g,
          "_"
        );

      const filePath =
        `${user.id}/${Date.now()}-${safeFileName}`;

      const {
        error: uploadError,
      } = await supabase.storage
        .from("past-papers")
        .upload(
          filePath,
          file,
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

      const {
        error: databaseError,
      } = await supabase
        .from("past_papers")
        .insert({
          user_id: user.id,
          name:
            paperName.trim(),
          file_path:
            filePath,
        });

      if (databaseError) {
        await supabase.storage
          .from("past-papers")
          .remove([
            filePath,
          ]);

        throw databaseError;
      }

      await loadPapers();
    } catch (err) {
      console.error(
        "Could not upload past paper:",
        err
      );

      setError(
        err?.message ||
          "Could not upload the past paper."
      );
    } finally {
      setUploading(false);
      event.target.value = "";
    }
  }

  // =========================================================
  // DELETE PAPER
  // =========================================================

  async function deletePaper(
    paper
  ) {
    const confirmed =
      window.confirm(
        `Delete "${paper.name}"?`
      );

    if (!confirmed) {
      return;
    }

    try {
      setError("");

      const {
        error: storageError,
      } = await supabase.storage
        .from("past-papers")
        .remove([
          paper.file_path,
        ]);

      if (storageError) {
        throw storageError;
      }

      const {
        error: databaseError,
      } = await supabase
        .from("past_papers")
        .delete()
        .eq(
          "id",
          paper.id
        );

      if (databaseError) {
        throw databaseError;
      }

      if (
        selectedPaper?.id ===
        paper.id
      ) {
        setSelectedPaper(null);
      }

      await loadPapers();
    } catch (err) {
      console.error(
        "Could not delete past paper:",
        err
      );

      setError(
        err?.message ||
          "Could not delete the past paper."
      );
    }
  }

  // =========================================================
  // OPEN PAPER
  // =========================================================

  function openPaper(paper) {
    setSelectedPaper(paper);
  }

  // =========================================================
  // CLOSE WORKSPACE
  // =========================================================

  function closeWorkspace() {
    setSelectedPaper(null);
  }

  // =========================================================
  // PAPER WORKSPACE
  // =========================================================

  if (selectedPaper) {
    return (
      <PaperWorkspace
        paper={selectedPaper}
        setPage={(newPage) => {
          if (
            newPage ===
            "pastPapers"
          ) {
            closeWorkspace();
          } else {
            setPage(newPage);
          }
        }}
      />
    );
  }

  // =========================================================
  // LOADING
  // =========================================================

  if (loading) {
    return (
      <div className="study-hub">
        <div className="no-subjects">

          <div className="no-subjects-icon">
            📄
          </div>

          <h2>
            Loading Past Papers...
          </h2>

          <p>
            Finding your papers and invitations.
          </p>

        </div>
      </div>
    );
  }

  // =========================================================
  // PENDING INVITATIONS
  // =========================================================

  const pendingInvitations =
    invitations.filter(
      (invitation) =>
        invitation.status ===
        "pending"
    );

  // =========================================================
  // MAIN PAGE
  // =========================================================

  return (
    <div className="study-hub">

      {/* HEADER */}

      <div className="revision-header">

        <div>

          <p className="card-eyebrow">
            DIGITAL WORKSPACE
          </p>

          <h2>
            Past Papers 📄
          </h2>

          <p className="revision-description">
            Upload past papers and work
            through them digitally with
            your finger, mouse or stylus.
          </p>

        </div>

        <label
          className="manage-subjects-button"
          style={{
            cursor: uploading
              ? "not-allowed"
              : "pointer",
            opacity:
              uploading ? 0.7 : 1,
            display:
              "inline-flex",
            alignItems:
              "center",
            justifyContent:
              "center",
          }}
        >

          {uploading
            ? "Uploading..."
            : "＋ Upload PDF"}

          <input
            type="file"
            accept="application/pdf,.pdf"
            onChange={
              uploadPaper
            }
            disabled={
              uploading
            }
            style={{
              display: "none",
            }}
          />

        </label>

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

      {/* =====================================================
          PAPER INVITATIONS
          ===================================================== */}

      {pendingInvitations.length >
        0 && (
        <div
          style={{
            marginBottom:
              "30px",
          }}
        >

          <div className="revision-section-heading">

            <div>

              <h3>
                📩 Paper Invitations
              </h3>

              <p>
                You have{" "}
                {
                  pendingInvitations.length
                }{" "}
                pending{" "}
                {
                  pendingInvitations.length ===
                  1
                    ? "invitation"
                    : "invitations"
                }{" "}
                to work on past papers.
              </p>

            </div>

          </div>

          <div
            style={{
              display:
                "flex",
              flexDirection:
                "column",
              gap: "12px",
            }}
          >

            {pendingInvitations.map(
              (invitation) => {

                const isAccepting =
                  acceptingInvitationId ===
                  invitation.id;

                const isDeclining =
                  decliningInvitationId ===
                  invitation.id;

                return (
                  <div
                    key={
                      invitation.id
                    }
                    style={{
                      background:
                        "white",
                      border:
                        "1px solid #ddd6fe",
                      borderRadius:
                        "18px",
                      padding:
                        "18px 20px",
                      display:
                        "flex",
                      alignItems:
                        "center",
                      justifyContent:
                        "space-between",
                      gap: "20px",
                      flexWrap:
                        "wrap",
                      boxShadow:
                        "0 4px 15px rgba(0,0,0,0.04)",
                    }}
                  >

                    {/* INVITER */}

                    <div
                      style={{
                        display:
                          "flex",
                        alignItems:
                          "center",
                        gap: "14px",
                      }}
                    >

                      <div
                        style={{
                          width:
                            "50px",
                          height:
                            "50px",
                          borderRadius:
                            "50%",
                          background:
                            "#ede9fe",
                          display:
                            "flex",
                          alignItems:
                            "center",
                          justifyContent:
                            "center",
                          fontSize:
                            "24px",
                          flexShrink: 0,
                        }}
                      >
                        👤
                      </div>

                      <div>

                        <strong
                          style={{
                            fontSize:
                              "16px",
                          }}
                        >
                          {invitation
                            .sender
                            ?.full_name ||
                            "A student"}
                        </strong>

                        <div
                          style={{
                            marginTop:
                              "4px",
                            color:
                              "#64748b",
                            fontSize:
                              "14px",
                          }}
                        >

                          invited you to
                          work on{" "}

                          <strong>
                            {invitation
                              .paper
                              ?.name ||
                              "a past paper"}
                          </strong>

                        </div>

                        {invitation.created_at && (
                          <div
                            style={{
                              marginTop:
                                "4px",
                              color:
                                "#94a3b8",
                              fontSize:
                                "12px",
                            }}
                          >
                            Sent{" "}
                            {new Date(
                              invitation.created_at
                            ).toLocaleString()}
                          </div>
                        )}

                      </div>

                    </div>

                    {/* BUTTONS */}

                    <div
                      style={{
                        display:
                          "flex",
                        gap: "10px",
                        flexWrap:
                          "wrap",
                      }}
                    >

                      <button
                        type="button"
                        className="primary-card-button"
                        onClick={() =>
                          acceptInvitation(
                            invitation
                          )
                        }
                        disabled={
                          isAccepting ||
                          isDeclining
                        }
                        style={{
                          cursor:
                            isAccepting ||
                            isDeclining
                              ? "not-allowed"
                              : "pointer",
                          opacity:
                            isAccepting ||
                            isDeclining
                              ? 0.7
                              : 1,
                        }}
                      >
                        {isAccepting
                          ? "Accepting..."
                          : "✅ Accept"}
                      </button>

                      <button
                        type="button"
                        onClick={() =>
                          declineInvitation(
                            invitation
                          )
                        }
                        disabled={
                          isAccepting ||
                          isDeclining
                        }
                        style={{
                          border:
                            "1px solid #fecaca",
                          borderRadius:
                            "10px",
                          padding:
                            "10px 15px",
                          background:
                            "#fff1f2",
                          color:
                            "#991b1b",
                          fontWeight:
                            "600",
                          cursor:
                            isAccepting ||
                            isDeclining
                              ? "not-allowed"
                              : "pointer",
                          opacity:
                            isAccepting ||
                            isDeclining
                              ? 0.7
                              : 1,
                        }}
                      >
                        {isDeclining
                          ? "Declining..."
                          : "❌ Decline"}
                      </button>

                    </div>

                  </div>
                );
              }
            )}

          </div>

        </div>
      )}

      {/* INVITATION LOADING */}

      {invitationLoading &&
        pendingInvitations.length ===
          0 && (
          <div
            style={{
              marginBottom:
                "25px",
              padding:
                "15px",
              borderRadius:
                "12px",
              background:
                "#f8fafc",
              color:
                "#64748b",
              fontSize:
                "14px",
            }}
          >
            Checking for paper invitations...
          </div>
        )}

      {/* =====================================================
          NO PAPERS
          ===================================================== */}

      {papers.length === 0 ? (

        <div className="no-subjects">

          <div className="no-subjects-icon">
            📄
          </div>

          <h3>
            No past papers yet
          </h3>

          <p>
            Upload your first PDF to
            start building your digital
            paper workspace.
          </p>

          <label
            className="primary-card-button"
            style={{
              cursor:
                uploading
                  ? "not-allowed"
                  : "pointer",
              display:
                "inline-flex",
              alignItems:
                "center",
              justifyContent:
                "center",
              opacity:
                uploading
                  ? 0.7
                  : 1,
            }}
          >

            {uploading
              ? "Uploading..."
              : "＋ Upload Your First PDF"}

            <input
              type="file"
              accept="application/pdf,.pdf"
              onChange={
                uploadPaper
              }
              disabled={
                uploading
              }
              style={{
                display: "none",
              }}
            />

          </label>

        </div>

      ) : (

        <>

          {/* PAPERS HEADING */}

          <div className="revision-section-heading">

            <div>

              <h3>
                📚 Your Past Papers
              </h3>

              <p>
                {papers.length}{" "}
                {
                  papers.length ===
                  1
                    ? "paper"
                    : "papers"
                }
              </p>

            </div>

          </div>

          {/* PAPER GRID */}

          <div className="revision-subject-grid">

            {papers.map(
              (paper) => (

                <div
                  key={
                    paper.id
                  }
                  className="revision-subject-card"
                >

                  <div className="revision-subject-top">

                    <div className="revision-subject-icon">
                      📄
                    </div>

                    <div className="revision-subject-arrow">
                      →
                    </div>

                  </div>

                  <div className="revision-subject-content">

                    <h3>
                      {paper.name}
                    </h3>

                    <p>
                      PDF past paper
                    </p>

                    <p
                      style={{
                        marginTop:
                          "8px",
                        fontSize:
                          "13px",
                        opacity:
                          0.7,
                      }}
                    >
                      Uploaded{" "}
                      {paper.created_at
                        ? new Date(
                            paper.created_at
                          ).toLocaleDateString()
                        : "Unknown date"}
                    </p>

                  </div>

                  <div
                    style={{
                      display:
                        "flex",
                      flexDirection:
                        "column",
                      gap: "10px",
                      marginTop:
                        "20px",
                    }}
                  >

                    <button
                      type="button"
                      className="primary-card-button"
                      onClick={() =>
                        openPaper(
                          paper
                        )
                      }
                    >
                      ✏️ Write on Paper
                    </button>

                    <button
                      type="button"
                      className="primary-card-button"
                      onClick={() =>
                        deletePaper(
                          paper
                        )
                      }
                      style={{
                        opacity:
                          0.8,
                      }}
                    >
                      🗑️ Delete
                    </button>

                  </div>

                </div>

              )
            )}

          </div>

        </>

      )}

    </div>
  );
}

export default PastPapers;