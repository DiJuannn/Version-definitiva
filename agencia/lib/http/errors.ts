export class AppError extends Error {
  constructor(
    public status: number,
    message: string,
    public code: string = "error",
  ) {
    super(message);
  }
}

// Fuera de alcance se responde 404 (no 403) para no revelar que el recurso existe.
export const notFound = (what = "Recurso") => new AppError(404, `${what} no encontrado`, "not_found");
export const forbidden = (msg = "No tienes permiso para esta acción") => new AppError(403, msg, "forbidden");
export const badRequest = (msg: string) => new AppError(400, msg, "bad_request");
export const conflict = (msg: string) => new AppError(409, msg, "conflict");
export const unauthorized = () => new AppError(401, "Inicia sesión para continuar", "unauthorized");
