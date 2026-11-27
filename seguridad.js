const FIREBASE_CONFIG = {
  apiKey: "AIzaSyCVvZnjNKRxhr9FkZL-yiQpvNFJk7iZkV8",
  authDomain: "recetario-saludable-9f05e.firebaseapp.com",
  projectId: "recetario-saludable-9f05e",
  storageBucket: "recetario-saludable-9f05e.firebasestorage.app",
  messagingSenderId: "429176580702",
  appId: "1:429176580702:web:913dff5aab6a69549562cf"
};

window.FIREBASE_CONFIG = FIREBASE_CONFIG;

if (typeof firebase !== "undefined" && !firebase.apps.length) {
  firebase.initializeApp(FIREBASE_CONFIG);
}

window.RecetarioSeguridad = (function () {
  const CLAVE_ACCESO = "recetario_acceso_v1";

  function obtenerAccesoLocal() {
    try {
      const raw = localStorage.getItem(CLAVE_ACCESO);
      if (!raw) return null;
      const data = JSON.parse(raw);
      if (data && data.codigo && data.dispositivoId) return data;
      return null;
    } catch (e) {
      return null;
    }
  }

  function guardarAccesoLocal(codigo, dispositivoId) {
    try {
      localStorage.setItem(
        CLAVE_ACCESO,
        JSON.stringify({
          codigo: codigo,
          dispositivoId: dispositivoId,
          activadoEn: new Date().toISOString()
        })
      );
    } catch (e) {}
  }

  function limpiarAccesoLocal() {
    try {
      localStorage.removeItem(CLAVE_ACCESO);
    } catch (e) {}
  }

  function generarIdDispositivo() {
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";
    let id = "dev_";
    for (let i = 0; i < 20; i++) {
      id += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return id;
  }

  async function activarCodigo(codigoIngresado) {
    const codigo = (codigoIngresado || "").trim().toUpperCase();
    if (codigo.length < 4) {
      throw new Error("Ingresa un código de acceso válido.");
    }

    if (typeof firebase === "undefined" || !firebase.firestore) {
      throw new Error("No se pudo conectar con el servidor de validación. Verifica tu conexión a internet.");
    }

    const db = firebase.firestore();
    const docRef = db.collection("codigos_acceso").doc(codigo);
    const dispositivoId = generarIdDispositivo();

    await db.runTransaction(async (transaction) => {
      const doc = await transaction.get(docRef);

      if (!doc.exists) {
        throw new Error("Código incorrecto. Revisa que esté bien escrito.");
      }

      const data = doc.data();

      if (data.activo !== true) {
        throw new Error("Este código fue desactivado por el administrador.");
      }

      if (data.usado === true) {
        throw new Error("Este código ya fue utilizado en otro dispositivo.");
      }

      if (data.expiraEn && typeof data.expiraEn.toDate === "function") {
        if (data.expiraEn.toDate().getTime() < Date.now()) {
          throw new Error("Este código ha vencido. Solicita un nuevo código.");
        }
      }

      transaction.update(docRef, {
        usado: true,
        usadoEn: firebase.firestore.FieldValue.serverTimestamp(),
        dispositivoId: dispositivoId
      });
    });

    guardarAccesoLocal(codigo, dispositivoId);
    return { ok: true, codigo: codigo };
  }

  async function verificarAccesoEnSegundoPlano(alRevocar) {
    const acceso = obtenerAccesoLocal();
    if (!acceso) return false;

    if (typeof firebase === "undefined" || !firebase.firestore) {
      return true;
    }

    try {
      const db = firebase.firestore();
      const doc = await db.collection("codigos_acceso").doc(acceso.codigo).get();

      if (!doc.exists) {
        limpiarAccesoLocal();
        if (typeof alRevocar === "function") {
          alRevocar("Tu acceso fue revocado. Ingresa un nuevo código.");
        }
        return false;
      }

      const data = doc.data();
      if (data.activo !== true || data.dispositivoId !== acceso.dispositivoId) {
        limpiarAccesoLocal();
        if (typeof alRevocar === "function") {
          alRevocar("Este acceso fue desactivado por el administrador.");
        }
        return false;
      }

      return true;
    } catch (e) {
      // Si el usuario está sin internet momentáneamente, conserva el acceso ya validado
      return true;
    }
  }

  return {
    obtenerAccesoLocal,
    limpiarAccesoLocal,
    activarCodigo,
    verificarAccesoEnSegundoPlano
  };
})();