const fs = require('fs');
const path = require('path');

const file = path.resolve(process.cwd(), 'docs/roadmap/backlog.json');
const backlog = JSON.parse(fs.readFileSync(file, 'utf8'));

const expectedTotal = backlog.summary.reduce((sum, item) => sum + item.total, 0);
const required = ['id', 'epic', 'area', 'priority', 'role', 'title', 'acceptance', 'release', 'status'];
const ids = new Set();

if (backlog.total !== expectedTotal || backlog.tasks.length !== expectedTotal) {
  throw new Error(`Expected ${expectedTotal} tasks, got total=${backlog.total} length=${backlog.tasks.length}`);
}

for (const task of backlog.tasks) {
  for (const key of required) {
    if (!task[key]) throw new Error(`Task ${task.id || '<missing-id>'} missing ${key}`);
  }
  if (ids.has(task.id)) throw new Error(`Duplicate task id ${task.id}`);
  ids.add(task.id);
  if (!['P0', 'P1', 'P2', 'P3'].includes(task.priority)) throw new Error(`Invalid priority ${task.priority}`);
  if (!/^Sprint (0[1-9]|1[0-9]|2[0-6])$/.test(task.release)) throw new Error(`Invalid release ${task.release}`);
}

console.log(`Roadmap backlog OK: ${backlog.tasks.length} tasks`);
