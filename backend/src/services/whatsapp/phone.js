function normalizeIndianPhone(value) {
  const digits = String(value || "").replace(/\D/g, "");
  const national =
    digits.length === 10
      ? digits
      : digits.length === 11 && digits.startsWith("0")
        ? digits.slice(1)
        : digits.length === 12 && digits.startsWith("91")
          ? digits.slice(2)
          : "";
  if (!/^[6-9]\d{9}$/.test(national)) {
    throw new TypeError("Phone number must be a valid Indian mobile number");
  }
  return `+91${national}`;
}

module.exports = { normalizeIndianPhone };
