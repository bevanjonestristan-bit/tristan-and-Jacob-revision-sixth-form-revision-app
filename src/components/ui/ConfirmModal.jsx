import React from "react";

function ConfirmModal({
  open,
  title,
  message,
  confirmText = "Confirm",
  cancelText = "Cancel",
  danger = true,
  busy = false,
  onConfirm,
  onCancel,
}) {
  if (!open) return null;

  return (
    <div
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !busy) onCancel?.();
      }}
      style={styles.backdrop}
    >
      <div role="dialog" aria-modal="true" aria-labelledby="confirm-title" style={styles.modal}>
        <div style={styles.body}>
          <div style={{ ...styles.icon, ...(danger ? styles.dangerIcon : styles.normalIcon) }}>
            !
          </div>
          <div style={styles.eyebrow}>CONFIRM ACTION</div>
          <h3 id="confirm-title" style={styles.title}>{title}</h3>
          <p style={styles.message}>{message}</p>
        </div>

        <div style={styles.actions}>
          <button type="button" disabled={busy} onClick={onCancel} style={styles.cancel}>
            {cancelText}
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={onConfirm}
            style={{ ...styles.confirm, ...(danger ? styles.dangerButton : styles.normalButton) }}
          >
            {busy ? "Working..." : confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}

const styles = {
  backdrop: {
    position: "fixed", inset: 0, zIndex: 10000, display: "grid", placeItems: "center",
    padding: "22px", background: "rgba(9,12,22,.56)", backdropFilter: "blur(8px)",
  },
  modal: {
    width: "min(440px,100%)", overflow: "hidden", borderRadius: "24px",
    background: "rgba(255,255,255,.98)", border: "1px solid rgba(255,255,255,.72)",
    boxShadow: "0 30px 100px rgba(9,13,25,.32)",
  },
  body: { padding: "27px 27px 18px" },
  icon: {
    width: "45px", height: "45px", display: "grid", placeItems: "center",
    marginBottom: "18px", borderRadius: "14px", fontSize: "20px", fontWeight: 950,
  },
  dangerIcon: { background: "#fff0f2", color: "#c94c63" },
  normalIcon: { background: "#f0eeff", color: "#6554df" },
  eyebrow: { color: "#9b91ac", fontSize: "8px", fontWeight: 900, letterSpacing: ".15em" },
  title: { margin: "6px 0 0", color: "#1d2230", fontSize: "21px", letterSpacing: "-.035em" },
  message: { margin: "10px 0 0", color: "#747b8c", fontSize: "12px", lineHeight: 1.65 },
  actions: { display: "flex", justifyContent: "flex-end", gap: "9px", padding: "15px 27px 24px" },
  cancel: {
    minHeight: "42px", padding: "0 17px", borderRadius: "11px", border: "1px solid #e1e4eb",
    background: "#fff", color: "#626978", fontSize: "10px", fontWeight: 850, cursor: "pointer",
  },
  confirm: {
    minHeight: "42px", padding: "0 18px", border: 0, borderRadius: "11px",
    color: "#fff", fontSize: "10px", fontWeight: 900, cursor: "pointer",
  },
  dangerButton: {
    background: "linear-gradient(135deg,#df6076,#bd4057)",
    boxShadow: "0 10px 24px rgba(189,64,87,.22)",
  },
  normalButton: {
    background: "linear-gradient(135deg,#7d6dff,#5c49ed)",
    boxShadow: "0 10px 24px rgba(97,77,238,.22)",
  },
};

export default ConfirmModal;
