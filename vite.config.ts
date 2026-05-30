import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import fs from 'fs';
import {defineConfig} from 'vite';

function sponsorFilesPlugin() {
  const sponsorfilesDir = path.resolve(__dirname, 'sponsorfiles');
  const manifestPath = path.resolve(__dirname, 'src/data/sponsorFilesManifest.json');

  const updateManifest = () => {
    if (fs.existsSync(sponsorfilesDir)) {
      const files = fs.readdirSync(sponsorfilesDir);
      fs.mkdirSync(path.dirname(manifestPath), { recursive: true });
      fs.writeFileSync(manifestPath, JSON.stringify(files, null, 2));
    }
  };

  return {
    name: 'sponsor-files-plugin',
    buildStart() {
      updateManifest();
    },
    configureServer(server) {
      updateManifest();
      server.middlewares.use('/sponsorfiles', (req, res, next) => {
        const urlPath = req.url?.split('?')[0] || '';
        const filePath = path.join(sponsorfilesDir, urlPath);
        if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
          const ext = path.extname(filePath).toLowerCase();
          const mimeTypes: Record<string, string> = {
            '.png': 'image/png',
            '.jpg': 'image/jpeg',
            '.jpeg': 'image/jpeg',
            '.gif': 'image/gif',
            '.svg': 'image/svg+xml',
          };
          res.setHeader('Content-Type', mimeTypes[ext] || 'application/octet-stream');
          fs.createReadStream(filePath).pipe(res);
        } else {
          next();
        }
      });

      // Serve transitions.cfg from root
      server.middlewares.use('/transitions.cfg', (req, res, next) => {
        const filePath = path.resolve(__dirname, 'transitions.cfg');
        if (fs.existsSync(filePath)) {
          res.setHeader('Content-Type', 'text/plain; charset=utf-8');
          fs.createReadStream(filePath).pipe(res);
        } else {
          next();
        }
      });

      // Serve testmode-transitions.cfg from root
      server.middlewares.use('/testmode-transitions.cfg', (req, res, next) => {
        const filePath = path.resolve(__dirname, 'testmode-transitions.cfg');
        if (fs.existsSync(filePath)) {
          res.setHeader('Content-Type', 'text/plain; charset=utf-8');
          fs.createReadStream(filePath).pipe(res);
        } else {
          next();
        }
      });
    },
    closeBundle() {
      // Copy sponsorfiles
      const destDir = path.resolve(__dirname, 'dist', 'sponsorfiles');
      if (fs.existsSync(sponsorfilesDir)) {
        fs.mkdirSync(destDir, { recursive: true });
        const files = fs.readdirSync(sponsorfilesDir);
        for (const file of files) {
          fs.copyFileSync(path.join(sponsorfilesDir, file), path.join(destDir, file));
        }
      }

      // Copy transitions.cfg
      const destFile = path.resolve(__dirname, 'dist', 'transitions.cfg');
      const srcFile = path.resolve(__dirname, 'transitions.cfg');
      if (fs.existsSync(srcFile)) {
        fs.copyFileSync(srcFile, destFile);
      }
      
      // Copy testmode-transitions.cfg
      const destTestFile = path.resolve(__dirname, 'dist', 'testmode-transitions.cfg');
      const srcTestFile = path.resolve(__dirname, 'testmode-transitions.cfg');
      if (fs.existsSync(srcTestFile)) {
        fs.copyFileSync(srcTestFile, destTestFile);
      }
    }
  };
}

export default defineConfig(() => {
  return {
    plugins: [react(), tailwindcss(), sponsorFilesPlugin()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      hmr: process.env.DISABLE_HMR !== 'true',
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
