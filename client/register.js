import { apiUrl } from './js/config.mjs';

const form = document.getElementById('registerForm');
const status = document.getElementById('status');
const button = document.getElementById('submitBtn');

function setStatus(text, kind = '') {
  status.textContent = text;
  status.className = kind;
}

form.addEventListener('submit', async event => {
  event.preventDefault();
  const body = {
    email: form.email.value.trim(),
    school: form.school.value.trim(),
    yearGroup: form.yearGroup.value.trim(),
    password: form.password.value,
  };
  button.disabled = true;
  setStatus('Creating account...');
  try {
    const res = await fetch(apiUrl('/auth/student/register'), {
      method: 'POST',
      credentials: 'include',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.ok) throw new Error(data.error || 'Registration failed.');
    setStatus(data.yearGroupSaved === false
      ? 'Account created. Year group was not saved because the students table has no year_group column.'
      : 'Account created. Opening the game...', 'good');
    setTimeout(() => { location.href = '/'; }, 900);
  } catch (error) {
    setStatus(error.message || 'Registration failed.', 'bad');
    button.disabled = false;
  }
});
