let courses = [];
let myCourses = [];
let navStack = [];
let currentUser = null;
let selectedUserId = null;
let teacherCoursesData = [];
let lastTeacherView = "details"; 
let currentFilter = "all";
let currentFilterType = "all";
let currentViewType = null;
let selectedVideoCourseId = null;
let currentAdminView = null;
let selectedCourseId = null;
let currentOpenPanel = null;
let earningsChartInstance = null;
let chartVisible = false;
let otpCooldown = false;
let timerInterval;
let currentVideoId = null;
let activeDeleteMode = {};
let currentDeleteCourseId = null;
let lastDeletedVideos = [];
let allCoursesData = [];
let dashboardCourses = [];
let rejectCourseId = null;
const API_BASE =
  window.location.hostname === "localhost"
    ? "http://localhost:4000"
    : "https://eduquest-backend-s5l7.onrender.com";
let socket = null;
window.otpVerified = false;

function getAuthToken() {
  let token = localStorage.getItem("token");

  if (token) token = token.trim();

  if (!token || token === "undefined" || token === "null") {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    return null;
  }

  return token;
}

function initSidebar() {

    const sidebar = document.querySelector(".sidebar");
    const toggleBtn = document.getElementById("toggleBtn");
    const closeBtn = document.getElementById("closeBtn");
    const overlay = document.getElementById("overlay");

    if (!sidebar || !toggleBtn || !closeBtn || !overlay) {
        console.error("Sidebar elements missing");
        return;
    }

    // OPEN
    toggleBtn.onclick = () => {
        sidebar.classList.add("active");
        overlay.classList.add("active");
        document.body.classList.add("sidebar-open");
        toggleBtn.classList.add("active");
    };

    // CLOSE
    window.closeSidebar = function () {
        sidebar.classList.remove("active");
        overlay.classList.remove("active");
        document.body.classList.remove("sidebar-open");
        toggleBtn.classList.remove("active");
    };

    // EVENTS
    closeBtn.onclick = closeSidebar;
    overlay.onclick = closeSidebar;

    document.addEventListener("keydown", (e) => {
        if (e.key === "Escape") closeSidebar();
    });

    document.querySelectorAll(".sidebar a").forEach(link => {
        link.addEventListener("click", closeSidebar);
    });
}

function updateAuthUI(user) {
    const loginLink = document.getElementById("loginLink");
    const registerLink = document.getElementById("registerLink");
    const adminLoginLink = document.getElementById("adminLoginLink");

    const adminPanelLink = document.getElementById("adminPanelLink");
    const dashboardLink = document.getElementById("dashboardLink");
    const myCoursesLink = document.getElementById("myCoursesLink");
    const logoutLink = document.getElementById("logoutLink");

    if (!loginLink || !registerLink || !adminLoginLink) return;

    if (user) {
        // 🔐 LOGGED IN
        loginLink.style.display = "none";
        registerLink.style.display = "none";
        adminLoginLink.style.display = "none";

        if (logoutLink) logoutLink.style.display = "block";

        if (user.role === "admin") {
            if (adminPanelLink) adminPanelLink.style.display = "block";
            if (dashboardLink) dashboardLink.style.display = "none";
            if (myCoursesLink) myCoursesLink.style.display = "none";
        } else {

            if (adminPanelLink) adminPanelLink.style.display = "none";

            if (user.role === "teacher") {
                // 👨‍🏫 TEACHER
                if (dashboardLink) dashboardLink.style.display = "block";
                if (myCoursesLink) myCoursesLink.style.display = "none"; // ❌ hide
            } 
            else {
                // 👨‍🎓 STUDENT
                if (dashboardLink) dashboardLink.style.display = "block";
                if (myCoursesLink) myCoursesLink.style.display = "block"; // ✅ show
            }
        }

    } else {
        // 🔓 LOGGED OUT
        loginLink.style.display = "block";
        registerLink.style.display = "block";
        adminLoginLink.style.display = "block";

        if (logoutLink) logoutLink.style.display = "none";

        if (adminPanelLink) adminPanelLink.style.display = "none";
        if (dashboardLink) dashboardLink.style.display = "none";
        if (myCoursesLink) myCoursesLink.style.display = "none";
    }
}

async function fetchCourses() {
    try {
        const token = getAuthToken();

        const headers = {};

        // ✅ Attach token ONLY if available
        if (token) {
            headers["Authorization"] = "Bearer " + token;
        }

        const res = await fetch(`${API_BASE}/api/courses`, {
            headers
        });

        const data = await res.json();

        // 🔐 OPTIONAL: handle expired token
        if (res.status === 401) {
            localStorage.removeItem("token");
            localStorage.removeItem("user");
            showToast("Session expired, login again 🔐", "error");
            showSection("login");
            return;
        }

        if (!Array.isArray(data)) {
            console.error("Invalid course data");
            return;
        }

        courses = data;
        allCoursesData = data;

        loadCourses(); // render UI

    } catch (err) {
        console.error("Fetch courses error:", err);
        showToast("Failed to load courses", "error");
    }
}

function initApp() {

    const token = getAuthToken();
    const savedUser = localStorage.getItem("user");

    const loginForm = document.querySelector("#login form");
    if (loginForm) {
        loginForm.addEventListener("keydown", function (e) {
            if (e.key === "Enter") {
                e.preventDefault();
                login();
            }
        });
    }

    if (token && savedUser) {
        try {
            currentUser = JSON.parse(savedUser);
        } catch (err) {
            console.error("Invalid stored user");
            localStorage.removeItem("token");
            localStorage.removeItem("user");
        }
    }

    updateSidebarByRole();

    if (token && currentUser) {
    if (currentUser.role === "teacher") {
        showSection("teacherDashboard");
    } 
    else if (currentUser.role === "admin") {
        showSection("adminPanel");
    } 
    else {
        showSection("browse"); // ✅ FIXED
    }
    } else {
        showSection("browse");
    }

    fetchCourses();

    updateUserUI(currentUser);
    updateAuthUI(currentUser);

    const searchInput = document.getElementById("searchInput");

    if (searchInput) {
        searchInput.addEventListener("input", function () {
            handleSearch(this.value);
        });
    }

}

function handleSearch(query) {

    query = query.toLowerCase().trim();

    // 🔥 SWITCH TO BROWSE FIRST
    showSection("browse");

    if (!query) {
        loadCourses();
        return;
    }

    const filtered = courses.filter(c => {

        const title = (c.title || "").toLowerCase();
        const category = (c.category || "").toLowerCase();
        const teacher = (c.teacher_name || c.teacherName || c.name || "").toLowerCase();

        return (
            title.includes(query) ||
            category.includes(query) ||
            teacher.includes(query)
        );
    });



    loadCourses(filtered, query);
}

function highlightText(text, query) {

    if (!query) return text;

    const regex = new RegExp(`(${query})`, "gi");

    return text.replace(regex, `<span class="highlight">$1</span>`);
}

function updateUserUI(user) {
    const name = user ? user.name : "Guest";

    const usernameEl = document.getElementById("username");
    const avatarNameEl = document.getElementById("avatarName");

    if (usernameEl) usernameEl.innerText = name;
    if (avatarNameEl) avatarNameEl.innerText = name;
}


// ESC KEY CLOSE
document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") closeSidebar();
});

// Section switching

function showSection(id, el = null) {

    // 🔐 CLOSE AVATAR MENU
    if (typeof closeAvatarMenu === "function") {
        closeAvatarMenu();
    }

    // ================= ROUTE PROTECTION =================

    const protectedRoutes = ["dashboard", "mycourses", "profile", "teacherDashboard"];

    if (protectedRoutes.includes(id) && !currentUser) {
        showToast("Please login first 🔐", "warning");
        return showSection("login");
    }

    if (id === "adminPanel" && (!currentUser || currentUser.role !== "admin")) {
        showToast("Access denied ❌ (Admin only)", "error");
        return;
    }

    // 🚨 PREVENT LOGIN/REGISTER WHEN LOGGED IN
    if ((id === "login" || id === "register") && currentUser) {

        showToast("You are already logged in", "warning");

        if (currentUser.role === "admin") return showSection("adminPanel");
        if (currentUser.role === "teacher") return showSection("teacherDashboard");

        return showSection("dashboard");
    }

    // ================= HERO =================
    const hero = document.getElementById("hero");

    document.body.classList.remove("sidebar-open");
    document.body.style.overflow = "auto";

    if (hero) {
        hero.classList.toggle("hidden", id !== "browse");
    }

    // ================= SWITCH SECTION =================
    document.querySelectorAll(".section").forEach(sec => {
        sec.classList.remove("active");
        sec.style.opacity = 0;
    });

    const target = document.getElementById(id);
    if (!target) {
        console.error("Section not found:", id);
        return;
    }

    target.classList.add("active");
    target.style.opacity = 1;


    // ================= SIDEBAR =================
    document.querySelectorAll(".sidebar a").forEach(a => {
        a.classList.remove("active");
    });

    if (el) el.classList.add("active");

    if (typeof closeSidebar === "function") {
        closeSidebar();
    }

    setTimeout(() => {
         document.body.classList.remove("sidebar-open");
         document.body.style.overflow = "auto";
    }, 50);

    // ================= BREADCRUMB =================
    resetNav([
        { label: "Home", onclick: "showSection('browse')" }
    ]);

    if (id === "dashboard") pushNav("Dashboard");
    else if (id === "teacherDashboard") pushNav("Teacher Dashboard");
    else if (id === "mycourses") pushNav("My Courses");
    else if (id === "profile") pushNav("Profile");
    else if (id === "adminPanel") {
    pushNav("Admin Panel");

    // ✅ FORCE DEFAULT SUBVIEW
    pushNav("Users");
}

    updateBreadcrumb();

    // ================= 🔥 ADMIN PANEL FIX =================
    if (id === "adminPanel") {

        const usersEl = document.getElementById("adminUsers");
        const coursesEl = document.getElementById("adminCourses");

        if (usersEl && coursesEl) {
            usersEl.innerHTML = "";
            coursesEl.innerHTML = "";

            usersEl.style.display = "none";
            coursesEl.style.display = "none";
        }
    }

    // ================= LOAD DATA =================

    if (id === "dashboard") {
        setTimeout(loadDashboard, 100);
    }

    if (id === "mycourses") {
        setTimeout(loadMyCourses, 100);
    }

    if (id === "teacherDashboard") {
        setTimeout(loadTeacherDashboard, 100);
    }

    if (id === "profile") {
        setTimeout(loadProfile, 100);
    }

    if (id === "adminPanel") {
        setTimeout(loadAdminPanel, 100);
    }
}

// Register
async function register() {
    const role = document.getElementById("role").value;
    const name = document.getElementById("fullName").value;
    const email = document.getElementById("email").value.trim();
    const mobile = document.getElementById("mobile").value.trim();
    const age = document.getElementById("age").value;
    const location = document.getElementById("location").value;
    const pass = document.getElementById("regPass").value;
    const confirm = document.getElementById("confirmPass").value;

    if (!role || !name || !email || !mobile || !age || !location || !pass || !confirm) {
    showToast("Fill all fields", "error");
    return;
}

// ✅ email check
if (!email.includes("@")) {
    showToast("Invalid email", "error");
    return;
}

// ✅ mobile check
if (!/^[6-9]\d{9}$/.test(mobile)) {
    showToast("Invalid mobile number", "error");
    return;
}

    if (pass !== confirm) {
        showToast("Passwords do not match", "error");
        return;
    }

    if (!window.otpVerified) {
        showToast("Verify OTP first 🔐", "error");
        return;
    }

    try {
        const res = await fetch(`${API_BASE}/api/auth/register`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              name,
              email,
              mobile,
              password: pass,
              role,
              age,
              location
          })
        });

        const data = await res.json();

        if (res.ok) {
            window.otpVerified = false;
            showSuccess("Registered Successfully 🎉", "login");
        } else {
            showToast(data.message || "Error", "error");
        }

    } catch (err) {
        showToast("Server error", "error");
    }
}

// Login

async function login() {

    if (currentUser) {
    showToast("Already logged in ⚠️", "warning");
    return;
}

    const user = document.getElementById("loginUser").value;
    const pass = document.getElementById("loginPass").value;
    

    if (!user || !pass) {
        showToast("Enter credentials", "error");
        return;
    }

    try {
        const res = await fetch(`${API_BASE}/api/auth/login`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                contact: user,
                password: pass
            })
        });

        let data;

        try {
            data = await res.json();
        } catch {
            console.error("Invalid JSON from server");
            showToast("Server response error", "error");
            return;
        }

        if (!res.ok || !data.user) {
            showToast(data.message || "Login failed", "error");
            return;
        }

        localStorage.setItem("token", data.token);
        localStorage.setItem("user", JSON.stringify(data.user));
        currentUser = data.user;

        // 🔌 CONNECT SOCKET
        socket = io(API_BASE);
        
        // 🔔 SOCKET EVENTS
        socket.on("newComment", (data) => {
          if (data.courseId !== selectedCourseId) return;
          appendNewComment(data.comment);
        });
        
        socket.on("commentUpdated", (data) => {
          updateCommentUI(data.commentId, data.text);
        });
        
        socket.on("commentDeleted", (data) => {
          deleteCommentUI(data.commentId);
        });

        updateUserUI(data.user);
        updateAuthUI(data.user);

        showToast("Login successful", "success");

        fetchCourses();

        showProfileHint();

        // 🔥 ROLE-BASED REDIRECTION (CLEAN)

           if (data.user.role === "teacher") {

               if (!isTeacherProfileComplete(data.user)) {
                   showToast("Complete your profile first ⚠️", "warning");
                   return showSection("profile");
               }

               return showSection("teacherDashboard");
           }

           else if (data.user.role === "admin") {
               return showSection("adminPanel");
           }

           else {
               return showSection("browse");
           }

    } catch (err) {
        console.error("LOGIN ERROR:", err);
        showToast("Server error - check console", "error");
    }
}

function loadCourses(customCourses = null, searchQuery = "") {
    const container = document.getElementById("courseContainer");

    if (!container) {
        console.error("courseContainer not found");
        return;
    }

    if (!courses || courses.length === 0) {
        container.innerHTML = `<p class="empty-state">No courses available</p>`;
        return;
    }

    let filteredCourses = customCourses || courses;



    // ================= 🔥 NORMALIZE DATA =================
    filteredCourses = filteredCourses.map(c => ({
        ...c,

        teacher_name: c.teacher_name || c.teacherName || c.name || "Unknown",

        avgRating: c.avgRating ? Number(c.avgRating) : 0,
        totalRatings: c.totalRatings || 0,

        isEnrolled: c.isEnrolled === 1 || c.isEnrolled === true,

        progress: c.progress ? Number(c.progress) : 0
    }));

    // ================= GROUP BY CATEGORY =================
    const grouped = {};

    filteredCourses.forEach(c => {
        const category = c.category || "General";

        if (!grouped[category]) {
            grouped[category] = [];
        }

        grouped[category].push(c);
    });

    // ================= RENDER =================
    container.innerHTML = Object.keys(grouped).map(category => `
        <div class="category-section">
            <h2 class="category-title">${category}</h2>

            <div class="category-grid">
                ${grouped[category].map(c => {

                    let actionBtn = "";

                    // ================= ENROLLED =================
                    if (currentUser && Boolean(c.isEnrolled)) {

                        if (c.progress === 100) {
                            actionBtn = `
                                <button class="course-btn completed" onclick="openCourse(${c.id})">
                                    ✅ Completed
                                </button>
                            `;
                        } else {
                            actionBtn = `
                                <button class="course-btn continue" onclick="openCourse(${c.id})">
                                    ▶ Continue Learning
                                </button>
                            `;
                        }

                        } else {

                        // ================= BUY / ENROLL =================
                        if (c.price && c.price > 0) {
                            actionBtn = `
                                <button class="course-btn buy" onclick="buyCourse(${c.id}, ${c.price})">
                                    💰 Buy ₹${c.price}
                                </button>
                            `;
                        } else {
                            actionBtn = `
                                <button class="course-btn enroll" onclick="enrollCourse(${c.id})">
                                    Enroll
                                </button>
                            `;
                        }
                    }

                    return `
                        <div class="course-card">

                            <h3 class="course-title">
                                ${highlightText(c.title, searchQuery)}
                            </h3>
                            
                            <p class="course-category">
                                ${highlightText(c.category, searchQuery)}
                            </p>
                            
                            <p class="course-teacher">
                                by ${highlightText(c.teacher_name, searchQuery)}
                            </p>
                        
                            <p class="course-rating">
                                ${c.avgRating > 0 
                                    ? `⭐ ${c.avgRating.toFixed(1)} • ${c.totalRatings}` 
                                    : "No rating"}
                            </p>
                        
                            <div class="course-bottom">
                                <span class="price">
                                    ${c.price > 0 ? `₹${c.price}` : "Free"}
                                </span>
                        
                                ${actionBtn}

                                <button onclick="viewCourseDetails(${c.id})" class="view-btn">
                                  📄 View Details
                                </button>

                            </div>
                        
                        </div>
                    `;
                }).join("")}
            </div>
        </div>
    `).join("");
}

