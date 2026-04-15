// app.js  (CommonJS version)
const express = require("express");
const cors = require("cors");
const cookieParser = require("cookie-parser"); 

const authRouter = require("./routes/auth.route"); 
const courseRouter = require("./routes/course.route");
const enrollmentRouter = require("./routes/enrollment.route");
const attendanceRouter = require("./routes/attendance.route");
const studentRouter = require("./routes/student.route");
const analyticsRouter = require("./routes/analytics.route");;
const adminRouter = require("./routes/adminRoutes");

const app = express();
app.set("trust proxy", 1);
app.use(
  cors({
    origin: ["https://attendance.aastugibigubae.com", "https://attendance-managment-system-bice.vercel.app"],
    credentials: true,
  })
);


app.use(express.json());
app.use(cookieParser());
app.use(express.urlencoded({ extended: false }));


app.use("/api/v1", authRouter);
app.use("/api/v1/course",courseRouter);
app.use("/api/v1/enrollment",enrollmentRouter);
app.use("/api/v1/attendance",attendanceRouter);
app.use("/api/v1/student",studentRouter);
app.use("/api/v1/admin", adminRouter)

app.use("/api/v1/analytics",analyticsRouter);

module.exports = app;