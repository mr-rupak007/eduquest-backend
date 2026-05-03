const router = require("express").Router();
const auth = require("../middleware/authMiddleware");
const db = require("../config/db");

// ADD COMMENT
router.post("/:courseId", auth, (req, res) => {
  const { courseId } = req.params;
  const { text, parent_id } = req.body;

  if (!text) {
    return res.status(400).json({ message: "Comment required" });
  }

  // 🔥 STEP 1: insert comment
  db.query(
    "INSERT INTO comments (course_id, user_id, text, parent_id) VALUES (?, ?, ?, ?)",
    [courseId, req.user.id, text, parent_id || null],
    (err, result) => {

      if (err) return res.status(500).json({ message: "DB error" });

      // 🔥 STEP 2: ALWAYS get name from DB (100% reliable)
      db.query(
        "SELECT name FROM users WHERE id = ?",
        [req.user.id],
        (err2, userData) => {

          if (err2) return res.status(500).json({ message: "User fetch error" });

          const userName = userData?.[0]?.name || "User";

          // 🔥 STEP 3: socket instance
          const io = req.app.get("io");

          // 🔥 STEP 4: build comment object
          const newComment = {
            id: result.insertId,
            course_id: Number(courseId),
            user_id: req.user.id,
            name: userName, // ✅ FIXED (no more undefined)
            text,
            parent_id: parent_id || null,
            created_at: new Date()
          };

          // 🔥 STEP 5: emit to course room
          io.to(`course_${courseId}`).emit("newComment", {
            courseId: Number(courseId),
            comment: newComment
          });

          res.json({ message: "Comment added" });
        }
      );
    }
  );
});


// GET COMMENTS
router.get("/:courseId", (req, res) => {
  const { courseId } = req.params;

  db.query(
    `SELECT c.*, u.name 
     FROM comments c
     JOIN users u ON c.user_id = u.id
     WHERE c.course_id = ?
     ORDER BY c.created_at ASC`,
    [courseId],
    (err, data) => {
      if (err) return res.status(500).json({ message: "DB error" });

      res.json(data);
    }
  );
});

router.put("/:id", auth, (req, res) => {

  const { text } = req.body;
  const user = req.user;

  let query = "UPDATE comments SET text=? WHERE id=?";
  let params = [text, req.params.id];

  if (user.role !== "admin" && user.role !== "teacher") {
    query += " AND user_id=?";
    params.push(user.id);
  }

  db.query(query, params, (err) => {

    if (err) return res.status(500).json({ message: "DB error" });

    // 🔥 SOCKET EMIT
    const io = req.app.get("io");

    const courseId = req.body.courseId; // 👈 send from frontend

    io.to(`course_${courseId}`).emit("commentUpdated", {
      commentId: Number(req.params.id),
      text
    });

    res.json({ message: "Updated" });
  });
});

router.delete("/:id", auth, (req, res) => {

  const user = req.user;
  const commentId = req.params.id;

  // 🔥 STEP 1: get course_id BEFORE deleting
  db.query(
    "SELECT course_id FROM comments WHERE id=?",
    [commentId],
    (err, data) => {

      if (err) return res.status(500).json({ message: "DB error" });
      if (!data.length) return res.status(404).json({ message: "Comment not found" });

      const courseId = data[0].course_id;

      // 🔥 STEP 2: delete comment
      let query = "DELETE FROM comments WHERE id=?";
      let params = [commentId];

      if (user.role !== "admin" && user.role !== "teacher") {
        query += " AND user_id=?";
        params.push(user.id);
      }

      db.query(query, params, (err2) => {

        if (err2) return res.status(500).json({ message: "DB error" });

        // 🔥 STEP 3: get io properly (FIXED)
        const io = req.app.get("io");

        // 🔥 STEP 4: emit to correct course room
        io.to(`course_${courseId}`).emit("commentDeleted", {
          commentId: Number(commentId)
        });

        res.json({ message: "Deleted" });
      });
    }
  );
});

module.exports = router;