async function enrollCourse(courseId) {
  const token = getAuthToken();

// ✅ STRONG CHECK
if (!token || token === "undefined" || token === "null") {
  showToast("Session expired, login again 🔐", "error");
  localStorage.removeItem("token");
  showSection("login");
  return;
}


  try {
    const res = await fetch(`${API_BASE}/api/enroll/${courseId}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json", // ✅ IMPORTANT
        "Authorization": "Bearer " + token
      },
      body: JSON.stringify({
        courseId // ✅ FIXED
      })
    });

    const data = await res.json();

    if (res.status === 401) {
      localStorage.removeItem("token");
      localStorage.removeItem("user");
      showToast("Session expired, login again 🔐", "error");
      showSection("login");
      return;
    }

    // ================= PAID COURSE CASE =================
    if (res.status === 403 && data.message === "Payment required") {
      showToast("This is a paid course 💰", "warning");

      // 👉 call payment flow
      buyCourse(courseId);
      return;
    }

    // ================= ERROR =================
    if (!res.ok) {
      showToast(data.message || "Enroll failed", "error");
      return;
    }

    // ================= SUCCESS =================
    showToast("Enrolled successfully 🎉", "success");

    fetchCourses();

  } catch (err) {
    console.error(err);
    showToast("Server error", "error");
  }
}

async function fetchTeacherCourses() {

  const token = getAuthToken();

    if (!token) {
       showToast("Session expired, login again 🔐", "error");
      showSection("login");
      return;
    }

  try {
    const res = await fetch(`${API_BASE}/api/courses/teacher`, {
      headers: {
        "Authorization": "Bearer " + token
      }
    });

    const data = await res.json();

    if (!Array.isArray(data)) return;

    teacherCoursesData = data; // ✅ FIX

    // ❌ REMOVE THIS
    // renderTeacherCourses(data);

  } catch (err) {
    console.error("Teacher courses error:", err);
  }
}

function renderTeacherCourses(courses) {

  const box = document.getElementById("courseDetailsBox");

  if (!courses.length) {
    box.innerHTML = "<p>No courses created yet</p>";
    return;
  }

  box.innerHTML = courses.map(c => `
    <div class="dash-card">
      <h3>${c.title}</h3>
      <p>Category: ${c.category}</p>
      <p>Status: ${c.status}</p>
      <p>Price: ${c.price > 0 ? "₹" + c.price : "Free"}</p>

      <!-- 🔥 ADD THIS -->
      <button onclick="openDeleteCourseModal(${c.id})" style="margin-top:10px; background:red; color:white;">
        🗑 Delete
      </button>

    </div>
  `).join("");
}

function openCourse(id) {

  const c = courses.find(course => course.id === id);
  if (!c) return;


  showSection("browse");

  document.getElementById("hero")?.classList.add("hidden");

  const browseSection = document.getElementById("browse");
  if (browseSection) {
    const heading = browseSection.querySelector("h2");
    if (heading) heading.style.display = "none";
  }

  const container = document.getElementById("courseContainer");

  if (!container) {
    console.error("courseContainer not found ❌");
    return;
  }

  // Ensure this runs after your course data ('c') is loaded

container.innerHTML = `
    <div class="modern-lms-container">

      <div class="modern-lms-header">
        <div>
          <button onclick="goBackToBrowse()" class="back-btn">← Back to Browse</button>
          <div class="title-section" style="margin-top: 12px;">
            <h2>${c.title}</h2>
            <p>${c.category}</p>
          </div>
          <div class="progress-container">
             <div class="progress-fill" style="width:${c.progress || 0}%"></div>
          </div>
        </div>
        
        <div>
          ${c.progress === 100 
             ? `<button class="btn-success" disabled>✔ Course Completed</button>`
             : `<button onclick="markAsCompleted(${c.id})" class="btn-primary">Mark as Completed</button>`
          }
        </div>
      </div>

      ${
        (c.videos && c.videos.length > 0)
          ? `
          <div class="player-grid">
      
            <div class="player-main">
              <div class="video-wrapper">
                <video id="mainVideo" controls>
                  <source src="${API_BASE}${c.videos[0].video_url}" type="video/mp4">
                </video>
              </div>
      
              <div class="video-actions">
                <h3 id="videoTitle">${c.videos[0].title || "Lesson"}</h3>
                ${
                  c.progress === 100
                    ? `<button class="btn-success" disabled>✔ Completed</button>`
                    : `<button onclick="markVideoDone(${c.id}, ${c.videos[0].id})" id="completeBtn" class="btn-primary">✔ Mark Lesson Done</button>`
                }
              </div>
            </div>
      
            <div class="lesson-sidebar">
              <h4 style="margin-top:0; margin-bottom:16px; color:#0f172a;">Course Content</h4>
              ${c.videos.map((v, index) => {
                const isUnlocked = c.isEnrolled || v.isPreview;
                const isDone = c.completedVideos?.includes(v.id);

                return `
                  <div class="lesson-item ${index === 0 ? "active" : ""} ${!isUnlocked ? "locked" : ""}"
                       ${isUnlocked ? `onclick="playVideo(${c.id}, ${index})"` : `onclick="showUnlockModal(${c.id})"`}>

                    <div class="lesson-thumb">
                      ${isUnlocked ? "▶️" : "🔒"}
                    </div>

                    <div class="lesson-info">
                      <span class="lesson-title">
                        ${v.title || "Lesson " + (index + 1)}
                      </span>
                      ${
                        !isUnlocked 
                          ? `<small class="lock-text">Locked</small>` 
                          : isDone 
                            ? `<small class="done-text">✔ Completed</small>` 
                            : ""
                      }
                    </div>

                  </div>
                `;
              }).join("")}
            </div>

          </div>
          `
          : `
          <div class="no-video">
            <span style="font-size:32px;">📭</span>
            <p>No content yet</p>
             <br><small>Instructor will upload soon</small>
          </div>
          `
      }

      <div class="info-card meta-strip">
         <span>👨‍🏫 Instructor: <strong>${c.teacher_name || "Unknown"}</strong></span>
         <span>📚 Category: <strong>${c.category}</strong></span>
         <span>⭐ Rating: <strong>${c.avgRating ? `${parseFloat(c.avgRating).toFixed(1)} (${c.totalRatings || 0} reviews)` : "No rating"}</strong></span>
      </div>

      <div class="player-grid" style="margin-top: 0; grid-template-columns: 1fr 2fr;">
        
        <div class="info-card rating-box">
          <h3>Rate this course</h3>
          <div id="userRating-${c.id}">
            ${[1,2,3,4,5].map(star => `
              <span 
                onclick="handleRatingClick(${c.id}, ${star})"
                class="rating-star"
                data-value="${star}">★</span>
            `).join("")}
          </div>
        </div>

        <div class="info-card comment-wrapper">
          <div class="comment-header">
            <h3>Discussions</h3>
          </div>
          <div class="comment-input-box">
            <input type="text" id="commentInput" placeholder="Add to the discussion...">
            <button onclick="addComment(${c.id})" class="btn-primary">Post</button>
          </div>
          <div id="commentList" class="comment-list">
            Loading comments...
          </div>
        </div>

      </div>

      <div class="player-footer">
        <p>Continue learning at your own pace</p>
      </div>

    </div>
`;

  loadComments(c.id);
  loadUserRating(c.id);
}

async function loadUserRating(courseId) {

    const token = getAuthToken();

    if (!token) {
        showToast("Session expired, login again 🔐", "error");
        showSection("login");
        return;
    }

    try {
        const res = await fetch(`${API_BASE}/api/courses/my-rating/${courseId}`, {
            headers: {
                Authorization: "Bearer " + token
            }
        });

        const data = await res.json();

        const container = document.getElementById(`userRating-${courseId}`);
        if (!container) return;

        const stars = container.querySelectorAll(".rating-star");

        stars.forEach(star => {
            const value = parseInt(star.dataset.value);
            star.innerText = value <= data.rating ? "⭐" : "☆";
        });

    } catch (err) {
        console.error("Error loading user rating:", err);
    }
}

function handleRatingClick(courseId, rating) {

    const container = document.getElementById(`userRating-${courseId}`);
    if (!container) return;

    const stars = container.querySelectorAll(".rating-star");

    stars.forEach(star => {
        const value = parseInt(star.dataset.value);
        star.innerText = value <= rating ? "⭐" : "☆";
    });

    rateCourse(courseId, rating);
}

async function loadMyCourses() {
const token = getAuthToken();

if (!token) {
  showToast("Session expired, login again 🔐", "error");
  showSection("login");
  return;
}

  const res = await fetch(`${API_BASE}/api/enroll/my`, {
    headers: {
        "Authorization": "Bearer " + token
    }
  });

  const data = await res.json();

  let list = document.getElementById("dashboardCourses");

  if (!list) return;

  if (data.length === 0) {
    list.innerHTML = "<p>No courses yet</p>";
    return;
  }

  list.innerHTML = data.map(c => `
    <div class="dash-card">
      <h4>${c.title}</h4>
      <p>${c.category}</p>

      <div style="background:#334155; height:6px; border-radius:5px; margin:8px 0;">
        <div style="
          width:${c.progress}%;
          background:#22c55e;
          height:100%;
          border-radius:5px;">
        </div>
      </div>

      <p>${c.progress}% completed</p>

      ${
  c.progress === 100
    ? `<button class="btn" disabled>Completed ✅</button>`
    : `<button class="btn continue-btn" onclick="openCourse(${c.id})">
         ▶ Continue
       </button>`
}
    </div>
  `).join("");
}

document.addEventListener("DOMContentLoaded", () => {
    initSidebar();
    initApp();
});


function checkStrength() {

  let val = document.getElementById("regPass")?.value;
  let bar = document.getElementById("strengthBar");
  let text = document.getElementById("strengthText");

  if (!bar || !text) return;

  if (!val) {
  bar.style.setProperty("--width", "0%");
  text.innerText = "";   // 🔥 hide text
  return;
}

  let score = 0;

  if (val.length >= 6) score++;
  if (val.length >= 10) score++;
  if (/[A-Z]/.test(val)) score++;
  if (/[0-9]/.test(val)) score++;
  if (/[^A-Za-z0-9]/.test(val)) score++;

  let percent = (score / 5) * 100;

  let label = percent < 40 ? "Weak"
            : percent < 75 ? "Medium"
            : "Strong";

  let color = percent < 40 ? "#ef4444"
            : percent < 75 ? "#f59e0b"
            : "#22c55e";

  bar.style.setProperty("--width", percent + "%");
  bar.style.setProperty("--color", color);

  text.innerText = label;
  text.style.color = color;
}

function checkPasswordMatch() {
  const pass = document.getElementById("profilePass").value;
  const confirm = document.getElementById("confirmProfilePass").value;
  const input = document.getElementById("confirmProfilePass");

  if (!confirm) {
    input.classList.remove("input-error", "input-success");
    return;
  }

  if (pass === confirm) {
    input.classList.add("input-success");
    input.classList.remove("input-error");
  } else {
    input.classList.add("input-error");
    input.classList.remove("input-success");
  }
}

function showToast(message, type = "success") {
    const container = document.getElementById("toastContainer");

    const toast = document.createElement("div");
    toast.className = `toast ${type}`;
    toast.innerText = message;

    container.appendChild(toast);

    // show animation
    setTimeout(() => toast.classList.add("show"), 100);

    // remove after 3s
    setTimeout(() => {
        toast.classList.remove("show");
        setTimeout(() => toast.remove(), 400);
    }, 3000);
}

function setError(input, message) {
    const group = input.parentElement;
    const error = group.querySelector(".error-msg");

    input.classList.add("input-error");
    input.classList.remove("input-success");

    error.innerText = message;
}

function setSuccess(input) {
    const group = input.parentElement;
    const error = group.querySelector(".error-msg");

    input.classList.remove("input-error");
    input.classList.add("input-success");

    error.innerText = "";
}

function showSuccess(message, redirectSection = null) {
    const modal = document.getElementById("successModal");
    const text = document.getElementById("successText");

    text.innerText = message;

    modal.classList.add("active");

    setTimeout(() => {
        modal.classList.remove("active");

        if (redirectSection) {
            showSection(redirectSection);
        }

    }, 1800);
}


// ================= STUDENT DASHBOARD =================
async function loadDashboard() {
  const token = getAuthToken();

    if (!token) {
        showToast("Session expired, login again 🔐", "error");
        showSection("login");
        return;
    }

  try {
    const res = await fetch(`${API_BASE}/api/enroll/my`, {
      headers: {
        "Authorization": "Bearer " + token
      }
    });

    const data = await res.json();

    dashboardCourses = data; // ✅ STORE

    let total = data.length;
    let inProgress = data.filter(c => c.progress < 100).length;
    let completed = data.filter(c => c.progress === 100).length;

    document.getElementById("totalCourses").innerText = total;
    document.getElementById("inProgress").innerText = inProgress;
    document.getElementById("completed").innerText = completed;

  } catch (err) {
    console.error("Dashboard error:", err);
  }
}


function renderDashboardCourses(list) {

    const box = document.getElementById("studentDetailsBox");

    if (!box) return;

    if (!list.length) {
        box.innerHTML = "<p>No courses found</p>";
        return;
    }

    box.innerHTML = list.map(c => `
        <div class="dash-card">

            <h4>${c.title}</h4>
            <p>${c.category}</p>

            <div style="background:#334155; height:6px; border-radius:5px; margin:8px 0;">
                <div style="
                    width:${c.progress}%;
                    background:#22c55e;
                    height:100%;
                    border-radius:5px;">
                </div>
            </div>

            <p>${c.progress}% completed</p>

            ${
                c.progress === 100
                ? `<button class="btn" disabled>Completed ✅</button>`
                : `<button class="btn continue-btn" onclick="openCourse(${c.id})">
                        ▶ Continue
                   </button>`
            }

        </div>
    `).join("");
}


// ================= TEACHER DASHBOARD ================//

async function loadTeacherDashboard() {

    const token = getAuthToken();

    if (!token) {
      showToast("Session expired, login again 🔐", "error");
      showSection("login");
      return;
    }

    // 🔒 ROLE CHECK (IMPORTANT)
    if (!currentUser || currentUser.role !== "teacher") {
        console.warn("Not a teacher → dashboard blocked");
        return;
    }

    try {

        // ================= COURSES =================
        const res = await fetch(`${API_BASE}/api/courses/teacher`, {
            headers: {
                Authorization: "Bearer " + token
            }
        });

        const courses = await res.json();

        if (!Array.isArray(courses)) {
            console.error("Invalid courses data");
            return;
        }

        teacherCoursesData = courses;

        const totalCreatedEl = document.getElementById("totalCreated");
        if (totalCreatedEl) {
            totalCreatedEl.innerText = courses.length;
        }

        // ================= STUDENTS =================
        const statsRes = await fetch(`${API_BASE}/api/courses/stats`, {
            headers: {
                Authorization: "Bearer " + token
            }
        });

        const stats = await statsRes.json();

        const totalStudentsEl = document.getElementById("totalStudents");
        if (totalStudentsEl) {
            totalStudentsEl.innerText = stats.totalStudents || 0;
        }

        // ================= EARNINGS (NEW) =================
        const earningsSection = document.getElementById("teacherEarningsSection");

        if (earningsSection) {
            earningsSection.style.display = "grid"; // show only for teacher
        }

        // 🔥 CALL EARNINGS FUNCTION
        await new Promise(r => setTimeout(r, 100)); // wait DOM render
        await loadTeacherEarnings();

    } catch (err) {
        console.error("Teacher dashboard error:", err);
    }
}

async function toggleCourseDetails(forceOpen = false) {

    const box = document.getElementById("courseDetailsBox");
    const btn = document.getElementById("courseBtn");
    const studentBtn = document.getElementById("studentBtn");

    if (!box) return;

    // 🔥 SAME BUTTON CLICK → TOGGLE CLOSE
    if (currentOpenPanel === "courses" && !forceOpen) {
        box.classList.remove("open");
        box.innerHTML = "";

        if (btn) btn.classList.remove("active");

        currentOpenPanel = null;
        return;
    }

    // 🔥 SWITCH FROM STUDENTS → COURSES
    if (currentOpenPanel === "students") {
        if (studentBtn) studentBtn.classList.remove("active");
    }

    currentOpenPanel = "courses";

    // ================= OPEN =================

    box.dataset.type = "courses";

    resetNav([
        { label: "Home", onclick: "showSection('browse')" },
        { label: "Teacher Dashboard", onclick: "showSection('teacherDashboard')" }
    ]);

    pushNav("Courses");
    updateBreadcrumb();

    if (btn) btn.classList.add("active");

    const token = getAuthToken();

    if (!token) {
      showToast("Session expired, login again 🔐", "error");
      showSection("login");
      return;
    }

    try {
        const res = await fetch(`${API_BASE}/api/courses/teacher`, {
            headers: {
                Authorization: "Bearer " + token
            }
        });

        const courses = await res.json();
        teacherCoursesData = courses;

        if (!Array.isArray(courses) || courses.length === 0) {
            box.innerHTML = "<p>No courses created yet</p>";
            box.classList.add("open");
            return;
        }

        box.classList.remove("open");
        box.classList.add("closing");

        setTimeout(() => {

            box.innerHTML = `
<div class="students-wrapper fade-anim">

    <div class="comment-header">
        <h3>📚 Courses</h3>
        <button class="back-btn-modern" onclick="goBackNav()">
            ⬅️ Back
        </button>
    </div>

    <div class="filter-tabs">
        <button onclick="filterCourses('all', event)" class="course-tab-btn active">All</button>
        <button onclick="filterCourses('approved', event)" class="course-tab-btn">Approved</button>
        <button onclick="filterCourses('pending', event)" class="course-tab-btn">Pending</button>
        <button onclick="filterCourses('rejected', event)" class="course-tab-btn">Rejected</button>
    </div>

    <div id="filteredCourses" class="details-content"></div>

</div>
`;

            renderFilteredCourses("all");

            box.classList.remove("closing");
            box.classList.add("open");

        }, 200);

    } catch (err) {
        console.error("TEACHER COURSE LOAD ERROR:", err);
        box.innerHTML = "<p>Error loading courses</p>";
        box.classList.add("open");
    }
}

function filterCourses(type, event) {

    currentFilterType = type;

    // active button fix
    document.querySelectorAll(".course-tab-btn").forEach(btn => {
        btn.classList.remove("active");
    });

    const clicked = event.currentTarget;
    clicked.classList.add("active");

    const container = document.getElementById("filteredCourses");

    // 🔥 STEP 1: fade OUT
    container.classList.add("fade-out");

    setTimeout(() => {

        // 🔥 STEP 2: update content
        renderFilteredCourses(type);

        // 🔥 STEP 3: fade IN
        container.classList.remove("fade-out");
        container.classList.add("fade-in");

        setTimeout(() => {
            container.classList.remove("fade-in");
        }, 300);

    }, 200);
}

function renderFilteredCourses(type) {

    const container = document.getElementById("filteredCourses");
    if (!container) return;

    let filtered = teacherCoursesData;

    if (type !== "all") {
        filtered = teacherCoursesData.filter(c => c.status === type);
    }

    if (!filtered.length) {
        container.innerHTML = "<p>No courses found</p>";
        return;
    }

    container.innerHTML = filtered.map(c => `

        <div class="course-card-admin">

            <!-- COURSE INFO -->
            <div class="course-info">
                <h4>${c.title}</h4>

                <p><strong>Category:</strong> ${c.category}</p>

                <p class="rating-text">
                    ${
                        c.avgRating
                        ? `⭐ ${parseFloat(c.avgRating).toFixed(1)} (${c.totalRatings || 0})`
                        : "No rating yet"
                    }
                </p>
            </div>

            <!-- ACTION ROW -->
            <div class="course-actions-top">
            
                <button onclick="viewComments(${c.id})">💬 View Comments</button>
                <button onclick="viewRaters(${c.id})">⭐ View Ratings</button>
            
                <!-- TOGGLE DELETE MODE -->
                <button 
                  onclick="toggleDeleteMode(${c.id})"
                  class="video-delete-btn">
                  ${activeDeleteMode[c.id] ? "❌ Cancel" : "🗑 Delete Videos"}
                </button>
            
                ${
                  activeDeleteMode[c.id]
                  ? `
                    <button 
                      onclick="openDeleteConfirmModal(${c.id})"
                      class="video-delete-btn">
                      Confirm Delete
                    </button>
                  `
                  : ""
                }
            
                <button onclick="openDeleteCourseModal(${c.id})" class="delete-btn">
                    🗑 Delete Course
                </button>
            
            </div>

            <!-- VIDEO LIST -->
            ${
             (c.videos && c.videos.length > 0)
             ? `
               <div class="teacher-video-list">
            
                 ${c.videos.map((v, i) => `
                   <div class="video-item-row" style="display:flex; align-items:center; gap:10px;">
            
                     ${
                       activeDeleteMode[c.id]
                       ? `
                         <input 
                          type="checkbox" 
                          class="video-checkbox"
                          data-course="${c.id}"
                          value="${v.id}"
                          onchange="updateDeleteCount(${c.id})"
                        >
                       `
                       : ""
                     }
            
                     <span onclick="playTeacherVideo('${v.video_url}', ${c.id})"
                           class="video-title"
                           style="cursor:pointer;">
                       🎬 ${v.title || "Lesson " + (i+1)}
                     </span>
            
                   </div>
                 `).join("")}
            
               </div>
            
               <div id="teacherPlayer-${c.id}" class="teacher-player"></div>
             `
             : `<p>No videos uploaded</p>`
            }

            <!-- UPLOAD SECTION -->
            <div class="course-actions-bottom">

                <input type="text"
                       id="videoTitle-${c.id}"
                       placeholder="Video title"
                       style="margin-bottom:8px; width:100%; padding:6px;">

                <input type="file"
                       id="videoInput-${c.id}"
                       onchange="handleFileSelect(${c.id})">

                <button id="uploadBtn-${c.id}"
                        onclick="uploadVideo(${c.id})"
                        disabled>
                    Upload Video
                </button>

            </div>

            <p id="uploadStatus-${c.id}" class="upload-text">
                Upload more videos anytime
            </p>

            <!-- STATUS -->
            <span class="status-badge ${c.status}">
                ${
                    c.status === "approved"
                    ? "Approved"
                    : c.status === "rejected"
                    ? "Rejected"
                    : "Pending"
                }
            </span>

            ${
              c.status === "rejected" && c.rejection_remark
              ? `<p style="color:#ef4444; margin-top:6px;">
                   ❗ Reason: ${c.rejection_remark}
                 </p>`
              : ""
            }

        </div>

    `).join("");
}

function toggleDeleteMode(courseId) {
    activeDeleteMode[courseId] = !activeDeleteMode[courseId];
    renderFilteredCourses(currentFilterType);
}

function openDeleteConfirmModal(courseId) {
    currentDeleteCourseId = courseId;

    const modal = document.getElementById("deleteVideoModal");

    modal.classList.add("active");   // ✅ CSS control
    modal.style.display = "flex";    // ✅ FORCE visibility

    updateDeleteCount(courseId);
}


function closeDeleteVideoModal() {
    const modal = document.getElementById("deleteVideoModal");

    if (modal) {
        modal.classList.remove("active");
        
        
        setTimeout(() => {
            modal.style.display = "none";
        }, 10);
    }
}

document.addEventListener("DOMContentLoaded", () => {
    const modal = document.getElementById("deleteVideoModal");
    if (modal) modal.style.display = "none";
});

async function confirmDeleteVideos() {

    const courseId = currentDeleteCourseId;
    const token = getAuthToken();

    if (!token) {
      showToast("Session expired, login again 🔐", "error");
      showSection("login");
      return;
    }

    const selected = Array.from(
        document.querySelectorAll(`.video-checkbox[data-course="${courseId}"]`)
    ).filter(cb => cb.checked).map(cb => cb.value);

    if (selected.length === 0) {
        showToast("Select at least one video", "warning");
        return;
    }

    try {
        const res = await fetch(`${API_BASE}/api/courses/videos/bulk-delete`, {
            method: "DELETE",
            headers: {
                "Content-Type": "application/json",
                "Authorization": "Bearer " + token
            },
            body: JSON.stringify({ videoIds: selected })
        });

        const data = await res.json();

        if (!res.ok) {
            showToast(data.message || "Delete failed", "error");
            return;
        }

        showToast("Videos deleted successfully 🎉", "success");
 
        showUndoToast(selected);

        // 👇 Call the renamed function here!
        closeDeleteVideoModal();
        activeDeleteMode[courseId] = false;

        await fetchTeacherCourses();
        renderFilteredCourses(currentFilterType);

    } catch (err) {
        console.error(err);
        showToast("Server error", "error");
    }
}

function playTeacherVideo(url) {
  const container = document.querySelector(".teacher-player");

  if (!container) return;

  container.innerHTML = `
    <video controls autoplay style="width:100%; margin-top:10px;">
      <source src="${url}" type="video/mp4">
    </video>
  `;
}

function openDeleteCourseModal(courseId) {
    selectedCourseId = courseId;

    const modal = document.getElementById("deleteCourseModal");

    if (!modal) {
        console.error("Modal not found ❌");
        return;
    }

    modal.classList.add("active");
}

function closeDeleteCourseModal() {
    document.getElementById("deleteCourseModal")
        .classList.remove("active");
}

function showUndoToast(videos) {
    lastDeletedVideos = videos;

    const toast = document.getElementById("undoToast");
    toast.style.display = "flex";

    setTimeout(() => {
        toast.style.display = "none";
        lastDeletedVideos = [];
    }, 5000);
}

async function undoDelete() {

    if (!lastDeletedVideos.length) return;

    const token = getAuthToken();

    if (!token) {
      showToast("Session expired, login again 🔐", "error");
      showSection("login");
      return;
    }

    try {
        const res = await fetch(`${API_BASE}/api/courses/videos/restore`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": "Bearer " + token
            },
            body: JSON.stringify({
                videoIds: lastDeletedVideos
            })
        });

        const data = await res.json();

        if (!res.ok) {
            showToast(data.message || "Undo failed", "error");
            return;
        }

        showToast("Undo successful 🔄", "success");

        await fetchTeacherCourses();
        renderFilteredCourses(currentFilterType);

    } catch (err) {
        console.error(err);
        showToast("Undo failed", "error");
    }

    document.getElementById("undoToast").style.display = "none";
    lastDeletedVideos = [];
}

document.addEventListener("keydown", (e) => {

    const modal = document.getElementById("deleteVideoModal");

    if (!modal || !modal.classList.contains("active")) return;

    // ENTER → confirm
    if (e.key === "Enter") {
        const btn = document.getElementById("confirmDeleteBtn");
        if (btn && !btn.disabled) {
            btn.click();
        }
    }

    // ESC → cancel
    if (e.key === "Escape") {
        closeVideoDeleteModal();
    }
});

function handleFileSelect(courseId) {
  const input = document.getElementById(`videoInput-${courseId}`);
  const btn = document.getElementById(`uploadBtn-${courseId}`);
  const status = document.getElementById(`uploadStatus-${courseId}`);

  if (!input || !btn || !status) return;

  const file = input.files[0];

  if (!file) {
    btn.disabled = true;
    btn.innerText = "Select file first";

    status.innerText = "❌ No file selected";
    status.style.color = "red";
    return;
  }

  // ✅ FILE SELECTED
  btn.disabled = false;
  btn.innerText = "Upload Video";

  status.innerText = `📁 ${file.name} (${(file.size / 1024).toFixed(1)} KB)`;
  status.style.color = "#aaa";
}

async function updateProgress(courseId) {
  const token = getAuthToken();

    if (!token) {
      showToast("Session expired, login again 🔐", "error");
      showSection("login");
      return;
    }

  try {
    const res = await fetch(`${API_BASE}/api/enroll/progress/${courseId}`, {
      method: "PUT",
      headers: {
         "Authorization": "Bearer " + token
      }
    });

    const data = await res.json();

    if (!res.ok) {
      showToast(data.message || "Error", "error");
      return;
    }

    showToast("Progress updated", "success");

    loadDashboard();
    loadMyCourses();

  } catch {
    showToast("Server error", "error");
  }
}

async function viewStudents() {

    // 🔐 ADD THIS (TOP LEVEL CHECK)
    const token = getAuthToken();

    if (!token) {
        showToast("Session expired, login again 🔐", "error");
        showSection("login");
        return;
    }

    const box = document.getElementById("courseDetailsBox");
    const studentBtn = document.getElementById("studentBtn");
    const courseBtn = document.getElementById("courseBtn");

    if (!box) return;

    // 🔥 SAME BUTTON CLICK → TOGGLE CLOSE
    if (currentOpenPanel === "students") {

        box.classList.remove("open");
        box.classList.add("closing");

        if (studentBtn) studentBtn.classList.remove("active");

        currentOpenPanel = null;

        setTimeout(() => {
            box.innerHTML = "";
            box.classList.remove("closing");
        }, 300);

        return;
    }

    // 🔥 SWITCH FROM COURSES → STUDENTS
    if (currentOpenPanel === "courses") {
        if (courseBtn) courseBtn.classList.remove("active");
    }

    currentOpenPanel = "students";

    // ================= OPEN =================

    box.dataset.type = "students";

    if (studentBtn) studentBtn.classList.add("active");

    resetNav([
        { label: "Home", onclick: "showSection('browse')" },
        { label: "Teacher Dashboard", onclick: "showSection('teacherDashboard')" }
    ]);

    pushNav("Students");
    updateBreadcrumb();

    box.classList.remove("open");
    box.classList.add("closing");

    setTimeout(async () => {

        box.innerHTML = `
            <div class="students-wrapper fade-anim">

                <div class="comment-header">
                    <h3>👨‍🎓 Students</h3>
                    <button class="back-btn-modern" onclick="goBackNav()">
                        ⬅️ Back
                    </button>
                </div>

                <div id="studentList" class="student-list">
                    Loading students...
                </div>

            </div>
        `;

        box.classList.remove("closing");
        box.classList.add("open");

        // ❌ REMOVED duplicate token (already validated above)

        try {
            const res = await fetch(`${API_BASE}/api/courses/students`, {
                headers: {
                    Authorization: "Bearer " + token
                }
            });

            const students = await res.json();

            // 🔐 HANDLE TOKEN EXPIRED (EXTRA SAFETY)
            if (res.status === 401) {
                localStorage.removeItem("token");
                localStorage.removeItem("user");
                showToast("Session expired, login again 🔐", "error");
                showSection("login");
                return;
            }

            const list = document.getElementById("studentList");

            if (!students.length) {
                list.innerHTML = "<p>No students yet</p>";
                return;
            }

            list.innerHTML = students.map(s => `
                <div class="student-item fade-anim">
                    <strong>${s.name}</strong>
                    <p>${s.email}</p>
                    <span style="color:#22c55e;">
                        📚 ${s.courseName || ""}
                    </span>
                </div>
            `).join("");

        } catch (err) {
            console.error(err);
            document.getElementById("studentList").innerHTML =
                "<p>Error loading students</p>";
        }

    }, 250);
}

function initVideoProgress(courseId) {
  const video = document.getElementById("courseVideo");
  const bar = document.querySelector(".progress-fill");

  if (!video || !bar) return;

  video.addEventListener("timeupdate", () => {
    if (!video.duration) return;

    const percent = (video.currentTime / video.duration) * 100;

    // ✅ update UI
    bar.style.width = percent + "%";

    // 🔥 STEP 3 GOES HERE
    clearTimeout(window.saveTimer);

    window.saveTimer = setTimeout(() => {
      saveProgress(courseId, video.currentTime);
    }, 2000);
  });
}

async function saveProgress(courseId, time) {
  const token = getAuthToken();

    if (!token) {
      showToast("Session expired, login again 🔐", "error");
      showSection("login");
      return;
    }

  try {
    await fetch(`${API_BASE}/api/enroll/progress/${courseId}`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        "Authorization": "Bearer " + token
      },
      body: JSON.stringify({ time })
    });
  } catch (err) {
    console.error("Progress save error");
  }
}

function goBackToDetails() {

    const box = document.getElementById("courseDetailsBox");
    if (!box) return;

    // 🔒 CLOSE CURRENT VIEW
    box.classList.remove("open");
    box.classList.add("closing");

    // ✅ FIX: use nav system (NOT setBreadcrumb)
    goBackNav(); // removes "Comments"

    setTimeout(() => {

        box.classList.remove("closing");

        // 🔥 REOPEN COURSES PROPERLY
        toggleCourseDetails(true);

    }, 200);
}

async function loadComments(courseId) {
  const list = document.getElementById("commentList");
  if (!list) return;

  list.innerHTML = "Loading comments..."; // better UX

  try {
    const res = await fetch(`${API_BASE}/api/comments/${courseId}`);

    if (!res.ok) {
      list.innerHTML = "<p>Error loading comments</p>";
      return;
    }

    const data = await res.json();

    if (!data.length) {
      list.innerHTML = "<p>No comments yet</p>";
      return;
    }

    const tree = buildCommentTree(data);

    list.innerHTML = renderCommentsTree(tree, courseId);

  } catch (err) {
    console.error("Comment error:", err);
    list.innerHTML = "<p>Error loading comments</p>";
  }
}

async function addComment(courseId) {
  const input = document.getElementById("commentInput");
  const text = input.value.trim();

  if (!text) return;

  const token = getAuthToken();

    if (!token) {
      showToast("Session expired, login again 🔐", "error");
      showSection("login");
      return;
    }

  try {
    const res = await fetch(`${API_BASE}/api/comments/${courseId}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": "Bearer " + token
      },
      body: JSON.stringify({ text })
    });

    if (!res.ok) {
      alert("Failed to add comment");
      return;
    }

    input.value = "";
    loadComments(courseId);

  } catch {
    alert("Server error");
  }
}

