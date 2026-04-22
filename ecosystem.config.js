module.exports = {
  apps: [
    {
      name: "georgette-exhibition",
      script: ".next/standalone/server.js",
      cwd: __dirname,
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: "512M",
      env: {
        NODE_ENV: "production",
        PORT: 3007,
        HOSTNAME: "127.0.0.1",
        APP_ROOT: __dirname,
      },
      error_file: "./logs/pm2-error.log",
      out_file: "./logs/pm2-out.log",
      log_date_format: "YYYY-MM-DD HH:mm:ss",
    },
  ],
};
