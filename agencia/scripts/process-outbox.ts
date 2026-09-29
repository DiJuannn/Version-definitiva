// Procesa la bandeja de emails una vez (para cron del sistema o pruebas).
// Uso: npm run outbox
import { processOutbox } from "../lib/notifications/outbox";

processOutbox(100)
  .then((r) => {
    console.log(r);
    process.exit(0);
  })
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
