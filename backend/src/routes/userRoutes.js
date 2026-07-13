const express = require('express');
const userController = require('../controllers/userController');
const authMiddleware = require('../middlewares/authMiddleware');

const router = express.Router();

router.use(authMiddleware);

router.put('/me', userController.updateCurrentUser);
router.delete('/me', userController.deleteCurrentUser);

module.exports = router;
