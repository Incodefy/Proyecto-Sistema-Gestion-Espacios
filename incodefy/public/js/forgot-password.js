// public/js/forgot-password.js

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
  return {
    length: password.length >= 8,
    uppercase: /[A-Z]/.test(password),
    lowercase: /[a-z]/.test(password),
    number: /[0-9]/.test(password),
    special: /[!@#$%^&*(),.?":{}|<>]/.test(password)
  };
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

function updatePasswordRequirements(password) {
  const requirements = validatePassword(password);
  
  Object.keys(requirements).forEach(req => {
    const element = document.querySelector(`[data-requirement="${req}"]`);
    if (element) {
      if (requirements[req]) {
        element.classList.add('met');
      } else {
        element.classList.remove('met');
      }
    }
  });
}

function showStep(stepNumber) {
  document.getElementById('step1').classList.add('d-none');
  document.getElementById('step2').classList.add('d-none');
  document.getElementById('step3').classList.add('d-none');
  document.getElementById(`step${stepNumber}`).classList.remove('d-none');
}

/**
 * Obtiene el token CSRF
 * Compatible con csrf-helper.js y fallback manual
 */
function getCSRFToken() {
  // Opción 1: usar csrf-helper.js si está disponible
  if (window.csrfHelper && window.csrfHelper.getToken) {
    return window.csrfHelper.getToken();
  }
  
  // Opción 2: leer del meta tag
  const metaTag = document.querySelector('meta[name="csrf-token"]');
  if (metaTag) {
    return metaTag.getAttribute('content');
  }
  
  // Opción 3: leer del input hidden
  const hiddenInput = document.querySelector('input[name="_csrf"]');
  if (hiddenInput) {
    return hiddenInput.value;
  }
  
  console.error('❌ No se pudo obtener el token CSRF');
  return '';
}

// Variable global para almacenar el email
let currentEmail = '';

// --- PASO 1: Solicitar código ---
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

const forgotPasswordForm = document.getElementById('forgotPasswordForm');
if (forgotPasswordForm) {
  forgotPasswordForm.addEventListener('submit', async function (e) {
    e.preventDefault();
    
    const email = emailInput.value.trim();
    const sendButton = document.getElementById('sendCodeButton');
    const buttonText = sendButton.querySelector('.button-text');
    const spinner = document.getElementById('spinner1');

    let isValid = true;

    if (!email) {
      showFieldError('email', 'El correo electrónico es requerido');
      isValid = false;
    } else if (!validateEmail(email)) {
      showFieldError('email', 'Ingresa un correo electrónico válido');
      isValid = false;
    }

    if (!isValid) {
      document.querySelector('.login-box').classList.add('shake');
      setTimeout(() => {
        document.querySelector('.login-box').classList.remove('shake');
      }, 500);
      showToast('Por favor corrige los errores en el formulario', 'error');
      return;
    }

    // Mostrar spinner
    sendButton.disabled = true;
    buttonText.classList.add('d-none');
    spinner.classList.remove('d-none');

    try {
      // Enviar solicitud al backend
      const response = await fetch('/auth/forgot-password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-Token': getCSRFToken()
        },
        body: JSON.stringify({ correo: email })
      });

      const data = await response.json();

      if (data.success) {
        // Guardar email para los siguientes pasos
        currentEmail = email;
        document.getElementById('hiddenEmail').value = email;
        
        // Mostrar paso 2 (verificar código)
        showStep(2);
        
        showToast('Código enviado a tu correo electrónico', 'success');
      } else {
        showToast(data.error || 'Error al enviar el código', 'error');
      }
    } catch (error) {
      console.error('Error:', error);
      showToast('Error de conexión. Por favor, intenta nuevamente', 'error');
    } finally {
      // Restaurar botón
      sendButton.disabled = false;
      buttonText.classList.remove('d-none');
      spinner.classList.add('d-none');
    }
  });
}

