import { useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabase";

function Revision({ setPage }) {
  // =========================================================
  // REVISION DATA
  // =========================================================

  const [subjects, setSubjects] = useState([]);
  const [units, setUnits] = useState([]);
  const [topics, setTopics] = useState([]);
  const [subtopics, setSubtopics] = useState([]);
  const [progress, setProgress] = useState([]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [expandedUnits, setExpandedUnits] = useState({});
  const [expandedTopics, setExpandedTopics] = useState({});

  // =========================================================
  // USER
  // =========================================================

  const [currentUser, setCurrentUser] = useState(null);

  // =========================================================
  // FLASHCARD DATA
  // =========================================================

  const [decks, setDecks] = useState([]);
  const [flashcards, setFlashcards] = useState([]);

  const [decksLoading, setDecksLoading] = useState(false);
  const [flashcardsLoading, setFlashcardsLoading] =
    useState(false);

  const [selectedDeckId, setSelectedDeckId] =
    useState(null);

  // =========================================================
  // DECK CREATOR
  // =========================================================

  const [showDeckCreator, setShowDeckCreator] =
    useState(false);

  const [editingDeckId, setEditingDeckId] =
    useState(null);

  const [deckName, setDeckName] = useState("");
  const [deckSubject, setDeckSubject] = useState("");
  const [deckDescription, setDeckDescription] =
    useState("");

  const [creatingDeck, setCreatingDeck] =
    useState(false);

  // =========================================================
  // FLASHCARD CREATOR
  // =========================================================

  const [showFlashcardCreator, setShowFlashcardCreator] =
    useState(false);

  const [editingFlashcardId, setEditingFlashcardId] =
    useState(null);

  const [flashcardDeckId, setFlashcardDeckId] =
    useState("");

  const [flashcardTopic, setFlashcardTopic] =
    useState("");

  const [flashcardQuestion, setFlashcardQuestion] =
    useState("");

  const [flashcardOptions, setFlashcardOptions] =
    useState({
      A: "",
      B: "",
      C: "",
      D: "",
    });

  const [correctAnswer, setCorrectAnswer] =
    useState("A");

  const [creatingFlashcard, setCreatingFlashcard] =
    useState(false);

  const [deletingFlashcardId, setDeletingFlashcardId] =
    useState(null);

  // =========================================================
  // DECK DELETION
  // =========================================================

  const [deletingDeckId, setDeletingDeckId] =
    useState(null);

  // =========================================================
  // PRACTICE
  // =========================================================

  const [showPracticeMode, setShowPracticeMode] =
    useState(false);

  const [practiceDeck, setPracticeDeck] =
    useState(null);

  const [practiceCards, setPracticeCards] =
    useState([]);

  const [practiceIndex, setPracticeIndex] =
    useState(0);

  const [selectedPracticeAnswer, setSelectedPracticeAnswer] =
    useState(null);

  const [practiceAnswered, setPracticeAnswered] =
    useState(false);

  const [practiceScore, setPracticeScore] =
    useState(0);

  const [practiceResults, setPracticeResults] =
    useState([]);

  // =========================================================
  // PRACTICE STATISTICS
  // =========================================================

  const [deckStats, setDeckStats] = useState({});

  // =========================================================
  // INITIAL LOAD
  // =========================================================

  useEffect(() => {
    initialiseRevision();
  }, []);

  // =========================================================
  // INITIALISE
  // =========================================================

  async function initialiseRevision() {
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

      setCurrentUser(user);

      await Promise.all([
        loadRevision(user),
        loadDecks(user.id),
        loadFlashcards(user.id),
      ]);
    } catch (err) {
      console.error(
        "Revision initialisation error:",
        err
      );

      setError(
        err?.message ||
          "Something went wrong while loading your revision hub."
      );
    } finally {
      setLoading(false);
    }
  }

  // =========================================================
  // LOAD REVISION
  // =========================================================

  async function loadRevision(user) {
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
          icon,
          specification_url,
          past_papers_url
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

    // -------------------------------------------------------
    // UNITS
    // -------------------------------------------------------

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
        display_order
      `)
      .in("subject_id", subjectIds)
      .order("display_order", {
        ascending: true,
      });

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
      setProgress([]);
      return;
    }

    // -------------------------------------------------------
    // TOPICS
    // -------------------------------------------------------

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
        display_order
      `)
      .in("unit_id", unitIds)
      .order("display_order", {
        ascending: true,
      });

    if (topicError) {
      throw topicError;
    }

    setTopics(topicData || []);

    const topicIds = (topicData || []).map(
      (topic) => topic.id
    );

    if (topicIds.length === 0) {
      setSubtopics([]);
      setProgress([]);
      return;
    }

    // -------------------------------------------------------
    // SUBTOPICS
    // -------------------------------------------------------

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
        display_order
      `)
      .in("topic_id", topicIds)
      .order("display_order", {
        ascending: true,
      });

    if (subtopicError) {
      throw subtopicError;
    }

    setSubtopics(subtopicData || []);

    const subtopicIds = (subtopicData || []).map(
      (subtopic) => subtopic.id
    );

    if (subtopicIds.length === 0) {
      setProgress([]);
      return;
    }

    // -------------------------------------------------------
    // PROGRESS
    // -------------------------------------------------------

    const {
      data: progressData,
      error: progressError,
    } = await supabase
      .from("student_topic_progress")
      .select("*")
      .eq("student_id", user.id)
      .in("subtopic_id", subtopicIds);

    if (progressError) {
      console.warn(
        "Could not load progress:",
        progressError
      );

      setProgress([]);
    } else {
      setProgress(progressData || []);
    }
  }

  // =========================================================
  // LOAD DECKS
  // =========================================================

  async function loadDecks(userId = currentUser?.id) {
    if (!userId) {
      return;
    }

    try {
      setDecksLoading(true);

      const {
        data,
        error: decksError,
      } = await supabase
        .from("flashcard_decks")
        .select(`
          id,
          user_id,
          name,
          subject,
          description,
          created_at
        `)
        .eq("user_id", userId)
        .order("created_at", {
          ascending: false,
        });

      if (decksError) {
        throw decksError;
      }

      setDecks(data || []);

      if (
        selectedDeckId &&
        !(data || []).some(
          (deck) => deck.id === selectedDeckId
        )
      ) {
        setSelectedDeckId(null);
      }
    } catch (err) {
      console.error(
        "Could not load decks:",
        err
      );

      setError(
        err?.message ||
          "Could not load your flashcard decks."
      );
    } finally {
      setDecksLoading(false);
    }
  }

  // =========================================================
  // LOAD FLASHCARDS
  // =========================================================

  async function loadFlashcards(
    userId = currentUser?.id
  ) {
    if (!userId) {
      return;
    }

    try {
      setFlashcardsLoading(true);

      const {
        data,
        error: flashcardsError,
      } = await supabase
        .from("flashcards")
        .select(`
          id,
          user_id,
          deck_id,
          topic,
          question,
          option_a,
          option_b,
          option_c,
          option_d,
          correct_answer,
          created_at
        `)
        .eq("user_id", userId)
        .order("created_at", {
          ascending: false,
        });

      if (flashcardsError) {
        throw flashcardsError;
      }

      setFlashcards(data || []);
    } catch (err) {
      console.error(
        "Could not load flashcards:",
        err
      );

      setError(
        err?.message ||
          "Could not load your flashcards."
      );
    } finally {
      setFlashcardsLoading(false);
    }
  }

  // =========================================================
  // DECK HELPERS
  // =========================================================

  const selectedDeck = useMemo(() => {
    return (
      decks.find(
        (deck) => deck.id === selectedDeckId
      ) || null
    );
  }, [decks, selectedDeckId]);

  function getDeckCards(deckId) {
    return flashcards.filter(
      (card) => card.deck_id === deckId
    );
  }

  function getDeckCardCount(deckId) {
    return getDeckCards(deckId).length;
  }

  // =========================================================
  // DECK CREATOR RESET
  // =========================================================

  function resetDeckCreator() {
    setEditingDeckId(null);
    setDeckName("");
    setDeckSubject("");
    setDeckDescription("");
  }

  // =========================================================
  // OPEN CREATE DECK
  // =========================================================

  function openCreateDeck() {
    resetDeckCreator();
    setShowDeckCreator(true);
  }

  // =========================================================
  // OPEN EDIT DECK
  // =========================================================

  function openEditDeck(deck) {
    setEditingDeckId(deck.id);
    setDeckName(deck.name || "");
    setDeckSubject(deck.subject || "");
    setDeckDescription(
      deck.description || ""
    );

    setShowDeckCreator(true);
  }

  // =========================================================
  // SAVE DECK
  // =========================================================

  async function saveDeck(event) {
    event.preventDefault();

    if (!currentUser) {
      return;
    }

    if (!deckName.trim()) {
      alert("Please enter a deck name.");
      return;
    }

    try {
      setCreatingDeck(true);

      const payload = {
        name: deckName.trim(),
        subject:
          deckSubject.trim() || null,
        description:
          deckDescription.trim() || null,
      };

      if (editingDeckId) {
        const {
          data,
          error: updateError,
        } = await supabase
          .from("flashcard_decks")
          .update(payload)
          .eq("id", editingDeckId)
          .eq("user_id", currentUser.id)
          .select()
          .single();

        if (updateError) {
          throw updateError;
        }

        setDecks((previous) =>
          previous.map((deck) =>
            deck.id === editingDeckId
              ? data
              : deck
          )
        );
      } else {
        const {
          data,
          error: createError,
        } = await supabase
          .from("flashcard_decks")
          .insert({
            ...payload,
            user_id: currentUser.id,
          })
          .select()
          .single();

        if (createError) {
          throw createError;
        }

        setDecks((previous) => [
          data,
          ...previous,
        ]);

        setSelectedDeckId(data.id);
      }

      setShowDeckCreator(false);
      resetDeckCreator();
    } catch (err) {
      console.error(
        "Could not save deck:",
        err
      );

      alert(
        err?.message ||
          "Could not save deck."
      );
    } finally {
      setCreatingDeck(false);
    }
  }

  // =========================================================
  // DELETE DECK
  // =========================================================

  async function deleteDeck(deckId) {
    if (!currentUser || !deckId) {
      return;
    }

    const deck = decks.find(
      (item) => item.id === deckId
    );

    if (!deck) {
      return;
    }

    const cardCount =
      getDeckCardCount(deckId);

    const confirmed = window.confirm(
      `Delete "${deck.name}"? ${
        cardCount > 0
          ? `This will also remove its ${cardCount} flashcard${
              cardCount === 1 ? "" : "s"
            }.`
          : ""
      }`
    );

    if (!confirmed) {
      return;
    }

    try {
      setDeletingDeckId(deckId);

      /*
       * Delete the user's cards belonging to the deck first.
       * This works even if there is no ON DELETE CASCADE.
       */

      const {
        error: cardsDeleteError,
      } = await supabase
        .from("flashcards")
        .delete()
        .eq("deck_id", deckId)
        .eq("user_id", currentUser.id);

      if (cardsDeleteError) {
        throw cardsDeleteError;
      }

      const {
        error: deckDeleteError,
      } = await supabase
        .from("flashcard_decks")
        .delete()
        .eq("id", deckId)
        .eq("user_id", currentUser.id);

      if (deckDeleteError) {
        throw deckDeleteError;
      }

      setDecks((previous) =>
        previous.filter(
          (item) => item.id !== deckId
        )
      );

      setFlashcards((previous) =>
        previous.filter(
          (card) => card.deck_id !== deckId
        )
      );

      if (selectedDeckId === deckId) {
        setSelectedDeckId(null);
      }
    } catch (err) {
      console.error(
        "Could not delete deck:",
        err
      );

      alert(
        err?.message ||
          "Could not delete deck."
      );
    } finally {
      setDeletingDeckId(null);
    }
  }

  // =========================================================
  // FLASHCARD CREATOR RESET
  // =========================================================

  function resetFlashcardCreator() {
    setEditingFlashcardId(null);

    setFlashcardDeckId(
      selectedDeckId || ""
    );

    setFlashcardTopic("");
    setFlashcardQuestion("");

    setFlashcardOptions({
      A: "",
      B: "",
      C: "",
      D: "",
    });

    setCorrectAnswer("A");
  }

  // =========================================================
  // OPEN CREATE FLASHCARD
  // =========================================================

  function openCreateFlashcard(deckId = selectedDeckId) {
    if (decks.length === 0) {
      alert(
        "Create a flashcard deck first."
      );
      return;
    }

    setEditingFlashcardId(null);
    setFlashcardDeckId(
      deckId || decks[0].id
    );
    setFlashcardTopic("");
    setFlashcardQuestion("");

    setFlashcardOptions({
      A: "",
      B: "",
      C: "",
      D: "",
    });

    setCorrectAnswer("A");

    setShowFlashcardCreator(true);
  }

  // =========================================================
  // OPEN EDIT FLASHCARD
  // =========================================================

  function openEditFlashcard(card) {
    setEditingFlashcardId(card.id);

    setFlashcardDeckId(
      card.deck_id || ""
    );

    setFlashcardTopic(
      card.topic || ""
    );

    setFlashcardQuestion(
      card.question || ""
    );

    setFlashcardOptions({
      A: card.option_a || "",
      B: card.option_b || "",
      C: card.option_c || "",
      D: card.option_d || "",
    });

    setCorrectAnswer(
      card.correct_answer || "A"
    );

    setShowFlashcardCreator(true);
  }

  // =========================================================
  // SAVE FLASHCARD
  // =========================================================

  async function saveFlashcard(event) {
    event.preventDefault();

    if (!currentUser) {
      return;
    }

    if (!flashcardDeckId) {
      alert(
        "Please select a flashcard deck."
      );
      return;
    }

    if (!flashcardTopic.trim()) {
      alert(
        "Please enter a topic."
      );
      return;
    }

    if (!flashcardQuestion.trim()) {
      alert(
        "Please enter a question."
      );
      return;
    }

    if (
      !flashcardOptions.A.trim() ||
      !flashcardOptions.B.trim() ||
      !flashcardOptions.C.trim() ||
      !flashcardOptions.D.trim()
    ) {
      alert(
        "Please complete all four answers."
      );
      return;
    }

    try {
      setCreatingFlashcard(true);

      const payload = {
        user_id: currentUser.id,
        deck_id: flashcardDeckId,
        topic: flashcardTopic.trim(),
        question:
          flashcardQuestion.trim(),
        option_a:
          flashcardOptions.A.trim(),
        option_b:
          flashcardOptions.B.trim(),
        option_c:
          flashcardOptions.C.trim(),
        option_d:
          flashcardOptions.D.trim(),
        correct_answer:
          correctAnswer,
      };

      if (editingFlashcardId) {
        const {
          data,
          error: updateError,
        } = await supabase
          .from("flashcards")
          .update(payload)
          .eq("id", editingFlashcardId)
          .eq("user_id", currentUser.id)
          .select()
          .single();

        if (updateError) {
          throw updateError;
        }

        setFlashcards((previous) =>
          previous.map((card) =>
            card.id === editingFlashcardId
              ? data
              : card
          )
        );
      } else {
        const {
          data,
          error: createError,
        } = await supabase
          .from("flashcards")
          .insert(payload)
          .select()
          .single();

        if (createError) {
          throw createError;
        }

        setFlashcards((previous) => [
          data,
          ...previous,
        ]);
      }

      setSelectedDeckId(
        flashcardDeckId
      );

      setShowFlashcardCreator(false);
      resetFlashcardCreator();
    } catch (err) {
      console.error(
        "Could not save flashcard:",
        err
      );

      alert(
        err?.message ||
          "Could not save flashcard."
      );
    } finally {
      setCreatingFlashcard(false);
    }
  }

  // =========================================================
  // DELETE FLASHCARD
  // =========================================================

  async function deleteFlashcard(id) {
    if (!currentUser || !id) {
      return;
    }

    const confirmed = window.confirm(
      "Are you sure you want to delete this flashcard?"
    );

    if (!confirmed) {
      return;
    }

    try {
      setDeletingFlashcardId(id);

      const {
        error: deleteError,
      } = await supabase
        .from("flashcards")
        .delete()
        .eq("id", id)
        .eq("user_id", currentUser.id);

      if (deleteError) {
        throw deleteError;
      }

      setFlashcards((previous) =>
        previous.filter(
          (card) => card.id !== id
        )
      );
    } catch (err) {
      console.error(
        "Could not delete flashcard:",
        err
      );

      alert(
        err?.message ||
          "Could not delete flashcard."
      );
    } finally {
      setDeletingFlashcardId(null);
    }
  }

  // =========================================================
  // SHUFFLE
  // =========================================================

  function shuffleCards(cards) {
    const shuffled = [...cards];

    for (
      let i = shuffled.length - 1;
      i > 0;
      i--
    ) {
      const j = Math.floor(
        Math.random() * (i + 1)
      );

      [
        shuffled[i],
        shuffled[j],
      ] = [
        shuffled[j],
        shuffled[i],
      ];
    }

    return shuffled;
  }

  // =========================================================
  // START PRACTICE
  // =========================================================

  function startPractice(deckId) {
    const deck = decks.find(
      (item) => item.id === deckId
    );

    if (!deck) {
      return;
    }

    const cards =
      getDeckCards(deckId);

    if (cards.length === 0) {
      alert(
        "This deck has no flashcards yet."
      );
      return;
    }

    setPracticeDeck(deck);

    setPracticeCards(
      shuffleCards(cards)
    );

    setPracticeIndex(0);
    setSelectedPracticeAnswer(null);
    setPracticeAnswered(false);
    setPracticeScore(0);
    setPracticeResults([]);

    setShowPracticeMode(true);
  }

  // =========================================================
  // CHECK PRACTICE ANSWER
  // =========================================================

  function checkPracticeAnswer(answer) {
    if (practiceAnswered) {
      return;
    }

    const currentCard =
      practiceCards[practiceIndex];

    if (!currentCard) {
      return;
    }

    const correct =
      answer === currentCard.correct_answer;

    setSelectedPracticeAnswer(answer);
    setPracticeAnswered(true);

    if (correct) {
      setPracticeScore(
        (previous) => previous + 1
      );
    }

    setPracticeResults((previous) => [
      ...previous,
      {
        cardId: currentCard.id,
        correct,
      },
    ]);
  }

  // =========================================================
  // NEXT PRACTICE CARD
  // =========================================================

  function nextPracticeCard() {
    if (
      practiceIndex >=
      practiceCards.length - 1
    ) {
      return;
    }

    setPracticeIndex(
      (previous) => previous + 1
    );

    setSelectedPracticeAnswer(null);
    setPracticeAnswered(false);
  }

  // =========================================================
  // RESTART PRACTICE
  // =========================================================

  function restartPractice() {
    if (!practiceDeck) {
      return;
    }

    const cards =
      getDeckCards(
        practiceDeck.id
      );

    setPracticeCards(
      shuffleCards(cards)
    );

    setPracticeIndex(0);
    setSelectedPracticeAnswer(null);
    setPracticeAnswered(false);
    setPracticeScore(0);
    setPracticeResults([]);
  }

  // =========================================================
  // CLOSE PRACTICE
  // =========================================================

  function closePractice() {
    setShowPracticeMode(false);
    setPracticeDeck(null);
    setPracticeCards([]);
    setPracticeIndex(0);
    setSelectedPracticeAnswer(null);
    setPracticeAnswered(false);
    setPracticeScore(0);
    setPracticeResults([]);
  }

  // =========================================================
  // FLASHCARD OPTION
  // =========================================================

  function getFlashcardOption(card, letter) {
    if (!card) {
      return "";
    }

    const options = {
      A: card.option_a,
      B: card.option_b,
      C: card.option_c,
      D: card.option_d,
    };

    return options[letter] || "";
  }

  // =========================================================
  // PRACTICE BUTTON STYLE
  // =========================================================

  function getPracticeButtonStyle(letter) {
    const currentCard =
      practiceCards[practiceIndex];

    const baseStyle = {
      width: "100%",
      textAlign: "left",
      padding: "16px",
      borderRadius: "14px",
      cursor: practiceAnswered
        ? "default"
        : "pointer",
      fontSize: "15px",
      fontWeight: 600,
      transition: "0.2s",
    };

    if (!practiceAnswered) {
      return {
        ...baseStyle,
        border:
          "1px solid #e2e8f0",
        background: "white",
        color: "#0f172a",
      };
    }

    if (
      currentCard &&
      letter === currentCard.correct_answer
    ) {
      return {
        ...baseStyle,
        border:
          "2px solid #22c55e",
        background: "#dcfce7",
        color: "#166534",
      };
    }

    if (
      letter === selectedPracticeAnswer &&
      currentCard &&
      letter !== currentCard.correct_answer
    ) {
      return {
        ...baseStyle,
        border:
          "2px solid #ef4444",
        background: "#fee2e2",
        color: "#991b1b",
      };
    }

    return {
      ...baseStyle,
      border:
        "1px solid #e2e8f0",
      background: "#f8fafc",
      color: "#64748b",
    };
  }

  // =========================================================
  // DECK STATISTICS
  // =========================================================

  function getDeckStats(deckId) {
    const cards =
      getDeckCards(deckId);

    const stored =
      deckStats[deckId];

    return {
      cards: cards.length,
      attempts:
        stored?.attempts || 0,
      correct:
        stored?.correct || 0,
      percentage:
        stored?.attempts > 0
          ? Math.round(
              (stored.correct /
                stored.attempts) *
                100
            )
          : 0,
    };
  }

  function recordDeckStats(
    deckId,
    correct,
    total
  ) {
    setDeckStats((previous) => {
      const old = previous[deckId] || {
        attempts: 0,
        correct: 0,
      };

      return {
        ...previous,
        [deckId]: {
          attempts:
            old.attempts + total,
          correct:
            old.correct + correct,
        },
      };
    });
  }

  // =========================================================
  // URL HANDLING
  // =========================================================

  function openLink(url) {
    if (!url) {
      alert(
        "This resource link has not been added yet."
      );

      return;
    }

    window.open(
      url,
      "_blank",
      "noopener,noreferrer"
    );
  }

  // =========================================================
  // EXPAND / COLLAPSE
  // =========================================================

  function toggleUnit(unitId) {
    setExpandedUnits((previous) => ({
      ...previous,
      [unitId]:
        !previous[unitId],
    }));
  }

  function toggleTopic(topicId) {
    setExpandedTopics((previous) => ({
      ...previous,
      [topicId]:
        !previous[topicId],
    }));
  }

  // =========================================================
  // PROGRESS
  // =========================================================

  function getSubtopicProgress(subtopicId) {
    return progress.find(
      (item) =>
        item.subtopic_id ===
        subtopicId
    );
  }

  function isCompleted(subtopicId) {
    const item =
      getSubtopicProgress(
        subtopicId
      );

    return item?.completed === true;
  }

  async function toggleCompleted(
    subtopicId
  ) {
    try {
      const existing =
        getSubtopicProgress(
          subtopicId
        );

      if (existing) {
        const newCompleted =
          !existing.completed;

        const {
          error: updateError,
        } = await supabase
          .from(
            "student_topic_progress"
          )
          .update({
            completed:
              newCompleted,
          })
          .eq(
            "id",
            existing.id
          );

        if (updateError) {
          throw updateError;
        }

        setProgress((previous) =>
          previous.map((item) =>
            item.id ===
            existing.id
              ? {
                  ...item,
                  completed:
                    newCompleted,
                }
              : item
          )
        );
      } else {
        const {
          data: {
            user,
          },
        } =
          await supabase.auth.getUser();

        if (!user) {
          setPage("login");
          return;
        }

        const {
          data,
          error: insertError,
        } = await supabase
          .from(
            "student_topic_progress"
          )
          .insert({
            student_id:
              user.id,
            subtopic_id:
              subtopicId,
            completed:
              true,
          })
          .select()
          .single();

        if (insertError) {
          throw insertError;
        }

        setProgress((previous) => [
          ...previous,
          data,
        ]);
      }
    } catch (err) {
      console.error(
        "Could not update progress:",
        err
      );

      alert(
        "Could not update your progress."
      );
    }
  }

  // =========================================================
  // LOADING
  // =========================================================

  if (loading) {
    return (
      <div className="no-subjects">
        <div className="no-subjects-icon">
          📚
        </div>

        <h2>
          Loading your revision hub...
        </h2>

        <p>
          Getting your subjects,
          decks and flashcards ready.
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
          ⚠️
        </div>

        <h2>
          Something went wrong
        </h2>

        <p>{error}</p>

        <button
          type="button"
          className="primary-card-button"
          onClick={() => {
            setError("");
            initialiseRevision();
          }}
        >
          Try again
        </button>
      </div>
    );
  }

  // =========================================================
  // PRACTICE MODE
  // =========================================================

  if (showPracticeMode) {
    const currentCard =
      practiceCards[practiceIndex];

    if (!currentCard) {
      return null;
    }

    const practiceFinished =
      practiceIndex >=
        practiceCards.length - 1 &&
      practiceAnswered;

    return (
      <div className="revision-page">

        <div className="revision-header">
          <div>
            <p className="card-eyebrow">
              FLASHCARD PRACTICE
            </p>

            <h2>
              🎯 {practiceDeck?.name}
            </h2>

            <p className="revision-description">
              One deck at a time. Focus,
              answer and improve.
            </p>
          </div>

          <button
            type="button"
            className="manage-subjects-button"
            onClick={closePractice}
          >
            ← Back to Revision
          </button>
        </div>

        <div
          style={{
            maxWidth: "800px",
            margin: "0 auto",
          }}
        >

          {/* PROGRESS BAR */}

          <div
            style={{
              background:
                "#e2e8f0",
              height: "8px",
              borderRadius:
                "999px",
              overflow:
                "hidden",
              marginBottom:
                "12px",
            }}
          >
            <div
              style={{
                width: `${
                  ((practiceIndex +
                    (practiceAnswered
                      ? 1
                      : 0)) /
                    practiceCards.length) *
                  100
                }%`,
                height: "100%",
                background:
                  "#4f46e5",
                transition:
                  "width 0.25s",
              }}
            />
          </div>

          <div
            style={{
              display: "flex",
              justifyContent:
                "space-between",
              marginBottom:
                "20px",
              color:
                "#64748b",
              fontSize:
                "14px",
            }}
          >
            <span>
              Card{" "}
              {practiceIndex +
                1}{" "}
              of{" "}
              {practiceCards.length}
            </span>

            <span>
              Score:{" "}
              {practiceScore}/
              {practiceIndex +
                (practiceAnswered
                  ? 1
                  : 0)}
            </span>
          </div>

          {/* CARD */}

          <div
            style={{
              background:
                "white",
              borderRadius:
                "24px",
              border:
                "1px solid #e2e8f0",
              padding:
                "35px",
              boxShadow:
                "0 10px 30px rgba(15,23,42,0.06)",
            }}
          >

            <div
              style={{
                display:
                  "inline-block",
                padding:
                  "7px 12px",
                borderRadius:
                  "999px",
                background:
                  "#eef2ff",
                color:
                  "#4f46e5",
                fontSize:
                  "12px",
                fontWeight:
                  700,
                marginBottom:
                  "20px",
              }}
            >
              📚{" "}
              {currentCard.topic}
            </div>

            <h2
              style={{
                fontSize:
                  "26px",
                lineHeight:
                  1.4,
                marginBottom:
                  "30px",
              }}
            >
              {currentCard.question}
            </h2>

            <div
              style={{
                display:
                  "flex",
                flexDirection:
                  "column",
                gap:
                  "12px",
              }}
            >
              {[
                "A",
                "B",
                "C",
                "D",
              ].map(
                (letter) => (
                  <button
                    key={
                      letter
                    }
                    type="button"
                    disabled={
                      practiceAnswered
                    }
                    onClick={() =>
                      checkPracticeAnswer(
                        letter
                      )
                    }
                    style={getPracticeButtonStyle(
                      letter
                    )}
                  >
                    <span
                      style={{
                        display:
                          "inline-flex",
                        alignItems:
                          "center",
                        justifyContent:
                          "center",
                        width:
                          "32px",
                        height:
                          "32px",
                        borderRadius:
                          "50%",
                        background:
                          "rgba(79,70,229,0.08)",
                        marginRight:
                          "10px",
                      }}
                    >
                      {letter}
                    </span>

                    {getFlashcardOption(
                      currentCard,
                      letter
                    )}
                  </button>
                )
              )}
            </div>

            {practiceAnswered && (
              <div
                style={{
                  marginTop:
                    "25px",
                  padding:
                    "16px",
                  borderRadius:
                    "14px",
                  background:
                    selectedPracticeAnswer ===
                    currentCard.correct_answer
                      ? "#dcfce7"
                      : "#fee2e2",
                  color:
                    selectedPracticeAnswer ===
                    currentCard.correct_answer
                      ? "#166534"
                      : "#991b1b",
                }}
              >
                <strong>
                  {selectedPracticeAnswer ===
                  currentCard.correct_answer
                    ? "✅ Correct!"
                    : "❌ Not quite!"}
                </strong>

                <p
                  style={{
                    margin:
                      "6px 0 0",
                  }}
                >
                  The correct
                  answer is{" "}
                  <strong>
                    {
                      currentCard.correct_answer
                    }
                  </strong>
                  .
                </p>
              </div>
            )}

            {practiceAnswered && (
              <div
                style={{
                  display:
                    "flex",
                  gap:
                    "10px",
                  marginTop:
                    "25px",
                  flexWrap:
                    "wrap",
                }}
              >

                {practiceFinished ? (
                  <>
                    <button
                      type="button"
                      className="primary-card-button"
                      onClick={() => {
                        recordDeckStats(
                          practiceDeck.id,
                          practiceScore,
                          practiceCards.length
                        );

                        restartPractice();
                      }}
                    >
                      🔀 Shuffle & Restart
                    </button>

                    <button
                      type="button"
                      className="primary-card-button"
                      onClick={() => {
                        recordDeckStats(
                          practiceDeck.id,
                          practiceScore,
                          practiceCards.length
                        );

                        closePractice();
                      }}
                    >
                      Finish
                    </button>
                  </>
                ) : (
                  <button
                    type="button"
                    className="primary-card-button"
                    onClick={
                      nextPracticeCard
                    }
                  >
                    Next Card →
                  </button>
                )}

              </div>
            )}

          </div>

          {practiceFinished && (
            <div
              style={{
                marginTop:
                  "20px",
                background:
                  "#eef2ff",
                borderRadius:
                  "18px",
                padding:
                  "20px",
                textAlign:
                  "center",
              }}
            >
              <h3>
                🎯 Deck complete!
              </h3>

              <p>
                You scored{" "}
                <strong>
                  {practiceScore}
                </strong>{" "}
                out of{" "}
                <strong>
                  {practiceCards.length}
                </strong>
                .
              </p>

              <p
                style={{
                  color:
                    "#64748b",
                }}
              >
                {Math.round(
                  (practiceScore /
                    practiceCards.length) *
                    100
                )}
                % correct
              </p>
            </div>
          )}

        </div>
      </div>
    );
  }

  // =========================================================
  // NORMAL REVISION PAGE
  // =========================================================

  return (
    <div className="revision-page">

      {/* =====================================================
          HEADER
      ===================================================== */}

      <div className="revision-header">

        <div>
          <p className="card-eyebrow">
            YOUR REVISION
          </p>

          <h2>
            Revision Hub 📚
          </h2>

          <p className="revision-description">
            Everything you need for your
            sixth-form revision, all in one place.
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
          ⚙️ Manage Subjects
        </button>

      </div>

      {/* =====================================================
          QUICK ACCESS
      ===================================================== */}

      <div className="revision-section-heading">

        <div>
          <h3>
            Quick Access
          </h3>

          <p>
            Jump straight to the
            resources you need.
          </p>
        </div>

      </div>

      <div className="revision-subject-grid">

        {/* SPECIFICATIONS */}

        <button
          type="button"
          className="revision-subject-card"
          onClick={() => {
            if (
              subjects.length > 0 &&
              subjects[0]
                .specification_url
            ) {
              openLink(
                subjects[0]
                  .specification_url
              );
            } else {
              setPage(
                "subjectSelection"
              );
            }
          }}
        >

          <div className="revision-subject-top">
            <div className="revision-subject-icon">
              📋
            </div>

            <div className="revision-subject-arrow">
              →
            </div>
          </div>

          <div className="revision-subject-content">
            <h3>
              Specifications
            </h3>

            <p>
              View the official WJEC
              specification for your
              subjects.
            </p>
          </div>

          <div className="open-subject">
            <span>
              View specification
            </span>

            <span>→</span>
          </div>

        </button>

        {/* PAST PAPERS */}

        <button
          type="button"
          className="revision-subject-card"
          onClick={() => {
            if (
              subjects.length > 0 &&
              subjects[0]
                .past_papers_url
            ) {
              openLink(
                subjects[0]
                  .past_papers_url
              );
            } else {
              setPage(
                "subjectSelection"
              );
            }
          }}
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
              Past Papers
            </h3>

            <p>
              Find official WJEC past
              papers and mark schemes.
            </p>
          </div>

          <div className="open-subject">
            <span>
              View past papers
            </span>

            <span>→</span>
          </div>

        </button>

        {/* CREATE DECK */}

        <button
          type="button"
          className="revision-subject-card"
          onClick={
            openCreateDeck
          }
        >

          <div className="revision-subject-top">
            <div className="revision-subject-icon">
              🗂️
            </div>

            <div className="revision-subject-arrow">
              →
            </div>
          </div>

          <div className="revision-subject-content">
            <h3>
              Create Deck
            </h3>

            <p>
              Organise your flashcards
              into revision decks.
            </p>
          </div>

          <div className="open-subject">
            <span>
              Create deck
            </span>

            <span>→</span>
          </div>

        </button>

        {/* CREATE FLASHCARD */}

        <button
          type="button"
          className="revision-subject-card"
          onClick={() =>
            openCreateFlashcard()
          }
        >

          <div className="revision-subject-top">
            <div className="revision-subject-icon">
              🃏
            </div>

            <div className="revision-subject-arrow">
              →
            </div>
          </div>

          <div className="revision-subject-content">
            <h3>
              Create Flashcard
            </h3>

            <p>
              Add a multiple-choice
              question to one of your decks.
            </p>
          </div>

          <div className="open-subject">
            <span>
              Create flashcard
            </span>

            <span>→</span>
          </div>

        </button>

      </div>

      {/* =====================================================
          DECKS
      ===================================================== */}

      <div className="revision-section-heading">

        <div>
          <h3>
            🗂️ Your Flashcard Decks
          </h3>

          <p>
            Choose a deck to view its
            cards and statistics.
          </p>
        </div>

        <button
          type="button"
          className="manage-subjects-button"
          onClick={
            openCreateDeck
          }
        >
          ➕ New Deck
        </button>

      </div>

      {decksLoading ? (

        <div className="no-subjects">
          <div className="no-subjects-icon">
            🗂️
          </div>

          <h3>
            Loading decks...
          </h3>
        </div>

      ) : decks.length === 0 ? (

        <div className="no-subjects">

          <div className="no-subjects-icon">
            🗂️
          </div>

          <h3>
            No flashcard decks yet
          </h3>

          <p>
            Create your first deck to
            organise your revision.
          </p>

          <button
            type="button"
            className="primary-card-button"
            onClick={
              openCreateDeck
            }
          >
            ➕ Create Deck
          </button>

        </div>

      ) : (

        <div className="revision-subject-grid">

          {decks.map((deck) => {

            const stats =
              getDeckStats(
                deck.id
              );

            const isSelected =
              selectedDeckId ===
              deck.id;

            return (
              <div
                key={deck.id}
                className="revision-subject-card"
                style={{
                  border:
                    isSelected
                      ? "2px solid #4f46e5"
                      : undefined,
                }}
              >

                <div className="revision-subject-top">

                  <div className="revision-subject-icon">
                    🗂️
                  </div>

                  <div
                    style={{
                      padding:
                        "6px 10px",
                      borderRadius:
                        "999px",
                      background:
                        "#eef2ff",
                      color:
                        "#4f46e5",
                      fontSize:
                        "11px",
                      fontWeight:
                        700,
                    }}
                  >
                    {stats.cards}{" "}
                    {stats.cards ===
                    1
                      ? "CARD"
                      : "CARDS"}
                  </div>

                </div>

                <div className="revision-subject-content">

                  <h3>
                    {deck.name}
                  </h3>

                  {deck.subject && (
                    <p>
                      📚{" "}
                      {deck.subject}
                    </p>
                  )}

                  {deck.description && (
                    <p>
                      {
                        deck.description
                      }
                    </p>
                  )}

                </div>

                {/* STATISTICS */}

                <div
                  style={{
                    marginTop:
                      "18px",
                    display:
                      "grid",
                    gridTemplateColumns:
                      "repeat(3, 1fr)",
                    gap:
                      "8px",
                  }}
                >

                  <div
                    style={{
                      background:
                        "#f8fafc",
                      borderRadius:
                        "12px",
                      padding:
                        "10px",
                      textAlign:
                        "center",
                    }}
                  >
                    <strong
                      style={{
                        display:
                          "block",
                        fontSize:
                          "20px",
                      }}
                    >
                      {
                        stats.cards
                      }
                    </strong>

                    <span
                      style={{
                        fontSize:
                          "11px",
                        color:
                          "#64748b",
                      }}
                    >
                      Cards
                    </span>
                  </div>

                  <div
                    style={{
                      background:
                        "#f8fafc",
                      borderRadius:
                        "12px",
                      padding:
                        "10px",
                      textAlign:
                        "center",
                    }}
                  >
                    <strong
                      style={{
                        display:
                          "block",
                        fontSize:
                          "20px",
                      }}
                    >
                      {
                        stats.attempts
                      }
                    </strong>

                    <span
                      style={{
                        fontSize:
                          "11px",
                        color:
                          "#64748b",
                      }}
                    >
                      Attempts
                    </span>
                  </div>

                  <div
                    style={{
                      background:
                        "#f8fafc",
                      borderRadius:
                        "12px",
                      padding:
                        "10px",
                        textAlign:
                          "center",
                    }}
                  >
                    <strong
                      style={{
                        display:
                          "block",
                        fontSize:
                          "20px",
                        color:
                          stats.percentage >=
                          70
                            ? "#16a34a"
                            : "#4f46e5",
                      }}
                    >
                      {
                        stats.percentage
                      }%
                    </strong>

                    <span
                      style={{
                        fontSize:
                          "11px",
                        color:
                          "#64748b",
                      }}
                    >
                      Accuracy
                    </span>
                  </div>

                </div>

                {/* BUTTONS */}

                <div
                  style={{
                    display:
                      "flex",
                    flexDirection:
                      "column",
                    gap:
                      "8px",
                    marginTop:
                      "18px",
                  }}
                >

                  <button
                    type="button"
                    className="primary-card-button"
                    disabled={
                      stats.cards ===
                      0
                    }
                    onClick={() =>
                      startPractice(
                        deck.id
                      )
                    }
                  >
                    🎯 Practice Deck
                  </button>

                  <button
                    type="button"
                    className="manage-subjects-button"
                    onClick={() =>
                      setSelectedDeckId(
                        isSelected
                          ? null
                          : deck.id
                      )
                    }
                  >
                    {isSelected
                      ? "▲ Hide Cards"
                      : "▼ View Cards"}
                  </button>

                  <div
                    style={{
                      display:
                        "flex",
                      gap:
                        "8px",
                    }}
                  >

                    <button
                      type="button"
                      className="manage-subjects-button"
                      style={{
                        flex:
                          1,
                      }}
                      onClick={() =>
                        openEditDeck(
                          deck
                        )
                      }
                    >
                      ✏️ Edit
                    </button>

                    <button
                      type="button"
                      disabled={
                        deletingDeckId ===
                        deck.id
                      }
                      onClick={() =>
                        deleteDeck(
                          deck.id
                        )
                      }
                      style={{
                        flex:
                          1,
                        border:
                          "1px solid #fecaca",
                        background:
                          "#fff1f2",
                        color:
                          "#be123c",
                        borderRadius:
                          "10px",
                        padding:
                          "10px",
                        cursor:
                          "pointer",
                        fontWeight:
                          700,
                      }}
                    >
                      {deletingDeckId ===
                      deck.id
                        ? "Deleting..."
                        : "🗑️ Delete"}
                    </button>

                  </div>

                </div>

                {/* DECK CARDS */}

                {isSelected && (
                  <div
                    style={{
                      marginTop:
                        "20px",
                      paddingTop:
                        "18px",
                      borderTop:
                        "1px solid #e2e8f0",
                    }}
                  >

                    <div
                      style={{
                        display:
                          "flex",
                        justifyContent:
                          "space-between",
                        alignItems:
                          "center",
                        gap:
                          "10px",
                        marginBottom:
                          "12px",
                      }}
                    >

                      <strong>
                        Cards in this deck
                      </strong>

                      <button
                        type="button"
                        className="manage-subjects-button"
                        onClick={() =>
                          openCreateFlashcard(
                            deck.id
                          )
                        }
                      >
                        ➕ Add
                      </button>

                    </div>

                    {getDeckCards(
                      deck.id
                    ).length === 0 ? (

                      <p
                        style={{
                          color:
                            "#64748b",
                          fontSize:
                            "13px",
                        }}
                      >
                        No cards in this
                        deck yet.
                      </p>

                    ) : (

                      <div
                        style={{
                          display:
                            "flex",
                          flexDirection:
                            "column",
                          gap:
                            "8px",
                        }}
                      >

                        {getDeckCards(
                          deck.id
                        ).map(
                          (card) => (
                            <div
                              key={
                                card.id
                              }
                              style={{
                                padding:
                                  "12px",
                                borderRadius:
                                  "12px",
                                background:
                                  "#f8fafc",
                              }}
                            >

                              <div
                                style={{
                                  fontWeight:
                                    700,
                                  fontSize:
                                    "13px",
                                  marginBottom:
                                    "8px",
                                }}
                              >
                                {
                                  card.question
                                }
                              </div>

                              <div
                                style={{
                                  display:
                                    "flex",
                                  gap:
                                    "6px",
                                }}
                              >

                                <button
                                  type="button"
                                  className="manage-subjects-button"
                                  onClick={() =>
                                    openEditFlashcard(
                                      card
                                    )
                                  }
                                >
                                  ✏️
                                </button>

                                <button
                                  type="button"
                                  disabled={
                                    deletingFlashcardId ===
                                    card.id
                                  }
                                  onClick={() =>
                                    deleteFlashcard(
                                      card.id
                                    )
                                  }
                                  style={{
                                    border:
                                      "1px solid #fecaca",
                                    background:
                                      "#fff1f2",
                                    color:
                                      "#be123c",
                                    borderRadius:
                                      "8px",
                                    padding:
                                      "7px 10px",
                                    cursor:
                                      "pointer",
                                  }}
                                >
                                  🗑️
                                </button>

                              </div>

                            </div>
                          )
                        )}

                      </div>

                    )}

                  </div>
                )}

              </div>
            );
          })}

        </div>
      )}

      {/* =====================================================
          DECK CREATOR MODAL
      ===================================================== */}

      {showDeckCreator && (

        <div
          style={{
            position:
              "fixed",
            inset: 0,
            background:
              "rgba(15,23,42,0.55)",
            display:
              "flex",
            alignItems:
              "center",
            justifyContent:
              "center",
            zIndex:
              1000,
            padding:
              "20px",
          }}
        >

          <div
            style={{
              width:
                "100%",
              maxWidth:
                "520px",
              background:
                "white",
              borderRadius:
                "22px",
              padding:
                "30px",
              boxShadow:
                "0 20px 60px rgba(0,0,0,0.25)",
            }}
          >

            <div
              style={{
                display:
                  "flex",
                justifyContent:
                  "space-between",
                alignItems:
                  "flex-start",
                gap:
                  "20px",
              }}
            >

              <div>

                <p className="card-eyebrow">
                  FLASHCARD DECK
                </p>

                <h2>
                  {editingDeckId
                    ? "✏️ Edit Deck"
                    : "🗂️ Create Deck"}
                </h2>

                <p
                  style={{
                    color:
                      "#64748b",
                  }}
                >
                  Organise your flashcards
                  into focused revision
                  sets.
                </p>

              </div>

              <button
                type="button"
                onClick={() => {
                  setShowDeckCreator(
                    false
                  );
                  resetDeckCreator();
                }}
                style={{
                  border:
                    "none",
                  background:
                    "#f1f5f9",
                  borderRadius:
                    "50%",
                  width:
                    "38px",
                  height:
                    "38px",
                  cursor:
                    "pointer",
                  fontSize:
                    "18px",
                }}
              >
                ✕
              </button>

            </div>

            <form
              onSubmit={
                saveDeck
              }
            >

              <div
                style={{
                  marginTop:
                    "20px",
                }}
              >

                <label
                  style={{
                    display:
                      "block",
                    fontWeight:
                      700,
                    marginBottom:
                      "7px",
                  }}
                >
                  🗂️ Deck name
                </label>

                <input
                  type="text"
                  value={
                    deckName
                  }
                  onChange={(event) =>
                    setDeckName(
                      event
                        .target
                        .value
                    )
                  }
                  placeholder="e.g. A-Level Maths — Differentiation"
                  style={{
                    width:
                      "100%",
                    boxSizing:
                      "border-box",
                  }}
                  required
                />

              </div>

              <div
                style={{
                  marginTop:
                    "18px",
                }}
              >

                <label
                  style={{
                    display:
                      "block",
                    fontWeight:
                      700,
                    marginBottom:
                      "7px",
                  }}
                >
                  📚 Subject
                </label>

                <input
                  type="text"
                  value={
                    deckSubject
                  }
                  onChange={(event) =>
                    setDeckSubject(
                      event
                        .target
                        .value
                    )
                  }
                  placeholder="e.g. Mathematics"
                  style={{
                    width:
                      "100%",
                    boxSizing:
                      "border-box",
                  }}
                />

              </div>

              <div
                style={{
                  marginTop:
                    "18px",
                }}
              >

                <label
                  style={{
                    display:
                      "block",
                    fontWeight:
                      700,
                    marginBottom:
                      "7px",
                  }}
                >
                  📝 Description
                </label>

                <textarea
                  value={
                    deckDescription
                  }
                  onChange={(event) =>
                    setDeckDescription(
                      event
                        .target
                        .value
                    )
                  }
                  placeholder="What will you revise with this deck?"
                  rows={4}
                  style={{
                    width:
                      "100%",
                    boxSizing:
                      "border-box",
                    resize:
                      "vertical",
                  }}
                />

              </div>

              <div
                style={{
                  display:
                    "flex",
                  gap:
                    "10px",
                  marginTop:
                    "25px",
                }}
              >

                <button
                  type="button"
                  className="manage-subjects-button"
                  onClick={() => {
                    setShowDeckCreator(
                      false
                    );
                    resetDeckCreator();
                  }}
                  style={{
                    flex:
                      1,
                  }}
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  className="primary-card-button"
                  disabled={
                    creatingDeck
                  }
                  style={{
                    flex:
                      1,
                  }}
                >
                  {creatingDeck
                    ? "Saving..."
                    : editingDeckId
                    ? "💾 Save Changes"
                    : "🗂️ Create Deck"}
                </button>

              </div>

            </form>

          </div>

        </div>

      )}

      {/* =====================================================
          FLASHCARD CREATOR MODAL
      ===================================================== */}

      {showFlashcardCreator && (

        <div
          style={{
            position:
              "fixed",
            inset: 0,
            background:
              "rgba(15,23,42,0.55)",
            display:
              "flex",
            alignItems:
              "center",
            justifyContent:
              "center",
            zIndex:
              1000,
            padding:
              "20px",
            overflowY:
              "auto",
          }}
        >

          <div
            style={{
              width:
                "100%",
              maxWidth:
                "650px",
              background:
                "white",
              borderRadius:
                "22px",
              padding:
                "30px",
              boxShadow:
                "0 20px 60px rgba(0,0,0,0.25)",
              margin:
                "30px 0",
            }}
          >

            <div
              style={{
                display:
                  "flex",
                justifyContent:
                  "space-between",
                alignItems:
                  "flex-start",
                gap:
                  "20px",
              }}
            >

              <div>

                <p className="card-eyebrow">
                  FLASHCARD
                </p>

                <h2>
                  {editingFlashcardId
                    ? "✏️ Edit Flashcard"
                    : "🃏 Create Flashcard"}
                </h2>

                <p
                  style={{
                    color:
                      "#64748b",
                  }}
                >
                  Create a multiple-choice
                  question and place it in
                  the correct deck.
                </p>

              </div>

              <button
                type="button"
                onClick={() => {
                  setShowFlashcardCreator(
                    false
                  );
                  resetFlashcardCreator();
                }}
                style={{
                  border:
                    "none",
                  background:
                    "#f1f5f9",
                  borderRadius:
                    "50%",
                  width:
                    "38px",
                  height:
                    "38px",
                  cursor:
                    "pointer",
                  fontSize:
                    "18px",
                }}
              >
                ✕
              </button>

            </div>

            <form
              onSubmit={
                saveFlashcard
              }
            >

              {/* DECK */}

              <div
                style={{
                  marginTop:
                    "20px",
                }}
              >

                <label
                  style={{
                    display:
                      "block",
                    fontWeight:
                      700,
                    marginBottom:
                      "7px",
                  }}
                >
                  🗂️ Deck
                </label>

                <select
                  value={
                    flashcardDeckId
                  }
                  onChange={(event) =>
                    setFlashcardDeckId(
                      event
                        .target
                        .value
                    )
                  }
                  style={{
                    width:
                      "100%",
                    boxSizing:
                      "border-box",
                  }}
                  required
                >

                  <option value="">
                    Select a deck
                  </option>

                  {decks.map(
                    (deck) => (
                      <option
                        key={
                          deck.id
                        }
                        value={
                          deck.id
                        }
                      >
                        {deck.name}
                        {deck.subject
                          ? ` — ${deck.subject}`
                          : ""}
                      </option>
                    )
                  )}

                </select>

              </div>

              {/* TOPIC */}

              <div
                style={{
                  marginTop:
                    "18px",
                }}
              >

                <label
                  style={{
                    display:
                      "block",
                    fontWeight:
                      700,
                    marginBottom:
                      "7px",
                  }}
                >
                  📚 Topic
                </label>

                <input
                  type="text"
                  value={
                    flashcardTopic
                  }
                  onChange={(event) =>
                    setFlashcardTopic(
                      event
                        .target
                        .value
                    )
                  }
                  placeholder="e.g. Differentiation"
                  style={{
                    width:
                      "100%",
                    boxSizing:
                      "border-box",
                  }}
                  required
                />

              </div>

              {/* QUESTION */}

              <div
                style={{
                  marginTop:
                    "18px",
                }}
              >

                <label
                  style={{
                    display:
                      "block",
                    fontWeight:
                      700,
                    marginBottom:
                      "7px",
                  }}
                >
                  📝 Question
                </label>

                <textarea
                  value={
                    flashcardQuestion
                  }
                  onChange={(event) =>
                    setFlashcardQuestion(
                      event
                        .target
                        .value
                    )
                  }
                  placeholder="Write your question..."
                  rows={4}
                  style={{
                    width:
                      "100%",
                    boxSizing:
                      "border-box",
                    resize:
                      "vertical",
                  }}
                  required
                />

              </div>

              {/* ANSWERS */}

              <div
                style={{
                  marginTop:
                    "20px",
                }}
              >

                <label
                  style={{
                    display:
                      "block",
                    fontWeight:
                      700,
                    marginBottom:
                      "10px",
                  }}
                >
                  🔤 Answers
                </label>

                {[
                  "A",
                  "B",
                  "C",
                  "D",
                ].map(
                  (letter) => (
                    <div
                      key={
                        letter
                      }
                      style={{
                        display:
                          "flex",
                        alignItems:
                          "center",
                        gap:
                          "10px",
                        marginBottom:
                          "10px",
                      }}
                    >

                      <div
                        style={{
                          minWidth:
                            "34px",
                          height:
                            "34px",
                          borderRadius:
                            "50%",
                          background:
                            "#eef2ff",
                          color:
                            "#4f46e5",
                          display:
                            "flex",
                          alignItems:
                            "center",
                          justifyContent:
                            "center",
                          fontWeight:
                            800,
                        }}
                      >
                        {
                          letter
                        }
                      </div>

                      <input
                        type="text"
                        value={
                          flashcardOptions[
                            letter
                          ]
                        }
                        onChange={(
                          event
                        ) =>
                          setFlashcardOptions(
                            (
                              previous
                            ) => ({
                              ...previous,
                              [letter]:
                                event
                                  .target
                                  .value,
                            })
                          )
                        }
                        placeholder={`Answer ${letter}`}
                        style={{
                          flex:
                            1,
                        }}
                        required
                      />

                    </div>
                  )
                )}

              </div>

              {/* CORRECT ANSWER */}

              <div
                style={{
                  marginTop:
                    "20px",
                  padding:
                    "18px",
                  borderRadius:
                    "14px",
                  background:
                    "#f8fafc",
                }}
              >

                <label
                  style={{
                    display:
                      "block",
                    fontWeight:
                      700,
                    marginBottom:
                      "10px",
                  }}
                >
                  ✅ Correct answer
                </label>

                <div
                  style={{
                    display:
                      "grid",
                    gridTemplateColumns:
                      "repeat(4, 1fr)",
                    gap:
                      "10px",
                  }}
                >

                  {[
                    "A",
                    "B",
                    "C",
                    "D",
                  ].map(
                    (letter) => (
                      <button
                        key={
                          letter
                        }
                        type="button"
                        onClick={() =>
                          setCorrectAnswer(
                            letter
                          )
                        }
                        style={{
                          padding:
                            "10px",
                          borderRadius:
                            "10px",
                          border:
                            correctAnswer ===
                            letter
                              ? "2px solid #22c55e"
                              : "1px solid #e2e8f0",
                          background:
                            correctAnswer ===
                            letter
                              ? "#dcfce7"
                              : "white",
                          color:
                            correctAnswer ===
                            letter
                              ? "#166534"
                              : "#475569",
                          fontWeight:
                            700,
                          cursor:
                            "pointer",
                        }}
                      >
                        {
                          letter
                        }
                      </button>
                    )
                  )}

                </div>

              </div>

              {/* BUTTONS */}

              <div
                style={{
                  display:
                    "flex",
                  gap:
                    "10px",
                  marginTop:
                    "25px",
                }}
              >

                <button
                  type="button"
                  className="manage-subjects-button"
                  onClick={() => {
                    setShowFlashcardCreator(
                      false
                    );
                    resetFlashcardCreator();
                  }}
                  style={{
                    flex:
                      1,
                  }}
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  className="primary-card-button"
                  disabled={
                    creatingFlashcard
                  }
                  style={{
                    flex:
                      1,
                  }}
                >
                  {creatingFlashcard
                    ? "Saving..."
                    : editingFlashcardId
                    ? "💾 Save Changes"
                    : "💾 Save Flashcard"}
                </button>

              </div>

            </form>

          </div>

        </div>

      )}

      {/* =====================================================
          YOUR SUBJECTS
      ===================================================== */}

      <div className="revision-section-heading">

        <div>

          <h3>
            Your Subjects
          </h3>

          <p>
            {subjects.length === 0
              ? "No subjects selected yet."
              : `${subjects.length} ${
                  subjects.length ===
                  1
                    ? "subject"
                    : "subjects"
                } selected`}
          </p>

        </div>

      </div>

      {subjects.length === 0 ? (

        <div className="no-subjects">

          <div className="no-subjects-icon">
            📚
          </div>

          <h3>
            No subjects selected
          </h3>

          <p>
            Choose your sixth-form
            subjects to start building
            your revision hub.
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

      ) : (

        <div className="revision-subject-grid">

          {subjects.map(
            (subject) => {

              const subjectUnits =
                units.filter(
                  (unit) =>
                    unit.subject_id ===
                    subject.id
                );

              return (
                <div
                  key={
                    subject.id
                  }
                  className="revision-subject-card"
                >

                  <div className="revision-subject-top">

                    <div className="revision-subject-icon">
                      {subject.icon ||
                        "📚"}
                    </div>

                    <div>
                      <strong>
                        {
                          subject.name
                        }
                      </strong>
                    </div>

                  </div>

                  <div className="revision-subject-content">

                    <h3>
                      {
                        subject.name
                      }
                    </h3>

                    <p>
                      {subject.description ||
                        `WJEC ${subject.name}`}
                    </p>

                  </div>

                  <div
                    style={{
                      display:
                        "flex",
                      flexDirection:
                        "column",
                      gap:
                        "10px",
                      marginTop:
                        "15px",
                    }}
                  >

                    <button
                      type="button"
                      className="primary-card-button"
                      onClick={() =>
                        openLink(
                          subject.specification_url
                        )
                      }
                      disabled={
                        !subject.specification_url
                      }
                    >
                      📋 Specification →
                    </button>

                    <button
                      type="button"
                      className="primary-card-button"
                      onClick={() =>
                        openLink(
                          subject.past_papers_url
                        )
                      }
                      disabled={
                        !subject.past_papers_url
                      }
                    >
                      📄 Past Papers →
                    </button>

                  </div>

                  {subjectUnits.length >
                    0 && (

                    <div
                      style={{
                        marginTop:
                          "20px",
                      }}
                    >

                      <h4>
                        📖 Specification Topics
                      </h4>

                      {subjectUnits.map(
                        (unit) => {

                          const unitTopics =
                            topics.filter(
                              (topic) =>
                                topic.unit_id ===
                                unit.id
                            );

                          const unitExpanded =
                            expandedUnits[
                              unit.id
                            ];

                          return (
                            <div
                              key={
                                unit.id
                              }
                              style={{
                                marginTop:
                                  "10px",
                              }}
                            >

                              <button
                                type="button"
                                className="primary-card-button"
                                onClick={() =>
                                  toggleUnit(
                                    unit.id
                                  )
                                }
                                style={{
                                  width:
                                    "100%",
                                  textAlign:
                                    "left",
                                }}
                              >
                                {unitExpanded
                                  ? "▼"
                                  : "▶"}{" "}
                                {
                                  unit.name
                                }
                              </button>

                              {unitExpanded && (

                                <div
                                  style={{
                                    marginTop:
                                      "8px",
                                    paddingLeft:
                                      "10px",
                                  }}
                                >

                                  {unit.description && (
                                    <p>
                                      {
                                        unit.description
                                      }
                                    </p>
                                  )}

                                  {unitTopics.map(
                                    (
                                      topic
                                    ) => {

                                      const topicSubtopics =
                                        subtopics.filter(
                                          (
                                            subtopic
                                          ) =>
                                            subtopic.topic_id ===
                                            topic.id
                                        );

                                      const topicExpanded =
                                        expandedTopics[
                                          topic.id
                                        ];

                                      return (
                                        <div
                                          key={
                                            topic.id
                                          }
                                          style={{
                                            marginTop:
                                              "8px",
                                          }}
                                        >

                                          <button
                                            type="button"
                                            className="primary-card-button"
                                            onClick={() =>
                                              toggleTopic(
                                                topic.id
                                              )
                                            }
                                            style={{
                                              width:
                                                "100%",
                                              textAlign:
                                                "left",
                                            }}
                                          >
                                            {topicExpanded
                                              ? "▼"
                                              : "▶"}{" "}
                                            {
                                              topic.name
                                            }
                                          </button>

                                          {topicExpanded && (

                                            <div
                                              style={{
                                                padding:
                                                  "8px 0 8px 15px",
                                              }}
                                            >

                                              {topic.description && (
                                                <p>
                                                  {
                                                    topic.description
                                                  }
                                                </p>
                                              )}

                                              {topicSubtopics.length ===
                                              0 ? (

                                                <p>
                                                  No subtopics added yet.
                                                </p>

                                              ) : (

                                                topicSubtopics.map(
                                                  (
                                                    subtopic
                                                  ) => {

                                                    const completed =
                                                      isCompleted(
                                                        subtopic.id
                                                      );

                                                    return (
                                                      <label
                                                        key={
                                                          subtopic.id
                                                        }
                                                        style={{
                                                          display:
                                                            "flex",
                                                          alignItems:
                                                            "center",
                                                          gap:
                                                            "8px",
                                                          padding:
                                                            "7px 0",
                                                          cursor:
                                                            "pointer",
                                                        }}
                                                      >

                                                        <input
                                                          type="checkbox"
                                                          checked={
                                                            completed
                                                          }
                                                          onChange={() =>
                                                            toggleCompleted(
                                                              subtopic.id
                                                            )
                                                          }
                                                        />

                                                        <span
                                                          style={{
                                                            textDecoration:
                                                              completed
                                                                ? "line-through"
                                                                : "none",
                                                            opacity:
                                                              completed
                                                                ? 0.6
                                                                : 1,
                                                          }}
                                                        >
                                                          {
                                                            subtopic.name
                                                          }
                                                        </span>

                                                      </label>
                                                    );
                                                  }
                                                )

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

                  )}

                </div>
              );
            }
          )}

        </div>

      )}

      {/* =====================================================
          TOPICS INFORMATION
      ===================================================== */}

      <div className="revision-section-heading">

        <div>

          <h3>
            📖 Topics
          </h3>

          <p>
            Work through your specification
            topic by topic.
          </p>

        </div>

      </div>

      <div className="revision-information">

        <div className="revision-information-icon">
          🚀
        </div>

        <div>

          <strong>
            Your revision hub is growing
          </strong>

          <p>
            Your WJEC specifications,
            units, topics and subtopics
            will appear here as they are
            added to the database.
          </p>

        </div>

      </div>

    </div>
  );
}

export default Revision;