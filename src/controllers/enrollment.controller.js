import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import {
  checkMyEnrollmentService,
  enrollStudentService,
  unenrollStudentService,
  getMyCoursesService,
  getCourseStudentsService,
  getStudentEnrollmentsService,
  getAllEnrollmentsService,
  getUnenrolledStudentsService,
  broadcastEmailService,
} from "../services/enrollment.service.js";

// GET /enrollments/check/:courseId  (student)
const checkMyEnrollment = asyncHandler(async (req, res) => {
  const data = await checkMyEnrollmentService({ userId: req.user.id, courseId: req.params.courseId });
  return res.json(new ApiResponse(200, data));
});

// POST /enrollments  (admin)
const enrollStudent = asyncHandler(async (req, res) => {
  const { enrollment, reEnrolled } = await enrollStudentService({ ...req.body, enrolledBy: req.user.id });
  return res
    .status(reEnrolled ? 200 : 201)
    .json(new ApiResponse(reEnrolled ? 200 : 201, enrollment, reEnrolled ? "Student re-enrolled successfully" : "Student enrolled successfully"));
});

// DELETE /enrollments/:enrollmentId  (admin)
const unenrollStudent = asyncHandler(async (req, res) => {
  const enrollment = await unenrollStudentService(req.params.enrollmentId);
  return res.json(new ApiResponse(200, enrollment, "Student unenrolled successfully"));
});

// GET /enrollments/my-courses  (student)
const getMyCourses = asyncHandler(async (req, res) => {
  const data = await getMyCoursesService(req.user.id);
  return res.json(new ApiResponse(200, data));
});

// GET /enrollments/course/:courseId/students  (admin / instructor)
const getCourseStudents = asyncHandler(async (req, res) => {
  const data = await getCourseStudentsService({ courseId: req.params.courseId, query: req.query, user: req.user });
  return res.json(new ApiResponse(200, data));
});

// GET /enrollments/student/:userId  (admin)
const getStudentEnrollments = asyncHandler(async (req, res) => {
  const data = await getStudentEnrollmentsService(req.params.userId);
  return res.json(new ApiResponse(200, data));
});

// GET /enrollments  (admin)
const getAllEnrollments = asyncHandler(async (req, res) => {
  const data = await getAllEnrollmentsService(req.query);
  return res.json(new ApiResponse(200, data));
});

// GET /enrollments/unenrolled-students  (admin)
const getUnenrolledStudents = asyncHandler(async (req, res) => {
  const data = await getUnenrolledStudentsService(req.query);
  return res.json(new ApiResponse(200, data));
});

// POST /enrollments/broadcast  (admin)
const broadcastEmail = asyncHandler(async (req, res) => {
  const result = await broadcastEmailService(req.body);
  return res.json(
    new ApiResponse(200, result, `Email sent to ${result.sent} student(s)${result.failed ? `, ${result.failed} failed` : ""}`)
  );
});

export {
  checkMyEnrollment,
  enrollStudent,
  unenrollStudent,
  getMyCourses,
  getCourseStudents,
  getStudentEnrollments,
  getAllEnrollments,
  getUnenrolledStudents,
  broadcastEmail,
};
