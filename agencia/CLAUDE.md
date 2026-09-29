@AGENTS.md

Notas para Claude Code:
- Para reiniciar el servidor de desarrollo, lánzalo en segundo plano y no uses `pkill -f "next dev"` desde un comando que contenga ese texto (se mataría el propio shell).
- Revisa visualmente con `node e2e/shot.mjs <email> <ruta> <nombre> [--mobile]` (contraseña demo por defecto; `PW=` para otras).
