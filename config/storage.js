const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '..', 'data');
let tempCounter = 0;

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function readJson(file) {
  ensureDir(DATA_DIR);
  const full = path.join(DATA_DIR, file);
  if (!fs.existsSync(full)) return [];
  const raw = fs.readFileSync(full, 'utf8');
  if (!raw.trim()) return [];
  try {
    return JSON.parse(raw);
  } catch (e) {
    const backup = full + '.corrupt-' + Date.now();
    fs.copyFileSync(full, backup);
    return [];
  }
}

function writeJson(file, data) {
  ensureDir(DATA_DIR);
  const full = path.join(DATA_DIR, file);
  const tmp = full + '.' + process.pid + '.' + Date.now() + '.' + (++tempCounter) + '.tmp';
  let fd;
  try {
    fd = fs.openSync(tmp, 'w');
    fs.writeFileSync(fd, JSON.stringify(data, null, 2), 'utf8');
    fs.fsyncSync(fd);
    fs.closeSync(fd);
    fd = undefined;
    fs.renameSync(tmp, full);
  } catch (err) {
    if (fd !== undefined) {
      try { fs.closeSync(fd); } catch (closeErr) { /* ignore */ }
    }
    try { fs.unlinkSync(tmp); } catch (unlinkErr) { /* ignore */ }
    throw err;
  }
}

function updateJson(file, updater) {
  const data = readJson(file);
  const next = typeof updater === 'function' ? updater(data) : updater;
  writeJson(file, next);
  return next;
}

function appendJsonl(file, record) {
  ensureDir(DATA_DIR);
  const full = path.join(DATA_DIR, file);
  fs.appendFileSync(full, JSON.stringify(record) + '\n', 'utf8');
}

module.exports = { readJson, writeJson, updateJson, appendJsonl, DATA_DIR };
