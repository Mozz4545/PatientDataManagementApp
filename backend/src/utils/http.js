function sendServerError(res, err, message = 'ລະບົບຂັດຂ້ອງ ກະລຸນາລອງໃໝ່') {
  console.error(err);
  return res.status(500).json({ success: false, message });
}

function isPositiveInt(value) {
  const number = Number(value);
  return Number.isInteger(number) && number > 0;
}

function toPositiveInt(value, fallback) {
  const number = Number(value);
  if (!Number.isInteger(number) || number <= 0) return fallback;
  return number;
}

function requiredString(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

function isAllowed(value, allowed) {
  return allowed.includes(value);
}

module.exports = {
  sendServerError,
  isPositiveInt,
  toPositiveInt,
  requiredString,
  isAllowed,
};