// --- PASO 2: Verificar código ---
const verifyCodeForm = document.getElementById('verifyCodeForm');
if (verifyCodeForm) {
  verifyCodeForm.addEventListener('submit', async function (e) {
    e.preventDefault();
    
    const code = document.getElementById('verificationCode').value.trim();
    const verifyButton = document.getElementById('verifyCodeButton');
    const buttonText = verifyButton.querySelector('.button-text');
    const spinner = document.getElementById('spinner2');

    let isValid = true;

    // Validar código
    if (!code) {
      showFieldError('code', 'El código de verificación es requerido');
      isValid = false;
    } else if (code.length !== 6 || !/^\d+$/.test(code)) {
      showFieldError('code', 'El código debe tener 6 dígitos');
      isValid = false;
    }

    if (!isValid) {
      document.querySelector('.login-box').classList.add('shake');
      setTimeout(() => {
        document.querySelector('.login-box').classList.remove('shake');
      }, 500);
      showToast('Por favor ingresa un código válido', 'error');
      return;
    }

    // Mostrar spinner
    verifyButton.disabled = true;
    buttonText.classList.add('d-none');
    spinner.classList.remove('d-none');

    try {
      // Verificar código en el backend
      const response = await fetch('/auth/verify-code', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-Token': getCSRFToken()
        },
        body: JSON.stringify({ 
          correo: currentEmail,
          codigo: code 
        })
      });

      const data = await response.json();

      if (data.success) {
        // Guardar código para el paso final
        document.getElementById('hiddenEmail2').value = currentEmail;
        document.getElementById('hiddenCode').value = code;
        
        // Mostrar paso 3 (nueva contraseña)
        showStep(3);
        
        showToast('Código verificado correctamente', 'success');
      } else {
        showToast(data.error || 'Código incorrecto', 'error');
        showFieldError('code', data.error || 'Código incorrecto');
      }
    } catch (error) {
      console.error('Error:', error);
      showToast('Error de conexión. Por favor, intenta nuevamente', 'error');
    } finally {
      // Restaurar botón
      verifyButton.disabled = false;
      buttonText.classList.remove('d-none');
      spinner.classList.add('d-none');
    }
  });
}

// --- PASO 3: Ingresar nueva contraseña ---
const newPasswordInput = document.getElementById('newPassword');
const confirmPasswordInput = document.getElementById('confirmPassword');

if (newPasswordInput) {
  newPasswordInput.addEventListener('input', function () {
    updatePasswordRequirements(this.value);
    if (this.classList.contains('error')) {
      clearFieldValidation('newPassword');
    }
  });

  newPasswordInput.addEventListener('blur', function () {
    const password = this.value;
    const requirements = validatePassword(password);
    const allMet = Object.values(requirements).every(val => val === true);
    
    if (!password) {
      showFieldError('newPassword', 'La contraseña es requerida');
    } else if (!allMet) {
      showFieldError('newPassword', 'La contraseña no cumple todos los requisitos');
    } else {
      showFieldSuccess('newPassword');
    }
  });
}

if (confirmPasswordInput) {
  confirmPasswordInput.addEventListener('blur', function () {
    const password = newPasswordInput.value;
    const confirm = this.value;
    
    if (!confirm) {
      showFieldError('confirmPassword', 'Debes confirmar tu contraseña');
    } else if (password !== confirm) {
      showFieldError('confirmPassword', 'Las contraseñas no coinciden');
    } else {
      showFieldSuccess('confirmPassword');
    }
  });

  confirmPasswordInput.addEventListener('input', function () {
    if (this.classList.contains('error')) {
      clearFieldValidation('confirmPassword');
    }
  });
}