function showReplyBox(id) {
  const box = document.getElementById(`replyBox-${id}`);
  if (!box) return;

  box.style.display = box.style.display === "none" ? "block" : "none";
}

async function submitReply(courseId, parentId) {
  const input = document.getElementById(`replyInput-${parentId}`);

  if (!input) return;

  const text = input.value.trim();

  if (!text) return;

  const token = getAuthToken();

  if (!token) {
    showToast("Session expired, login again 🔐", "error");
    showSection("login");
    return;
  }

  try {
    const res = await fetch(`${API_BASE}/api/comments/${courseId}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": "Bearer " + token
      },
      body: JSON.stringify({
        text,
        parent_id: parentId
      })
    });

    const data = await res.json();

    // 🔐 TOKEN EXPIRED
    if (res.status === 401) {
      localStorage.removeItem("token");
      localStorage.removeItem("user");
      showToast("Session expired, login again 🔐", "error");
      showSection("login");
      return;
    }

    if (!res.ok) {
      showToast(data.message || "Reply failed", "error");
      return;
    }

    // ✅ SUCCESS
    input.value = "";
    showToast("Reply added 💬", "success");

    // 🔄 REFRESH COMMENTS
    loadComments(courseId);

  } catch (err) {
    console.error(err);
    showToast("Server error", "error");
  }
}

function buildCommentTree(comments) {
  const map = {};
  const roots = [];

  comments.forEach(c => {
    c.children = [];
    map[c.id] = c;
  });

  comments.forEach(c => {
    if (c.parent_id) {
      map[c.parent_id]?.children.push(c);
    } else {
      roots.push(c);
    }
  });

  return roots;
}

function renderCommentsTree(nodes, courseId) {
  return nodes.map(c => {

    const name =
      c.name ||
      c.user_name ||
      c.student_name ||
      c.user?.name ||
      "User";

    const firstLetter = name.charAt(0).toUpperCase();

    return `
      <div class="comment-card">

        <!-- 🔥 HEADER (avatar + name in SAME ROW) -->
        <div class="comment-header">
          <div class="avatar">${firstLetter}</div>
          <span class="comment-user">${name}</span>
        </div>

        <div class="comment-text">${c.text}</div>

        <div class="comment-actions">
          <button onclick="showReplyBox(${c.id})">Reply</button>

          ${currentUser && (
            currentUser.id === c.user_id || 
            currentUser.role === "teacher" || 
            currentUser.role === "admin"
          ) ? `
            <button onclick="editComment(${c.id}, ${JSON.stringify(c.text)})">Edit</button>
            <button onclick="deleteComment(${c.id}, ${courseId})">Delete</button>
          ` : ""}
        </div>

        <div id="replyBox-${c.id}" style="display:none; margin-top:10px;">
          <input type="text" id="replyInput-${c.id}" placeholder="Reply...">
          <button onclick="submitReply(${courseId}, ${c.id})">Send</button>
        </div>

        ${
          c.children.length
            ? `<div class="comment-children">
                 ${renderCommentsTree(c.children, courseId)}
               </div>`
            : ""
        }

      </div>
    `;
  }).join("");
}

async function editComment(id, oldText) {
  const newText = prompt("Edit comment:", oldText);

  if (!newText || !newText.trim()) return;

  const token = getAuthToken();

  if (!token) {
    showToast("Session expired, login again 🔐", "error");
    showSection("login");
    return;
  }

  try {
    const res = await fetch(`${API_BASE}/api/comments/${id}`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        "Authorization": "Bearer " + token
      },
      body: JSON.stringify({
        text: newText.trim(),
        courseId: selectedCourseId
      })
    });

    const data = await res.json();

    // 🔐 TOKEN EXPIRED
    if (res.status === 401) {
      localStorage.removeItem("token");
      localStorage.removeItem("user");
      showToast("Session expired, login again 🔐", "error");
      showSection("login");
      return;
    }

    if (!res.ok) {
      showToast(data.message || "Failed to update comment", "error");
      return;
    }

    showToast("Comment updated ✏️", "success");

    // 🔄 REFRESH UI
    loadComments(selectedCourseId);

  } catch (err) {
    console.error(err);
    showToast("Server error", "error");
  }
}

async function deleteComment(id) {
  if (!confirm("Delete this comment?")) return;

  const token = getAuthToken();

  if (!token) {
    showToast("Session expired, login again 🔐", "error");
    showSection("login");
    return;
  }

  try {
    const res = await fetch(`${API_BASE}/api/comments/${id}`, {
      method: "DELETE",
      headers: {
        "Content-Type": "application/json",
        "Authorization": "Bearer " + token
      },
      body: JSON.stringify({
        courseId: selectedCourseId
      })
    });

    const data = await res.json();

    // 🔐 TOKEN EXPIRED
    if (res.status === 401) {
      localStorage.removeItem("token");
      localStorage.removeItem("user");
      showToast("Session expired, login again 🔐", "error");
      showSection("login");
      return;
    }

    if (!res.ok) {
      showToast(data.message || "Delete failed", "error");
      return;
    }

    showToast("Comment deleted 🗑️", "success");

    // 🔄 REFRESH UI
    loadComments(selectedCourseId);

  } catch (err) {
    console.error(err);
    showToast("Server error", "error");
  }
}

function viewComments(courseId) {

    const box = document.getElementById("courseDetailsBox");
    if (!box) return;

    // 🔥 SET CURRENT COURSE (IMPORTANT FOR SOCKET FILTER)
    selectedCourseId = courseId;

    // 🔥 JOIN SOCKET ROOM
    if (socket && selectedCourseId) {
      socket.emit("joinCourse", selectedCourseId);
    }

    // 🔥 SET TYPE
    box.dataset.type = "comments";

    // 🔥 NAV
    pushNav("Comments");
    updateBreadcrumb();

    // 🔒 CLOSE CURRENT VIEW
    box.classList.remove("open");
    box.classList.add("closing");

    setTimeout(() => {

        box.innerHTML = `
            <div class="comment-wrapper fade-anim">

                <div class="comment-header">
                    <h3>💬 Course Comments</h3>
                    <button class="back-btn-modern" onclick="handleBackFromComments()">
                        ← Back
                    </button>
                </div>

                <div id="teacherCommentList" class="comment-list">
                    Loading comments...
                </div>

            </div>
        `;

        box.classList.remove("closing");
        box.classList.add("open");

        // ✅ LOAD ONCE (NO POLLING)
        loadTeacherComments(courseId);

    }, 250);
}



function handleBackFromComments() {
    goBackNav();
    goBackToDetails();
}

async function loadTeacherComments(courseId) {

    const list = document.getElementById("teacherCommentList");
    if (!list) return;

    try {
        const res = await fetch(`${API_BASE}/api/comments/${courseId}`);
        const data = await res.json();

        if (!data.length) {
            list.innerHTML = `
                <p style="color:#94a3b8; text-align:center;">
                    No comments yet
                </p>
            `;
            return;
        }

        // ✅ BUILD TREE
        const tree = buildCommentTree(data);

        // ✅ RENDER TREE (NEW)
        list.innerHTML = renderTeacherCommentsTree(tree, courseId);

    } catch (err) {
        console.error(err);
        list.innerHTML = `
            <p style="color:#ef4444; text-align:center;">
                Error loading comments
            </p>
        `;
    }
}

function renderTeacherCommentsTree(nodes, courseId, level = 0) {
    return nodes.map(c => `

        <div class="comment-item" data-id="${c.id}" style="margin-left:${level * 20}px">

            <div class="comment-left">
                <div class="avatar-circle">
                    ${c.name.charAt(0).toUpperCase()}
                </div>
            </div>

            <div class="comment-body">

                <div class="comment-header-row">
                    <span class="comment-user">
                        ${c.name}
                        ${
                          c.role === "teacher" ? "👨‍🏫" :
                          c.role === "admin" ? "🛡️" : ""
                        }
                    </span>

                    <span class="comment-time">
                        ${new Date(c.created_at).toLocaleTimeString()}
                    </span>
                </div>

                <p class="comment-text">${c.text}</p>

                <!-- ✅ ACTIONS -->
                <div style="margin-top:5px; display:flex; gap:8px; flex-wrap:wrap;">

                    <!-- REPLY -->
                    <button onclick="showReplyBox(${c.id})">Reply</button>

                    ${
                      currentUser && (
                        currentUser.id === c.user_id ||
                        currentUser.role === "teacher" ||
                        currentUser.role === "admin"
                      )
                      ? `
                        <button onclick="editComment(${c.id}, ${JSON.stringify(c.text)})">
                          Edit
                        </button>

                        <button onclick="deleteComment(${c.id}, ${courseId})">
                          Delete
                        </button>
                      `
                      : ""
                    }

                </div>

                <!-- REPLY BOX -->
                <div id="replyBox-${c.id}" style="display:none; margin-top:5px;">
                    <input type="text" id="replyInput-${c.id}" placeholder="Reply...">
                    <button onclick="submitReply(${courseId}, ${c.id})">Send</button>
                </div>

                <!-- CHILDREN -->

                <div class="replies">
                  ${c.children && c.children.length
                    ? renderTeacherCommentsTree(c.children, courseId, level + 1)
                    : ""
                  }
                </div>

            </div>

        </div>

    `).join("");
}

function appendNewComment(comment) {

  const list =
    document.getElementById("teacherCommentList") ||
    document.getElementById("commentList");

  if (!list) return;

  // 🚫 prevent duplicate
  if (document.querySelector(`[data-id="${comment.id}"]`)) return;

  // ✅ use your template (IMPORTANT)
  const html = createCommentHTML(comment, comment.course_id, 0);

  // 🟢 handle replies vs main comments
  if (comment.parent_id) {
    const parent = document.querySelector(`[data-id="${comment.parent_id}"] .replies`);

    if (parent) {
      parent.insertAdjacentHTML("beforeend", html);
    } else {
      // fallback (if parent not rendered yet)
      list.insertAdjacentHTML("beforeend", html);
    }

  } else {
    // main comment
    list.insertAdjacentHTML("beforeend", html);
  }
}

function updateCommentUI(commentId, newText) {

  const el = document.querySelector(`[data-id="${commentId}"]`);
  if (!el) return;

  const textEl = el.querySelector(".comment-text");

  if (textEl) {
    textEl.textContent = newText;
  }
}

function deleteCommentUI(commentId) {

  const el = document.querySelector(`[data-id="${commentId}"]`);
  if (!el) return;

  el.remove();
}

function createCommentHTML(c, courseId, level = 0) {

  const userName = c.name || "User";

  const time = new Date(c.created_at).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit"
  });

  return `
    <div class="comment-item" data-id="${c.id}" style="margin-left:${level * 20}px">

      <div class="comment-left">
        <div class="avatar-circle">
          ${userName.charAt(0).toUpperCase()}
        </div>
      </div>

      <div class="comment-body">

        <div class="comment-header-row">
          <span class="comment-user">
            ${userName}
            ${
              c.role === "teacher" ? "👨‍🏫" :
              c.role === "admin" ? "🛡️" : ""
            }
          </span>

          <span class="comment-time">${time}</span>
        </div>

        <p class="comment-text">${c.text}</p>

        <div style="margin-top:5px;">
          <button onclick="showReplyBox(${c.id})">Reply</button>

          ${
            currentUser && (
              currentUser.id === c.user_id ||
              currentUser.role === "teacher" ||
              currentUser.role === "admin"
            )
            ? `
              <button onclick="editComment(${c.id}, ${JSON.stringify(c.text)})">Edit</button>
              <button onclick="deleteComment(${c.id}, ${courseId})">Delete</button>
            `
            : ""
          }
        </div>

        <div id="replyBox-${c.id}" style="display:none; margin-top:5px;">
          <input type="text" id="replyInput-${c.id}" placeholder="Reply...">
          <button onclick="submitReply(${courseId}, ${c.id})">Send</button>
        </div>

        <!-- 🔥 IMPORTANT -->
        <div class="replies"></div>

      </div>
    </div>
  `;
}


function logout() {

    if (!currentUser) {
        showToast("You are not logged in ⚠️", "warning");
        return;
    }

    currentUser = null;

    // 🔥 CLEAR STORAGE
    localStorage.removeItem("token");
    localStorage.removeItem("user");

    // 🔌 DISCONNECT SOCKET
    if (socket) {
        socket.disconnect();
        socket = null;
    }

    courses = [];
    myCourses = [];

    const loginUser = document.getElementById("loginUser");
    const loginPass = document.getElementById("loginPass");

    if (loginUser) loginUser.value = "";
    if (loginPass) loginPass.value = "";


    const search = document.getElementById("searchInput");
    if (search) search.value = "";

    updateUserUI(null);
    updateAuthUI(null);

    fetchCourses(); 

    showToast("Logged out successfully", "success");

    showSection("browse");
}


function toggleRegisterForm() {
    const role = document.getElementById("role").value;
    const teacherFields = document.getElementById("teacherFields");

    if (role === "teacher") {
        teacherFields.style.display = "block";
    } else {
        teacherFields.style.display = "none";
    }
}


async function addCourse() {

    // 🔥 PROFILE CHECK
    if (currentUser?.role === "teacher" && !isTeacherProfileComplete(currentUser)) {
        showToast("Complete your profile first ⚠️", "warning");
        showSection("profile");
        return;
    }

    const title = document.getElementById("courseTitle").value.trim();
    const category = document.getElementById("courseCategory").value.trim();
    const type = document.getElementById("courseType").value;
    const priceInput = document.getElementById("coursePrice").value;
    const description = document.getElementById("courseDescription").value.trim();

    const price = parseInt(priceInput) || 0;

    // 🔒 VALIDATION
    if (!title || !category || !type) {
        showToast("Fill all fields", "error");
        return;
    }

    if (type === "paid" && price < 1) {
        showToast("Price must be at least ₹1", "error");
        return;
    }

    const token = getAuthToken();

    if (!token) {
        showToast("Session expired, login again 🔐", "error");
        showSection("login");
        return;
    }

    try {
        const res = await fetch(`${API_BASE}/api/courses`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": "Bearer " + token
            },
            body: JSON.stringify({
                title,
                category,
                type,
                price: type === "paid" ? price : 0,
                description
            })
        });

        const data = await res.json();

        // 🔐 HANDLE TOKEN EXPIRED
        if (res.status === 401) {
            localStorage.removeItem("token");
            localStorage.removeItem("user");
            showToast("Session expired, login again 🔐", "error");
            showSection("login");
            return;
        }

        if (!res.ok) {
            showToast(data.message || "Error adding course", "error");
            return;
        }

        // ✅ SUCCESS
        showToast("Course submitted for approval ⏳", "success");

        closeAddCourse();

        // 🔄 RESET FORM
        document.getElementById("courseTitle").value = "";
        document.getElementById("courseCategory").value = "";
        document.getElementById("courseType").selectedIndex = 0;
        document.getElementById("coursePrice").value = "";
        document.getElementById("priceGroup").style.display = "none";

        // 🔄 REFRESH DASHBOARD
        if (typeof loadTeacherDashboard === "function") {
            loadTeacherDashboard();
        }

    } catch (err) {
        console.error(err);
        showToast("Server error", "error");
    }
}

async function loadAdminPanel() {

    const usersEl = document.getElementById("adminUsers");
    const coursesEl = document.getElementById("adminCourses");

    const totalUsersEl = document.getElementById("adminTotalUsers");
    const totalCoursesEl = document.getElementById("adminTotalCourses");

    const token = getAuthToken();

    if (!token) {
      showToast("Session expired, login again 🔐", "error");
      showSection("login");
      return;
    }

    if (!usersEl || !coursesEl || !totalUsersEl || !totalCoursesEl) {
        console.error("Admin elements missing");
        return;
    }

    try {
        const usersRes = await fetch(`${API_BASE}/api/auth/users`, {
            headers: { Authorization: "Bearer " + token }
        });
        const users = await usersRes.json();

        const coursesRes = await fetch(`${API_BASE}/api/courses/all`, {
            headers: { Authorization: "Bearer " + token }
        });
        const courses = await coursesRes.json();

        totalUsersEl.innerText = users.length;
        totalCoursesEl.innerText = courses.length;

        const students = users.filter(u => u.role === "student");
        const teachers = users.filter(u => u.role === "teacher");

        // ================= USERS =================
                usersEl.innerHTML = `
                    <div class="admin-animate">
                
                        <div class="admin-header">
                            <h2>👥 Users</h2>
                            <button class="admin-back-btn" onclick="closeAdminSection()">⬅ Back</button>
                        </div>
                
                        <!-- STUDENTS -->
                        <div class="collapsible-section">
                            <div class="collapsible-header" onclick="toggleUserSection(this)">
                                👨‍🎓 Students (${students.length})
                                <span class="arrow">▶</span>
                            </div>
                
                            <div class="user-grid collapsible-content">
                                ${students.map(u => `
                                    <div class="dash-card">
                                        <h4>${u.name || "No Name"}</h4>
                                        <p>${u.email}<br>${u.mobile}</p>
                                        <span class="role-tag role-student">Student</span>
                
                                        <div class="admin-actions">
                
                                            <button class="admin-btn delete"
                                                onclick="deleteUser(${u.id}, \`${u.name}\`)">
                                                🗑 Delete
                                            </button>
                
                                            <button class="admin-btn block"
                                                onclick="toggleBlockUser(${u.id}, ${u.is_blocked}, \`${u.name}\`)">
                                                ${u.is_blocked ? "✅ Unblock" : "🚫 Block"}
                                            </button>
                
                                        </div>
                
                                    </div>
                                `).join("")}
                            </div>
                        </div>
                
                        <!-- TEACHERS -->
                        <div class="collapsible-section">
                            <div class="collapsible-header" onclick="toggleUserSection(this)">
                                👨‍🏫 Teachers (${teachers.length})
                                <span class="arrow">▶</span>
                            </div>
                
                            <div class="user-grid collapsible-content">
                                ${teachers.map(u => `
                                    <div class="dash-card">
                                        <h4>${u.name || "No Name"}</h4>
                                        <p>${u.email}<br>${u.mobile}</p>
                                        <span class="role-tag role-teacher">Teacher</span>
                
                                        <div class="admin-actions">
                
                                            <button class="admin-btn delete"
                                                onclick="deleteUser(${u.id}, \`${u.name}\`)">
                                                🗑 Delete
                                            </button>
                
                                            <button class="admin-btn block"
                                                onclick="toggleBlockUser(${u.id}, ${u.is_blocked}, \`${u.name}\`)">
                                                ${u.is_blocked ? "✅ Unblock" : "🚫 Block"}
                                            </button>
                
                                        </div>
                
                                    </div>
                                `).join("")}
                            </div>
                        </div>
                
                    </div>
                `;

        // ================= COURSES (UNCHANGED) =================
        const pending = courses.filter(c => c.status === "pending");
        const approved = courses.filter(c => c.status === "approved");
        const rejected = courses.filter(c => c.status === "rejected");

        coursesEl.innerHTML = `
            <div class="admin-animate">

                <div class="course-section">

                    <div class="admin-header">
                        <h2>📚 Courses</h2>
                        <button class="admin-back-btn" onclick="closeAdminSection()">⬅ Back</button>
                    </div>

                    <h4 style="color:#f59e0b;">⏳ Pending (${pending.length})</h4>
                    <div class="user-grid">
                        ${
                            pending.length
                            ? pending.map(c => `
                                <div class="course-card-admin pending">
                                    <h4>${c.title}</h4>
                                    <p>${c.category}</p>
                                    <span>👨‍🏫 ${c.teacher_name || "Unknown"}</span>

                                    <div class="course-actions">
                                        <button onclick="approveCourse('${c.id}', this)" class="btn-approve">Approve</button>
                                        <button onclick="console.log('BTN CLICK', ${c.id}); openRejectModal(${c.id})">Reject</button>
                                        <button onclick="deleteCourse('${c.id}')" class="delete-btn">🗑 Delete</button>
                                    </div>  
                                </div>
                            `).join("")
                            : "<p>No pending courses</p>"
                        }
                    </div>

                    <h4 style="color:#22c55e; margin-top:20px;">✅ Approved (${approved.length})</h4>
                    <div class="user-grid">
                        ${
                            approved.length
                            ? approved.map(c => `
                                <div class="course-card-admin approved">
                                    <h4>${c.title}</h4>
                                    <p>${c.category}</p>
                                    <span>👨‍🏫 ${c.teacher_name || "Unknown"}</span>

                                    <div class="course-actions">
                                        <button onclick="deleteCourse('${c.id}')" class="delete-btn">🗑 Delete</button>
                                    </div>
                                </div>
                            `).join("")
                            : "<p>No approved courses</p>"
                        }
                    </div>

                    <h4 style="color:#ef4444; margin-top:20px;">❌ Rejected (${rejected.length})</h4>
                    <div class="user-grid">
                        ${
                            rejected.length
                            ? rejected.map(c => `
                                <div class="course-card-admin rejected">
                                    <h4>${c.title}</h4>
                                    <p>${c.category}</p>
                                    <span>👨‍🏫 ${c.teacher_name || "Unknown"}</span>

                                    <div class="course-actions">
                                        <button onclick="deleteCourse('${c.id}')" class="delete-btn">🗑 Delete</button>
                                    </div>
                                </div>
                            `).join("")
                            : "<p>No rejected courses</p>"
                        }
                    </div>

                </div>

            </div>
        `;
         
        if (!currentAdminView) currentAdminView = "users";
        
        if (currentAdminView === "courses") {
            usersEl.style.display = "none";
            coursesEl.style.display = "block";
        } else {
            usersEl.style.display = "block";
            coursesEl.style.display = "none";
        }

        const earningsEl = document.getElementById("adminEarnings");

// 🔥 TEMP SHOW to allow chart calculation
if (earningsEl) earningsEl.style.display = "block";

setTimeout(() => {
    document.querySelectorAll(".admin-animate").forEach(el => {
        el.classList.add("show");
    });
}, 50);

// ✅ LOAD ACTUAL EARNINGS (visible → correct values)
await loadAdminCommissionChart();
await loadEarnings(); // 🔥 ADD THIS LINE HERE

// 🔒 HIDE AGAIN (if not active tab)
if (earningsEl && currentAdminView !== "earnings") {
    earningsEl.style.display = "none";
}

    } catch (err) {
        console.error("ADMIN PANEL ERROR:", err);
        usersEl.innerHTML = "<p>Error loading users</p>";
        coursesEl.innerHTML = "<p>Error loading courses</p>";
    }
}


function deleteUser(userId, userName) {

    showConfirm(
        `Are you sure you want to delete "${userName}"?\n\nThis action cannot be undone.`,
        async () => {

            try {
                const token = getAuthToken();

                const res = await fetch(`${API_BASE}/api/admin/users/${userId}`, {
                    method: "DELETE",
                    headers: {
                        "Authorization": "Bearer " + token
                    }
                });

                const data = await res.json();

                if (!res.ok) {
                    showToast(data.message || "Delete failed", "error");
                    return;
                }

                showToast("User deleted successfully 🗑", "success");
                loadAdminPanel();

            } catch (err) {
                console.error(err);
                showToast("Server error", "error");
            }

        }
    );
}

function toggleBlockUser(userId, isBlocked, userName) {

    const action = isBlocked ? "unblock" : "block";

    showConfirm(
        `Are you sure you want to ${action} "${userName}"?`,
        async () => {

            try {
                const token = getAuthToken();

                const res = await fetch(`${API_BASE}/api/admin/users/block/${userId}`, {
                    method: "PUT",
                    headers: {
                        "Authorization": "Bearer " + token
                    }
                });

                const data = await res.json();

                if (!res.ok) {
                    showToast(data.message || "Action failed", "error");
                    return;
                }

                showToast(
                    isBlocked ? "User unblocked ✅" : "User blocked 🚫",
                    "success"
                );

                loadAdminPanel();

            } catch (err) {
                console.error(err);
                showToast("Server error", "error");
            }

        }
    );
}


function toggleUserSection(header) {

    const content = header.nextElementSibling;
    const arrow = header.querySelector(".arrow");

    if (!content) return;

    const isOpen = content.classList.contains("open");

    if (isOpen) {
        content.classList.remove("open");
        if (arrow) arrow.style.transform = "rotate(0deg)";
    } else {
        content.classList.add("open");
        if (arrow) arrow.style.transform = "rotate(90deg)";
    }
}

window.approveCourse = async function(courseId, btn) {

    const token = getAuthToken();

    try {
        const res = await fetch(`${API_BASE}/api/courses/approve/${courseId}`, {
            method: "PUT",
            headers: {
                Authorization: "Bearer " + token
            }
        });

        const data = await res.json();

        if (!res.ok) {
            showToast(data.message || "Error", "error");
            return;
        }

        showToast("Course Approved ✅", "success");

        await fetchCourses();    
        await loadAdminPanel();  

    } catch (err) {
        console.error(err);
        showToast("Server error", "error");
    }
};

// OPEN MODAL
function openRejectModal(courseId) {

    rejectCourseId = Number(courseId);

    const modal = document.getElementById("rejectModal");

    if (!modal) {
        console.error("Modal NOT found ❌");
        return;
    }

    modal.style.display = "flex";
    modal.classList.add("active");   // 🔥 IMPORTANT

    document.body.style.overflow = "hidden"; // optional

    const input = document.getElementById("rejectRemarkInput");
    if (input) {
        input.value = "";
        setTimeout(() => input.focus(), 100);
    }
}

// CLOSE MODAL
function closeRejectModal() {
    const modal = document.getElementById("rejectModal");

    modal.style.display = "none";
    modal.classList.remove("active");

    document.body.style.overflow = "auto";
}

// SUBMIT REJECT (API CALL MOVED HERE)
async function submitReject() {
    const remarkInput = document.getElementById("rejectRemarkInput");
    const remark = remarkInput.value.trim();

    if (!remark) {
        showToast("Remark is required to reject a course ❌", "error");
        remarkInput.style.borderColor = "red";
        return;
    }

    const token = getAuthToken();

    try {
        const res = await fetch(`${API_BASE}/api/courses/reject/${rejectCourseId}`, {
            method: "PUT",
            headers: {
                "Content-Type": "application/json",
                "Authorization": "Bearer " + token
            },
            body: JSON.stringify({ remark })
        });

        if (!res.ok) {
            const data = await res.json();
            showToast(data.message || "Error rejecting course", "error");
            return;
        }

        showToast("Course Rejected successfully ❌", "success");
        closeRejectModal();

        // Refresh the admin view to show the updated status
        await loadAdminPanel(); 

    } catch (err) {
        console.error("Rejection Error:", err);
        showToast("Server error during rejection", "error");
    }
}

// ================= ADMIN ACTIONS =================
window.closeAdminSection = function() {

    const usersEl = document.getElementById("adminUsers");
    const coursesEl = document.getElementById("adminCourses");
    const earningsEl = document.getElementById("adminEarnings");

    if (!usersEl || !coursesEl) return;

    // Animate out
    document.querySelectorAll(".admin-animate").forEach(el => {
        el.classList.remove("show");
        el.classList.add("hide");
    });

    setTimeout(() => {
        usersEl.style.display = "none";
        coursesEl.style.display = "none";
        if (earningsEl) earningsEl.style.display = "none";
    }, 250);

    // remove active buttons
    document.querySelectorAll("#adminPanel .details-btn").forEach(b => {
        b.classList.remove("active");
    });

    // 🔥 RESET STATE
    currentAdminView = null;

    resetNav([
        { label: "Home", onclick: "showSection('browse')" },
        { label: "Admin Panel", onclick: "showSection('adminPanel')" }
    ]);

    updateBreadcrumb();
};

function toggleAllCourses(el) {
    const section = el.parentElement;
    const contents = section.querySelectorAll(".course-content");
    const arrow = el.querySelector(".arrow");

    const isOpen = contents[0].classList.contains("open");

    contents.forEach(content => {
        if (isOpen) {
            content.classList.remove("open");
        } else {
            content.classList.add("open");
        }
    });

    // arrow rotate
    if (arrow) {
        arrow.style.transform = isOpen ? "rotate(0deg)" : "rotate(90deg)";
    }

    // 🔥 ACTIVE STATE
    if (isOpen) {
        el.classList.remove("active");
    } else {
        el.classList.add("active");
    }
}

function renderCoursesByStatus(courses, container) {

    // 🔥 since you are using approved (boolean)
    const pending = courses.filter(c => c.status === "pending");
    const approved = courses.filter(c => c.status === "approved");

    // ❗ currently rejected not stored → empty
    const rejected = [];

    container.innerHTML = `
        <h3>⏳ Pending Courses</h3>
        ${pending.length ? pending.map(renderPending).join("") : "<p>No pending courses</p>"}

        <h3 style="margin-top:20px;">✅ Approved Courses</h3>
        ${approved.length ? approved.map(renderApproved).join("") : "<p>No approved courses</p>"}

        <h3 style="margin-top:20px;">❌ Rejected Courses</h3>
        ${rejected.length ? rejected.map(renderRejected).join("") : "<p>No rejected courses</p>"}
    `;
}

function renderPending(c) {
    return `
        <div class="dash-card">
            <h4>${c.title}</h4>
            <p>${c.category}</p>

            <p style="font-size:13px; color:#94a3b8;">
                👨‍🏫 ${c.teacher_name || "Unknown"}
            </p>

            <button class="form-btn" onclick="approveCourse('${c.id}')">Approve</button>
            <button class="form-btn" style="background:#ef4444;" onclick="rejectCourse('${c.id}')">Reject</button>
        </div>
    `;
}

function renderApproved(c) {
    return `
        <div class="dash-card">
            <h4>${c.title}</h4>
            <p>${c.category}</p>

            <p style="font-size:13px; color:#94a3b8;">
                👨‍🏫 ${c.teacher_name || "Unknown"}
            </p>

            <button class="form-btn" disabled>Approved ✅</button>
        </div>
    `;
}

function renderRejected(c) {
    return `
        <div class="dash-card">
            <h4>${c.title}</h4>
            <p>${c.category}</p>

            <p>👨‍🏫 ${c.teacher_name || "Unknown"}</p>

            <button class="form-btn" disabled style="background:#ef4444;">Rejected</button>
        </div>
    `;
}


async function approveCourse(courseId) {

    const token = getAuthToken();

    try {
        const res = await fetch(`${API_BASE}/api/courses/approve/${courseId}`, {
            method: "PUT",
            headers: {
                "Authorization": "Bearer " + token
            }
        });

        const data = await res.json();

        if (!res.ok) {
            showToast(data.message || "Approval failed", "error");
            return;
        }

        showToast("Course approved successfully ✅", "success");

        // reload admin panel
        await loadAdminPanel();
        await fetchCourses(); 

    } catch {
        showToast("Server error", "error");
    }
}

async function confirmDeleteCourse() {

    if (!selectedCourseId) return;

    const token = getAuthToken();

    try {
        const res = await fetch(`${API_BASE}/api/courses/${selectedCourseId}`, {
            method: "DELETE",
            headers: {
                "Authorization": "Bearer " + token
            }
        });

        const data = await res.json();

        if (!res.ok) {
            showToast(data.message || "Delete failed", "error");
            return;
        }

        showToast("Course deleted 🗑️", "success");

        closeDeleteCourseModal();

        // 🔄 refresh
        await fetchTeacherCourses(); 

        // 🔥 re-render SAME UI (important)
        renderFilteredCourses(currentFilterType || "all");

    } catch (err) {
        console.error(err);
        showToast("Server error", "error");
    }
}

function renderCoursePlayer(c) {

  // 🔥 HIDE HERO
  document.getElementById("hero")?.classList.add("hidden");

  // 🔥 HIDE HEADING
  const browseSection = document.getElementById("browse");
  if (browseSection) {
    const heading = browseSection.querySelector("h2");
    if (heading) heading.style.display = "none";
  }

  const container = document.getElementById("courseContainer");

  container.innerHTML = `
    <div class="premium-player">

      <!-- HEADER -->
      <div class="player-header">
        <button onclick="showSection('dashboard')" class="back-btn">⬅ Back</button>

        ${
          c.progress === 100
            ? `<button class="complete-btn done" disabled>✅ Completed</button>`
            : `<button onclick="markAsCompleted(${c.id})" class="complete-btn">
                ✓ Mark as Completed
              </button>`
        }
      </div>

      <!-- TITLE -->
      <div class="player-info">
        <h2>${c.title}</h2>
        <p>${c.category}</p>
      </div>

      <div class="top-progress">
         <div class="progress-fill" style="width:${c.progress || 0}%"></div>
      </div>

      <!-- VIDEO -->
      ${
        c.video_url
          ? `
          <div class="video-box">
            <video id="courseVideo" controls onloadedmetadata="initVideoProgress(${c.id})">
              <source src="${c.video_url}" type="video/mp4">
            </video>
          </div>
          `
          : `
          <div class="no-video">
            No video uploaded yet
          </div>
          `
      }

      <!-- COURSE META -->
      <div class="course-meta-strip">
         <span>👨‍🏫 Instructor: ${c.teacher_name || "Unknown"}</span>
         <span>📚 ${c.category}</span>
         <span>
           ${
             c.avgRating
               ? `⭐ ${parseFloat(c.avgRating).toFixed(1)} (${c.totalRatings || 0})`
               : "No rating"
           }
         </span>
      </div>

      <!-- ⭐ RATING -->
      <div class="rating-box" style="margin:15px 0;">
        <h3>⭐ Rate this course</h3>

        <div id="userRating-${c.id}">
          ${[1,2,3,4,5].map(star => `
            <span 
              onclick="handleRatingClick(${c.id}, ${star})"
              class="rating-star"
              data-value="${star}"
            >
              ☆
            </span>
          `).join("")}
        </div>
      </div>

      <!-- 💬 COMMENTS -->
      <div class="comment-wrapper">

        <div class="comment-header">
          <h3>Comments</h3>
        </div>

        <div class="comment-input-box">
          <input type="text" id="commentInput" placeholder="Write a comment...">
          <button onclick="addComment(${c.id})">Post</button>
        </div>

        <div id="commentList" class="comment-list">
          Loading comments...
        </div>

      </div>

      <!-- FOOTER -->
      <div class="player-footer">
        <p>Continue learning at your own pace</p>
      </div>

    </div>
  `;

  loadComments(c.id);
  loadUserRating(c.id);
}

function updateSidebarByRole() {

    const dashboardLink = document.querySelector("a[onclick*='dashboard']");
    const adminLink = document.querySelector("a[onclick*='adminPanel']");

    if (!currentUser || !dashboardLink) return;

    if (currentUser.role === "teacher") {

        dashboardLink.innerHTML = "📊 Teacher Dashboard";

        // 🔥 FIX CLICK BEHAVIOR
        dashboardLink.setAttribute("onclick", "showSection('teacherDashboard')");

        if (adminLink) adminLink.style.display = "none";

    } 
    else if (currentUser.role === "student") {

        dashboardLink.innerHTML = "📊 Student Dashboard";

        // 🔥 RESET CLICK
        dashboardLink.setAttribute("onclick", "showSection('dashboard')");

        if (adminLink) adminLink.style.display = "none";

    } 
    else if (currentUser.role === "admin") {

        if (dashboardLink) dashboardLink.style.display = "none";
        if (adminLink) adminLink.style.display = "block";
    }
}

function loadProfile() {

    if (!currentUser) return;

    // ================= VIEW MODE =================
    document.getElementById("viewName").innerText = currentUser.name || "";
    document.getElementById("viewEmail").innerText = currentUser.email || "";
    document.getElementById("viewMobile").innerText = currentUser.mobile || "";
    document.getElementById("viewAge").innerText = currentUser.age || "";
    document.getElementById("viewLocation").innerText = currentUser.location || "";

    // ================= EDIT MODE (PREFILL) =================
    document.getElementById("profileFullName").value = currentUser.name || "";
    document.getElementById("profileEmail").value = currentUser.email || "";
    document.getElementById("profileMobile").value = currentUser.mobile || "";
    document.getElementById("profileAge").value = currentUser.age || "";
    document.getElementById("profileLocation").value = currentUser.location || "";

    // ================= TEACHER FIELDS =================
    const teacherFields = document.getElementById("teacherProfileFields");

    if (teacherFields) {
        if (currentUser.role === "teacher") {

            teacherFields.style.display = "block";

            document.getElementById("profileSubject").value = currentUser.subject || "";
            document.getElementById("profileSpecialization").value = currentUser.specialization || "";
            document.getElementById("profileOccupation").value = currentUser.occupation || "";

        } else {
            teacherFields.style.display = "none";
        }
    }

    // ================= PROFILE COMPLETION LOGIC =================
    const isComplete = isTeacherProfileComplete(currentUser);

    const editBtn = document.querySelector(".profile-btn");
    const saveBtn = document.querySelector("#profileEdit .form-btn");

    if (currentUser.role === "teacher" && !isComplete) {

        document.getElementById("profileView").style.display = "none";
        document.getElementById("profileEdit").style.display = "block";

        if (editBtn) editBtn.style.display = "none";

        if (saveBtn) saveBtn.innerText = "Complete Profile ✅";

    } else {

        document.getElementById("profileView").style.display = "block";
        document.getElementById("profileEdit").style.display = "none";

        if (editBtn) editBtn.style.display = "inline-block";

        if (saveBtn) saveBtn.innerText = "Save Changes";
    }
}

async function saveProfile() {

    const token = getAuthToken();

    const name = document.getElementById("profileFullName").value.trim();
    const email = document.getElementById("profileEmail").value.trim();
    const mobile = document.getElementById("profileMobile").value.trim();
    const age = document.getElementById("profileAge").value.trim();
    const location = document.getElementById("profileLocation").value.trim();

    const password = document.getElementById("profilePass")?.value || "";
    const confirmPassword = document.getElementById("confirmProfilePass")?.value || "";

    const subject = document.getElementById("profileSubject")?.value;
    const specialization = document.getElementById("profileSpecialization")?.value;
    const occupation = document.getElementById("profileOccupation")?.value;

    const updateData = {};

    // ✅ OPTIONAL FIELDS (only if changed)
    if (name && name !== currentUser.name) updateData.name = name;
    if (email && email !== currentUser.email) updateData.email = email;
    if (mobile && mobile !== currentUser.mobile) updateData.mobile = mobile;
    if (age && age !== String(currentUser.age)) updateData.age = age;
    if (location && location !== currentUser.location) updateData.location = location;

    // 👨‍🏫 TEACHER
    if (currentUser.role === "teacher") {
        if (subject && subject !== currentUser.subject) updateData.subject = subject;
        if (specialization && specialization !== currentUser.specialization) updateData.specialization = specialization;
        if (occupation && occupation !== currentUser.occupation) updateData.occupation = occupation;
    }

    // 🔐 PASSWORD (optional)
    if (password) {
        if (password.length < 6) {
            showToast("Password must be at least 6 characters 🔒", "warning");
            return;
        }

        if (password !== confirmPassword) {
            showToast("Passwords do not match ❌", "error");
            return;
        }

        updateData.password = password;
    }

    if (Object.keys(updateData).length === 0) {
        showToast("No changes made ⚠️", "warning");
        return;
    }

    try {
        const res = await fetch(`${API_BASE}/api/auth/update`, {
            method: "PUT",
            headers: {
                "Content-Type": "application/json",
                "Authorization": "Bearer " + token
            },
            body: JSON.stringify(updateData)
        });

        const data = await res.json();

        if (!res.ok) {
            showToast(data.message || "Update failed ❌", "error");
            return;
        }

        currentUser = data.user;
        localStorage.setItem("user", JSON.stringify(data.user));

        loadProfile();
        updateUserUI(currentUser);

        document.getElementById("profileView").style.display = "block";
        document.getElementById("profileEdit").style.display = "none";

        showToast("Profile updated successfully ✅", "success");

    } catch (err) {
        console.error(err);
        showToast("Server error ❌", "error");
    }
}

function toggleAvatarMenu(e) {
    e.stopPropagation();

    const menu = document.getElementById("avatarMenu");
    menu.classList.toggle("active");
}

// close when clicking outside
document.addEventListener("click", function(e) {
    const container = document.querySelector(".avatar-container");

    if (container && !container.contains(e.target)) {
        closeAvatarMenu();
    }
});

function viewProfile() {

        const hint = document.getElementById("profileHint");
        if (hint) hint.classList.remove("show");

    if (!currentUser) {
        showToast("Please login first", "warning");
        showSection("login");
        return;
    }

    showToast("Opening profile...", "success");

    setTimeout(() => {
        showSection("profile");
    }, 400);
}

function enableEdit() {

    document.getElementById("profileView").style.display = "none";
    document.getElementById("profileEdit").style.display = "block";

    // ✅ PREFILL EVERYTHING
    document.getElementById("profileFullName").value = currentUser.name || "";
    document.getElementById("profileEmail").value = currentUser.email || "";
    document.getElementById("profileMobile").value = currentUser.mobile || "";
    document.getElementById("profileAge").value = currentUser.age || "";
    document.getElementById("profileLocation").value = currentUser.location || "";

    // 🔥 FORCE TEACHER FIELDS
    if (currentUser.role === "teacher") {

        const teacherSection = document.getElementById("teacherProfileFields");
        teacherSection.style.display = "block";

        document.getElementById("profileSubject").value = currentUser.subject || "";
        document.getElementById("profileSpecialization").value = currentUser.specialization || "";
        document.getElementById("profileOccupation").value = currentUser.occupation || "";

    } else {
        document.getElementById("teacherProfileFields").style.display = "none";
    }
}

function closeProfile() {

    if (currentUser.role === "teacher" && !isTeacherProfileComplete(currentUser)) {
        showToast("Complete profile first ⚠️", "warning");
        return;
    }

    showSection("browse");
}


async function confirmDeleteUser() {
    if (!selectedUserId) {
        showToast("No user selected", "error");
        return;
    }

    const token = getAuthToken();

    try {
        const res = await fetch(`${API_BASE}/api/auth/user/${selectedUserId}`, {
            method: "DELETE",
            headers: {
                  Authorization: "Bearer " + token
            }
        });

        const data = await res.json();

        if (!res.ok) {
            showToast(data.message || "Delete failed", "error");
            return;
        }

        showToast("User deleted", "success");

        closeDeleteModal();
        loadAdminPanel();

    } catch {
        showToast("Server error", "error");
    }
}

function closeDeleteModal() {
    document.getElementById("deleteModal").classList.remove("active");
}

async function adminLogin() {

    // 🚫 PREVENT DOUBLE LOGIN
    if (currentUser) {
        showToast("Already logged in ⚠️", "warning");
        return;
    }

    const user = document.getElementById("adminUser").value;
    const pass = document.getElementById("adminPass").value;

    if (!user || !pass) {
        showToast("Enter credentials", "error");
        return;
    }

    try {
        const res = await fetch(`${API_BASE}/api/auth/login`, {
            method: "POST",
            headers: {"Content-Type": "application/json"},
            body: JSON.stringify({
                contact: user,
                password: pass
            })
        });

        const data = await res.json();

        if (!res.ok) {
            showToast(data.message || "Login failed", "error");
            return;
        }

        // 🔒 EXTRA SAFETY (VERY IMPORTANT)
        if (data.user.role !== "admin") {
            showToast("Access denied: Not an admin ❌", "error");
            return;
        }

        // ✅ SAVE SESSION
        localStorage.setItem("token", data.token);
        localStorage.setItem("user", JSON.stringify(data.user));
        currentUser = data.user;

        // 🔥 UPDATE UI (YOU WERE MISSING THIS)
        updateUserUI(data.user);
        updateAuthUI(data.user);

        showToast("Admin login successful", "success");

        // 🚀 REDIRECT
        showSection("adminPanel");

    } catch {
        showToast("Server error", "error");
    }
}

function togglePassword(inputId, el) {
    const input = document.getElementById(inputId);

    if (!input) return;

    if (input.type === "password") {
        input.type = "text";
        el.innerText = "🙈"; // change icon
    } else {
        input.type = "password";
        el.innerText = "👁";
    }
}



function getCourseLessons(course) {
  // 🔥 temporary dynamic logic (based on category/title)

  const baseLessons = [
    "Introduction",
    "Basics",
    "Intermediate Concepts",
    "Advanced Topics"
  ];

  return baseLessons.map((title, index) => ({
    id: index + 1,
    title,
    completed: index < (course.progress || 1),
    locked: index > (course.progress || 1)
  }));
 }

// FORCE CLOSE
function closeAvatarMenu() {
    const menu = document.getElementById("avatarMenu");

    if (!menu) return;

    menu.classList.remove("active");
}

// CLOSE WHEN CLICK OUTSIDE
document.addEventListener("click", (e) => {
    const avatar = document.querySelector(".avatar");
    const menu = document.getElementById("avatarMenu");

    if (!avatar || !menu) return;

    if (!avatar.contains(e.target) && !menu.contains(e.target)) {
        menu.classList.remove("active");
    }
});

window.viewProfile = viewProfile;
window.toggleAvatarMenu = toggleAvatarMenu;
window.closeAvatarMenu = closeAvatarMenu;
window.showSection = showSection;

function handleVideoClick() {
    const loader = document.getElementById("videoLoader");
    const placeholder = document.querySelector(".video-placeholder");

    if (!loader || !placeholder) return;

    // hide placeholder
    placeholder.style.display = "none";

    // show loader
    loader.classList.remove("hidden");

    // simulate loading
    setTimeout(() => {
        loader.innerHTML = "<p style='color:#aaa;'>No video uploaded yet</p>";
    }, 2000);
}

function uploadVideo(courseId) {
  const input = document.getElementById(`videoInput-${courseId}`);
  const btn = document.getElementById(`uploadBtn-${courseId}`);
  const status = document.getElementById(`uploadStatus-${courseId}`);
  const titleInput = document.getElementById(`videoTitle-${courseId}`);

  if (!input || !btn || !status) return;

  const file = input.files[0];

  if (!file) {
    status.innerText = "❌ Select a file first";
    status.style.color = "red";
    return;
  }

  const formData = new FormData();
  formData.append("video", file);

  // 🔥 NEW: add title
  formData.append("title", titleInput?.value || "Lesson");

  const token = getAuthToken();
  const xhr = new XMLHttpRequest();

  // 🔥 STATE: UPLOADING
  btn.disabled = true;
  btn.innerText = "Uploading...";
  status.innerText = "⏳ Uploading... 0%";
  status.style.color = "#f59e0b";

  xhr.open("POST", `/api/courses/upload-video/${courseId}`, true);
  xhr.setRequestHeader("Authorization", "Bearer " + token);

  xhr.upload.onprogress = function (e) {
    if (e.lengthComputable) {
      const percent = Math.round((e.loaded / e.total) * 100);
      status.innerText = `⏳ Uploading... ${percent}%`;
    }
  };

  xhr.onload = async function () {
  if (xhr.status === 200) {
    status.innerText = "✅ Upload complete";
    status.style.color = "#22c55e";

    btn.innerText = "Uploaded";
    btn.disabled = true;

    input.value = "";
    if (titleInput) titleInput.value = "";

    // 🔥 REAL FIX
    await fetchTeacherCourses();
    renderFilteredCourses(currentFilterType);

  } else {
    status.innerText = "❌ Upload failed";
    status.style.color = "red";

    btn.innerText = "Retry Upload";
    btn.disabled = false;
  }
};

  xhr.onerror = function () {
    status.innerText = "❌ Network error";
    status.style.color = "red";

    btn.innerText = "Retry Upload";
    btn.disabled = false;
  };

  xhr.send(formData);
}


function toggleAll(courseId, master) {
  const all = document.querySelectorAll(`.videoCheck-${courseId}`);
  all.forEach(cb => cb.checked = master.checked);
}



async function rateCourse(courseId, rating) {

  const token = getAuthToken();

  if (!token) {
    showToast("Login first 🔐", "warning");
    showSection("login");
    return;
  }

  try {
    const res = await fetch(`${API_BASE}/api/courses/rate/${courseId}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": "Bearer " + token
      },
      body: JSON.stringify({ rating })
    });

    const data = await res.json();

    if (!res.ok) {
      showToast(data.message || "Error", "error");
      return;
    }

    // ✅ Just show feedback (NO reload)
    showToast("Rating submitted ⭐", "success");

    // 🔥 OPTIONAL (better UX)
    // update average rating without closing player
    updateCourseRatingUI(courseId);

  } catch (err) {
    console.error(err);
    showToast("Server error", "error");
  }
}

