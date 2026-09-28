import React, { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import ConfirmModal from "../components/ui/ConfirmModal";
import Toast from "../components/ui/Toast";

function Notifications({ setPage, onUnreadCountChange }) {
  const [user, setUser] = useState(null);
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [working, setWorking] = useState(false);
  const [confirmDialog, setConfirmDialog] = useState(null);
  const [toast, setToast] = useState(null);

  useEffect(() => {
    let channel = null;
    let mounted = true;

    async function start() {
      try {
        setLoading(true);
        setError("");

        const { data: { user: currentUser }, error: userError } =
          await supabase.auth.getUser();

        if (userError) throw userError;
        if (!currentUser) {
          setPage("login");
          return;
        }

        if (!mounted) return;
        setUser(currentUser);
        await loadNotifications(currentUser.id);

        channel = supabase
          .channel(`notifications-${currentUser.id}`)
          .on(
            "postgres_changes",
            {
              event: "*",
              schema: "public",
              table: "notifications",
              filter: `user_id=eq.${currentUser.id}`,
            },
            () => loadNotifications(currentUser.id)
          )
          .subscribe();
      } catch (err) {
        console.error("Could not start notifications:", err);
        if (mounted) setError(err?.message || "Could not load notifications.");
      } finally {
        if (mounted) setLoading(false);
      }
    }

    start();

    return () => {
      mounted = false;
      if (channel) supabase.removeChannel(channel);
    };
  }, []);

  async function loadNotifications(userId = user?.id) {
    if (!userId) return;

    try {
      const { data, error: notificationError } = await supabase
        .from("notifications")
        .select("*")
        .eq("user_id", userId)
        .order("created_at", { ascending: false });

      if (notificationError) throw notificationError;

      const rows = data || [];
      setNotifications(rows);
      onUnreadCountChange?.(rows.filter((item) => !item.is_read).length);
    } catch (err) {
      console.error("Could not load notifications:", err);
      setError(err?.message || "Could not load notifications.");
    }
  }

  async function markAsRead(notification) {
    if (!notification || notification.is_read) return;

    try {
      const { error: updateError } = await supabase
        .from("notifications")
        .update({ is_read: true })
        .eq("id", notification.id);

      if (updateError) throw updateError;
      await loadNotifications();
    } catch (err) {
      console.error("Could not mark notification as read:", err);
    }
  }

  async function openNotification(notification) {
    await markAsRead(notification);
    if (notification.link_page) setPage(notification.link_page);
  }

  async function markAllRead() {
    if (!user) return;

    try {
      setWorking(true);
      setError("");

      const { error: updateError } = await supabase
        .from("notifications")
        .update({ is_read: true })
        .eq("user_id", user.id)
        .eq("is_read", false);

      if (updateError) throw updateError;
      await loadNotifications();
      setToast({ message: "Everything is marked as read." });
    } catch (err) {
      console.error("Could not mark all notifications as read:", err);
      setError(err?.message || "Could not mark notifications as read.");
    } finally {
      setWorking(false);
    }
  }

  async function deleteNotification(notificationId) {
    try {
      setWorking(true);
      setError("");

      const { error: deleteError } = await supabase
        .from("notifications")
        .delete()
        .eq("id", notificationId);

      if (deleteError) throw deleteError;
      await loadNotifications();
      setToast({ message: "Notification deleted." });
    } catch (err) {
      console.error("Could not delete notification:", err);
      setToast({ type: "error", message: err?.message || "Could not delete notification." });
    } finally {
      setWorking(false);
    }
  }

  async function clearRead() {
    if (!user) return;

    try {
      setWorking(true);
      setError("");

      const { error: deleteError } = await supabase
        .from("notifications")
        .delete()
        .eq("user_id", user.id)
        .eq("is_read", true);

      if (deleteError) throw deleteError;
      await loadNotifications();
      setToast({ message: "Read notifications cleared." });
    } catch (err) {
      console.error("Could not clear read notifications:", err);
      setToast({ type: "error", message: err?.message || "Could not clear read notifications." });
    } finally {
      setWorking(false);
    }
  }

  async function clearAllConfirmed() {
    if (!user) return;

    try {
      setWorking(true);
      setError("");

      const { error: deleteError } = await supabase
        .from("notifications")
        .delete()
        .eq("user_id", user.id);

      if (deleteError) throw deleteError;
      setConfirmDialog(null);
      await loadNotifications();
      setToast({ message: "All notifications cleared." });
    } catch (err) {
      console.error("Could not clear notifications:", err);
      setToast({ type: "error", message: err?.message || "Could not clear notifications." });
    } finally {
      setWorking(false);
    }
  }

  function getIcon(type) {
    const labels = {
      message: "MSG",
      friend_request: "FR",
      past_paper: "PDF",
      study_invite: "ST",
      battle: "VS",
      success: "OK",
    };
    return labels[type] || "NEW";
  }

  function formatTime(date) {
    if (!date) return "";
    const created = new Date(date);
    const seconds = Math.floor((Date.now() - created.getTime()) / 1000);
    if (seconds < 60) return "Just now";
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    if (days < 7) return `${days}d ago`;
    return created.toLocaleDateString([], { day: "numeric", month: "short" });
  }

  if (loading) {
    return (
      <div style={styles.loading}>
        <div style={styles.loadingOrb}>N</div>
        <strong>Loading notifications</strong>
        <span>Checking what is new...</span>
      </div>
    );
  }

  const unreadCount = notifications.filter((item) => !item.is_read).length;

  return (
    <div style={styles.page}>
      <section style={styles.hero}>
        <div>
          <div style={styles.eyebrow}>TRISTAN REVISION / INBOX</div>
          <h1 style={styles.heroTitle}>Notifications</h1>
          <p style={styles.heroText}>
            Stay on top of messages, assignments, shared notes and revision activity.
          </p>
        </div>
        <div style={styles.heroMark}>N</div>
      </section>

      {error && <div style={styles.error}>{error}</div>}

      <section style={styles.summary}>
        <div>
          <div style={styles.summaryEyebrow}>YOUR INBOX</div>
          <h2 style={styles.summaryTitle}>
            {unreadCount === 0 ? "You're all caught up" : `${unreadCount} unread`}
          </h2>
          <p style={styles.summaryText}>
            {notifications.length} notification{notifications.length === 1 ? "" : "s"} in total
          </p>
        </div>

        <div style={styles.actions}>
          {unreadCount > 0 && (
            <button type="button" disabled={working} onClick={markAllRead} style={styles.primaryButton}>
              Mark all read
            </button>
          )}
          <button type="button" disabled={working || notifications.length === 0} onClick={clearRead} style={styles.secondaryButton}>
            Clear read
          </button>
          <button
            type="button"
            disabled={working || notifications.length === 0}
            onClick={() =>
              setConfirmDialog({
                title: "Clear all notifications?",
                message: "This permanently removes every notification from your account. This action cannot be undone.",
                confirmText: "Clear all",
                action: clearAllConfirmed,
              })
            }
            style={styles.dangerButton}
          >
            Clear all
          </button>
        </div>
      </section>

      {notifications.length === 0 ? (
        <section style={styles.empty}>
          <div style={styles.emptyIcon}>N</div>
          <div style={styles.emptyEyebrow}>INBOX ZERO</div>
          <h3 style={styles.emptyTitle}>No notifications</h3>
          <p style={styles.emptyText}>
            New messages, invitations, assignment updates and friend activity will appear here.
          </p>
        </section>
      ) : (
        <section style={styles.list}>
          {notifications.map((notification) => {
            const unread = !notification.is_read;

            return (
              <article key={notification.id} style={{ ...styles.item, ...(unread ? styles.itemUnread : {}) }}>
                <button type="button" onClick={() => openNotification(notification)} style={styles.iconButton}>
                  {getIcon(notification.type)}
                </button>

                <button type="button" onClick={() => openNotification(notification)} style={styles.contentButton}>
                  <div style={styles.titleRow}>
                    <strong style={styles.notificationTitle}>{notification.title}</strong>
                    {unread && <span style={styles.unreadDot} />}
                  </div>
                  <div style={styles.notificationMessage}>{notification.message}</div>
                  <div style={styles.time}>{formatTime(notification.created_at)}</div>
                </button>

                <button
                  type="button"
                  title="Delete notification"
                  disabled={working}
                  onClick={() =>
                    setConfirmDialog({
                      title: "Delete notification?",
                      message: "This notification will be permanently removed from your account.",
                      confirmText: "Delete",
                      action: () => deleteNotification(notification.id),
                    })
                  }
                  style={styles.deleteButton}
                >
                  x
                </button>
              </article>
            );
          })}
        </section>
      )}

      <ConfirmModal
        open={Boolean(confirmDialog)}
        title={confirmDialog?.title}
        message={confirmDialog?.message}
        confirmText={confirmDialog?.confirmText}
        busy={working}
        onCancel={() => !working && setConfirmDialog(null)}
        onConfirm={() => confirmDialog?.action?.()}
      />

      <Toast toast={toast} onClose={() => setToast(null)} />
    </div>
  );
}

const styles = {
  page: { display: "flex", flexDirection: "column", gap: "18px", paddingBottom: "54px" },
  hero: {
    display: "flex", justifyContent: "space-between", alignItems: "center", gap: "20px",
    padding: "32px 36px", borderRadius: "28px", color: "#fff",
    background: "radial-gradient(circle at 82% 0%,rgba(143,128,255,.4),transparent 32%),linear-gradient(135deg,#181d31,#242a49 55%,#171a2a)",
    boxShadow: "0 24px 70px rgba(24,30,49,.15)",
  },
  eyebrow: { fontSize: "8px", letterSpacing: ".16em", fontWeight: 900, color: "#b8afff" },
  heroTitle: { margin: "7px 0 6px", fontSize: "35px", letterSpacing: "-.045em" },
  heroText: { margin: 0, maxWidth: "620px", color: "#adb4c8", fontSize: "12px", lineHeight: 1.6 },
  heroMark: {
    width: "68px", height: "68px", flex: "0 0 auto", display: "grid", placeItems: "center",
    borderRadius: "21px", background: "linear-gradient(145deg,#8e80ff,#5c49ed)",
    fontSize: "24px", fontWeight: 950, boxShadow: "0 18px 38px rgba(79,60,213,.38)",
  },
  summary: {
    display: "flex", justifyContent: "space-between", alignItems: "center", gap: "18px",
    flexWrap: "wrap", padding: "21px 23px", borderRadius: "21px",
    background: "rgba(255,255,255,.86)", border: "1px solid rgba(20,27,45,.08)",
    boxShadow: "0 14px 42px rgba(24,31,51,.06)",
  },
  summaryEyebrow: { color: "#8d82a3", fontSize: "8px", letterSpacing: ".14em", fontWeight: 900 },
  summaryTitle: { margin: "5px 0 2px", color: "#1d2230", fontSize: "18px", letterSpacing: "-.025em" },
  summaryText: { margin: 0, color: "#9298a6", fontSize: "10px" },
  actions: { display: "flex", gap: "8px", flexWrap: "wrap" },
  primaryButton: {
    border: 0, borderRadius: "11px", padding: "10px 13px",
    background: "linear-gradient(135deg,#7d6dff,#5c49ed)", color: "#fff",
    fontSize: "9px", fontWeight: 900, cursor: "pointer",
  },
  secondaryButton: {
    border: "1px solid #e0e3eb", borderRadius: "11px", padding: "10px 13px",
    background: "#fff", color: "#656c7b", fontSize: "9px", fontWeight: 850, cursor: "pointer",
  },
  dangerButton: {
    border: "1px solid #ffd9df", borderRadius: "11px", padding: "10px 13px",
    background: "#fff5f6", color: "#c94c63", fontSize: "9px", fontWeight: 850, cursor: "pointer",
  },
  list: { display: "flex", flexDirection: "column", gap: "9px" },
  item: {
    display: "flex", alignItems: "center", gap: "13px", padding: "14px",
    borderRadius: "17px", background: "rgba(255,255,255,.86)",
    border: "1px solid #e7e9ef", boxShadow: "0 8px 28px rgba(24,31,51,.045)",
  },
  itemUnread: {
    background: "linear-gradient(135deg,#f7f5ff,#fff)",
    border: "1px solid #d9d2ff", boxShadow: "0 10px 30px rgba(100,80,220,.07)",
  },
  iconButton: {
    width: "47px", height: "47px", minWidth: "47px", border: 0, borderRadius: "14px",
    background: "#f0eeff", color: "#6554df", fontSize: "8px", fontWeight: 950, cursor: "pointer",
  },
  contentButton: {
    flex: 1, minWidth: 0, padding: 0, border: 0, background: "transparent",
    textAlign: "left", cursor: "pointer",
  },
  titleRow: { display: "flex", alignItems: "center", gap: "8px" },
  notificationTitle: { color: "#242936", fontSize: "12px" },
  unreadDot: { width: "7px", height: "7px", borderRadius: "50%", background: "#745fff" },
  notificationMessage: { marginTop: "4px", color: "#697080", fontSize: "11px", lineHeight: 1.45 },
  time: { marginTop: "6px", color: "#a0a5b1", fontSize: "8px", fontWeight: 700 },
  deleteButton: {
    width: "35px", height: "35px", minWidth: "35px", borderRadius: "10px",
    border: "1px solid #e8eaf0", background: "#fff", color: "#9298a6",
    fontSize: "13px", fontWeight: 800, cursor: "pointer",
  },
  empty: {
    minHeight: "330px", display: "flex", flexDirection: "column", alignItems: "center",
    justifyContent: "center", textAlign: "center", padding: "35px", borderRadius: "24px",
    background: "rgba(255,255,255,.82)", border: "1px solid rgba(20,27,45,.08)",
    boxShadow: "0 14px 42px rgba(24,31,51,.05)",
  },
  emptyIcon: {
    width: "58px", height: "58px", display: "grid", placeItems: "center", marginBottom: "16px",
    borderRadius: "18px", background: "#f0eeff", color: "#6554df", fontWeight: 950,
  },
  emptyEyebrow: { color: "#8d82a3", fontSize: "8px", letterSpacing: ".14em", fontWeight: 900 },
  emptyTitle: { margin: "7px 0 5px", color: "#222735", fontSize: "18px" },
  emptyText: { maxWidth: "410px", margin: 0, color: "#9298a6", fontSize: "11px", lineHeight: 1.6 },
  error: {
    padding: "12px 14px", borderRadius: "12px", background: "#fff0f2",
    border: "1px solid #ffd9df", color: "#b93f55", fontSize: "11px", fontWeight: 750,
  },
  loading: {
    minHeight: "360px", display: "flex", flexDirection: "column", alignItems: "center",
    justifyContent: "center", gap: "8px", borderRadius: "24px",
    background: "rgba(255,255,255,.82)", color: "#73798a",
  },
  loadingOrb: {
    width: "48px", height: "48px", display: "grid", placeItems: "center", marginBottom: "5px",
    borderRadius: "15px", background: "#f0eeff", color: "#6554df", fontWeight: 950,
  },
};

export default Notifications;
