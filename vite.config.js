import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import fs from 'fs'
import path from 'path'

// Custom middleware to stop Vite from double-decompressing Kuromoji files
const kuromojiRawPlugin = () => {
  return {
    name: 'kuromoji-raw-plugin',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        // If the app asks for a dictionary file...
        if (req.url.startsWith('/dict/') && req.url.endsWith('.gz')) {
          const filePath = path.join(process.cwd(), 'public', req.url);
          try {
            const stat = fs.statSync(filePath);
            // Send it as a raw binary stream with NO gzip headers
            res.setHeader('Content-Type', 'application/octet-stream');
            res.setHeader('Content-Length', stat.size);
            
            const stream = fs.createReadStream(filePath);
            stream.pipe(res);
            return; // Stop Vite from doing anything else to this file
          } catch (e) {
            next();
          }
        } else {
          next();
        }
      });
    }
  };
};

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    kuromojiRawPlugin() // Activate our fix
  ],
})