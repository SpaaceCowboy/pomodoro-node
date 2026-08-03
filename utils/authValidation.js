const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const USERNAME_PATTERN = /^[a-zA-Z0-9_]{3,30}$/;

function validateRegistration({ name = '', username, email, password } = {}) {
  if (typeof name !== 'string' || name.length > 80) {
    return 'Name must be at most 80 characters';
  }

  if (typeof username !== 'string' || !USERNAME_PATTERN.test(username)) {
    return 'Username must be 3-30 characters and contain only letters, numbers, or underscores';
  }

  if (
    typeof email !== 'string' ||
    email.length > 254 ||
    email !== email.trim() ||
    !EMAIL_PATTERN.test(email)
  ) {
    return 'Enter a valid email address';
  }

  if (typeof password !== 'string' || password.length < 12) {
    return 'Password must be at least 12 characters';
  }

  if (Buffer.byteLength(password, 'utf8') > 72) {
    return 'Password must be at most 72 bytes';
  }

  const characterClasses = [/[a-z]/, /[A-Z]/, /\d/, /[^a-zA-Z0-9]/].filter((pattern) =>
    pattern.test(password)
  ).length;
  if (characterClasses < 3) {
    return 'Password must contain at least three of: lowercase, uppercase, number, symbol';
  }

  return null;
}

module.exports = { EMAIL_PATTERN, USERNAME_PATTERN, validateRegistration };
