const express = require('express');
const router = express.Router();
const { getResults, getResultByOrder, getResultImage, createResult, updateResult } = require('../controllers/resultController');
const authGuard = require('../middleware/authGuard');
const resultImageUpload = require('../middleware/resultImageUpload');

router.use(authGuard);

const uploadResultImage = (req, res, next) => {
  resultImageUpload.single('result_image')(req, res, (err) => {
    if (!err) {
      const imageError = resultImageUpload.validateUploadedResultImage(req.file);
      if (imageError) {
        resultImageUpload.cleanupUploadedResultImage(req.file);
        return res.status(400).json({ success: false, message: imageError });
      }
      return next();
    }

    const message = err.code === 'LIMIT_FILE_SIZE'
      ? resultImageUpload.messages.tooLarge
      : err.message;
    return res.status(400).json({ success: false, message });
  });
};

router.get('/', getResults);
router.get('/order/:orderId', getResultByOrder);
router.get('/:id/image', getResultImage);
router.post('/',              uploadResultImage, createResult);
router.put('/:id',            uploadResultImage, updateResult);

module.exports = router;
