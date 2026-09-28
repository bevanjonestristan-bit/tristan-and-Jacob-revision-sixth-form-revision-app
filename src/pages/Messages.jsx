import {
  useEffect,
  useRef,
  useState,
} from "react";

import { supabase } from "../lib/supabase";

function Messages({
  setPage,
  selectedFriend,
}) {
  const [user, setUser] =
    useState(null);

  const [friends, setFriends] =
    useState([]);

  const [
    selectedUser,
    setSelectedUser,
  ] = useState(
    selectedFriend || null
  );

  const [messages, setMessages] =
    useState([]);

  const [
    newMessage,
    setNewMessage,
  ] = useState("");

  const [loading, setLoading] =
    useState(true);

  const [sending, setSending] =
    useState(false);

  const [error, setError] =
    useState("");

  const [isMobile, setIsMobile] =
    useState(
      window.innerWidth <= 768
    );

  const [
    mobileChatOpen,
    setMobileChatOpen,
  ] = useState(
    Boolean(selectedFriend)
  );

  const messagesEndRef =
    useRef(null);

  // =========================================================
  // MOBILE SIZE
  // =========================================================

  useEffect(() => {
    function handleResize() {
      setIsMobile(
        window.innerWidth <= 768
      );
    }

    window.addEventListener(
      "resize",
      handleResize
    );

    return () => {
      window.removeEventListener(
        "resize",
        handleResize
      );
    };
  }, []);

  // =========================================================
  // AUTO SCROLL
  // =========================================================

  useEffect(() => {
    messagesEndRef.current
      ?.scrollIntoView({
        behavior: "smooth",
      });
  }, [messages]);

  // =========================================================
  // INITIAL LOAD
  // =========================================================

  useEffect(() => {
    loadMessagesPage();
  }, []);

  // =========================================================
  // REALTIME MESSAGES
  // =========================================================

  useEffect(() => {
    if (
      !user ||
      !selectedUser
    ) {
      return;
    }

    loadConversation();

    const channelName =
      `messages-${user.id}-${selectedUser.id}`;

    const channel =
      supabase
        .channel(channelName)
        .on(
          "postgres_changes",
          {
            event: "INSERT",
            schema: "public",
            table: "messages",
          },
          (payload) => {
            const message =
              payload.new;

            const belongsToConversation =
              (
                message.sender_id ===
                  user.id &&
                message.receiver_id ===
                  selectedUser.id
              ) ||
              (
                message.sender_id ===
                  selectedUser.id &&
                message.receiver_id ===
                  user.id
              );

            if (
              !belongsToConversation
            ) {
              return;
            }

            setMessages(
              (
                currentMessages
              ) => {
                const alreadyExists =
                  currentMessages.some(
                    (
                      existingMessage
                    ) =>
                      existingMessage.id ===
                      message.id
                  );

                if (
                  alreadyExists
                ) {
                  return currentMessages;
                }

                return [
                  ...currentMessages,
                  message,
                ];
              }
            );
          }
        )
        .subscribe(
          (status) => {
            console.log(
              `Realtime channel ${channelName}:`,
              status
            );
          }
        );

    return () => {
      supabase.removeChannel(
        channel
      );
    };
  }, [user, selectedUser]);

  // =========================================================
  // LOAD PAGE
  // =========================================================

  async function loadMessagesPage() {
    try {
      setLoading(true);
      setError("");

      const {
        data: {
          user: currentUser,
        },
        error: userError,
      } =
        await supabase.auth.getUser();

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
        error:
          friendshipError,
      } = await supabase
        .from(
          "friend_requests"
        )
        .select(
          "id, sender_id, receiver_id, status"
        )
        .eq(
          "status",
          "accepted"
        )
        .or(
          `sender_id.eq.${currentUser.id},receiver_id.eq.${currentUser.id}`
        );

      if (
        friendshipError
      ) {
        throw friendshipError;
      }

      const friendIds = [];

      (
        friendships || []
      ).forEach(
        (friendship) => {
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
        }
      );

      const myFriends =
        (
          profiles || []
        ).filter(
          (profile) =>
            friendIds.includes(
              profile.id
            )
        );

      setFriends(myFriends);

      if (
        selectedFriend
      ) {
        const matchingFriend =
          myFriends.find(
            (friend) =>
              friend.id ===
              selectedFriend.id
          );

        if (
          matchingFriend
        ) {
          setSelectedUser(
            matchingFriend
          );

          if (
            window.innerWidth <=
            768
          ) {
            setMobileChatOpen(
              true
            );
          }
        }
      }

      if (
        !selectedFriend &&
        myFriends.length >
          0 &&
        window.innerWidth >
          768
      ) {
        setSelectedUser(
          myFriends[0]
        );
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

  // =========================================================
  // LOAD CONVERSATION
  // =========================================================

  async function loadConversation() {
    if (
      !user ||
      !selectedUser
    ) {
      return;
    }

    try {
      setError("");

      const {
        data,
        error:
          messageError,
      } = await supabase
        .from("messages")
        .select(
          "id, sender_id, receiver_id, content, created_at"
        )
        .or(
          `and(sender_id.eq.${user.id},receiver_id.eq.${selectedUser.id}),and(sender_id.eq.${selectedUser.id},receiver_id.eq.${user.id})`
        )
        .order(
          "created_at",
          {
            ascending: true,
          }
        );

      if (
        messageError
      ) {
        throw messageError;
      }

      setMessages(
        data || []
      );
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

  // =========================================================
  // OPEN CHAT
  // =========================================================

  function openConversation(
    friend
  ) {
    setSelectedUser(
      friend
    );

    setMessages([]);
    setError("");

    if (isMobile) {
      setMobileChatOpen(
        true
      );
    }
  }

  // =========================================================
  // CLOSE MOBILE CHAT
  // =========================================================

  function closeMobileChat() {
    setMobileChatOpen(
      false
    );

    setSelectedUser(
      null
    );

    setMessages([]);
    setNewMessage("");
  }

  // =========================================================
  // SEND MESSAGE
  // =========================================================

  async function sendMessage(
    event
  ) {
    event.preventDefault();

    const text =
      newMessage.trim();

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

      // =====================================================
      // CREATE MESSAGE
      // =====================================================

      const {
        data,
        error:
          sendError,
      } = await supabase
        .from("messages")
        .insert({
          sender_id:
            user.id,
          receiver_id:
            selectedUser.id,
          content: text,
        })
        .select(
          "id, sender_id, receiver_id, content, created_at"
        )
        .single();

      if (sendError) {
        throw sendError;
      }

      // =====================================================
      // SHOW MESSAGE IMMEDIATELY
      // =====================================================

      setMessages(
        (
          currentMessages
        ) => {
          const alreadyExists =
            currentMessages.some(
              (message) =>
                message.id ===
                data.id
            );

          if (
            alreadyExists
          ) {
            return currentMessages;
          }

          return [
            ...currentMessages,
            data,
          ];
        }
      );

      setNewMessage("");

      // =====================================================
      // CREATE NOTIFICATION
      // =====================================================

      const {
        error:
          notificationError,
      } = await supabase.rpc(
        "notify_new_message",
        {
          p_message_id:
            data.id,
        }
      );

      if (
        notificationError
      ) {
        console.error(
          "Could not create message notification:",
          notificationError
        );
      }
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

  // =========================================================
  // FORMAT TIME
  // =========================================================

  function formatTime(
    date
  ) {
    return new Date(
      date
    ).toLocaleTimeString(
      [],
      {
        hour:
          "2-digit",
        minute:
          "2-digit",
      }
    );
  }

  // =========================================================
  // LOADING
  // =========================================================

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
          Getting your
          conversations
          ready.
        </p>

      </div>
    );
  }

  // =========================================================
  // CONVERSATION LIST
  // =========================================================

  const conversationList = (
    <div
      style={{
        background:
          "white",
        borderRadius:
          isMobile
            ? "16px"
            : "18px",
        border:
          "1px solid #e2e8f0",
        padding:
          isMobile
            ? "10px"
            : "15px",
        height:
          isMobile
            ? "auto"
            : "fit-content",
      }}
    >

      <h3
        style={{
          margin:
            "5px 8px 15px",
          fontSize:
            isMobile
              ? "18px"
              : "20px",
        }}
      >
        Conversations
      </h3>

      {friends.map(
        (friend) => {
          const selected =
            selectedUser?.id ===
            friend.id;

          return (
            <button
              key={
                friend.id
              }
              type="button"
              onClick={() =>
                openConversation(
                  friend
                )
              }
              style={{
                width:
                  "100%",
                border:
                  "none",
                borderRadius:
                  "14px",
                padding:
                  isMobile
                    ? "14px 12px"
                    : "12px",
                marginBottom:
                  "6px",
                textAlign:
                  "left",
                cursor:
                  "pointer",
                background:
                  selected &&
                  !isMobile
                    ? "#eef2ff"
                    : "transparent",
              }}
            >

              <div
                style={{
                  display:
                    "flex",
                  alignItems:
                    "center",
                  gap:
                    "12px",
                }}
              >

                <div
                  style={{
                    width:
                      "46px",
                    height:
                      "46px",
                    minWidth:
                      "46px",
                    borderRadius:
                      "50%",
                    display:
                      "flex",
                    alignItems:
                      "center",
                    justifyContent:
                      "center",
                    background:
                      "#e0e7ff",
                    fontSize:
                      "21px",
                  }}
                >
                  👤
                </div>

                <div
                  style={{
                    minWidth:
                      0,
                    flex:
                      1,
                  }}
                >

                  <strong
                    style={{
                      display:
                        "block",
                      overflow:
                        "hidden",
                      textOverflow:
                        "ellipsis",
                      whiteSpace:
                        "nowrap",
                    }}
                  >
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

                {isMobile && (
                  <div
                    style={{
                      fontSize:
                        "22px",
                      color:
                        "#94a3b8",
                    }}
                  >
                    ›
                  </div>
                )}

              </div>

            </button>
          );
        }
      )}

    </div>
  );

  // =========================================================
  // CHAT PANEL
  // =========================================================

  const chatPanel = (
    <div
      style={{
        background:
          "white",
        borderRadius:
          isMobile
            ? "16px"
            : "18px",
        border:
          "1px solid #e2e8f0",
        display:
          "flex",
        flexDirection:
          "column",
        overflow:
          "hidden",
        minHeight:
          isMobile
            ? "calc(100dvh - 170px)"
            : "500px",
        height:
          isMobile
            ? "calc(100dvh - 150px)"
            : "auto",
      }}
    >

      {selectedUser ? (
        <>

          {/* CHAT HEADER */}

          <div
            style={{
              padding:
                isMobile
                  ? "12px 14px"
                  : "18px 20px",
              borderBottom:
                "1px solid #e2e8f0",
              display:
                "flex",
              alignItems:
                "center",
              gap:
                "10px",
              position:
                "sticky",
              top:
                0,
              background:
                "white",
              zIndex:
                2,
            }}
          >

            {isMobile && (
              <button
                type="button"
                onClick={
                  closeMobileChat
                }
                style={{
                  border:
                    "none",
                  background:
                    "#f1f5f9",
                  borderRadius:
                    "10px",
                  width:
                    "40px",
                  height:
                    "40px",
                  cursor:
                    "pointer",
                  fontSize:
                    "20px",
                  display:
                    "flex",
                  alignItems:
                    "center",
                  justifyContent:
                    "center",
                  flexShrink:
                    0,
                }}
              >
                ←
              </button>
            )}

            <div
              style={{
                width:
                  "42px",
                height:
                  "42px",
                minWidth:
                  "42px",
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

            <div
              style={{
                minWidth:
                  0,
              }}
            >

              <strong
                style={{
                  display:
                    "block",
                  overflow:
                    "hidden",
                  textOverflow:
                    "ellipsis",
                  whiteSpace:
                    "nowrap",
                }}
              >
                {selectedUser.full_name ||
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
                {selectedUser.year_group ||
                  "Sixth Form"}
              </div>

            </div>

            <div
              style={{
                marginLeft:
                  "auto",
                display:
                  "flex",
                alignItems:
                  "center",
                gap:
                  "5px",
                color:
                  "#16a34a",
                fontSize:
                  "10px",
                fontWeight:
                  "700",
                flexShrink:
                  0,
              }}
            >
              <span>
                ●
              </span>

              LIVE
            </div>

          </div>

          {/* MESSAGES */}

          <div
            style={{
              flex:
                1,
              padding:
                isMobile
                  ? "14px 10px"
                  : "20px",
              overflowY:
                "auto",
              display:
                "flex",
              flexDirection:
                "column",
              gap:
                "8px",
              background:
                "#f8fafc",
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
                  padding:
                    "30px",
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
                  💬
                </div>

                <strong>
                  No messages yet
                </strong>

                <p>
                  Start the conversation!
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
                            isMobile
                              ? "82%"
                              : "70%",
                          padding:
                            isMobile
                              ? "10px 12px"
                              : "10px 14px",
                          borderRadius:
                            mine
                              ? "16px 16px 4px 16px"
                              : "16px 16px 16px 4px",
                          background:
                            mine
                              ? "#4f46e5"
                              : "white",
                          color:
                            mine
                              ? "white"
                              : "#1e293b",
                          border:
                            mine
                              ? "none"
                              : "1px solid #e2e8f0",
                          wordBreak:
                            "break-word",
                          boxShadow:
                            "0 1px 2px rgba(15, 23, 42, 0.05)",
                        }}
                      >

                        <div
                          style={{
                            fontSize:
                              isMobile
                                ? "15px"
                                : "14px",
                            lineHeight:
                              "1.4",
                          }}
                        >
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

          {/* MESSAGE BOX */}

          <form
            onSubmit={
              sendMessage
            }
            style={{
              padding:
                isMobile
                  ? "10px"
                  : "15px",
              borderTop:
                "1px solid #e2e8f0",
              display:
                "flex",
              gap:
                "8px",
              background:
                "white",
            }}
          >

            <input
              type="text"
              value={
                newMessage
              }
              onChange={(
                event
              ) =>
                setNewMessage(
                  event.target.value
                )
              }
              placeholder="Type a message..."
              style={{
                flex:
                  1,
                minWidth:
                  0,
                padding:
                  isMobile
                    ? "12px 13px"
                    : "13px 15px",
                borderRadius:
                  "14px",
                border:
                  "1px solid #dbe3ef",
                outline:
                  "none",
                fontSize:
                  "16px",
              }}
            />

            <button
              type="submit"
              className="primary-card-button"
              disabled={
                sending ||
                !newMessage.trim()
              }
              style={{
                minWidth:
                  isMobile
                    ? "58px"
                    : "auto",
                padding:
                  isMobile
                    ? "0 14px"
                    : undefined,
                borderRadius:
                  "14px",
              }}
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
            margin:
              "auto",
            textAlign:
              "center",
            color:
              "#64748b",
            padding:
              "30px",
          }}
        >
          Select a friend to
          start chatting.
        </div>

      )}

    </div>
  );

  // =========================================================
  // PAGE
  // =========================================================

  return (
    <div>

      {!isMobile ||
      !mobileChatOpen ? (

        <div className="revision-header">

          <div>

            <p className="card-eyebrow">
              TRISTAN REVISION
            </p>

            <h2>
              Messages 💬
            </h2>

            <p className="revision-description">
              Chat with your
              friends and study
              together.
            </p>

          </div>

        </div>

      ) : null}

      {error && (
        <div className="auth-error">
          {error}
        </div>
      )}

      {friends.length ===
      0 ? (

        <div className="no-subjects">

          <div className="no-subjects-icon">
            👥
          </div>

          <h3>
            No friends yet
          </h3>

          <p>
            Add some friends
            before starting a
            conversation.
          </p>

          <button
            type="button"
            className="primary-card-button"
            onClick={() =>
              setPage(
                "friends"
              )
            }
          >
            Find Friends
          </button>

        </div>

      ) : isMobile ? (

        mobileChatOpen &&
        selectedUser ? (
          chatPanel
        ) : (
          conversationList
        )

      ) : (

        <div
          style={{
            display:
              "grid",
            gridTemplateColumns:
              "280px minmax(0, 1fr)",
            gap:
              "20px",
            minHeight:
              "500px",
          }}
        >
          {conversationList}

          {chatPanel}
        </div>

      )}

    </div>
  );
}

export default Messages;