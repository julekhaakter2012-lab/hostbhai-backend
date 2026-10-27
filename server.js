const express = require('express');
const cors = require('cors');
const multer = require('multer');
const session = require('express-session');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 10000;

app.use(cors({ origin: true, credentials: true }));
app.use(express.json());
app.use(session({
  secret: 'hostbhai-secret-key',
  resave: false,
  saveUninitialized: false,
  cookie: { secure: false, maxAge: 24 * 60 * 60 * 1000 }
}));

const uploadDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir);

const upload = multer({ dest: uploadDir });
const users = {};

app.post('/register', (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) return res.status(400).send('Username and password required');
  if (users[username]) return res.status(400).send('Username already exists');
  users[username] = { password, projects: [] };
  res.send('Registered successfully');
});

app.post('/login', (req, res) => {
  const { username, password, remember } = req.body;
  if (!users[username] || users[username].password !== password) {
    return res.status(401).send('Invalid username or password');
  }
  req.session.username = username;
  if (remember === 'yes') req.session.cookie.maxAge = 7 * 24 * 60 * 60 * 1000;
  res.send('Login successful');
});

app.get('/logout', (req, res) => {
  req.session.destroy();
  res.send('Logged out');
});

app.get('/api/user', (req, res) => {
  if (!req.session.username) return res.status(401).send('Not logged in');
  const user = users[req.session.username];
  res.json({ username: req.session.username, projects: user.projects });
});

app.post('/upload', upload.single('siteFile'), (req, res) => {
  if (!req.session.username) return res.status(401).send('Not logged in');
  const { siteName, isUpdate } = req.body;
  const file = req.file;
  if (!file || !siteName) return res.status(400).send('File and project name required');

  const user = users[req.session.username];
  const existing = user.projects.find(p => (typeof p === 'string' ? p : p.name) === siteName);
  const version = Date.now().toString();
  const finalPath = path.join(uploadDir, siteName + '.html');
  fs.renameSync(file.path, finalPath);

  if (existing) {
    const proj = typeof existing === 'string' ? { name: existing, versions: [] } : existing;
    proj.versions = proj.versions || [];
    proj.versions.push(version);
  } else {
    user.projects.push({ name: siteName, versions: [] });
  }
  res.send('Upload successful');
});

app.post('/api/delete', (req, res) => {
  if (!req.session.username) return res.status(401).send('Not logged in');
  const { siteName } = req.body;
  const user = users[req.session.username];
  user.projects = user.projects.filter(p => (typeof p === 'string' ? p : p.name) !== siteName);
  const filePath = path.join(uploadDir, siteName + '.html');
  if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
  res.send('Deleted');
});

app.post('/api/rename-project', (req, res) => {
  if (!req.session.username) return res.status(401).send('Not logged in');
  const { oldName, newName } = req.body;
  const user = users[req.session.username];
  const proj = user.projects.find(p => (typeof p === 'string' ? p : p.name) === oldName);
  if (!proj) return res.status(404).send('Project not found');
  if (typeof proj === 'string') {
    const idx = user.projects.indexOf(proj);
    user.projects[idx] = newName;
  } else {
    proj.name = newName;
  }
  const oldPath = path.join(uploadDir, oldName + '.html');
  const newPath = path.join(uploadDir, newName + '.html');
  if (fs.existsSync(oldPath)) fs.renameSync(oldPath, newPath);
  res.send('Renamed');
});

app.get('/:projectName', (req, res) => {
  const filePath = path.join(uploadDir, req.params.projectName + '.html');
  if (fs.existsSync(filePath)) res.sendFile(filePath);
  else res.status(404).send('Project not found');
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on port ${PORT}`);
});