async function updateCourseRatingUI(courseId) {

  try {
    const res = await fetch(`${API_BASE}/api/courses/rating/${courseId}`);
    const data = await res.json();

    const meta = document.querySelector(".course-meta-strip span:last-child");
    if (!meta) return;

    if (data.avgRating) {
      meta.innerText = `⭐ ${parseFloat(data.avgRating).toFixed(1)} (${data.totalRatings})`;
    }

  } catch (err) {
    console.error("Rating UI update error:", err);
  }
}

function viewRaters(courseId) {

    const box = document.getElementById("courseDetailsBox");

    // 🔒 CLOSE FIRST (for smooth transition)
    box.classList.remove("open");
    box.classList.add("closing");

    setTimeout(async () => {

        box.innerHTML = `
            <div class="ratings-wrapper fade-anim">

                <div class="details-header">

                <h3>⭐ Student Ratings</h3>

                    <button class="back-btn-modern" onclick="toggleCourseDetails(true)">
                        ⬅️ Back
                    </button>

                </div>

                <div id="ratingList" class="ratings-list">
                    Loading...
                </div>

            </div>
        `;

        box.classList.remove("closing");
        box.classList.add("open");

        const token = getAuthToken();

        try {
            const res = await fetch(`${API_BASE}/api/courses/raters/` + courseId, {
                headers: {
                    Authorization: "Bearer " + token
                }
            });

            const raters = await res.json();

            const list = document.getElementById("ratingList");

            if (!raters.length) {
                list.innerHTML = "<p>No ratings yet</p>";
                return;
            }

            list.innerHTML = raters.map(r => `
                <div class="rating-item fade-anim">
                    
                    <div class="rating-left">

                        <div class="avatar-circle">
                            ${r.name.charAt(0).toUpperCase()}
                        </div>

                        <div class="rating-info">
                            <strong>${r.name}</strong>

                            <div class="rating-stars">
                                ${[1,2,3,4,5].map(i => 
                                    i <= r.rating ? "⭐" : "☆"
                                ).join("")}
                            </div>
                        </div>

                    </div>

                </div>
            `).join("");

        } catch (err) {
            console.error(err);
            document.getElementById("ratingList").innerHTML =
                "<p>Error loading ratings</p>";
        }

    }, 250);
}

