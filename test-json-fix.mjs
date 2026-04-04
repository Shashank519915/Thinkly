import { normalizeAIJSON } from './lib/ai/responseParser.js';

const failingJSON = `{
  "nodes": [
    {
      "id": "process_order",
      "payload": {
        "status": "processing",
        "quantityChange": -{{$input.quantity}}
      }
    }
  ]
}`;

console.log("Original Failing JSON:");
console.log(failingJSON);

const normalized = normalizeAIJSON(failingJSON);

console.log("\nNormalized JSON:");
console.log(normalized);

try {
  JSON.parse(normalized);
  console.log("\n✅ SUCCESS: JSON is now valid and parseable.");
} catch (e) {
  console.log(`\n❌ FAILURE: Still invalid. ${e.message}`);
}
