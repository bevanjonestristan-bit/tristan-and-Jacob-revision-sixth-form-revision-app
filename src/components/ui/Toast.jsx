import React, { useEffect } from "react";

function Toast({ toast, onClose }) {
  useEffect(() => {
    if (!toast) return undefined;
    const timer = window.setTimeout(() => onClose?.(), toast.duration || 2800);
    return () => window.clearTimeout(timer);
  }, [toast, onClose]);

  if (!toast) return null;

  const isError = toast.type === "error";

  return (
    <div role="status" style={{ ...styles.toast, ...(isError ? styles.error : styles.normal) }}>
      <span style={styles.icon}>{isError ? "!" : "OK"}</span>
      <div>
        {toast.title && <div style={styles.title}>{toast.title}</div>}
        <div style={styles.message}>{toast.message}</div>
      </div>
    </div>
  );
}

const styles = {
  toast: {
    position: "fixed", right: "26px", bottom: "26px", zIndex: 10001,
    display: "flex", alignItems: "center", gap: "11px", minWidth: "260px",
    maxWidth: "390px", padding: "14px 16px", borderRadius: "15px", color: "#fff",
    border: "1px solid rgba(255,255,255,.1)", boxShadow: "0 18px 50px rgba(20,24,40,.24)",
  },
  normal: { background: "linear-gradient(135deg,#242a49,#181d31)" },
  error: { background: "linear-gradient(135deg,#c94c63,#a9354c)" },
  icon: {
    minWidth: "29px", height: "29px", padding: "0 6px", display: "grid", placeItems: "center",
    borderRadius: "9px", background: "rgba(255,255,255,.11)", fontSize: "8px", fontWeight: 950,
  },
  title: { fontSize: "10px", fontWeight: 900, marginBottom: "2px" },
  message: { fontSize: "11px", fontWeight: 750, lineHeight: 1.45 },
};

export default Toast;
