import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import {
  markAttendanceService,
  getAttendanceService,
  getBatchAttendanceService,
  getMyAttendanceService,
} from "../services/attendance.service.js";

// POST /attendance  (instructor who owns the batch, or admin)
const markAttendance = asyncHandler(async (req, res) => {
  const { batchId, date, records } = req.body;
  const session = await markAttendanceService({ batchId, date, records, user: req.user });
  return res.status(200).json(new ApiResponse(200, session, "Attendance saved"));
});

// GET /attendance?batchId=&date=  (instructor owner / admin)
const getAttendance = asyncHandler(async (req, res) => {
  const data = await getAttendanceService({ batchId: req.query.batchId, date: req.query.date, user: req.user });
  if (!data) return res.json(new ApiResponse(200, null, "No attendance marked for this date"));
  return res.json(new ApiResponse(200, data));
});

// GET /attendance/batch/:batchId  (instructor owner / admin)
const getBatchAttendance = asyncHandler(async (req, res) => {
  const data = await getBatchAttendanceService({ batchId: req.params.batchId, user: req.user });
  return res.json(new ApiResponse(200, data));
});

// GET /attendance/my/:courseId  (student)
const getMyAttendance = asyncHandler(async (req, res) => {
  const data = await getMyAttendanceService({ courseId: req.params.courseId, userId: req.user.id });
  if (!data) return res.json(new ApiResponse(200, null, "You are not in an offline batch for this course"));
  return res.json(new ApiResponse(200, data));
});

export { markAttendance, getAttendance, getBatchAttendance, getMyAttendance };
