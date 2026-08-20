import { Router } from 'express'

import authRoutes from './auth.routes.js'
import sitesRoutes from './sites.routes.js'
import benchLevelsRoutes from './benchLevels.routes.js'
import speciesRoutes from './species.routes.js'
import plantingsRoutes from './plantings.routes.js'
import activitiesRoutes from './activities.routes.js'
import documentsRoutes from './documents.routes.js'
import newsRoutes from './news.routes.js'
import progressSnapshotsRoutes from './progressSnapshots.routes.js'

const router = Router()

router.use('/auth', authRoutes)
router.use('/sites', sitesRoutes)
// These four mix /sites/:siteId/... and /<resource>/:id paths, so they
// mount at the API root rather than under one fixed prefix.
router.use('/', benchLevelsRoutes)
router.use('/', speciesRoutes)
router.use('/', plantingsRoutes)
router.use('/', activitiesRoutes)
router.use('/', documentsRoutes)
router.use('/', newsRoutes)
router.use('/', progressSnapshotsRoutes)

export default router
