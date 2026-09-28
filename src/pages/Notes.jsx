import { useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabase";
import { QRCodeSVG } from "qrcode.react";

function Notes() {
  const [userId, setUserId] = useState(null);
  const [folders, setFolders] = useState([]);
  const [topics, setTopics] = useState([]);
  const [lessons, setLessons] = useState([]);

  const [selectedFolderId, setSelectedFolderId] = useState(null);
  const [selectedTopicId, setSelectedTopicId] = useState(null);
  const [selectedLessonId, setSelectedLessonId] = useState(null);

  const [folderName, setFolderName] = useState("");
  const [topicName, setTopicName] = useState("");
  const [lessonTitle, setLessonTitle] = useState("");
  const [lessonDate, setLessonDate] = useState("");
  const [lessonContent, setLessonContent] = useState("");
  const [lessonPublic, setLessonPublic] = useState(false);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  const [classes, setClasses] = useState([]);
  const [selectedClassId, setSelectedClassId] = useState("");
  const [className, setClassName] = useState("");
  const [classMembers, setClassMembers] = useState([]);
  const [availablePeople, setAvailablePeople] = useState([]);
  const [register, setRegister] = useState(null);
  const [registerEntries, setRegisterEntries] = useState([]);
  const [registerClosesAt, setRegisterClosesAt] = useState("");

  const [absenceApprovals, setAbsenceApprovals] = useState([]);
  const [approvalStudents, setApprovalStudents] = useState({});
  const [approvalLoading, setApprovalLoading] = useState(false);
  const [qrChallenge, setQrChallenge] = useState(null);
  const [qrBusy, setQrBusy] = useState(false);
  const [qrRedeeming, setQrRedeeming] = useState(false);
  const [emailSendingId, setEmailSendingId] = useState(null);

  const selectedFolder = useMemo(
    () => folders.find((item) => item.id === selectedFolderId) || null,
    [folders, selectedFolderId]
  );

  const selectedTopic = useMemo(
    () => topics.find((item) => item.id === selectedTopicId) || null,
    [topics, selectedTopicId]
  );

  const selectedLesson = useMemo(
    () => lessons.find((item) => item.id === selectedLessonId) || null,
    [lessons, selectedLessonId]
  );

  useEffect(() => {
    initialise();
  }, []);

  useEffect(() => {
    if (!selectedLesson) {
      setLessonTitle("");
      setLessonDate("");
      setLessonContent("");
      setLessonPublic(false);
      return;
    }

    setLessonTitle(selectedLesson.title || "");
    setLessonDate(selectedLesson.lesson_date || "");
    setLessonContent(selectedLesson.content || "");
    setLessonPublic(Boolean(selectedLesson.is_public));
  }, [selectedLesson]);

  useEffect(() => {
    if (selectedLessonId) {
      loadRegister(selectedLessonId);
    } else {
      setRegister(null);
      setRegisterEntries([]);
      setSelectedClassId("");
      setRegisterClosesAt("");
    }
  }, [selectedLessonId]);

  async function initialise() {
    setLoading(true);
    setMessage("");

    try {
      const {
        data: { user },
        error: authError,
      } = await supabase.auth.getUser();

      if (authError) throw authError;
      if (!user) throw new Error("You need to be signed in.");

      setUserId(user.id);
      await Promise.all([
        loadFolders(user.id),
        loadClasses(user.id),
        loadAvailablePeople(user.id),
        loadAbsenceApprovals(user.id),
      ]);
    } catch (error) {
      console.error(error);
      setMessage(error.message || "Could not load Notes.");
    } finally {
      setLoading(false);
    }
  }

  async function loadFolders(uid = userId) {
    if (!uid) return;

    const { data, error } = await supabase
      .from("note_folders")
      .select("*")
      .eq("user_id", uid)
      .order("created_at", { ascending: true });

    if (error) throw error;
    setFolders(data || []);
  }

  async function loadTopics(folderId) {
    setTopics([]);
    setLessons([]);
    setSelectedTopicId(null);
    setSelectedLessonId(null);

    if (!folderId) return;

    const { data, error } = await supabase
      .from("note_topics")
      .select("*")
      .eq("folder_id", folderId)
      .order("created_at", { ascending: true });

    if (error) {
      setMessage(error.message);
      return;
    }

    setTopics(data || []);
  }

  async function loadLessons(topicId) {
    setLessons([]);
    setSelectedLessonId(null);

    if (!topicId) return;

    const { data, error } = await supabase
      .from("note_lessons")
      .select("*")
      .eq("topic_id", topicId)
      .order("lesson_date", { ascending: false, nullsFirst: false })
      .order("created_at", { ascending: false });

    if (error) {
      setMessage(error.message);
      return;
    }

    setLessons(data || []);
  }

  useEffect(() => {
    if (!userId) return;

    const params = new URLSearchParams(window.location.search);
    const challengeId = params.get("noteQr");
    const token = params.get("token");

    if (!challengeId || !token) return;

    redeemScannedQr(challengeId, token);
  }, [userId]);

  async function redeemScannedQr(challengeId, token) {
    if (qrRedeeming) return;

    setQrRedeeming(true);
    setMessage("Checking QR authorisation...");

    const { data, error } = await supabase.rpc("redeem_note_qr_challenge", {
      p_challenge_id: challengeId,
      p_token: token,
    });

    const cleanUrl = `${window.location.origin}${window.location.pathname}`;
    window.history.replaceState({}, "", cleanUrl);

    setQrRedeeming(false);

    if (error) {
      setMessage(`QR authorisation failed: ${error.message}`);
      return;
    }

    setQrChallenge(null);
    setMessage(
      `QR authorisation successful ✓ ${data?.approved_students ?? ""} approved student${
        data?.approved_students === 1 ? "" : "s"
      } now have secure access to this lesson. No email has been sent yet.`
    );

    await loadAbsenceApprovals();
  }

  async function createQrChallenge(approval) {
    setQrBusy(true);
    setMessage("");

    const { data, error } = await supabase.rpc("create_note_qr_challenge", {
      p_approval_id: approval.id,
    });

    setQrBusy(false);

    if (error) {
      setMessage(error.message);
      return;
    }

    const challenge = Array.isArray(data) ? data[0] : data;

    if (!challenge?.challenge_id || !challenge?.qr_token) {
      setMessage("The QR challenge could not be created.");
      return;
    }

    // Always use the live app for QR scans.
    // A phone cannot open the computer's localhost Vite server.
const liveAppUrl =
  "https://tristan-and-jacob-revision-sixth-fo-gamma.vercel.app/";
    const url = new URL(liveAppUrl);
    url.searchParams.set("noteQr", challenge.challenge_id);
    url.searchParams.set("token", challenge.qr_token);

    setQrChallenge({
      approvalId: approval.id,
      challengeId: challenge.challenge_id,
      token: challenge.qr_token,
      expiresAt: challenge.challenge_expires_at,
      url: url.toString(),
    });
  }

  async function cancelQrChallenge() {
    if (!qrChallenge?.challengeId) {
      setQrChallenge(null);
      return;
    }

    setQrBusy(true);

    const { error } = await supabase.rpc("revoke_note_qr_challenge", {
      p_challenge_id: qrChallenge.challengeId,
    });

    setQrBusy(false);

    if (error) {
      setMessage(error.message);
      return;
    }

    setQrChallenge(null);
    setMessage("QR authorisation cancelled.");
  }

  async function sendApprovedNotes(approval) {
    setEmailSendingId(approval.id);
    setMessage("Sending approved lesson notes...");

    const { data, error } = await supabase.functions.invoke(
      "send-shared-notes",
      {
        body: {
          approval_id: approval.id,
        },
      }
    );

    setEmailSendingId(null);

    if (error) {
      console.error(error);
      setMessage(`Email could not be sent: ${error.message}`);
      return;
    }

    if (!data?.success) {
      const failed = data?.failed ?? 0;
      setMessage(
        `Email sending was not fully completed. ${failed} delivery${
          failed === 1 ? "" : "ies"
        } failed. You can retry safely.`
      );
      await loadAbsenceApprovals();
      return;
    }

    const sent = data?.sent ?? 0;
    const alreadySent = data?.already_sent ?? 0;

    setMessage(
      `Notes sent ✓ ${sent} new email${sent === 1 ? "" : "s"} sent${
        alreadySent
          ? `; ${alreadySent} already-sent delivery${
              alreadySent === 1 ? " was" : "ies were"
            } safely skipped`
          : ""
      }.`
    );

    await loadAbsenceApprovals();
  }

  async function loadAbsenceApprovals(uid = userId) {
    if (!uid) return;

    setApprovalLoading(true);

    const { data: approvals, error } = await supabase
      .from("note_absence_approvals")
      .select("*")
      .eq("owner_id", uid)
      .in("status", ["pending", "awaiting_qr", "approved", "failed", "sent"])
      .order("created_at", { ascending: false });

    if (error) {
      console.error(error);
      setMessage(error.message);
      setApprovalLoading(false);
      return;
    }

    if (!approvals?.length) {
      setAbsenceApprovals([]);
      setApprovalStudents({});
      setApprovalLoading(false);
      return;
    }

    const lessonIds = [...new Set(approvals.map((a) => a.lesson_id))];
    const registerIds = [...new Set(approvals.map((a) => a.register_id))];
    const approvalIds = approvals.map((a) => a.id);

    const [
      { data: lessonRows },
      { data: registerRows },
      { data: studentRows, error: studentError },
    ] = await Promise.all([
      supabase.from("note_lessons").select("id, title, lesson_date").in("id", lessonIds),
      supabase
        .from("note_lesson_registers")
        .select("id, class_id, closes_at")
        .in("id", registerIds),
      supabase
        .from("note_absence_approval_students")
        .select("*")
        .in("approval_id", approvalIds)
        .order("created_at", { ascending: true }),
    ]);

    if (studentError) {
      setMessage(studentError.message);
      setApprovalLoading(false);
      return;
    }

    const classIds = [
      ...new Set((registerRows || []).map((r) => r.class_id).filter(Boolean)),
    ];

    const { data: classRows } = classIds.length
      ? await supabase.from("note_classes").select("id, name").in("id", classIds)
      : { data: [] };

    const studentIds = [
      ...new Set((studentRows || []).map((row) => row.student_id)),
    ];

    const { data: profiles, error: profileError } = studentIds.length
      ? await supabase
          .from("profiles")
          .select("id, full_name, year_group")
          .in("id", studentIds)
      : { data: [], error: null };

    if (profileError) {
      setMessage(profileError.message);
      setApprovalLoading(false);
      return;
    }

    const lessonMap = new Map((lessonRows || []).map((row) => [row.id, row]));
    const registerMap = new Map((registerRows || []).map((row) => [row.id, row]));
    const classMap = new Map((classRows || []).map((row) => [row.id, row]));
    const profileMap = new Map((profiles || []).map((row) => [row.id, row]));

    setAbsenceApprovals(
      approvals.map((approval) => {
        const reg = registerMap.get(approval.register_id);
        return {
          ...approval,
          lesson: lessonMap.get(approval.lesson_id) || null,
          register: reg || null,
          classInfo: reg ? classMap.get(reg.class_id) || null : null,
        };
      })
    );

    const grouped = {};
    for (const row of studentRows || []) {
      if (!grouped[row.approval_id]) grouped[row.approval_id] = [];
      grouped[row.approval_id].push({
        ...row,
        profile: profileMap.get(row.student_id) || null,
        selected: row.decision !== "declined",
      });
    }

    setApprovalStudents(grouped);
    setApprovalLoading(false);
  }

  function toggleApprovalStudent(approvalId, studentRowId) {
    setApprovalStudents((current) => ({
      ...current,
      [approvalId]: (current[approvalId] || []).map((student) =>
        student.id === studentRowId
          ? { ...student, selected: !student.selected }
          : student
      ),
    }));
  }

  async function declineApproval(approval) {
    const students = approvalStudents[approval.id] || [];

    if (
      !window.confirm(
        "Decline sharing these lesson notes with all students in this request?"
      )
    ) {
      return;
    }

    setSaving(true);
    setMessage("");

    const now = new Date().toISOString();

    if (students.length) {
      const { error: studentError } = await supabase
        .from("note_absence_approval_students")
        .update({ decision: "declined", decided_at: now })
        .eq("approval_id", approval.id);

      if (studentError) {
        setSaving(false);
        setMessage(studentError.message);
        return;
      }
    }

    const { error } = await supabase
      .from("note_absence_approvals")
      .update({
        status: "declined",
        reviewed_at: now,
      })
      .eq("id", approval.id);

    setSaving(false);

    if (error) {
      setMessage(error.message);
      return;
    }

    setMessage("Notes sharing declined.");
    await loadAbsenceApprovals();
  }

  async function continueApproval(approval) {
    const students = approvalStudents[approval.id] || [];
    const selected = students.filter((student) => student.selected);

    if (!selected.length) {
      setMessage("Select at least one student, or choose Decline.");
      return;
    }

    setSaving(true);
    setMessage("");

    const now = new Date().toISOString();

    for (const student of students) {
      const decision = student.selected ? "approved" : "declined";

      const { error } = await supabase
        .from("note_absence_approval_students")
        .update({
          decision,
          decided_at: now,
        })
        .eq("id", student.id);

      if (error) {
        setSaving(false);
        setMessage(error.message);
        return;
      }
    }

    const { error } = await supabase
      .from("note_absence_approvals")
      .update({
        status: "awaiting_qr",
        reviewed_at: now,
      })
      .eq("id", approval.id);

    setSaving(false);

    if (error) {
      setMessage(error.message);
      return;
    }

    setMessage(
      "Selection saved ✓ Generate the one-time QR below to authorise access. No email has been sent yet."
    );

    await loadAbsenceApprovals();
  }

  function formatRegisterDate(value) {
    if (!value) return "Unknown closing time";

    return new Intl.DateTimeFormat(undefined, {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(new Date(value));
  }

  async function loadClasses(uid = userId) {
    if (!uid) return;

    const { data, error } = await supabase
      .from("note_classes")
      .select("*")
      .eq("owner_id", uid)
      .order("name", { ascending: true });

    if (error) throw error;
    setClasses(data || []);
  }

  async function loadAvailablePeople(uid = userId) {
    if (!uid) return;

    const { data: requests, error: requestError } = await supabase
      .from("friend_requests")
      .select("sender_id, receiver_id")
      .eq("status", "accepted")
      .or(`sender_id.eq.${uid},receiver_id.eq.${uid}`);

    if (requestError) {
      console.error("Could not load friends for Notes:", requestError);
      setAvailablePeople([]);
      return;
    }

    const ids = [
      ...new Set(
        (requests || []).map((request) =>
          request.sender_id === uid ? request.receiver_id : request.sender_id
        )
      ),
    ];

    if (!ids.length) {
      setAvailablePeople([]);
      return;
    }

    const { data: profiles, error: profileError } = await supabase
      .from("profiles")
      .select("id, full_name, school_email, year_group")
      .in("id", ids)
      .order("full_name", { ascending: true });

    if (profileError) {
      console.error("Could not load friend profiles for Notes:", profileError);
      setAvailablePeople([]);
      return;
    }

    setAvailablePeople(profiles || []);
  }

  async function createClass(event) {
    event.preventDefault();
    const name = className.trim();
    if (!name || !userId) return;

    setSaving(true);
    setMessage("");

    const { data, error } = await supabase
      .from("note_classes")
      .insert({ owner_id: userId, name })
      .select()
      .single();

    setSaving(false);

    if (error) {
      setMessage(error.message);
      return;
    }

    setClassName("");
    await loadClasses();
    setSelectedClassId(data.id);
    await loadClassMembers(data.id);
  }

  async function loadClassMembers(classId) {
    if (!classId) {
      setClassMembers([]);
      return;
    }

    const { data: rows, error } = await supabase
      .from("note_class_members")
      .select("id, user_id, added_at")
      .eq("class_id", classId)
      .order("added_at", { ascending: true });

    if (error) {
      setMessage(error.message);
      return;
    }

    const ids = (rows || []).map((row) => row.user_id);

    if (!ids.length) {
      setClassMembers([]);
      return;
    }

    const { data: profiles, error: profileError } = await supabase
      .from("profiles")
      .select("id, full_name, school_email, year_group")
      .in("id", ids);

    if (profileError) {
      setMessage(profileError.message);
      return;
    }

    const profileMap = new Map((profiles || []).map((profile) => [profile.id, profile]));

    setClassMembers(
      (rows || []).map((row) => ({
        ...row,
        profile: profileMap.get(row.user_id) || null,
      }))
    );
  }

  async function addClassMember(person) {
    if (!selectedClassId || !person?.id) return;

    setMessage("");

    const { error } = await supabase
      .from("note_class_members")
      .insert({
        class_id: selectedClassId,
        user_id: person.id,
      });

    if (error) {
      if (error.code === "23505") {
        setMessage(`${person.full_name || "That person"} is already in this class.`);
      } else {
        setMessage(error.message);
      }
      return;
    }

    await loadClassMembers(selectedClassId);
  }

  async function removeClassMember(member) {
    const name = member.profile?.full_name || "this person";

    if (!window.confirm(`Remove ${name} from this class?`)) return;

    const { error } = await supabase
      .from("note_class_members")
      .delete()
      .eq("id", member.id);

    if (error) {
      setMessage(error.message);
      return;
    }

    await loadClassMembers(selectedClassId);
  }

  async function deleteClass(item) {
    if (!window.confirm(`Delete the class "${item.name}"?`)) return;

    const { error } = await supabase
      .from("note_classes")
      .delete()
      .eq("id", item.id);

    if (error) {
      setMessage(error.message);
      return;
    }

    if (selectedClassId === item.id) {
      setSelectedClassId("");
      setClassMembers([]);
    }

    await loadClasses();
  }

  async function loadRegister(lessonId) {
    setRegister(null);
    setRegisterEntries([]);

    const { data, error } = await supabase
      .from("note_lesson_registers")
      .select("*")
      .eq("lesson_id", lessonId)
      .maybeSingle();

    if (error) {
      setMessage(error.message);
      return;
    }

    if (!data) {
      setSelectedClassId("");
      setRegisterClosesAt("");
      return;
    }

    setRegister(data);
    setSelectedClassId(data.class_id);
    setRegisterClosesAt(toLocalDateTimeInput(data.closes_at));
    await loadClassMembers(data.class_id);
    await loadRegisterEntries(data.id);
  }

  async function loadRegisterEntries(registerId) {
    const { data: rows, error } = await supabase
      .from("note_register_entries")
      .select("*")
      .eq("register_id", registerId)
      .order("created_at", { ascending: true });

    if (error) {
      setMessage(error.message);
      return;
    }

    const ids = (rows || []).map((row) => row.student_id);

    if (!ids.length) {
      setRegisterEntries([]);
      return;
    }

    const { data: profiles, error: profileError } = await supabase
      .from("profiles")
      .select("id, full_name, school_email, year_group")
      .in("id", ids);

    if (profileError) {
      setMessage(profileError.message);
      return;
    }

    const profileMap = new Map((profiles || []).map((profile) => [profile.id, profile]));

    setRegisterEntries(
      (rows || []).map((row) => ({
        ...row,
        profile: profileMap.get(row.student_id) || null,
      }))
    );
  }

  async function createRegister() {
    if (!selectedLessonId || !selectedClassId || !registerClosesAt || !userId) {
      setMessage("Choose a class and a register closing time first.");
      return;
    }

    await loadClassMembers(selectedClassId);

    const { data: members, error: memberError } = await supabase
      .from("note_class_members")
      .select("user_id")
      .eq("class_id", selectedClassId);

    if (memberError) {
      setMessage(memberError.message);
      return;
    }

    if (!members?.length) {
      setMessage("Add at least one person to the class before creating the register.");
      return;
    }

    setSaving(true);
    setMessage("");

    const closesAtIso = new Date(registerClosesAt).toISOString();

    const { data: newRegister, error } = await supabase
      .from("note_lesson_registers")
      .insert({
        lesson_id: selectedLessonId,
        class_id: selectedClassId,
        owner_id: userId,
        closes_at: closesAtIso,
        status: "open",
      })
      .select()
      .single();

    if (error) {
      setSaving(false);
      setMessage(error.message);
      return;
    }

    const entries = members.map((member) => ({
      register_id: newRegister.id,
      student_id: member.user_id,
      present: false,
    }));

    const { error: entryError } = await supabase
      .from("note_register_entries")
      .insert(entries);

    setSaving(false);

    if (entryError) {
      await supabase.from("note_lesson_registers").delete().eq("id", newRegister.id);
      setMessage(entryError.message);
      return;
    }

    setMessage("Register created ✓");
    await loadRegister(selectedLessonId);
  }

  async function togglePresent(entry) {
    if (!register || register.status !== "open") return;

    const nextPresent = !entry.present;

    const { error } = await supabase
      .from("note_register_entries")
      .update({
        present: nextPresent,
        marked_at: nextPresent ? new Date().toISOString() : null,
      })
      .eq("id", entry.id);

    if (error) {
      setMessage(error.message);
      return;
    }

    setRegisterEntries((current) =>
      current.map((item) =>
        item.id === entry.id
          ? {
              ...item,
              present: nextPresent,
              marked_at: nextPresent ? new Date().toISOString() : null,
            }
          : item
      )
    );
  }

  async function saveRegisterSettings() {
    if (!register || !registerClosesAt) return;

    const { error } = await supabase
      .from("note_lesson_registers")
      .update({
        closes_at: new Date(registerClosesAt).toISOString(),
      })
      .eq("id", register.id);

    if (error) {
      setMessage(error.message);
      return;
    }

    setMessage("Register saved ✓");
    await loadRegister(selectedLessonId);
  }

  function toLocalDateTimeInput(value) {
    if (!value) return "";
    const date = new Date(value);
    const offset = date.getTimezoneOffset();
    const local = new Date(date.getTime() - offset * 60000);
    return local.toISOString().slice(0, 16);
  }

  async function createFolder(event) {
    event.preventDefault();
    const name = folderName.trim();
    if (!name || !userId) return;

    setSaving(true);
    setMessage("");

    const { data, error } = await supabase
      .from("note_folders")
      .insert({ user_id: userId, name })
      .select()
      .single();

    setSaving(false);

    if (error) {
      setMessage(error.message);
      return;
    }

    setFolderName("");
    await loadFolders();
    setSelectedFolderId(data.id);
    await loadTopics(data.id);
  }

  async function createTopic(event) {
    event.preventDefault();
    const name = topicName.trim();
    if (!name || !selectedFolderId || !userId) return;

    setSaving(true);
    setMessage("");

    const { data, error } = await supabase
      .from("note_topics")
      .insert({
        folder_id: selectedFolderId,
        user_id: userId,
        name,
      })
      .select()
      .single();

    setSaving(false);

    if (error) {
      setMessage(error.message);
      return;
    }

    setTopicName("");
    await loadTopics(selectedFolderId);
    setSelectedTopicId(data.id);
    await loadLessons(data.id);
  }

  async function createLesson() {
    if (!selectedTopicId || !userId) return;

    setSaving(true);
    setMessage("");

    const { data, error } = await supabase
      .from("note_lessons")
      .insert({
        topic_id: selectedTopicId,
        user_id: userId,
        title: "New lesson",
        content: "",
        is_public: false,
      })
      .select()
      .single();

    setSaving(false);

    if (error) {
      setMessage(error.message);
      return;
    }

    await loadLessons(selectedTopicId);
    setSelectedLessonId(data.id);
  }

  async function saveLesson() {
    if (!selectedLessonId) return;
    if (!lessonTitle.trim()) {
      setMessage("Give the lesson a title before saving.");
      return;
    }

    setSaving(true);
    setMessage("");

    const { error } = await supabase
      .from("note_lessons")
      .update({
        title: lessonTitle.trim(),
        lesson_date: lessonDate || null,
        content: lessonContent,
        is_public: lessonPublic,
      })
      .eq("id", selectedLessonId);

    setSaving(false);

    if (error) {
      setMessage(error.message);
      return;
    }

    setMessage("Lesson saved ✓");
    await loadLessons(selectedTopicId);
    setSelectedLessonId(selectedLessonId);
  }

  async function deleteFolder(folder) {
    if (!window.confirm(`Delete "${folder.name}" and all of its topics and lessons?`)) {
      return;
    }

    const { error } = await supabase
      .from("note_folders")
      .delete()
      .eq("id", folder.id);

    if (error) {
      setMessage(error.message);
      return;
    }

    setSelectedFolderId(null);
    setSelectedTopicId(null);
    setSelectedLessonId(null);
    setTopics([]);
    setLessons([]);
    await loadFolders();
  }

  async function deleteTopic(topic) {
    if (!window.confirm(`Delete "${topic.name}" and all lessons inside it?`)) {
      return;
    }

    const { error } = await supabase
      .from("note_topics")
      .delete()
      .eq("id", topic.id);

    if (error) {
      setMessage(error.message);
      return;
    }

    setSelectedTopicId(null);
    setSelectedLessonId(null);
    setLessons([]);
    await loadTopics(selectedFolderId);
  }

  async function deleteLesson(lesson) {
    if (!window.confirm(`Delete "${lesson.title}"?`)) return;

    const { error } = await supabase
      .from("note_lessons")
      .delete()
      .eq("id", lesson.id);

    if (error) {
      setMessage(error.message);
      return;
    }

    setSelectedLessonId(null);
    await loadLessons(selectedTopicId);
  }

  if (loading) {
    return <div style={styles.loading}>Loading your notes...</div>;
  }

  return (
    <div style={styles.page}>
      <div style={styles.hero}>
        <div>
          <div style={styles.eyebrow}>YOUR NOTEBOOK</div>
          <h2 style={styles.heroTitle}>Notes</h2>
          <p style={styles.heroText}>
            Your private sixth-form notebook — organise lessons, take attendance and securely share the right notes.
          </p>
        </div>
        <div style={styles.heroBadge}>📒</div>
      </div>

      {message && <div style={styles.message}>{message}</div>}

      <div style={styles.columns}>
        <section style={styles.panel}>
          <div style={styles.panelHeading}>
            <div>
              <div style={styles.step}>STEP 1</div>
              <h3 style={styles.panelTitle}>📁 Folders</h3>
            </div>
          </div>

          <form onSubmit={createFolder} style={styles.createRow}>
            <input
              style={styles.input}
              value={folderName}
              onChange={(e) => setFolderName(e.target.value)}
              placeholder="e.g. History"
              maxLength={100}
            />
            <button style={styles.addButton} disabled={saving || !folderName.trim()}>
              +
            </button>
          </form>

          <div style={styles.list}>
            {folders.length === 0 && (
              <Empty text="Create your first folder." />
            )}

            {folders.map((folder) => (
              <Item
                key={folder.id}
                active={folder.id === selectedFolderId}
                icon="📁"
                title={folder.name}
                onClick={async () => {
                  setSelectedFolderId(folder.id);
                  await loadTopics(folder.id);
                }}
                onDelete={() => deleteFolder(folder)}
              />
            ))}
          </div>
        </section>

        <section style={styles.panel}>
          <div style={styles.panelHeading}>
            <div>
              <div style={styles.step}>STEP 2</div>
              <h3 style={styles.panelTitle}>🗂️ Topics</h3>
            </div>
          </div>

          {!selectedFolder ? (
            <Empty text="Select a folder first." />
          ) : (
            <>
              <div style={styles.contextLabel}>Inside {selectedFolder.name}</div>
              <form onSubmit={createTopic} style={styles.createRow}>
                <input
                  style={styles.input}
                  value={topicName}
                  onChange={(e) => setTopicName(e.target.value)}
                  placeholder="e.g. American Civil War"
                  maxLength={150}
                />
                <button style={styles.addButton} disabled={saving || !topicName.trim()}>
                  +
                </button>
              </form>

              <div style={styles.list}>
                {topics.length === 0 && <Empty text="No topics yet." />}

                {topics.map((topic) => (
                  <Item
                    key={topic.id}
                    active={topic.id === selectedTopicId}
                    icon="🗂️"
                    title={topic.name}
                    onClick={async () => {
                      setSelectedTopicId(topic.id);
                      await loadLessons(topic.id);
                    }}
                    onDelete={() => deleteTopic(topic)}
                  />
                ))}
              </div>
            </>
          )}
        </section>

        <section style={styles.panel}>
          <div style={styles.panelHeading}>
            <div>
              <div style={styles.step}>STEP 3</div>
              <h3 style={styles.panelTitle}>📖 Lessons</h3>
            </div>
            {selectedTopic && (
              <button
                type="button"
                style={styles.newLessonButton}
                onClick={createLesson}
                disabled={saving}
              >
                + Lesson
              </button>
            )}
          </div>

          {!selectedTopic ? (
            <Empty text="Select a topic first." />
          ) : (
            <>
              <div style={styles.contextLabel}>Inside {selectedTopic.name}</div>
              <div style={styles.list}>
                {lessons.length === 0 && <Empty text="No lessons yet." />}

                {lessons.map((lesson) => (
                  <Item
                    key={lesson.id}
                    active={lesson.id === selectedLessonId}
                    icon={lesson.is_public ? "🌍" : "📖"}
                    title={lesson.title}
                    subtitle={lesson.lesson_date || (lesson.is_public ? "Public" : "Private")}
                    onClick={() => setSelectedLessonId(lesson.id)}
                    onDelete={() => deleteLesson(lesson)}
                  />
                ))}
              </div>
            </>
          )}
        </section>
      </div>

      {selectedLesson && (
        <section style={styles.editorCard}>
          <div style={styles.editorHeader}>
            <div>
              <div style={styles.step}>LESSON NOTES</div>
              <h3 style={styles.editorTitle}>{selectedLesson.title}</h3>
            </div>
            <div style={styles.visibilityBadge}>
              {lessonPublic ? "🌍 Public" : "🔒 Private"}
            </div>
          </div>

          <div style={styles.formGrid}>
            <label style={styles.label}>
              Lesson title
              <input
                style={styles.input}
                value={lessonTitle}
                onChange={(e) => setLessonTitle(e.target.value)}
                maxLength={200}
              />
            </label>

            <label style={styles.label}>
              Lesson date
              <input
                style={styles.input}
                type="date"
                value={lessonDate}
                onChange={(e) => setLessonDate(e.target.value)}
              />
            </label>
          </div>

          <label style={styles.label}>
            Notes
            <textarea
              style={styles.textarea}
              value={lessonContent}
              onChange={(e) => setLessonContent(e.target.value)}
              placeholder="Write the notes for this lesson here..."
            />
          </label>

          <div style={styles.editorFooter}>
            <label style={styles.toggleRow}>
              <input
                type="checkbox"
                checked={lessonPublic}
                onChange={(e) => setLessonPublic(e.target.checked)}
              />
              <span>
                <strong>Make this lesson public</strong>
                <small style={styles.smallText}>
                  Later, other users will be able to view published notes from your profile.
                </small>
              </span>
            </label>

            <button
              type="button"
              style={styles.saveButton}
              onClick={saveLesson}
              disabled={saving}
            >
              {saving ? "Saving..." : "Save lesson"}
            </button>
          </div>
        </section>
      )}

      <section style={styles.approvalCard}>
        <div style={styles.editorHeader}>
          <div>
            <div style={styles.step}>ABSENCE FOLLOW-UP</div>
            <h3 style={styles.editorTitle}>📨 Notes sharing approvals</h3>
          </div>

          {absenceApprovals.length > 0 && (
            <div style={styles.approvalCount}>
              {absenceApprovals.length} pending
            </div>
          )}
        </div>

        {approvalLoading ? (
          <Empty text="Loading approval requests..." />
        ) : absenceApprovals.length === 0 ? (
          <div style={styles.approvalEmpty}>
            <span style={styles.approvalEmptyIcon}>✓</span>
            <div>
              <strong>No approvals waiting</strong>
              <p style={styles.nextText}>
                When a register closes with somebody not marked present,
                the request will appear here automatically.
              </p>
            </div>
          </div>
        ) : (
          <div style={styles.approvalList}>
            {absenceApprovals.map((approval) => {
              const students = approvalStudents[approval.id] || [];
              const selectedCount = students.filter(
                (student) => student.selected
              ).length;

              return (
                <div key={approval.id} style={styles.approvalRequest}>
                  <div style={styles.approvalTop}>
                    <div>
                      <div style={styles.approvalClass}>
                        {approval.classInfo?.name || "Class"}
                      </div>
                      <h4 style={styles.approvalLesson}>
                        {approval.lesson?.title || "Lesson"}
                      </h4>
                      <div style={styles.approvalMeta}>
                        Register closed {formatRegisterDate(approval.register?.closes_at)}
                      </div>
                    </div>

                    <span
                      style={{
                        ...styles.pendingPill,
                        ...(approval.status === "sent" ? styles.sentPill : {}),
                        ...(approval.status === "failed" ? styles.failedPill : {}),
                      }}
                    >
                      {approval.status === "pending"
                        ? "Needs review"
                        : approval.status === "awaiting_qr"
                        ? "Awaiting QR"
                        : approval.status === "approved"
                        ? "QR approved"
                        : approval.status === "failed"
                        ? "Send failed"
                        : "Sent"}
                    </span>
                  </div>

                  <div style={styles.approvalExplanation}>
                    {students.length === 1
                      ? "1 student was not marked present."
                      : `${students.length} students were not marked present.`}
                    {" "}Choose who should receive access to this lesson's notes.
                  </div>

                  <div style={styles.approvalStudentList}>
                    {students.map((student) => (
                      <label key={student.id} style={styles.approvalStudent}>
                        <input
                          type="checkbox"
                          checked={Boolean(student.selected)}
                          onChange={() =>
                            toggleApprovalStudent(approval.id, student.id)
                          }
                          disabled={approval.status !== "pending"}
                        />

                        <span style={styles.registerName}>
                          <strong>
                            {student.profile?.full_name || "Student"}
                          </strong>
                          <small style={styles.personMeta}>
                            {student.profile?.year_group || "App user"}
                          </small>
                        </span>

                        <span
                          style={{
                            ...styles.statusPill,
                            ...(student.selected
                              ? styles.sendPill
                              : styles.skipPill),
                          }}
                        >
                          {student.selected ? "Send notes" : "Don't send"}
                        </span>
                      </label>
                    ))}
                  </div>

                  {approval.status === "pending" ? (
                    <>
                      <div style={styles.approvalFooter}>
                        <span style={styles.approvalSelection}>
                          {selectedCount} of {students.length} selected
                        </span>

                        <div style={styles.approvalButtons}>
                          <button
                            type="button"
                            style={styles.declineButton}
                            onClick={() => declineApproval(approval)}
                            disabled={saving}
                          >
                            Decline
                          </button>

                          <button
                            type="button"
                            style={styles.saveButton}
                            onClick={() => continueApproval(approval)}
                            disabled={saving || selectedCount === 0}
                          >
                            Continue to QR approval
                          </button>
                        </div>
                      </div>

                      <div style={styles.securityNote}>
                        🔐 Continuing does not send an email. It records your
                        selection ready for one-time QR authorisation.
                      </div>
                    </>
                  ) : approval.status === "awaiting_qr" ? (
                    <>
                      <div style={styles.approvalFooter}>
                        <span style={styles.approvalSelection}>
                          Selection saved — waiting for QR authorisation
                        </span>

                        <button
                          type="button"
                          style={styles.saveButton}
                          onClick={() => createQrChallenge(approval)}
                          disabled={qrBusy}
                        >
                          {qrBusy ? "Creating QR..." : "Generate one-time QR"}
                        </button>
                      </div>

                      {qrChallenge?.approvalId === approval.id && (
                        <div style={styles.qrPanel}>
                          <div style={styles.qrBox}>
                            <QRCodeSVG
                              value={qrChallenge.url}
                              size={220}
                              level="M"
                              includeMargin
                            />
                          </div>

                          <div style={styles.qrInfo}>
                            <strong>Scan this with your phone</strong>
                            <p style={styles.nextText}>
                              Open the QR while signed into this same Tristan
                              Revision account. It expires after 5 minutes and
                              can only be used once.
                            </p>
                            <p style={styles.qrExpiry}>
                              Expires {formatRegisterDate(qrChallenge.expiresAt)}
                            </p>
                            <button
                              type="button"
                              style={styles.declineButton}
                              onClick={cancelQrChallenge}
                              disabled={qrBusy}
                            >
                              Cancel QR
                            </button>
                          </div>
                        </div>
                      )}

                      <div style={styles.securityNote}>
                        🔐 The QR contains a temporary one-time token, not your
                        password or Resend key.
                      </div>
                    </>
                  ) : approval.status === "approved" || approval.status === "failed" ? (
                    <>
                      <div style={styles.deliveryPanel}>
                        <div>
                          <strong>
                            {approval.status === "failed"
                              ? "Email needs another attempt"
                              : "QR authorisation complete ✓"}
                          </strong>
                          <p style={styles.nextText}>
                            Secure lesson access has been granted to the approved
                            student{selectedCount === 1 ? "" : "s"}. The email
                            has not been marked as sent yet.
                          </p>
                        </div>

                        <button
                          type="button"
                          style={styles.saveButton}
                          onClick={() => sendApprovedNotes(approval)}
                          disabled={emailSendingId === approval.id}
                        >
                          {emailSendingId === approval.id
                            ? "Sending..."
                            : approval.status === "failed"
                            ? "Retry email safely"
                            : "Send approved notes"}
                        </button>
                      </div>

                      <div style={styles.securityNote}>
                        ✉️ Sending runs through the protected Supabase Edge
                        Function. Already-sent recipients are skipped on retries.
                      </div>
                    </>
                  ) : (
                    <div style={styles.sentPanel}>
                      <strong>Notes sent ✓</strong>
                      <p style={styles.nextText}>
                        The approved lesson-note email has been sent. The
                        recipient's lesson access remains tied to their Tristan
                        Revision account.
                      </p>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </section>

      <section style={styles.attendanceCard}>
        <div style={styles.editorHeader}>
          <div>
            <div style={styles.step}>STAGE 2</div>
            <h3 style={styles.editorTitle}>🧑‍🏫 Classes & Attendance</h3>
          </div>
          <div style={styles.visibilityBadge}>Private</div>
        </div>

        <div style={styles.attendanceGrid}>
          <div style={styles.attendancePanel}>
            <h4 style={styles.sectionTitle}>Your classes</h4>

            <form onSubmit={createClass} style={styles.createRow}>
              <input
                style={styles.input}
                value={className}
                onChange={(e) => setClassName(e.target.value)}
                placeholder="e.g. AS History"
                maxLength={100}
              />
              <button
                style={styles.addButton}
                disabled={saving || !className.trim()}
              >
                +
              </button>
            </form>

            <div style={styles.classChips}>
              {classes.length === 0 && <Empty text="Create a class first." />}

              {classes.map((item) => (
                <div key={item.id} style={styles.classChipWrap}>
                  <button
                    type="button"
                    style={{
                      ...styles.classChip,
                      ...(selectedClassId === item.id ? styles.classChipActive : {}),
                    }}
                    onClick={async () => {
                      if (register && register.class_id !== item.id) return;
                      setSelectedClassId(item.id);
                      await loadClassMembers(item.id);
                    }}
                  >
                    {item.name}
                  </button>

                  {!register && (
                    <button
                      type="button"
                      style={styles.classDelete}
                      onClick={() => deleteClass(item)}
                      title="Delete class"
                    >
                      ×
                    </button>
                  )}
                </div>
              ))}
            </div>

            {selectedClassId && (
              <>
                <h4 style={{ ...styles.sectionTitle, marginTop: "20px" }}>
                  Class members
                </h4>

                <div style={styles.peopleList}>
                  {classMembers.length === 0 && (
                    <Empty text="No students have been added yet." />
                  )}

                  {classMembers.map((member) => (
                    <div key={member.id} style={styles.personRow}>
                      <div>
                        <strong>
                          {member.profile?.full_name || "App user"}
                        </strong>
                        <div style={styles.personMeta}>
                          {member.profile?.year_group || "Student"}
                        </div>
                      </div>

                      {!register && (
                        <button
                          type="button"
                          style={styles.removeButton}
                          onClick={() => removeClassMember(member)}
                        >
                          Remove
                        </button>
                      )}
                    </div>
                  ))}
                </div>

                {!register && (
                  <>
                    <h4 style={{ ...styles.sectionTitle, marginTop: "20px" }}>
                      Add friends
                    </h4>

                    <div style={styles.peopleList}>
                      {availablePeople.filter(
                        (person) =>
                          !classMembers.some((member) => member.user_id === person.id)
                      ).length === 0 ? (
                        <Empty text="No other accepted friends to add." />
                      ) : (
                        availablePeople
                          .filter(
                            (person) =>
                              !classMembers.some(
                                (member) => member.user_id === person.id
                              )
                          )
                          .map((person) => (
                            <div key={person.id} style={styles.personRow}>
                              <div>
                                <strong>{person.full_name || "App user"}</strong>
                                <div style={styles.personMeta}>
                                  {person.year_group || "Student"}
                                </div>
                              </div>

                              <button
                                type="button"
                                style={styles.miniButton}
                                onClick={() => addClassMember(person)}
                              >
                                + Add
                              </button>
                            </div>
                          ))
                      )}
                    </div>
                  </>
                )}
              </>
            )}
          </div>

          <div style={styles.attendancePanel}>
            <h4 style={styles.sectionTitle}>Lesson register</h4>

            {!selectedLesson ? (
              <Empty text="Select a lesson above to create its register." />
            ) : !register ? (
              <>
                <div style={styles.registerLesson}>
                  <strong>{selectedLesson.title}</strong>
                  <span>
                    {selectedLesson.lesson_date || "No lesson date selected"}
                  </span>
                </div>

                <label style={styles.label}>
                  Class
                  <select
                    style={styles.input}
                    value={selectedClassId}
                    onChange={async (e) => {
                      setSelectedClassId(e.target.value);
                      await loadClassMembers(e.target.value);
                    }}
                  >
                    <option value="">Choose a class...</option>
                    {classes.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.name}
                      </option>
                    ))}
                  </select>
                </label>

                <label style={{ ...styles.label, marginTop: "12px" }}>
                  Register closes at
                  <input
                    style={styles.input}
                    type="datetime-local"
                    value={registerClosesAt}
                    onChange={(e) => setRegisterClosesAt(e.target.value)}
                  />
                </label>

                <p style={styles.helperText}>
                  Everyone in the class is copied into this lesson's register.
                  Unticked students remain not marked present.
                </p>

                <button
                  type="button"
                  style={styles.saveButton}
                  onClick={createRegister}
                  disabled={
                    saving || !selectedClassId || !registerClosesAt
                  }
                >
                  {saving ? "Creating..." : "Create register"}
                </button>
              </>
            ) : (
              <>
                <div style={styles.registerLesson}>
                  <strong>{selectedLesson.title}</strong>
                  <span>
                    {classes.find((item) => item.id === register.class_id)?.name ||
                      "Class"}
                  </span>
                </div>

                <label style={styles.label}>
                  Register closes at
                  <input
                    style={styles.input}
                    type="datetime-local"
                    value={registerClosesAt}
                    onChange={(e) => setRegisterClosesAt(e.target.value)}
                  />
                </label>

                <div style={styles.registerSummary}>
                  <span>
                    ✅ {registerEntries.filter((entry) => entry.present).length} present
                  </span>
                  <span>
                    ⏳ {registerEntries.filter((entry) => !entry.present).length} not
                    marked present
                  </span>
                </div>

                <div style={styles.registerList}>
                  {registerEntries.map((entry) => (
                    <label key={entry.id} style={styles.registerRow}>
                      <input
                        type="checkbox"
                        checked={entry.present}
                        onChange={() => togglePresent(entry)}
                        disabled={register.status !== "open"}
                      />

                      <span style={styles.registerName}>
                        <strong>
                          {entry.profile?.full_name || "Student"}
                        </strong>
                        <small style={styles.personMeta}>
                          {entry.present ? "Present" : "Not marked present"}
                        </small>
                      </span>

                      <span
                        style={{
                          ...styles.statusPill,
                          ...(entry.present
                            ? styles.presentPill
                            : styles.unmarkedPill),
                        }}
                      >
                        {entry.present ? "Present" : "Unmarked"}
                      </span>
                    </label>
                  ))}
                </div>

                <div style={styles.registerActions}>
                  <button
                    type="button"
                    style={styles.saveButton}
                    onClick={saveRegisterSettings}
                  >
                    Save register
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </section>

      <div style={styles.nextCard}>
        <span style={styles.nextIcon}>🧑‍🏫</span>
        <div>
          <strong>Next: secure QR authorisation</strong>
          <p style={styles.nextText}>
            Your deadline processing and approval screen are now in place.
            Stage 4 will use a short-lived, single-use QR challenge before any
            approved lesson notes can be emailed.
          </p>
        </div>
      </div>
    </div>
  );
}

function Empty({ text }) {
  return <div style={styles.empty}>{text}</div>;
}

function Item({ active, icon, title, subtitle, onClick, onDelete }) {
  return (
    <div
      style={{
        ...styles.item,
        ...(active ? styles.itemActive : {}),
      }}
    >
      <button type="button" style={styles.itemMain} onClick={onClick}>
        <span style={styles.itemIcon}>{icon}</span>
        <span style={styles.itemText}>
          <strong>{title}</strong>
          {subtitle && <small style={styles.itemSubtitle}>{subtitle}</small>}
        </span>
      </button>

      <button
        type="button"
        style={styles.deleteButton}
        title="Delete"
        onClick={(event) => {
          event.stopPropagation();
          onDelete();
        }}
      >
        ×
      </button>
    </div>
  );
}

const styles = {
  page: {
    display: "flex",
    flexDirection: "column",
    gap: "22px",
    paddingBottom: "56px",
  },
  loading: {
    padding: "44px",
    borderRadius: "24px",
    background: "rgba(255,255,255,.78)",
    border: "1px solid rgba(20,27,45,.08)",
    boxShadow: "0 18px 60px rgba(24,31,51,.08)",
    fontWeight: 800,
    color: "#6d5dfc",
  },
  hero: {
    position: "relative",
    overflow: "hidden",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: "24px",
    padding: "34px 38px",
    borderRadius: "28px",
    color: "#ffffff",
    background:
      "radial-gradient(circle at 82% 0%, rgba(143,128,255,.42), transparent 32%), linear-gradient(135deg, #181d31 0%, #242a49 52%, #171a2a 100%)",
    border: "1px solid rgba(255,255,255,.08)",
    boxShadow: "0 24px 70px rgba(24,30,49,.15)",
  },
  eyebrow: {
    fontSize: "9px",
    letterSpacing: "0.16em",
    fontWeight: 900,
    color: "#b8afff",
  },
  heroTitle: {
    margin: "7px 0 7px",
    fontSize: "36px",
    letterSpacing: "-0.045em",
  },
  heroText: {
    maxWidth: "620px",
    margin: 0,
    color: "#adb4c8",
    fontSize: "13px",
    lineHeight: 1.65,
  },
  heroBadge: {
    width: "72px",
    height: "72px",
    flex: "0 0 auto",
    borderRadius: "22px",
    display: "grid",
    placeItems: "center",
    fontSize: "31px",
    background: "linear-gradient(145deg, rgba(142,128,255,.98), rgba(83,65,230,.9))",
    border: "1px solid rgba(255,255,255,.16)",
    boxShadow: "0 18px 38px rgba(79,60,213,.38)",
    transform: "rotate(-5deg)",
  },
  message: {
    padding: "13px 16px",
    borderRadius: "14px",
    background: "#f1efff",
    border: "1px solid #e3deff",
    color: "#5947d8",
    fontSize: "12px",
    fontWeight: 800,
    boxShadow: "0 8px 24px rgba(35,39,55,.04)",
  },
  columns: {
    display: "grid",
    gridTemplateColumns: "repeat(3, minmax(220px, 1fr))",
    gap: "14px",
    alignItems: "stretch",
  },
  panel: {
    minHeight: "350px",
    padding: "19px",
    borderRadius: "22px",
    background: "rgba(255,255,255,.82)",
    border: "1px solid rgba(20,27,45,.08)",
    boxShadow: "0 14px 42px rgba(24,31,51,.06)",
    backdropFilter: "blur(12px)",
  },
  panelHeading: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: "10px",
    marginBottom: "15px",
  },
  step: {
    fontSize: "8px",
    letterSpacing: "0.14em",
    fontWeight: 900,
    color: "#8d82a3",
  },
  panelTitle: {
    margin: "5px 0 0",
    fontSize: "17px",
    letterSpacing: "-0.025em",
    color: "#1d2230",
  },
  contextLabel: {
    marginBottom: "11px",
    padding: "7px 9px",
    borderRadius: "9px",
    background: "#f7f6fb",
    color: "#7b8190",
    fontSize: "10px",
    fontWeight: 700,
  },
  createRow: {
    display: "flex",
    gap: "8px",
    marginBottom: "14px",
  },
  input: {
    width: "100%",
    boxSizing: "border-box",
    padding: "11px 12px",
    borderRadius: "11px",
    border: "1px solid #e0e3eb",
    outline: "none",
    font: "inherit",
    fontSize: "12px",
    background: "#fbfbfd",
    color: "#202431",
  },
  addButton: {
    minWidth: "42px",
    border: 0,
    borderRadius: "11px",
    background: "linear-gradient(135deg, #7d6dff, #5c49ed)",
    color: "#ffffff",
    fontSize: "20px",
    fontWeight: 800,
    cursor: "pointer",
    boxShadow: "0 9px 22px rgba(97,77,238,.22)",
  },
  newLessonButton: {
    border: 0,
    borderRadius: "10px",
    padding: "9px 12px",
    background: "linear-gradient(135deg, #7d6dff, #5c49ed)",
    color: "#ffffff",
    fontSize: "10px",
    fontWeight: 800,
    cursor: "pointer",
    boxShadow: "0 8px 20px rgba(97,77,238,.20)",
  },
  list: {
    display: "flex",
    flexDirection: "column",
    gap: "7px",
  },
  empty: {
    padding: "30px 12px",
    textAlign: "center",
    color: "#a0a5b2",
    fontSize: "11px",
  },
  item: {
    display: "flex",
    alignItems: "stretch",
    border: "1px solid #e8eaf0",
    borderRadius: "13px",
    overflow: "hidden",
    background: "rgba(255,255,255,.88)",
    boxShadow: "0 5px 14px rgba(24,31,51,.025)",
  },
  itemActive: {
    border: "1px solid #cfc7ff",
    background: "linear-gradient(135deg, #f5f3ff, #fbfaff)",
    boxShadow: "0 8px 22px rgba(109,93,252,.08)",
  },
  itemMain: {
    display: "flex",
    alignItems: "center",
    gap: "10px",
    flex: 1,
    padding: "11px",
    border: 0,
    background: "transparent",
    textAlign: "left",
    cursor: "pointer",
    color: "inherit",
  },
  itemIcon: {
    width: "31px",
    height: "31px",
    display: "grid",
    placeItems: "center",
    flex: "0 0 auto",
    borderRadius: "9px",
    background: "#f3f1ff",
    fontSize: "15px",
  },
  itemText: {
    minWidth: 0,
    display: "flex",
    flexDirection: "column",
    gap: "2px",
    fontSize: "11px",
  },
  itemSubtitle: {
    color: "#9298a6",
    fontSize: "9px",
  },
  deleteButton: {
    width: "34px",
    border: 0,
    borderLeft: "1px solid #eef0f4",
    background: "transparent",
    color: "#b2b6c1",
    fontSize: "17px",
    cursor: "pointer",
  },
  editorCard: {
    padding: "25px",
    borderRadius: "24px",
    background: "rgba(255,255,255,.86)",
    border: "1px solid rgba(20,27,45,.08)",
    boxShadow: "0 18px 55px rgba(24,31,51,.07)",
    backdropFilter: "blur(12px)",
  },
  editorHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: "14px",
    marginBottom: "20px",
  },
  editorTitle: {
    margin: "4px 0 0",
    fontSize: "22px",
    letterSpacing: "-0.035em",
  },
  visibilityBadge: {
    padding: "7px 10px",
    borderRadius: "999px",
    background: "#f3f1ff",
    color: "#6251db",
    border: "1px solid #e8e3ff",
    fontSize: "9px",
    fontWeight: 850,
  },
  formGrid: {
    display: "grid",
    gridTemplateColumns: "minmax(0, 2fr) minmax(160px, .7fr)",
    gap: "12px",
    marginBottom: "14px",
  },
  label: {
    display: "flex",
    flexDirection: "column",
    gap: "7px",
    fontSize: "9px",
    letterSpacing: ".04em",
    fontWeight: 850,
    color: "#73798a",
    textTransform: "uppercase",
  },
  textarea: {
    width: "100%",
    minHeight: "390px",
    resize: "vertical",
    boxSizing: "border-box",
    padding: "22px",
    borderRadius: "17px",
    border: "1px solid #e0e3eb",
    outline: "none",
    font: "inherit",
    fontSize: "13px",
    lineHeight: 1.75,
    background: "#fcfcfe",
    color: "#252a37",
    boxShadow: "inset 0 1px 0 rgba(0,0,0,.015)",
  },
  editorFooter: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: "18px",
    marginTop: "16px",
  },
  toggleRow: {
    display: "flex",
    alignItems: "flex-start",
    gap: "10px",
    fontSize: "11px",
    color: "#424756",
  },
  smallText: {
    display: "block",
    marginTop: "3px",
    color: "#9298a6",
    fontSize: "9px",
    fontWeight: 400,
  },
  saveButton: {
    border: 0,
    borderRadius: "12px",
    padding: "12px 18px",
    background: "linear-gradient(135deg, #7d6dff, #5c49ed)",
    color: "#ffffff",
    fontSize: "10px",
    fontWeight: 900,
    cursor: "pointer",
    whiteSpace: "nowrap",
    boxShadow: "0 10px 24px rgba(97,77,238,.24)",
  },
  approvalCard: {
    padding: "24px",
    borderRadius: "24px",
    background: "rgba(255,255,255,.86)",
    border: "1px solid rgba(20,27,45,.08)",
    boxShadow: "0 18px 55px rgba(24,31,51,.07)",
  },
  approvalCount: {
    padding: "6px 9px",
    borderRadius: "999px",
    background: "#fff5dc",
    color: "#a76a0c",
    fontSize: "9px",
    fontWeight: 900,
  },
  approvalEmpty: {
    display: "flex",
    alignItems: "center",
    gap: "12px",
    padding: "17px",
    borderRadius: "14px",
    background: "#f8faf9",
    border: "1px solid #e6ece8",
  },
  approvalEmptyIcon: {
    width: "34px",
    height: "34px",
    display: "grid",
    placeItems: "center",
    borderRadius: "11px",
    background: "#e8f8ee",
    color: "#21824a",
    fontWeight: 900,
  },
  approvalList: { display: "flex", flexDirection: "column", gap: "14px" },
  approvalRequest: {
    padding: "18px",
    borderRadius: "17px",
    border: "1px solid #e2def9",
    background: "linear-gradient(135deg, #fbfaff, #f8f7ff)",
  },
  approvalTop: { display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "12px" },
  approvalClass: { color: "#7060e8", fontSize: "8px", fontWeight: 900, textTransform: "uppercase", letterSpacing: "0.1em" },
  approvalLesson: { margin: "4px 0", fontSize: "17px", letterSpacing: "-0.025em" },
  approvalMeta: { color: "#8a909e", fontSize: "9px" },
  pendingPill: { padding: "6px 9px", borderRadius: "999px", background: "#fff5dc", color: "#a76a0c", fontSize: "8px", fontWeight: 900, whiteSpace: "nowrap" },
  approvalExplanation: { margin: "14px 0 10px", color: "#656b7a", fontSize: "11px", lineHeight: 1.6 },
  approvalStudentList: { display: "flex", flexDirection: "column", gap: "7px" },
  approvalStudent: { display: "flex", alignItems: "center", gap: "10px", padding: "11px", borderRadius: "12px", border: "1px solid #e8eaf0", background: "#ffffff", cursor: "pointer" },
  sendPill: { background: "#e8f8ee", color: "#21824a" },
  skipPill: { background: "#f1f2f5", color: "#73798a" },
  approvalFooter: { display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "12px", marginTop: "14px" },
  approvalSelection: { color: "#858b99", fontSize: "10px", fontWeight: 700 },
  approvalButtons: { display: "flex", gap: "8px", flexWrap: "wrap" },
  declineButton: { border: "1px solid #ffd9df", borderRadius: "11px", padding: "10px 14px", background: "#fff", color: "#c94c63", fontSize: "9px", fontWeight: 850, cursor: "pointer" },
  sentPill: { background: "#e8f8ee", color: "#21824a" },
  failedPill: { background: "#fff0f2", color: "#c94c63" },
  deliveryPanel: { marginTop: "13px", padding: "14px", borderRadius: "13px", background: "#f7f6ff", border: "1px solid #e8e3ff" },
  sentPanel: { marginTop: "13px", padding: "14px", borderRadius: "13px", background: "#f3fbf6", border: "1px solid #dcefe3" },
  qrPanel: { marginTop: "15px", padding: "18px", borderRadius: "16px", background: "#fff", border: "1px solid #e4e0fb", boxShadow: "0 12px 32px rgba(46,38,94,.06)" },
  qrBox: { width: "fit-content", margin: "14px auto", padding: "14px", borderRadius: "16px", background: "#fff", border: "1px solid #ececf1", boxShadow: "0 10px 26px rgba(24,31,51,.06)" },
  qrInfo: { textAlign: "center", color: "#666c7b", fontSize: "10px", lineHeight: 1.6 },
  qrExpiry: { textAlign: "center", color: "#9a6b15", fontSize: "9px", fontWeight: 800 },
  securityNote: { marginTop: "10px", padding: "10px 12px", borderRadius: "10px", background: "#f7f6ff", color: "#6d6387", fontSize: "9px", lineHeight: 1.5 },
  attendanceCard: { padding: "24px", borderRadius: "24px", background: "rgba(255,255,255,.86)", border: "1px solid rgba(20,27,45,.08)", boxShadow: "0 18px 55px rgba(24,31,51,.07)" },
  attendanceGrid: { display: "grid", gridTemplateColumns: "minmax(260px,.75fr) minmax(0,1.25fr)", gap: "16px", alignItems: "start" },
  attendancePanel: { padding: "18px", borderRadius: "17px", background: "#fafafe", border: "1px solid #e8eaf0" },
  sectionTitle: { margin: "0 0 12px", fontSize: "14px", letterSpacing: "-0.02em" },
  classChips: { display: "flex", gap: "7px", flexWrap: "wrap", marginBottom: "13px" },
  classChipWrap: { display: "flex", alignItems: "stretch", borderRadius: "10px", overflow: "hidden", border: "1px solid #e2e4ea", background: "#fff" },
  classChip: { border: 0, padding: "8px 10px", background: "transparent", color: "#686e7d", fontSize: "9px", fontWeight: 800, cursor: "pointer" },
  classChipActive: { background: "#efedff", color: "#5f4bd8" },
  classDelete: { width: "28px", border: 0, borderLeft: "1px solid #eceef2", background: "transparent", color: "#b1b5bf", cursor: "pointer" },
  peopleList: { display: "flex", flexDirection: "column", gap: "7px", marginTop: "10px" },
  personRow: { display: "flex", alignItems: "center", gap: "10px", padding: "10px", borderRadius: "11px", background: "#fff", border: "1px solid #e8eaf0" },
  personMeta: { flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: "2px", fontSize: "10px" },
  miniButton: { border: 0, borderRadius: "9px", padding: "7px 9px", background: "#efedff", color: "#5f4bd8", fontSize: "8px", fontWeight: 850, cursor: "pointer" },
  removeButton: { border: 0, borderRadius: "9px", padding: "7px 9px", background: "#fff0f2", color: "#c94c63", fontSize: "8px", fontWeight: 850, cursor: "pointer" },
  registerLesson: { display: "flex", justifyContent: "space-between", gap: "12px", alignItems: "center", padding: "13px", borderRadius: "13px", background: "linear-gradient(135deg,#f3f1ff,#faf9ff)", border: "1px solid #e4dfff", fontSize: "10px" },
  helperText: { color: "#8a909e", fontSize: "9px", lineHeight: 1.55 },
  registerSummary: { display: "flex", gap: "8px", flexWrap: "wrap", margin: "12px 0" },
  registerList: { display: "flex", flexDirection: "column", gap: "7px" },
  registerRow: { display: "flex", alignItems: "center", gap: "10px", padding: "11px", borderRadius: "12px", background: "#fff", border: "1px solid #e8eaf0" },
  registerName: { flex: 1, minWidth: 0, fontSize: "10px", fontWeight: 800 },
  statusPill: { padding: "5px 8px", borderRadius: "999px", fontSize: "8px", fontWeight: 900 },
  presentPill: { background: "#e8f8ee", color: "#21824a" },
  unmarkedPill: { background: "#f1f2f5", color: "#7d8390" },
  registerActions: { display: "flex", gap: "8px", flexWrap: "wrap", marginTop: "12px" },
  nextCard: { display: "flex", alignItems: "center", gap: "13px", padding: "18px", borderRadius: "17px", color: "#d9dce8", background: "linear-gradient(135deg,#1a1f33,#252b48)", border: "1px solid rgba(255,255,255,.06)", boxShadow: "0 16px 42px rgba(24,30,49,.12)" },
  nextIcon: { width: "39px", height: "39px", flex: "0 0 auto", display: "grid", placeItems: "center", borderRadius: "12px", background: "rgba(126,111,255,.15)", color: "#a99cff", fontSize: "18px" },
  nextText: { margin: "3px 0 0", color: "#9299ac", fontSize: "10px", lineHeight: 1.55 },
};

export default Notes;
