import kuromoji from "kuromoji/build/kuromoji.js";

let globalTokenizer = null;
let isInitializing = false;
let initializationQueue = [];

export const loadDictionary = () => {
  return new Promise((resolve, reject) => {
    // 1. If it's already loaded, return it instantly
    if (globalTokenizer) {
      return resolve(globalTokenizer);
    }

    // 2. If it's currently downloading, wait in line
    if (isInitializing) {
      initializationQueue.push({ resolve, reject });
      return;
    }

    // 3. Start the download using a more reliable CDN
    isInitializing = true;
    console.log("Starting dictionary background download...");

    kuromoji
      .builder({ dicPath: "https://cdn.jsdelivr.net/npm/kuromoji@0.1.2/dict" })
      .build((err, tokenizer) => {
        isInitializing = false; // Free up the lock

        if (err) {
          console.error("Dictionary download failed:", err);
          initializationQueue.forEach((p) => p.reject(err));
          initializationQueue = [];
          return reject(err);
        }

        console.log("Dictionary loaded successfully!");
        globalTokenizer = tokenizer;
        resolve(tokenizer);

        // Tell all waiting components it's ready
        initializationQueue.forEach((p) => p.resolve(tokenizer));
        initializationQueue = [];
      });
  });
};