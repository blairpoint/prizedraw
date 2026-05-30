import express from "express";
import path from "path";
import fs from "fs";
import { createServer as createViteServer } from "vite";
import nodemailer from "nodemailer";
import dotenv from "dotenv";

// Fallback to .env.example if user puts their credentials there directly
dotenv.config({ path: '.env.example', override: true });
// Load actual .env if present (e.g., from AI Studio secrets)
dotenv.config({ override: true });

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());
  app.use(express.text({ type: "text/plain" }));

  // Make sure the logs directory exists, fallback for read-only environments like Cloud Run
  let logsDir = path.resolve(process.cwd(), '../logs');
  try {
    if (!fs.existsSync(logsDir)) {
      fs.mkdirSync(logsDir, { recursive: true });
    }
  } catch (err) {
    console.warn(`WARNING: Could not create directory at ${logsDir}, falling back to /tmp/logs due to restricted filesystem.`);
    logsDir = '/tmp/logs';
    if (!fs.existsSync(logsDir)) {
      fs.mkdirSync(logsDir, { recursive: true });
    }
  }
  const historyLogPath = path.join(logsDir, 'history.log');
  const emailLogPath = path.join(logsDir, 'email.log');

  const kvPath = path.join(logsDir, 'kvstore.json');
  function readKV() {
    try {
      if (fs.existsSync(kvPath)) {
        return JSON.parse(fs.readFileSync(kvPath, 'utf8'));
      }
    } catch {}
    return {};
  }
  function writeKV(data: any) {
    try { fs.writeFileSync(kvPath, JSON.stringify(data), 'utf8'); } catch {}
  }

  // API routes FIRST
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok" });
  });

  app.put("/api/kv/:key", (req, res) => {
    const kv = readKV();
    // req.body can be string (from express.text) or object (from express.json)
    kv[req.params.key] = req.body;
    writeKV(kv);
    res.json({ success: true });
  });

  app.get("/api/kv/:key", (req, res) => {
    const kv = readKV();
    const val = kv[req.params.key];
    if (val !== undefined) {
      if (typeof val === 'object') {
        res.json(val);
      } else {
        res.type('text/plain').send(String(val));
      }
    } else {
      res.status(404).send("Not found");
    }
  });

  app.post("/api/history", (req, res) => {
    try {
      const { id, round, winner, participantId, participantEmail, prize, sponsor, timestamp } = req.body;
      const logLine = JSON.stringify({ id, round, winner, participantId, participantEmail, prize, sponsor, timestamp }) + "\n";
      fs.appendFileSync(historyLogPath, logLine, 'utf8');

      // Send email to blair.robson@gmail.com if SMTP is configured
      if (process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS) {
        const transporter = nodemailer.createTransport({
          host: process.env.SMTP_HOST,
          port: parseInt(process.env.SMTP_PORT || '587', 10),
          secure: process.env.SMTP_PORT === '465',
          auth: {
            user: process.env.SMTP_USER,
            pass: process.env.SMTP_PASS,
          },
        });

        const mailOptions = {
          from: process.env.SMTP_USER,
          to: 'blair.robson@gmail.com',
          subject: `New Prize Winner: ${winner} won ${prize}!`,
          text: `A new prize has been drawn!\n\nWinner: ${winner}\nPrize: ${prize}\nContributor/Sponsor: ${sponsor}\nRound: ${round}\nTimestamp: ${timestamp}`,
          html: `<p>A new prize has been drawn!</p><ul><li><strong>Winner:</strong> ${winner}</li><li><strong>Prize:</strong> ${prize}</li><li><strong>Contributor/Sponsor:</strong> ${sponsor}</li><li><strong>Round:</strong> ${round}</li><li><strong>Timestamp:</strong> ${timestamp}</li></ul>`,
          attachments: [
            {
              filename: 'history.log',
              path: historyLogPath
            }
          ]
        };

        transporter.sendMail(mailOptions).then(info => {
          const emailLogLine = JSON.stringify({
            timestamp: new Date().toISOString(),
            recipient: mailOptions.to,
            subject: mailOptions.subject,
            status: 'success',
            messageId: info.messageId
          }) + "\n";
          fs.appendFileSync(emailLogPath, emailLogLine, 'utf8');
        }).catch(err => {
          console.error("Failed to send winner email:", err);
          const emailLogLine = JSON.stringify({
            timestamp: new Date().toISOString(),
            recipient: mailOptions.to,
            subject: mailOptions.subject,
            status: 'failed',
            error: err.message
          }) + "\n";
          fs.appendFileSync(emailLogPath, emailLogLine, 'utf8');
        });
      }

      res.json({ success: true });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.post("/api/report", (req, res) => {
    try {
      const { history, title } = req.body;
      
      let htmlContent = `<h2>${title}</h2>`;
      htmlContent += `<table border="1" cellpadding="5" cellspacing="0">`;
      htmlContent += `<tr><th>Round</th><th>Winner</th><th>Email</th><th>Prize</th><th>Sponsor</th><th>Time</th></tr>`;
      
      history.forEach((entry: any) => {
        htmlContent += `<tr>
          <td>${entry.round}</td>
          <td>${entry.winner}</td>
          <td>${entry.participantEmail}</td>
          <td>${entry.prize}</td>
          <td>${entry.sponsor}</td>
          <td>${entry.timestamp}</td>
        </tr>`;
      });
      
      htmlContent += `</table>`;

      if (process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS) {
        const transporter = nodemailer.createTransport({
          host: process.env.SMTP_HOST,
          port: parseInt(process.env.SMTP_PORT || '587', 10),
          secure: process.env.SMTP_PORT === '465',
          auth: {
            user: process.env.SMTP_USER,
            pass: process.env.SMTP_PASS,
          },
        });

        const mailOptions = {
          from: process.env.SMTP_USER,
          to: 'events@spotlightnz.com',
          subject: title,
          html: htmlContent,
        };

        transporter.sendMail(mailOptions).then(info => {
          const emailLogLine = JSON.stringify({
            timestamp: new Date().toISOString(),
            recipient: mailOptions.to,
            subject: mailOptions.subject,
            status: 'success',
            messageId: info.messageId
          }) + "\n";
          fs.appendFileSync(emailLogPath, emailLogLine, 'utf8');
        }).catch(err => {
          console.error("Failed to send report email:", err);
          const emailLogLine = JSON.stringify({
            timestamp: new Date().toISOString(),
            recipient: mailOptions.to,
            subject: mailOptions.subject,
            status: 'failed',
            error: err.message
          }) + "\n";
          fs.appendFileSync(emailLogPath, emailLogLine, 'utf8');
        });
      }
      res.json({ status: "ok" });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.get("/api/emails", (req, res) => {
    try {
      if (fs.existsSync(emailLogPath)) {
        const content = fs.readFileSync(emailLogPath, 'utf8');
        const logs = content.split('\n').filter(line => line.trim() !== '').map(line => JSON.parse(line));
        res.json({ logs });
      } else {
        res.json({ logs: [] });
      }
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.get("/api/history", (req, res) => {
    try {
      if (fs.existsSync(historyLogPath)) {
        const content = fs.readFileSync(historyLogPath, 'utf8');
        const logs = content.split('\n').filter(line => line.trim() !== '').map(line => JSON.parse(line));
        res.json({ logs });
      } else {
        res.json({ logs: [] });
      }
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);

    // Send startup email
    if (process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS) {
      const transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: parseInt(process.env.SMTP_PORT || '587', 10),
        secure: process.env.SMTP_PORT === '465',
        auth: {
          user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASS,
        },
      });

      const mailOptions = {
        from: process.env.SMTP_USER,
        to: 'blair.robson@gmail.com',
        subject: 'starting draw',
        text: `starting draw - Timestamp: ${new Date().toISOString()}`,
      };

      transporter.sendMail(mailOptions).then(info => {
        const emailLogLine = JSON.stringify({
          timestamp: new Date().toISOString(),
          recipient: mailOptions.to,
          subject: mailOptions.subject,
          status: 'success',
          messageId: info.messageId
        }) + "\n";
        fs.appendFileSync(emailLogPath, emailLogLine, 'utf8');
      }).catch(err => {
        console.error("Failed to send startup email:", err);
        const emailLogLine = JSON.stringify({
          timestamp: new Date().toISOString(),
          recipient: mailOptions.to,
          subject: mailOptions.subject,
          status: 'failed',
          error: err.message
        }) + "\n";
        fs.appendFileSync(emailLogPath, emailLogLine, 'utf8');
      });
    }
  });
}

startServer();
