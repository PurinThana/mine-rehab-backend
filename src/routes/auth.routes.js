import { Router } from 'express'
import { login, me, logout, changePassword } from '../controllers/auth.controller.js'
import { requireAuth } from '../middleware/auth.js'
import { loginRateLimit } from '../middleware/loginRateLimit.js'

const router = Router()

router.post('/login', loginRateLimit, login)
router.post('/logout', requireAuth, logout)
router.get('/me', requireAuth, me)
router.post('/change-password', requireAuth, changePassword)

export default router
