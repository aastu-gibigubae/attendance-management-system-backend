const app = require("./app.js");
const { PORT, NODE_ENV } = require("./config/env.js");
const db = require("./models"); // Sequelize instance
const PROD_URL = "https://attendance.aastugibigubae.com";

app.listen(PORT, async () => {
  try {
    await db.sequelize.authenticate();
    console.log("✅ Database connected successfully!");
  } catch (err) {
    console.error("❌ Error connecting to the database:", err);
    process.exit(1); 
  }

  if (NODE_ENV === "production") {
    console.log(process.env.DATABASE_URL)
    console.log(`🚀 Server is running in production mode at ${PROD_URL}`);
  } else {
    console.log(`🚀 Server is running in development mode at http://localhost:${PORT}`);
  }
});
