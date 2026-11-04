const { createApp } = require('./app');

const PORT = process.env.PORT || 3000;
const app = createApp();

app.listen(PORT, () => {
  console.log(`Medication & Health Stock Tracking App running on http://localhost:${PORT}`);
});
