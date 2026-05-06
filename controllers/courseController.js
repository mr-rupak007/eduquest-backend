const db = require("../config/db");

// GET ALL APPROVED COURSES
exports.getMyCourses = (req, res) => {

  const userId = req.user.id;

  const query = `
    SELECT 
      c.id,
      c.title,
      c.category,
      u.name AS teacher_name,
      e.progress,
      e.created_at AS enrolled_at
    FROM enrollments e
    JOIN courses c ON e.course_id = c.id
    JOIN users u ON c.teacher_id = u.id
    WHERE e.user_id = ?
    ORDER BY e.created_at DESC
  `;

  db.query(query, [userId], (err, data) => {

    if (err) {
      console.error("STUDENT COURSES ERROR:", err);
      return res.status(500).json({ message: "Error fetching courses" });
    }

    res.json(data);
  });
};

// ADD COURSE (TEACHER)
exports.addCourse = (req, res) => {
  const { title, category, type, price, description } = req.body;

  if (!title || !category || !type) {
    return res.status(400).json({ message: "All fields required" });
  }

  let finalPrice = 0;

  if (type === "paid") {
    if (!price || price < 1) {
      return res.status(400).json({ message: "Price must be at least ₹1" });
    }
    finalPrice = price;
  }

  db.query(
    `INSERT INTO courses 
     (title, category, teacher_id, type, price, description, status) 
     VALUES (?, ?, ?, ?, ?, ?, 'pending')`,
    [title, category, req.user.id, type, finalPrice, description || ""],
    (err, result) => {
      if (err) {
        console.error("ADD COURSE ERROR:", err);
        return res.status(500).json({ message: "Error adding course" });
      }

      res.json({
        message: "Course submitted for approval",
        courseId: result.insertId
      });
    }
  );
};


exports.approveCourse = (req, res) => {

  if (req.user.role !== "admin") {
    return res.status(403).json({ message: "Admin only action" });
  }

  db.query(
    "UPDATE courses SET status = 'approved' WHERE id = ?",
    [req.params.id],
    (err, result) => {

      if (err) {
        console.error("DB ERROR:", err);
        return res.status(500).json({ message: "Error approving course" });
      }

      if (result.affectedRows === 0) {
        return res.status(404).json({ message: "Course not found" });
      }

      res.json({ message: "Course approved successfully" });
    }
  );
};

exports.rejectCourse = (req, res) => {

  if (req.user.role !== "admin") {
    return res.status(403).json({ message: "Admin only action" });
  }

  const { remark } = req.body;

  // 🔴 FORCE REMARK
  if (!remark || remark.trim() === "") {
    return res.status(400).json({ message: "Remark is required" });
  }

  db.query(
    "UPDATE courses SET status = 'rejected', rejection_remark = ? WHERE id = ?",
    [remark, req.params.id],
    (err) => {
      if (err) {
        console.error(err);
        return res.status(500).json({ message: "Error rejecting course" });
      }

      res.json({ message: "Course rejected with remark" });
    }
  );
};

exports.getAllCoursesAdmin = (req, res) => {
  db.query(`
    SELECT c.*, u.name AS teacher_name 
    FROM courses c
    JOIN users u ON c.teacher_id = u.id
  `, (err, courses) => {

    if (err) return res.status(500).json({ message: "Error" });

    const courseIds = courses.map(c => c.id);

    if (!courseIds.length) return res.json([]);

    db.query(
      `SELECT * FROM course_videos WHERE course_id IN (?)`,
      [courseIds],
      (err, videos) => {

        const map = {};

        videos.forEach(v => {
          if (!map[v.course_id]) map[v.course_id] = [];
          map[v.course_id].push(v);
        });

        const final = courses.map(c => ({
          ...c,
          videos: map[c.id] || []
        }));

        res.json(final);
      }
    );
  });
};

exports.getCourses = (req, res) => {

  const userId = req.user ? req.user.id : null;

  const query = `
    SELECT 
      c.*,
      u.name AS teacher_name,
      r.avgRating,
      r.totalRatings,
      IF(e.user_id IS NOT NULL, 1, 0) AS isEnrolled,
      IFNULL(e.progress, 0) AS progress

    FROM courses c

    LEFT JOIN users u 
      ON c.teacher_id = u.id

    LEFT JOIN (
      SELECT 
        course_id,
        ROUND(AVG(rating),1) AS avgRating,
        COUNT(id) AS totalRatings
      FROM ratings
      GROUP BY course_id
    ) r 
      ON r.course_id = c.id

    LEFT JOIN enrollments e 
      ON e.course_id = c.id 
      AND (? IS NULL OR e.user_id = ?)

    WHERE c.status = 'approved'
  `;

  db.query(query, [userId, userId], (err, courses) => {

    if (err) {
      console.error("GET COURSES ERROR:", err);
      return res.status(500).json({ message: "Error fetching courses" });
    }

    if (!courses || courses.length === 0) {
      return res.json([]);
    }

    const courseIds = courses.map(c => c.id);

    // ================= FETCH VIDEOS =================
    db.query(
      `SELECT id, course_id, video_url, title
       FROM course_videos
       WHERE is_deleted = FALSE
       AND course_id IN (?)`,
      [courseIds],
      (err2, videos) => {

        if (err2) {
          console.error("VIDEO ERROR:", err2);
          return res.json(courses); // fallback
        }

        const videoMap = {};

        videos.forEach(v => {
          if (!videoMap[v.course_id]) {
            videoMap[v.course_id] = [];
          }
          videoMap[v.course_id].push(v);
        });

        const finalCourses = courses.map(c => ({
          ...c,
          videos: videoMap[c.id] || []
        }));

        return res.json(finalCourses);
      }
    );

  });
};

