import { useEffect, useRef, useState } from "react";
import { supabase } from "../lib/supabase";

function VoiceChat({ sessionId, currentUser }) {
  const [joined, setJoined] = useState(false);
  const [muted, setMuted] = useState(false);
  const [voiceUsers, setVoiceUsers] = useState([]);
  const [error, setError] = useState("");

  const channelRef = useRef(null);
  const localStreamRef = useRef(null);
  const peersRef = useRef({});
  const remoteAudioRefs = useRef({});

  useEffect(() => {
    if (!sessionId || !currentUser) {
      return;
    }

    return () => {
      cleanupVoice();
    };
  }, [sessionId, currentUser]);

  function createPeer(userId, initiator) {
    if (peersRef.current[userId]) {
      return peersRef.current[userId];
    }

    const peer = new RTCPeerConnection({
      iceServers: [
        {
          urls: "stun:stun.l.google.com:19302",
        },
      ],
    });

    peersRef.current[userId] = peer;

    if (localStreamRef.current) {
      localStreamRef.current
        .getTracks()
        .forEach((track) => {
          peer.addTrack(
            track,
            localStreamRef.current
          );
        });
    }

    peer.onicecandidate = async (event) => {
      if (!event.candidate) {
        return;
      }

      if (!channelRef.current) {
        return;
      }

      await channelRef.current.send({
        type: "broadcast",
        event: "voice-ice",
        payload: {
          from: currentUser.id,
          to: userId,
          candidate: event.candidate,
        },
      });
    };

    peer.ontrack = (event) => {
      const stream = event.streams?.[0];

      if (!stream) {
        return;
      }

      remoteAudioRefs.current[userId] = stream;

      setVoiceUsers((users) => {
        const existing = users.find(
          (user) => user.id === userId
        );

        if (existing) {
          return users.map((user) =>
            user.id === userId
              ? {
                  ...user,
                  stream,
                }
              : user
          );
        }

        return [
          ...users,
          {
            id: userId,
            stream,
            local: false,
          },
        ];
      });
    };

    peer.onconnectionstatechange = () => {
      const state =
        peer.connectionState;

      if (
        state === "failed" ||
        state === "closed" ||
        state === "disconnected"
      ) {
        removePeer(userId);
      }
    };

    if (initiator) {
      createOffer(userId, peer);
    }

    return peer;
  }

  async function createOffer(userId, peer) {
    try {
      const offer =
        await peer.createOffer();

      await peer.setLocalDescription(
        offer
      );

      if (!channelRef.current) {
        return;
      }

      await channelRef.current.send({
        type: "broadcast",
        event: "voice-offer",
        payload: {
          from: currentUser.id,
          to: userId,
          offer: peer.localDescription,
        },
      });
    } catch (err) {
      console.error(
        "Could not create voice offer:",
        err
      );
    }
  }

  async function handleOffer(payload) {
    if (payload.to !== currentUser.id) {
      return;
    }

    let peer =
      peersRef.current[payload.from];

    if (!peer) {
      peer = createPeer(
        payload.from,
        false
      );
    }

    try {
      await peer.setRemoteDescription(
        new RTCSessionDescription(
          payload.offer
        )
      );

      const answer =
        await peer.createAnswer();

      await peer.setLocalDescription(
        answer
      );

      if (!channelRef.current) {
        return;
      }

      await channelRef.current.send({
        type: "broadcast",
        event: "voice-answer",
        payload: {
          from: currentUser.id,
          to: payload.from,
          answer: peer.localDescription,
        },
      });
    } catch (err) {
      console.error(
        "Could not handle voice offer:",
        err
      );
    }
  }

  async function handleAnswer(payload) {
    if (payload.to !== currentUser.id) {
      return;
    }

    const peer =
      peersRef.current[payload.from];

    if (!peer) {
      return;
    }

    try {
      await peer.setRemoteDescription(
        new RTCSessionDescription(
          payload.answer
        )
      );
    } catch (err) {
      console.error(
        "Could not handle voice answer:",
        err
      );
    }
  }

  async function handleIce(payload) {
    if (payload.to !== currentUser.id) {
      return;
    }

    const peer =
      peersRef.current[payload.from];

    if (!peer) {
      return;
    }

    try {
      await peer.addIceCandidate(
        new RTCIceCandidate(
          payload.candidate
        )
      );
    } catch (err) {
      console.error(
        "Could not add ICE candidate:",
        err
      );
    }
  }

  async function joinVoice() {
    if (joined) {
      return;
    }

    try {
      setError("");

      if (
        !navigator.mediaDevices ||
        !navigator.mediaDevices.getUserMedia
      ) {
        throw new Error(
          "Your browser does not support microphone access."
        );
      }

      const stream =
        await navigator.mediaDevices.getUserMedia(
          {
            audio: true,
          }
        );

      localStreamRef.current = stream;

      const channel = supabase.channel(
        `study-room-voice-${sessionId}`,
        {
          config: {
            broadcast: {
              self: false,
            },
          },
        }
      );

      channelRef.current = channel;

      channel
        .on(
          "broadcast",
          {
            event: "voice-join",
          },
          ({ payload }) => {
            if (
              payload.userId ===
              currentUser.id
            ) {
              return;
            }

            /*
             * The person already in the room
             * creates the connection.
             */
            createPeer(
              payload.userId,
              true
            );
          }
        )

        .on(
          "broadcast",
          {
            event: "voice-offer",
          },
          ({ payload }) => {
            handleOffer(payload);
          }
        )

        .on(
          "broadcast",
          {
            event: "voice-answer",
          },
          ({ payload }) => {
            handleAnswer(payload);
          }
        )

        .on(
          "broadcast",
          {
            event: "voice-ice",
          },
          ({ payload }) => {
            handleIce(payload);
          }
        )

        .on(
          "broadcast",
          {
            event: "voice-leave",
          },
          ({ payload }) => {
            if (payload.userId) {
              removePeer(
                payload.userId
              );
            }
          }
        )

        .subscribe(async (status) => {
          if (status !== "SUBSCRIBED") {
            return;
          }

          /*
           * Tell everyone already in the
           * room that we have joined.
           */
          await channel.send({
            type: "broadcast",
            event: "voice-join",
            payload: {
              userId: currentUser.id,
            },
          });
        });

      setVoiceUsers([
        {
          id: currentUser.id,
          local: true,
        },
      ]);

      setJoined(true);
      setMuted(false);
    } catch (err) {
      console.error(
        "Could not join voice chat:",
        err
      );

      setError(
        err?.message ||
          "Could not access your microphone."
      );

      if (localStreamRef.current) {
        localStreamRef.current
          .getTracks()
          .forEach((track) => {
            track.stop();
          });

        localStreamRef.current = null;
      }
    }
  }

  function removePeer(userId) {
    const peer =
      peersRef.current[userId];

    if (peer) {
      try {
        peer.close();
      } catch (err) {
        console.warn(
          "Could not close peer:",
          err
        );
      }

      delete peersRef.current[userId];
    }

    delete remoteAudioRefs.current[
      userId
    ];

    setVoiceUsers((users) =>
      users.filter(
        (user) => user.id !== userId
      )
    );
  }

  async function leaveVoice() {
    if (!joined && !channelRef.current) {
      return;
    }

    try {
      if (channelRef.current) {
        try {
          await channelRef.current.send({
            type: "broadcast",
            event: "voice-leave",
            payload: {
              userId: currentUser?.id,
            },
          });
        } catch (err) {
          console.warn(
            "Could not announce voice leave:",
            err
          );
        }

        await supabase.removeChannel(
          channelRef.current
        );

        channelRef.current = null;
      }

      Object.values(
        peersRef.current
      ).forEach((peer) => {
        try {
          peer.close();
        } catch (err) {
          console.warn(
            "Could not close peer:",
            err
          );
        }
      });

      peersRef.current = {};

      if (localStreamRef.current) {
        localStreamRef.current
          .getTracks()
          .forEach((track) => {
            track.stop();
          });

        localStreamRef.current = null;
      }

      remoteAudioRefs.current = {};

      setVoiceUsers([]);
      setJoined(false);
      setMuted(false);
    } catch (err) {
      console.error(
        "Could not leave voice chat:",
        err
      );
    }
  }

  function cleanupVoice() {
    if (channelRef.current) {
      supabase.removeChannel(
        channelRef.current
      );

      channelRef.current = null;
    }

    Object.values(
      peersRef.current
    ).forEach((peer) => {
      try {
        peer.close();
      } catch (err) {
        console.warn(
          "Could not close peer:",
          err
        );
      }
    });

    peersRef.current = {};

    if (localStreamRef.current) {
      localStreamRef.current
        .getTracks()
        .forEach((track) => {
          track.stop();
        });

      localStreamRef.current = null;
    }

    remoteAudioRefs.current = {};
  }

  function toggleMute() {
    if (!localStreamRef.current) {
      return;
    }

    const tracks =
      localStreamRef.current.getAudioTracks();

    const nextMuted = !muted;

    tracks.forEach((track) => {
      track.enabled = !nextMuted;
    });

    setMuted(nextMuted);
  }

  return (
    <div
      style={{
        background: "white",
        borderRadius: "20px",
        border: "1px solid #e2e8f0",
        padding: "25px",
      }}
    >
      <p className="card-eyebrow">
        VOICE CHAT
      </p>

      <h3>
        🎙️ Study Room Voice
      </h3>

      <p
        style={{
          color: "#64748b",
          lineHeight: 1.5,
        }}
      >
        Talk with the other students in
        this study room.
      </p>

      {error && (
        <div
          style={{
            marginTop: "15px",
            padding: "12px",
            borderRadius: "12px",
            background: "#fef2f2",
            color: "#b91c1c",
            fontSize: "14px",
          }}
        >
          ⚠️ {error}
        </div>
      )}

      {!joined ? (
        <button
          type="button"
          className="primary-card-button"
          onClick={joinVoice}
          style={{
            marginTop: "15px",
            width: "100%",
          }}
        >
          🎙️ Join Voice Chat
        </button>
      ) : (
        <>
          <div
            style={{
              marginTop: "15px",
              padding: "12px",
              borderRadius: "12px",
              background: "#f0fdf4",
              color: "#166534",
              fontSize: "14px",
            }}
          >
            🟢 You are connected to voice
          </div>

          <div
            style={{
              display: "flex",
              gap: "10px",
              marginTop: "15px",
            }}
          >
            <button
              type="button"
              className="primary-card-button"
              onClick={toggleMute}
              style={{
                flex: 1,
              }}
            >
              {muted
                ? "🔇 Unmute"
                : "🎙️ Mute"}
            </button>

            <button
              type="button"
              className="primary-card-button"
              onClick={leaveVoice}
              style={{
                flex: 1,
              }}
            >
              🚪 Leave Voice
            </button>
          </div>
        </>
      )}

      {voiceUsers.length > 0 && (
        <div
          style={{
            marginTop: "20px",
          }}
        >
          <strong>
            👥 In voice
          </strong>

          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: "8px",
              marginTop: "10px",
            }}
          >
            {voiceUsers.map((user) => (
              <div
                key={user.id}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "10px",
                  padding: "10px",
                  borderRadius: "10px",
                  background: "#f8fafc",
                }}
              >
                <span>
                  🟢
                </span>

                <span>
                  {user.local
                    ? "You"
                    : "Student"}
                </span>

                {user.local && muted && (
                  <span
                    style={{
                      marginLeft: "auto",
                      fontSize: "12px",
                      color: "#64748b",
                    }}
                  >
                    🔇 Muted
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {voiceUsers
        .filter((user) => !user.local)
        .map((user) => (
          <audio
            key={user.id}
            ref={(element) => {
              if (element && user.stream) {
                element.srcObject =
                  user.stream;
                element.autoplay = true;
                element.playsInline = true;
              }
            }}
          />
        ))}
    </div>
  );
}

export default VoiceChat;