async function loadRaters(courseId) {

    const list = document.getElementById("ratingList");

    try {
        const token = getAuthToken();

        const res = await fetch(`${API_BASE}/api/courses/raters/${courseId}`, {
            headers: {
                "Authorization": "Bearer " + token
            }
        });
        const data = await res.json();

        if (!data.length) {
            list.innerHTML = "<p>No ratings yet</p>";
            return;
        }

        list.innerHTML = data.map(r => `
            <div class="rating-card">
                <div class="rating-top">
                    <span class="user-name">${r.name}</span>
                    <span class="stars">${"⭐".repeat(r.rating)}</span>
                </div>
            </div>
        `).join("");

    } catch (err) {
        console.error(err);
        list.innerHTML = "<p>Error loading ratings</p>";
    }
}

function setBreadcrumb(items) {
    const container = document.getElementById("breadcrumbContainer");
    if (!container) return;

    // ❌ HIDE on Home (only 1 item and it's Home)
    if (items.length === 1 && items[0].label === "Home") {
        container.innerHTML = "";
        return;
    }

    container.innerHTML = `
        <div class="breadcrumb-bar">
            <div class="breadcrumb">
                ${items.map((item, i) => `
                    <span 
                        class="${i === items.length - 1 ? 'active' : ''}"
                        ${item.onclick ? `onclick="${item.onclick}"` : ''}
                    >
                        ${item.label}
                    </span>
                    ${i < items.length - 1 ? '<span class="sep">›</span>' : ''}
                `).join("")}
            </div>

        </div>
    `;
}