exports.addRating = (req, res) => {
  const userId = req.user.id;
  const courseId = req.params.courseId;
  const { rating } = req.body;

  if (!rating || rating < 1 || rating > 5) {
    return res.status(400).json({ message: "Invalid rating" });
  }

  db.query(
    `INSERT INTO ratings (user_id, course_id, rating)
     VALUES (?, ?, ?)
     ON DUPLICATE KEY UPDATE rating = ?`,
    [userId, courseId, rating, rating],
    (err) => {
      if (err) return res.status(500).json({ message: "DB error" });

      res.json({ message: "Rating saved" });
    }
  );
};

exports.getRatings = (req, res) => {
  const courseId = req.params.courseId;

  db.query(
    `SELECT 
        AVG(rating) AS avgRating,
        COUNT(*) AS totalRatings
     FROM ratings
     WHERE course_id = ?`,
    [courseId],
    (err, data) => {
      if (err) return res.status(500).json({ message: "DB error" });

      res.json(data[0]);
    }
  );
};

exports.getCourseRaters = (req, res) => {
  const courseId = req.params.courseId;

  db.query(
    `SELECT 
        u.name,
        r.rating
     FROM ratings r
     JOIN users u ON r.user_id = u.id
     WHERE r.course_id = ?
     ORDER BY r.id DESC`,
    [courseId],
    (err, data) => {
      if (err) {
        console.error(err);
        return res.status(500).json({ message: "Error fetching raters" });
      }

      res.json(data);
    }
  );
};

exports.getTeacherStats = (req, res) => {

  const teacherId = req.user.id;

  const query = `
    SELECT COUNT(DISTINCT e.user_id) AS totalStudents
    FROM enrollments e
    JOIN courses c ON e.course_id = c.id
    WHERE c.teacher_id = ?
  `;

  db.query(query, [teacherId], (err, data) => {

    if (err) {
      console.error("TEACHER STATS ERROR:", err);
      return res.status(500).json({ message: "Error fetching stats" });
    }

    res.json({
      totalStudents: data[0].totalStudents || 0
    });

  });
};

exports.getTeacherStudents = (req, res) => {

  const teacherId = req.user.id;

    const query = `
  SELECT 
    u.id,
    u.name,
    u.email AS email,
    c.title AS courseName
  FROM enrollments e
  JOIN courses c ON e.course_id = c.id
  JOIN users u ON e.user_id = u.id
  WHERE c.teacher_id = ?
`;

  db.query(query, [teacherId], (err, data) => {

    if (err) {
      console.error("GET STUDENTS ERROR:", err);
      return res.status(500).json({ message: "Error fetching students" });
    }

    res.json(data);
  });
};

exports.getUserRating = (req, res) => {
  const userId = req.user.id;
  const courseId = req.params.courseId;

  db.query(
    "SELECT rating FROM ratings WHERE user_id=? AND course_id=?",
    [userId, courseId],
    (err, data) => {
      if (err) return res.status(500).json({ message: "DB error" });

      res.json(data[0] || { rating: 0 });
    }
  );
};

exports.deleteCourse = (req, res) => {
  const courseId = req.params.id;
  const userId = req.user.id;
  const role = req.user.role;

  let query = "";
  let values = [];

  // 🔥 ADMIN → can delete ANY course
  if (role === "admin") {
    query = "DELETE FROM courses WHERE id = ?";
    values = [courseId];
  } 
  // 🔥 TEACHER → can delete only own course
  else {
    query = "DELETE FROM courses WHERE id = ? AND teacher_id = ?";
    values = [courseId, userId];
  }

  db.query(query, values, (err, result) => {
    if (err) {
      console.error("DELETE COURSE ERROR:", err);
      return res.status(500).json({ message: "Error deleting course" });
    }

    if (result.affectedRows === 0) {
      return res.status(403).json({
        message: role === "admin"
          ? "Course not found"
          : "Unauthorized or course not found"
      });
    }

    res.json({ message: "Course deleted successfully" });
  });
};

