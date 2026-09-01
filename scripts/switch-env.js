// Cambia entre la base de datos de desarrollo y la de producción para
// trabajar en local, copiando la copia de seguridad correspondiente
// encima de .env. Uso: npm run env:dev  /  npm run env:prod
const fs = require("fs");
const path = require("path");

const target = process.argv[2];
if (target !== "dev" && target !== "prod") {
  console.error('Uso: node scripts/switch-env.js dev|prod');
  process.exit(1);
}

const root = path.join(__dirname, "..");
const src = path.join(root, `.env.${target}-backup`);
const dest = path.join(root, ".env");

if (!fs.existsSync(src)) {
  console.error(`No se encuentra ${src}`);
  process.exit(1);
}

fs.copyFileSync(src, dest);

if (target === "prod") {
  console.log("⚠️  .env apunta ahora a PRODUCCIÓN — cualquier cambio local afecta a la web real.");
} else {
  console.log("✔ .env apunta ahora a DESARROLLO — seguro para probar sin riesgo.");
}
console.log('Reinicia "npm run dev" para que se aplique.');
