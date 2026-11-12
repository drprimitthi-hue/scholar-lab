import { generateKeys } from "../src/lib/licence";
const k = generateKeys();
console.log("Add these to the Control Centre's Vercel environment variables (mark both Sensitive):\n");
console.log(`LICENCE_PRIVATE_KEY=${k.privateKey}`);
console.log(`LICENCE_PUBLIC_KEY=${k.publicKey}`);
console.log("\nThe PUBLIC key also goes into every lab's environment (the Control Centre shows it on each lab page).");
console.log("Never share the PRIVATE key. If it leaks, generate new keys and re-issue all licences.");
