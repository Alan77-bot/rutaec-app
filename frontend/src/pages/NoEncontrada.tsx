import { Link } from "react-router-dom";

export default function NoEncontrada() {
  return (
    <main className="mx-auto max-w-5xl px-6 py-12">
      <h1 className="text-3xl font-bold">Página no encontrada</h1>
      <Link to="/" className="mt-4 inline-block text-blue-600 underline">
        Volver al inicio
      </Link>
    </main>
  );
}