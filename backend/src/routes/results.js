const express = require('express');
const router = express.Router();
const { getResults, getResultByOrder, createResult, updateResult } = require('../controllers/resultController');
const authGuard = require('../middleware/authGuard');
const resultImageUpload = require('../middleware/resultImageUpload');

router.use(authGuard);

const uploadResultImage = (req, res, next) => {
  resultImageUpload.single('result_image')(req, res, (err) => {
    if (!err) return next();
    const message = err.code === 'LIMIT_FILE_SIZE'
      ? 'ຂະໜາດຮູບຕ້ອງບໍ່ເກີນ 5MB'
      : err.message;
    return res.status(400).json({ success: false, message });
  });
};

router.get('/', getResults);
router.get('/order/:orderId', getResultByOrder);
router.post('/',              uploadResultImage, createResult);
router.put('/:id',            uploadResultImage, updateResult);

module.exports = router;
