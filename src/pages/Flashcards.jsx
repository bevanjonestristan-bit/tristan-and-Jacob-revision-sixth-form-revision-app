import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";

function Flashcards({ setPage }) {
  const [currentUser, setCurrentUser] = useState(null);

  const [decks, setDecks] = useState([]);
  const [cards, setCards] = useState([]);

  const [selectedDeck, setSelectedDeck] = useState(null);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const [showDeckForm, setShowDeckForm] = useState(false);
  const [showCardForm, setShowCardForm] = useState(false);

  const [deckName, setDeckName] = useState("");
  const [deckSubject, setDeckSubject] = useState("");
  const [deckDescription, setDeckDescription] = useState("");

  const [cardFront, setCardFront] = useState("");
  const [cardBack, setCardBack] = useState("");

  const [editingCard, setEditingCard] = useState(null);

  const [studyMode, setStudyMode] = useState(false);
  const [studyCards, setStudyCards] = useState([]);
  const [studyIndex, setStudyIndex] = useState(0);
  const [showAnswer, setShowAnswer] = useState(false);

  useEffect(() => {
    loadFlashcards();
  }, []);

  async function loadFlashcards() {
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

      const {
        data: deckData,
        error: deckError,
      } = await supabase
        .from("user_flashcard_decks")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", {
          ascending: false,
        });

      if (deckError) {
        throw deckError;
      }

      const {
        data: cardData,
        error: cardError,
      } = await supabase
        .from("user_flashcards")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", {
          ascending: true,
        });

      if (cardError) {
        throw cardError;
      }

      setDecks(deckData || []);
      setCards(cardData || []);
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
      setLoading(false);
    }
  }

  function getDeckCards(deckId) {
    return cards.filter(
      (card) => card.deck_id === deckId
    );
  }

  async function createDeck(event) {
    event.preventDefault();

    if (!currentUser) {
      return;
    }

    if (!deckName.trim()) {
      setError("Please enter a deck name.");
      return;
    }

    try {
      setSaving(true);
      setError("");

      const {
        data,
        error: insertError,
      } = await supabase
        .from("user_flashcard_decks")
        .insert({
          user_id: currentUser.id,
          name: deckName.trim(),
          subject:
            deckSubject.trim() || null,
          description:
            deckDescription.trim() || null,
        })
        .select()
        .single();

      if (insertError) {
        throw insertError;
      }

      setDecks((previous) => [
        data,
        ...previous,
      ]);

      setDeckName("");
      setDeckSubject("");
      setDeckDescription("");
      setShowDeckForm(false);

      setSelectedDeck(data);
    } catch (err) {
      console.error(
        "Could not create deck:",
        err
      );

      setError(
        err?.message ||
          "Could not create the deck."
      );
    } finally {
      setSaving(false);
    }
  }

  async function deleteDeck(deckId) {
    const confirmed = window.confirm(
      "Delete this deck and all of its flashcards?"
    );

    if (!confirmed) {
      return;
    }

    try {
      setError("");

      const {
        error: deleteError,
      } = await supabase
        .from("user_flashcard_decks")
        .delete()
        .eq("id", deckId)
        .eq("user_id", currentUser.id);

      if (deleteError) {
        throw deleteError;
      }

      setDecks((previous) =>
        previous.filter(
          (deck) => deck.id !== deckId
        )
      );

      setCards((previous) =>
        previous.filter(
          (card) => card.deck_id !== deckId
        )
      );

      if (selectedDeck?.id === deckId) {
        setSelectedDeck(null);
      }
    } catch (err) {
      console.error(
        "Could not delete deck:",
        err
      );

      setError(
        err?.message ||
          "Could not delete the deck."
      );
    }
  }

  function openNewCardForm() {
    setEditingCard(null);
    setCardFront("");
    setCardBack("");
    setShowCardForm(true);
  }

  function openEditCard(card) {
    setEditingCard(card);
    setCardFront(card.front);
    setCardBack(card.back);
    setShowCardForm(true);
  }

  async function saveCard(event) {
    event.preventDefault();

    if (!currentUser || !selectedDeck) {
      return;
    }

    if (!cardFront.trim() || !cardBack.trim()) {
      setError(
        "Please enter both the front and back of the card."
      );
      return;
    }

    try {
      setSaving(true);
      setError("");

      if (editingCard) {
        const {
          data,
          error: updateError,
        } = await supabase
          .from("user_flashcards")
          .update({
            front: cardFront.trim(),
            back: cardBack.trim(),
            updated_at: new Date().toISOString(),
          })
          .eq("id", editingCard.id)
          .eq("user_id", currentUser.id)
          .select()
          .single();

        if (updateError) {
          throw updateError;
        }

        setCards((previous) =>
          previous.map((card) =>
            card.id === editingCard.id
              ? data
              : card
          )
        );
      } else {
        const {
          data,
          error: insertError,
        } = await supabase
          .from("user_flashcards")
          .insert({
            deck_id: selectedDeck.id,
            user_id: currentUser.id,
            front: cardFront.trim(),
            back: cardBack.trim(),
          })
          .select()
          .single();

        if (insertError) {
          throw insertError;
        }

        setCards((previous) => [
          ...previous,
          data,
        ]);
      }

      setCardFront("");
      setCardBack("");
      setEditingCard(null);
      setShowCardForm(false);
    } catch (err) {
      console.error(
        "Could not save flashcard:",
        err
      );

      setError(
        err?.message ||
          "Could not save the flashcard."
      );
    } finally {
      setSaving(false);
    }
  }

  async function deleteCard(cardId) {
    const confirmed = window.confirm(
      "Delete this flashcard?"
    );

    if (!confirmed) {
      return;
    }

    try {
      setError("");

      const {
        error: deleteError,
      } = await supabase
        .from("user_flashcards")
        .delete()
        .eq("id", cardId)
        .eq("user_id", currentUser.id);

      if (deleteError) {
        throw deleteError;
      }

      setCards((previous) =>
        previous.filter(
          (card) => card.id !== cardId
        )
      );
    } catch (err) {
      console.error(
        "Could not delete flashcard:",
        err
      );

      setError(
        err?.message ||
          "Could not delete the flashcard."
      );
    }
  }

  function startStudying() {
    if (!selectedDeck) {
      return;
    }

    const deckCards = getDeckCards(
      selectedDeck.id
    );

    if (deckCards.length === 0) {
      setError(
        "Add some flashcards before starting a study session."
      );
      return;
    }

    const shuffled = [...deckCards].sort(
      () => Math.random() - 0.5
    );

    setStudyCards(shuffled);
    setStudyIndex(0);
    setShowAnswer(false);
    setStudyMode(true);
    setError("");
  }

  function nextStudyCard() {
    if (
      studyIndex <
      studyCards.length - 1
    ) {
      setStudyIndex(
        (previous) => previous + 1
      );
      setShowAnswer(false);
    } else {
      setStudyMode(false);
      setShowAnswer(false);
      setStudyCards([]);
      setStudyIndex(0);
    }
  }

  function previousStudyCard() {
    if (studyIndex > 0) {
      setStudyIndex(
        (previous) => previous - 1
      );
      setShowAnswer(false);
    }
  }

  function exitStudyMode() {
    setStudyMode(false);
    setStudyCards([]);
    setStudyIndex(0);
    setShowAnswer(false);
  }

  if (loading) {
    return (
      <div className="no-subjects">
        <div className="no-subjects-icon">
          🃏
        </div>

        <h2>
          Loading Flashcards...
        </h2>

        <p>
          Getting your flashcard decks ready.
        </p>
      </div>
    );
  }

  /*
   * STUDY MODE
   */

  if (studyMode) {
    const currentCard =
      studyCards[studyIndex];

    const progress =
      studyCards.length > 0
        ? ((studyIndex + 1) /
            studyCards.length) *
          100
        : 0;

    return (
      <div className="study-hub">

        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: "25px",
          }}
        >
          <div>
            <p className="card-eyebrow">
              STUDY MODE
            </p>

            <h2>
              {selectedDeck?.name} 🃏
            </h2>
          </div>

          <button
            type="button"
            className="primary-card-button"
            onClick={exitStudyMode}
          >
            ✕ Exit
          </button>
        </div>

        <div
          style={{
            height: "8px",
            background: "#e2e8f0",
            borderRadius: "999px",
            overflow: "hidden",
            marginBottom: "15px",
          }}
        >
          <div
            style={{
              width: `${progress}%`,
              height: "100%",
              background: "#4f46e5",
              transition:
                "width 0.2s ease",
            }}
          />
        </div>

        <p
          style={{
            textAlign: "center",
            color: "#64748b",
            marginBottom: "25px",
          }}
        >
          Card {studyIndex + 1} of{" "}
          {studyCards.length}
        </p>

        <div
          style={{
            maxWidth: "750px",
            margin: "0 auto",
          }}
        >
          <div
            style={{
              minHeight: "350px",
              background: "white",
              borderRadius: "24px",
              border: "1px solid #e2e8f0",
              padding: "45px",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              textAlign: "center",
              boxShadow:
                "0 15px 40px rgba(15,23,42,0.08)",
            }}
          >
            <p
              style={{
                fontSize: "12px",
                fontWeight: 700,
                letterSpacing: "0.08em",
                color: "#64748b",
              }}
            >
              QUESTION
            </p>

            <div
              style={{
                fontSize: "25px",
                fontWeight: 700,
                lineHeight: 1.5,
                marginTop: "20px",
              }}
            >
              {currentCard.front}
            </div>

            {showAnswer && (
              <div
                style={{
                  width: "100%",
                  marginTop: "35px",
                  paddingTop: "30px",
                  borderTop:
                    "1px solid #e2e8f0",
                }}
              >
                <p
                  style={{
                    fontSize: "12px",
                    fontWeight: 700,
                    letterSpacing:
                      "0.08em",
                    color: "#4f46e5",
                  }}
                >
                  ANSWER
                </p>

                <div
                  style={{
                    fontSize: "20px",
                    lineHeight: 1.6,
                    marginTop: "12px",
                    color: "#334155",
                  }}
                >
                  {currentCard.back}
                </div>
              </div>
            )}

            {!showAnswer && (
              <button
                type="button"
                className="primary-card-button"
                style={{
                  marginTop: "35px",
                }}
                onClick={() =>
                  setShowAnswer(true)
                }
              >
                👀 Reveal Answer
              </button>
            )}
          </div>

          {showAnswer && (
            <div
              style={{
                display: "flex",
                justifyContent: "center",
                gap: "12px",
                marginTop: "20px",
              }}
            >
              <button
                type="button"
                onClick={
                  previousStudyCard
                }
                disabled={studyIndex === 0}
                style={{
                  border:
                    "1px solid #e2e8f0",
                  background: "white",
                  borderRadius: "12px",
                  padding: "12px 20px",
                  cursor:
                    studyIndex === 0
                      ? "not-allowed"
                      : "pointer",
                }}
              >
                ← Previous
              </button>

              <button
                type="button"
                className="primary-card-button"
                onClick={
                  nextStudyCard
                }
              >
                {studyIndex ===
                studyCards.length - 1
                  ? "Finish 🎉"
                  : "Next →"}
              </button>
            </div>
          )}
        </div>
      </div>
    );
  }

  /*
   * MAIN FLASHCARD PAGE
   */

  return (
    <div className="study-hub">

      {/* HEADER */}

      <div
        className="revision-header"
      >
        <div>
          <p className="card-eyebrow">
            YOUR REVISION
          </p>

          <h2>
            Flashcards 🃏
          </h2>

          <p className="revision-description">
            Create your own flashcards and
            study them whenever you want.
          </p>
        </div>

        <button
          type="button"
          className="manage-subjects-button"
          onClick={() =>
            setShowDeckForm(true)
          }
        >
          ➕ Create Deck
        </button>
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

            <p>{error}</p>
          </div>
        </div>
      )}

      {/* DECK LIST */}

      {!selectedDeck && (
        <>
          <div className="revision-section-heading">
            <div>
              <h3>
                📚 Your Decks
              </h3>

              <p>
                {decks.length === 0
                  ? "You haven't created any decks yet."
                  : `${decks.length} ${
                      decks.length === 1
                        ? "deck"
                        : "decks"
                    }`}
              </p>
            </div>
          </div>

          {decks.length === 0 ? (
            <div className="no-subjects">
              <div className="no-subjects-icon">
                🃏
              </div>

              <h3>
                No flashcard decks yet
              </h3>

              <p>
                Create your first deck to
                start making flashcards.
              </p>

              <button
                type="button"
                className="primary-card-button"
                onClick={() =>
                  setShowDeckForm(true)
                }
              >
                ➕ Create Your First Deck
              </button>
            </div>
          ) : (
            <div className="revision-subject-grid">
              {decks.map((deck) => {
                const deckCardCount =
                  getDeckCards(
                    deck.id
                  ).length;

                return (
                  <div
                    key={deck.id}
                    className="revision-subject-card"
                  >
                    <div className="revision-subject-top">
                      <div className="revision-subject-icon">
                        🃏
                      </div>

                      <div>
                        {deckCardCount}{" "}
                        {deckCardCount ===
                        1
                          ? "card"
                          : "cards"}
                      </div>
                    </div>

                    <div className="revision-subject-content">
                      <h3>
                        {deck.name}
                      </h3>

                      {deck.subject && (
                        <p>
                          📚 {deck.subject}
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

                    <div
                      style={{
                        display: "flex",
                        flexDirection:
                          "column",
                        gap: "10px",
                        marginTop:
                          "18px",
                      }}
                    >
                      <button
                        type="button"
                        className="primary-card-button"
                        onClick={() =>
                          setSelectedDeck(
                            deck
                          )
                        }
                      >
                        Open Deck →
                      </button>

                      {deckCardCount >
                        0 && (
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedDeck(
                              deck
                            );

                            setTimeout(
                              () => {
                                const deckCards =
                                  getDeckCards(
                                    deck.id
                                  );

                                if (
                                  deckCards.length >
                                  0
                                ) {
                                  const shuffled =
                                    [
                                      ...deckCards,
                                    ].sort(
                                      () =>
                                        Math.random() -
                                        0.5
                                    );

                                  setStudyCards(
                                    shuffled
                                  );
                                  setStudyIndex(
                                    0
                                  );
                                  setShowAnswer(
                                    false
                                  );
                                  setStudyMode(
                                    true
                                  );
                                }
                              },
                              0
                            );
                          }}
                          style={{
                            border:
                              "1px solid #e2e8f0",
                            background:
                              "white",
                            borderRadius:
                              "10px",
                            padding:
                              "10px",
                            cursor:
                              "pointer",
                            fontWeight:
                              600,
                          }}
                        >
                          ▶️ Study Deck
                        </button>
                      )}

                      <button
                        type="button"
                        onClick={() =>
                          deleteDeck(
                            deck.id
                          )
                        }
                        style={{
                          border: "none",
                          background:
                            "transparent",
                          color:
                            "#ef4444",
                          cursor:
                            "pointer",
                          padding: "8px",
                        }}
                      >
                        🗑️ Delete Deck
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}

      {/* SELECTED DECK */}

      {selectedDeck && !studyMode && (
        <div>

          <button
            type="button"
            onClick={() =>
              setSelectedDeck(null)
            }
            style={{
              border: "none",
              background: "transparent",
              padding: 0,
              cursor: "pointer",
              fontWeight: 600,
              marginBottom: "15px",
            }}
          >
            ← Back to Decks
          </button>

          <div
            className="revision-header"
            style={{
              marginTop: "10px",
            }}
          >
            <div>
              <p className="card-eyebrow">
                FLASHCARD DECK
              </p>

              <h2>
                {selectedDeck.name} 🃏
              </h2>

              {selectedDeck.subject && (
                <p className="revision-description">
                  📚{" "}
                  {selectedDeck.subject}
                </p>
              )}

              {selectedDeck.description && (
                <p
                  className="revision-description"
                >
                  {
                    selectedDeck.description
                  }
                </p>
              )}
            </div>

            <div
              style={{
                display: "flex",
                gap: "10px",
                flexWrap: "wrap",
              }}
            >
              <button
                type="button"
                className="manage-subjects-button"
                onClick={
                  openNewCardForm
                }
              >
                ➕ Add Card
              </button>

              {getDeckCards(
                selectedDeck.id
              ).length > 0 && (
                <button
                  type="button"
                  className="primary-card-button"
                  onClick={
                    startStudying
                  }
                >
                  ▶️ Study
                </button>
              )}
            </div>
          </div>

          {/* CARD COUNT */}

          <div
            style={{
              padding: "15px 18px",
              background: "#f8fafc",
              borderRadius: "14px",
              marginBottom: "20px",
            }}
          >
            🃏{" "}
            <strong>
              {
                getDeckCards(
                  selectedDeck.id
                ).length
              }
            </strong>{" "}
            {getDeckCards(
              selectedDeck.id
            ).length === 1
              ? "flashcard"
              : "flashcards"}
          </div>

          {/* CARDS */}

          {getDeckCards(
            selectedDeck.id
          ).length === 0 ? (
            <div className="no-subjects">
              <div className="no-subjects-icon">
                📝
              </div>

              <h3>
                No cards yet
              </h3>

              <p>
                Add your first flashcard to
                this deck.
              </p>

              <button
                type="button"
                className="primary-card-button"
                onClick={
                  openNewCardForm
                }
              >
                ➕ Add First Card
              </button>
            </div>
          ) : (
            <div
              style={{
                display: "flex",
                flexDirection:
                  "column",
                gap: "15px",
              }}
            >
              {getDeckCards(
                selectedDeck.id
              ).map(
                (card, index) => (
                  <div
                    key={card.id}
                    style={{
                      background:
                        "white",
                      border:
                        "1px solid #e2e8f0",
                      borderRadius:
                        "18px",
                      padding:
                        "20px",
                    }}
                  >
                    <div
                      style={{
                        display:
                          "flex",
                        justifyContent:
                          "space-between",
                        gap: "20px",
                      }}
                    >
                      <div
                        style={{
                          flex: 1,
                        }}
                      >
                        <p
                          className="card-eyebrow"
                        >
                          CARD {index + 1}
                        </p>

                        <h3>
                          {card.front}
                        </h3>

                        <div
                          style={{
                            marginTop:
                              "15px",
                            padding:
                              "15px",
                            borderRadius:
                              "12px",
                            background:
                              "#f8fafc",
                            color:
                              "#475569",
                          }}
                        >
                          <strong>
                            Answer
                          </strong>

                          <p
                            style={{
                              marginBottom: 0,
                            }}
                          >
                            {
                              card.back
                            }
                          </p>
                        </div>
                      </div>

                      <div
                        style={{
                          display:
                            "flex",
                          flexDirection:
                            "column",
                          gap: "8px",
                        }}
                      >
                        <button
                          type="button"
                          onClick={() =>
                            openEditCard(
                              card
                            )
                          }
                          style={{
                            border:
                              "1px solid #e2e8f0",
                            background:
                              "white",
                            borderRadius:
                              "10px",
                            padding:
                              "9px 12px",
                            cursor:
                              "pointer",
                          }}
                        >
                          ✏️ Edit
                        </button>

                        <button
                          type="button"
                          onClick={() =>
                            deleteCard(
                              card.id
                            )
                          }
                          style={{
                            border:
                              "none",
                            background:
                              "transparent",
                            color:
                              "#ef4444",
                            padding:
                              "8px",
                            cursor:
                              "pointer",
                          }}
                        >
                          🗑️ Delete
                        </button>
                      </div>
                    </div>
                  </div>
                )
              )}
            </div>
          )}
        </div>
      )}

      {/* CREATE DECK MODAL */}

      {showDeckForm && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background:
              "rgba(0,0,0,0.55)",
            display: "flex",
            alignItems:
              "center",
            justifyContent:
              "center",
            zIndex: 1000,
            padding: "20px",
          }}
        >
          <div
            style={{
              width: "100%",
              maxWidth: "500px",
              background: "white",
              borderRadius: "20px",
              padding: "30px",
              boxShadow:
                "0 20px 60px rgba(0,0,0,0.25)",
            }}
          >
            <h2>
              Create Flashcard Deck
            </h2>

            <p>
              Create a deck for a topic you
              want to revise.
            </p>

            <form
              onSubmit={createDeck}
            >
              <input
                type="text"
                placeholder="Deck name"
                value={deckName}
                onChange={(event) =>
                  setDeckName(
                    event.target.value
                  )
                }
                required
              />

              <input
                type="text"
                placeholder="Subject (optional)"
                value={deckSubject}
                onChange={(event) =>
                  setDeckSubject(
                    event.target.value
                  )
                }
              />

              <textarea
                placeholder="Description (optional)"
                value={
                  deckDescription
                }
                onChange={(event) =>
                  setDeckDescription(
                    event.target.value
                  )
                }
                rows={4}
              />

              <div
                style={{
                  display:
                    "flex",
                  gap: "10px",
                  marginTop:
                    "15px",
                }}
              >
                <button
                  type="button"
                  onClick={() =>
                    setShowDeckForm(
                      false
                    )
                  }
                  style={{
                    flex: 1,
                    border:
                      "1px solid #e2e8f0",
                    background:
                      "white",
                    borderRadius:
                      "10px",
                    padding:
                      "12px",
                    cursor:
                      "pointer",
                  }}
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  className="primary-card-button"
                  disabled={
                    saving
                  }
                  style={{
                    flex: 1,
                  }}
                >
                  {saving
                    ? "Creating..."
                    : "Create Deck"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* CREATE / EDIT CARD MODAL */}

      {showCardForm && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background:
              "rgba(0,0,0,0.55)",
            display: "flex",
            alignItems:
              "center",
            justifyContent:
              "center",
            zIndex: 1000,
            padding: "20px",
          }}
        >
          <div
            style={{
              width: "100%",
              maxWidth: "600px",
              background: "white",
              borderRadius: "20px",
              padding: "30px",
              boxShadow:
                "0 20px 60px rgba(0,0,0,0.25)",
            }}
          >
            <h2>
              {editingCard
                ? "Edit Flashcard"
                : "Add Flashcard"}
            </h2>

            <p>
              Write the question on the front
              and the answer on the back.
            </p>

            <form
              onSubmit={saveCard}
            >
              <label
                style={{
                  display:
                    "block",
                  fontWeight:
                    700,
                  marginBottom:
                    "8px",
                }}
              >
                Front / Question
              </label>

              <textarea
                placeholder="e.g. What is the quadratic formula?"
                value={cardFront}
                onChange={(event) =>
                  setCardFront(
                    event.target.value
                  )
                }
                rows={5}
                required
                style={{
                  width: "100%",
                  boxSizing:
                    "border-box",
                  marginBottom:
                    "20px",
                }}
              />

              <label
                style={{
                  display:
                    "block",
                  fontWeight:
                    700,
                  marginBottom:
                    "8px",
                }}
              >
                Back / Answer
              </label>

              <textarea
                placeholder="e.g. x = (-b ± √(b² - 4ac)) / 2a"
                value={cardBack}
                onChange={(event) =>
                  setCardBack(
                    event.target.value
                  )
                }
                rows={6}
                required
                style={{
                  width: "100%",
                  boxSizing:
                    "border-box",
                }}
              />

              <div
                style={{
                  display:
                    "flex",
                  gap: "10px",
                  marginTop:
                    "20px",
                }}
              >
                <button
                  type="button"
                  onClick={() => {
                    setShowCardForm(
                      false
                    );
                    setEditingCard(
                      null
                    );
                  }}
                  style={{
                    flex: 1,
                    border:
                      "1px solid #e2e8f0",
                    background:
                      "white",
                    borderRadius:
                      "10px",
                    padding:
                      "12px",
                    cursor:
                      "pointer",
                  }}
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  className="primary-card-button"
                  disabled={
                    saving
                  }
                  style={{
                    flex: 1,
                  }}
                >
                  {saving
                    ? "Saving..."
                    : editingCard
                    ? "Save Changes"
                    : "Add Card"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default Flashcards;