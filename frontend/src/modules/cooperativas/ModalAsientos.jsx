import { useEffect } from "react";

export default function ModalAsientos({
  titulo,
  descripcion,
  children,
  onClose,
  acciones,
  ancho = 560,
}) {
  useEffect(() => {
    const cerrarConEscape = (e) => {
      if (e.key === "Escape") onClose();
    };

    document.addEventListener("keydown", cerrarConEscape);

    return () => {
      document.removeEventListener("keydown", cerrarConEscape);
    };
  }, [onClose]);

  return (
    <div
      role="presentation"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 9999,
        background: "rgba(15, 23, 42, 0.55)",
        backdropFilter: "blur(4px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 16,
      }}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-label={titulo}
        style={{
          width: "100%",
          maxWidth: ancho,
          maxHeight: "85vh",
          overflow: "auto",
          background: "#fff",
          borderRadius: 18,
          boxShadow: "0 24px 70px rgba(0,0,0,.2)",
          color: "#17243a",
        }}
      >
        <header
          style={{
            padding: 22,
            borderBottom: "1px solid #e2e8f0",
            display: "flex",
            justifyContent: "space-between",
            gap: 15,
          }}
        >
          <div>
            <h3 style={{ margin: 0, fontSize: 21 }}>{titulo}</h3>
            {descripcion && (
              <p style={{ color: "#64748b", fontSize: 13 }}>
                {descripcion}
              </p>
            )}
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar"
            style={{
              border: 0,
              background: "#f1f5f9",
              borderRadius: 9,
              width: 36,
              height: 36,
              fontSize: 24,
              cursor: "pointer",
            }}
          >
            ×
          </button>
        </header>

        <div style={{ padding: 22 }}>{children}</div>

        {acciones && (
          <footer
            style={{
              padding: 18,
              borderTop: "1px solid #e2e8f0",
              display: "flex",
              justifyContent: "flex-end",
              gap: 10,
              flexWrap: "wrap",
            }}
          >
            {acciones}
          </footer>
        )}
      </section>
    </div>
  );
}
