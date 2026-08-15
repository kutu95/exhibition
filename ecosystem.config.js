const path = require("path");

const root = __dirname;
const workerPython = path.join(root, ".worker-venv", "bin", "python3");

module.exports = {
  apps: [
    {
      name: "georgette-exhibition",
      script: "npm",
      args: "start",
      cwd: root,
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: "512M",
      env: {
        NODE_ENV: "production",
        PORT: 3007,
        HOSTNAME: "127.0.0.1",
        APP_ROOT: root,
        // Explicit: PM2 process env overrides .env* files. Keep Stripe live in production.
        CHECKOUT_BYPASS_STRIPE: "false",
        PURCHASES_LAN_ONLY: "false",
      },
      error_file: "./logs/pm2-error.log",
      out_file: "./logs/pm2-out.log",
      log_date_format: "YYYY-MM-DD HH:mm:ss",
    },
    {
      name: "georgette-exhibition-worker",
      script: path.join(root, "worker", "fulfilment_worker.py"),
      interpreter: workerPython,
      cwd: root,
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: "512M",
      env: {
        APP_ROOT: root,
        WORKER_TEMP_DIR: "/tmp/exhibition-worker",
      },
      error_file: "./logs/worker-error.log",
      out_file: "./logs/worker-out.log",
      log_date_format: "YYYY-MM-DD HH:mm:ss",
    },
  ],
};
