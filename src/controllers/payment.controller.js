import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import {
  createOrderService,
  verifyPaymentService,
  getPaymentHistoryService,
  getMyPaymentsService,
} from "../services/payment.service.js";

// POST /payments/create-order  (student)
const createOrder = asyncHandler(async (req, res) => {
  const { courseId, enrollmentType } = req.body;
  const { reused, data } = await createOrderService({ userId: req.user.id, courseId, enrollmentType });
  return res.json(new ApiResponse(200, data, reused ? "Existing pending order returned" : undefined));
});

// POST /payments/verify  (student)
const verifyPayment = asyncHandler(async (req, res) => {
  const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;
  const result = await verifyPaymentService({
    userId: req.user.id,
    razorpay_order_id, razorpay_payment_id, razorpay_signature,
  });
  if (result.alreadyEnrolled) {
    return res.json(new ApiResponse(200, { courseId: result.courseId }, "Already enrolled"));
  }
  return res.json(new ApiResponse(200, {
    courseId: result.courseId,
    paymentId: result.paymentId,
    enrollmentType: result.enrollmentType,
  }, "Payment verified and enrolled successfully"));
});

// GET /payments/history  (admin)
const getPaymentHistory = asyncHandler(async (req, res) => {
  const data = await getPaymentHistoryService(req.query);
  return res.json(new ApiResponse(200, data));
});

// GET /payments/my  (student)
const getMyPayments = asyncHandler(async (req, res) => {
  const payments = await getMyPaymentsService(req.user.id);
  return res.json(new ApiResponse(200, payments));
});

export { createOrder, verifyPayment, getPaymentHistory, getMyPayments };
