// Standalone verification for Surgical JSON Normalization
function normalizeAIJSON(text) {
  let clean = text;
  // Surgical Fix: Only targets colons preceded by a non-escaped quote
  clean = clean.replace(/(?<=[^\\]"):\s*(-?\{\{.*?\}\})(?=[ \t\n\r]*(?:[,}]|$))/g, (match, tag) => {
    return `: "${tag}"`;
  });
  return clean;
}

const failingJSON = `{
  "nodes": [
    {
      "id": "root_fix",
      "qty": -{{$input.qty}}
    },
    {
      "id": "should_ignore_string",
      "payload": "{ \\"items\\": {{$input.qty}} }"
    }
  ]
}`;

console.log("Testing Advanced JSON Normalizer...");

const normalized = normalizeAIJSON(failingJSON);

console.log("\nNormalized JSON Output:");
console.log(normalized);

try {
  const parsed = JSON.parse(normalized);
  console.log("\n✅ SUCCESS: JSON is now valid.");
  console.log("Root Fix (Should be quoted):", parsed.nodes[0].qty);
  console.log("String Sub-Tag (Should remain unquoted):", parsed.nodes[1].payload);
  
  if (parsed.nodes[1].payload.includes('\"items\": {{$input.qty}}')) {
    console.log("✅ VERIFIED: Escaped string was preserved without corruption.");
  } else {
    console.log("❌ ERROR: Escaped string was accidentally modified.");
  }

} catch (e) {
  console.log(`\n❌ FAILURE: Still invalid JSON! ${e.message}`);
}
