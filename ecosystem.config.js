module.exports = {
  apps: [
    {
      name: "receiver",
      script: "npm",
      args: "start",
      env: {
        PORT: 3100,
        NODE_ENV: "production",
      },
    },
  ],
};
