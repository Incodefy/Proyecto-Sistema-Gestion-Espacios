// public/js/login.js

function showToast(message, type = 'error') {
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;

  const icon =
    type === 'error'
      ? 'fa-exclamation-circle'
      : type === 'success'
      ? 'fa-check-circle'
      : 'fa-exclamation-triangle';

  toast.innerHTML = `
        <i class="fa-solid ${icon}"></i>
        <span>${message}</span>
    `;

  document.body.appendChild(toast);

  setTimeout(() => toast.classList.add('show'), 100);

  setTimeout(() => {
    toast.classList.remove('show');
    setTimeout(() => document.body.removeChild(toast), 300);
  }, 4000);
}

function validateEmail(email) {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

function validatePassword(password) {
  return password.length >= 6;
}

function showFieldError(fieldId, message) {
  const errorDiv = document.getElementById(fieldId + '-error');
  const inputField = document.getElementById(fieldId);

  if (errorDiv) {
    errorDiv.innerHTML = `<i class="fa-solid fa-exclamation-circle"></i> ${message}`;
  }
  if (inputField) {
    inputField.classList.add('error');
    inputField.classList.remove('success');
  }
}

function showFieldSuccess(fieldId) {
  const errorDiv = document.getElementById(fieldId + '-error');
  const inputField = document.getElementById(fieldId);

  if (errorDiv) errorDiv.innerHTML = '';
  if (inputField) {
    inputField.classList.remove('error');
    inputField.classList.add('success');
  }
}

function clearFieldValidation(fieldId) {
  const errorDiv = document.getElementById(fieldId + '-error');
  const inputField = document.getElementById(fieldId);

  if (errorDiv) errorDiv.innerHTML = '';
  if (inputField) inputField.classList.remove('error', 'success');
}

// --- Validaciones dinámicas ---
const emailInput = document.getElementById('email');
if (emailInput) {
  emailInput.addEventListener('blur', function () {
    const email = this.value.trim();
    if (!email) {
      showFieldError('email', 'El correo electrónico es requerido');
    } else if (!validateEmail(email)) {
      showFieldError('email', 'Ingresa un correo electrónico válido');
    } else {
      showFieldSuccess('email');
    }
  });

  emailInput.addEventListener('input', function () {
    if (this.classList.contains('error')) {
      clearFieldValidation('email');
    }
  });
}

const passwordInput = document.getElementById('password');
if (passwordInput) {
  passwordInput.addEventListener('blur', function () {
    const password = this.value;
    if (!password) {
      showFieldError('password', 'La contraseña es requerida');
    } else if (!validatePassword(password)) {
      showFieldError('password', 'La contraseña debe tener al menos 6 caracteres');
    } else {
      showFieldSuccess('password');
    }
  });

  passwordInput.addEventListener('input', function () {
    if (this.classList.contains('error')) {
      clearFieldValidation('password');
    }
  });
}

// --- Validar formulario ---
const loginForm = document.getElementById('loginForm');
if (loginForm) {
  loginForm.addEventListener('submit', function (e) {
    const email = emailInput.value.trim();
    const password = passwordInput.value;
    const loginButton = document.getElementById('loginButton');
    const buttonText = loginButton.querySelector('.button-text');
    const spinner = document.getElementById('spinner');

    let isValid = true;

    if (!email) {
      e.preventDefault();
      showFieldError('email', 'El correo electrónico es requerido');
      isValid = false;
    } else if (!validateEmail(email)) {
      e.preventDefault();
      showFieldError('email', 'Ingresa un correo electrónico válido');
      isValid = false;
    }

    if (!password) {
      e.preventDefault();
      showFieldError('password', 'La contraseña es requerida');
      isValid = false;
    } else if (!validatePassword(password)) {
      e.preventDefault();
      showFieldError('password', 'La contraseña debe tener al menos 6 caracteres');
      isValid = false;
    }

    if (!isValid) {
      document.querySelector('.login-box').classList.add('shake');
      setTimeout(() => {
        document.querySelector('.login-box').classList.remove('shake');
      }, 500);

      showToast('Por favor corrige los errores en el formulario', 'error');
      return; // IMPORTANTE: return para evitar que se envíe el form
    }

    // Si llegamos aquí, el form es válido - mostrar spinner pero NO preventDefault
    loginButton.disabled = true;
    buttonText.classList.add('d-none');
    spinner.classList.remove('d-none');
    
    // NO HACER e.preventDefault() - dejar que el formulario se envíe normalmente
  });
}

// --- Toggle mostrar contraseña ---
const togglePassword = document.getElementById('togglePassword');
if (togglePassword && passwordInput) {
  togglePassword.addEventListener('click', function () {
    const isHidden = passwordInput.getAttribute('type') === 'password';
    passwordInput.setAttribute('type', isHidden ? 'text' : 'password');

    this.classList.toggle('fa-eye');
    this.classList.toggle('fa-eye-slash');
    this.title = isHidden ? 'Ocultar contraseña' : 'Mostrar contraseña';
  });
}

// --- Forgot password temporal ---
function showForgotPassword() {
  window.location.href = '/auth/forgot-password';
}

// --- Desvanecer alertas del backend ---
document.addEventListener('DOMContentLoaded', function () {
  // ========= Event Listeners (refactorizado para CSP sin unsafe-inline) =========
  
  // Forgot password link
  const forgotPasswordLink = document.querySelector('[data-action="show-forgot-password"]');
  if (forgotPasswordLink) {
    forgotPasswordLink.addEventListener('click', (e) => {
      e.preventDefault();
      showForgotPassword();
    });
  }
  
  // ========= Fin Event Listeners =========
  
  const messages = document.querySelectorAll('.alert');
  messages.forEach(function (message) {
    setTimeout(function () {
      message.classList.add('fade-out');
      setTimeout(function () {
        if (message.parentNode) {
          message.parentNode.removeChild(message);
        }
      }, 300);
    }, 5000);
  });
});
