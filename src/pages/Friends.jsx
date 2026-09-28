import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import "./Timetable.css";

const friendTimetableDays = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
];

const friendDayIndexes = {
  Monday: 1,
  Tuesday: 2,
  Wednesday: 3,
  Thursday: 4,
  Friday: 5,
};

const friendDayShortNames = {
  Monday: "MON",
  Tuesday: "TUE",
  Wednesday: "WED",
  Thursday: "THU",
  Friday: "FRI",
};

const friendTimetablePeriods = [
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

function Friends({ setPage }) {
  const [user, setUser] = useState(null);
  const [students, setStudents] = useState([]);
  const [requests, setRequests] = useState([]);
  const [sentRequests, setSentRequests] = useState([]);
  const [friends, setFriends] = useState([]);

  const [paperInvitations, setPaperInvitations] =
    useState([]);

  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] =
    useState(null);
  const [message, setMessage] = useState("");

  const [selectedStudent, setSelectedStudent] =
    useState(null);

  const [profileLoading, setProfileLoading] =
    useState(false);

  const [profileSubjects, setProfileSubjects] =
    useState([]);

  const [profileTimetable, setProfileTimetable] =
    useState([]);

  const [profileWeek, setProfileWeek] =
    useState(1);

  useEffect(() => {
    loadFriends();
  }, []);

  // =========================================================
  // REALTIME PAST PAPER INVITATIONS
  // =========================================================

  useEffect(() => {
    if (!user?.id) {
      return;
    }

    const invitationChannel = supabase
      .channel(
        `past-paper-invitations-${user.id}`
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table:
            "past_paper_invitations",
          filter:
            `receiver_id=eq.${user.id}`,
        },
        async () => {
          await loadPaperInvitations(
            user.id
          );
        }
      )
      .subscribe((status) => {
        console.log(
          "Past paper invitation realtime:",
          status
        );
      });

    return () => {
      supabase.removeChannel(
        invitationChannel
      );
    };
  }, [user?.id]);

  // =========================================================
  // LOAD FRIENDS PAGE
  // =========================================================

  async function loadFriends() {
    try {
      setLoading(true);
      setMessage("");

      const {
        data: { user: currentUser },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError || !currentUser) {
        setPage("login");
        return;
      }

      setUser(currentUser);

      // =====================================================
      // LOAD ALL STUDENTS
      // =====================================================

      const {
        data: profileData,
        error: profileError,
      } = await supabase
        .from("profiles")
        .select(
          "id, full_name, school_email, year_group"
        )
        .order("full_name");

      if (profileError) {
        throw profileError;
      }

      setStudents(profileData || []);

      // =====================================================
      // LOAD FRIEND REQUESTS
      // =====================================================

      const {
        data: requestData,
        error: requestError,
      } = await supabase
        .from("friend_requests")
        .select(
          "id, sender_id, receiver_id, status, created_at"
        )
        .or(
          `sender_id.eq.${currentUser.id},receiver_id.eq.${currentUser.id}`
        )
        .order("created_at", {
          ascending: false,
        });

      if (requestError) {
        throw requestError;
      }

      const allRequests = requestData || [];

      // =====================================================
      // INCOMING REQUESTS
      // =====================================================

      const incomingRequests =
        allRequests.filter(
          (request) =>
            request.receiver_id ===
              currentUser.id &&
            request.status === "pending"
        );

      setRequests(incomingRequests);

      // =====================================================
      // OUTGOING REQUESTS
      // =====================================================

      const outgoingRequests =
        allRequests.filter(
          (request) =>
            request.sender_id ===
              currentUser.id &&
            request.status === "pending"
        );

      setSentRequests(outgoingRequests);

      // =====================================================
      // ACCEPTED FRIENDS
      // =====================================================

      const acceptedRequests =
        allRequests.filter(
          (request) =>
            request.status === "accepted"
        );

      const friendIds = [];

      acceptedRequests.forEach(
        (request) => {
          if (
            request.sender_id ===
            currentUser.id
          ) {
            friendIds.push(
              request.receiver_id
            );
          }

          if (
            request.receiver_id ===
            currentUser.id
          ) {
            friendIds.push(
              request.sender_id
            );
          }
        }
      );

      setFriends(friendIds);

      // =====================================================
      // LOAD PAST PAPER INVITATIONS
      // =====================================================

      await loadPaperInvitations(
        currentUser.id
      );
    } catch (error) {
      console.error(
        "Could not load friends:",
        error
      );

      setMessage(
        error.message ||
          "Could not load your friends."
      );
    } finally {
      setLoading(false);
    }
  }

  // =========================================================
  // LOAD PAST PAPER INVITATIONS
  // =========================================================

  async function loadPaperInvitations(
    userId
  ) {
    try {
      const {
        data,
        error,
      } = await supabase
        .from("past_paper_invitations")
        .select(`
          id,
          sender_id,
          receiver_id,
          room_id,
          status,
          created_at
        `)
        .eq("receiver_id", userId)
        .eq("status", "pending")
        .order("created_at", {
          ascending: false,
        });

      if (error) {
        throw error;
      }

      const invitations =
        data || [];

      const invitationsWithPapers =
        await Promise.all(
          invitations.map(
            async (invitation) => {
              let paper = null;

              if (invitation.room_id) {
                const {
                  data: roomData,
                  error: roomError,
                } = await supabase
                  .from("past_paper_rooms")
                  .select("paper_id")
                  .eq(
                    "id",
                    invitation.room_id
                  )
                  .maybeSingle();

                if (
                  !roomError &&
                  roomData?.paper_id
                ) {
                  const {
                    data: paperData,
                    error: paperError,
                  } = await supabase
                    .from("past_papers")
                    .select("*")
                    .eq(
                      "id",
                      roomData.paper_id
                    )
                    .maybeSingle();

                  if (!paperError) {
                    paper = paperData;
                  }
                }
              }

              return {
                ...invitation,
                paper,
              };
            }
          )
        );

      setPaperInvitations(
        invitationsWithPapers
      );
    } catch (error) {
      console.error(
        "Could not load past paper invitations:",
        error
      );

      setPaperInvitations([]);
    }
  }

  // =========================================================
  // GET STUDENT
  // =========================================================

  function getStudent(studentId) {
    return students.find(
      (student) =>
        student.id === studentId
    );
  }

  // =========================================================
  // OPEN PROFILE
  // =========================================================

  async function openProfile(studentId) {
    setSelectedStudent(studentId);
    setProfileLoading(true);
    setProfileSubjects([]);
    setProfileTimetable([]);
    setProfileWeek(1);
    setMessage("");

    try {
      // =====================================================
      // LOAD SUBJECTS
      // =====================================================

      const {
        data: subjectData,
        error: subjectError,
      } = await supabase
        .from("subjects")
        .select("*")
        .eq("user_id", studentId);

      if (subjectError) {
        console.warn(
          "Could not load student subjects:",
          subjectError.message
        );

        setProfileSubjects([]);
      } else {
        setProfileSubjects(
          subjectData || []
        );
      }

      // =====================================================
      // LOAD TIMETABLE
      //
      // IMPORTANT:
      // This uses timetable_entries, not timetable.
      // =====================================================

      const {
        data: timetableData,
        error: timetableError,
      } = await supabase
        .from("timetable_entries")
        .select(`
          id,
          user_id,
          day,
          subject,
          start_time,
          end_time,
          room,
          teacher,
          week,
          period_name,
          created_at,
          updated_at
        `)
        .eq("user_id", studentId)
        .order("day", {
          ascending: true,
        })
        .order("start_time", {
          ascending: true,
        });

      if (timetableError) {
        console.warn(
          "Could not load student timetable:",
          timetableError.message
        );

        setProfileTimetable([]);
      } else {
        setProfileTimetable(
          timetableData || []
        );
      }
    } catch (error) {
      console.error(
        "Could not load student profile data:",
        error
      );

      setMessage(
        error.message ||
          "Could not load this student's information."
      );
    } finally {
      setProfileLoading(false);
    }
  }

  function closeProfile() {
    setSelectedStudent(null);
    setProfileSubjects([]);
    setProfileTimetable([]);
  }

  // =========================================================
  // FORMAT TIME
  // =========================================================

  function formatTime(time) {
    if (!time) {
      return "";
    }

    const parts = String(time).split(":");

    if (parts.length < 2) {
      return String(time);
    }

    const hours = Number(parts[0]);
    const minutes = String(parts[1]);

    const suffix =
      hours >= 12 ? "PM" : "AM";

    const displayHour =
      hours % 12 === 0
        ? 12
        : hours % 12;

    return (
      String(displayHour) +
      ":" +
      minutes +
      " " +
      suffix
    );
  }

  // =========================================================
  // FORMAT DAY
  //
  // Supports either numeric days or day names.
  // =========================================================

  function formatDay(day) {
    const dayMap = {
      1: "Monday",
      2: "Tuesday",
      3: "Wednesday",
      4: "Thursday",
      5: "Friday",
      6: "Saturday",
      7: "Sunday",
    };

    if (
      typeof day === "number" ||
      !Number.isNaN(Number(day))
    ) {
      return (
        dayMap[Number(day)] ||
        String(day)
      );
    }

    const text =
      String(day || "").trim();

    if (!text) {
      return "Unknown day";
    }

    return (
      text.charAt(0).toUpperCase() +
      text.slice(1).toLowerCase()
    );
  }

  // =========================================================
  // FRIEND TIMETABLE HELPERS
  // =========================================================

  function getProfileEntry(
    day,
    periodName
  ) {
    const dayIndex =
      friendDayIndexes[day];

    return profileTimetable.find(
      (entry) =>
        Number(entry.week) ===
          Number(profileWeek) &&
        Number(entry.day) ===
          dayIndex &&
        entry.period_name ===
          periodName
    );
  }

  function getProfileEntryType(entry) {
    const value =
      String(entry?.subject || "")
        .trim()
        .toLowerCase();

    if (value.includes("game")) {
      return "games";
    }

    if (
      value.includes(
        "enrichment"
      )
    ) {
      return "enrichment";
    }

    if (
      value.includes("form") ||
      value.includes("tutor") ||
      value.includes("chapel") ||
      value.includes("assembly") ||
      value.includes("pastoral")
    ) {
      return "routine";
    }

    return "";
  }

  function getProfileEntryIcon(entry) {
    const type =
      getProfileEntryType(entry);

    if (type === "games") {
      return "🏃";
    }

    if (
      type === "enrichment"
    ) {
      return "✨";
    }

    if (type === "routine") {
      return "🎓";
    }

    if (
      entry?.period_name ===
      "Extra-curricular"
    ) {
      return "🌟";
    }

    return "";
  }

  // =========================================================
  // SEND FRIEND REQUEST
  // =========================================================

  async function sendFriendRequest(
    receiverId
  ) {
    if (!user) {
      return;
    }

    try {
      setActionLoading(receiverId);
      setMessage("");

      const relationshipFilter =
        `and(sender_id.eq.${user.id},receiver_id.eq.${receiverId}),` +
        `and(sender_id.eq.${receiverId},receiver_id.eq.${user.id})`;

      const {
        data: existingRequests,
        error: existingError,
      } = await supabase
        .from("friend_requests")
        .select(
          "id, sender_id, receiver_id, status"
        )
        .or(relationshipFilter);

      if (existingError) {
        throw existingError;
      }

      if (
        existingRequests &&
        existingRequests.length > 0
      ) {
        setMessage(
          "You already have a request or friendship with this student."
        );
        return;
      }

      const { error } =
        await supabase
          .from("friend_requests")
          .insert({
            sender_id: user.id,
            receiver_id: receiverId,
            status: "pending",
          });

      if (error) {
        throw error;
      }

      setMessage(
        "Friend request sent! 🎉"
      );

      await loadFriends();
    } catch (error) {
      console.error(
        "Could not send friend request:",
        error
      );

      setMessage(
        error.message ||
          "Could not send friend request."
      );
    } finally {
      setActionLoading(null);
    }
  }

  // =========================================================
  // ACCEPT FRIEND REQUEST
  // =========================================================

  async function acceptRequest(
    requestId
  ) {
    try {
      setActionLoading(requestId);
      setMessage("");

      const { error } =
        await supabase
          .from("friend_requests")
          .update({
            status: "accepted",
          })
          .eq("id", requestId);

      if (error) {
        throw error;
      }

      setMessage(
        "Friend request accepted! 🎉"
      );

      await loadFriends();
    } catch (error) {
      console.error(
        "Could not accept request:",
        error
      );

      setMessage(
        error.message ||
          "Could not accept request."
      );
    } finally {
      setActionLoading(null);
    }
  }

  // =========================================================
  // DECLINE FRIEND REQUEST
  // =========================================================

  async function declineRequest(
    requestId
  ) {
    try {
      setActionLoading(requestId);
      setMessage("");

      const { error } =
        await supabase
          .from("friend_requests")
          .update({
            status: "declined",
          })
          .eq("id", requestId);

      if (error) {
        throw error;
      }

      await loadFriends();
    } catch (error) {
      console.error(
        "Could not decline request:",
        error
      );

      setMessage(
        error.message ||
          "Could not decline request."
      );
    } finally {
      setActionLoading(null);
    }
  }

  // =========================================================
  // REMOVE FRIEND
  // =========================================================

  async function removeFriend(
    friendId
  ) {
    if (!user) {
      return;
    }

    try {
      setActionLoading(friendId);
      setMessage("");

      const relationshipFilter =
        `and(sender_id.eq.${user.id},receiver_id.eq.${friendId}),` +
        `and(sender_id.eq.${friendId},receiver_id.eq.${user.id})`;

      const { error } =
        await supabase
          .from("friend_requests")
          .delete()
          .or(relationshipFilter);

      if (error) {
        throw error;
      }

      setMessage("Friend removed.");

      await loadFriends();
    } catch (error) {
      console.error(
        "Could not remove friend:",
        error
      );

      setMessage(
        error.message ||
          "Could not remove friend."
      );
    } finally {
      setActionLoading(null);
    }
  }

  // =========================================================
  // ACCEPT PAST PAPER INVITATION
  // =========================================================

  async function acceptPaperInvitation(
    invitation
  ) {
    if (!user) {
      return;
    }

    try {
      setActionLoading(
        `paper-${invitation.id}`
      );

      setMessage("");

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

      if (invitation.room_id) {
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

        if (
          memberError &&
          memberError.code !==
            "23505"
        ) {
          console.warn(
            "Could not add user to room:",
            memberError
          );
        }
      }

      setMessage(
        "Invitation accepted! Opening the paper... 🚀"
      );

      if (invitation.paper) {
        sessionStorage.setItem(
          "openPastPaper",
          JSON.stringify(
            invitation.paper
          )
        );
      }

      sessionStorage.setItem(
        "pastPaperRoomId",
        invitation.room_id || ""
      );

      sessionStorage.setItem(
        "pastPaperAutoJoin",
        "true"
      );

      await loadPaperInvitations(
        user.id
      );

      setTimeout(() => {
        setPage("pastPapers");
      }, 500);
    } catch (error) {
      console.error(
        "Could not accept past paper invitation:",
        error
      );

      setMessage(
        error.message ||
          "Could not accept the past paper invitation."
      );
    } finally {
      setActionLoading(null);
    }
  }

  // =========================================================
  // DECLINE PAST PAPER INVITATION
  // =========================================================

  async function declinePaperInvitation(
    invitationId
  ) {
    if (!user) {
      return;
    }

    try {
      setActionLoading(
        `paper-${invitationId}`
      );

      setMessage("");

      const {
        error,
      } = await supabase
        .from(
          "past_paper_invitations"
        )
        .update({
          status: "declined",
        })
        .eq(
          "id",
          invitationId
        )
        .eq(
          "receiver_id",
          user.id
        );

      if (error) {
        throw error;
      }

      setMessage(
        "Past paper invitation declined."
      );

      await loadPaperInvitations(
        user.id
      );
    } catch (error) {
      console.error(
        "Could not decline past paper invitation:",
        error
      );

      setMessage(
        error.message ||
          "Could not decline the invitation."
      );
    } finally {
      setActionLoading(null);
    }
  }

  // =========================================================
  // GET FRIEND STATUS
  // =========================================================

  function getStatus(studentId) {
    if (studentId === user?.id) {
      return "you";
    }

    if (
      friends.includes(studentId)
    ) {
      return "friends";
    }

    const incoming =
      requests.find(
        (request) =>
          request.sender_id ===
          studentId
      );

    if (incoming) {
      return "incoming";
    }

    const outgoing =
      sentRequests.find(
        (request) =>
          request.receiver_id ===
          studentId
      );

    if (outgoing) {
      return "sent";
    }

    return "none";
  }

  // =========================================================
  // SEARCH
  // =========================================================

  const filteredStudents =
    students.filter(
      (student) => {
        if (
          student.id === user?.id
        ) {
          return false;
        }

        const searchText =
          search
            .toLowerCase()
            .trim();

        if (!searchText) {
          return true;
        }

        return (
          student.full_name
            ?.toLowerCase()
            .includes(searchText) ||
          student.school_email
            ?.toLowerCase()
            .includes(searchText) ||
          student.year_group
            ?.toLowerCase()
            .includes(searchText)
        );
      }
    );

  // =========================================================
  // LOADING
  // =========================================================

  if (loading) {
    return (
      <div className="no-subjects">
        <div className="no-subjects-icon">
          👥
        </div>

        <h3>
          Loading Friends...
        </h3>

        <p>
          Finding students and
          friend requests.
        </p>
      </div>
    );
  }

  // =========================================================
  // STUDENT PROFILE
  // =========================================================

  if (selectedStudent) {
    const student =
      getStudent(selectedStudent);

    if (!student) {
      return (
        <div className="no-subjects">
          <div className="no-subjects-icon">
            😕
          </div>

          <h3>
            Student not found
          </h3>

          <button
            type="button"
            className="primary-card-button"
            onClick={closeProfile}
          >
            ← Back to Friends
          </button>
        </div>
      );
    }

    const timetableDays = [
      {
        number: 1,
        name: "Monday",
      },
      {
        number: 2,
        name: "Tuesday",
      },
      {
        number: 3,
        name: "Wednesday",
      },
      {
        number: 4,
        name: "Thursday",
      },
      {
        number: 5,
        name: "Friday",
      },
    ];

    return (
      <div>
        {/* PROFILE HEADER */}

        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "15px",
            marginBottom: "25px",
            flexWrap: "wrap",
          }}
        >
          <button
            type="button"
            onClick={closeProfile}
            style={{
              border:
                "1px solid #dbe3ef",
              background: "white",
              borderRadius: "10px",
              padding: "10px 14px",
              cursor: "pointer",
              fontSize: "14px",
            }}
          >
            ← Back
          </button>

          <div>
            <p className="card-eyebrow">
              STUDENT PROFILE
            </p>

            <h2
              style={{
                margin: 0,
              }}
            >
              {student.full_name ||
                "Student"}{" "}
              👤
            </h2>
          </div>
        </div>

        {message && (
          <div className="auth-error">
            {message}
          </div>
        )}

        {/* PROFILE CARD */}

        <div
          style={{
            background: "white",
            borderRadius: "20px",
            border:
              "1px solid #e2e8f0",
            padding: "25px",
            marginBottom: "30px",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "20px",
              flexWrap: "wrap",
            }}
          >
            <div
              style={{
                width: "75px",
                height: "75px",
                minWidth: "75px",
                borderRadius: "50%",
                background:
                  "#e0e7ff",
                display: "flex",
                alignItems:
                  "center",
                justifyContent:
                  "center",
                fontSize: "34px",
              }}
            >
              👤
            </div>

            <div>
              <h2
                style={{
                  margin: 0,
                }}
              >
                {student.full_name ||
                  "Student"}
              </h2>

              <p
                style={{
                  margin:
                    "6px 0 0",
                  color:
                    "#64748b",
                }}
              >
                {student.year_group ||
                  "Sixth Form"}
              </p>

              {student.school_email && (
                <p
                  style={{
                    margin:
                      "4px 0 0",
                    color:
                      "#64748b",
                    fontSize:
                      "14px",
                  }}
                >
                  {student.school_email}
                </p>
              )}
            </div>
          </div>
        </div>

        {profileLoading ? (
          <div className="no-subjects">
            <div className="no-subjects-icon">
              📚
            </div>

            <h3>
              Loading profile...
            </h3>

            <p>
              Getting their subjects
              and timetable.
            </p>
          </div>
        ) : (
          <>
            {/* =================================================
                SUBJECTS
                ================================================= */}

            <div className="revision-section-heading">
              <div>
                <h3>
                  Subjects 📚
                </h3>

                <p>
                  The subjects this
                  student takes.
                </p>
              </div>
            </div>

            {profileSubjects.length >
            0 ? (
              <div
                className="revision-subject-grid"
                style={{
                  marginBottom:
                    "35px",
                }}
              >
                {profileSubjects.map(
                  (subject, index) => (
                    <div
                      key={
                        subject.id ||
                        subject.subject_id ||
                        subject.name ||
                        index
                      }
                      className="revision-subject-card"
                    >
                      <div className="revision-subject-top">
                        <div className="revision-subject-icon">
                          📚
                        </div>
                      </div>

                      <div className="revision-subject-content">
                        <h3>
                          {subject.name ||
                            subject.subject_name ||
                            subject.title ||
                            "Subject"}
                        </h3>

                        {subject.exam_board && (
                          <p>
                            {subject.exam_board}
                          </p>
                        )}

                        {subject.level && (
                          <p>
                            {subject.level}
                          </p>
                        )}
                      </div>
                    </div>
                  )
                )}
              </div>
            ) : (
              <div
                style={{
                  padding: "25px",
                  borderRadius: "16px",
                  background:
                    "#f8fafc",
                  color:
                    "#64748b",
                  textAlign:
                    "center",
                  marginBottom:
                    "35px",
                }}
              >
                <div
                  style={{
                    fontSize:
                      "30px",
                    marginBottom:
                      "8px",
                  }}
                >
                  📚
                </div>

                <strong>
                  No subjects available
                </strong>

                <p>
                  This student has
                  not added their
                  subjects yet.
                </p>
              </div>
            )}

            {/* =================================================
                TIMETABLE
                ================================================= */}

            <div
              className="revision-section-heading"
              style={{
                alignItems: "center",
                gap: "16px",
                flexWrap: "wrap",
              }}
            >
              <div>
                <h3>
                  Timetable 🗓️
                </h3>

                <p>
                  View this student's
                  Week 1 and Week 2 timetable.
                </p>
              </div>

              <div className="timetable-week">
                <button
                  type="button"
                  className={
                    profileWeek === 1
                      ? "timetable-week-active"
                      : ""
                  }
                  onClick={() =>
                    setProfileWeek(1)
                  }
                >
                  <span>
                    WEEK 1
                  </span>
                </button>

                <button
                  type="button"
                  className={
                    profileWeek === 2
                      ? "timetable-week-active"
                      : ""
                  }
                  onClick={() =>
                    setProfileWeek(2)
                  }
                >
                  <span>
                    WEEK 2
                  </span>
                </button>
              </div>
            </div>

            {profileTimetable.filter(
              (entry) =>
                Number(entry.week) ===
                Number(profileWeek)
            ).length > 0 ? (
              <>
                <div className="timetable-notice">
                  <div className="timetable-notice-icon">
                    👥
                  </div>

                  <div>
                    <strong>
                      {student.full_name ||
                        "Student"}'s timetable
                    </strong>

                    <p>
                      This timetable is read-only.
                      You can see the lessons and
                      activities your friend has
                      chosen to share.
                    </p>
                  </div>

                  <div className="timetable-notice-right">
                    <span>
                      WEEK {profileWeek}
                    </span>

                    <strong>
                      {
                        profileTimetable.filter(
                          (entry) =>
                            Number(
                              entry.week
                            ) ===
                            Number(
                              profileWeek
                            )
                        ).length
                      }
                    </strong>

                    <small>
                      entries
                    </small>
                  </div>
                </div>

                <div className="timetable-wrapper">
                  <div className="timetable-grid">

                    <div className="timetable-corner">
                      <span>
                        TIME
                      </span>
                    </div>

                    {friendTimetableDays.map(
                      (day) => (
                        <div
                          key={day}
                          className="timetable-day"
                        >
                          <span className="day-short">
                            {
                              friendDayShortNames[
                                day
                              ]
                            }
                          </span>

                          <strong>
                            {day}
                          </strong>
                        </div>
                      )
                    )}

                    {friendTimetablePeriods.map(
                      (period) => (
                        <div
                          key={
                            period.name +
                            period.time
                          }
                          className="timetable-row"
                          style={{
                            display:
                              "contents",
                          }}
                        >
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

                          {friendTimetableDays.map(
                            (day) => {
                              const entry =
                                getProfileEntry(
                                  day,
                                  period.name
                                );

                              const special =
                                entry
                                  ? getProfileEntryType(
                                      entry
                                    )
                                  : "";

                              return (
                                <div
                                  key={`${day}-${period.name}`}
                                  className={[
                                    "timetable-cell",

                                    period.break
                                      ? "timetable-cell-break"
                                      : "",

                                    entry
                                      ? "timetable-cell-filled"
                                      : "",

                                    special
                                      ? `timetable-cell-${special}`
                                      : "",
                                  ]
                                    .filter(
                                      Boolean
                                    )
                                    .join(
                                      " "
                                    )}
                                  style={{
                                    cursor:
                                      "default",
                                  }}
                                >
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
                                    <div className="lesson-content">
                                      <div className="lesson-subject">
                                        {getProfileEntryIcon(
                                          entry
                                        ) && (
                                          <span>
                                            {getProfileEntryIcon(
                                              entry
                                            )}{" "}
                                          </span>
                                        )}

                                        {
                                          entry.subject
                                        }
                                      </div>

                                      {entry.teacher && (
                                        <div className="lesson-detail">
                                          <span>
                                            👤
                                          </span>

                                          {
                                            entry.teacher
                                          }
                                        </div>
                                      )}

                                      {entry.room && (
                                        <div className="lesson-detail">
                                          <span>
                                            📍
                                          </span>

                                          {
                                            entry.room
                                          }
                                        </div>
                                      )}
                                    </div>
                                  ) : (
                                    <div
                                      className="empty-slot"
                                      style={{
                                        opacity:
                                          0.45,
                                      }}
                                    >
                                      <span>
                                        —
                                      </span>
                                    </div>
                                  )}
                                </div>
                              );
                            }
                          )}
                        </div>
                      )
                    )}
                  </div>
                </div>

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
                </div>
              </>
            ) : (
              <div
                style={{
                  padding: "30px",
                  borderRadius: "18px",
                  background:
                    "#f8fafc",
                  color:
                    "#64748b",
                  textAlign:
                    "center",
                }}
              >
                <div
                  style={{
                    fontSize:
                      "38px",
                    marginBottom:
                      "10px",
                  }}
                >
                  🗓️
                </div>

                <strong>
                  No Week {profileWeek} timetable available
                </strong>

                <p>
                  This student has not added
                  any entries for Week{" "}
                  {profileWeek} yet.
                </p>
              </div>
            )}
          </>
        )}
      </div>
    );
  }

  // =========================================================
  // FRIEND STUDENTS
  // =========================================================

  const friendStudents =
    friends
      .map((id) =>
        getStudent(id)
      )
      .filter(Boolean);

  // =========================================================
  // RENDER FRIENDS PAGE
  // =========================================================

  return (
    <div>
      {/* =====================================================
          HEADER
          ===================================================== */}

      <div className="revision-header">
        <div>
          <p className="card-eyebrow">
            TRISTAN REVISION
          </p>

          <h2>
            Friends 👥
          </h2>

          <p className="revision-description">
            Connect with other
            students, build your
            network and revise
            together.
          </p>
        </div>
      </div>

      {/* =====================================================
          MESSAGE
          ===================================================== */}

      {message && (
        <div className="auth-error">
          {message}
        </div>
      )}

      {/* =====================================================
          PAST PAPER INVITATIONS
          ===================================================== */}

      {paperInvitations.length >
        0 && (
        <>
          <div
            className="revision-section-heading"
            style={{
              marginTop:
                "35px",
            }}
          >
            <div>
              <h3>
                📄 Past Paper
                Invitations
              </h3>

              <p>
                {paperInvitations.length}{" "}
                pending invitation
                {paperInvitations.length ===
                1
                  ? ""
                  : "s"}
              </p>
            </div>
          </div>

          <div className="revision-subject-grid">
            {paperInvitations.map(
              (invitation) => {
                const sender =
                  getStudent(
                    invitation.sender_id
                  );

                const paper =
                  invitation.paper;

                const isBusy =
                  actionLoading ===
                  `paper-${invitation.id}`;

                return (
                  <div
                    key={
                      invitation.id
                    }
                    className="revision-subject-card"
                  >
                    <div className="revision-subject-top">
                      <div className="revision-subject-icon">
                        📄
                      </div>

                      <div className="revision-subject-arrow">
                        📥
                      </div>
                    </div>

                    <div className="revision-subject-content">
                      <h3>
                        {paper?.name ||
                          paper?.title ||
                          "Past Paper"}
                      </h3>

                      <p>
                        {sender?.full_name ||
                          "Another student"}{" "}
                        invited you to
                        study together.
                      </p>

                      {paper?.subject && (
                        <p>
                          📚{" "}
                          {paper.subject}
                        </p>
                      )}
                    </div>

                    <div
                      style={{
                        marginTop:
                          "15px",
                        display:
                          "flex",
                        gap:
                          "10px",
                      }}
                    >
                      <button
                        type="button"
                        className="primary-card-button"
                        disabled={
                          isBusy
                        }
                        onClick={() =>
                          acceptPaperInvitation(
                            invitation
                          )
                        }
                        style={{
                          flex: 1,
                        }}
                      >
                        {isBusy
                          ? "Opening..."
                          : "✓ Accept"}
                      </button>

                      <button
                        type="button"
                        disabled={
                          isBusy
                        }
                        onClick={() =>
                          declinePaperInvitation(
                            invitation.id
                          )
                        }
                        style={{
                          flex: 1,
                          padding:
                            "10px 14px",
                          borderRadius:
                            "10px",
                          border:
                            "1px solid #dbe3ef",
                          background:
                            "white",
                          cursor:
                            "pointer",
                        }}
                      >
                        Decline
                      </button>
                    </div>
                  </div>
                );
              }
            )}
          </div>
        </>
      )}

      {/* =====================================================
          YOUR FRIENDS
          ===================================================== */}

      <div className="revision-section-heading">
        <div>
          <h3>
            Your Friends 🤝
          </h3>

          <p>
            {friendStudents.length}{" "}
            friend
            {friendStudents.length ===
            1
              ? ""
              : "s"}
          </p>
        </div>
      </div>

      {friendStudents.length >
      0 ? (
        <div className="revision-subject-grid">
          {friendStudents.map(
            (friend) => (
              <div
                key={friend.id}
                className="revision-subject-card"
              >
                <div
                  onClick={() =>
                    openProfile(
                      friend.id
                    )
                  }
                  style={{
                    cursor:
                      "pointer",
                  }}
                >
                  <div className="revision-subject-top">
                    <div className="revision-subject-icon">
                      👤
                    </div>

                    <div className="revision-subject-arrow">
                      →
                    </div>
                  </div>

                  <div className="revision-subject-content">
                    <h3>
                      {friend.full_name ||
                        "Student"}
                    </h3>

                    <p>
                      {friend.year_group ||
                        "Sixth Form"}
                    </p>

                    <p
                      style={{
                        marginTop:
                          "8px",
                        fontSize:
                          "13px",
                        color:
                          "#4f46e5",
                        fontWeight:
                          "600",
                      }}
                    >
                      View Profile →
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() =>
                    removeFriend(
                      friend.id
                    )
                  }
                  disabled={
                    actionLoading ===
                    friend.id
                  }
                  style={{
                    marginTop:
                      "15px",
                    width:
                      "100%",
                    padding:
                      "10px",
                    borderRadius:
                      "10px",
                    border:
                      "1px solid #dbe3ef",
                    background:
                      "white",
                    cursor:
                      "pointer",
                  }}
                >
                  {actionLoading ===
                  friend.id
                    ? "Removing..."
                    : "Remove Friend"}
                </button>
              </div>
            )
          )}
        </div>
      ) : (
        <div className="no-subjects">
          <div className="no-subjects-icon">
            🤝
          </div>

          <h3>
            No friends yet
          </h3>

          <p>
            Find students below and
            send them a friend
            request.
          </p>
        </div>
      )}

      {/* =====================================================
          FRIEND REQUESTS
          ===================================================== */}

      <div
        className="revision-section-heading"
        style={{
          marginTop:
            "35px",
        }}
      >
        <div>
          <h3>
            Friend Requests 📥
          </h3>

          <p>
            {requests.length}{" "}
            pending request
            {requests.length ===
            1
              ? ""
              : "s"}
          </p>
        </div>
      </div>

      {requests.length > 0 ? (
        <div className="revision-subject-grid">
          {requests.map(
            (request) => {
              const sender =
                getStudent(
                  request.sender_id
                );

              return (
                <div
                  key={
                    request.id
                  }
                  className="revision-subject-card"
                >
                  <div
                    onClick={() => {
                      if (sender) {
                        openProfile(
                          sender.id
                        );
                      }
                    }}
                    style={{
                      cursor:
                        sender
                          ? "pointer"
                          : "default",
                    }}
                  >
                    <div className="revision-subject-top">
                      <div className="revision-subject-icon">
                        👤
                      </div>

                      <div className="revision-subject-arrow">
                        📥
                      </div>
                    </div>

                    <div className="revision-subject-content">
                      <h3>
                        {sender?.full_name ||
                          "Student"}
                      </h3>

                      <p>
                        {sender?.year_group ||
                          "Sixth Form"}
                      </p>

                      {sender && (
                        <p
                          style={{
                            marginTop:
                              "8px",
                            fontSize:
                              "13px",
                            color:
                              "#4f46e5",
                            fontWeight:
                              "600",
                          }}
                        >
                          View Profile →
                        </p>
                      )}
                    </div>
                  </div>

                  <div
                    style={{
                      display:
                        "flex",
                      gap:
                        "10px",
                      marginTop:
                        "15px",
                    }}
                  >
                    <button
                      type="button"
                      className="primary-card-button"
                      disabled={
                        actionLoading ===
                        request.id
                      }
                      onClick={() =>
                        acceptRequest(
                          request.id
                        )
                      }
                    >
                      {actionLoading ===
                      request.id
                        ? "..."
                        : "✓ Accept"}
                    </button>

                    <button
                      type="button"
                      disabled={
                        actionLoading ===
                        request.id
                      }
                      onClick={() =>
                        declineRequest(
                          request.id
                        )
                      }
                      style={{
                        padding:
                          "10px 14px",
                        borderRadius:
                          "10px",
                        border:
                          "1px solid #dbe3ef",
                        background:
                          "white",
                        cursor:
                          "pointer",
                      }}
                    >
                      Decline
                    </button>
                  </div>
                </div>
              );
            }
          )}
        </div>
      ) : (
        <div
          style={{
            padding:
              "20px",
            borderRadius:
              "14px",
            background:
              "#f8fafc",
            color:
              "#64748b",
            textAlign:
              "center",
          }}
        >
          No pending friend
          requests.
        </div>
      )}

      {/* =====================================================
          FIND STUDENTS
          ===================================================== */}

      <div
        className="revision-section-heading"
        style={{
          marginTop:
            "35px",
        }}
      >
        <div>
          <h3>
            Find Students 🔎
          </h3>

          <p>
            Find other students using
            the revision app.
          </p>
        </div>
      </div>

      {/* SEARCH */}

      <div
        style={{
          marginBottom:
            "20px",
        }}
      >
        <input
          type="text"
          value={search}
          onChange={(event) =>
            setSearch(
              event.target.value
            )
          }
          placeholder="Search students..."
          style={{
            width:
              "100%",
            padding:
              "14px 16px",
            borderRadius:
              "12px",
            border:
              "1px solid #dbe3ef",
            fontSize:
              "15px",
            boxSizing:
              "border-box",
            outline:
              "none",
          }}
        />
      </div>

      {/* STUDENTS */}

      {filteredStudents.length >
      0 ? (
        <div className="revision-subject-grid">
          {filteredStudents.map(
            (student) => {
              const status =
                getStatus(
                  student.id
                );

              return (
                <div
                  key={
                    student.id
                  }
                  className="revision-subject-card"
                >
                  {/* PROFILE */}

                  <div
                    onClick={() =>
                      openProfile(
                        student.id
                      )
                    }
                    style={{
                      cursor:
                        "pointer",
                    }}
                  >
                    <div className="revision-subject-top">
                      <div className="revision-subject-icon">
                        👤
                      </div>

                      <div className="revision-subject-arrow">
                        →
                      </div>
                    </div>

                    <div className="revision-subject-content">
                      <h3>
                        {student.full_name ||
                          "Student"}
                      </h3>

                      <p>
                        {student.year_group ||
                          "Sixth Form"}
                      </p>

                      <p
                        style={{
                          marginTop:
                            "8px",
                          fontSize:
                            "13px",
                          color:
                            "#4f46e5",
                          fontWeight:
                            "600",
                        }}
                      >
                        View Profile →
                      </p>
                    </div>
                  </div>

                  {/* ADD FRIEND */}

                  {status ===
                    "none" && (
                    <button
                      type="button"
                      className="primary-card-button"
                      disabled={
                        actionLoading ===
                        student.id
                      }
                      onClick={() =>
                        sendFriendRequest(
                          student.id
                        )
                      }
                      style={{
                        width:
                          "100%",
                        marginTop:
                          "15px",
                      }}
                    >
                      {actionLoading ===
                      student.id
                        ? "Sending..."
                        : "➕ Add Friend"}
                    </button>
                  )}

                  {/* REQUEST SENT */}

                  {status ===
                    "sent" && (
                    <div
                      style={{
                        marginTop:
                          "15px",
                        padding:
                          "10px",
                        borderRadius:
                          "10px",
                        background:
                          "#f1f5f9",
                        textAlign:
                          "center",
                        fontSize:
                          "14px",
                        color:
                          "#64748b",
                      }}
                    >
                      📤 Request Sent
                    </div>
                  )}

                  {/* INCOMING REQUEST */}

                  {status ===
                    "incoming" && (
                    <div
                      style={{
                        marginTop:
                          "15px",
                      }}
                    >
                      <button
                        type="button"
                        className="primary-card-button"
                        style={{
                          width:
                            "100%",
                        }}
                        onClick={() => {
                          const request =
                            requests.find(
                              (item) =>
                                item.sender_id ===
                                student.id
                            );

                          if (request) {
                            acceptRequest(
                              request.id
                            );
                          }
                        }}
                      >
                        📥 Accept Request
                      </button>
                    </div>
                  )}

                  {/* FRIEND */}

                  {status ===
                    "friends" && (
                    <div
                      style={{
                        marginTop:
                          "15px",
                        padding:
                          "10px",
                        borderRadius:
                          "10px",
                        background:
                          "#ecfdf5",
                        color:
                          "#047857",
                        textAlign:
                          "center",
                        fontSize:
                          "14px",
                      }}
                    >
                      ✓ Friends
                    </div>
                  )}
                </div>
              );
            }
          )}
        </div>
      ) : (
        <div className="no-subjects">
          <div className="no-subjects-icon">
            🔎
          </div>

          <h3>
            No students found
          </h3>

          <p>
            Try a different search.
          </p>
        </div>
      )}
    </div>
  );
}

export default Friends;
