const fs = require('fs');
// Let's check the indexer log output if there's any pm2 or nohup
const { execSync } = require('child_process');
try {
  console.log(execSync('tail -n 100 ~/.pm2/logs/*.log 2>/dev/null || echo "No pm2"').toString());
} catch(e) {}
