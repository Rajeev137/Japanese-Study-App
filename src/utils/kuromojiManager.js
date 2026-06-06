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

    kuromoji
      .builder({ dicPath: "/dict" })
      .build((err, tokenizer) => {
        isInitializing = false;

        if (err) {
          initializationQueue.forEach((p) => p.reject(err));
          initializationQueue = [];
          return reject(err);
        }

        globalTokenizer = tokenizer;
        resolve(tokenizer);

        // Tell all waiting components it's ready
        initializationQueue.forEach((p) => p.resolve(tokenizer));
        initializationQueue = [];
      });
  });
};