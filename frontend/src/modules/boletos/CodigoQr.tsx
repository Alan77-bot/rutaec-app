import { useEffect, useState } from "react";
import QRCode from "qrcode";

// El QR solo lleva este prefijo y el token del boleto (sin nombres ni documentos).
// Debe coincidir con contenidoQr() del backend (boletos.qr.ts).
const PREFIJO_QR = "RUTAEC:";

interface Props {
  token: string;
  // Un boleto anulado se muestra en gris para que no parezca válido.
  anulado?: boolean;
  tamano?: number;
}

// El resultado se guarda junto al token que lo generó: si el token cambia,
// el resultado anterior deja de usarse sin necesidad de reiniciar el estado.
interface Resultado {
  token: string;
  tamano: number;
  imagen: string | null;
}

export default function CodigoQr({ token, anulado = false, tamano = 220 }: Props) {
  const [resultado, setResultado] = useState<Resultado | null>(null);

  useEffect(() => {
    let activo = true;

    QRCode.toDataURL(`${PREFIJO_QR}${token}`, {
      margin: 1,
      width: tamano,
      errorCorrectionLevel: "M",
      color: { dark: "#1b3f68" },
    })
      .then((imagen) => activo && setResultado({ token, tamano, imagen }))
      .catch(() => activo && setResultado({ token, tamano, imagen: null }));

    return () => {
      activo = false;
    };
  }, [token, tamano]);

  const vigente = resultado?.token === token && resultado.tamano === tamano;
  if (!vigente) return null;

  if (!resultado.imagen) return <p role="alert">No se pudo generar el código QR.</p>;

  return (
    <img
      src={resultado.imagen}
      width={tamano}
      height={tamano}
      alt="Código QR del boleto"
      className={anulado ? "qr-gris" : ""}
    />
  );
}