function toggleAddCourseForm() {
    
    if (currentUser?.role === "teacher") {
        if (!isTeacherProfileComplete(currentUser)) {
            showToast("Complete your profile (Subject, Specialization, Occupation) first! ⚠️", "warning");
            showSection("profile");
            return; // STOP execution here
        }
    }

    // Only runs if profile is complete
    document.getElementById("addCourseModal").classList.add("active");
    document.body.style.overflow = "hidden";
}

function closeAddCourse() {
    document.getElementById("addCourseModal").classList.remove("active");
    document.body.style.overflow = "auto";
}

function goBackToBrowse() {

    // ✅ show hero again
    document.getElementById("hero")?.classList.remove("hidden");

    // ✅ show browse heading
    const browseSection = document.getElementById("browse");
    if (browseSection) {
        const heading = browseSection.querySelector("h2");
        if (heading) heading.style.display = "block";
    }

    // ✅ reload courses
    fetchCourses();
}


async function viewStudentDetails(type, btn = null) {

    const token = getAuthToken();
    const box = document.getElementById("studentDetailsBox");

    if (!box) return;

    // 🔁 TOGGLE CLOSE
    if (currentViewType === type && box.classList.contains("open") && btn) {
        closeStudentDetails();
        resetNav([
            { label: "Home", onclick: "showSection('browse')" },
            { label: "Dashboard", onclick: "showSection('dashboard')" }
        ]);
        return;
    }

    // ================= NAV =================
    resetNav([
        { label: "Home", onclick: "showSection('browse')" },
        { label: "Dashboard", onclick: "showSection('dashboard')" }
    ]);

    let label = "All Courses";
    if (type === "progress") label = "In Progress";
    if (type === "completed") label = "Completed";

    pushNav(label);
    updateBreadcrumb();

    if (!token) {
        alert("Please login first!");
        return;
    }

    // ================= ACTIVE BTN =================
    document.querySelectorAll(".details-btn").forEach(b => {
        b.classList.remove("active");
    });

    if (btn) {
        btn.classList.add("active");
    } else {
        const targetBtn = document.querySelector(`.details-btn[onclick*="viewStudentDetails('${type}'"]`);
        if (targetBtn) targetBtn.classList.add("active");
    }

    currentViewType = type;

    box.innerHTML = `<p class="loading">Loading courses...</p>`;
    box.classList.add("open");

    try {
        const res = await fetch(`${API_BASE}/api/enroll/my`, {
            headers: {
                "Authorization": "Bearer " + token
            }
        });

        const data = await res.json();

        // ✅ NORMALIZE
        const normalized = data.map(c => ({
            id: c.id,
            title: (c.title && c.title.trim()) 
                    ? c.title 
                    : (c.name || "Untitled Course"),
            category: c.category || "General",
            teacher_name: c.teacher_name || c.teacherName || "Unknown",
            progress: Number(c.progress) || 0
        }));

        // ✅ FIXED FILTER (IMPORTANT CHANGE)
        let filtered = [];
        if (type === "all") {
            filtered = normalized;
        } 
        else if (type === "progress") {
            filtered = normalized.filter(c => c.progress < 100);
        } 
        else if (type === "completed") {
            filtered = normalized.filter(c => c.progress >= 100);
        }

        // ================= RENDER =================
       box.innerHTML = `
    <div class="category-header">

        <div>
            <h3 style="font-size: 20px; color: #1e293b; margin: 0;">📚 ${label}</h3>

            <div class="course-filters" style="display: flex; gap: 10px; margin-top: 10px;">
                <button onclick="viewStudentDetails('all')" class="filter-btn ${type === 'all' ? 'active' : ''}">All</button>
                <button onclick="viewStudentDetails('progress')" class="filter-btn ${type === 'progress' ? 'active' : ''}">In Progress</button>
                <button onclick="viewStudentDetails('completed')" class="filter-btn ${type === 'completed' ? 'active' : ''}">Completed</button>
            </div>
        </div>

        <button class="category-close" onclick="closeStudentDetails()">✖</button>

    </div>

    ${
        filtered.length
        ? `
        <div class="details-list">
            ${filtered.map(c => `
                <div class="student-row">

                    <div class="student-left">
                        <h4 class="course-title" style="color: #ffffff;">${c.title}</h4>
                        <p>${c.category}</p>
                        <small class="teacher-name">by ${c.teacher_name}</small>
                    </div>

                    <div class="student-center">
                        <div class="student-progress">
                            <div style="width:${c.progress}%"></div>
                        </div>
                        <span class="progress-text">${c.progress}%</span>
                    </div>

                    <div class="student-right">
                        ${
                            c.progress < 100
                            ? `<button onclick="openCourse(${c.id})">Continue</button>`
                            : `<button class="completed-btn" onclick="openCourse(${c.id})">Completed</button>`
                        }
                    </div>

                </div>
            `).join("")}
        </div>
        `
        : `<p class="empty" style="color: #64748b; padding: 20px 0;">No courses found in this category.</p>`
    }
`;

    } catch (err) {
        console.error(err);
        box.innerHTML = `<p style="color:red;">Error loading courses</p>`;
    }
}

