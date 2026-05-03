const router = require("express").Router();
const auth = require("../middleware/authMiddleware");
const authOptional = require("../middleware/authOptional");
const upload = require("../middleware/upload");
const db = require("../config/db");

const { getTeacherCourses } = require("../controllers/courseController");
const { getTeacherStats } = require("../controllers/courseController");
const { getTeacherStudents } = require("../controllers/courseController");
const { getUserRating } = require("../controllers/courseController");
const { deleteCourse } = require("../controllers/courseController");

// controllers
const {
  getCourses,
  addCourse,
  approveCourse,
  rejectCourse,
  createCourse,
  getMyCourses,
  getAllCoursesAdmin,
  addRating,
  getRatings,
  getCourseRaters,
  getTeacherEarnings
} = require("../controllers/courseController");


// ================= PUBLIC =================
router.get("/", authOptional, getCourses);


// ================= STUDENT =================
router.get("/my", auth, getMyCourses);
router.get("/my-rating/:courseId", auth, getUserRating);


// ================= TEACHER =================
router.post("/", auth, addCourse);
router.get("/stats", auth, getTeacherStats);
router.get("/students", auth, getTeacherStudents);
router.get("/teacher", auth, getTeacherCourses);
router.get("/earnings", auth, getTeacherEarnings);

// ================= VIDEO UPLOAD (CLEAN) =================
router.post(
  "/upload-video/:courseId",
  auth,
  upload.single("video"),
  (req, res) => {
    const { courseId } = req.params;

    // ❌ No file
    if (!req.file) {
      return res.status(400).json({ message: "No video uploaded" });
    }

    // ❌ Not video
    if (!req.file.mimetype.startsWith("video/")) {
      return res.status(400).json({ message: "Only video files allowed" });
    }

    const videoPath = `/uploads/videos/${req.file.filename}`;

    // ✅ INSERT (MULTIPLE VIDEOS SUPPORT)
    db.query(
      "INSERT INTO course_videos (course_id, video_url, title) VALUES (?, ?, ?)",
      [courseId, videoPath, req.body.title || "Lesson"],
      (err, result) => {

        if (err) {
          console.error("VIDEO UPLOAD DB ERROR:", err);
          return res.status(500).json({ message: "Database error" });
        }

        res.json({
          message: "Video uploaded successfully",
          videoPath
        });
      }
    );
  }
);

router.delete("/videos/bulk-delete", auth, (req, res) => {

  const { videoIds } = req.body;

  if (!videoIds || videoIds.length === 0) {
    return res.status(400).json({ message: "No videos selected" });
  }

  db.query(
    "UPDATE course_videos SET is_deleted = TRUE WHERE id IN (?)",
    [videoIds],
    (err) => {

      if (err) {
        console.error("DELETE ERROR:", err);
        return res.status(500).json({ message: "Delete failed" });
      }

      res.json({ message: "Videos deleted successfully" });
    }
  );
});

router.post("/videos/restore", auth, (req, res) => {

  const { videoIds } = req.body;

  if (!videoIds || videoIds.length === 0) {
    return res.status(400).json({ message: "No videos to restore" });
  }

  db.query(
    "UPDATE course_videos SET is_deleted = FALSE WHERE id IN (?)",
    [videoIds],
    (err) => {

      if (err) {
        console.error("RESTORE ERROR:", err);
        return res.status(500).json({ message: "Restore failed" });
      }

      res.json({ message: "Videos restored successfully" });
    }
  );
});

router.delete("/:id", auth, deleteCourse);

//    Rating

router.post("/rate/:courseId", auth, addRating);
router.get("/rating/:courseId", getRatings);
router.get("/raters/:courseId", auth, getCourseRaters);

// ================= ADMIN =================
router.put("/approve/:id", auth, approveCourse);
router.put("/reject/:id", auth, rejectCourse);
router.get("/all", auth, getAllCoursesAdmin);


module.exports = router;