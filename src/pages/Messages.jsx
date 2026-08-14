import { useEffect, useRef, useState } from "react";
import { supabase } from "../lib/supabase";

function Messages({ setPage, selectedFriend }) {
  const [user, setUser] = useState(null);
  const [friends, setFriends] = useState([]);
  const [selectedUser, setSelectedUser] = useState(
    selectedFriend || null
  );

  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState("");

  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");

  const messagesEndRef = useRef(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({
      behavior: "smooth",
    });
  }, [messages]);

  useEffect(() => {
    loadMessagesPage();
  }, []);

  useEffect(() => {
    if (!user || !selectedUser) {
      return;
    }

    loadConversation();

    const channelName = `messages-${user.id}-${selectedUser.id}`;

    const channel = supabase
      .channel(channelName)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
        },
        (payload) => {
          const message = payload.new;

          const belongsToConversation =
            (message.sender_id === user.id &&
              message.receiver_id === selectedUser.id) ||
            (message.sender_id === selectedUser.id &&
              message.receiver_id === user.id);

          if (!belongsToConversation) {
            return;
          }

          setMessages((currentMessages) => {
            const alreadyExists = currentMessages.some(
              (existingMessage) =>
                existingMessage.id === message.id
            );

            if (alreadyExists) {
              return currentMessages;
            }

            return [...currentMessages, message];
          });
        }
      )
      .subscribe((status) => {
        console.log(
          `Realtime channel ${channelName}:`,
          status
        );
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, selectedUser]);

  async function loadMessagesPage() {
    try {
      setLoading(true);
      setError("");

      const {
        data: { user: currentUser },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError) {
        throw userError;
      }

      if (!currentUser) {
        setPage("login");
        return;
      }

      setUser(currentUser);

      const {
        data: profiles,
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

      const {
        data: friendships,
        error: friendshipError,
      } = await supabase
        .from("friend_requests")
        .select(
          "id, sender_id, receiver_id, status"
        )
        .eq("status", "accepted")
        .or(
          `sender_id.eq.${currentUser.id},receiver_id.eq.${currentUser.id}`
        );

      if (friendshipError) {
        throw friendshipError;
      }

      const friendIds = [];

      (friendships || []).forEach((friendship) => {
        if (
          friendship.sender_id ===
          currentUser.id
        ) {
          friendIds.push(
            friendship.receiver_id
          );
        }

        if (
          friendship.receiver_id ===
          currentUser.id
        ) {
          friendIds.push(
            friendship.sender_id
          );
        }
      });

      const myFriends = (profiles || []).filter(
        (profile) =>
          friendIds.includes(profile.id)
      );

      setFriends(myFriends);

      if (selectedFriend) {
        const matchingFriend =
          myFriends.find(
            (friend) =>
              friend.id ===
              selectedFriend.id
          );

        if (matchingFriend) {
          setSelectedUser(matchingFriend);
        }
      }

      if (
        !selectedFriend &&
        myFriends.length > 0
      ) {
        setSelectedUser(myFriends[0]);
      }
    } catch (err) {
      console.error(
        "Could not load messages:",
        err
      );

      setError(
        err?.message ||
          "Could not load messages."
      );
    } finally {
      setLoading(false);
    }
  }

  async function loadConversation() {
    if (!user || !selectedUser) {
      return;
    }

    try {
      setError("");

      const {
        data,
        error: messageError,
      } = await supabase
        .from("messages")
        .select(
          "id, sender_id, receiver_id, content, created_at"
        )
        .or(
          `and(sender_id.eq.${user.id},receiver_id.eq.${selectedUser.id}),and(sender_id.eq.${selectedUser.id},receiver_id.eq.${user.id})`
        )
        .order("created_at", {
          ascending: true,
        });

      if (messageError) {
        throw messageError;
      }

      setMessages(data || []);
    } catch (err) {
      console.error(
        "Could not load conversation:",
        err
      );

      setError(
        err?.message ||
          "Could not load conversation."
      );
    }
  }

  async function sendMessage(event) {
    event.preventDefault();

    const text = newMessage.trim();

    if (
      !text ||
      !user ||
      !selectedUser ||
      sending
    ) {
      return;
    }

    try {
      setSending(true);
      setError("");

      const {
        data,
        error: sendError,
      } = await supabase
        .from("messages")
        .insert({
          sender_id: user.id,
          receiver_id: selectedUser.id,
          content: text,
        })
        .select(
          "id, sender_id, receiver_id, content, created_at"
        )
        .single();

      if (sendError) {
        throw sendError;
      }

      setMessages((currentMessages) => {
        const alreadyExists =
          currentMessages.some(
            (message) =>
              message.id === data.id
          );

        if (alreadyExists) {
          return currentMessages;
        }

        return [...currentMessages, data];
      });

      setNewMessage("");
    } catch (err) {
      console.error(
        "Could not send message:",
        err
      );

      setError(
        err?.message ||
          "Could not send message."
      );
    } finally {
      setSending(false);
    }
  }

  function formatTime(date) {
    return new Date(date).toLocaleTimeString(
      [],
      {
        hour: "2-digit",
        minute: "2-digit",
      }
    );
  }

  if (loading) {
    return (
      <div className="no-subjects">
        <div className="no-subjects-icon">
          💬
        </div>

        <h3>
          Loading messages...
        </h3>

        <p>
          Getting your conversations ready.
        </p>
      </div>
    );
  }

  return (
    <div>
      <div className="revision-header">
        <div>
          <p className="card-eyebrow">
            MONMOUTH SIXTH FORM
          </p>

          <h2>
            Messages 💬
          </h2>

          <p className="revision-description">
            Chat with your friends and
            study together.
          </p>
        </div>
      </div>

      {error && (
        <div className="auth-error">
          {error}
        </div>
      )}

      {friends.length === 0 ? (
        <div className="no-subjects">
          <div className="no-subjects-icon">
            👥
          </div>

          <h3>
            No friends yet
          </h3>

          <p>
            Add some friends before
            starting a conversation.
          </p>

          <button
            type="button"
            className="primary-card-button"
            onClick={() =>
              setPage("friends")
            }
          >
            Find Friends
          </button>
        </div>
      ) : (
        <div
          style={{
            display: "grid",
            gridTemplateColumns:
              "280px 1fr",
            gap: "20px",
            minHeight: "500px",
          }}
        >
          <div
            style={{
              background: "white",
              borderRadius: "18px",
              border:
                "1px solid #e2e8f0",
              padding: "15px",
            }}
          >
            <h3
              style={{
                margin:
                  "5px 5px 15px",
              }}
            >
              Conversations
            </h3>

            {friends.map((friend) => {
              const selected =
                selectedUser?.id ===
                friend.id;

              return (
                <button
                  key={friend.id}
                  type="button"
                  onClick={() => {
                    setSelectedUser(
                      friend
                    );
                    setMessages([]);
                    setError("");
                  }}
                  style={{
                    width: "100%",
                    border: "none",
                    borderRadius: "12px",
                    padding: "12px",
                    marginBottom: "6px",
                    textAlign: "left",
                    cursor: "pointer",
                    background:
                      selected
                        ? "#eef2ff"
                        : "transparent",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
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
                        display: "flex",
                        alignItems:
                          "center",
                        justifyContent:
                          "center",
                        background:
                          "#e0e7ff",
                        fontSize: "20px",
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
                            "3px",
                        }}
                      >
                        {friend.year_group ||
                          "Sixth Form"}
                      </div>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>

          <div
            style={{
              background: "white",
              borderRadius: "18px",
              border:
                "1px solid #e2e8f0",
              display: "flex",
              flexDirection:
                "column",
              overflow: "hidden",
            }}
          >
            {selectedUser ? (
              <>
                <div
                  style={{
                    padding:
                      "18px 20px",
                    borderBottom:
                      "1px solid #e2e8f0",
                    display: "flex",
                    alignItems:
                      "center",
                    gap: "12px",
                  }}
                >
                  <div
                    style={{
                      width: "45px",
                      height: "45px",
                      borderRadius:
                        "50%",
                      background:
                        "#e0e7ff",
                      display: "flex",
                      alignItems:
                        "center",
                      justifyContent:
                        "center",
                      fontSize: "21px",
                    }}
                  >
                    👤
                  </div>

                  <div>
                    <strong>
                      {selectedUser.full_name ||
                        "Student"}
                    </strong>

                    <div
                      style={{
                        fontSize:
                          "13px",
                        color:
                          "#64748b",
                        marginTop:
                          "2px",
                      }}
                    >
                      {selectedUser.year_group ||
                        "Sixth Form"}
                    </div>
                  </div>

                  <div
                    style={{
                      marginLeft:
                        "auto",
                      display: "flex",
                      alignItems:
                        "center",
                      gap: "6px",
                      color:
                        "#16a34a",
                      fontSize: "11px",
                      fontWeight: "700",
                    }}
                  >
                    <span>●</span>
                    LIVE
                  </div>
                </div>

                <div
                  style={{
                    flex: 1,
                    padding: "20px",
                    overflowY: "auto",
                    minHeight:
                      "350px",
                    display: "flex",
                    flexDirection:
                      "column",
                    gap: "10px",
                  }}
                >
                  {messages.length ===
                  0 ? (
                    <div
                      style={{
                        margin:
                          "auto",
                        textAlign:
                          "center",
                        color:
                          "#64748b",
                      }}
                    >
                      <div
                        style={{
                          fontSize:
                            "35px",
                          marginBottom:
                            "10px",
                        }}
                      >
                        💬
                      </div>

                      <strong>
                        No messages yet
                      </strong>

                      <p>
                        Start the
                        conversation!
                      </p>
                    </div>
                  ) : (
                    messages.map(
                      (message) => {
                        const mine =
                          message.sender_id ===
                          user.id;

                        return (
                          <div
                            key={
                              message.id
                            }
                            style={{
                              display:
                                "flex",
                              justifyContent:
                                mine
                                  ? "flex-end"
                                  : "flex-start",
                            }}
                          >
                            <div
                              style={{
                                maxWidth:
                                  "70%",
                                padding:
                                  "10px 14px",
                                borderRadius:
                                  "15px",
                                background:
                                  mine
                                    ? "#4f46e5"
                                    : "#f1f5f9",
                                color:
                                  mine
                                    ? "white"
                                    : "#1e293b",
                              }}
                            >
                              <div>
                                {
                                  message.content
                                }
                              </div>

                              <div
                                style={{
                                  fontSize:
                                    "10px",
                                  marginTop:
                                    "5px",
                                  opacity:
                                    "0.65",
                                  textAlign:
                                    "right",
                                }}
                              >
                                {formatTime(
                                  message.created_at
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      }
                    )
                  )}

                  <div
                    ref={
                      messagesEndRef
                    }
                  />
                </div>

                <form
                  onSubmit={
                    sendMessage
                  }
                  style={{
                    padding: "15px",
                    borderTop:
                      "1px solid #e2e8f0",
                    display: "flex",
                    gap: "10px",
                  }}
                >
                  <input
                    type="text"
                    value={newMessage}
                    onChange={(event) =>
                      setNewMessage(
                        event.target.value
                      )
                    }
                    placeholder="Type a message..."
                    style={{
                      flex: 1,
                      padding:
                        "13px 15px",
                      borderRadius:
                        "12px",
                      border:
                        "1px solid #dbe3ef",
                      outline: "none",
                      fontSize: "14px",
                    }}
                  />

                  <button
                    type="submit"
                    className="primary-card-button"
                    disabled={
                      sending ||
                      !newMessage.trim()
                    }
                  >
                    {sending
                      ? "..."
                      : "Send"}
                  </button>
                </form>
              </>
            ) : (
              <div
                style={{
                  margin: "auto",
                  textAlign: "center",
                  color: "#64748b",
                }}
              >
                Select a friend
                to start chatting.
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default Messages;