exports.getTeacherCourses = (req, res) => {
  const teacherId = req.user.id;

  // 1. Get teacher courses
  const query = `
    SELECT *
    FROM courses
    WHERE teacher_id = ?
    ORDER BY id DESC
  `;

  db.query(query, [teacherId], (err, courses) => {
    if (err) {
      console.error("TEACHER COURSES ERROR:", err);
      return res.status(500).json({ message: "Error fetching teacher courses" });
    }

    if (courses.length === 0) {
      return res.json([]);
    }

    // 2. Get videos for those courses
    const courseIds = courses.map(c => c.id);

    db.query(
      `SELECT id, course_id, video_url, title 
       FROM course_videos 
       WHERE course_id IN (?) AND is_deleted = FALSE`,
      [courseIds],
      (err, videos) => {

        if (err) {
          console.error("VIDEO FETCH ERROR:", err);
          return res.json(courses); // fallback
        }

        // 3. Group videos by course
        const videoMap = {};

        videos.forEach(v => {
          if (!videoMap[v.course_id]) {
            videoMap[v.course_id] = [];
          }
          videoMap[v.course_id].push(v);
        });

        // 4. Attach videos to courses
        const finalCourses = courses.map(c => ({
          ...c,
          videos: videoMap[c.id] || []
        }));

        res.json(finalCourses);
      }
    );
  });
};

// ================= TEACHER EARNINGS =================
exports.getTeacherEarnings = (req, res) => {
  const teacherId = req.user.id;

  // ================= TOTAL =================
  const totalQuery = `
    SELECT SUM(p.amount) AS totalEarnings
    FROM payments p
    JOIN courses c ON p.course_id = c.id
    WHERE c.teacher_id = ? AND LOWER(p.status) = 'success'
  `;

  // ================= COURSE BREAKDOWN =================
  const breakdownQuery = `
    SELECT 
      c.title,
      SUM(p.amount) AS earnings,
      COUNT(p.user_id) AS students
    FROM payments p
    JOIN courses c ON p.course_id = c.id
    WHERE c.teacher_id = ? AND LOWER(p.status) = 'success'
    GROUP BY p.course_id
  `;

  // ================= MONTHLY DATA =================
const monthlyQuery = `
  SELECT 
    DATE_FORMAT(p.created_at, '%Y-%m') AS month,
    SUM(p.amount) AS total
  FROM payments p
  JOIN courses c ON p.course_id = c.id
  WHERE c.teacher_id = ?
  GROUP BY DATE_FORMAT(p.created_at, '%Y-%m')
  ORDER BY month
`;

  // ================= 🔥 TRANSACTIONS (NEW) =================
  const transactionsQuery = `
    SELECT 
      p.amount,
      p.created_at,
      p.status,
      u.name AS student,
      c.title AS course
    FROM payments p
    JOIN courses c ON p.course_id = c.id
    JOIN users u ON p.user_id = u.id
    WHERE c.teacher_id = ?
    ORDER BY p.created_at DESC
  `;

  // ================= EXECUTION =================
  db.query(totalQuery, [teacherId], (err, totalResult) => {
    if (err) {
      console.error("TOTAL ERROR:", err);
      return res.status(500).json({
        totalEarnings: 0,
        courses: [],
        monthly: [],
        transactions: []   // 🔥 added
      });
    }

    db.query(breakdownQuery, [teacherId], (err2, breakdown) => {
      if (err2) {
        console.error("BREAKDOWN ERROR:", err2);
        return res.status(500).json({
          totalEarnings: totalResult[0]?.totalEarnings || 0,
          courses: [],
          monthly: [],
          transactions: []   // 🔥 added
        });
      }

      db.query(monthlyQuery, [teacherId], (err3, monthlyData) => {
        if (err3) {
          console.error("MONTHLY ERROR:", err3);

          // 🔥 STILL FETCH TRANSACTIONS EVEN IF MONTHLY FAILS
          db.query(transactionsQuery, [teacherId], (err4, transactions) => {

            if (err4) {
              console.error("TRANSACTION ERROR:", err4);
              transactions = [];
            }

            return res.json({
              totalEarnings: totalResult[0]?.totalEarnings || 0,
              courses: breakdown || [],
              monthly: [],
              transactions: transactions || []   // 🔥 important
            });
          });

          return;
        }

        // ✅ NORMAL FLOW (ALL DATA)
        db.query(transactionsQuery, [teacherId], (err4, transactions) => {

          if (err4) {
            console.error("TRANSACTION ERROR:", err4);
            transactions = [];
          }

          res.json({
            totalEarnings: totalResult[0]?.totalEarnings || 0,
            courses: breakdown || [],
            monthly: monthlyData || [],
            transactions: transactions || []   // 🔥 THIS FIXES YOUR ISSUE
          });
        });

      });

    });
  });
};

exports.createCourse = (req, res) => {

  const { title, category, type, price, description } = req.body;
  const teacherId = req.user.id;

  if (!title || !category || !type) {
    return res.status(400).json({ message: "Missing required fields" });
  }

  const finalPrice = type === "paid" ? price : 0;

  const sql = `
    INSERT INTO courses 
    (title, category, type, price, description, teacher_id) 
    VALUES (?, ?, ?, ?, ?, ?)
  `;

  db.query(
    sql,
    [title, category, type, finalPrice, description || "", teacherId],
    (err, result) => {
      if (err) {
        console.error("CREATE COURSE ERROR:", err);
        return res.status(500).json({ message: "Failed to create course" });
      }

      res.json({
        message: "Course created successfully",
        courseId: result.insertId
      });
    }
  );
};