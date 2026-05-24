const express = require('express');
const router = express.Router();
const {
  getPatients,
  getPatientById,
  createPatient,
  updatePatient,
  deletePatient
} = require('../controllers/patientController');
const authGuard = require('../middleware/authGuard');

router.use(authGuard); // ทุก route ต้อง login ก่อน

router.get('/',     getPatients);
router.get('/:id',  getPatientById);
router.post('/',    createPatient);
router.put('/:id',  updatePatient);
router.delete('/:id', deletePatient);

module.exports = router;