// 🔥 CLOSE FUNCTION

function closeStudentDetails() {
    const box = document.getElementById("studentDetailsBox");

    if (box) {
        box.innerHTML = "";
        box.classList.remove("open");
    }

    // ❗ REMOVE ACTIVE STATE FROM BUTTONS
    document.querySelectorAll(".details-btn").forEach(btn => {
        btn.classList.remove("active");
    });

    currentViewType = null;
}

async function markAsCompleted(courseId) {
  const token = getAuthToken();

  try {
    const res = await fetch(`${API_BASE}/api/enroll/complete/${courseId}`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        "Authorization": "Bearer " + token
      },
      body: JSON.stringify({
        progress: 100   // 🔥 force complete
      })
    });

    const data = await res.json();

    if (!res.ok) {
      showToast(data.message || "Error", "error");
      return;
    }

    showToast("Course marked as completed 🎉", "success");

    // 🔥 refresh UI
    loadDashboard();
    loadMyCourses();
    fetchCourses();

    // 🔥 reload player
    openCourse(courseId);

  } catch (err) {
    console.error(err);
    showToast("Server error", "error");
  }
}

function playVideo(courseId, index) {
  const c = courses.find(x => x.id === courseId);
  if (!c) return;

  const video = document.getElementById("mainVideo");
  const title = document.getElementById("videoTitle");
  const btn = document.getElementById("completeBtn");

  if (!video || !title) return;

  const selected = c.videos[index];
  if (!selected) return;

  // 🔥 IMPORTANT: track current video
  currentVideoId = selected.id;

  // change video source
  video.src = selected.video_url;
  video.load();

  // 🔥 FIX: wait until video is ready before setting time
  video.onloadedmetadata = () => {
    if (selected.watchTime) {
      video.currentTime = selected.watchTime;
    }
  };

  // change title
  title.innerText = selected.title || "Lesson";

  // update button
  if (btn) {
    btn.onclick = () => markVideoDone(courseId, selected.id);
  }

  // highlight active lesson
  document.querySelectorAll(".lesson-item").forEach((el, i) => {
    el.classList.toggle("active", i === index);
  });
}

document.addEventListener("ended", (e) => {
  if (e.target.id !== "mainVideo") return;

  const items = document.querySelectorAll(".lesson-item");
  const activeIndex = [...items].findIndex(i => i.classList.contains("active"));

  if (activeIndex < items.length - 1) {
    items[activeIndex + 1].click();
  }
});


// 🔥 TITLE HELPER
function getTitle(type) {
    if (type === "all") return "📚 All Courses";
    if (type === "progress") return "⏳ In Progress";
    if (type === "completed") return "✅ Completed";
    return "Courses";
}

function getTitle(type) {
    if (type === "all") return "📚 All Courses";
    if (type === "progress") return "⏳ In Progress";
    if (type === "completed") return "✅ Completed";
}

function filterBrowseCourses(type, event) {
    currentFilter = type;

    document.querySelectorAll(".filter-btn").forEach(btn => {
        btn.classList.remove("active");
    });

    if (event) event.target.classList.add("active");

    loadCourses(); // 🔥 THIS WAS MISSING / NOT RUNNING
}

function renderStudentCourses(type, data) {

    const box = document.getElementById("studentDetailsBox");

    if (!data.length) {
        box.innerHTML = `
            <div class="details-header">
                <h3>${getTitle(type)}</h3>
                <button class="close-btn" onclick="closeStudentDetails()">✖</button>
            </div>

            ${type === "all" ? getFilterUI(type) : ""}

            <p class="empty">No courses found</p>
        `;
        return;
    }

    box.innerHTML = `
        <div class="details-header">
            <h3>${getTitle(type)}</h3>
            <button class="close-btn" onclick="closeStudentDetails()">✖</button>
        </div>

        ${type === "all" ? getFilterUI(type) : ""}

        <div class="details-list">
            ${data.map(c => `
               <div class="student-row">

    <!-- LEFT -->
    <div class="student-left">
        <h4>${c.title}</h4>
        <p>${c.category}</p>
    </div>

    <!-- CENTER (PROGRESS) -->
    <div class="student-center">
        <div class="student-progress">
            <div style="width:${c.progress || 0}%"></div>
        </div>
        <span class="progress-text">${c.progress || 0}%</span>
    </div>

    <!-- RIGHT -->
    <div class="student-right">
        ${
            c.progress < 100
            ? `<button onclick="updateProgress(${c.id})">Continue</button>`
            : `<button class="completed-btn">Completed</button>`
        }
    </div>

</div> 
            `).join("")}
        </div>
    `;
}

function getFilterUI(activeType) {
    return `
        <div class="course-filters">
            <button onclick="viewStudentDetails('all')" class="filter-btn ${activeType === 'all' ? 'active' : ''}">All</button>
            <button onclick="viewStudentDetails('all')" class="filter-btn">In Progress</button>
            <button onclick="viewStudentDetails('completed')" class="filter-btn">Completed</button>
        </div>
    `;
}

function closeStudentDetails() {

    const box = document.getElementById("studentDetailsBox");

    if (!box) return;

    // smooth close (optional)
    box.classList.remove("open");

    setTimeout(() => {
        box.innerHTML = "";
    }, 200);

    // 🔥 FIX: remove active state from buttons
    document.querySelectorAll(".details-btn").forEach(b => {
        b.classList.remove("active");
    });

    // 🔥 reset state
    currentViewType = null;
}

 function filterStudentCourses(type, btn) {

    currentFilterType = type;

    // 🔥 active UI
    document.querySelectorAll(".filter-btn").forEach(b => {
        b.classList.remove("active");
    });

    if (btn) btn.classList.add("active");

    // 🔥 re-render WITHOUT changing view
    viewStudentDetails("all");
}   

async function payNow(coursePrice, courseId) {

  const token = getAuthToken();

  // =======================
  // STEP 1: CREATE ORDER
  // =======================
  const res = await fetch("http://localhost:4000/api/payment/create-order", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: "Bearer " + token
    },
    body: JSON.stringify({
      amount: coursePrice,
      courseId: courseId
    })
  });

  const data = await res.json();
  const order = data.order;

  // =======================
  // STEP 2: RAZORPAY OPTIONS
  // =======================
  const options = {
    key: "rzp_test_SYCVDsSEAHbimk",
    amount: order.amount,
    currency: "INR",
    name: "EduQuest",
    description: "Course Payment",
    order_id: order.id,

    handler: async function (response) {

      // =======================
      // STEP 3: VERIFY PAYMENT
      // =======================
      const verifyRes = await fetch("http://localhost:4000/api/payment/verify", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer " + token 
        },
        body: JSON.stringify({
          ...response,
          courseId: courseId,
          amount: coursePrice
        })
      });

      const verifyData = await verifyRes.json();

      // =======================
      // STEP 4: ENROLL AFTER PAYMENT
      // =======================
      if (verifyData.success) {

        await fetch("http://localhost:4000/api/enrollments", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: "Bearer " + token
          },
          body: JSON.stringify({
            courseId: courseId
          })
        });

        alert("Payment Successful & Enrolled ✅");

      } else {
        alert("Payment Verification Failed ❌");
      }
    }
  };

  // =======================
  // STEP 5: OPEN PAYMENT
  // =======================
  const rzp = new Razorpay(options);
  rzp.open();
}

async function buyCourse(courseId, price) {
  const token = getAuthToken();

  const res = await fetch(`${API_BASE}/api/payment/create-order`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ amount: price, courseId })
  });

  const data = await res.json();

  const options = {
    key: "rzp_test_SYCVDsSEAHbimk",
    amount: data.order.amount,
    currency: "INR",
    name: "EduQuest",
    description: "Course Purchase",
    order_id: data.order.id,

    prefill: {
      name: "Test User",
      email: "test@example.com",
      contact: "9999999999"
    },

    handler: async function (response) {

      const verifyRes = await fetch(`${API_BASE}/api/payment/verify`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": "Bearer " + token
        },
        body: JSON.stringify({
          ...response,
          courseId
        })
      });

      const result = await verifyRes.json();

      if (result.success) {
        alert("Payment successful 🎉");
        fetchCourses();
      } else {
        alert("Payment failed ❌");
      }
    }
  };

  const rzp = new Razorpay(options);
  rzp.open();
}


function togglePriceField() {
  const type = document.getElementById("courseType").value;
  const priceGroup = document.getElementById("priceGroup");

  if (!priceGroup) return;

  if (type === "paid") {
    priceGroup.style.display = "block";
  } else {
    priceGroup.style.display = "none";
    document.getElementById("coursePrice").value = "";
  }
}

async function deleteCourse(id) {
    const token = getAuthToken();

    if (!confirm("Delete this course?")) return;

    try {
        const res = await fetch(`${API_BASE}/api/courses/${id}`, {
            method: "DELETE",
            headers: {
                "Authorization": "Bearer " + token
            }
        });

        const data = await res.json();

        if (!res.ok) {
            showToast(data.message || "Delete failed", "error");
            return;
        }

        showToast("Course deleted ✅", "success");

        // 🔥 ADMIN FIX
        await loadAdminPanel();

    } catch (err) {
        console.error(err);
        showToast("Server error", "error");
    }
}


window.addEventListener("click", function(e) {
    const modal = document.getElementById("addCourseModal");

    if (e.target === modal) {
        closeAddCourse();
    }
});

function updateBreadcrumb() {
    if (typeof setBreadcrumb !== "function") return;

    const breadcrumb = navStack.map(item => ({
        label: item.label,
        onclick: item.onclick || null
    }));

    setBreadcrumb(breadcrumb);
}

function pushNav(label, onclick = null) {
    navStack.push({ label, onclick });
    updateBreadcrumb();
}

function resetNav(base = []) {
    navStack = base;
    updateBreadcrumb();
}

function goBackNav() {
    navStack.pop();
    updateBreadcrumb();
}

// ================= BULLETPROOF ADMIN SECTION SWITCHER =================
window.showAdminSection = async function(type, btn = null) {

    const usersEl = document.getElementById("adminUsers");
    const coursesEl = document.getElementById("adminCourses");
    const earningsEl = document.getElementById("adminEarnings");

    if (!usersEl || !coursesEl) {
        console.error("Containers missing");
        return;
    }

    // 🔥 TOGGLE CLOSE (KEY LOGIC)
    if (currentAdminView === type) {
        closeAdminSection();
        return;
    }

    // ================= RESET NAV =================
    resetNav([
        { label: "Home", onclick: "showSection('browse')" },
        { label: "Admin Panel", onclick: "showSection('adminPanel')" }
    ]);

    if (type === "users") pushNav("Users");
    else if (type === "courses") pushNav("Courses");
    else if (type === "earnings") pushNav("Earnings");

    updateBreadcrumb();

    // ================= HIDE ALL =================
    usersEl.style.display = "none";
    coursesEl.style.display = "none";
    if (earningsEl) earningsEl.style.display = "none";

    // Remove active button
    document.querySelectorAll(".details-btn").forEach(b => {
        b.classList.remove("active");
    });

    if (btn) btn.classList.add("active");

    // ================= SHOW =================
    if (type === "users") {
        usersEl.style.display = "block";
        animateSection(usersEl);
    }

    else if (type === "courses") {
        coursesEl.style.display = "block";
        animateSection(coursesEl);
    }

    else if (type === "earnings") {
        earningsEl.style.display = "block";
        animateSection(earningsEl);
        await loadEarnings();
    }

    // 🔥 TRACK CURRENT VIEW
    currentAdminView = type;
};

function animateSection(el) {
    el.style.opacity = "1";
    const anim = el.querySelector(".admin-animate");
    if (anim) {
        anim.classList.remove("hide");
        anim.classList.add("show");
    }
}

async function loadEarnings() {
    try {
        const token = getAuthToken();

        const res = await fetch(`${API_BASE}/api/admin/earnings`, {
            headers: {
                "Authorization": "Bearer " + token
            }
        });

        const data = await res.json();

        document.getElementById("totalRevenue").innerText = data.totalRevenue || 0;
        document.getElementById("adminEarning").innerText = data.adminEarning || 0;
        document.getElementById("teacherPayout").innerText = data.teacherPayout || 0;

        // dashboard card update
        document.getElementById("adminTotalEarnings").innerText =
            "₹" + (data.adminEarning || 0);

    } catch (err) {
        console.error("Earnings load error:", err);
    }
}

function isTeacherProfileComplete(user) {
    if (!user) return false;

    return (
        user.subject &&
        user.specialization &&
        user.occupation &&
        user.subject.trim() !== "" &&
        user.specialization.trim() !== "" &&
        user.occupation.trim() !== ""
    );
}

function showProfileHint() {

    const hint = document.getElementById("profileHint");
    if (!hint) return;

    // reset state (important if user logs in again)
    hint.classList.remove("show");

    setTimeout(() => {
        hint.classList.add("show");
    }, 800);

    setTimeout(() => {
        hint.classList.remove("show");
    }, 5000);
}

function goBackNav() {

    const box = document.getElementById("courseDetailsBox");

    if (box) {
        box.classList.remove("open");
        box.innerHTML = "";
    }

    // 🔥 REMOVE ACTIVE STATE (THIS IS YOUR FIX)
    const courseBtn = document.getElementById("courseBtn");
    const studentBtn = document.getElementById("studentBtn");

    if (courseBtn) courseBtn.classList.remove("active");
    if (studentBtn) studentBtn.classList.remove("active");

    if (!navStack || navStack.length <= 1) return;

    navStack.pop();

    const last = navStack[navStack.length - 1];

    updateBreadcrumb();

    if (last && last.onclick) {
        eval(last.onclick);
    }
}

async function loadTeacherEarnings() {

    const token = getAuthToken();

    try {
        const res = await fetch(`${API_BASE}/api/courses/earnings`, {
            headers: {
                Authorization: "Bearer " + token
            }
        });

        const data = await res.json();

        // 🔥 WAIT + SAFE CHECK
        setTimeout(() => {
            const earnEl = document.getElementById("teacherEarnings");

            if (!earnEl) {
                console.error("teacherEarnings element NOT FOUND ❌");
                return;
            }

            earnEl.innerText = "₹" + (data.totalEarnings || 0);

        }, 100);

    } catch (err) {
        console.error("Earnings error:", err);
    }
}

async function toggleEarningsDetails() {

    const box = document.getElementById("courseDetailsBox");

    if (!box) return;

    // 🔁 TOGGLE CLOSE
    if (currentOpenPanel === "earnings") {
        box.classList.remove("open");
        box.innerHTML = "";
        currentOpenPanel = null;
        return;
    }

    currentOpenPanel = "earnings";

    const token = getAuthToken();

    try {
        const res = await fetch(`${API_BASE}/api/courses/earnings`, {
            headers: {
                Authorization: "Bearer " + token
            }
        });

        const data = await res.json();

        window.lastMonthlyData = data.monthly;

        // 🧠 if no breakdown yet
        if (!data.courses || data.courses.length === 0) {
            box.innerHTML = `
                <div class="students-wrapper empty-earnings">

                    <h3>💰 Earnings Overview</h3>

                    <div class="empty-box">
                        <p>💸 No earnings yet</p>
                        <small>Create and sell courses to start earning</small>
                    </div>

                </div>
            `;
            box.classList.add("open");
            return;
        }

        // ✅ render breakdown
        box.innerHTML = `
            <div class="students-wrapper fade-anim">

                <div class="comment-header">
                    <div>
                        <h3>💰 Earnings Overview</h3>
                        <p class="sub-text">Track earnings per course</p>
                    </div>
                    <button class="back-btn-modern" onclick="toggleEarningsDetails()">
                        ⬅ Back
                    </button>
                </div>

                <div class="chart-toggle-wrapper">

                    <button class="chart-toggle-btn" onclick="toggleChart()">
                        📊 Show Chart
                    </button>
                
                    <div id="chartContainer" class="chart-box hidden">
                        <canvas id="earningsChart"></canvas>
                    </div>
                
                </div>
                <div class="transaction-section">

                    <h3>💳 Transaction History</h3>

                    <div id="transactionList" class="transaction-list">
                       Loading transactions...
                    </div>

                </div>
            </div>
        `;

        box.classList.add("open");

        renderTransactions(data.transactions || []);

        setTimeout(() => {
            renderEarningsChart(data.monthly || []);
        }, 100);

    } catch (err) {
        console.error("Earnings breakdown error:", err);
        box.innerHTML = "<p>Error loading earnings</p>";
        box.classList.add("open");
    }
}