const resetPasswordForm = document.getElementById('resetPasswordForm');
if (resetPasswordForm) {
  resetPasswordForm.addEventListener('submit', async function (e) {
    e.preventDefault();
    
    const newPassword = newPasswordInput.value;
    const confirmPassword = confirmPasswordInput.value;
    const resetButton = document.getElementById('resetPasswordButton');
    const buttonText = resetButton.querySelector('.button-text');
    const spinner = document.getElementById('spinner3');

    let isValid = true;

    // Validar nueva contraseña
    const requirements = validatePassword(newPassword);
    const allMet = Object.values(requirements).every(val => val === true);
    
    if (!newPassword) {
      showFieldError('newPassword', 'La contraseña es requerida');
      isValid = false;
    } else if (!allMet) {
      showFieldError('newPassword', 'La contraseña no cumple todos los requisitos');
      isValid = false;
    }

    // Validar confirmación
    if (!confirmPassword) {
      showFieldError('confirmPassword', 'Debes confirmar tu contraseña');
      isValid = false;
    } else if (newPassword !== confirmPassword) {
      showFieldError('confirmPassword', 'Las contraseñas no coinciden');
      isValid = false;
    }

    if (!isValid) {
      document.querySelector('.login-box').classList.add('shake');
      setTimeout(() => {
        document.querySelector('.login-box').classList.remove('shake');
      }, 500);
      showToast('Por favor corrige los errores en el formulario', 'error');
      return;
    }

    // Mostrar spinner
    resetButton.disabled = true;
    buttonText.classList.add('d-none');
    spinner.classList.remove('d-none');

    try {
      // Enviar nueva contraseña al backend
      const response = await fetch('/auth/reset-password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-Token': getCSRFToken()
        },
        body: JSON.stringify({ 
          correo: document.getElementById('hiddenEmail2').value,
          codigo: document.getElementById('hiddenCode').value,
          password: newPassword
        })
      });

      const data = await response.json();

      if (data.success) {
        showToast('Contraseña restablecida exitosamente. Redirigiendo...', 'success');
        
        // Redirigir al login después de 2 segundos
        setTimeout(() => {
          window.location.href = '/login';
        }, 2000);
      } else {
        showToast(data.error || 'Error al restablecer la contraseña', 'error');
        
        // Restaurar botón
        resetButton.disabled = false;
        buttonText.classList.remove('d-none');
        spinner.classList.add('d-none');
      }
    } catch (error) {
      console.error('Error:', error);
      showToast('Error de conexión. Por favor, intenta nuevamente', 'error');
      
      // Restaurar botón
      resetButton.disabled = false;
      buttonText.classList.remove('d-none');
      spinner.classList.add('d-none');
    }
  });
}

// --- Toggle mostrar contraseña ---
const toggleNewPassword = document.getElementById('toggleNewPassword');
if (toggleNewPassword && newPasswordInput) {
  toggleNewPassword.addEventListener('click', function () {
    const isHidden = newPasswordInput.getAttribute('type') === 'password';
    newPasswordInput.setAttribute('type', isHidden ? 'text' : 'password');
    this.classList.toggle('fa-eye');
    this.classList.toggle('fa-eye-slash');
    this.title = isHidden ? 'Ocultar contraseña' : 'Mostrar contraseña';
  });
}

const toggleConfirmPassword = document.getElementById('toggleConfirmPassword');
if (toggleConfirmPassword && confirmPasswordInput) {
  toggleConfirmPassword.addEventListener('click', function () {
    const isHidden = confirmPasswordInput.getAttribute('type') === 'password';
    confirmPasswordInput.setAttribute('type', isHidden ? 'text' : 'password');
    this.classList.toggle('fa-eye');
    this.classList.toggle('fa-eye-slash');
    this.title = isHidden ? 'Ocultar contraseña' : 'Mostrar contraseña';
  });
}

// Volver al paso 1
const backToStep1 = document.getElementById('backToStep1');
if (backToStep1) {
  backToStep1.addEventListener('click', function (e) {
    e.preventDefault();
    showStep(1);
    
    // Limpiar campos
    document.getElementById('verificationCode').value = '';
    clearFieldValidation('code');
  });
}

// Desvanecer alertas del backend
document.addEventListener('DOMContentLoaded', function () {
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
