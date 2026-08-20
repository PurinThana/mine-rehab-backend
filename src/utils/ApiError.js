export class ApiError extends Error {
  constructor(statusCode, message, details) {
    super(message)
    this.statusCode = statusCode
    this.details = details
  }

  static badRequest(message, details) {
    return new ApiError(400, message, details)
  }

  static unauthorized(message = 'ไม่ได้รับอนุญาต (unauthorized)') {
    return new ApiError(401, message)
  }

  static forbidden(message = 'ไม่มีสิทธิ์เข้าถึง (forbidden)') {
    return new ApiError(403, message)
  }

  static notFound(message = 'ไม่พบข้อมูล (not found)') {
    return new ApiError(404, message)
  }

  static conflict(message = 'ข้อมูลซ้ำหรือขัดแย้งกัน (conflict)') {
    return new ApiError(409, message)
  }
}
