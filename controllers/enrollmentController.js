const db = require("../config/db");

// ENROLL COURSE
exports.enrollCourse = (req, res) => {
  const userId = req.user.id;
  const { courseId } = req.body;

  if (!courseId) {
    return res.status(400).json({ message: "CourseId is required" });
  }

  // 🔥 STEP 1: CHECK COURSE TYPE
  db.query(
    "SELECT type FROM courses WHERE id=?",
    [courseId],
    (err, courseResult) => {

      if (err || !courseResult.length) {
        return res.status(500).json({ message: "Course not found" });
      }

      const courseType = courseResult[0].type || "free";

      // ================= FREE COURSE =================
      if (courseType === "free") {
        return enrollUser();
      }

      // ================= PAID COURSE =================
      db.query(
        "SELECT * FROM payments WHERE user_id=? AND course_id=? AND status='success'",
        [userId, courseId],
        (err, paymentResult) => {

          if (err) {
            return res.status(500).json({ message: "Payment check error" });
          }

          if (paymentResult.length === 0) {
            return res.status(403).json({ message: "Payment required" });
          }

          enrollUser();
        }
      );

      // 🔁 COMMON FUNCTION
      function enrollUser() {
        db.query(
          "SELECT * FROM enrollments WHERE user_id=? AND course_id=?",
          [userId, courseId],
          (err, existing) => {

            if (existing.length > 0) {
              return res.json({ message: "Already enrolled" });
            }

            db.query(
              "INSERT INTO enrollments (user_id, course_id) VALUES (?, ?)",
              [userId, courseId],
              (err) => {
                if (err) {
                  return res.status(500).json({ message: "Enroll failed" });
                }

                return res.json({ message: "Enrolled successfully" });
              }
            );
          }
        );
      }
    }
  );
};

// GET MY COURSES
exports.getMyCourses = (req, res) => {
    const userId = req.user.id;

    db.query(
        `SELECT 
            c.id,
            c.title,
            c.category,
            u.name AS teacher_name,
            e.progress
        FROM enrollments e
        JOIN courses c ON c.id = e.course_id
        JOIN users u ON c.teacher_id = u.id
        WHERE e.user_id = ?`,
        [userId],
        (err, data) => {

            if (err) {
                console.error(err);
                return res.status(500).json({ message: "Server error" });
            }

            res.json(data);
            console.log("COURSE DATA:", data);
        }
    );
};

// DASHBOARD DATA
exports.getDashboard = (req, res) => {
  const userId = req.user.id;

  db.query(
    "SELECT * FROM enrollments WHERE user_id = ?",
    [userId],
    (err, enrollments) => {

      if (err) return res.json({ message: "Error" });

      const total = enrollments.length;
      const completed = enrollments.filter(e => e.progress === 100).length;
      const inProgress = enrollments.filter(e => e.progress > 0 && e.progress < 100).length;

      res.json({
        total,
        completed,
        inProgress
      });
    }
  );
};

// UPDATE PROGRESS
exports.updateProgress = (req, res) => {
  const userId = req.user.id;
  const courseId = req.params.courseId;

  db.query(
    `UPDATE enrollments 
     SET progress = LEAST(progress + 10, 100)
     WHERE user_id = ? AND course_id = ?`,
    [userId, courseId],
    (err) => {
      if (err) return res.json({ message: "Error updating progress" });

      res.json({ message: "Progress updated" });
    }
  );
};

// MARK AS COMPLETED
exports.markAsCompleted = (req, res) => {
  const userId = req.user.id;
  const courseId = req.params.courseId;

  db.query(
    `UPDATE enrollments 
     SET progress = 100 
     WHERE user_id = ? AND course_id = ?`,
    [userId, courseId],
    (err, result) => {

      if (err) {
        console.error(err);
        return res.status(500).json({ message: "Error marking complete" });
      }

      if (result.affectedRows === 0) {
        return res.status(404).json({ message: "Enrollment not found" });
      }

      res.json({ message: "Course marked as completed" });
    }
  );
};

exports.markVideoDone = (req, res) => {
  const userId = req.user.id;
  const { courseId, videoId } = req.body;

  if (!courseId || !videoId) {
    return res.status(400).json({ message: "Missing data" });
  }

  // 1. mark video completed
  db.query(
    `INSERT INTO video_progress (user_id, course_id, video_id, completed)
     VALUES (?, ?, ?, TRUE)
     ON DUPLICATE KEY UPDATE completed = TRUE`,
    [userId, courseId, videoId],
    (err) => {
      if (err) {
        console.error(err);
        return res.status(500).json({ message: "DB error" });
      }

      // 2. calculate progress
      db.query(
        `SELECT 
          (SELECT COUNT(*) FROM video_progress 
           WHERE user_id=? AND course_id=? AND completed=TRUE) AS done,

          (SELECT COUNT(*) FROM course_videos 
           WHERE course_id=?) AS total`,
        [userId, courseId, courseId],
        (err, result) => {

          if (err) return res.status(500).json({ message: "Calc error" });

          const done = result[0].done;
          const total = result[0].total;

          const progress = total > 0 ? Math.round((done / total) * 100) : 0;

          // 3. update enrollment
          db.query(
            `UPDATE enrollments 
             SET progress=? 
             WHERE user_id=? AND course_id=?`,
            [progress, userId, courseId]
          );

          res.json({ progress });
        }
      );
    }
  );
};