(function () {
  const CLAVE_ACCESO = "recetario_acceso_v1";
  const PROJECT_ID = "recetario-saludable-9f05e";
  const API_KEY = "AIzaSyCVvZnjNKRxhr9FkZL-yiQpvNFJk7iZkV8";

  function redirigirAlInicio() {
    try {
      document.documentElement.style.display = "none";
    } catch (e) {}
    window.location.replace("index.html");
  }

  function obtenerAccesoLocal() {
    try {
      const raw = localStorage.getItem(CLAVE_ACCESO);
      if (!raw) return null;
      const data = JSON.parse(raw);
      if (
        data &&
        typeof data.codigo === "string" &&
        data.codigo.trim().length >= 4 &&
        typeof data.dispositivoId === "string" &&
        data.dispositivoId.trim().length >= 8
      ) {
        return data;
      }
      return null;
    } catch (e) {
      return null;
    }
  }

  // 1. Bloqueo inmediato antes de renderizar la receta o reproducir audios
  const acceso = obtenerAccesoLocal();
  if (!acceso) {
    redirigirAlInicio();
    return;
  }

  // 2. Revalida si el usuario regresa usando el botón Atrás del navegador
  window.addEventListener("pageshow", function (evento) {
    if (evento.persisted && !obtenerAccesoLocal()) {
      redirigirAlInicio();
    }
  });

  // 3. Verificación en segundo plano contra Firestore (por si revocaste el código)
  if (location.protocol.startsWith("http")) {
    const url =
      "https://firestore.googleapis.com/v1/projects/" +
      PROJECT_ID +
      "/databases/(default)/documents/codigos_acceso/" +
      encodeURIComponent(acceso.codigo.trim().toUpperCase()) +
      "?key=" +
      encodeURIComponent(API_KEY);

    fetch(url, { cache: "no-store" })
      .then(function (res) {
        if (res.status === 404) {
          try {
            localStorage.removeItem(CLAVE_ACCESO);
          } catch (e) {}
          redirigirAlInicio();
          return null;
        }
        if (!res.ok) return null;
        return res.json();
      })
      .then(function (doc) {
        if (!doc || !doc.fields) return;

        const activo = doc.fields.activo && doc.fields.activo.booleanValue === true;
        const dispositivoRegistrado =
          doc.fields.dispositivoId && doc.fields.dispositivoId.stringValue;

        if (!activo || dispositivoRegistrado !== acceso.dispositivoId) {
          try {
            localStorage.removeItem(CLAVE_ACCESO);
          } catch (e) {}
          redirigirAlInicio();
        }
      })
      .catch(function () {
        // Si el teléfono está sin señal momentáneamente, conserva el acceso ya validado
      });
  }
})();