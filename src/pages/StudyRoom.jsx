import {
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import { supabase } from "../lib/supabase";
import PaperWorkspace from "./PaperWorkspace";

function StudyRoom({
  session: initialSession,
  setPage,
  onExit,
}) {
  const canvasRef = useRef(null);
  const drawingRef = useRef(false);
  const currentStrokeRef = useRef(null);
  const liveChannelRef = useRef(null);
  const messagesEndRef = useRef(null);

  const flashcardSessionRef = useRef(null);
  const flashcardCardsRef = useRef([]);
  const flashcardDeckNameRef = useRef("");

  const [currentUser, setCurrentUser] =
    useState(null);

  const [session, setSession] =
    useState(initialSession);

  const [members, setMembers] =
    useState([]);

  const [profiles, setProfiles] =
    useState({});

  const [messages, setMessages] =
    useState([]);

  const [message, setMessage] =
    useState("");

  const [strokes, setStrokes] =
    useState([]);

  const [friends, setFriends] =
    useState([]);

  const [invites, setInvites] =
    useState([]);

  const [
    showInviteFriends,
    setShowInviteFriends,
  ] = useState(false);

  const [inviteLoading, setInviteLoading] =
    useState(null);

  // =========================================================
  // MULTIPLAYER FLASHCARDS
  // =========================================================

  async function loadFlashcardDecks() {
    if (!currentUser) {
      return;
    }

    try {
      setFlashcardPickerLoading(true);
      setError("");

      const {
        data,
        error,
      } = await supabase
        .from("user_flashcard_decks")
        .select(
          "id, user_id, name, subject, description, created_at, updated_at"
        )
        .eq("user_id", currentUser.id)
        .order("updated_at", {
          ascending: false,
        });

      if (error) {
        throw error;
      }

      setFlashcardDecks(data || []);
    } catch (err) {
      console.error(
        "Could not load flashcard decks:",
        err
      );

      setError(
        err?.message ||
          "Could not load your flashcard decks."
      );
    } finally {
      setFlashcardPickerLoading(false);
    }
  }

  async function openFlashcardPicker() {
    if (!isHost) {
      return;
    }

    setShowFlashcardPicker(true);
    await loadFlashcardDecks();
  }

  async function loadDeckCards(
    deckId
  ) {
    const {
      data,
      error,
    } = await supabase
      .from("user_flashcards")
      .select(
        "id, deck_id, user_id, front, back, created_at, updated_at"
      )
      .eq("deck_id", deckId)
      .eq("user_id", currentUser.id)
      .order("created_at", {
        ascending: true,
      });

    if (error) {
      throw error;
    }

    return data || [];
  }

  async function loadActiveFlashcardSession(
    userId = currentUser?.id
  ) {
    try {
      const {
        data,
        error,
      } = await supabase
        .from(
          "study_flashcard_sessions"
        )
        .select(
          "id, session_id, deck_id, created_by, current_card, status, answer_revealed, created_at, finished_at"
        )
        .eq(
          "session_id",
          initialSession.id
        )
        .order("created_at", {
          ascending: false,
        })
        .limit(1);

      if (error) {
        throw error;
      }

      const flashSession =
        data?.[0] || null;

      if (!flashSession) {
        setActiveFlashcardSession(
          null
        );
        setFlashcardResponses([]);
        setMyFlashcardRatings({});
        setSharedFlashcard(null);
        return;
      }

      setActiveFlashcardSession(
        flashSession
      );

      await loadFlashcardResponses(
        flashSession.id,
        userId
      );

      /*
       * Only the owner/host needs the whole deck locally.
       * Other participants receive the current card through
       * the Study Room's Realtime broadcast channel.
       */
      if (
        currentUser?.id &&
        flashSession.created_by ===
          currentUser.id &&
        flashcardCardsRef.current
          .length === 0
      ) {
        const {
          data: deck,
          error: deckError,
        } = await supabase
          .from(
            "user_flashcard_decks"
          )
          .select(
            "id, name, subject, description"
          )
          .eq(
            "id",
            flashSession.deck_id
          )
          .eq(
            "user_id",
            currentUser.id
          )
          .single();

        if (!deckError && deck) {
          const cards =
            await loadDeckCards(
              flashSession.deck_id
            );

          setFlashcardDeckName(
            deck.name
          );

          setFlashcardCards(
            cards
          );

          setTimeout(() => {
            sendCurrentFlashcardState(
              flashSession,
              cards,
              deck.name
            );
          }, 100);
        }
      }
    } catch (err) {
      console.error(
        "Could not load multiplayer flashcards:",
        err
      );
    }
  }

  async function loadFlashcardResponses(
    flashcardSessionId,
    userId = currentUser?.id
  ) {
    if (!flashcardSessionId) {
      return;
    }

    const {
      data,
      error,
    } = await supabase
      .from(
        "study_flashcard_responses"
      )
      .select(
        "id, flashcard_session_id, card_id, user_id, rating, created_at"
      )
      .eq(
        "flashcard_session_id",
        flashcardSessionId
      )
      .order("created_at", {
        ascending: true,
      });

    if (error) {
      throw error;
    }

    const rows = data || [];

    setFlashcardResponses(rows);

    const mine = {};

    rows.forEach((row) => {
      if (
        row.user_id === userId
      ) {
        mine[row.card_id] =
          row.rating;
      }
    });

    setMyFlashcardRatings(mine);

    await loadProfiles(
      rows.map(
        (row) => row.user_id
      )
    );
  }

  async function createFlashcardSession(
    deck
  ) {
    if (
      !isHost ||
      !currentUser ||
      !deck?.id
    ) {
      return;
    }

    try {
      setFlashcardStarting(true);
      setError("");

      const cards =
        await loadDeckCards(
          deck.id
        );

      if (cards.length === 0) {
        throw new Error(
          "This flashcard deck has no cards yet."
        );
      }

      const {
        data: flashSession,
        error: sessionError,
      } = await supabase
        .from(
          "study_flashcard_sessions"
        )
        .insert({
          session_id: session.id,
          deck_id: deck.id,
          created_by:
            currentUser.id,
          current_card: 0,
          status: "lobby",
          answer_revealed: false,
        })
        .select(
          "id, session_id, deck_id, created_by, current_card, status, answer_revealed, created_at, finished_at"
        )
        .single();

      if (sessionError) {
        throw sessionError;
      }

      const {
        error: roomError,
      } = await supabase
        .from("study_sessions")
        .update({
          activity:
            "flashcards",
          active_paper_id: null,
          active_paper_room_id:
            null,
        })
        .eq("id", session.id);

      if (roomError) {
        throw roomError;
      }

      setFlashcardDeckName(
        deck.name
      );

      setFlashcardCards(cards);
      flashcardCardsRef.current =
        cards;

      setActiveFlashcardSession(
        flashSession
      );

      flashcardSessionRef.current =
        flashSession;

      setFlashcardResponses([]);
      setMyFlashcardRatings({});
      setSharedFlashcard(null);
      setShowFlashcardPicker(false);

      await loadSession();

      setTimeout(() => {
        sendCurrentFlashcardState(
          flashSession,
          cards,
          deck.name
        );
      }, 100);
    } catch (err) {
      console.error(
        "Could not start multiplayer flashcards:",
        err
      );

      setError(
        err?.message ||
          "Could not start multiplayer flashcards."
      );
    } finally {
      setFlashcardStarting(false);
    }
  }

  function getCurrentFlashcard(
    flashSession =
      flashcardSessionRef.current,
    cards =
      flashcardCardsRef.current
  ) {
    if (
      !flashSession ||
      !cards?.length ||
      Number(
        flashSession.current_card
      ) < 1
    ) {
      return null;
    }

    return (
      cards[
        Number(
          flashSession.current_card
        ) - 1
      ] || null
    );
  }

  async function sendCurrentFlashcardState(
    flashSession =
      flashcardSessionRef.current,
    cards =
      flashcardCardsRef.current,
    deckName =
      flashcardDeckNameRef.current
  ) {
    if (
      !currentUser ||
      !liveChannelRef.current ||
      !flashSession ||
      flashSession.created_by !==
        currentUser.id
    ) {
      return;
    }

    const card =
      getCurrentFlashcard(
        flashSession,
        cards
      );

    let safeCard = null;

    if (card) {
      safeCard = {
        id: card.id,
        front: card.front,
        back:
          flashSession.answer_revealed
            ? card.back
            : null,
        number:
          flashSession.current_card,
        total:
          cards.length,
      };
    }

    await liveChannelRef.current.send({
      type: "broadcast",
      event: "flashcard-state",
      payload: {
        deckName:
          deckName || "",
        card: safeCard,
      },
    });

    setSharedFlashcard(
      safeCard
    );
  }

  async function requestCurrentFlashcardState() {
    if (
      !currentUser ||
      !liveChannelRef.current
    ) {
      return;
    }

    const flashSession =
      flashcardSessionRef.current;

    if (
      flashSession?.created_by ===
      currentUser.id
    ) {
      await sendCurrentFlashcardState();
      return;
    }

    await liveChannelRef.current.send({
      type: "broadcast",
      event:
        "flashcard-state-request",
      payload: {
        userId:
          currentUser.id,
      },
    });
  }

  async function startFlashcards() {
    if (
      !isHost ||
      !activeFlashcardSession ||
      flashcardCards.length === 0
    ) {
      return;
    }

    try {
      setFlashcardTransitioning(true);
      setError("");

      const {
        data: updated,
        error,
      } = await supabase
        .from(
          "study_flashcard_sessions"
        )
        .update({
          status: "playing",
          current_card: 1,
          answer_revealed:
            false,
        })
        .eq(
          "id",
          activeFlashcardSession.id
        )
        .select(
          "id, session_id, deck_id, created_by, current_card, status, answer_revealed, created_at, finished_at"
        )
        .single();

      if (error) {
        throw error;
      }

      setActiveFlashcardSession(
        updated
      );

      flashcardSessionRef.current =
        updated;

      await sendCurrentFlashcardState(
        updated
      );
    } catch (err) {
      setError(
        err?.message ||
          "Could not start the flashcards."
      );
    } finally {
      setFlashcardTransitioning(false);
    }
  }

  async function revealFlashcardAnswer() {
    if (
      !isHost ||
      !activeFlashcardSession
    ) {
      return;
    }

    try {
      setFlashcardTransitioning(true);

      const {
        data: updated,
        error,
      } = await supabase
        .from(
          "study_flashcard_sessions"
        )
        .update({
          answer_revealed:
            true,
        })
        .eq(
          "id",
          activeFlashcardSession.id
        )
        .select(
          "id, session_id, deck_id, created_by, current_card, status, answer_revealed, created_at, finished_at"
        )
        .single();

      if (error) {
        throw error;
      }

      setActiveFlashcardSession(
        updated
      );

      flashcardSessionRef.current =
        updated;

      await sendCurrentFlashcardState(
        updated
      );
    } catch (err) {
      setError(
        err?.message ||
          "Could not reveal the answer."
      );
    } finally {
      setFlashcardTransitioning(false);
    }
  }

  async function rateFlashcard(
    rating
  ) {
    if (
      !currentUser ||
      !activeFlashcardSession ||
      !sharedFlashcard?.id ||
      !activeFlashcardSession.answer_revealed ||
      myFlashcardRatings[
        sharedFlashcard.id
      ]
    ) {
      return;
    }

    try {
      setFlashcardRatingLoading(true);

      const {
        error,
      } = await supabase
        .from(
          "study_flashcard_responses"
        )
        .insert({
          flashcard_session_id:
            activeFlashcardSession.id,
          card_id:
            sharedFlashcard.id,
          user_id:
            currentUser.id,
          rating,
        });

      if (error) {
        throw error;
      }

      setMyFlashcardRatings(
        (current) => ({
          ...current,
          [sharedFlashcard.id]:
            rating,
        })
      );

      await loadFlashcardResponses(
        activeFlashcardSession.id,
        currentUser.id
      );
    } catch (err) {
      console.error(
        "Could not rate flashcard:",
        err
      );

      setError(
        err?.message ||
          "Could not save your rating."
      );
    } finally {
      setFlashcardRatingLoading(false);
    }
  }

  async function nextFlashcard() {
    if (
      !isHost ||
      !activeFlashcardSession
    ) {
      return;
    }

    try {
      setFlashcardTransitioning(true);

      const nextNumber =
        Number(
          activeFlashcardSession.current_card ||
            0
        ) + 1;

      if (
        nextNumber >
        flashcardCards.length
      ) {
        await finishFlashcards();
        return;
      }

      const {
        data: updated,
        error,
      } = await supabase
        .from(
          "study_flashcard_sessions"
        )
        .update({
          current_card:
            nextNumber,
          answer_revealed:
            false,
        })
        .eq(
          "id",
          activeFlashcardSession.id
        )
        .select(
          "id, session_id, deck_id, created_by, current_card, status, answer_revealed, created_at, finished_at"
        )
        .single();

      if (error) {
        throw error;
      }

      setActiveFlashcardSession(
        updated
      );

      flashcardSessionRef.current =
        updated;

      await sendCurrentFlashcardState(
        updated
      );
    } catch (err) {
      setError(
        err?.message ||
          "Could not move to the next card."
      );
    } finally {
      setFlashcardTransitioning(false);
    }
  }

  async function finishFlashcards() {
    if (
      !isHost ||
      !activeFlashcardSession
    ) {
      return;
    }

    const {
      data: updated,
      error,
    } = await supabase
      .from(
        "study_flashcard_sessions"
      )
      .update({
        status: "finished",
        finished_at:
          new Date().toISOString(),
        answer_revealed:
          true,
      })
      .eq(
        "id",
        activeFlashcardSession.id
      )
      .select(
        "id, session_id, deck_id, created_by, current_card, status, answer_revealed, created_at, finished_at"
      )
      .single();

    if (error) {
      throw error;
    }

    setActiveFlashcardSession(
      updated
    );

    flashcardSessionRef.current =
      updated;

    await sendCurrentFlashcardState(
      updated
    );

    await loadFlashcardResponses(
      updated.id,
      currentUser.id
    );
  }

  async function closeFlashcards() {
    if (!isHost) {
      return;
    }

    try {
      const {
        error,
      } = await supabase
        .from("study_sessions")
        .update({
          activity: "whiteboard",
        })
        .eq("id", session.id);

      if (error) {
        throw error;
      }

      setActiveFlashcardSession(
        null
      );
      flashcardSessionRef.current =
        null;

      setFlashcardCards([]);
      flashcardCardsRef.current =
        [];

      setSharedFlashcard(null);
      setFlashcardResponses([]);
      setMyFlashcardRatings({});
      setFlashcardDeckName("");

      await loadSession();
    } catch (err) {
      setError(
        err?.message ||
          "Could not return to the whiteboard."
      );
    }
  }

  function getFlashcardResults() {
    const byUser = {};

    flashcardResponses.forEach(
      (response) => {
        if (
          !byUser[response.user_id]
        ) {
          byUser[
            response.user_id
          ] = {
            user_id:
              response.user_id,
            got_it: 0,
            nearly: 0,
            didnt_know: 0,
            total: 0,
          };
        }

        byUser[
          response.user_id
        ][response.rating] += 1;

        byUser[
          response.user_id
        ].total += 1;
      }
    );

    return Object.values(byUser)
      .map((result) => {
        const weighted =
          result.got_it * 1 +
          result.nearly * 0.5;

        const mastery =
          result.total > 0
            ? Math.round(
                (weighted /
                  result.total) *
                  100
              )
            : 0;

        return {
          ...result,
          mastery,
        };
      })
      .sort(
        (a, b) =>
          b.mastery -
          a.mastery
      );
  }

  // =========================================================
  // REVISION BATTLES
  // =========================================================

  async function loadActiveBattle(
    userId = currentUser?.id
  ) {
    try {
      const {
        data: battles,
        error,
      } = await supabase
        .from("study_battles")
        .select(
          "id, session_id, created_by, title, status, current_question, question_started_at, seconds_per_question, created_at, finished_at"
        )
        .eq(
          "session_id",
          initialSession.id
        )
        .order("created_at", {
          ascending: false,
        })
        .limit(1);

      if (error) {
        throw error;
      }

      const battle =
        battles?.[0] || null;

      if (!battle) {
        setActiveBattle(null);
        setBattleQuestions([]);
        setBattleScores([]);
        setMyBattleAnswers({});
        setRevealedCorrectIndex(null);
        return;
      }

      setActiveBattle(battle);

      await Promise.all([
        loadBattleQuestions(
          battle.id,
          battle.status
        ),
        loadBattleScores(battle.id),
        userId
          ? loadMyBattleAnswers(
              battle.id,
              userId
            )
          : Promise.resolve(),
      ]);
    } catch (err) {
      console.error(
        "Could not load revision battle:",
        err
      );
    }
  }

  async function loadBattleQuestions(
    battleId,
    battleStatus =
      activeBattle?.status
  ) {
    const fields =
      battleStatus === "results" ||
      battleStatus === "finished"
        ? "id, battle_id, question_number, question_text, options, correct_index, explanation, created_at"
        : "id, battle_id, question_number, question_text, options, explanation, created_at";

    const {
      data,
      error,
    } = await supabase
      .from("study_battle_questions")
      .select(fields)
      .eq("battle_id", battleId)
      .order("question_number", {
        ascending: true,
      });

    if (error) {
      throw error;
    }

    setBattleQuestions(data || []);

    if (
      battleStatus === "results" ||
      battleStatus === "finished"
    ) {
      const current =
        (data || []).find(
          (question) =>
            question.question_number ===
            activeBattle?.current_question
        );

      if (
        current &&
        Number.isInteger(
          current.correct_index
        )
      ) {
        setRevealedCorrectIndex(
          current.correct_index
        );
      }
    }
  }

  async function loadBattleScores(
    battleId
  ) {
    const {
      data,
      error,
    } = await supabase
      .from("study_battle_scores")
      .select(
        "id, battle_id, user_id, score, correct_answers, total_response_ms, updated_at"
      )
      .eq("battle_id", battleId)
      .order("score", {
        ascending: false,
      })
      .order("total_response_ms", {
        ascending: true,
      });

    if (error) {
      throw error;
    }

    setBattleScores(data || []);

    await loadProfiles(
      (data || []).map(
        (row) => row.user_id
      )
    );
  }

  async function loadMyBattleAnswers(
    battleId,
    userId
  ) {
    const {
      data,
      error,
    } = await supabase
      .from("study_battle_answers")
      .select(
        "id, battle_id, question_id, user_id, selected_index, is_correct, answered_at, response_ms"
      )
      .eq("battle_id", battleId)
      .eq("user_id", userId);

    if (error) {
      throw error;
    }

    const map = {};

    (data || []).forEach((row) => {
      map[row.question_id] = row;
    });

    setMyBattleAnswers(map);
  }

  function calculateBattleRemaining(
    battle
  ) {
    if (
      !battle ||
      battle.status !== "question" ||
      !battle.question_started_at
    ) {
      return 0;
    }

    const seconds =
      Number(
        battle.seconds_per_question ||
          20
      );

    const startedAt =
      new Date(
        battle.question_started_at
      ).getTime();

    const elapsed =
      Math.max(
        0,
        Date.now() - startedAt
      ) / 1000;

    return Math.max(
      0,
      Math.ceil(seconds - elapsed)
    );
  }

  function addBattleQuestion() {
    setBattleDraftQuestions(
      (current) => [
        ...current,
        {
          question_text: "",
          options: ["", "", "", ""],
          correct_index: 0,
          explanation: "",
        },
      ]
    );
  }

  function removeBattleQuestion(
    index
  ) {
    setBattleDraftQuestions(
      (current) =>
        current.length <= 1
          ? current
          : current.filter(
              (_, questionIndex) =>
                questionIndex !== index
            )
    );
  }

  function updateBattleQuestion(
    index,
    field,
    value
  ) {
    setBattleDraftQuestions(
      (current) =>
        current.map(
          (question, questionIndex) =>
            questionIndex === index
              ? {
                  ...question,
                  [field]: value,
                }
              : question
        )
    );
  }

  function updateBattleOption(
    questionIndex,
    optionIndex,
    value
  ) {
    setBattleDraftQuestions(
      (current) =>
        current.map(
          (question, index) => {
            if (
              index !== questionIndex
            ) {
              return question;
            }

            const options = [
              ...question.options,
            ];

            options[optionIndex] =
              value;

            return {
              ...question,
              options,
            };
          }
        )
    );
  }

  async function createBattle(
    event
  ) {
    event.preventDefault();

    if (!isHost || !currentUser) {
      return;
    }

    const cleanQuestions =
      battleDraftQuestions.map(
        (question) => ({
          ...question,
          question_text:
            question.question_text.trim(),
          options:
            question.options.map(
              (option) =>
                option.trim()
            ),
          explanation:
            question.explanation.trim(),
        })
      );

    const invalidQuestion =
      cleanQuestions.find(
        (question) =>
          !question.question_text ||
          question.options.some(
            (option) => !option
          )
      );

    if (invalidQuestion) {
      setError(
        "Every battle question needs a question and four answer choices."
      );
      return;
    }

    try {
      setBattleCreating(true);
      setError("");

      const {
        data: battle,
        error: battleError,
      } = await supabase
        .from("study_battles")
        .insert({
          session_id: session.id,
          created_by:
            currentUser.id,
          title:
            battleTitle.trim() ||
            "Revision Battle",
          status: "lobby",
          current_question: 0,
          seconds_per_question:
            Math.min(
              60,
              Math.max(
                5,
                Number(
                  battleSeconds
                ) || 20
              )
            ),
        })
        .select(
          "id, session_id, created_by, title, status, current_question, question_started_at, seconds_per_question, created_at, finished_at"
        )
        .single();

      if (battleError) {
        throw battleError;
      }

      const rows =
        cleanQuestions.map(
          (question, index) => ({
            battle_id: battle.id,
            question_number:
              index + 1,
            question_text:
              question.question_text,
            options:
              question.options,
            correct_index:
              Number(
                question.correct_index
              ),
            explanation:
              question.explanation ||
              null,
          })
        );

      const {
        error: questionsError,
      } = await supabase
        .from(
          "study_battle_questions"
        )
        .insert(rows);

      if (questionsError) {
        throw questionsError;
      }

      const {
        error: sessionError,
      } = await supabase
        .from("study_sessions")
        .update({
          activity: "battle",
          active_paper_id: null,
          active_paper_room_id:
            null,
        })
        .eq("id", session.id);

      if (sessionError) {
        throw sessionError;
      }

      setShowBattleCreator(false);
      setBattleTitle(
        "Revision Battle"
      );
      setBattleSeconds(20);
      setBattleDraftQuestions([
        {
          question_text: "",
          options: [
            "",
            "",
            "",
            "",
          ],
          correct_index: 0,
          explanation: "",
        },
      ]);

      setActiveBattle(battle);
      await Promise.all([
        loadSession(),
        loadActiveBattle(
          currentUser.id
        ),
      ]);
    } catch (err) {
      console.error(
        "Could not create battle:",
        err
      );

      setError(
        err?.message ||
          "Could not create the Revision Battle."
      );
    } finally {
      setBattleCreating(false);
    }
  }

  async function startBattle() {
    if (
      !isHost ||
      !activeBattle
    ) {
      return;
    }

    if (
      battleQuestions.length === 0
    ) {
      setError(
        "This battle has no questions."
      );
      return;
    }

    try {
      setBattleTransitioning(true);
      setRevealedCorrectIndex(
        null
      );

      const {
        error,
      } = await supabase
        .from("study_battles")
        .update({
          status: "question",
          current_question: 1,
          question_started_at:
            new Date().toISOString(),
        })
        .eq(
          "id",
          activeBattle.id
        );

      if (error) {
        throw error;
      }

      await loadActiveBattle(
        currentUser.id
      );
    } catch (err) {
      setError(
        err?.message ||
          "Could not start the battle."
      );
    } finally {
      setBattleTransitioning(false);
    }
  }

  async function submitBattleAnswer(
    selectedIndex
  ) {
    if (
      !currentUser ||
      !activeBattle ||
      activeBattle.status !==
        "question"
    ) {
      return;
    }

    const question =
      battleQuestions.find(
        (item) =>
          item.question_number ===
          activeBattle.current_question
      );

    if (
      !question ||
      myBattleAnswers[
        question.id
      ]
    ) {
      return;
    }

    try {
      setError("");

      const {
        data: result,
        error,
      } = await supabase.rpc(
        "submit_study_battle_answer",
        {
          p_battle_id:
            activeBattle.id,
          p_question_id:
            question.id,
          p_selected_index:
            selectedIndex,
        }
      );

      if (error) {
        throw error;
      }

      setMyBattleAnswers(
        (current) => ({
          ...current,
          [question.id]: {
            question_id:
              question.id,
            selected_index:
              selectedIndex,
            is_correct:
              Boolean(
                result?.correct
              ),
            response_ms:
              result?.response_ms,
          },
        })
      );

      await loadBattleScores(
        activeBattle.id
      );
    } catch (err) {
      console.error(
        "Could not submit battle answer:",
        err
      );

      setError(
        err?.message ||
          "Could not submit your answer."
      );
    }
  }

  async function revealBattleResults() {
    if (
      !isHost ||
      !activeBattle ||
      activeBattle.status !==
        "question"
    ) {
      return;
    }

    try {
      setBattleTransitioning(true);

      const {
        error,
      } = await supabase
        .from("study_battles")
        .update({
          status: "results",
        })
        .eq(
          "id",
          activeBattle.id
        );

      if (error) {
        throw error;
      }

      const {
        data: questionData,
        error: questionError,
      } = await supabase
        .from(
          "study_battle_questions"
        )
        .select("correct_index")
        .eq(
          "battle_id",
          activeBattle.id
        )
        .eq(
          "question_number",
          activeBattle.current_question
        )
        .single();

      if (!questionError) {
        setRevealedCorrectIndex(
          questionData.correct_index
        );
      }

      await loadActiveBattle(
        currentUser.id
      );
    } catch (err) {
      setError(
        err?.message ||
          "Could not reveal the round results."
      );
    } finally {
      setBattleTransitioning(false);
    }
  }

  async function nextBattleQuestion() {
    if (
      !isHost ||
      !activeBattle
    ) {
      return;
    }

    try {
      setBattleTransitioning(true);
      setRevealedCorrectIndex(
        null
      );

      const nextNumber =
        Number(
          activeBattle.current_question ||
            0
        ) + 1;

      if (
        nextNumber >
        battleQuestions.length
      ) {
        await finishBattle();
        return;
      }

      const {
        error,
      } = await supabase
        .from("study_battles")
        .update({
          status: "question",
          current_question:
            nextNumber,
          question_started_at:
            new Date().toISOString(),
        })
        .eq(
          "id",
          activeBattle.id
        );

      if (error) {
        throw error;
      }

      await loadActiveBattle(
        currentUser.id
      );
    } catch (err) {
      setError(
        err?.message ||
          "Could not move to the next question."
      );
    } finally {
      setBattleTransitioning(false);
    }
  }

  async function finishBattle() {
    if (
      !isHost ||
      !activeBattle
    ) {
      return;
    }

    const {
      error,
    } = await supabase
      .from("study_battles")
      .update({
        status: "finished",
        finished_at:
          new Date().toISOString(),
      })
      .eq("id", activeBattle.id);

    if (error) {
      throw error;
    }

    await loadActiveBattle(
      currentUser.id
    );
  }

  async function closeBattle() {
    if (!isHost) {
      return;
    }

    try {
      const {
        error,
      } = await supabase
        .from("study_sessions")
        .update({
          activity: "whiteboard",
        })
        .eq("id", session.id);

      if (error) {
        throw error;
      }

      setActiveBattle(null);
      setBattleQuestions([]);
      setBattleScores([]);
      setMyBattleAnswers({});
      setRevealedCorrectIndex(
        null
      );

      await loadSession();
    } catch (err) {
      setError(
        err?.message ||
          "Could not return to the whiteboard."
      );
    }
  }

  function formatBattleTime(
    milliseconds
  ) {
    if (
      milliseconds === null ||
      milliseconds === undefined
    ) {
      return "—";
    }

    return `${(
      Number(milliseconds) /
      1000
    ).toFixed(1)}s`;
  }

  // =========================================================
  // SHARED PAST PAPER
  // =========================================================

  const [pastPapers, setPastPapers] =
    useState([]);

  const [showPaperPicker, setShowPaperPicker] =
    useState(false);

  const [paperPickerLoading, setPaperPickerLoading] =
    useState(false);

  const [sharedPaper, setSharedPaper] =
    useState(null);

  const [paperOpen, setPaperOpen] =
    useState(false);

  const [paperJoining, setPaperJoining] =
    useState(false);

  const [paperLaunching, setPaperLaunching] =
    useState(false);

  // =========================================================
  // REVISION BATTLES
  // =========================================================

  const [showBattleCreator, setShowBattleCreator] =
    useState(false);

  const [battleCreating, setBattleCreating] =
    useState(false);

  const [battleTransitioning, setBattleTransitioning] =
    useState(false);

  const [battleTitle, setBattleTitle] =
    useState("Revision Battle");

  const [battleSeconds, setBattleSeconds] =
    useState(20);

  const [battleDraftQuestions, setBattleDraftQuestions] =
    useState([
      {
        question_text: "",
        options: ["", "", "", ""],
        correct_index: 0,
        explanation: "",
      },
    ]);

  const [activeBattle, setActiveBattle] =
    useState(null);

  const [battleQuestions, setBattleQuestions] =
    useState([]);

  const [battleScores, setBattleScores] =
    useState([]);

  const [myBattleAnswers, setMyBattleAnswers] =
    useState({});

  const [revealedCorrectIndex, setRevealedCorrectIndex] =
    useState(null);

  const [battleTimeRemaining, setBattleTimeRemaining] =
    useState(0);

  // =========================================================
  // MULTIPLAYER FLASHCARDS
  // =========================================================

  const [showFlashcardPicker, setShowFlashcardPicker] =
    useState(false);

  const [flashcardPickerLoading, setFlashcardPickerLoading] =
    useState(false);

  const [flashcardStarting, setFlashcardStarting] =
    useState(false);

  const [flashcardTransitioning, setFlashcardTransitioning] =
    useState(false);

  const [flashcardDecks, setFlashcardDecks] =
    useState([]);

  const [flashcardCards, setFlashcardCards] =
    useState([]);

  const [activeFlashcardSession, setActiveFlashcardSession] =
    useState(null);

  const [flashcardDeckName, setFlashcardDeckName] =
    useState("");

  const [sharedFlashcard, setSharedFlashcard] =
    useState(null);

  const [flashcardResponses, setFlashcardResponses] =
    useState([]);

  const [myFlashcardRatings, setMyFlashcardRatings] =
    useState({});

  const [flashcardRatingLoading, setFlashcardRatingLoading] =
    useState(false);

  // =========================================================
  // SESSION RECAP
  // =========================================================

  const [showSessionRecap, setShowSessionRecap] =
    useState(false);

  const [sessionRecap, setSessionRecap] =
    useState(null);

  const [recapLoading, setRecapLoading] =
    useState(false);

  const [recapError, setRecapError] =
    useState("");

  const [penColour, setPenColour] =
    useState("#2563eb");

  const [penSize, setPenSize] =
    useState(3);

  const [tool, setTool] =
    useState("pen");

  const [presenceIds, setPresenceIds] =
    useState([]);

  const [timerRemaining, setTimerRemaining] =
    useState(
      initialSession?.timer_duration_seconds ||
        1500
    );

  const [error, setError] =
    useState("");

  const [loading, setLoading] =
    useState(true);

  const isHost =
    currentUser?.id &&
    (session?.host_id === currentUser.id ||
      session?.created_by === currentUser.id);


  useEffect(() => {
    flashcardSessionRef.current =
      activeFlashcardSession;
  }, [activeFlashcardSession]);

  useEffect(() => {
    flashcardCardsRef.current =
      flashcardCards;
  }, [flashcardCards]);

  useEffect(() => {
    flashcardDeckNameRef.current =
      flashcardDeckName;
  }, [flashcardDeckName]);

  useEffect(() => {
    let mounted = true;

    async function initialise() {
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

        if (!mounted) {
          return;
        }

        setCurrentUser(user);

        await Promise.all([
          loadSession(),
          loadMembers(),
          loadMessages(),
          loadStrokes(),
          loadFriends(user.id),
          loadInvites(),
          loadActiveBattle(user.id),
          loadActiveFlashcardSession(user.id),
        ]);
      } catch (err) {
        console.error("Could not initialise study room:", err);
        setError(
          err?.message ||
            "Could not load the study room."
        );
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    }

    initialise();

    return () => {
      mounted = false;
    };
  }, [initialSession?.id]);

  useEffect(() => {
    if (!currentUser?.id || !session?.id) {
      return;
    }

    const channel = supabase
      .channel(
        `study-room-${session.id}`,
        {
          config: {
            broadcast: {
              self: false,
            },
            presence: {
              key: currentUser.id,
            },
          },
        }
      )
      .on(
        "broadcast",
        { event: "whiteboard-live" },
        ({ payload }) => {
          drawRemotePoint(payload);
        }
      )
      .on(
        "broadcast",
        { event: "flashcard-state" },
        ({ payload }) => {
          if (!payload) {
            return;
          }

          setFlashcardDeckName(
            payload.deckName || ""
          );

          setSharedFlashcard(
            payload.card || null
          );
        }
      )
      .on(
        "broadcast",
        { event: "flashcard-state-request" },
        ({ payload }) => {
          if (
            payload?.userId ===
            currentUser.id
          ) {
            return;
          }

          sendCurrentFlashcardState();
        }
      )
      .on(
        "presence",
        { event: "sync" },
        () => {
          const state =
            channel.presenceState();

          setPresenceIds(
            Object.keys(state)
          );
        }
      )
      .on(
        "presence",
        { event: "join" },
        () => {
          const state =
            channel.presenceState();

          setPresenceIds(
            Object.keys(state)
          );
        }
      )
      .on(
        "presence",
        { event: "leave" },
        () => {
          const state =
            channel.presenceState();

          setPresenceIds(
            Object.keys(state)
          );
        }
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table:
            "study_session_messages",
          filter:
            `session_id=eq.${session.id}`,
        },
        () => loadMessages()
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table:
            "study_session_members",
          filter:
            `session_id=eq.${session.id}`,
        },
        () => loadMembers()
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table:
            "study_session_whiteboard_strokes",
          filter:
            `session_id=eq.${session.id}`,
        },
        () => loadStrokes()
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "study_sessions",
          filter: `id=eq.${session.id}`,
        },
        () => loadSession()
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table:
            "study_session_invites",
          filter:
            `session_id=eq.${session.id}`,
        },
        () => loadInvites()
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "study_battles",
          filter:
            `session_id=eq.${session.id}`,
        },
        () => loadActiveBattle(currentUser.id)
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "study_battle_scores",
        },
        () => {
          if (activeBattle?.id) {
            loadBattleScores(activeBattle.id);
          }
        }
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "study_battle_answers",
        },
        () => {
          if (activeBattle?.id) {
            loadBattleScores(activeBattle.id);
          }
        }
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table:
            "study_flashcard_sessions",
          filter:
            `session_id=eq.${session.id}`,
        },
        async () => {
          await loadActiveFlashcardSession(
            currentUser.id
          );

          setTimeout(() => {
            requestCurrentFlashcardState();
          }, 150);
        }
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table:
            "study_flashcard_responses",
        },
        () => {
          const flashSession =
            flashcardSessionRef.current;

          if (flashSession?.id) {
            loadFlashcardResponses(
              flashSession.id,
              currentUser.id
            );
          }
        }
      )
      .subscribe(async (status) => {
        if (status === "SUBSCRIBED") {
          await channel.track({
            userId: currentUser.id,
            joinedAt:
              new Date().toISOString(),
          });

          setTimeout(() => {
            requestCurrentFlashcardState();
          }, 250);
        }
      });

    liveChannelRef.current = channel;

    return () => {
      liveChannelRef.current = null;
      supabase.removeChannel(channel);
    };
  }, [currentUser?.id, session?.id]);

  useEffect(() => {
    const interval = setInterval(() => {
      setTimerRemaining(
        calculateRemaining(session)
      );
    }, 500);

    setTimerRemaining(
      calculateRemaining(session)
    );

    return () =>
      clearInterval(interval);
  }, [
    session?.timer_started_at,
    session?.timer_duration_seconds,
    session?.timer_is_running,
  ]);

  useEffect(() => {
    const interval = setInterval(() => {
      setBattleTimeRemaining(
        calculateBattleRemaining(
          activeBattle
        )
      );
    }, 250);

    setBattleTimeRemaining(
      calculateBattleRemaining(
        activeBattle
      )
    );

    return () =>
      clearInterval(interval);
  }, [
    activeBattle?.id,
    activeBattle?.status,
    activeBattle?.question_started_at,
    activeBattle?.seconds_per_question,
    activeBattle?.current_question,
  ]);

  useEffect(() => {
    if (
      !isHost ||
      !activeBattle ||
      activeBattle.status !== "question" ||
      battleTimeRemaining > 0 ||
      battleTransitioning
    ) {
      return;
    }

    revealBattleResults();
  }, [
    battleTimeRemaining,
    activeBattle?.id,
    activeBattle?.status,
    isHost,
    battleTransitioning,
  ]);

  useEffect(() => {
    redrawStrokes(strokes);
  }, [strokes]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({
      behavior: "smooth",
    });
  }, [messages]);

  useEffect(() => {
    if (
      !currentUser?.id ||
      !session?.id ||
      session?.is_active !== false ||
      showSessionRecap ||
      recapLoading
    ) {
      return;
    }

    prepareSessionRecap();
  }, [
    currentUser?.id,
    session?.id,
    session?.is_active,
    showSessionRecap,
    recapLoading,
  ]);

  useEffect(() => {
    if (
      session?.activity !== "past_paper" ||
      !session?.active_paper_id ||
      !session?.active_paper_room_id
    ) {
      setSharedPaper(null);
      setPaperOpen(false);
      return;
    }

    /*
     * The host may already have the selected paper object.
     * Other members do not need to fetch the paper until they
     * press "Join Shared Paper", because room membership is
     * established immediately before loading it.
     */
    if (
      sharedPaper?.id &&
      sharedPaper.id !== session.active_paper_id
    ) {
      setSharedPaper(null);
      setPaperOpen(false);
    }
  }, [
    session?.activity,
    session?.active_paper_id,
    session?.active_paper_room_id,
  ]);

  async function loadSession() {
    const {
      data,
      error,
    } = await supabase
      .from("study_sessions")
      .select("*")
      .eq("id", initialSession.id)
      .single();

    if (error) {
      throw error;
    }

    setSession(data);
  }

  async function loadMembers() {
    const {
      data,
      error,
    } = await supabase
      .from("study_session_members")
      .select(
        "id, session_id, user_id, joined_at, left_at"
      )
      .eq(
        "session_id",
        initialSession.id
      )
      .is("left_at", null)
      .order("joined_at", {
        ascending: true,
      });

    if (error) {
      throw error;
    }

    const activeMembers = data || [];
    setMembers(activeMembers);

    await loadProfiles(
      activeMembers.map(
        (member) => member.user_id
      )
    );
  }

  async function loadProfiles(userIds) {
    const ids = [
      ...new Set(
        (userIds || []).filter(Boolean)
      ),
    ];

    if (ids.length === 0) {
      return;
    }

    const {
      data,
      error,
    } = await supabase
      .from("profiles")
      .select(
        "id, full_name, school_email, year_group"
      )
      .in("id", ids);

    if (error) {
      console.warn(
        "Could not load profiles:",
        error
      );
      return;
    }

    const map = {};

    (data || []).forEach((profile) => {
      map[profile.id] = profile;
    });

    setProfiles((current) => ({
      ...current,
      ...map,
    }));
  }

  async function loadMessages() {
    const {
      data,
      error,
    } = await supabase
      .from("study_session_messages")
      .select(
        "id, session_id, sender_id, content, created_at"
      )
      .eq(
        "session_id",
        initialSession.id
      )
      .order("created_at", {
        ascending: true,
      })
      .limit(250);

    if (error) {
      throw error;
    }

    setMessages(data || []);

    await loadProfiles(
      (data || []).map(
        (item) => item.sender_id
      )
    );
  }

  async function loadStrokes() {
    const {
      data,
      error,
    } = await supabase
      .from(
        "study_session_whiteboard_strokes"
      )
      .select(
        "id, session_id, user_id, stroke, created_at"
      )
      .eq(
        "session_id",
        initialSession.id
      )
      .order("created_at", {
        ascending: true,
      });

    if (error) {
      throw error;
    }

    setStrokes(data || []);
  }

  async function loadFriends(userId) {
    try {
      const {
        data: requests,
        error: requestError,
      } = await supabase
        .from("friend_requests")
        .select(
          "sender_id, receiver_id, status"
        )
        .or(
          `sender_id.eq.${userId},receiver_id.eq.${userId}`
        )
        .eq("status", "accepted");

      if (requestError) {
        throw requestError;
      }

      const friendIds = [];

      (requests || []).forEach((request) => {
        friendIds.push(
          request.sender_id === userId
            ? request.receiver_id
            : request.sender_id
        );
      });

      if (friendIds.length === 0) {
        setFriends([]);
        return;
      }

      const {
        data: friendProfiles,
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

      setFriends(friendProfiles || []);
    } catch (err) {
      console.error(
        "Could not load friends:",
        err
      );
    }
  }

  async function loadInvites() {
    try {
      const {
        data,
        error,
      } = await supabase
        .from("study_session_invites")
        .select(
          "id, session_id, sender_id, receiver_id, status, created_at"
        )
        .eq(
          "session_id",
          initialSession.id
        );

      if (error) {
        throw error;
      }

      setInvites(data || []);
    } catch (err) {
      console.warn(
        "Could not load room invites:",
        err
      );
    }
  }

  async function sendMessage(event) {
    event.preventDefault();

    if (
      !currentUser ||
      !message.trim()
    ) {
      return;
    }

    try {
      const content =
        message.trim();

      setMessage("");

      const {
        error,
      } = await supabase
        .from("study_session_messages")
        .insert({
          session_id: session.id,
          sender_id: currentUser.id,
          content,
        });

      if (error) {
        throw error;
      }
    } catch (err) {
      console.error(
        "Could not send message:",
        err
      );

      setError(
        err?.message ||
          "Could not send your message."
      );
    }
  }

  async function inviteFriend(friendId) {
    try {
      setInviteLoading(friendId);
      setError("");

      const {
        error,
      } = await supabase.rpc(
        "send_study_session_invite",
        {
          p_session_id: session.id,
          p_receiver_id: friendId,
        }
      );

      if (error) {
        throw error;
      }

      await loadInvites();
    } catch (err) {
      console.error(
        "Could not invite friend:",
        err
      );

      setError(
        err?.message ||
          "Could not send the invitation."
      );
    } finally {
      setInviteLoading(null);
    }
  }

  // =========================================================
  // SHARED PAST PAPER
  // =========================================================

  async function loadPastPapers() {
    if (!currentUser) {
      return;
    }

    try {
      setPaperPickerLoading(true);
      setError("");

      const {
        data,
        error,
      } = await supabase
        .from("past_papers")
        .select(
          "id, name, file_path, created_at, user_id"
        )
        .eq("user_id", currentUser.id)
        .order("created_at", {
          ascending: false,
        });

      if (error) {
        throw error;
      }

      setPastPapers(data || []);
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
      setPaperPickerLoading(false);
    }
  }

  async function openPaperPicker() {
    if (!isHost) {
      return;
    }

    setShowPaperPicker(true);
    await loadPastPapers();
  }

  function generatePaperRoomCode() {
    return Math.random()
      .toString(36)
      .substring(2, 8)
      .toUpperCase();
  }

  async function getOrCreatePaperRoom(
    paper
  ) {
    const {
      data: existingRoom,
      error: existingError,
    } = await supabase
      .from("past_paper_rooms")
      .select(
        "id, room_code, paper_id, created_by"
      )
      .eq("paper_id", paper.id)
      .maybeSingle();

    if (existingError) {
      throw existingError;
    }

    if (existingRoom) {
      return existingRoom;
    }

    for (
      let attempt = 0;
      attempt < 5;
      attempt += 1
    ) {
      const {
        data: createdRoom,
        error: createError,
      } = await supabase
        .from("past_paper_rooms")
        .insert({
          paper_id: paper.id,
          room_code:
            generatePaperRoomCode(),
          created_by:
            currentUser.id,
        })
        .select(
          "id, room_code, paper_id, created_by"
        )
        .single();

      if (!createError) {
        return createdRoom;
      }

      if (
        createError.code !== "23505"
      ) {
        throw createError;
      }
    }

    throw new Error(
      "Could not create a collaboration room for this paper."
    );
  }

  async function ensurePaperRoomMembership(
    roomId
  ) {
    if (!currentUser || !roomId) {
      return;
    }

    const {
      data: existingMember,
      error: existingError,
    } = await supabase
      .from(
        "past_paper_room_members"
      )
      .select("room_id, user_id")
      .eq("room_id", roomId)
      .eq(
        "user_id",
        currentUser.id
      )
      .maybeSingle();

    if (existingError) {
      throw existingError;
    }

    if (existingMember) {
      return;
    }

    const {
      error: memberError,
    } = await supabase
      .from(
        "past_paper_room_members"
      )
      .insert({
        room_id: roomId,
        user_id: currentUser.id,
      });

    if (
      memberError &&
      memberError.code !== "23505"
    ) {
      throw memberError;
    }
  }

  async function launchSharedPaper(
    paper
  ) {
    if (
      !isHost ||
      !currentUser ||
      !paper?.id
    ) {
      return;
    }

    try {
      setPaperLaunching(true);
      setError("");

      const paperRoom =
        await getOrCreatePaperRoom(
          paper
        );

      await ensurePaperRoomMembership(
        paperRoom.id
      );

      const {
        error: updateError,
      } = await supabase
        .from("study_sessions")
        .update({
          activity: "past_paper",
          active_paper_id:
            paper.id,
          active_paper_room_id:
            paperRoom.id,
        })
        .eq("id", session.id);

      if (updateError) {
        throw updateError;
      }

      setSharedPaper(paper);
      setShowPaperPicker(false);

      sessionStorage.setItem(
        `studySessionUsedPastPaper:${session.id}`,
        "true"
      );

      /*
       * PaperWorkspace already knows how to auto-join a room
       * from these two sessionStorage values.
       */
      sessionStorage.setItem(
        "pastPaperRoomId",
        paperRoom.id
      );

      sessionStorage.setItem(
        "pastPaperAutoJoin",
        "true"
      );

      setPaperOpen(true);

      await loadSession();
    } catch (err) {
      console.error(
        "Could not launch shared paper:",
        err
      );

      setError(
        err?.message ||
          "Could not start the shared past paper."
      );
    } finally {
      setPaperLaunching(false);
    }
  }

  async function joinSharedPaper() {
    if (
      !currentUser ||
      !session?.active_paper_id ||
      !session?.active_paper_room_id
    ) {
      return;
    }

    try {
      setPaperJoining(true);
      setError("");

      /*
       * Each participant joins the past-paper room as themselves.
       * This keeps the existing past-paper RLS and collaboration
       * behaviour intact.
       */
      await ensurePaperRoomMembership(
        session.active_paper_room_id
      );

      const {
        data: paper,
        error: paperError,
      } = await supabase
        .from("past_papers")
        .select(
          "id, name, file_path, created_at, user_id"
        )
        .eq(
          "id",
          session.active_paper_id
        )
        .single();

      if (paperError) {
        throw paperError;
      }

      sessionStorage.setItem(
        "pastPaperRoomId",
        session.active_paper_room_id
      );

      sessionStorage.setItem(
        "pastPaperAutoJoin",
        "true"
      );

      setSharedPaper(paper);

      sessionStorage.setItem(
        `studySessionUsedPastPaper:${session.id}`,
        "true"
      );

      setPaperOpen(true);
    } catch (err) {
      console.error(
        "Could not join shared paper:",
        err
      );

      setError(
        err?.message ||
          "Could not join the shared past paper."
      );
    } finally {
      setPaperJoining(false);
    }
  }

  async function stopSharedPaper() {
    if (!isHost) {
      return;
    }

    try {
      setError("");

      const {
        error,
      } = await supabase
        .from("study_sessions")
        .update({
          activity: "whiteboard",
          active_paper_id: null,
          active_paper_room_id: null,
        })
        .eq("id", session.id);

      if (error) {
        throw error;
      }

      setPaperOpen(false);
      setSharedPaper(null);

      sessionStorage.removeItem(
        "pastPaperRoomId"
      );

      sessionStorage.removeItem(
        "pastPaperAutoJoin"
      );

      await loadSession();
    } catch (err) {
      setError(
        err?.message ||
          "Could not close the shared paper."
      );
    }
  }

  function returnFromPaper() {
    setPaperOpen(false);

    sessionStorage.removeItem(
      "pastPaperAutoJoin"
    );

    /*
     * Keep the room ID while the shared paper is still active,
     * so reopening it remains seamless.
     */
  }

  function calculateRemaining(
    currentSession
  ) {
    if (!currentSession) {
      return 0;
    }

    const duration = Math.max(
      0,
      Number(
        currentSession.timer_duration_seconds ||
          0
      )
    );

    if (
      !currentSession.timer_is_running ||
      !currentSession.timer_started_at
    ) {
      return duration;
    }

    const startedAt = new Date(
      currentSession.timer_started_at
    ).getTime();

    const elapsed =
      Math.max(
        0,
        Date.now() - startedAt
      ) / 1000;

    return Math.max(
      0,
      Math.ceil(duration - elapsed)
    );
  }

  async function startTimer() {
    if (!isHost) {
      return;
    }

    try {
      const {
        error,
      } = await supabase
        .from("study_sessions")
        .update({
          timer_started_at:
            new Date().toISOString(),
          timer_is_running: true,
        })
        .eq("id", session.id);

      if (error) {
        throw error;
      }
    } catch (err) {
      setError(
        err?.message ||
          "Could not start the timer."
      );
    }
  }

  async function pauseTimer() {
    if (!isHost) {
      return;
    }

    try {
      const remaining =
        calculateRemaining(session);

      const {
        error,
      } = await supabase
        .from("study_sessions")
        .update({
          timer_duration_seconds:
            remaining,
          timer_started_at: null,
          timer_is_running: false,
        })
        .eq("id", session.id);

      if (error) {
        throw error;
      }
    } catch (err) {
      setError(
        err?.message ||
          "Could not pause the timer."
      );
    }
  }

  async function resetTimer(minutes = 25) {
    if (!isHost) {
      return;
    }

    try {
      const {
        error,
      } = await supabase
        .from("study_sessions")
        .update({
          timer_duration_seconds:
            Number(minutes) * 60,
          timer_started_at: null,
          timer_is_running: false,
        })
        .eq("id", session.id);

      if (error) {
        throw error;
      }
    } catch (err) {
      setError(
        err?.message ||
          "Could not reset the timer."
      );
    }
  }

  function formatTimer(seconds) {
    const safe = Math.max(
      0,
      Math.floor(seconds)
    );

    const mins = Math.floor(
      safe / 60
    );

    const secs = safe % 60;

    return `${String(mins).padStart(
      2,
      "0"
    )}:${String(secs).padStart(
      2,
      "0"
    )}`;
  }

  function getCanvasPoint(event) {
    const canvas = canvasRef.current;

    if (!canvas) {
      return null;
    }

    const rect =
      canvas.getBoundingClientRect();

    return {
      x:
        (event.clientX - rect.left) /
        rect.width,
      y:
        (event.clientY - rect.top) /
        rect.height,
    };
  }

  function setupContext(context, stroke) {
    context.lineCap = "round";
    context.lineJoin = "round";

    if (stroke.tool === "eraser") {
      context.globalCompositeOperation =
        "destination-out";

      context.globalAlpha = 1;
      context.lineWidth =
        Number(stroke.size || 3) * 6;
    } else {
      context.globalCompositeOperation =
        "source-over";

      context.globalAlpha =
        stroke.tool === "highlighter"
          ? 0.25
          : 1;

      context.strokeStyle =
        stroke.colour || "#2563eb";

      context.lineWidth =
        stroke.tool === "highlighter"
          ? Number(stroke.size || 3) * 5
          : Number(stroke.size || 3);
    }
  }

  function drawStroke(context, stroke) {
    const canvas = canvasRef.current;

    if (
      !canvas ||
      !stroke?.points?.length
    ) {
      return;
    }

    setupContext(context, stroke);

    const first =
      stroke.points[0];

    context.beginPath();
    context.moveTo(
      first.x * canvas.width,
      first.y * canvas.height
    );

    for (
      let index = 1;
      index < stroke.points.length;
      index += 1
    ) {
      const point =
        stroke.points[index];

      context.lineTo(
        point.x * canvas.width,
        point.y * canvas.height
      );
    }

    context.stroke();
    context.beginPath();
    context.globalAlpha = 1;
    context.globalCompositeOperation =
      "source-over";
  }

  function redrawStrokes(strokeRows) {
    const canvas = canvasRef.current;

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

    (strokeRows || []).forEach(
      (row) =>
        drawStroke(
          context,
          row.stroke
        )
    );
  }

  function startDrawing(event) {
    const point =
      getCanvasPoint(event);

    if (!point) {
      return;
    }

    drawingRef.current = true;

    currentStrokeRef.current = {
      tool,
      colour: penColour,
      size: Number(penSize),
      points: [point],
    };

    try {
      canvasRef.current?.setPointerCapture(
        event.pointerId
      );
    } catch {}

    broadcastLivePoint({
      phase: "start",
      point,
      tool,
      colour: penColour,
      size: Number(penSize),
    });
  }

  function draw(event) {
    if (!drawingRef.current) {
      return;
    }

    const point =
      getCanvasPoint(event);

    if (!point) {
      return;
    }

    currentStrokeRef.current?.points.push(
      point
    );

    const canvas = canvasRef.current;
    const context =
      canvas?.getContext("2d");

    if (
      canvas &&
      context &&
      currentStrokeRef.current
    ) {
      redrawStrokes(strokes);

      drawStroke(
        context,
        currentStrokeRef.current
      );
    }

    broadcastLivePoint({
      phase: "move",
      point,
      tool,
      colour: penColour,
      size: Number(penSize),
    });
  }

  async function stopDrawing() {
    if (!drawingRef.current) {
      return;
    }

    drawingRef.current = false;

    const stroke =
      currentStrokeRef.current;

    currentStrokeRef.current = null;

    broadcastLivePoint({
      phase: "end",
    });

    if (
      !stroke?.points?.length ||
      !currentUser
    ) {
      return;
    }

    try {
      const {
        error,
      } = await supabase
        .from(
          "study_session_whiteboard_strokes"
        )
        .insert({
          session_id: session.id,
          user_id: currentUser.id,
          stroke,
        });

      if (error) {
        throw error;
      }
    } catch (err) {
      console.error(
        "Could not save whiteboard stroke:",
        err
      );

      setError(
        err?.message ||
          "Could not save your whiteboard writing."
      );
    }
  }

  async function broadcastLivePoint(
    payload
  ) {
    const channel =
      liveChannelRef.current;

    if (!channel) {
      return;
    }

    await channel.send({
      type: "broadcast",
      event: "whiteboard-live",
      payload: {
        ...payload,
        userId:
          currentUser?.id,
      },
    });
  }

  function drawRemotePoint(payload) {
    if (
      !payload ||
      payload.userId ===
        currentUser?.id
    ) {
      return;
    }

    const canvas = canvasRef.current;

    if (!canvas) {
      return;
    }

    const context =
      canvas.getContext("2d");

    if (!payload.point) {
      return;
    }

    setupContext(context, {
      tool: payload.tool,
      colour: payload.colour,
      size: payload.size,
    });

    const x =
      payload.point.x *
      canvas.width;

    const y =
      payload.point.y *
      canvas.height;

    if (
      payload.phase === "start"
    ) {
      context.beginPath();
      context.moveTo(x, y);
    }

    if (
      payload.phase === "move"
    ) {
      context.lineTo(x, y);
      context.stroke();
      context.beginPath();
      context.moveTo(x, y);
    }

    if (
      payload.phase === "end"
    ) {
      context.beginPath();
      context.globalAlpha = 1;
      context.globalCompositeOperation =
        "source-over";
    }
  }

  async function undoMyLastStroke() {
    if (!currentUser) {
      return;
    }

    const mine = strokes.filter(
      (row) =>
        row.user_id === currentUser.id
    );

    const last =
      mine[mine.length - 1];

    if (!last) {
      return;
    }

    const {
      error,
    } = await supabase
      .from(
        "study_session_whiteboard_strokes"
      )
      .delete()
      .eq("id", last.id);

    if (error) {
      setError(
        "Could not undo that stroke."
      );
    }
  }

  async function clearWhiteboard() {
    const allowed =
      isHost
        ? window.confirm(
            "Clear the entire whiteboard for everyone?"
          )
        : window.confirm(
            "Clear your own whiteboard writing?"
          );

    if (!allowed) {
      return;
    }

    let query = supabase
      .from(
        "study_session_whiteboard_strokes"
      )
      .delete()
      .eq("session_id", session.id);

    if (!isHost) {
      query = query.eq(
        "user_id",
        currentUser.id
      );
    }

    const {
      error,
    } = await query;

    if (error) {
      setError(
        "Could not clear the whiteboard."
      );
    }
  }

  // =========================================================
  // SESSION RECAP
  // =========================================================

  function calculateRecapMastery(
    gotIt,
    nearly,
    didntKnow
  ) {
    const total =
      gotIt + nearly + didntKnow;

    if (total <= 0) {
      return 0;
    }

    return Math.round(
      ((gotIt + nearly * 0.5) /
        total) *
        100
    );
  }

  async function buildSessionRecap() {
    if (
      !currentUser?.id ||
      !session?.id
    ) {
      throw new Error(
        "Could not identify this study session."
      );
    }

    const userId =
      currentUser.id;

    // -------------------------------------------------------
    // MEMBERSHIP / TIME STUDIED
    // -------------------------------------------------------

    const {
      data: myMembership,
      error: membershipError,
    } = await supabase
      .from("study_session_members")
      .select(
        "id, session_id, user_id, joined_at, left_at"
      )
      .eq("session_id", session.id)
      .eq("user_id", userId)
      .order("joined_at", {
        ascending: false,
      })
      .limit(1)
      .maybeSingle();

    if (membershipError) {
      throw membershipError;
    }

    const joinedAt =
      myMembership?.joined_at ||
      session.started_at ||
      session.created_at ||
      new Date().toISOString();

    const endedAt =
      myMembership?.left_at ||
      session.ended_at ||
      new Date().toISOString();

    const minutesStudied =
      Math.max(
        1,
        Math.round(
          Math.max(
            0,
            new Date(endedAt).getTime() -
              new Date(joinedAt).getTime()
          ) /
            60000
        )
      );

    // -------------------------------------------------------
    // PEOPLE STUDIED WITH
    // -------------------------------------------------------

    const {
      data: allMemberships,
      error: allMembersError,
    } = await supabase
      .from("study_session_members")
      .select("user_id")
      .eq("session_id", session.id);

    if (allMembersError) {
      throw allMembersError;
    }

    const peopleStudiedWith =
      new Set(
        (allMemberships || [])
          .map((member) => member.user_id)
          .filter(
            (memberId) =>
              memberId &&
              memberId !== userId
          )
      ).size;

    // -------------------------------------------------------
    // BATTLE PERFORMANCE
    // -------------------------------------------------------

    const {
      data: battles,
      error: battlesError,
    } = await supabase
      .from("study_battles")
      .select("id")
      .eq("session_id", session.id);

    if (battlesError) {
      throw battlesError;
    }

    const battleIds =
      (battles || []).map(
        (battle) => battle.id
      );

    let battleAnswers = [];

    if (battleIds.length > 0) {
      const {
        data,
        error,
      } = await supabase
        .from("study_battle_answers")
        .select(
          "id, battle_id, user_id, is_correct"
        )
        .in("battle_id", battleIds)
        .eq("user_id", userId);

      if (error) {
        throw error;
      }

      battleAnswers =
        data || [];
    }

    const battleQuestions =
      battleAnswers.length;

    const battleCorrect =
      battleAnswers.filter(
        (answer) =>
          answer.is_correct === true
      ).length;

    // -------------------------------------------------------
    // FLASHCARD PERFORMANCE
    // -------------------------------------------------------

    const {
      data: flashSessions,
      error: flashSessionsError,
    } = await supabase
      .from(
        "study_flashcard_sessions"
      )
      .select("id")
      .eq("session_id", session.id);

    if (flashSessionsError) {
      throw flashSessionsError;
    }

    const flashSessionIds =
      (flashSessions || []).map(
        (flashSession) =>
          flashSession.id
      );

    let flashResponses = [];

    if (flashSessionIds.length > 0) {
      const {
        data,
        error,
      } = await supabase
        .from(
          "study_flashcard_responses"
        )
        .select(
          "id, flashcard_session_id, user_id, rating"
        )
        .in(
          "flashcard_session_id",
          flashSessionIds
        )
        .eq("user_id", userId);

      if (error) {
        throw error;
      }

      flashResponses =
        data || [];
    }

    const flashcardsGotIt =
      flashResponses.filter(
        (response) =>
          response.rating ===
          "got_it"
      ).length;

    const flashcardsNearly =
      flashResponses.filter(
        (response) =>
          response.rating ===
          "nearly"
      ).length;

    const flashcardsDidntKnow =
      flashResponses.filter(
        (response) =>
          response.rating ===
          "didnt_know"
      ).length;

    const flashcardsRated =
      flashResponses.length;

    const flashcardMastery =
      calculateRecapMastery(
        flashcardsGotIt,
        flashcardsNearly,
        flashcardsDidntKnow
      );

    // -------------------------------------------------------
    // WHITEBOARD USAGE
    // -------------------------------------------------------

    const {
      count: whiteboardCount,
      error: whiteboardError,
    } = await supabase
      .from(
        "study_session_whiteboard_strokes"
      )
      .select("*", {
        count: "exact",
        head: true,
      })
      .eq("session_id", session.id)
      .eq("user_id", userId);

    if (whiteboardError) {
      throw whiteboardError;
    }

    // -------------------------------------------------------
    // PAST PAPER USAGE
    // -------------------------------------------------------

    const usedPastPaper =
      sessionStorage.getItem(
        `studySessionUsedPastPaper:${session.id}`
      ) === "true" ||
      session.activity === "past_paper" ||
      Boolean(
        session.active_paper_id
      );

    const recap = {
      session_id: session.id,
      user_id: userId,

      subject:
        session.subject || null,

      topic:
        session.topic || null,

      started_at:
        joinedAt,

      ended_at:
        endedAt,

      minutes_studied:
        minutesStudied,

      people_studied_with:
        peopleStudiedWith,

      battle_questions:
        battleQuestions,

      battle_correct:
        battleCorrect,

      flashcards_rated:
        flashcardsRated,

      flashcards_got_it:
        flashcardsGotIt,

      flashcards_nearly:
        flashcardsNearly,

      flashcards_didnt_know:
        flashcardsDidntKnow,

      flashcard_mastery:
        flashcardMastery,

      used_past_paper:
        usedPastPaper,

      used_whiteboard:
        Number(
          whiteboardCount || 0
        ) > 0,

      used_battle:
        battleQuestions > 0,

      used_flashcards:
        flashcardsRated > 0,
    };

    return recap;
  }

  async function saveSessionRecap(
    recap
  ) {
    const {
      data,
      error,
    } = await supabase
      .from("study_session_recaps")
      .upsert(recap, {
        onConflict:
          "session_id,user_id",
      })
      .select("*")
      .single();

    if (error) {
      throw error;
    }

    return data;
  }

  async function prepareSessionRecap() {
    if (
      recapLoading ||
      showSessionRecap ||
      !currentUser?.id ||
      !session?.id
    ) {
      return;
    }

    try {
      setRecapLoading(true);
      setRecapError("");

      const recap =
        await buildSessionRecap();

      const savedRecap =
        await saveSessionRecap(
          recap
        );

      setSessionRecap(
        savedRecap || recap
      );

      setShowSessionRecap(true);
    } catch (err) {
      console.error(
        "Could not create session recap:",
        err
      );

      setRecapError(
        err?.message ||
          "Could not create your session recap."
      );

      /*
       * Still show a fallback recap rather than
       * throwing the user straight out of the room.
       */
      setSessionRecap({
        session_id:
          session.id,
        user_id:
          currentUser.id,
        subject:
          session.subject || null,
        topic:
          session.topic || null,
        minutes_studied: 0,
        people_studied_with:
          Math.max(
            0,
            members.length - 1
          ),
        battle_questions: 0,
        battle_correct: 0,
        flashcards_rated: 0,
        flashcards_got_it: 0,
        flashcards_nearly: 0,
        flashcards_didnt_know:
          0,
        flashcard_mastery: 0,
        used_past_paper:
          sessionStorage.getItem(
            `studySessionUsedPastPaper:${session.id}`
          ) === "true",
        used_whiteboard:
          false,
        used_battle:
          false,
        used_flashcards:
          false,
      });

      setShowSessionRecap(true);
    } finally {
      setRecapLoading(false);
    }
  }

  function leaveRecapScreen() {
    sessionStorage.removeItem(
      `studySessionUsedPastPaper:${session.id}`
    );

    setShowSessionRecap(false);
    onExit();
  }

  async function leaveRoom() {
    if (!currentUser) {
      return;
    }

    try {
      const {
        error,
      } = await supabase
        .from("study_session_members")
        .update({
          left_at:
            new Date().toISOString(),
        })
        .eq("session_id", session.id)
        .eq("user_id", currentUser.id)
        .is("left_at", null);

      if (error) {
        throw error;
      }

      await loadSession();
      await prepareSessionRecap();
    } catch (err) {
      setError(
        err?.message ||
          "Could not leave the room."
      );
    }
  }

  async function endRoom() {
    if (!isHost) {
      return;
    }

    const confirmed =
      window.confirm(
        "End this study room for everyone?"
      );

    if (!confirmed) {
      return;
    }

    try {
      const now =
        new Date().toISOString();

      const {
        error,
      } = await supabase
        .from("study_sessions")
        .update({
          is_active: false,
          ended_at: now,
          timer_is_running: false,
        })
        .eq("id", session.id);

      if (error) {
        throw error;
      }

      await supabase
        .from("study_session_members")
        .update({
          left_at: now,
        })
        .eq("session_id", session.id)
        .is("left_at", null);

      setSession((current) => ({
        ...current,
        is_active: false,
        ended_at: now,
        timer_is_running:
          false,
      }));

      await prepareSessionRecap();
    } catch (err) {
      setError(
        err?.message ||
          "Could not end the room."
      );
    }
  }

  const onlineMembers = useMemo(() => {
    return new Set(presenceIds);
  }, [presenceIds]);

  const invitedIds = useMemo(() => {
    return new Set(
      invites
        .filter((invite) =>
          ["pending", "accepted"].includes(
            invite.status
          )
        )
        .map(
          (invite) =>
            invite.receiver_id
        )
    );
  }, [invites]);

  if (
    showSessionRecap &&
    sessionRecap
  ) {
    const battlePercentage =
      sessionRecap.battle_questions > 0
        ? Math.round(
            (sessionRecap.battle_correct /
              sessionRecap.battle_questions) *
              100
          )
        : 0;

    return (
      <div
        style={{
          minHeight: "100vh",
          background:
            "linear-gradient(150deg,#eef2ff,#f8fafc 45%,#ecfeff)",
          padding: "28px 18px",
        }}
      >
        <div
          style={{
            width: "100%",
            maxWidth: "820px",
            margin: "0 auto",
          }}
        >
          <div
            style={{
              background: "white",
              borderRadius: "28px",
              overflow: "hidden",
              boxShadow:
                "0 24px 80px rgba(15,23,42,.12)",
              border:
                "1px solid rgba(148,163,184,.25)",
            }}
          >
            <div
              style={{
                padding:
                  "38px 28px 32px",
                textAlign: "center",
                background:
                  "linear-gradient(135deg,#312e81,#2563eb,#0891b2)",
                color: "white",
              }}
            >
              <div
                style={{
                  fontSize: "58px",
                }}
              >
                🎉
              </div>

              <div
                style={{
                  marginTop: "5px",
                  fontSize: "12px",
                  letterSpacing:
                    ".16em",
                  fontWeight: 900,
                  color:
                    "#dbeafe",
                }}
              >
                SESSION COMPLETE
              </div>

              <div
                style={{
                  marginTop: "10px",
                  fontSize:
                    "48px",
                  lineHeight: 1,
                  fontWeight: 950,
                  fontVariantNumeric:
                    "tabular-nums",
                }}
              >
                {
                  sessionRecap.minutes_studied
                }
              </div>

              <div
                style={{
                  fontWeight: 800,
                  marginTop: "5px",
                }}
              >
                minutes studied
              </div>

              <div
                style={{
                  marginTop: "14px",
                  color: "#dbeafe",
                }}
              >
                {sessionRecap.subject ||
                  session.subject ||
                  "Study Together"}
                {(sessionRecap.topic ||
                  session.topic)
                  ? ` • ${
                      sessionRecap.topic ||
                      session.topic
                    }`
                  : ""}
              </div>
            </div>

            <div
              style={{
                padding: "26px",
                display: "grid",
                gap: "15px",
              }}
            >
              {sessionRecap.used_battle && (
                <div
                  style={{
                    padding:
                      "18px 19px",
                    borderRadius:
                      "18px",
                    background:
                      "#faf5ff",
                    border:
                      "1px solid #e9d5ff",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      justifyContent:
                        "space-between",
                      gap: "14px",
                      alignItems:
                        "center",
                    }}
                  >
                    <div>
                      <strong
                        style={{
                          fontSize:
                            "17px",
                        }}
                      >
                        ⚔️ Revision Battle
                      </strong>

                      <div
                        style={{
                          marginTop:
                            "5px",
                          color:
                            "#64748b",
                        }}
                      >
                        {
                          sessionRecap.battle_correct
                        }{" "}
                        /{" "}
                        {
                          sessionRecap.battle_questions
                        }{" "}
                        correct
                      </div>
                    </div>

                    <strong
                      style={{
                        fontSize:
                          "24px",
                        color:
                          "#7c3aed",
                      }}
                    >
                      {
                        battlePercentage
                      }
                      %
                    </strong>
                  </div>

                  <div
                    style={{
                      height: "9px",
                      marginTop: "13px",
                      borderRadius:
                        "999px",
                      background:
                        "#ede9fe",
                      overflow:
                        "hidden",
                    }}
                  >
                    <div
                      style={{
                        width: `${battlePercentage}%`,
                        height: "100%",
                        background:
                          "linear-gradient(90deg,#7c3aed,#a855f7)",
                      }}
                    />
                  </div>
                </div>
              )}

              {sessionRecap.used_flashcards && (
                <div
                  style={{
                    padding:
                      "18px 19px",
                    borderRadius:
                      "18px",
                    background:
                      "#f0fdfa",
                    border:
                      "1px solid #99f6e4",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      justifyContent:
                        "space-between",
                      gap: "14px",
                      alignItems:
                        "center",
                    }}
                  >
                    <div>
                      <strong
                        style={{
                          fontSize:
                            "17px",
                        }}
                      >
                        🃏 Multiplayer Flashcards
                      </strong>

                      <div
                        style={{
                          marginTop:
                            "5px",
                          color:
                            "#475569",
                        }}
                      >
                        🟢{" "}
                        {
                          sessionRecap.flashcards_got_it
                        }{" "}
                        Got It{" "}
                        • 🟡{" "}
                        {
                          sessionRecap.flashcards_nearly
                        }{" "}
                        Nearly{" "}
                        • 🔴{" "}
                        {
                          sessionRecap.flashcards_didnt_know
                        }{" "}
                        Learning
                      </div>
                    </div>

                    <strong
                      style={{
                        fontSize:
                          "24px",
                        color:
                          "#0f766e",
                      }}
                    >
                      {
                        sessionRecap.flashcard_mastery
                      }
                      %
                    </strong>
                  </div>

                  <div
                    style={{
                      height: "9px",
                      marginTop: "13px",
                      borderRadius:
                        "999px",
                      background:
                        "#ccfbf1",
                      overflow:
                        "hidden",
                    }}
                  >
                    <div
                      style={{
                        width: `${
                          sessionRecap.flashcard_mastery
                        }%`,
                        height: "100%",
                        background:
                          "linear-gradient(90deg,#0f766e,#14b8a6)",
                      }}
                    />
                  </div>
                </div>
              )}

              <div
                style={{
                  display: "grid",
                  gridTemplateColumns:
                    "repeat(auto-fit,minmax(190px,1fr))",
                  gap: "12px",
                }}
              >
                <div
                  style={{
                    padding:
                      "16px",
                    borderRadius:
                      "16px",
                    background:
                      sessionRecap.used_past_paper
                        ? "#eff6ff"
                        : "#f8fafc",
                    border:
                      "1px solid #e2e8f0",
                  }}
                >
                  <div
                    style={{
                      fontSize:
                        "25px",
                    }}
                  >
                    📄
                  </div>

                  <strong>
                    {sessionRecap.used_past_paper
                      ? "Shared past paper used"
                      : "No past paper this time"}
                  </strong>
                </div>

                <div
                  style={{
                    padding:
                      "16px",
                    borderRadius:
                      "16px",
                    background:
                      sessionRecap.used_whiteboard
                        ? "#fff7ed"
                        : "#f8fafc",
                    border:
                      "1px solid #e2e8f0",
                  }}
                >
                  <div
                    style={{
                      fontSize:
                        "25px",
                    }}
                  >
                    ✏️
                  </div>

                  <strong>
                    {sessionRecap.used_whiteboard
                      ? "Whiteboard used"
                      : "No whiteboard writing"}
                  </strong>
                </div>

                <div
                  style={{
                    padding:
                      "16px",
                    borderRadius:
                      "16px",
                    background:
                      "#f0fdf4",
                    border:
                      "1px solid #bbf7d0",
                  }}
                >
                  <div
                    style={{
                      fontSize:
                        "25px",
                    }}
                  >
                    👥
                  </div>

                  <strong>
                    {
                      sessionRecap.people_studied_with
                    }{" "}
                    {sessionRecap.people_studied_with ===
                    1
                      ? "friend"
                      : "friends"}{" "}
                    studied with
                  </strong>
                </div>
              </div>

              {recapError && (
                <div
                  style={{
                    padding:
                      "12px",
                    borderRadius:
                      "12px",
                    background:
                      "#fff7ed",
                    color:
                      "#9a3412",
                    fontSize:
                      "13px",
                  }}
                >
                  ⚠️ {recapError}
                </div>
              )}

              <div
                style={{
                  textAlign: "center",
                  padding:
                    "12px 0 2px",
                }}
              >
                <div
                  style={{
                    fontWeight:
                      900,
                    fontSize:
                      "18px",
                  }}
                >
                  🔥 Nice session!
                </div>

                <div
                  style={{
                    color:
                      "#64748b",
                    marginTop:
                      "5px",
                  }}
                >
                  This recap has been saved to
                  your study history.
                </div>

                <button
                  type="button"
                  className="primary-card-button"
                  onClick={
                    leaveRecapScreen
                  }
                  style={{
                    marginTop:
                      "18px",
                    minWidth:
                      "220px",
                  }}
                >
                  Back to Study Hub →
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (
    paperOpen &&
    sharedPaper
  ) {
    return (
      <div
        style={{
          minHeight: "100vh",
          background: "#eef1f5",
        }}
      >
        <div
          style={{
            position: "sticky",
            top: 0,
            zIndex: 200,
            padding: "10px 14px",
            background: "#111827",
            color: "white",
            display: "flex",
            justifyContent:
              "space-between",
            alignItems: "center",
            gap: "12px",
            flexWrap: "wrap",
          }}
        >
          <div>
            <strong>
              🔴 Study Together • Shared Past Paper
            </strong>

            <div
              style={{
                fontSize: "12px",
                opacity: 0.8,
                marginTop: "2px",
              }}
            >
              {session?.name}
            </div>
          </div>

          <div
            style={{
              display: "flex",
              gap: "8px",
            }}
          >
            <button
              type="button"
              onClick={returnFromPaper}
            >
              ← Return to Study Room
            </button>

            {isHost && (
              <button
                type="button"
                onClick={stopSharedPaper}
                style={{
                  background: "#dc2626",
                  color: "white",
                  border: "none",
                  borderRadius: "8px",
                  padding: "8px 11px",
                }}
              >
                End Shared Paper
              </button>
            )}
          </div>
        </div>

        <PaperWorkspace
          paper={sharedPaper}
          setPage={(newPage) => {
            if (
              newPage === "pastPapers"
            ) {
              returnFromPaper();
            } else {
              setPage(newPage);
            }
          }}
        />
      </div>
    );
  }

  if (loading) {
    return (
      <div className="study-hub">
        <div className="no-subjects">
          <div className="no-subjects-icon">
            🔴
          </div>

          <h2>
            Joining Live Room...
          </h2>

          <p>
            Connecting chat, whiteboard and timer.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div
      style={{
        minHeight: "100vh",
        background:
          "#f1f5f9",
      }}
    >
      <div
        style={{
          position: "sticky",
          top: 0,
          zIndex: 50,
          background:
            "rgba(255,255,255,.96)",
          borderBottom:
            "1px solid #e2e8f0",
          padding:
            "13px 18px",
          display: "flex",
          justifyContent:
            "space-between",
          alignItems: "center",
          gap: "15px",
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
          <button
            type="button"
            onClick={leaveRoom}
          >
            ← Leave
          </button>

          <div>
            <div
              style={{
                fontWeight: 900,
                fontSize: "18px",
              }}
            >
              🔴 {session.name}
            </div>

            <div
              style={{
                color: "#64748b",
                fontSize: "13px",
              }}
            >
              {session.subject || "Study"}
              {session.topic
                ? ` • ${session.topic}`
                : ""}
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
          <div
            style={{
              padding:
                "8px 12px",
              borderRadius:
                "12px",
              background:
                timerRemaining === 0
                  ? "#fee2e2"
                  : "#0f172a",
              color:
                timerRemaining === 0
                  ? "#991b1b"
                  : "white",
              fontWeight: 900,
              fontVariantNumeric:
                "tabular-nums",
            }}
          >
            ⏱ {formatTimer(timerRemaining)}
          </div>

          {isHost && (
            <>
              <button
                type="button"
                onClick={
                  session.timer_is_running
                    ? pauseTimer
                    : startTimer
                }
              >
                {session.timer_is_running
                  ? "⏸ Pause"
                  : "▶ Start"}
              </button>

              <select
                onChange={(event) =>
                  resetTimer(
                    event.target.value
                  )
                }
                defaultValue=""
              >
                <option
                  value=""
                  disabled
                >
                  Reset timer
                </option>
                <option value="15">
                  15m
                </option>
                <option value="25">
                  25m
                </option>
                <option value="40">
                  40m
                </option>
                <option value="50">
                  50m
                </option>
                <option value="60">
                  60m
                </option>
              </select>
            </>
          )}

          {isHost && (
            <button
              type="button"
              onClick={openPaperPicker}
            >
              📄 Past Paper
            </button>
          )}

          {isHost && (
            <button
              type="button"
              onClick={() =>
                setShowBattleCreator(
                  true
                )
              }
            >
              ⚔️ Battle
            </button>
          )}

          {isHost && (
            <button
              type="button"
              onClick={
                openFlashcardPicker
              }
            >
              🃏 Flashcards
            </button>
          )}

          <button
            type="button"
            onClick={() =>
              setShowInviteFriends(true)
            }
          >
            👥 Invite
          </button>

          {isHost && (
            <button
              type="button"
              onClick={endRoom}
              style={{
                background:
                  "#dc2626",
                color: "white",
                border: "none",
                borderRadius:
                  "9px",
                padding:
                  "9px 12px",
              }}
            >
              End Room
            </button>
          )}
        </div>
      </div>

      {recapLoading && (
        <div
          style={{
            margin: "16px 18px 0",
            padding: "13px",
            borderRadius: "12px",
            background: "#eef2ff",
            color: "#3730a3",
            fontWeight: 700,
          }}
        >
          ✨ Building your session recap...
        </div>
      )}

      {error && (
        <div
          style={{
            margin: "16px 18px 0",
            padding: "13px",
            borderRadius:
              "12px",
            background:
              "#fff1f2",
            color: "#9f1239",
          }}
        >
          ⚠️ {error}
        </div>
      )}

      <div
        style={{
          padding: "18px",
          display: "grid",
          gridTemplateColumns:
            "minmax(0, 1fr) 340px",
          gap: "18px",
          alignItems: "start",
        }}
      >
        <div
          style={{
            display: "grid",
            gap: "18px",
          }}
        >
          {session?.activity ===
            "flashcards" &&
            activeFlashcardSession && (
              <div
                style={{
                  background:
                    "linear-gradient(135deg,#0f766e,#164e63)",
                  color: "white",
                  borderRadius:
                    "22px",
                  padding: "20px",
                  boxShadow:
                    "0 14px 40px rgba(15,118,110,.22)",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent:
                      "space-between",
                    alignItems:
                      "center",
                    gap: "14px",
                    flexWrap: "wrap",
                  }}
                >
                  <div>
                    <div
                      style={{
                        fontSize:
                          "12px",
                        fontWeight:
                          900,
                        letterSpacing:
                          ".12em",
                        color:
                          "#99f6e4",
                      }}
                    >
                      🃏 MULTIPLAYER FLASHCARDS
                    </div>

                    <h2
                      style={{
                        margin:
                          "5px 0 0",
                      }}
                    >
                      {flashcardDeckName ||
                        "Flashcard Session"}
                    </h2>
                  </div>

                  {activeFlashcardSession.status ===
                    "playing" && (
                    <div
                      style={{
                        padding:
                          "9px 13px",
                        borderRadius:
                          "12px",
                        background:
                          "rgba(255,255,255,.13)",
                        fontWeight:
                          900,
                      }}
                    >
                      Card{" "}
                      {
                        activeFlashcardSession.current_card
                      }
                      /
                      {sharedFlashcard?.total ||
                        flashcardCards.length ||
                        "?"}
                    </div>
                  )}
                </div>

                {activeFlashcardSession.status ===
                  "lobby" && (
                  <div
                    style={{
                      marginTop: "20px",
                      padding: "20px",
                      borderRadius:
                        "18px",
                      background:
                        "rgba(255,255,255,.1)",
                    }}
                  >
                    <h3
                      style={{
                        marginTop: 0,
                      }}
                    >
                      Flashcard Lobby
                    </h3>

                    <p
                      style={{
                        color:
                          "#ccfbf1",
                      }}
                    >
                      {isHost
                        ? `${flashcardCards.length} cards ready. Start when everyone is in the room.`
                        : "The host is getting the deck ready."}
                    </p>

                    <div
                      style={{
                        display: "flex",
                        flexWrap: "wrap",
                        gap: "8px",
                        marginTop:
                          "14px",
                      }}
                    >
                      {members.map(
                        (member) => (
                          <span
                            key={
                              member.id
                            }
                            style={{
                              padding:
                                "7px 10px",
                              borderRadius:
                                "999px",
                              background:
                                "rgba(255,255,255,.11)",
                            }}
                          >
                            {onlineMembers.has(
                              member.user_id
                            )
                              ? "🟢"
                              : "⚪"}{" "}
                            {member.user_id ===
                            currentUser?.id
                              ? "You"
                              : profiles[
                                  member
                                    .user_id
                                ]
                                  ?.full_name ||
                                "Student"}
                          </span>
                        )
                      )}
                    </div>

                    {isHost && (
                      <button
                        type="button"
                        onClick={
                          startFlashcards
                        }
                        disabled={
                          flashcardTransitioning ||
                          flashcardCards.length ===
                            0
                        }
                        style={{
                          marginTop:
                            "18px",
                          padding:
                            "11px 18px",
                          borderRadius:
                            "12px",
                          border:
                            "none",
                          background:
                            "#fbbf24",
                          color:
                            "#134e4a",
                          fontWeight:
                            900,
                          cursor:
                            "pointer",
                        }}
                      >
                        {flashcardTransitioning
                          ? "Starting..."
                          : "🃏 Start Flashcards"}
                      </button>
                    )}
                  </div>
                )}

                {activeFlashcardSession.status ===
                  "playing" && (
                  <div
                    style={{
                      marginTop: "20px",
                      display: "grid",
                      gridTemplateColumns:
                        "minmax(0,1fr) 300px",
                      gap: "18px",
                    }}
                  >
                    <div
                      style={{
                        background:
                          "white",
                        color:
                          "#0f172a",
                        borderRadius:
                          "20px",
                        padding:
                          "22px",
                      }}
                    >
                      {!sharedFlashcard ? (
                        <div
                          style={{
                            textAlign:
                              "center",
                            padding:
                              "50px 20px",
                            color:
                              "#64748b",
                          }}
                        >
                          <div
                            style={{
                              fontSize:
                                "40px",
                            }}
                          >
                            🃏
                          </div>

                          <strong>
                            Syncing card...
                          </strong>

                          <div
                            style={{
                              marginTop:
                                "6px",
                            }}
                          >
                            Waiting for the host's
                            current flashcard.
                          </div>

                          <button
                            type="button"
                            onClick={
                              requestCurrentFlashcardState
                            }
                            style={{
                              marginTop:
                                "14px",
                            }}
                          >
                            Sync Now
                          </button>
                        </div>
                      ) : (
                        <>
                          <div
                            style={{
                              fontSize:
                                "12px",
                              fontWeight:
                                900,
                              color:
                                "#0f766e",
                              letterSpacing:
                                ".08em",
                            }}
                          >
                            FRONT
                          </div>

                          <div
                            style={{
                              minHeight:
                                "190px",
                              display:
                                "flex",
                              alignItems:
                                "center",
                              justifyContent:
                                "center",
                              textAlign:
                                "center",
                              padding:
                                "20px",
                              fontSize:
                                "26px",
                              lineHeight:
                                1.35,
                              fontWeight:
                                800,
                            }}
                          >
                            {
                              sharedFlashcard.front
                            }
                          </div>

                          {!activeFlashcardSession.answer_revealed ? (
                            <div
                              style={{
                                textAlign:
                                  "center",
                                paddingTop:
                                  "12px",
                                borderTop:
                                  "1px solid #e2e8f0",
                              }}
                            >
                              {isHost ? (
                                <button
                                  type="button"
                                  onClick={
                                    revealFlashcardAnswer
                                  }
                                  disabled={
                                    flashcardTransitioning
                                  }
                                  style={{
                                    padding:
                                      "11px 18px",
                                    borderRadius:
                                      "12px",
                                    border:
                                      "none",
                                    background:
                                      "#0f766e",
                                    color:
                                      "white",
                                    fontWeight:
                                      900,
                                  }}
                                >
                                  👁 Reveal Answer
                                </button>
                              ) : (
                                <strong
                                  style={{
                                    color:
                                      "#64748b",
                                  }}
                                >
                                  Waiting for the host to
                                  reveal the answer...
                                </strong>
                              )}
                            </div>
                          ) : (
                            <>
                              <div
                                style={{
                                  borderTop:
                                    "1px solid #e2e8f0",
                                  paddingTop:
                                    "18px",
                                }}
                              >
                                <div
                                  style={{
                                    fontSize:
                                      "12px",
                                    fontWeight:
                                      900,
                                    color:
                                      "#0f766e",
                                    letterSpacing:
                                      ".08em",
                                  }}
                                >
                                  BACK
                                </div>

                                <div
                                  style={{
                                    minHeight:
                                      "135px",
                                    display:
                                      "flex",
                                    alignItems:
                                      "center",
                                    justifyContent:
                                      "center",
                                    textAlign:
                                      "center",
                                    padding:
                                      "18px",
                                    fontSize:
                                      "20px",
                                    lineHeight:
                                      1.45,
                                    fontWeight:
                                      700,
                                  }}
                                >
                                  {sharedFlashcard.back ||
                                    "Syncing answer..."}
                                </div>
                              </div>

                              <div
                                style={{
                                  borderTop:
                                    "1px solid #e2e8f0",
                                  paddingTop:
                                    "16px",
                                }}
                              >
                                <strong>
                                  How did you do?
                                </strong>

                                {myFlashcardRatings[
                                  sharedFlashcard.id
                                ] ? (
                                  <div
                                    style={{
                                      marginTop:
                                        "10px",
                                      padding:
                                        "12px",
                                      borderRadius:
                                        "12px",
                                      background:
                                        "#ecfdf5",
                                      color:
                                        "#065f46",
                                      fontWeight:
                                        800,
                                    }}
                                  >
                                    ✅ Rating saved:{" "}
                                    {myFlashcardRatings[
                                      sharedFlashcard.id
                                    ] ===
                                    "got_it"
                                      ? "Got It"
                                      : myFlashcardRatings[
                                          sharedFlashcard.id
                                        ] ===
                                        "nearly"
                                      ? "Nearly"
                                      : "Didn't Know"}
                                  </div>
                                ) : (
                                  <div
                                    style={{
                                      display:
                                        "grid",
                                      gridTemplateColumns:
                                        "repeat(3,1fr)",
                                      gap:
                                        "8px",
                                      marginTop:
                                        "10px",
                                    }}
                                  >
                                    <button
                                      type="button"
                                      onClick={() =>
                                        rateFlashcard(
                                          "didnt_know"
                                        )
                                      }
                                      disabled={
                                        flashcardRatingLoading
                                      }
                                      style={{
                                        padding:
                                          "11px 8px",
                                        borderRadius:
                                          "11px",
                                        border:
                                          "1px solid #fecaca",
                                        background:
                                          "#fff1f2",
                                        color:
                                          "#991b1b",
                                        fontWeight:
                                          800,
                                      }}
                                    >
                                      😕 Didn't Know
                                    </button>

                                    <button
                                      type="button"
                                      onClick={() =>
                                        rateFlashcard(
                                          "nearly"
                                        )
                                      }
                                      disabled={
                                        flashcardRatingLoading
                                      }
                                      style={{
                                        padding:
                                          "11px 8px",
                                        borderRadius:
                                          "11px",
                                        border:
                                          "1px solid #fde68a",
                                        background:
                                          "#fffbeb",
                                        color:
                                          "#92400e",
                                        fontWeight:
                                          800,
                                      }}
                                    >
                                      🟡 Nearly
                                    </button>

                                    <button
                                      type="button"
                                      onClick={() =>
                                        rateFlashcard(
                                          "got_it"
                                        )
                                      }
                                      disabled={
                                        flashcardRatingLoading
                                      }
                                      style={{
                                        padding:
                                          "11px 8px",
                                        borderRadius:
                                          "11px",
                                        border:
                                          "1px solid #bbf7d0",
                                        background:
                                          "#f0fdf4",
                                        color:
                                          "#166534",
                                        fontWeight:
                                          800,
                                      }}
                                    >
                                      🟢 Got It
                                    </button>
                                  </div>
                                )}
                              </div>

                              {isHost && (
                                <button
                                  type="button"
                                  onClick={
                                    nextFlashcard
                                  }
                                  disabled={
                                    flashcardTransitioning
                                  }
                                  style={{
                                    marginTop:
                                      "16px",
                                    width:
                                      "100%",
                                    padding:
                                      "11px",
                                    borderRadius:
                                      "12px",
                                    border:
                                      "none",
                                    background:
                                      "#fbbf24",
                                    color:
                                      "#134e4a",
                                    fontWeight:
                                      900,
                                  }}
                                >
                                  {Number(
                                    activeFlashcardSession.current_card
                                  ) >=
                                  flashcardCards.length
                                    ? "🏁 Finish Session"
                                    : "Next Card →"}
                                </button>
                              )}
                            </>
                          )}
                        </>
                      )}
                    </div>

                    <div
                      style={{
                        background:
                          "rgba(255,255,255,.11)",
                        borderRadius:
                          "18px",
                        padding:
                          "16px",
                      }}
                    >
                      <strong>
                        📊 Live Progress
                      </strong>

                      <div
                        style={{
                          display:
                            "grid",
                          gap: "9px",
                          marginTop:
                            "12px",
                        }}
                      >
                        {members.map(
                          (member) => {
                            const memberResponses =
                              flashcardResponses.filter(
                                (
                                  response
                                ) =>
                                  response.user_id ===
                                  member.user_id
                              );

                            const gotIt =
                              memberResponses.filter(
                                (
                                  response
                                ) =>
                                  response.rating ===
                                  "got_it"
                              ).length;

                            return (
                              <div
                                key={
                                  member.id
                                }
                                style={{
                                  padding:
                                    "9px 10px",
                                  borderRadius:
                                    "11px",
                                  background:
                                    "rgba(255,255,255,.09)",
                                }}
                              >
                                <div
                                  style={{
                                    display:
                                      "flex",
                                    justifyContent:
                                      "space-between",
                                    gap:
                                      "8px",
                                  }}
                                >
                                  <span>
                                    {member.user_id ===
                                    currentUser?.id
                                      ? "You"
                                      : profiles[
                                          member
                                            .user_id
                                        ]
                                          ?.full_name ||
                                        "Student"}
                                  </span>

                                  <strong>
                                    {
                                      memberResponses.length
                                    }{" "}
                                    rated
                                  </strong>
                                </div>

                                <div
                                  style={{
                                    fontSize:
                                      "11px",
                                    color:
                                      "#ccfbf1",
                                    marginTop:
                                      "3px",
                                  }}
                                >
                                  🟢 {gotIt} got it
                                </div>
                              </div>
                            );
                          }
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {activeFlashcardSession.status ===
                  "finished" && (
                  <div
                    style={{
                      marginTop: "20px",
                    }}
                  >
                    <div
                      style={{
                        textAlign:
                          "center",
                        padding:
                          "18px",
                      }}
                    >
                      <div
                        style={{
                          fontSize:
                            "54px",
                        }}
                      >
                        🎉
                      </div>

                      <h2>
                        Flashcards Complete!
                      </h2>

                      <p
                        style={{
                          color:
                            "#ccfbf1",
                        }}
                      >
                        Here's how everyone felt
                        about the deck.
                      </p>
                    </div>

                    <div
                      style={{
                        display: "grid",
                        gridTemplateColumns:
                          "repeat(auto-fit,minmax(220px,1fr))",
                        gap: "12px",
                      }}
                    >
                      {getFlashcardResults().map(
                        (
                          result,
                          index
                        ) => (
                          <div
                            key={
                              result.user_id
                            }
                            style={{
                              padding:
                                "16px",
                              borderRadius:
                                "16px",
                              background:
                                "rgba(255,255,255,.11)",
                            }}
                          >
                            <div
                              style={{
                                display:
                                  "flex",
                                justifyContent:
                                  "space-between",
                                gap:
                                  "10px",
                              }}
                            >
                              <strong>
                                {index ===
                                0
                                  ? "🏆 "
                                  : ""}
                                {result.user_id ===
                                currentUser?.id
                                  ? "You"
                                  : profiles[
                                      result
                                        .user_id
                                    ]
                                      ?.full_name ||
                                    "Student"}
                              </strong>

                              <strong>
                                {
                                  result.mastery
                                }
                                %
                              </strong>
                            </div>

                            <div
                              style={{
                                display:
                                  "grid",
                                gap: "5px",
                                marginTop:
                                  "10px",
                                fontSize:
                                  "13px",
                              }}
                            >
                              <div>
                                🟢 Got It:{" "}
                                {
                                  result.got_it
                                }
                              </div>

                              <div>
                                🟡 Nearly:{" "}
                                {
                                  result.nearly
                                }
                              </div>

                              <div>
                                🔴 Didn't Know:{" "}
                                {
                                  result.didnt_know
                                }
                              </div>
                            </div>
                          </div>
                        )
                      )}
                    </div>

                    {isHost && (
                      <div
                        style={{
                          textAlign:
                            "center",
                          marginTop:
                            "18px",
                        }}
                      >
                        <button
                          type="button"
                          onClick={
                            closeFlashcards
                          }
                          style={{
                            padding:
                              "10px 15px",
                            borderRadius:
                              "10px",
                            border:
                              "none",
                            background:
                              "#fbbf24",
                            color:
                              "#134e4a",
                            fontWeight:
                              900,
                          }}
                        >
                          Return to Whiteboard
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

          {session?.activity ===
            "battle" &&
            activeBattle && (
              <div
                style={{
                  background:
                    "linear-gradient(135deg,#111827,#312e81)",
                  color: "white",
                  borderRadius:
                    "22px",
                  padding: "20px",
                  boxShadow:
                    "0 14px 40px rgba(49,46,129,.22)",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent:
                      "space-between",
                    alignItems:
                      "center",
                    gap: "14px",
                    flexWrap: "wrap",
                  }}
                >
                  <div>
                    <div
                      style={{
                        fontSize:
                          "12px",
                        fontWeight:
                          900,
                        letterSpacing:
                          ".12em",
                        color:
                          "#c4b5fd",
                      }}
                    >
                      ⚔️ REVISION BATTLE
                    </div>

                    <h2
                      style={{
                        margin:
                          "5px 0 0",
                      }}
                    >
                      {activeBattle.title}
                    </h2>
                  </div>

                  <div
                    style={{
                      display: "flex",
                      gap: "8px",
                      flexWrap: "wrap",
                    }}
                  >
                    {activeBattle.status ===
                      "question" && (
                      <div
                        style={{
                          padding:
                            "9px 13px",
                          borderRadius:
                            "12px",
                          background:
                            battleTimeRemaining <=
                            5
                              ? "#7f1d1d"
                              : "rgba(255,255,255,.12)",
                          fontWeight:
                            900,
                          fontVariantNumeric:
                            "tabular-nums",
                        }}
                      >
                        ⏱{" "}
                        {battleTimeRemaining}s
                      </div>
                    )}

                    <div
                      style={{
                        padding:
                          "9px 13px",
                        borderRadius:
                          "12px",
                        background:
                          "rgba(255,255,255,.12)",
                        fontWeight:
                          800,
                      }}
                    >
                      {battleQuestions.length > 0
                        ? `Q${
                            activeBattle.current_question ||
                            0
                          }/${battleQuestions.length}`
                        : "Lobby"}
                    </div>
                  </div>
                </div>

                {activeBattle.status ===
                  "lobby" && (
                  <div
                    style={{
                      marginTop: "20px",
                      display: "grid",
                      gridTemplateColumns:
                        "minmax(0,1fr) 280px",
                      gap: "18px",
                    }}
                  >
                    <div
                      style={{
                        padding: "18px",
                        borderRadius:
                          "16px",
                        background:
                          "rgba(255,255,255,.08)",
                      }}
                    >
                      <h3
                        style={{
                          marginTop: 0,
                        }}
                      >
                        Battle Lobby
                      </h3>

                      <p
                        style={{
                          color:
                            "#dbeafe",
                        }}
                      >
                        {battleQuestions.length}{" "}
                        {battleQuestions.length ===
                        1
                          ? "question"
                          : "questions"}{" "}
                        •{" "}
                        {
                          activeBattle.seconds_per_question
                        }
                        s per question
                      </p>

                      <div
                        style={{
                          display:
                            "flex",
                          flexWrap:
                            "wrap",
                          gap: "8px",
                          marginTop:
                            "14px",
                        }}
                      >
                        {members.map(
                          (member) => (
                            <span
                              key={
                                member.id
                              }
                              style={{
                                padding:
                                  "7px 10px",
                                borderRadius:
                                  "999px",
                                background:
                                  "rgba(255,255,255,.1)",
                              }}
                            >
                              {onlineMembers.has(
                                member.user_id
                              )
                                ? "🟢"
                                : "⚪"}{" "}
                              {member.user_id ===
                              currentUser?.id
                                ? "You"
                                : profiles[
                                    member
                                      .user_id
                                  ]
                                    ?.full_name ||
                                  "Student"}
                            </span>
                          )
                        )}
                      </div>

                      {isHost && (
                        <button
                          type="button"
                          onClick={
                            startBattle
                          }
                          disabled={
                            battleTransitioning
                          }
                          style={{
                            marginTop:
                              "18px",
                            padding:
                              "11px 18px",
                            borderRadius:
                              "12px",
                            border:
                              "none",
                            background:
                              "#f59e0b",
                            color:
                              "#111827",
                            fontWeight:
                              900,
                            cursor:
                              "pointer",
                          }}
                        >
                          {battleTransitioning
                            ? "Starting..."
                            : "⚔️ Start Battle"}
                        </button>
                      )}
                    </div>

                    <div
                      style={{
                        padding: "18px",
                        borderRadius:
                          "16px",
                        background:
                          "rgba(255,255,255,.08)",
                      }}
                    >
                      <strong>
                        🏆 How scoring works
                      </strong>

                      <p
                        style={{
                          marginTop:
                            "9px",
                          color:
                            "#dbeafe",
                          fontSize:
                            "14px",
                          lineHeight:
                            1.55,
                        }}
                      >
                        Correct answer = 100
                        points. Fastest total
                        response time breaks
                        ties.
                      </p>
                    </div>
                  </div>
                )}

                {(activeBattle.status ===
                  "question" ||
                  activeBattle.status ===
                    "results") &&
                  (() => {
                    const question =
                      battleQuestions.find(
                        (item) =>
                          item.question_number ===
                          activeBattle.current_question
                      );

                    if (!question) {
                      return (
                        <div
                          style={{
                            marginTop:
                              "20px",
                          }}
                        >
                          Loading question...
                        </div>
                      );
                    }

                    const myAnswer =
                      myBattleAnswers[
                        question.id
                      ];

                    const reveal =
                      activeBattle.status ===
                      "results";

                    return (
                      <div
                        style={{
                          marginTop:
                            "20px",
                          display:
                            "grid",
                          gridTemplateColumns:
                            "minmax(0,1fr) 300px",
                          gap: "18px",
                        }}
                      >
                        <div
                          style={{
                            background:
                              "white",
                            color:
                              "#0f172a",
                            borderRadius:
                              "18px",
                            padding:
                              "20px",
                          }}
                        >
                          <div
                            style={{
                              fontSize:
                                "12px",
                              fontWeight:
                                900,
                              color:
                                "#7c3aed",
                              letterSpacing:
                                ".08em",
                            }}
                          >
                            QUESTION{" "}
                            {
                              activeBattle.current_question
                            }{" "}
                            OF{" "}
                            {
                              battleQuestions.length
                            }
                          </div>

                          <h2
                            style={{
                              margin:
                                "8px 0 18px",
                              lineHeight:
                                1.25,
                            }}
                          >
                            {
                              question.question_text
                            }
                          </h2>

                          <div
                            style={{
                              display:
                                "grid",
                              gap: "10px",
                            }}
                          >
                            {(
                              question.options ||
                              []
                            ).map(
                              (
                                option,
                                index
                              ) => {
                                const selected =
                                  myAnswer?.selected_index ===
                                  index;

                                const correct =
                                  reveal &&
                                  revealedCorrectIndex ===
                                    index;

                                const wrongSelected =
                                  reveal &&
                                  selected &&
                                  !correct;

                                return (
                                  <button
                                    key={
                                      index
                                    }
                                    type="button"
                                    disabled={
                                      Boolean(
                                        myAnswer
                                      ) ||
                                      reveal ||
                                      battleTimeRemaining <=
                                        0
                                    }
                                    onClick={() =>
                                      submitBattleAnswer(
                                        index
                                      )
                                    }
                                    style={{
                                      textAlign:
                                        "left",
                                      padding:
                                        "13px 14px",
                                      borderRadius:
                                        "13px",
                                      border:
                                        correct
                                          ? "2px solid #22c55e"
                                          : wrongSelected
                                          ? "2px solid #ef4444"
                                          : selected
                                          ? "2px solid #6366f1"
                                          : "1px solid #e2e8f0",
                                      background:
                                        correct
                                          ? "#dcfce7"
                                          : wrongSelected
                                          ? "#fee2e2"
                                          : selected
                                          ? "#eef2ff"
                                          : "white",
                                      color:
                                        "#0f172a",
                                      cursor:
                                        myAnswer ||
                                        reveal
                                          ? "default"
                                          : "pointer",
                                      fontWeight:
                                        700,
                                    }}
                                  >
                                    <span
                                      style={{
                                        display:
                                          "inline-flex",
                                        width:
                                          "26px",
                                        height:
                                          "26px",
                                        borderRadius:
                                          "50%",
                                        alignItems:
                                          "center",
                                        justifyContent:
                                          "center",
                                        background:
                                          "#f1f5f9",
                                        marginRight:
                                          "10px",
                                      }}
                                    >
                                      {String.fromCharCode(
                                        65 +
                                          index
                                      )}
                                    </span>

                                    {
                                      option
                                    }
                                  </button>
                                );
                              }
                            )}
                          </div>

                          {myAnswer &&
                            activeBattle.status ===
                              "question" && (
                              <div
                                style={{
                                  marginTop:
                                    "14px",
                                  padding:
                                    "12px",
                                  borderRadius:
                                    "12px",
                                  background:
                                    "#f8fafc",
                                  color:
                                    "#475569",
                                }}
                              >
                                🔒 Answer
                                locked in. Waiting
                                for the round to
                                finish...
                              </div>
                            )}

                          {reveal && (
                            <div
                              style={{
                                marginTop:
                                  "14px",
                                padding:
                                  "13px",
                                borderRadius:
                                  "12px",
                                background:
                                  myAnswer
                                    ?.is_correct
                                    ? "#dcfce7"
                                    : "#fff7ed",
                                color:
                                  "#334155",
                              }}
                            >
                              <strong>
                                {myAnswer
                                  ?.is_correct
                                  ? "✅ Correct!"
                                  : myAnswer
                                  ? "❌ Not this time."
                                  : "⏱ No answer submitted."}
                              </strong>

                              {question.explanation && (
                                <div
                                  style={{
                                    marginTop:
                                      "6px",
                                  }}
                                >
                                  {
                                    question.explanation
                                  }
                                </div>
                              )}
                            </div>
                          )}

                          {isHost && (
                            <div
                              style={{
                                display:
                                  "flex",
                                gap: "9px",
                                marginTop:
                                  "16px",
                                flexWrap:
                                  "wrap",
                              }}
                            >
                              {activeBattle.status ===
                                "question" && (
                                <button
                                  type="button"
                                  onClick={
                                    revealBattleResults
                                  }
                                  disabled={
                                    battleTransitioning
                                  }
                                >
                                  Show Results
                                </button>
                              )}

                              {activeBattle.status ===
                                "results" && (
                                <button
                                  type="button"
                                  onClick={
                                    nextBattleQuestion
                                  }
                                  disabled={
                                    battleTransitioning
                                  }
                                  style={{
                                    background:
                                      "#f59e0b",
                                    border:
                                      "none",
                                    borderRadius:
                                      "10px",
                                    padding:
                                      "10px 14px",
                                    fontWeight:
                                      900,
                                    cursor:
                                      "pointer",
                                  }}
                                >
                                  {activeBattle.current_question >=
                                  battleQuestions.length
                                    ? "🏁 Finish Battle"
                                    : "Next Question →"}
                                </button>
                              )}
                            </div>
                          )}
                        </div>

                        <div
                          style={{
                            background:
                              "rgba(255,255,255,.1)",
                            borderRadius:
                              "18px",
                            padding:
                              "16px",
                          }}
                        >
                          <strong>
                            🏆 Live Score
                          </strong>

                          <div
                            style={{
                              display:
                                "grid",
                              gap: "8px",
                              marginTop:
                                "12px",
                            }}
                          >
                            {battleScores.length ===
                            0 ? (
                              <div
                                style={{
                                  color:
                                    "#cbd5e1",
                                  fontSize:
                                    "14px",
                                }}
                              >
                                Scores appear as
                                answers come in.
                              </div>
                            ) : (
                              battleScores.map(
                                (
                                  score,
                                  index
                                ) => (
                                  <div
                                    key={
                                      score.id
                                    }
                                    style={{
                                      display:
                                        "flex",
                                      justifyContent:
                                        "space-between",
                                      gap:
                                        "10px",
                                      padding:
                                        "9px 10px",
                                      borderRadius:
                                        "11px",
                                      background:
                                        "rgba(255,255,255,.09)",
                                    }}
                                  >
                                    <span>
                                      {index ===
                                      0
                                        ? "🥇"
                                        : index ===
                                          1
                                        ? "🥈"
                                        : index ===
                                          2
                                        ? "🥉"
                                        : `${index + 1}.`}{" "}
                                      {score.user_id ===
                                      currentUser?.id
                                        ? "You"
                                        : profiles[
                                            score
                                              .user_id
                                          ]
                                            ?.full_name ||
                                          "Student"}
                                    </span>

                                    <strong>
                                      {
                                        score.score
                                      }
                                    </strong>
                                  </div>
                                )
                              )
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })()}

                {activeBattle.status ===
                  "finished" && (
                  <div
                    style={{
                      marginTop: "20px",
                      display: "grid",
                      gridTemplateColumns:
                        "minmax(0,1fr) 320px",
                      gap: "18px",
                    }}
                  >
                    <div
                      style={{
                        padding: "24px",
                        borderRadius:
                          "18px",
                        background:
                          "rgba(255,255,255,.09)",
                        textAlign:
                          "center",
                      }}
                    >
                      <div
                        style={{
                          fontSize:
                            "56px",
                        }}
                      >
                        🏆
                      </div>

                      <h2>
                        Battle Complete!
                      </h2>

                      <p
                        style={{
                          color:
                            "#dbeafe",
                        }}
                      >
                        {battleQuestions.length}{" "}
                        questions completed.
                      </p>

                      {isHost && (
                        <button
                          type="button"
                          onClick={
                            closeBattle
                          }
                          style={{
                            marginTop:
                              "12px",
                            padding:
                              "10px 15px",
                            borderRadius:
                              "10px",
                            border:
                              "none",
                            background:
                              "#f59e0b",
                            fontWeight:
                              900,
                          }}
                        >
                          Return to Whiteboard
                        </button>
                      )}
                    </div>

                    <div
                      style={{
                        background:
                          "rgba(255,255,255,.1)",
                        borderRadius:
                          "18px",
                        padding: "16px",
                      }}
                    >
                      <strong>
                        FINAL PODIUM
                      </strong>

                      <div
                        style={{
                          display:
                            "grid",
                          gap: "9px",
                          marginTop:
                            "12px",
                        }}
                      >
                        {battleScores.map(
                          (
                            score,
                            index
                          ) => (
                            <div
                              key={
                                score.id
                              }
                              style={{
                                display:
                                  "grid",
                                gridTemplateColumns:
                                  "34px minmax(0,1fr) auto",
                                gap:
                                  "8px",
                                alignItems:
                                  "center",
                                padding:
                                  "10px",
                                borderRadius:
                                  "12px",
                                background:
                                  index ===
                                  0
                                    ? "rgba(245,158,11,.24)"
                                    : "rgba(255,255,255,.08)",
                              }}
                            >
                              <div
                                style={{
                                  fontSize:
                                    "22px",
                                }}
                              >
                                {index ===
                                0
                                  ? "🥇"
                                  : index ===
                                    1
                                  ? "🥈"
                                  : index ===
                                    2
                                  ? "🥉"
                                  : index +
                                    1}
                              </div>

                              <div>
                                <strong>
                                  {score.user_id ===
                                  currentUser?.id
                                    ? "You"
                                    : profiles[
                                        score
                                          .user_id
                                      ]
                                        ?.full_name ||
                                      "Student"}
                                </strong>

                                <div
                                  style={{
                                    fontSize:
                                      "11px",
                                    color:
                                      "#cbd5e1",
                                    marginTop:
                                      "2px",
                                  }}
                                >
                                  {
                                    score.correct_answers
                                  }{" "}
                                  correct •{" "}
                                  {formatBattleTime(
                                    score.total_response_ms
                                  )}{" "}
                                  total
                                </div>
                              </div>

                              <strong>
                                {
                                  score.score
                                }{" "}
                                pts
                              </strong>
                            </div>
                          )
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

          <div
            style={{
              background: "white",
              borderRadius:
                "20px",
              padding: "16px",
              boxShadow:
                "0 6px 24px rgba(15,23,42,.06)",
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent:
                  "space-between",
                alignItems:
                  "center",
                gap: "10px",
                flexWrap: "wrap",
                marginBottom:
                  "12px",
              }}
            >
              <div>
                <strong
                  style={{
                    fontSize:
                      "18px",
                  }}
                >
                  ✏️ Shared Whiteboard
                </strong>

                <div
                  style={{
                    color:
                      "#64748b",
                    fontSize:
                      "13px",
                    marginTop:
                      "3px",
                  }}
                >
                  Everyone sees writing live.
                </div>
              </div>

              <div
                style={{
                  display: "flex",
                  gap: "7px",
                  flexWrap: "wrap",
                }}
              >
                <button
                  type="button"
                  onClick={() =>
                    setTool("pen")
                  }
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
                >
                  🖍 Highlight
                </button>

                <button
                  type="button"
                  onClick={() =>
                    setTool("eraser")
                  }
                >
                  🧽 Eraser
                </button>

                <input
                  type="color"
                  value={penColour}
                  onChange={(event) =>
                    setPenColour(
                      event.target.value
                    )
                  }
                />

                <select
                  value={penSize}
                  onChange={(event) =>
                    setPenSize(
                      event.target.value
                    )
                  }
                >
                  <option value="2">
                    Thin
                  </option>
                  <option value="3">
                    Medium
                  </option>
                  <option value="5">
                    Thick
                  </option>
                  <option value="8">
                    Very thick
                  </option>
                </select>

                <button
                  type="button"
                  onClick={
                    undoMyLastStroke
                  }
                >
                  ↩ Undo
                </button>

                <button
                  type="button"
                  onClick={
                    clearWhiteboard
                  }
                >
                  🗑 Clear
                </button>
              </div>
            </div>

            <div
              style={{
                background:
                  "#fafafa",
                border:
                  "1px solid #e2e8f0",
                borderRadius:
                  "16px",
                overflow: "hidden",
              }}
            >
              <canvas
                ref={canvasRef}
                width={1200}
                height={700}
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
                  width: "100%",
                  aspectRatio:
                    "12 / 7",
                  display: "block",
                  background:
                    "white",
                  touchAction:
                    "none",
                  cursor:
                    tool === "eraser"
                      ? "cell"
                      : "crosshair",
                }}
              />
            </div>
          </div>

          <div
            style={{
              background:
                session?.activity ===
                "past_paper"
                  ? "linear-gradient(135deg,#ede9fe,#dbeafe)"
                  : "linear-gradient(135deg,#eef2ff,#ecfeff)",
              border:
                "1px solid #c7d2fe",
              borderRadius:
                "18px",
              padding: "18px",
            }}
          >
            {session?.activity ===
              "past_paper" &&
            session?.active_paper_id ? (
              <div>
                <strong
                  style={{
                    fontSize: "17px",
                  }}
                >
                  📄 Shared Past Paper Ready
                </strong>

                <div
                  style={{
                    marginTop: "7px",
                    color: "#475569",
                  }}
                >
                  The room is working on the same
                  collaborative paper. Everyone's
                  writing and page changes are shared
                  live.
                </div>

                <div
                  style={{
                    display: "flex",
                    gap: "9px",
                    marginTop: "14px",
                    flexWrap: "wrap",
                  }}
                >
                  <button
                    type="button"
                    className="primary-card-button"
                    onClick={joinSharedPaper}
                    disabled={paperJoining}
                  >
                    {paperJoining
                      ? "Opening..."
                      : "📄 Join Shared Paper"}
                  </button>

                  {isHost && (
                    <button
                      type="button"
                      onClick={stopSharedPaper}
                    >
                      Stop Paper
                    </button>
                  )}
                </div>
              </div>
            ) : (
              <div>
                <strong
                  style={{
                    fontSize: "17px",
                  }}
                >
                  📄 Bring a Past Paper Into the Room
                </strong>

                <div
                  style={{
                    marginTop: "7px",
                    color: "#475569",
                  }}
                >
                  The host can choose a past paper and
                  everyone can work on exactly the same
                  collaborative copy.
                </div>

                {isHost && (
                  <button
                    type="button"
                    className="primary-card-button"
                    onClick={openPaperPicker}
                    style={{
                      marginTop: "14px",
                    }}
                  >
                    Choose Past Paper
                  </button>
                )}
              </div>
            )}
          </div>
        </div>

        <div
          style={{
            display: "grid",
            gap: "18px",
            position: "sticky",
            top: "88px",
          }}
        >
          <div
            style={{
              background: "white",
              borderRadius:
                "20px",
              padding: "16px",
              boxShadow:
                "0 6px 24px rgba(15,23,42,.06)",
            }}
          >
            <strong>
              👥 Studying Now
            </strong>

            <div
              style={{
                marginTop: "12px",
                display: "grid",
                gap: "8px",
              }}
            >
              {members.map(
                (member) => {
                  const profile =
                    profiles[
                      member.user_id
                    ];

                  const online =
                    onlineMembers.has(
                      member.user_id
                    );

                  return (
                    <div
                      key={member.id}
                      style={{
                        display:
                          "flex",
                        alignItems:
                          "center",
                        gap: "9px",
                        padding:
                          "9px 10px",
                        background:
                          member.user_id ===
                          currentUser?.id
                            ? "#eff6ff"
                            : "#f8fafc",
                        borderRadius:
                          "12px",
                      }}
                    >
                      <span>
                        {online
                          ? "🟢"
                          : "⚪"}
                      </span>

                      <div>
                        <strong
                          style={{
                            fontSize:
                              "14px",
                          }}
                        >
                          {member.user_id ===
                          currentUser?.id
                            ? "You"
                            : profile?.full_name ||
                              "Student"}
                        </strong>

                        {member.user_id ===
                          session.host_id && (
                          <div
                            style={{
                              color:
                                "#7c3aed",
                              fontSize:
                                "11px",
                              fontWeight:
                                800,
                            }}
                          >
                            HOST
                          </div>
                        )}
                      </div>
                    </div>
                  );
                }
              )}
            </div>
          </div>

          <div
            style={{
              background: "white",
              borderRadius:
                "20px",
              padding: "16px",
              boxShadow:
                "0 6px 24px rgba(15,23,42,.06)",
            }}
          >
            <strong>
              💬 Live Chat
            </strong>

            <div
              style={{
                height: "330px",
                overflowY: "auto",
                display: "flex",
                flexDirection:
                  "column",
                gap: "10px",
                margin:
                  "12px 0",
                paddingRight:
                  "4px",
              }}
            >
              {messages.length === 0 && (
                <div
                  style={{
                    color:
                      "#94a3b8",
                    textAlign:
                      "center",
                    marginTop:
                      "50px",
                  }}
                >
                  No messages yet.
                  <br />
                  Say hello 👋
                </div>
              )}

              {messages.map(
                (item) => {
                  const mine =
                    item.sender_id ===
                    currentUser?.id;

                  return (
                    <div
                      key={item.id}
                      style={{
                        alignSelf:
                          mine
                            ? "flex-end"
                            : "flex-start",
                        maxWidth:
                          "88%",
                      }}
                    >
                      {!mine && (
                        <div
                          style={{
                            fontSize:
                              "11px",
                            color:
                              "#64748b",
                            marginBottom:
                              "3px",
                          }}
                        >
                          {profiles[
                            item.sender_id
                          ]?.full_name ||
                            "Student"}
                        </div>
                      )}

                      <div
                        style={{
                          padding:
                            "9px 11px",
                          borderRadius:
                            "13px",
                          background:
                            mine
                              ? "#2563eb"
                              : "#f1f5f9",
                          color:
                            mine
                              ? "white"
                              : "#0f172a",
                          fontSize:
                            "14px",
                          whiteSpace:
                            "pre-wrap",
                          wordBreak:
                            "break-word",
                        }}
                      >
                        {item.content}
                      </div>
                    </div>
                  );
                }
              )}

              <div
                ref={
                  messagesEndRef
                }
              />
            </div>

            <form
              onSubmit={sendMessage}
              style={{
                display: "flex",
                gap: "7px",
              }}
            >
              <input
                type="text"
                value={message}
                onChange={(event) =>
                  setMessage(
                    event.target.value
                  )
                }
                placeholder="Message the room..."
                maxLength={500}
                style={{
                  flex: 1,
                }}
              />

              <button
                type="submit"
                disabled={
                  !message.trim()
                }
              >
                ➤
              </button>
            </form>
          </div>
        </div>
      </div>

      {showFlashcardPicker && (
        <div
          onMouseDown={(event) => {
            if (
              event.target ===
              event.currentTarget
            ) {
              setShowFlashcardPicker(
                false
              );
            }
          }}
          style={{
            position: "fixed",
            inset: 0,
            background:
              "rgba(15,23,42,.75)",
            display: "flex",
            alignItems: "center",
            justifyContent:
              "center",
            zIndex: 1350,
            padding: "20px",
          }}
        >
          <div
            style={{
              width: "100%",
              maxWidth: "620px",
              maxHeight:
                "84vh",
              overflowY: "auto",
              background: "white",
              borderRadius:
                "24px",
              padding: "24px",
              boxShadow:
                "0 30px 90px rgba(0,0,0,.35)",
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent:
                  "space-between",
                alignItems:
                  "start",
                gap: "14px",
              }}
            >
              <div>
                <p className="card-eyebrow">
                  🃏 MULTIPLAYER FLASHCARDS
                </p>

                <h2>
                  Choose a Deck
                </h2>

                <p
                  style={{
                    color:
                      "#64748b",
                  }}
                >
                  Everyone in the Study Together
                  room will see the same cards live.
                </p>
              </div>

              <button
                type="button"
                onClick={() =>
                  setShowFlashcardPicker(
                    false
                  )
                }
              >
                ✕
              </button>
            </div>

            <div
              style={{
                display: "grid",
                gap: "10px",
                marginTop: "20px",
              }}
            >
              {flashcardPickerLoading ? (
                <div
                  style={{
                    padding: "30px",
                    textAlign:
                      "center",
                    color:
                      "#64748b",
                  }}
                >
                  Loading your decks...
                </div>
              ) : flashcardDecks.length ===
                0 ? (
                <div
                  style={{
                    padding: "30px",
                    textAlign:
                      "center",
                    background:
                      "#f8fafc",
                    borderRadius:
                      "14px",
                    color:
                      "#64748b",
                  }}
                >
                  <div
                    style={{
                      fontSize:
                        "36px",
                    }}
                  >
                    🃏
                  </div>

                  <strong>
                    No flashcard decks yet
                  </strong>

                  <div
                    style={{
                      marginTop:
                        "6px",
                    }}
                  >
                    Create a flashcard deck first,
                    then come back here.
                  </div>
                </div>
              ) : (
                flashcardDecks.map(
                  (deck) => (
                    <button
                      key={deck.id}
                      type="button"
                      disabled={
                        flashcardStarting
                      }
                      onClick={() =>
                        createFlashcardSession(
                          deck
                        )
                      }
                      style={{
                        width: "100%",
                        textAlign:
                          "left",
                        padding:
                          "14px 16px",
                        border:
                          "1px solid #e2e8f0",
                        borderRadius:
                          "14px",
                        background:
                          "white",
                        cursor:
                          flashcardStarting
                            ? "not-allowed"
                            : "pointer",
                        opacity:
                          flashcardStarting
                            ? 0.7
                            : 1,
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
                          gap: "14px",
                        }}
                      >
                        <div>
                          <strong>
                            🃏 {deck.name}
                          </strong>

                          <div
                            style={{
                              marginTop:
                                "4px",
                              color:
                                "#64748b",
                              fontSize:
                                "13px",
                            }}
                          >
                            {deck.subject ||
                              "General"}
                            {deck.description
                              ? ` • ${deck.description}`
                              : ""}
                          </div>
                        </div>

                        <span>
                          {flashcardStarting
                            ? "Starting..."
                            : "Start →"}
                        </span>
                      </div>
                    </button>
                  )
                )
              )}
            </div>
          </div>
        </div>
      )}

      {showBattleCreator && (
        <div
          onMouseDown={(event) => {
            if (
              event.target ===
              event.currentTarget
            ) {
              setShowBattleCreator(
                false
              );
            }
          }}
          style={{
            position: "fixed",
            inset: 0,
            background:
              "rgba(15,23,42,.75)",
            display: "flex",
            alignItems: "center",
            justifyContent:
              "center",
            zIndex: 1300,
            padding: "20px",
          }}
        >
          <form
            onSubmit={createBattle}
            style={{
              width: "100%",
              maxWidth: "760px",
              maxHeight:
                "88vh",
              overflowY: "auto",
              background: "white",
              borderRadius:
                "24px",
              padding: "24px",
              boxShadow:
                "0 30px 90px rgba(0,0,0,.35)",
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent:
                  "space-between",
                gap: "14px",
                alignItems: "start",
              }}
            >
              <div>
                <p className="card-eyebrow">
                  ⚔️ REVISION BATTLE
                </p>

                <h2>
                  Create a Battle
                </h2>

                <p
                  style={{
                    color:
                      "#64748b",
                  }}
                >
                  Everyone gets the same question
                  at the same time. Correct answers
                  score 100 points.
                </p>
              </div>

              <button
                type="button"
                onClick={() =>
                  setShowBattleCreator(
                    false
                  )
                }
              >
                ✕
              </button>
            </div>

            <div
              style={{
                display: "grid",
                gridTemplateColumns:
                  "minmax(0,1fr) 170px",
                gap: "10px",
                marginTop: "18px",
              }}
            >
              <input
                type="text"
                value={battleTitle}
                onChange={(event) =>
                  setBattleTitle(
                    event.target.value
                  )
                }
                placeholder="Battle title"
              />

              <select
                value={battleSeconds}
                onChange={(event) =>
                  setBattleSeconds(
                    event.target.value
                  )
                }
              >
                <option value="10">
                  10 sec/question
                </option>
                <option value="15">
                  15 sec/question
                </option>
                <option value="20">
                  20 sec/question
                </option>
                <option value="30">
                  30 sec/question
                </option>
                <option value="45">
                  45 sec/question
                </option>
                <option value="60">
                  60 sec/question
                </option>
              </select>
            </div>

            <div
              style={{
                display: "grid",
                gap: "16px",
                marginTop: "20px",
              }}
            >
              {battleDraftQuestions.map(
                (
                  question,
                  questionIndex
                ) => (
                  <div
                    key={
                      questionIndex
                    }
                    style={{
                      padding:
                        "16px",
                      border:
                        "1px solid #e2e8f0",
                      borderRadius:
                        "16px",
                      background:
                        "#f8fafc",
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
                          "10px",
                      }}
                    >
                      <strong>
                        Question{" "}
                        {questionIndex +
                          1}
                      </strong>

                      {battleDraftQuestions.length >
                        1 && (
                        <button
                          type="button"
                          onClick={() =>
                            removeBattleQuestion(
                              questionIndex
                            )
                          }
                        >
                          Remove
                        </button>
                      )}
                    </div>

                    <textarea
                      rows="2"
                      value={
                        question.question_text
                      }
                      onChange={(event) =>
                        updateBattleQuestion(
                          questionIndex,
                          "question_text",
                          event.target
                            .value
                        )
                      }
                      placeholder="Type the question..."
                      style={{
                        width: "100%",
                      }}
                    />

                    <div
                      style={{
                        display:
                          "grid",
                        gridTemplateColumns:
                          "1fr 1fr",
                        gap: "9px",
                        marginTop:
                          "10px",
                      }}
                    >
                      {question.options.map(
                        (
                          option,
                          optionIndex
                        ) => (
                          <label
                            key={
                              optionIndex
                            }
                            style={{
                              display:
                                "flex",
                              gap:
                                "8px",
                              alignItems:
                                "center",
                              padding:
                                "9px",
                              background:
                                "white",
                              borderRadius:
                                "10px",
                              border:
                                question.correct_index ===
                                optionIndex
                                  ? "2px solid #22c55e"
                                  : "1px solid #e2e8f0",
                            }}
                          >
                            <input
                              type="radio"
                              name={`correct-${questionIndex}`}
                              checked={
                                Number(
                                  question.correct_index
                                ) ===
                                optionIndex
                              }
                              onChange={() =>
                                updateBattleQuestion(
                                  questionIndex,
                                  "correct_index",
                                  optionIndex
                                )
                              }
                            />

                            <input
                              type="text"
                              value={
                                option
                              }
                              onChange={(
                                event
                              ) =>
                                updateBattleOption(
                                  questionIndex,
                                  optionIndex,
                                  event
                                    .target
                                    .value
                                )
                              }
                              placeholder={`Option ${String.fromCharCode(
                                65 +
                                  optionIndex
                              )}`}
                              style={{
                                flex:
                                  1,
                              }}
                            />
                          </label>
                        )
                      )}
                    </div>

                    <textarea
                      rows="2"
                      value={
                        question.explanation
                      }
                      onChange={(event) =>
                        updateBattleQuestion(
                          questionIndex,
                          "explanation",
                          event.target
                            .value
                        )
                      }
                      placeholder="Optional explanation shown after the round"
                      style={{
                        width: "100%",
                        marginTop:
                          "10px",
                      }}
                    />
                  </div>
                )
              )}
            </div>

            <button
              type="button"
              onClick={
                addBattleQuestion
              }
              style={{
                marginTop: "14px",
              }}
            >
              ＋ Add Question
            </button>

            <div
              style={{
                display: "flex",
                justifyContent:
                  "flex-end",
                gap: "10px",
                marginTop: "22px",
              }}
            >
              <button
                type="button"
                onClick={() =>
                  setShowBattleCreator(
                    false
                  )
                }
                disabled={
                  battleCreating
                }
              >
                Cancel
              </button>

              <button
                type="submit"
                className="primary-card-button"
                disabled={
                  battleCreating
                }
              >
                {battleCreating
                  ? "Creating..."
                  : "⚔️ Create Battle"}
              </button>
            </div>
          </form>
        </div>
      )}

      {showPaperPicker && (
        <div
          onMouseDown={(event) => {
            if (
              event.target ===
              event.currentTarget
            ) {
              setShowPaperPicker(
                false
              );
            }
          }}
          style={{
            position: "fixed",
            inset: 0,
            background:
              "rgba(15,23,42,.72)",
            display: "flex",
            alignItems: "center",
            justifyContent:
              "center",
            zIndex: 1250,
            padding: "20px",
          }}
        >
          <div
            style={{
              width: "100%",
              maxWidth: "620px",
              maxHeight:
                "82vh",
              overflowY: "auto",
              background: "white",
              borderRadius:
                "22px",
              padding: "24px",
              boxShadow:
                "0 30px 90px rgba(0,0,0,.3)",
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent:
                  "space-between",
                alignItems: "center",
                gap: "14px",
              }}
            >
              <div>
                <p className="card-eyebrow">
                  LIVE STUDY ROOM
                </p>

                <h2>
                  Choose a Shared Past Paper 📄
                </h2>

                <p
                  style={{
                    color: "#64748b",
                    marginTop: "5px",
                  }}
                >
                  Everyone in the room will be able
                  to join the same collaborative copy.
                </p>
              </div>

              <button
                type="button"
                onClick={() =>
                  setShowPaperPicker(
                    false
                  )
                }
              >
                ✕
              </button>
            </div>

            <div
              style={{
                display: "grid",
                gap: "10px",
                marginTop: "20px",
              }}
            >
              {paperPickerLoading ? (
                <div
                  style={{
                    padding: "30px",
                    textAlign: "center",
                    color: "#64748b",
                  }}
                >
                  Loading your past papers...
                </div>
              ) : pastPapers.length === 0 ? (
                <div
                  style={{
                    padding: "30px",
                    textAlign: "center",
                    color: "#64748b",
                    background: "#f8fafc",
                    borderRadius: "14px",
                  }}
                >
                  <div
                    style={{
                      fontSize: "34px",
                    }}
                  >
                    📄
                  </div>

                  <strong>
                    No uploaded past papers yet
                  </strong>

                  <div
                    style={{
                      marginTop: "6px",
                    }}
                  >
                    Upload one from the Past Papers
                    page first.
                  </div>
                </div>
              ) : (
                pastPapers.map(
                  (paper) => (
                    <button
                      key={paper.id}
                      type="button"
                      disabled={
                        paperLaunching
                      }
                      onClick={() =>
                        launchSharedPaper(
                          paper
                        )
                      }
                      style={{
                        width: "100%",
                        textAlign: "left",
                        padding: "14px 16px",
                        border:
                          "1px solid #e2e8f0",
                        borderRadius: "14px",
                        background: "white",
                        cursor:
                          paperLaunching
                            ? "not-allowed"
                            : "pointer",
                        opacity:
                          paperLaunching
                            ? 0.7
                            : 1,
                      }}
                    >
                      <div
                        style={{
                          display: "flex",
                          justifyContent:
                            "space-between",
                          gap: "14px",
                          alignItems: "center",
                        }}
                      >
                        <div>
                          <strong>
                            📄 {paper.name}
                          </strong>

                          <div
                            style={{
                              marginTop: "4px",
                              fontSize: "12px",
                              color: "#64748b",
                            }}
                          >
                            {paper.created_at
                              ? `Uploaded ${new Date(
                                  paper.created_at
                                ).toLocaleDateString()}`
                              : "Past paper"}
                          </div>
                        </div>

                        <span>
                          {paperLaunching
                            ? "Starting..."
                            : "Start →"}
                        </span>
                      </div>
                    </button>
                  )
                )
              )}
            </div>
          </div>
        </div>
      )}

      {showInviteFriends && (
        <div
          onMouseDown={(event) => {
            if (
              event.target ===
              event.currentTarget
            ) {
              setShowInviteFriends(
                false
              );
            }
          }}
          style={{
            position: "fixed",
            inset: 0,
            background:
              "rgba(15,23,42,.68)",
            display: "flex",
            alignItems: "center",
            justifyContent:
              "center",
            zIndex: 1200,
            padding: "20px",
          }}
        >
          <div
            style={{
              width: "100%",
              maxWidth: "520px",
              maxHeight:
                "80vh",
              overflowY: "auto",
              background: "white",
              borderRadius:
                "22px",
              padding: "24px",
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent:
                  "space-between",
                gap: "12px",
                alignItems: "center",
              }}
            >
              <div>
                <p className="card-eyebrow">
                  STUDY TOGETHER
                </p>

                <h2>
                  Invite Friends 👥
                </h2>
              </div>

              <button
                type="button"
                onClick={() =>
                  setShowInviteFriends(
                    false
                  )
                }
              >
                ✕
              </button>
            </div>

            <div
              style={{
                display: "grid",
                gap: "10px",
                marginTop: "18px",
              }}
            >
              {friends.length === 0 ? (
                <div
                  style={{
                    padding:
                      "25px",
                    textAlign:
                      "center",
                    color:
                      "#64748b",
                  }}
                >
                  Add some friends first, then invite
                  them here.
                </div>
              ) : (
                friends.map(
                  (friend) => {
                    const alreadyMember =
                      members.some(
                        (member) =>
                          member.user_id ===
                          friend.id
                      );

                    const invited =
                      invitedIds.has(
                        friend.id
                      );

                    return (
                      <div
                        key={friend.id}
                        style={{
                          display:
                            "flex",
                          justifyContent:
                            "space-between",
                          alignItems:
                            "center",
                          gap: "12px",
                          padding:
                            "12px",
                          border:
                            "1px solid #e2e8f0",
                          borderRadius:
                            "14px",
                        }}
                      >
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
                            }}
                          >
                            {friend.school_email ||
                              ""}
                          </div>
                        </div>

                        <button
                          type="button"
                          disabled={
                            alreadyMember ||
                            inviteLoading ===
                              friend.id
                          }
                          onClick={() =>
                            inviteFriend(
                              friend.id
                            )
                          }
                        >
                          {alreadyMember
                            ? "🟢 In room"
                            : inviteLoading ===
                              friend.id
                            ? "Sending..."
                            : invited
                            ? "↻ Invite again"
                            : "Invite"}
                        </button>
                      </div>
                    );
                  }
                )
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default StudyRoom;
