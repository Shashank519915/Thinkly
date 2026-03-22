import fs from 'fs';
const envFile = fs.readFileSync('.env.local', 'utf8');
const match = envFile.match(/GEMINI_API_KEY=(.*)/);
if (!match) {
  console.log("No key found");
  process.exit(1);
}
const key = match[1].trim();

try {
  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${key}`);
  const data = await res.json();
  if (data.models) {
    const names = data.models
      .filter(m => m.supportedGenerationMethods && m.supportedGenerationMethods.includes('generateContent'))
      .map(m => m.name.replace('models/', ''));
    console.log("AVAILABLE MODELS: ", names.join(", "));
  } else {
    console.log("Response:", data);
  }
} catch (e) {
  console.error(e);
}
