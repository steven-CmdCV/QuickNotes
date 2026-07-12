const express = require('express');
const noteController = require('../controllers/noteController');

const router = express.Router();

router.get('/', noteController.getNotes);
router.post('/', noteController.createNote);
router.get('/:id', noteController.getNoteById);

module.exports = router;
