import { useState, useEffect } from "react";
import "./App.css";

const API_BASE = "http://localhost:3000/api/v1";

function App() {
  const [token, setToken] = useState(localStorage.getItem("token") || "");
  const [currentUser, setCurrentUser] = useState(null);
  const [authMode, setAuthMode] = useState("login");

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [authStatus, setAuthStatus] = useState("");

  const [employees, setEmployees] = useState([]);
  const [attendances, setAttendances] = useState([]);
  const [leaveRequests, setLeaveRequests] = useState([]);
  const [myLeaves, setMyLeaves] = useState([]);
  const [statusMsg, setStatusMsg] = useState("");
  const [activeTab, setActiveTab] = useState("employees");

  const [empForm, setEmpForm] = useState({
    employeeCode: "",
    name: "",
    department: "",
  });
  const [attForm, setAttForm] = useState({
    employee_id: "",
    work_date: "",
    check_in: "",
    check_out: "",
    status: "ON_TIME",
  });
  const [editingAttId, setEditingAttId] = useState(null);
  const [leaveForm, setLeaveForm] = useState({
    employee_id: "",
    leave_type: "PERSONAL",
    start_date: "",
    end_date: "",
    reason: "",
  });

  useEffect(() => {
    if (token) {
      fetch(`${API_BASE}/auth/me`, {
        headers: { Authorization: `Bearer ${token}` },
      })
        .then((res) => {
          if (!res.ok) throw new Error("Token หมดอายุ");
          return res.json();
        })
        .then((data) => setCurrentUser(data.data))
        .catch(() => handleLogout());
    }
  }, [token]);

  async function handleLogin(e) {
    e.preventDefault();
    setAuthStatus("กำลังเข้าสู่ระบบ...");
    try {
      const res = await fetch(`${API_BASE}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (!res.ok)
        throw new Error(data.error?.message || "เข้าสู่ระบบไม่สำเร็จ");
      localStorage.setItem("token", data.token);
      setToken(data.token);
      setAuthStatus("");
    } catch (err) {
      setAuthStatus(`เกิดข้อผิดพลาด: ${err.message}`);
    }
  }

  async function handleRegister(e) {
    e.preventDefault();
    setAuthStatus("กำลังสมัครสมาชิก...");
    try {
      const res = await fetch(`${API_BASE}/auth/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error?.message || "สมัครไม่สำเร็จ");
      setAuthStatus("สมัครสำเร็จ กรุณาเข้าสู่ระบบ");
      setAuthMode("login");
    } catch (err) {
      setAuthStatus(`เกิดข้อผิดพลาด: ${err.message}`);
    }
  }

  function handleLogout() {
    localStorage.removeItem("token");
    setToken("");
    setCurrentUser(null);
    setEmployees([]);
    setMyLeaves([]);
  }

  async function loadEmployees() {
    try {
      const res = await fetch(`${API_BASE}/employees`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (res.ok) setEmployees(data.data || []);
    } catch (err) {
      console.error(err);
    }
  }

  // ============= ฟังก์ชันพนักงานดูประวัติการลาของตัวเอง =============
  async function loadMyLeaves() {
    if (!leaveForm.employee_id) {
      alert("กรุณากรอกรหัส ID พนักงานของคุณก่อน");
      return;
    }
    try {
      const res = await fetch(
        `${API_BASE}/employees/${leaveForm.employee_id}/leave-requests`,
        {
          headers: { Authorization: `Bearer ${token}` },
        },
      );
      const data = await res.json();
      if (res.ok) {
        setMyLeaves(data.data || []);
      } else {
        alert(data.error?.message || "ไม่พบข้อมูลการลา");
      }
    } catch (err) {
      console.error(err);
    }
  }

  async function handleSubmitLeaveRequest(e) {
    e.preventDefault();
    try {
      const res = await fetch(
        `${API_BASE}/employees/${leaveForm.employee_id}/leave-requests`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            leave_type: leaveForm.leave_type,
            start_date: leaveForm.start_date,
            end_date: leaveForm.end_date,
            reason: leaveForm.reason,
          }),
        },
      );
      if (res.ok) {
        alert("ยื่นขอลาสำเร็จ");
        loadMyLeaves(); // โหลดประวัติใหม่ทันทีหลังยื่นขอลาสำเร็จ
      } else {
        const err = await res.json();
        alert(err.error?.message || "ส่งคำขอไม่สำเร็จ");
      }
    } catch (err) {
      console.error(err);
    }
  }

  // ============= ฟังก์ชัน Admin =============
  async function handleAddEmployee(e) {
    e.preventDefault();
    try {
      const res = await fetch(`${API_BASE}/employees`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(empForm),
      });
      if (res.ok) {
        setStatusMsg("เพิ่มพนักงานสำเร็จ");
        setEmpForm({ employeeCode: "", name: "", department: "" });
        loadEmployees();
      } else throw new Error("เพิ่มไม่สำเร็จ");
    } catch (err) {
      alert(err.message);
    }
  }

  async function handleUpdateEmployee(emp) {
    const newEmployeeCode = window.prompt(
      "ระบุรหัสพนักงานใหม่:",
      emp.employeeCode,
    );
    const newName = window.prompt("ระบุชื่อใหม่:", emp.name);
    const newDepartment = window.prompt(
      "ระบุตำแหน่ง/แผนกใหม่:",
      emp.department,
    );

    // ถ้ากดยกเลิกช่องใดช่องหนึ่ง หรือไม่กรอกข้อมูล ให้ยกเลิกการแก้ไข
    if (!newEmployeeCode || !newName || !newDepartment) return;

    try {
      const res = await fetch(`${API_BASE}/employees/${emp.id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          employeeCode: newEmployeeCode,
          name: newName,
          department: newDepartment,
        }),
      });

      if (res.ok) {
        loadEmployees(); // รีเฟรชข้อมูลพนักงานใหม่
      } else {
        const err = await res.json();
        alert(
          err.error?.message ||
            "แก้ไขข้อมูลไม่สำเร็จ (รหัสพนักงานนี้อาจซ้ำกับคนอื่น)",
        );
      }
    } catch (err) {
      console.error(err);
      alert("เกิดข้อผิดพลาดในการเชื่อมต่อ");
    }
  }

  async function handleDeleteEmployee(id) {
    if (!window.confirm("ต้องการลบพนักงานหรือไม่?")) return;
    try {
      const res = await fetch(`${API_BASE}/employees/${id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) loadEmployees();
    } catch (err) {
      console.error(err);
    }
  }

  async function loadAttendance() {
    try {
      const res = await fetch(`${API_BASE}/employees/attendance`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (res.ok) setAttendances(data.data || []);
    } catch (err) {
      console.error(err);
    }
  }

  async function handleAddAttendance(e) {
    e.preventDefault();
    try {
      if (editingAttId) {
        // กรณีแก้ไข (PATCH)
        const res = await fetch(
          `${API_BASE}/employees/${attForm.employee_id}/attendance/${editingAttId}`,
          {
            method: "PATCH",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({
              check_in: attForm.check_in,
              check_out: attForm.check_out,
              status: attForm.status,
            }),
          },
        );
        if (res.ok) {
          alert("แก้ไขเวลาสำเร็จ");
          setEditingAttId(null);
          setAttForm({
            employee_id: "",
            work_date: "",
            check_in: "",
            check_out: "",
            status: "ON_TIME",
          });
          loadAttendance();
        } else {
          const err = await res.json();
          alert(err.error?.message || "แก้ไขไม่สำเร็จ");
        }
      } else {
        // กรณีเพิ่มใหม่ (POST)
        const res = await fetch(
          `${API_BASE}/employees/${attForm.employee_id}/attendance`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({
              work_date: attForm.work_date,
              check_in: attForm.check_in,
              check_out: attForm.check_out,
              status: attForm.status,
            }),
          },
        );
        if (res.ok) {
          alert("ลงเวลาสำเร็จ");
          setAttForm({
            employee_id: "",
            work_date: "",
            check_in: "",
            check_out: "",
            status: "ON_TIME",
          });
          loadAttendance();
        } else {
          const err = await res.json();
          alert(err.error?.message || "ลงเวลาไม่สำเร็จ");
        }
      }
    } catch (err) {
      alert("เกิดข้อผิดพลาดในการเชื่อมต่อ");
    }
  }

  // ฟังก์ชันยกเลิกการแก้ไข
  function cancelEditAttendance() {
    setEditingAttId(null);
    setAttForm({
      employee_id: "",
      work_date: "",
      check_in: "",
      check_out: "",
      status: "ON_TIME",
    });
  }

  async function loadLeaveRequests() {
    try {
      const res = await fetch(`${API_BASE}/leave-requests`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (res.ok) setLeaveRequests(data.data || []);
    } catch (err) {
      console.error(err);
    }
  }

  async function handleUpdateLeaveStatus(id, newStatus) {
    try {
      const res = await fetch(`${API_BASE}/leave-requests/${id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ status: newStatus }),
      });
      if (res.ok) loadLeaveRequests();
    } catch (err) {
      console.error(err);
    }
  }

  useEffect(() => {
    if (currentUser) {
      loadEmployees();
      if (currentUser.role === "admin") {
        if (activeTab === "attendance") loadAttendance();
        if (activeTab === "leaves") loadLeaveRequests();
      }
    }
  }, [currentUser, activeTab]);

  if (!currentUser) {
    return (
      <div className="container">
        <div className="card">
          <h2>{authMode === "login" ? "เข้าสู่ระบบ" : "สมัครสมาชิก"}</h2>
          <form onSubmit={authMode === "login" ? handleLogin : handleRegister}>
            <input
              type="email"
              placeholder="อีเมล"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
            <input
              type="password"
              placeholder="รหัสผ่าน"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
            <button type="submit">
              {authMode === "login" ? "เข้าสู่ระบบ" : "ลงทะเบียน"}
            </button>
          </form>
          <p className="status-msg">{authStatus}</p>
          <button
            className="link-btn"
            onClick={() =>
              setAuthMode(authMode === "login" ? "register" : "login")
            }
          >
            {authMode === "login"
              ? "ยังไม่มีบัญชี? สมัครเลย"
              : "มีบัญชีแล้ว? เข้าสู่ระบบ"}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="container">
      <div
        className="header"
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <h2>ระบบจัดการพนักงาน ({currentUser.role.toUpperCase()})</h2>
        <div style={{ display: "flex", gap: "1rem", alignItems: "center" }}>
          <span>สวัสดี!! {currentUser.email}</span>
          <button className="btn-delete" onClick={handleLogout}>
            ออกจากระบบ
          </button>
        </div>
      </div>

      {/* เมนูนำทางสำหรับ Admin */}
      {currentUser.role === "admin" && (
        <div style={{ marginBottom: "20px" }}>
          <button
            onClick={() => setActiveTab("employees")}
            disabled={activeTab === "employees"}
          >
            พนักงาน
          </button>
          <button
            onClick={() => setActiveTab("attendance")}
            disabled={activeTab === "attendance"}
            style={{ marginLeft: "10px" }}
          >
            การเข้างาน
          </button>
          <button
            onClick={() => setActiveTab("leaves")}
            disabled={activeTab === "leaves"}
            style={{ marginLeft: "10px" }}
          >
            คำขอลาทั้งหมด
          </button>
        </div>
      )}

      {/* เมนูนำทางสำหรับ Employee */}
      {currentUser.role === "employee" && (
        <div style={{ marginBottom: "20px" }}>
          <button
            onClick={() => setActiveTab("employees")}
            disabled={activeTab === "employees"}
          >
            เพื่อนร่วมงาน
          </button>
          <button
            onClick={() => setActiveTab("my-leaves")}
            disabled={activeTab === "my-leaves"}
            style={{ marginLeft: "10px" }}
          >
            การลาของฉัน
          </button>
        </div>
      )}

      {/* =============== หน้าพนักงานทั่วไป (Admin & Employee) =============== */}
      {activeTab === "employees" && (
        <>
          {/* ส่วนที่ 1: รายชื่อพนักงานในระบบ */}
          <div className="card">
            <div
              style={{
                borderBottom: "1px solid #eee",
                paddingBottom: "10px",
                marginBottom: "20px",
              }}
            >
              <h3 style={{ margin: "0 0 5px 0" }}>รายชื่อพนักงานในระบบ</h3>
              <p style={{ margin: 0, color: "#666", fontSize: "0.9em" }}>
                ข้อมูลพนักงานทั้งหมดและแผนกที่สังกัด
              </p>
            </div>

            <div
              style={{ display: "flex", flexDirection: "column", gap: "12px" }}
            >
              {employees.length === 0 ? (
                <p
                  style={{
                    textAlign: "center",
                    color: "#888",
                    padding: "20px",
                    backgroundColor: "#f9f9f9",
                    borderRadius: "8px",
                  }}
                >
                  ยังไม่มีข้อมูลพนักงาน
                </p>
              ) : (
                employees.map((emp) => (
                  <div
                    key={emp.id}
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      padding: "16px 20px",
                      background: "#ffffff",
                      border: "1px solid #e2e8f0",
                      borderRadius: "12px",
                      transition: "all 0.2s ease",
                      flexWrap: "wrap",
                      gap: "15px",
                    }}
                  >
                    {/* ข้อมูลพนักงาน */}
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "15px",
                      }}
                    >
                      <div
                        style={{
                          width: "48px",
                          height: "48px",
                          borderRadius: "50%",
                          backgroundColor: "#ebf8ff",
                          color: "#3182ce",
                          display: "flex",
                          justifyContent: "center",
                          alignItems: "center",
                          fontSize: "1.2em",
                          fontWeight: "bold",
                          border: "2px solid #bee3f8",
                        }}
                      >
                        {emp.name ? emp.name.charAt(0).toUpperCase() : ""}
                      </div>
                      <div>
                        <h4
                          style={{
                            margin: "0 0 4px 0",
                            color: "#2d3748",
                            fontSize: "1.1em",
                          }}
                        >
                          {emp.name}
                        </h4>
                        <div
                          style={{
                            display: "flex",
                            gap: "10px",
                            fontSize: "0.85em",
                            color: "#718096",
                            alignItems: "center",
                            flexWrap: "wrap",
                          }}
                        >
                          <span
                            style={{
                              display: "flex",
                              alignItems: "center",
                              gap: "5px",
                            }}
                          >
                            <span
                              style={{
                                width: "8px",
                                height: "8px",
                                borderRadius: "50%",
                                backgroundColor: "#48bb78",
                              }}
                            ></span>
                            {currentUser.role === "admin" ? (
                              <>
                                <strong>ID:</strong> {emp.id}
                                <span style={{ color: "#cbd5e0" }}>|</span>
                              </>
                            ) : (
                              <></>
                            )}
                          </span>
                          <strong>employeeCode:</strong> {emp.employeeCode}
                          <span style={{ color: "#cbd5e0" }}>|</span>
                          <span
                            style={{
                              background: "#edf2f7",
                              padding: "3px 10px",
                              borderRadius: "12px",
                              color: "#4a5568",
                              fontWeight: "600",
                            }}
                          >
                            {emp.department}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* ปุ่มจัดการ (เฉพาะ Admin) */}
                    {currentUser.role === "admin" && (
                      <div style={{ display: "flex", gap: "10px" }}>
                        <button
                          className="btn-edit"
                          onClick={() => handleUpdateEmployee(emp)}
                        >
                          แก้ไข
                        </button>

                        <button
                          className="btn-delete"
                          onClick={() => handleDeleteEmployee(emp.id)}
                        >
                          ลบ
                        </button>
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>

          {/* ส่วนที่ 2: ฟอร์มเพิ่มพนักงานใหม่ (Admin เท่านั้น) */}
          {currentUser.role === "admin" && (
            <div className="card">
              <div
                style={{
                  borderBottom: "1px solid #eee",
                  paddingBottom: "10px",
                  marginBottom: "20px",
                }}
              >
                <h3 style={{ margin: "0 0 5px 0" }}>เพิ่มพนักงานใหม่</h3>
                <p style={{ margin: 0, color: "#666", fontSize: "0.9em" }}>
                  เพิ่มข้อมูลพนักงานเข้าสู่ระบบ
                </p>
              </div>
              <form
                onSubmit={handleAddEmployee}
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: "15px",
                }}
              >
                <div style={{ display: "flex", gap: "15px", flexWrap: "wrap" }}>
                  <div
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      gap: "5px",
                      flex: "1",
                      minWidth: "200px",
                    }}
                  >
                    <label style={{ fontWeight: "bold", fontSize: "0.9em" }}>
                      รหัสพนักงาน <span style={{ color: "red" }}>*</span>
                    </label>
                    <input
                      type="text"
                      placeholder="เช่น EMP001"
                      value={empForm.employeeCode}
                      onChange={(e) =>
                        setEmpForm({ ...empForm, employeeCode: e.target.value })
                      }
                      required
                    />
                  </div>
                  <div
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      gap: "5px",
                      flex: "1",
                      minWidth: "200px",
                    }}
                  >
                    <label style={{ fontWeight: "bold", fontSize: "0.9em" }}>
                      ชื่อ-นามสกุล <span style={{ color: "red" }}>*</span>
                    </label>
                    <input
                      type="text"
                      placeholder="เช่น สมชาย ใจดี"
                      value={empForm.name}
                      onChange={(e) =>
                        setEmpForm({ ...empForm, name: e.target.value })
                      }
                      required
                    />
                  </div>
                  <div
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      gap: "5px",
                      flex: "1",
                      minWidth: "200px",
                    }}
                  >
                    <label style={{ fontWeight: "bold", fontSize: "0.9em" }}>
                      ตำแหน่ง / แผนก <span style={{ color: "red" }}>*</span>
                    </label>
                    <input
                      type="text"
                      placeholder="เช่น IT, HR, Sales"
                      value={empForm.department}
                      onChange={(e) =>
                        setEmpForm({ ...empForm, department: e.target.value })
                      }
                      required
                    />
                  </div>
                </div>
                <button
                  type="submit"
                  style={{
                    marginTop: "10px",
                    padding: "12px",
                    backgroundColor: "#3182ce",
                    color: "white",
                    border: "none",
                    borderRadius: "8px",
                    fontWeight: "bold",
                    fontSize: "1em",
                    cursor: "pointer",
                  }}
                >
                  บันทึกข้อมูลพนักงาน
                </button>
              </form>
              {statusMsg && (
                <p
                  className="status-msg"
                  style={{
                    color: "#38a169",
                    fontWeight: "bold",
                    marginTop: "15px",
                  }}
                >
                  {statusMsg}
                </p>
              )}
            </div>
          )}
        </>
      )}

      {/* =============== หน้าการลาของพนักงาน (Employee เท่านั้น) =============== */}
      {activeTab === "my-leaves" && currentUser.role === "employee" && (
        <>
          {/* ส่วนที่ 1: แบบฟอร์มยื่นคำขอลา */}
          <div className="card">
            <div
              style={{
                borderBottom: "1px solid #eee",
                paddingBottom: "10px",
                marginBottom: "20px",
              }}
            >
              <h3 style={{ margin: "0 0 5px 0" }}>แบบฟอร์มยื่นคำขอลา</h3>
              <p style={{ margin: 0, color: "#666", fontSize: "0.9em" }}>
                กรุณากรอกข้อมูลให้ครบถ้วนเพื่อให้หัวหน้างานพิจารณาอนุมัติ
              </p>
            </div>

            <form
              onSubmit={handleSubmitLeaveRequest}
              style={{ display: "flex", flexDirection: "column", gap: "15px" }}
            >
              {/* รหัสพนักงาน */}
              <div
                style={{ display: "flex", flexDirection: "column", gap: "5px" }}
              >
                <label style={{ fontWeight: "bold", fontSize: "0.9em" }}>
                  รหัส ID พนักงานของคุณ <span style={{ color: "red" }}>*</span>
                </label>
                <input
                  type="number"
                  placeholder="เช่น 1, 2, 3 (ดูได้จากหน้าเพื่อนร่วมงาน)"
                  value={leaveForm.employee_id}
                  onChange={(e) =>
                    setLeaveForm({ ...leaveForm, employee_id: e.target.value })
                  }
                  required
                  style={{
                    padding: "10px",
                    borderRadius: "4px",
                    border: "1px solid #ccc",
                  }}
                />
              </div>

              {/* ประเภทการลา */}
              <div
                style={{ display: "flex", flexDirection: "column", gap: "5px" }}
              >
                <label style={{ fontWeight: "bold", fontSize: "0.9em" }}>
                  ประเภทการลา <span style={{ color: "red" }}>*</span>
                </label>
                <select
                  value={leaveForm.leave_type}
                  onChange={(e) =>
                    setLeaveForm({ ...leaveForm, leave_type: e.target.value })
                  }
                  style={{
                    padding: "10px",
                    borderRadius: "4px",
                    border: "1px solid #ccc",
                    backgroundColor: "#fff",
                  }}
                >
                  <option value="PERSONAL">
                    ลากิจ (Personal Leave) - สำหรับธุระส่วนตัวที่จำเป็น
                  </option>
                  <option value="SICK">
                    ลาป่วย (Sick Leave) - ลาเนื่องจากอาการเจ็บป่วย
                  </option>
                  <option value="VACATION">
                    ลาพักร้อน (Vacation) - ลาเพื่อพักผ่อนประจำปี
                  </option>
                </select>
              </div>

              {/* วันที่ลา */}
              <div style={{ display: "flex", gap: "15px", flexWrap: "wrap" }}>
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: "5px",
                    flex: "1",
                    minWidth: "200px",
                  }}
                >
                  <label style={{ fontWeight: "bold", fontSize: "0.9em" }}>
                    วันที่เริ่มต้นลา <span style={{ color: "red" }}>*</span>
                  </label>
                  <input
                    type="date"
                    value={leaveForm.start_date}
                    onChange={(e) =>
                      setLeaveForm({ ...leaveForm, start_date: e.target.value })
                    }
                    required
                    style={{
                      padding: "10px",
                      borderRadius: "4px",
                      border: "1px solid #ccc",
                    }}
                  />
                </div>
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: "5px",
                    flex: "1",
                    minWidth: "200px",
                  }}
                >
                  <label style={{ fontWeight: "bold", fontSize: "0.9em" }}>
                    วันที่สิ้นสุดการลา <span style={{ color: "red" }}>*</span>
                  </label>
                  <input
                    type="date"
                    value={leaveForm.end_date}
                    onChange={(e) =>
                      setLeaveForm({ ...leaveForm, end_date: e.target.value })
                    }
                    required
                    style={{
                      padding: "10px",
                      borderRadius: "4px",
                      border: "1px solid #ccc",
                    }}
                  />
                </div>
              </div>

              {/* เหตุผลการลา */}
              <div
                style={{ display: "flex", flexDirection: "column", gap: "5px" }}
              >
                <label style={{ fontWeight: "bold", fontSize: "0.9em" }}>
                  เหตุผลการลา (ระบุโดยสังเขป)
                </label>
                <textarea
                  placeholder="เช่น ไปทำธุระที่ธนาคาร, ป่วยเป็นไข้หวัด..."
                  value={leaveForm.reason}
                  onChange={(e) =>
                    setLeaveForm({ ...leaveForm, reason: e.target.value })
                  }
                  rows="3"
                  style={{
                    padding: "10px",
                    borderRadius: "4px",
                    border: "1px solid #ccc",
                    resize: "vertical",
                    fontFamily: "inherit",
                  }}
                />
              </div>

              <button
                type="submit"
                style={{
                  marginTop: "10px",
                  padding: "12px",
                  backgroundColor: "#007BFF",
                  color: "white",
                  border: "none",
                  borderRadius: "4px",
                  fontWeight: "bold",
                  fontSize: "1em",
                  cursor: "pointer",
                  transition: "background 0.3s",
                }}
                onMouseOver={(e) =>
                  (e.target.style.backgroundColor = "#0056b3")
                }
                onMouseOut={(e) => (e.target.style.backgroundColor = "#007BFF")}
              >
                ส่งคำขอลา
              </button>
            </form>
          </div>

          {/* ส่วนที่ 2: ประวัติการลาและสถานะ */}
          <div className="card">
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <h3>ประวัติการลาและสถานะ</h3>
              <button className="btn-edit" onClick={loadMyLeaves}>
                รีเฟรช / ดูประวัติ
              </button>
            </div>
            {myLeaves.length === 0 ? (
              <p style={{ color: "#666" }}>
                กรุณากรอก "รหัส ID ของคุณ" ในฟอร์มด้านบนแล้วกดปุ่ม "รีเฟรช /
                ดูประวัติ"
              </p>
            ) : (
              <ul>
                {myLeaves.map((leave) => (
                  <li
                    key={leave.id}
                    style={{
                      marginBottom: "15px",
                      borderBottom: "1px solid #eee",
                      paddingBottom: "10px",
                    }}
                  >
                    <p>
                      <strong>ประเภท:</strong>{" "}
                      {leave.leave_type === "SICK"
                        ? "ลาป่วย"
                        : leave.leave_type === "VACATION"
                          ? "ลาพักร้อน"
                          : "ลากิจ"}{" "}
                      ({leave.leave_type})
                    </p>
                    <p>
                      <strong>วันที่:</strong> {leave.start_date} ถึง{" "}
                      {leave.end_date}
                    </p>
                    <p>
                      <strong>เหตุผล:</strong> {leave.reason || "-"}
                    </p>
                    <p>
                      <strong>สถานะ: </strong>
                      <span
                        style={{
                          color:
                            leave.status === "APPROVED"
                              ? "green"
                              : leave.status === "REJECTED"
                                ? "red"
                                : "orange",
                          fontWeight: "bold",
                        }}
                      >
                        {leave.status}
                      </span>
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </>
      )}

      {/* =============== หน้าการเข้างาน (Admin เท่านั้น) =============== */}
      {activeTab === "attendance" && currentUser.role === "admin" && (
        <>
          <div className="card" style={{ overflowX: "auto" }}>
            <h3>ประวัติการลงเวลาเข้างานทั้งหมด</h3>
            {attendances.length === 0 ? (
              <p>ไม่มีข้อมูลประวัติการเข้างาน</p>
            ) : (
              <table
                style={{
                  width: "100%",
                  borderCollapse: "collapse",
                  marginTop: "15px",
                }}
              >
                <thead>
                  <tr style={{ backgroundColor: "#f4f4f4", textAlign: "left" }}>
                    <th
                      style={{
                        padding: "10px",
                        borderBottom: "1px solid #ddd",
                      }}
                    >
                      รหัสพนักงาน
                    </th>
                    <th
                      style={{
                        padding: "10px",
                        borderBottom: "1px solid #ddd",
                      }}
                    >
                      ชื่อพนักงาน
                    </th>
                    <th
                      style={{
                        padding: "10px",
                        borderBottom: "1px solid #ddd",
                      }}
                    >
                      วันที่
                    </th>
                    <th
                      style={{
                        padding: "10px",
                        borderBottom: "1px solid #ddd",
                      }}
                    >
                      เวลาเข้า
                    </th>
                    <th
                      style={{
                        padding: "10px",
                        borderBottom: "1px solid #ddd",
                      }}
                    >
                      เวลาออก
                    </th>
                    <th
                      style={{
                        padding: "10px",
                        borderBottom: "1px solid #ddd",
                      }}
                    >
                      สถานะ
                    </th>
                    <th
                      style={{
                        padding: "10px",
                        borderBottom: "1px solid #ddd",
                        textAlign: "center",
                      }}
                    >
                      จัดการ
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {attendances.map((att) => (
                    <tr key={att.id}>
                      <td
                        style={{
                          padding: "10px",
                          borderBottom: "1px solid #eee",
                          fontWeight: "bold",
                        }}
                      >
                        {att.employeeCode}
                      </td>
                      <td
                        style={{
                          padding: "10px",
                          borderBottom: "1px solid #eee",
                        }}
                      >
                        {att.employee_name}
                      </td>
                      <td
                        style={{
                          padding: "10px",
                          borderBottom: "1px solid #eee",
                        }}
                      >
                        {att.work_date}
                      </td>
                      <td
                        style={{
                          padding: "10px",
                          borderBottom: "1px solid #eee",
                        }}
                      >
                        {att.check_in}
                      </td>
                      <td
                        style={{
                          padding: "10px",
                          borderBottom: "1px solid #eee",
                        }}
                      >
                        {att.check_out || "-"}
                      </td>
                      <td
                        style={{
                          padding: "10px",
                          borderBottom: "1px solid #eee",
                        }}
                      >
                        <span
                          style={{
                            color:
                              att.status === "ABSENT"
                                ? "red"
                                : att.status === "LATE"
                                  ? "orange"
                                  : "green",
                            fontWeight: "bold",
                          }}
                        >
                          {att.status}
                        </span>
                      </td>
                      <td
                        style={{
                          padding: "10px",
                          borderBottom: "1px solid #eee",
                          textAlign: "center",
                        }}
                      >
                        <button
                          className="btn-edit"
                          onClick={() => {
                            setEditingAttId(att.id);
                            setAttForm({
                              employee_id: att.employee_id,
                              work_date: att.work_date,
                              check_in: att.check_in,
                              check_out: att.check_out || "",
                              status: att.status,
                            });
                            // เลื่อนจอลงมาที่ฟอร์มอัตโนมัติ
                            window.scrollTo({
                              top: document.body.scrollHeight,
                              behavior: "smooth",
                            });
                          }}
                        >
                          แก้ไข
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          <div className="card">
            <div
              style={{
                borderBottom: "1px solid #eee",
                paddingBottom: "10px",
                marginBottom: "20px",
              }}
            >
              <h3 style={{ margin: "0 0 5px 0" }}>
                {editingAttId
                  ? "แก้ไขข้อมูลเข้า-ออกงาน"
                  : "บันทึกเวลาเข้า-ออกงาน"}
              </h3>
              <p style={{ margin: 0, color: "#666", fontSize: "0.9em" }}>
                {editingAttId
                  ? "กำลังแก้ไขประวัติการเข้างานของพนักงาน คุณสามารถอัปเดตเวลาเข้า เวลาออก และสถานะได้"
                  : "สำหรับผู้ดูแลระบบ เพิ่มประวัติการเข้างานให้พนักงานย้อนหลัง"}
              </p>
            </div>

            <form
              onSubmit={handleAddAttendance}
              style={{ display: "flex", flexDirection: "column", gap: "15px" }}
            >
              {/* รหัสพนักงาน */}
              <div
                style={{ display: "flex", flexDirection: "column", gap: "5px" }}
              >
                <label style={{ fontWeight: "bold", fontSize: "0.9em" }}>
                  รหัส ID พนักงาน <span style={{ color: "red" }}>*</span>
                </label>
                <input
                  type="number"
                  placeholder="เช่น 1, 2, 3"
                  value={attForm.employee_id}
                  onChange={(e) =>
                    setAttForm({ ...attForm, employee_id: e.target.value })
                  }
                  required
                  disabled={!!editingAttId}
                  style={{
                    padding: "10px",
                    borderRadius: "4px",
                    border: "1px solid #ccc",
                    backgroundColor: editingAttId ? "#e9ecef" : "#fff",
                  }}
                />
              </div>

              {/* วันที่และสถานะ */}
              <div style={{ display: "flex", gap: "15px", flexWrap: "wrap" }}>
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: "5px",
                    flex: "1",
                    minWidth: "200px",
                  }}
                >
                  <label style={{ fontWeight: "bold", fontSize: "0.9em" }}>
                    วันที่ทำงาน <span style={{ color: "red" }}>*</span>
                  </label>
                  <input
                    type="date"
                    value={attForm.work_date}
                    onChange={(e) =>
                      setAttForm({ ...attForm, work_date: e.target.value })
                    }
                    required
                    disabled={!!editingAttId}
                    style={{
                      padding: "10px",
                      borderRadius: "4px",
                      border: "1px solid #ccc",
                      backgroundColor: editingAttId ? "#e9ecef" : "#fff",
                    }}
                  />
                </div>
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: "5px",
                    flex: "1",
                    minWidth: "200px",
                  }}
                >
                  <label style={{ fontWeight: "bold", fontSize: "0.9em" }}>
                    สถานะการเข้างาน <span style={{ color: "red" }}>*</span>
                  </label>
                  <select
                    value={attForm.status}
                    onChange={(e) =>
                      setAttForm({ ...attForm, status: e.target.value })
                    }
                    style={{
                      padding: "10px",
                      borderRadius: "4px",
                      border: "1px solid #ccc",
                      backgroundColor: "#fff",
                    }}
                  >
                    <option value="ON_TIME">ตรงเวลา (ON_TIME)</option>
                    <option value="LATE">มาสาย (LATE)</option>
                    <option value="ABSENT">ขาดงาน (ABSENT)</option>
                  </select>
                </div>
              </div>

              {/* เวลาเข้า-ออก */}
              <div style={{ display: "flex", gap: "15px", flexWrap: "wrap" }}>
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: "5px",
                    flex: "1",
                    minWidth: "200px",
                  }}
                >
                  <label style={{ fontWeight: "bold", fontSize: "0.9em" }}>
                    เวลาเข้างาน <span style={{ color: "red" }}>*</span>
                  </label>
                  <input
                    type="time"
                    value={attForm.check_in}
                    onChange={(e) =>
                      setAttForm({ ...attForm, check_in: e.target.value })
                    }
                    required
                    style={{
                      padding: "10px",
                      borderRadius: "4px",
                      border: "1px solid #ccc",
                    }}
                  />
                </div>
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: "5px",
                    flex: "1",
                    minWidth: "200px",
                  }}
                >
                  <label style={{ fontWeight: "bold", fontSize: "0.9em" }}>
                    เวลาออกงาน (เว้นว่างได้ถ้ายังไม่ออก)
                  </label>
                  <input
                    type="time"
                    value={attForm.check_out}
                    onChange={(e) =>
                      setAttForm({ ...attForm, check_out: e.target.value })
                    }
                    style={{
                      padding: "10px",
                      borderRadius: "4px",
                      border: "1px solid #ccc",
                    }}
                  />
                </div>
              </div>

              <div style={{ display: "flex", gap: "10px", marginTop: "10px" }}>
                <button type="submit">
                  {editingAttId ? "บันทึกการแก้ไข" : "บันทึกเวลา"}
                </button>

                {editingAttId && (
                  <button
                    className="btn-delete"
                    type="button"
                    onClick={cancelEditAttendance}
                  >
                    ยกเลิก
                  </button>
                )}
              </div>
            </form>
          </div>
        </>
      )}

      {/* =============== หน้าจัดการคำขอลา (Admin เท่านั้น) =============== */}
      {activeTab === "leaves" && currentUser.role === "admin" && (
        <div className="card" style={{ overflowX: "auto" }}>
          <h3>รายการคำขอลาทั้งหมด</h3>
          {leaveRequests.length === 0 ? (
            <p style={{ color: "#666" }}>ไม่มีคำขอลาในระบบ</p>
          ) : (
            <table
              style={{
                width: "100%",
                borderCollapse: "collapse",
                marginTop: "15px",
              }}
            >
              <thead>
                <tr style={{ backgroundColor: "#f4f4f4", textAlign: "left" }}>
                  <th
                    style={{
                      padding: "12px 10px",
                      borderBottom: "2px solid #ddd",
                    }}
                  >
                    ชื่อพนักงาน
                  </th>
                  <th
                    style={{
                      padding: "12px 10px",
                      borderBottom: "2px solid #ddd",
                    }}
                  >
                    ประเภทการลา
                  </th>
                  <th
                    style={{
                      padding: "12px 10px",
                      borderBottom: "2px solid #ddd",
                    }}
                  >
                    วันที่
                  </th>
                  <th
                    style={{
                      padding: "12px 10px",
                      borderBottom: "2px solid #ddd",
                    }}
                  >
                    เหตุผล
                  </th>
                  <th
                    style={{
                      padding: "12px 10px",
                      borderBottom: "2px solid #ddd",
                    }}
                  >
                    สถานะ
                  </th>
                  <th
                    style={{
                      padding: "12px 10px",
                      borderBottom: "2px solid #ddd",
                      textAlign: "center",
                    }}
                  >
                    การจัดการ
                  </th>
                </tr>
              </thead>
              <tbody>
                {leaveRequests.map((leave) => (
                  <tr key={leave.id}>
                    <td
                      style={{
                        padding: "10px",
                        borderBottom: "1px solid #eee",
                      }}
                    >
                      <strong>{leave.employee_name}</strong>
                    </td>
                    <td
                      style={{
                        padding: "10px",
                        borderBottom: "1px solid #eee",
                      }}
                    >
                      {leave.leave_type === "SICK"
                        ? "ลาป่วย"
                        : leave.leave_type === "VACATION"
                          ? "ลาพักร้อน"
                          : "ลากิจ"}
                      <br />
                      <span style={{ fontSize: "0.8em", color: "#888" }}>
                        ({leave.leave_type})
                      </span>
                    </td>
                    <td
                      style={{
                        padding: "10px",
                        borderBottom: "1px solid #eee",
                      }}
                    >
                      {leave.start_date} <br /> ถึง {leave.end_date}
                    </td>
                    <td
                      style={{
                        padding: "10px",
                        borderBottom: "1px solid #eee",
                        maxWidth: "200px",
                        wordWrap: "break-word",
                      }}
                    >
                      {leave.reason || "-"}
                    </td>
                    <td
                      style={{
                        padding: "10px",
                        borderBottom: "1px solid #eee",
                      }}
                    >
                      <span
                        style={{
                          padding: "5px 10px",
                          borderRadius: "20px",
                          fontSize: "0.85em",
                          fontWeight: "bold",
                          color: "#fff",
                          backgroundColor:
                            leave.status === "APPROVED"
                              ? "#4CAF50"
                              : leave.status === "REJECTED"
                                ? "#F44336"
                                : "#FF9800",
                        }}
                      >
                        {leave.status}
                      </span>
                    </td>
                    <td
                      style={{
                        padding: "10px",
                        borderBottom: "1px solid #eee",
                        textAlign: "center",
                      }}
                    >
                      {leave.status === "PENDING" ? (
                        <div
                          style={{
                            display: "flex",
                            justifyContent: "center",
                            gap: "5px",
                          }}
                        >
                          <button
                            className="btn-success"
                            onClick={() =>
                              handleUpdateLeaveStatus(leave.id, "APPROVED")
                            }
                          >
                            อนุมัติ
                          </button>
                          <button
                            className="btn-delete"
                            onClick={() =>
                              handleUpdateLeaveStatus(leave.id, "REJECTED")
                            }
                          >
                            ปฏิเสธ
                          </button>
                        </div>
                      ) : (
                        <span
                          style={{
                            color: "#aaa",
                            fontStyle: "italic",
                            fontSize: "0.9em",
                          }}
                        >
                          ทำรายการแล้ว
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  );
}

export default App;
