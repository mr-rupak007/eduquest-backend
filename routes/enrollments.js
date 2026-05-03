const router = require("express").Router();
const auth = require("../middleware/authMiddleware");
const { markAsCompleted } = require("../controllers/enrollmentController");

const {
  enrollCourse,
  getMyCourses,
  getDashboard,
  updateProgress
} = require("../controllers/enrollmentController");
const { markVideoDone } = require("../controllers/enrollmentController");

// enroll
router.post("/:courseId", auth, enrollCourse);

// my courses
router.get("/my", auth, getMyCourses);

// dashboard
router.get("/dashboard", auth, getDashboard);

// progress
router.put("/progress/:courseId", auth, updateProgress);

router.put("/complete/:courseId", auth, markAsCompleted);
router.put("/video-done", auth, markVideoDone);

router.post("/save-time", auth, (req, res) => {
  const { videoId, time } = req.body;
  const userId = req.user.id;

  db.query(
    `INSERT INTO video_watch (user_id, video_id, time)
     VALUES (?, ?, ?)
     ON DUPLICATE KEY UPDATE time=?`,
    [userId, videoId, time, time]
  );

  res.json({ success: true });
});

module.exports = router;