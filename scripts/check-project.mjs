import { existsSync } from "node:fs";
const required=["package.json","src/app/layout.tsx","database/coffee_game_satarkhan.sql","public/icons/icon-192.png",".env.example"];
let failed=false;
for(const file of required){const ok=existsSync(file);console.log(`${ok?"OK":"MISSING"} ${file}`);if(!ok)failed=true;}
if(failed)process.exit(1);
console.log("Project structure check passed.");