function renderEarningsChart(monthlyData) {

    const canvas = document.getElementById("earningsChart");
    if (!canvas) return;

    // ================= EMPTY STATE =================
    if (!monthlyData || monthlyData.length === 0) {
        canvas.parentElement.innerHTML = `
            <div class="empty-chart">
                <p>📊 No earnings data yet</p>
                <small>Start selling courses to see growth</small>
            </div>
        `;
        return;
    }

    const ctx = canvas.getContext("2d");

    const labels = monthlyData.map(m => m.month);
    const values = monthlyData.map(m => Number(m.total));

    // ================= DESTROY OLD =================
    if (earningsChartInstance) {
        earningsChartInstance.destroy();
    }

    // ================= GRADIENT =================
    const gradient = ctx.createLinearGradient(0, 0, 0, 300);
    gradient.addColorStop(0, "rgba(99,102,241,0.6)");
    gradient.addColorStop(1, "rgba(99,102,241,0.02)");

    earningsChartInstance = new Chart(ctx, {
        type: "line",
        data: {
            labels,
            datasets: [{
                label: "Revenue",
                data: values,
                borderColor: "#6366f1",
                backgroundColor: gradient,
                fill: true,
                tension: 0.45,
                borderWidth: 2,
                pointRadius: 4,
                pointHoverRadius: 6,
                pointBackgroundColor: "#6366f1"
            }]
        },
        options: {
            responsive: true,
            interaction: {
                mode: "index",
                intersect: false
            },
            plugins: {
                legend: { display: false },
                tooltip: {
                    backgroundColor: "#020617",
                    borderColor: "#6366f1",
                    borderWidth: 1,
                    titleColor: "#fff",
                    bodyColor: "#e2e8f0"
                }
            },
            scales: {
                x: {
                    ticks: { color: "#94a3b8" },
                    grid: { display: false }
                },
                y: {
                    ticks: { color: "#94a3b8" },
                    grid: { color: "rgba(255,255,255,0.05)" }
                }
            }
        }
    });

    // 🔥 ADD STATS BOX
    renderEarningStats(values);
}

function renderTransactions(transactions) {

    const box = document.getElementById("transactionList");
    if (!box) return;

    if (!transactions.length) {
        box.innerHTML = `<p class="empty-state">No transactions yet</p>`;
        return;
    }

    box.innerHTML = transactions.map(t => `
    <div class="transaction-card premium-card">

        <div class="t-left">
            <h4>${t.course || "Unknown Course"}</h4>
            <p class="student">👤 ${t.student || "Unknown"}</p>
        </div>

        <div class="t-right">
            <p class="amount">₹${t.amount ?? 0}</p>
            <p class="date">${t.created_at ? formatDate(t.created_at) : ""}</p>
            <span class="status-badge ${t.status}">
                ${t.status}
            </span>
        </div>

    </div>
`).join("");
    }



function formatDate(dateStr) {
    const d = new Date(dateStr);
    return d.toLocaleDateString("en-IN", {
        day: "numeric",
        month: "short"
    });
}

function toggleChart() {

    const box = document.getElementById("chartContainer");
    const btn = document.querySelector(".chart-toggle-btn");

    if (!box) return;

    chartVisible = !chartVisible;

    if (chartVisible) {

        box.classList.remove("hidden");
        btn.innerText = "❌ Hide Chart";

        // 🔥 DELAY (IMPORTANT FIX)
        setTimeout(() => {
            if (window.lastMonthlyData && window.lastMonthlyData.length > 0) {
                renderEarningsChart(window.lastMonthlyData);
            } else {
                console.warn("No monthly data found");
            }
        }, 100);

    } else {

        box.classList.add("hidden");
        btn.innerText = "📊 Show Chart";
    }
}

async function sendOTP(type = "register") {
  const emailInput =
    document.getElementById("email") ||   // register
    document.getElementById("fpContact"); // forgot password

  const email = emailInput?.value.trim();

  const btn = document.getElementById("sendOtpBtn");

  // 🔒 VALIDATION
  if (!email) {
    showToast("Enter email", "error");
    return;
  }

  if (!email.includes("@")) {
    showToast("Enter valid email", "error");
    return;
  }

  // ⏱ COOLDOWN CHECK
  if (otpCooldown) {
    showToast("Wait 60 seconds before retry", "warning");
    return;
  }

  try {
    btn.classList.add("loading");

    // 🔥 DECIDE API BASED ON TYPE
    const endpoint =
      type === "register"
        ? "/api/auth/send-otp"
        : "/api/auth/forgot-password";

    const res = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email })
    });

    const data = await res.json();

    if (!res.ok) {
      showToast(data.message || "Failed to send OTP", "error");
      return;
    }

    // ✅ SUCCESS
    showToast(data.message, "success");

    // 🔥 SHOW OTP SECTION
    const otpBox = document.getElementById("otpBox");
    if (otpBox) otpBox.style.display = "block";

    const otpSection = document.getElementById("otpSection");
    if (otpSection) otpSection.style.display = "block";

    // 🔥 DISABLE BUTTON
    btn.disabled = true;

    // 🔥 CLEAR OLD OTP INPUTS
    document.querySelectorAll(".otp-input").forEach(input => input.value = "");

    // ⏱ START TIMER
    startOTPTimer();

    // 🔥 COOLDOWN
    otpCooldown = true;
    setTimeout(() => {
      otpCooldown = false;
    }, 60000);

  } catch (err) {
    console.error("OTP ERROR:", err);
    showToast("Server error", "error");
  } finally {
    btn.classList.remove("loading");
  }
}

function startOTPTimer() {
  let time = 60;
  const timerEl = document.getElementById("otpTimer");
  const btn = document.getElementById("sendOtpBtn");

  clearInterval(timerInterval);

  timerInterval = setInterval(() => {
    timerEl.innerText = `Resend OTP in ${time}s`;
    time--;

    if (time < 0) {
      clearInterval(timerInterval);

      timerEl.innerText = "You can resend OTP now";
      btn.disabled = false;
      btn.innerText = "Resend OTP";
    }
  }, 1000);
}

function getOTPValue() {
  const inputs = document.querySelectorAll(".otp-input");
  return Array.from(inputs).map(i => i.value).join("");
}

async function resetPassword() {
  const contact = document.getElementById("fpContact").value.trim();

  const otpInputs = document.querySelectorAll(".otp-input");
  const otp = Array.from(otpInputs)
    .map(input => input.value)
    .join("");

  const newPassword = document.getElementById("fpNewPass").value.trim();

  // 🔒 VALIDATION
  if (!contact || !otp || !newPassword) {
    showToast("Fill all fields", "error");
    return;
  }

  if (!contact.includes("@")) {
    showToast("Enter valid email", "error");
    return;
  }

  if (otp.length !== 6 || isNaN(otp)) {
    showToast("Enter valid 6-digit OTP", "error");

    // 🔥 SHAKE ON INVALID INPUT
    otpInputs.forEach(box => triggerShake(box));
    otpInputs[0].focus();

    return;
  }

  if (newPassword.length < 6) {
    showToast("Password must be at least 6 characters", "error");
    return;
  }

  try {
    const res = await fetch(`${API_BASE}/api/auth/reset-password`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
       email: contact,
       otp,
       newPassword
      })
    });

    const data = await res.json();

    // ❌ ERROR (WRONG OTP / EXPIRED / NOT FOUND)
    if (!res.ok) {
      showToast(data.message || "Invalid OTP", "error");

      // 🔥 SHAKE EFFECT HERE (MAIN PART)
      otpInputs.forEach(box => triggerShake(box));
      otpInputs[0].focus();

      return;
    }

    // ✅ SUCCESS
    showToast("Password reset successful 🎉", "success");

    // 🔥 CLEAR INPUTS
    otpInputs.forEach(input => input.value = "");
    document.getElementById("fpNewPass").value = "";

    // 🔥 HIDE OTP SECTION
    document.getElementById("otpSection").style.display = "none";

    // 🔥 REDIRECT
    setTimeout(() => {
      showSection("login");
    }, 1000);

  } catch (err) {
    console.error("RESET ERROR:", err);
    showToast("Server error", "error");
  }
}

async function verifyOTP() {
    const email = document.getElementById("email").value.trim(); // ✅ FIXED

    // ✅ ONLY target register OTP box
    const inputs = document.querySelectorAll("#otpBox .otp-input");

    let otp = "";
    inputs.forEach(i => otp += i.value);

    if (!email || otp.length !== 6) {
        showToast("Enter valid OTP", "error");
        return;
    }

    try {
        const res = await fetch(`${API_BASE}/api/auth/verify-otp`, {
            method: "POST",
            headers: {"Content-Type": "application/json"},
            body: JSON.stringify({ email, otp })
        });

        const data = await res.json();

        if (!res.ok) {
            showToast(data.message || "Invalid OTP", "error");
            return;
        }

        window.otpVerified = true;

        showToast("OTP verified ✅", "success");

    } catch (err) {
        console.error(err);
        showToast("Server error", "error");
    }
}

// 🔥 OTP INPUT AUTO MOVE
document.addEventListener("input", (e) => {
  if (e.target.classList.contains("otp-input")) {
    if (e.target.value.length === 1) {
      const next = e.target.nextElementSibling;
      if (next) next.focus();
    }
  }
});

// 🔥 BACKSPACE SUPPORT
document.addEventListener("keydown", (e) => {
  if (e.target.classList.contains("otp-input") && e.key === "Backspace") {
    if (!e.target.value) {
      const prev = e.target.previousElementSibling;
      if (prev) prev.focus();
    }
  }
});


function showConfirm(message, onConfirm) {

    const modal = document.getElementById("confirmModal");
    const text = document.getElementById("confirmText");

    text.innerText = message;
    modal.classList.add("active");

    const okBtn = document.getElementById("confirmOk");
    const cancelBtn = document.getElementById("confirmCancel");

    okBtn.onclick = () => {
        modal.classList.remove("active");
        onConfirm();
    };

    cancelBtn.onclick = () => {
        modal.classList.remove("active");
    };
}

function triggerShake(element) {
  element.classList.add("shake", "shake-error");

  setTimeout(() => {
    element.classList.remove("shake", "shake-error");
  }, 400);
}

async function loadAdminCommissionChart() {

  const token = getAuthToken();

  try {
    const res = await fetch(`${API_BASE}/api/payment/admin-commission-chart`, {
      headers: {
        Authorization: "Bearer " + token
      }
    });

    const data = await res.json();

    const labels = data.map(d => d.month);
    const values = data.map(d => d.totalCommission);

    const ctx = document.getElementById("adminChartCanvas");

    if (!ctx) return;

    if (earningsChartInstance) {
      earningsChartInstance.destroy();
    }

    earningsChartInstance = new Chart(ctx, {
      type: "line",
      data: {
        labels,
        datasets: [{
          label: "Admin Commission",
          data: values,
          tension: 0.3
        }]
      }
    });

  } catch (err) {
    console.error("Chart error:", err);
  }
}

async function updateCommission() {

  const percent = document.getElementById("commissionInput").value;
  const token = getAuthToken();

  if (!percent) {
    showToast("Enter commission %", "error");
    return;
  }

  try {
    const res = await fetch(`${API_BASE}/api/payment/update-commission`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer " + token
      },
      body: JSON.stringify({ percent })
    });
    const data = await res.json();

    if (!res.ok) {
      showToast(data.message, "error");
      return;
    }

    showToast("Commission updated ✅", "success");

  } catch (err) {
    console.error(err);
    showToast("Server error", "error");
  }
}

async function markVideoDone(courseId, videoId) {
  const token = getAuthToken();

  try {
    const res = await fetch(`${API_BASE}/api/enroll/video-done`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        "Authorization": "Bearer " + token
      },
      body: JSON.stringify({ courseId, videoId })
    });

    const data = await res.json();

    if (!res.ok) {
      showToast(data.message || "Error", "error");
      return;
    }

    // 🔥 store completed videos in memory
    const c = courses.find(x => x.id === courseId);

    showToast(`Progress: ${data.progress}%`, "success");

    // ❌ DO NOT refresh from backend
    openCourse(courseId);

  } catch (err) {
    console.error(err);
    showToast("Server error", "error");
  }
}

function updateDeleteCount(courseId) {
    const checkboxes = document.querySelectorAll(
        `.video-checkbox[data-course="${courseId}"]`
    );

    const selected = Array.from(checkboxes).filter(cb => cb.checked);
    const count = selected.length;

    // 🔥 Update badge
    const badge = document.getElementById("deleteCountBadge");
    if (badge) {
        badge.innerText = count;
        badge.style.display = count > 0 ? "inline-block" : "none";
    }

    // 🔥 Enable/Disable button
    const btn = document.getElementById("confirmDeleteBtn");
    if (btn) {
        btn.disabled = count === 0;
    }
}

function viewCourseDetails(courseId) {

  const course = allCoursesData.find(c => c.id === courseId);
  const isEnrolled = Number(course.isEnrolled) === 1;
  const lessons = course.videos?.length || 0;
  const duration = lessons * 5; // approx
  if (!course) return;

  const container = document.getElementById("courseDetailsContent");

  container.innerHTML = `
   <div class="premium-player view-details-ui">

  <!-- TOP BAR -->
  <div class="details-top">
    <button onclick="showSection('browse')" class="details-back">⬅ Back</button>
  </div>

  <!-- HEADER -->
  <div class="details-header">
    <div class="details-left">
      <h1>${course.title}</h1>
      <p class="details-category">${course.category}</p>

        <div class="details-meta">
          <span>👨‍🏫 ${course.teacher_name}</span>
          <span>
            ${
              course.avgRating
                ? `⭐ ${course.avgRating} (${course.totalRatings})`
                : "No rating"
            }
          </span>
        
          <span>📚 ${lessons} Lessons</span>
          <span>⏱ ${duration} min</span>
        </div>
    </div>

    <div class="details-right">
      <span class="details-price">
        ${course.price > 0 ? "₹" + course.price : "Free"}
      </span>

      ${
        !course.isEnrolled
          ? `
            <button class="details-enroll-btn"
              onclick="${
                course.price > 0
                  ? `buyCourse(${course.id}, ${course.price})`
                  : `enrollCourse(${course.id})`
              }">
              ${course.price > 0 ? `💰 Buy ₹${course.price}` : "🚀 Enroll Now"}
            </button>
           `
          : `<span class="enrolled-badge">✔ Enrolled</span>`
       }
      </div>
  </div>

  <!-- MAIN GRID -->
  <div class="details-grid">

    <!-- LEFT: DESCRIPTION -->
    <div class="details-description">
      <h3>📄 About this course</h3>
      <p>${course.description || "No description available"}</p>
    </div>

    <!-- RIGHT: VIDEO -->
    <div class="details-video">

      <div class="video-player" id="detailsPlayer">
        <p>Select a video</p>
      </div>

      <div class="video-list">
        ${
          course.videos?.length
            ? course.videos.map((v, i) => {

                const isPreview = i === 0;
                const isLocked = !isEnrolled && !isPreview;
              
                return `
                    <div class="video-row ${isLocked ? "locked" : ""}"
                         ${!isLocked ? `onclick="playPreview('${v.video_url}')"` : `onclick="showUnlockModal(${course.id})"`}>
              
                    <span>
                      ${isLocked ? "🔒" : "▶"} 
                      ${v.title || "Lesson " + (i+1)}
                    </span>
              
                    ${isPreview ? `<span class="preview-badge">Preview</span>` : ""}
                  </div>
                `;
              }).join("")
            : `<p>No videos available</p>`
        }
      </div>

    </div>

  </div>

</div>
`;

  showSection("courseDetails");
}


function playPreview(url) {
  const player = document.getElementById("detailsPlayer");
  if (!player) return;

  player.innerHTML = `
    <video controls autoplay style="width:100%">
      <source src="${url}" type="video/mp4">
    </video>
  `;
}

window.showUnlockModal = function(courseId) {

    const modal = document.getElementById("unlockModal");
    modal.classList.add("active");

    const btn = document.getElementById("unlockEnrollBtn");

    btn.onclick = () => {
        closeUnlockModal();
        enrollCourse(courseId);
    };
};

window.closeUnlockModal = function() {
    document.getElementById("unlockModal")?.classList.remove("active");
};

const text = "Master top-tier courses, level up your expertise, and accelerate your career with EDUQUEST.";
const typingElement = document.getElementById("typing-text");

let index = 0;

function typeEffect() {
    if (index < text.length) {
        typingElement.innerHTML += text.charAt(index);
        index++;
        setTimeout(typeEffect, 25);
    }
}

document.addEventListener("DOMContentLoaded", () => {
    typeEffect();
});
