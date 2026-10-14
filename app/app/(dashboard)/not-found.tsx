import { NotFoundMessage } from "@/components/NotFoundMessage";

export default function TallerNotFound() {
  return (
    <NotFoundMessage
      backHref="/app"
      backLabel="Volver a Taller"
      text="No encontramos esta pantalla: puede que el proyecto o el elemento se haya borrado o que no tengas acceso."
    />
  );
}
