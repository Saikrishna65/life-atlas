import { writeFileSync } from "node:fs";
import { QUALITY_CASES } from "../../src/lib/atlas-ai/lab/cases";
const destination = process.argv[2];
if (!destination) throw new Error("Pass an output JSON path");
writeFileSync(destination, JSON.stringify(QUALITY_CASES, null, 2) + "\n");
console.log(`Exported ${QUALITY_CASES.length} synthetic quality cases`);
